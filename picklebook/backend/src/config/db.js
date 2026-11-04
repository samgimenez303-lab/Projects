const mysql = require('mysql2/promise');
require('dotenv').config();

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT, 10) || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'picklebook',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  dateStrings: true,
  enableKeepAlive: true,
  keepAliveInitialDelay: 10000
});

/**
 * Execute a query with prepared statement parameters
 * @param {string} sql 
 * @param {Array} params 
 * @returns {Promise<[Array, Array]>}
 */
const query = async (sql, params = []) => {
  return pool.execute(sql, params);
};

/**
 * Acquire a connection from the pool (for transactions)
 * @returns {Promise<PoolConnection>}
 */
const getConnection = async () => {
  return pool.getConnection();
};

/**
 * Test the database connection
 */
const testConnection = async () => {
  try {
    const connection = await pool.getConnection();
    console.log('Database connection pool established successfully.');
    connection.release();
    return true;
  } catch (error) {
    console.error('Database connection failed:', error.message);
    return false;
  }
};

module.exports = {
  pool,
  query,
  getConnection,
  testConnection
};
