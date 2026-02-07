/**
 * 🔍 Full Database Inspector
 * Run: node server/inspect-db.js
 *
 * Shows everything stored in the database:
 * collections, users, likes, seen memes, indexes, and sample documents.
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const { connectToDatabase, getConnectionStatus, closeConnection } = require('./config/db');

// ── Helpers ──────────────────────────────────────────────────────────
const line = (char = '─', len = 60) => char.repeat(len);
const section = (emoji, title) => {
  console.log('\n' + line('═'));
  console.log(`  ${emoji}  ${title}`);
  console.log(line('═'));
};
const sub = (emoji, title) => console.log(`\n  ${emoji} ${title}\n  ${line('╌', 50)}`);
const kv = (key, value) => console.log(`    ${key.padEnd(22)} ${value}`);
const indent = (msg) => console.log(`    ${msg}`);
const bullet = (msg) => console.log(`      • ${msg}`);

async function inspect() {
  // ── 1. Connection ──────────────────────────────────────────────────
  section('🔌', 'DATABASE CONNECTION');

  if (!process.env.MONGODB_URI) {
    console.error('  ❌ MONGODB_URI is not set in .env — nothing to inspect.');
    process.exit(1);
  }

  let db;
  try {
    db = await connectToDatabase();
    const ping = await db.command({ ping: 1 });
    const status = getConnectionStatus();
    kv('Status:', ping.ok === 1 ? '✅ Connected' : '❌ Ping failed');
    kv('Database:', status.databaseName);
    kv('URI:', status.uri);
  } catch (err) {
    console.error('  ❌ Connection failed:', err.message);
    process.exit(1);
  }

  // ── 2. Collections overview ────────────────────────────────────────
  section('📦', 'COLLECTIONS');

  const collections = await db.listCollections().toArray();
  if (collections.length === 0) {
    indent('⚠️  No collections found — the database is completely empty.');
    indent('   This means nothing has ever been written.');
    await closeConnection();
    return;
  }

  for (const col of collections) {
    const coll = db.collection(col.name);
    const count = await coll.countDocuments();
    const indexes = await coll.indexes();
    indent(`📁 ${col.name}  —  ${count} document(s), ${indexes.length} index(es)`);
  }

  // ── 3. Likes collection deep dive ──────────────────────────────────
  section('❤️', 'LIKES COLLECTION');

  const likesCol = db.collection('likes');
  const totalLikes = await likesCol.countDocuments();
  kv('Total likes:', totalLikes);

  if (totalLikes === 0) {
    indent('⚠️  No likes saved at all. The collection is empty.');
    indent('   Possible causes:');
    bullet('POST /api/likes is never called (frontend issue)');
    bullet('The request fails silently (check browser console)');
    bullet('User is not signed in (Clerk auth issue)');
  } else {
    // Unique users who liked
    const uniqueUsers = await likesCol.distinct('userId');
    kv('Unique users:', uniqueUsers.length);

    sub('👤', 'Users breakdown');
    for (const userId of uniqueUsers) {
      const userLikes = await likesCol.countDocuments({ userId });
      const latest = await likesCol.findOne({ userId }, { sort: { createdAt: -1 } });
      const latestDate = latest?.createdAt
        ? new Date(latest.createdAt).toLocaleString()
        : 'unknown';
      indent(`${userId}`);
      bullet(`${userLikes} like(s)  |  latest: ${latestDate}`);
    }

    // Show sample documents
    sub('📄', 'Sample like documents (last 3)');
    const sampleLikes = await likesCol.find().sort({ createdAt: -1 }).limit(3).toArray();
    for (const doc of sampleLikes) {
      indent(`── Document _id: ${doc._id}`);
      kv('  userId:', doc.userId || '❌ MISSING');
      kv('  memeId:', doc.memeId || '❌ MISSING');
      kv('  createdAt:', doc.createdAt ? new Date(doc.createdAt).toLocaleString() : '❌ MISSING');
      if (doc.memeData) {
        kv('  memeData.id:', doc.memeData.id || '❌ MISSING');
        kv('  memeData.title:', (doc.memeData.title || '').substring(0, 60));
        kv('  memeData.subreddit:', doc.memeData.subreddit || 'n/a');
        kv('  memeData.url:', (doc.memeData.url || '').substring(0, 80));
      } else {
        indent('  ⚠️  memeData field is MISSING on this document');
      }
      console.log();
    }

    // Verify data integrity
    sub('🩺', 'Data integrity checks');
    const missingUserId = await likesCol.countDocuments({ userId: { $exists: false } });
    const missingMemeId = await likesCol.countDocuments({ memeId: { $exists: false } });
    const missingMemeData = await likesCol.countDocuments({ memeData: { $exists: false } });
    const missingMemeDataId = await likesCol.countDocuments({ 'memeData.id': { $exists: false } });
    indent(`${missingUserId === 0 ? '✅' : '❌'} Documents missing userId: ${missingUserId}`);
    indent(`${missingMemeId === 0 ? '✅' : '❌'} Documents missing memeId: ${missingMemeId}`);
    indent(`${missingMemeData === 0 ? '✅' : '❌'} Documents missing memeData: ${missingMemeData}`);
    indent(`${missingMemeDataId === 0 ? '✅' : '❌'} Documents missing memeData.id: ${missingMemeDataId}`);
  }

  // ── 4. Indexes on likes ────────────────────────────────────────────
  sub('🗂️', 'Likes indexes');
  const likesIndexes = await likesCol.indexes();
  for (const idx of likesIndexes) {
    indent(`${idx.name}  ${idx.unique ? '(unique)' : ''}  →  ${JSON.stringify(idx.key)}`);
  }

  // ── 5. Seen memes collection deep dive ─────────────────────────────
  section('👁️', 'SEEN MEMES COLLECTION');

  const seenCol = db.collection('seen_memes');
  const totalSeen = await seenCol.countDocuments();
  kv('Total seen records:', totalSeen);

  if (totalSeen === 0) {
    indent('⚠️  No seen-meme records. Collection is empty.');
  } else {
    const seenUsers = await seenCol.distinct('userId');
    kv('Unique users:', seenUsers.length);

    sub('👤', 'Users breakdown');
    for (const userId of seenUsers) {
      const userSeen = await seenCol.countDocuments({ userId });
      const feeds = await seenCol.distinct('feedKey', { userId });
      indent(`${userId}`);
      bullet(`${userSeen} seen record(s)  |  feeds: ${feeds.join(', ') || 'none'}`);
    }

    sub('📄', 'Sample seen documents (last 3)');
    const sampleSeen = await seenCol.find().sort({ createdAt: -1 }).limit(3).toArray();
    for (const doc of sampleSeen) {
      indent(`── Document _id: ${doc._id}`);
      kv('  userId:', doc.userId || '❌ MISSING');
      kv('  feedKey:', doc.feedKey || '❌ MISSING');
      kv('  memeId:', doc.memeId || '❌ MISSING');
      kv('  createdAt:', doc.createdAt ? new Date(doc.createdAt).toLocaleString() : '❌ MISSING');
      console.log();
    }

    sub('🗂️', 'Seen memes indexes');
    const seenIndexes = await seenCol.indexes();
    for (const idx of seenIndexes) {
      indent(`${idx.name}  ${idx.unique ? '(unique)' : ''}  →  ${JSON.stringify(idx.key)}`);
    }
  }

  // ── 6. Any other collections? ──────────────────────────────────────
  const knownCollections = ['likes', 'seen_memes'];
  const otherCollections = collections.filter(c => !knownCollections.includes(c.name));

  if (otherCollections.length > 0) {
    section('📂', 'OTHER COLLECTIONS');
    for (const col of otherCollections) {
      const coll = db.collection(col.name);
      const count = await coll.countDocuments();
      indent(`📁 ${col.name}  —  ${count} document(s)`);
      if (count > 0 && count <= 5) {
        const docs = await coll.find().limit(5).toArray();
        for (const doc of docs) {
          indent(`   ${JSON.stringify(doc).substring(0, 120)}`);
        }
      }
    }
  }

  // ── 7. Summary ─────────────────────────────────────────────────────
  section('📊', 'SUMMARY');
  kv('Collections:', collections.length);
  kv('Total likes:', totalLikes);
  kv('Total seen memes:', totalSeen);
  if (totalLikes > 0) {
    const uniqueUsers = await likesCol.distinct('userId');
    kv('Users with likes:', uniqueUsers.length);
  }
  if (totalSeen > 0) {
    const seenUsers = await seenCol.distinct('userId');
    kv('Users with seen:', seenUsers.length);
  }

  if (totalLikes === 0 && totalSeen === 0) {
    console.log('\n  🚨 DATABASE IS EMPTY — nothing has been written yet.');
    console.log('  ─────────────────────────────────────────────────');
    console.log('  This means the backend API is never receiving data.');
    console.log('  Check the following:');
    console.log('    1. Is the backend server running? (node server/index.js)');
    console.log('    2. Is the frontend proxy working? (setupProxy.js → localhost:3001)');
    console.log('    3. Open browser DevTools → Network tab → look for POST /api/likes');
    console.log('    4. Open browser DevTools → Console → look for "Saving like to backend"');
    console.log('    5. Is the user signed in? (Clerk isSignedIn must be true)');
    console.log('    6. Try liking a meme, then re-run this script immediately.');
  }

  console.log('\n' + line('═') + '\n');

  await closeConnection();
}

inspect().catch((err) => {
  console.error('💥 Inspection failed:', err);
  process.exit(1);
});
