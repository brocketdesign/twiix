/**
 * Database Connection Check Script
 * Run: node server/check-db.js
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const { connectToDatabase, getConnectionStatus, closeConnection } = require('./config/db');

async function checkDatabase() {
  console.log('=== Database Connection Check ===\n');

  if (!process.env.MONGODB_URI) {
    console.error('❌ MONGODB_URI is not set in .env');
    process.exit(1);
  }

  try {
    // Attempt connection
    const db = await connectToDatabase();

    // Run a ping command to verify the connection is alive
    const result = await db.command({ ping: 1 });

    if (result.ok === 1) {
      console.log('✅ Ping successful — database is reachable\n');
    }

    // Print connection details (credentials are masked)
    const status = getConnectionStatus();
    console.log('Connection details:');
    console.log(`  Database : ${status.databaseName}`);
    console.log(`  URI      : ${status.uri}`);
    console.log(`  Connected: ${status.connected}\n`);

    // List existing collections
    const collections = await db.listCollections().toArray();
    console.log(`Collections (${collections.length}):`);
    collections.forEach((c) => console.log(`  - ${c.name}`));

    console.log('\n✅ All checks passed');
  } catch (error) {
    console.error('❌ Connection failed:', error.message);
    process.exit(1);
  } finally {
    await closeConnection();
  }
}

checkDatabase();
