const dotenv = require('dotenv');
const mysql = require('mysql2/promise');

dotenv.config();

async function main() {
  const pool = await mysql.createPool({
    host: 'localhost',
    user: process.env.DB_USER,
    waitForConnections: true,
    connectionLimit: 10,
    password: process.env.DB_PASSWORD,
  });

  // db-migrate requires us to do this separately from the migrations :(
  await pool.query(`
CREATE DATABASE IF NOT EXISTS cruise_reservation
  DEFAULT CHARACTER SET utf8mb4
  DEFAULT COLLATE utf8mb4_unicode_ci;
`)

  process.exit(0)
}

// not a real migration
exports.setup = function (options, seedLink) { }
exports.up = function (db) { }
exports.down = function (db) { }
exports._meta = {
  "version": 1
};


main()
