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
    console.log('[DB] Database tables initialized successfully');
  } catch (error) {
    console.error('[DB] Error initializing database:', error);
    throw error;
  }
}

module.exports = {
  query,
  pool,
  initializeDb
};
