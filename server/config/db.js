const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// Test connection on startup
pool.getConnection()
  .then(connection => {
    console.log('[DB] Connected to MySQL database successfully');
    console.log('[DB] Host:', process.env.DB_HOST);
    console.log('[DB] Database:', process.env.DB_NAME);
    connection.release();
  })
  .catch(err => {
    console.error('[DB] Failed to connect to MySQL database:');
    console.error('[DB] Host:', process.env.DB_HOST);
    console.error('[DB] Database:', process.env.DB_NAME);
    console.error('[DB] Error:', err.message);
  });

async function query(sql, params) {
  try {
    const [results] = await pool.execute(sql, params);
    return results;
  } catch (error) {
    console.error('[DB] Query error:', error.message);
    console.error('[DB] SQL:', sql);
    throw error;
  }
}

// For queries with dynamic number of placeholders (e.g. batch inserts)
async function rawQuery(sql, params) {
  try {
    const [results] = await pool.query(sql, params);
    return results;
  } catch (error) {
    console.error('[DB] Raw query error:', error.message);
    console.error('[DB] SQL:', sql);
    throw error;
  }
}

// Get pool status for debugging
function getPoolStatus() {
  return {
    totalConnections: pool.pool?._allConnections?.length || 'N/A',
    freeConnections: pool.pool?._freeConnections?.length || 'N/A',
    connectionLimit: pool.pool?.config?.connectionLimit || 10
  };
}

// Function to initialize the database tables
async function initializeDb() {
  try {
    console.log('[DB] Initializing database tables...');
    await query(`
      CREATE TABLE IF NOT EXISTS likes (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id VARCHAR(255) NOT NULL,
        meme_id VARCHAR(255) NOT NULL,
        meme_data JSON NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY user_meme (user_id, meme_id),
        INDEX idx_user_id (user_id)
      )
    `);
    await query(`
      CREATE TABLE IF NOT EXISTS seen_memes (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id VARCHAR(255) NOT NULL,
        meme_id VARCHAR(255) NOT NULL,
        feed_key VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY user_feed_meme (user_id, feed_key, meme_id),
        INDEX idx_user_feed (user_id, feed_key)
      )
    `);
    console.log('[DB] Database tables initialized successfully');
  } catch (error) {
    console.error('[DB] Error initializing database:', error);
    throw error;
  }
}

module.exports = {
  query,
  rawQuery,
  pool,
  initializeDb,
  getPoolStatus
};
