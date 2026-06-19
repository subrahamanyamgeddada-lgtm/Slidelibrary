const { Pool } = require('pg');
require('dotenv').config();

const sslConfig = process.env.DATABASE_URL && (process.env.DATABASE_URL.includes('render.com') || process.env.DATABASE_URL.includes('sslmode=require') || process.env.NODE_ENV === 'production')
  ? { rejectUnauthorized: false }
  : false;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: sslConfig
});

module.exports = {
  query: (text, params) => pool.query(text, params),
  pool
};
