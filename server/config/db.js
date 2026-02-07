const { MongoClient } = require('mongodb');

const MONGODB_URI = process.env.MONGODB_URI;
const DB_NAME = process.env.DB_NAME || 'twiix';

let client = null;
let db = null;

// Connect to MongoDB
async function connectToDatabase() {
  if (db) {
    return db;
  }

  try {
    console.log('[DB] Connecting to MongoDB...');
    client = new MongoClient(MONGODB_URI);
    await client.connect();
    db = client.db(DB_NAME);
    console.log('[DB] Connected to MongoDB successfully');
    console.log('[DB] Database:', DB_NAME);
    return db;
  } catch (error) {
    console.error('[DB] Failed to connect to MongoDB:', error.message);
    throw error;
  }
}

// Get database instance
function getDb() {
  if (!db) {
    throw new Error('Database not initialized. Call connectToDatabase() first.');
  }
  return db;
}

// Get client instance
function getClient() {
  return client;
}

// Get connection status for debugging
function getConnectionStatus() {
  return {
    connected: client?.topology?.isConnected() || false,
    databaseName: DB_NAME,
    uri: MONGODB_URI ? MONGODB_URI.replace(/\/\/[^:]+:[^@]+@/, '//***:***@') : 'not set' // Hide credentials
  };
}

// Initialize database collections and indexes
async function initializeDb() {
  try {
    console.log('[DB] Initializing database collections...');
    const database = await connectToDatabase();
    
    // Create likes collection with indexes
    const likesCollection = database.collection('likes');
    await likesCollection.createIndex({ userId: 1, memeId: 1 }, { unique: true });
    await likesCollection.createIndex({ userId: 1 });
    await likesCollection.createIndex({ createdAt: -1 });
    
    // Create seen_memes collection with indexes
    const seenMemesCollection = database.collection('seen_memes');
    await seenMemesCollection.createIndex({ userId: 1, feedKey: 1, memeId: 1 }, { unique: true });
    await seenMemesCollection.createIndex({ userId: 1, feedKey: 1 });
    
    console.log('[DB] Database collections initialized successfully');
  } catch (error) {
    console.error('[DB] Error initializing database:', error);
    throw error;
  }
}

// Close connection (for graceful shutdown)
async function closeConnection() {
  if (client) {
    await client.close();
    client = null;
    db = null;
    console.log('[DB] MongoDB connection closed');
  }
}

module.exports = {
  connectToDatabase,
  getDb,
  getClient,
  getConnectionStatus,
  initializeDb,
  closeConnection
};
