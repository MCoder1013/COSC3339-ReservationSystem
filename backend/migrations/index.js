import dotenv from 'dotenv'
import fs from 'fs/promises'
import EmbeddedPostgres from 'embedded-postgres';
import postgres from 'postgres';

dotenv.config()

const pgOptions = {
  databaseDir: './data/db',
  user: process.env.DB_USER,
  // Password is required, so just set a placeholder if it's not set.
  password: process.env.DB_PASSWORD || 'pass',
  port: 5432,
  persistent: true,
  initdbFlags: ['--encoding=utf8', '--locale=en_US.UTF-8']
}
const pg = new EmbeddedPostgres(pgOptions);
try {
  await pg.initialise();
} catch (err) {
  // Probably means that the database already exists.
  console.log('Failed to initialize:', err)
}
await pg.start();

function connectPg(database) {
  return postgres({
    user: pgOptions.user,
    password: pgOptions.password,
    port: pgOptions.port,
    host: 'localhost',
    database
  });
}

// Default to 'postgres' first so it doesn't error if our database doesn't exist.
let sql = connectPg('postgres')

try {
  await sql`
  CREATE DATABASE cruise_reservation
  ENCODING 'UTF8'
  LC_COLLATE = 'en_US.UTF-8'
  LC_CTYPE = 'en_US.UTF-8';
`;
} catch (err) {
  // if it's a duplicate database error, that's fine and can be ignored
  if (err.code !== '42P04')
    throw err
}
sql = connectPg('cruise_reservation')

await sql`ALTER SYSTEM SET TIMEZONE = 'UTC'`
process.env.TZ = 'UTC'

try {
  await sql`
    CREATE TABLE migrations (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL UNIQUE,
      run_on VARCHAR(60) NOT NULL
    )
  `;
} catch (err) { }

async function up() {
  console.log('Starting up')

  const executedMigrations = await sql`SELECT name, run_on FROM migrations`

  const migrationFiles = await fs.readdir('migrations/sqls');
  // The oldest migrations should be first.
  migrationFiles.sort()

  // We distinguish migrations by their timestamps instead of their names, so
  // if a migration is renamed we don't rerun it.

  /** @type {Set<string>} */
  const executedMigrationTimestamps = new Set()
  for (const executed of executedMigrations) {
    // The name is formatted like `/20260204233430-init`.
    executedMigrationTimestamps.add(executed.name.split('-')[0].split('/')[1])
  }

  console.log('migrationFiles', migrationFiles)

  for (const fileName of migrationFiles) {
    if (!fileName.endsWith('.sql')) {
      console.warn('Non SQL file in sqls directory:', fileName)
      continue
    }
    /** @type {string} */
    let migrationTimestampAndName
    if (fileName.endsWith('-up.sql')) {
      migrationTimestampAndName = fileName.slice(0, -7)
      // } else if (fileName.endsWith('-down.sql')) {
      //   migrationTimestampAndName = fileName.slice(0, -9)
    } else {
      console.warn('Migration file name should end in `-up.sql`, was', fileName)
      continue
    }

    const migrationTimestamp = migrationTimestampAndName.split('-')[0]
    if (!(/\d{14}/.test(migrationTimestamp))) {
      console.warn('Invalid migration file name:', fileName)
      continue
    }

    if (executedMigrationTimestamps.has(migrationTimestamp)) {
      // We've already executed this one, so it can safely be skipped.
      continue;
    }

    await runMigration(fileName)
  }

  // console.log('executedMigrations', executedMigrations)
  // console.log('files', files)
}

/**
 * Run an existing migration by its file name, and mark it as up in the
 * database.
 * 
 * @param {string} fileName 
 */
async function runMigration(fileName) {
  const migrationSql = await fs.readFile(`migrations/sqls/${fileName}`, 'utf8')
  console.log('Running migration at', fileName)

  await sql.begin(async sql => {
    try {
      await sql.unsafe(migrationSql)
    } catch (err) {
      throw err
    }
  })

  const migrationName = fileName.slice(0, -('-up.sql'.length))

  await sql`INSERT INTO migrations (name, run_on) VALUES (${'/' + migrationName}, now())`;
}

/**
 * 
 * @param {string} name Create a new migration with the given name.
 */
async function newMigration(name) {
  const nameRegex = /^[a-z-0-9]+$/
  if (!nameRegex.test(name)) {
    console.error(`Invalid new migration name '${name}', should be lowercase and separated by hyphens, for example \`migration-name-here\`.`)
    return
  }

  const d = new Date()
  const timestamp = [
    d.getUTCFullYear(),
    (d.getUTCMonth() + 1).toString().padStart(2, '0'),
    d.getUTCDate().toString().padStart(2, '0'),
    d.getUTCHours().toString().padStart(2, '0'),
    d.getUTCMinutes().toString().padStart(2, '0'),
    d.getUTCSeconds().toString().padStart(2, '0')
  ].join('')

  const newFileName = `${timestamp}-${name}-up.sql`


  const newPath = `migrations/sqls/${newFileName}`
  await fs.writeFile(newPath, '')

  console.log(`\nCreated empty migration at \x1b[1m${newPath}\x1b[m`)
  console.log("\x1b[90m\x1b[3mNote: Run 'npm run migrate' when you've finished making it.\x1b[m")
}



const args = process.argv.slice(2)

if (args.length === 0) {
  await up()
} else {
  const arg0 = args[0]
  if (arg0 === 'up') {
    await up()
  } else if (arg0 === 'new') {
    if (args.length < 2) {
      console.error('Usage: `npm run migrate new <name>`.')
    }
    await newMigration(args[1])
  } else {
    console.error('Usage: `npm run migrate [up|new]`.')
  }
}


process.exit(0)