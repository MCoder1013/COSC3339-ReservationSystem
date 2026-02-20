## Initial setup

```sh
cd backend
npm install
# in a separate tab
cd frontend
npm install
```

## Development

```sh
cd backend
npm run dev
# in a separate tab
cd frontend
npm run dev
```

# Database

The database uses PostgreSQL, and it's installed and ran automatically when the backend is started.

To connect to the database through the terminal, you can install PostgreSQL
from https://www.postgresql.org/download/ and then run
`psql postgresql://localhost/cruise_reservation -U user`
and then enter either whatever password is in your `.env`, or "pass" if there is none.

## Database schema migrations

To modify the schema of the database, you'll have to make migration.

These are written as individual SQL files so the migration code can apply them individually.

To create a migration, run the following commands (replacing `migration-name-here` with a short name, similar to a branch name):

```sh
cd backend
npm run migrate new migration-name-here
```

Then, edit the new file that got created in `backend/migrations/sqls/` with your migration name.

When you finish writing the migration, use `npm run migrate` to run all new migrations.
If there's an error, then the changes will get rolled back so you can edit the migration and try again.

Note that for convenience, using `npm run dev` will also run all new migrations.

Also, be aware that you should not edit old migrations, because those won't be applied automatically.
If you've already pushed the change to GitHub, make a new migration instead.
