const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL + '&sslmode=verify-full',
  ssl: { rejectUnauthorized: false }
});

module.exports = pool;
