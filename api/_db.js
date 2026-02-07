const { MongoClient } = require('mongodb');

const MONGODB_URI = process.env.MONGODB_URI;
const DB_NAME = process.env.DB_NAME || 'twiix';

let cachedClient = null;
let cachedDb = null;

async function connectToDatabase() {
  if (cachedDb) {
    return cachedDb;
  }

  if (!MONGODB_URI) {
    throw new Error('MONGODB_URI environment variable is not set');
  }

  const client = new MongoClient(MONGODB_URI);
  await client.connect();
  const db = client.db(DB_NAME);

  cachedClient = client;
  cachedDb = db;

  return db;
}

async function ensureIndexes(db) {
  const likesCollection = db.collection('likes');
  await likesCollection.createIndex({ userId: 1, memeId: 1 }, { unique: true });
  await likesCollection.createIndex({ userId: 1 });
  await likesCollection.createIndex({ createdAt: -1 });

  const seenMemesCollection = db.collection('seen_memes');
  await seenMemesCollection.createIndex({ userId: 1, feedKey: 1, memeId: 1 }, { unique: true });
  await seenMemesCollection.createIndex({ userId: 1, feedKey: 1 });
}

module.exports = { connectToDatabase, ensureIndexes };
