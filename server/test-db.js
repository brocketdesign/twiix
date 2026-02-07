/**
 * 🧪 Database Round-Trip Test
 * Run: node server/test-db.js
 *
 * Writes test data → Reads it back → Verifies it → Deletes it
 * Tests both the "likes" and "seen_memes" collections end-to-end.
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const { connectToDatabase, closeConnection } = require('./config/db');

const TEST_USER_ID = '__test_user_12345__';
const TEST_MEMES = [
  { id: 'meme_aaa', title: 'Funny cat', subreddit: 'memes', url: 'https://example.com/cat.jpg' },
  { id: 'meme_bbb', title: 'Dank doge', subreddit: 'dankmemes', url: 'https://example.com/doge.jpg' },
  { id: 'meme_ccc', title: 'Wholesome seal', subreddit: 'wholesomememes', url: 'https://example.com/seal.jpg' },
];
const TEST_FEED_KEY = 'hot_memes';
const TEST_SEEN_IDS = ['seen_111', 'seen_222', 'seen_333', 'seen_444'];

const line = (ch = '─', n = 60) => ch.repeat(n);
const section = (emoji, title) => {
  console.log(`\n${line('═')}`);
  console.log(`  ${emoji}  ${title}`);
  console.log(line('═'));
};
const ok = (msg) => console.log(`    ✅  ${msg}`);
const fail = (msg) => console.log(`    ❌  ${msg}`);
const info = (msg) => console.log(`    ℹ️   ${msg}`);

let passed = 0;
let failed = 0;

function check(condition, passMsg, failMsg) {
  if (condition) { ok(passMsg); passed++; }
  else { fail(failMsg); failed++; }
}

async function run() {
  console.log('\n🧪  DATABASE ROUND-TRIP TEST');
  console.log(`    Testing with user: ${TEST_USER_ID}\n`);

  // ── Connect ────────────────────────────────────────────────────────
  section('🔌', 'STEP 1 — Connect to database');
  let db;
  try {
    db = await connectToDatabase();
    const ping = await db.command({ ping: 1 });
    check(ping.ok === 1, 'Connected and pinged successfully', 'Ping failed');
  } catch (err) {
    fail(`Connection failed: ${err.message}`);
    process.exit(1);
  }

  const likesCol = db.collection('likes');
  const seenCol = db.collection('seen_memes');

  // ── Write likes ────────────────────────────────────────────────────
  section('✏️', 'STEP 2 — Write test likes');
  for (const meme of TEST_MEMES) {
    try {
      await likesCol.updateOne(
        { userId: TEST_USER_ID, memeId: meme.id },
        { $set: { userId: TEST_USER_ID, memeId: meme.id, memeData: meme, createdAt: new Date() } },
        { upsert: true }
      );
      ok(`Wrote like: "${meme.title}" (${meme.id})`);
    } catch (err) {
      fail(`Failed to write "${meme.title}": ${err.message}`);
      failed++;
    }
  }

  // ── Read likes back ────────────────────────────────────────────────
  section('🔎', 'STEP 3 — Read likes back & verify');
  const savedLikes = await likesCol.find({ userId: TEST_USER_ID }).sort({ createdAt: -1 }).toArray();
  check(savedLikes.length === TEST_MEMES.length,
    `Found ${savedLikes.length} likes (expected ${TEST_MEMES.length})`,
    `Expected ${TEST_MEMES.length} likes but found ${savedLikes.length}`);

  for (const meme of TEST_MEMES) {
    const doc = savedLikes.find(d => d.memeId === meme.id);
    if (doc) {
      const dataOk = doc.memeData && doc.memeData.id === meme.id && doc.memeData.title === meme.title;
      check(dataOk,
        `Verified "${meme.title}" — memeData intact`,
        `"${meme.title}" memeData is corrupted or missing`);
    } else {
      fail(`"${meme.title}" (${meme.id}) not found in database`);
      failed++;
    }
  }

  // ── Simulate frontend fetch (same query the API uses) ──────────────
  section('📡', 'STEP 4 — Simulate GET /api/likes/:userId');
  const fetchedLikes = await likesCol.find({ userId: TEST_USER_ID }).sort({ createdAt: -1 }).toArray();
  const memeDataList = fetchedLikes.map(l => l.memeData);
  check(memeDataList.length === TEST_MEMES.length,
    `API-style fetch returned ${memeDataList.length} meme(s)`,
    `API-style fetch returned ${memeDataList.length} instead of ${TEST_MEMES.length}`);

  const allHaveId = memeDataList.every(m => m && m.id);
  check(allHaveId,
    'All returned memeData objects have an "id" field',
    'Some memeData objects are missing the "id" field — this would break isLiked()');

  info('Returned data preview:');
  for (const m of memeDataList) {
    console.log(`      📄  id=${m.id}  title="${m.title}"  subreddit=${m.subreddit}`);
  }

  // ── Write seen memes ───────────────────────────────────────────────
  section('✏️', 'STEP 5 — Write test seen memes');
  const seenOps = TEST_SEEN_IDS.map(memeId => ({
    updateOne: {
      filter: { userId: TEST_USER_ID, feedKey: TEST_FEED_KEY, memeId },
      update: { $setOnInsert: { userId: TEST_USER_ID, feedKey: TEST_FEED_KEY, memeId, createdAt: new Date() } },
      upsert: true
    }
  }));
  try {
    const result = await seenCol.bulkWrite(seenOps, { ordered: false });
    ok(`Bulk-wrote ${result.upsertedCount} seen meme(s)`);
  } catch (err) {
    fail(`Bulk write failed: ${err.message}`);
    failed++;
  }

  // ── Read seen memes back ───────────────────────────────────────────
  section('🔎', 'STEP 6 — Read seen memes back & verify');
  const savedSeen = await seenCol.find({ userId: TEST_USER_ID, feedKey: TEST_FEED_KEY }).toArray();
  const savedSeenIds = savedSeen.map(d => d.memeId);
  check(savedSeenIds.length === TEST_SEEN_IDS.length,
    `Found ${savedSeenIds.length} seen records (expected ${TEST_SEEN_IDS.length})`,
    `Expected ${TEST_SEEN_IDS.length} but found ${savedSeenIds.length}`);

  for (const id of TEST_SEEN_IDS) {
    check(savedSeenIds.includes(id),
      `Verified seen meme: ${id}`,
      `Missing seen meme: ${id}`);
  }

  // ── Delete test likes ──────────────────────────────────────────────
  section('🗑️', 'STEP 7 — Clean up test likes');
  const delLikes = await likesCol.deleteMany({ userId: TEST_USER_ID });
  check(delLikes.deletedCount === TEST_MEMES.length,
    `Deleted ${delLikes.deletedCount} test like(s)`,
    `Expected to delete ${TEST_MEMES.length} but deleted ${delLikes.deletedCount}`);

  const remainingLikes = await likesCol.countDocuments({ userId: TEST_USER_ID });
  check(remainingLikes === 0,
    'Confirmed: no test likes remain in database',
    `${remainingLikes} test likes still remain!`);

  // ── Delete test seen memes ─────────────────────────────────────────
  section('🗑️', 'STEP 8 — Clean up test seen memes');
  const delSeen = await seenCol.deleteMany({ userId: TEST_USER_ID, feedKey: TEST_FEED_KEY });
  check(delSeen.deletedCount === TEST_SEEN_IDS.length,
    `Deleted ${delSeen.deletedCount} test seen record(s)`,
    `Expected to delete ${TEST_SEEN_IDS.length} but deleted ${delSeen.deletedCount}`);

  const remainingSeen = await seenCol.countDocuments({ userId: TEST_USER_ID });
  check(remainingSeen === 0,
    'Confirmed: no test seen records remain in database',
    `${remainingSeen} test records still remain!`);

  // ── Summary ────────────────────────────────────────────────────────
  section('📊', 'RESULTS');
  console.log(`    ✅  Passed: ${passed}`);
  console.log(`    ❌  Failed: ${failed}`);
  console.log();
  if (failed === 0) {
    console.log('    🎉  ALL TESTS PASSED — database read/write/delete works perfectly!');
    console.log('    The problem is NOT the database. It\'s the frontend → backend connection.');
    console.log();
    console.log('    👉  Next steps to debug:');
    console.log('       1. Make sure the backend server is running (node server/index.js)');
    console.log('       2. Open the app, sign in, like a meme');
    console.log('       3. Check browser DevTools Console for:');
    console.log('          • "Saving like to backend for user: ..." (frontend sent the request)');
    console.log('          • Any red errors on POST /api/likes');
    console.log('       4. Check the terminal running the server for:');
    console.log('          • "[Likes] Saving like for user: ..." (backend received it)');
    console.log('          • "[Likes] Successfully saved like" (backend wrote to DB)');
    console.log('       5. Run  node server/inspect-db.js  to see if the like landed.');
  } else {
    console.log('    ⚠️  Some tests failed — there may be a database permissions issue.');
  }
  console.log(`\n${line('═')}\n`);

  await closeConnection();
  process.exit(failed > 0 ? 1 : 0);
}

run().catch(err => {
  console.error('💥 Test crashed:', err);
  process.exit(1);
});
