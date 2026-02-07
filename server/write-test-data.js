/**
 * ✏️  Write test data and KEEP it in the database
 * Run: node server/write-test-data.js
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const { connectToDatabase, closeConnection } = require('./config/db');

async function writeTestData() {
  const db = await connectToDatabase();
  const likesCol = db.collection('likes');
  const seenCol = db.collection('seen_memes');

  const userId = '__test_user_12345__';

  // Write 3 test likes
  const memes = [
    { id: 'meme_aaa', title: 'Funny cat', subreddit: 'memes', url: 'https://example.com/cat.jpg' },
    { id: 'meme_bbb', title: 'Dank doge', subreddit: 'dankmemes', url: 'https://example.com/doge.jpg' },
    { id: 'meme_ccc', title: 'Wholesome seal', subreddit: 'wholesomememes', url: 'https://example.com/seal.jpg' },
  ];

  for (const meme of memes) {
    await likesCol.updateOne(
      { userId, memeId: meme.id },
      { $set: { userId, memeId: meme.id, memeData: meme, createdAt: new Date() } },
      { upsert: true }
    );
  }
  console.log('✅ Wrote 3 test likes');

  // Write 3 test seen memes
  const seenIds = ['seen_111', 'seen_222', 'seen_333'];
  const ops = seenIds.map(memeId => ({
    updateOne: {
      filter: { userId, feedKey: 'hot_memes', memeId },
      update: { $setOnInsert: { userId, feedKey: 'hot_memes', memeId, createdAt: new Date() } },
      upsert: true
    }
  }));
  await seenCol.bulkWrite(ops, { ordered: false });
  console.log('✅ Wrote 3 test seen memes');

  // Verify
  const likeCount = await likesCol.countDocuments({ userId });
  const seenCount = await seenCol.countDocuments({ userId });
  console.log('');
  console.log('📊 Verification:');
  console.log('   Likes in DB:      ' + likeCount);
  console.log('   Seen memes in DB: ' + seenCount);
  console.log('');
  console.log('🔒 Data is still in the database. Tell me when to remove it.');

  await closeConnection();
}

writeTestData().catch(err => {
  console.error('💥 Failed:', err);
  process.exit(1);
});
