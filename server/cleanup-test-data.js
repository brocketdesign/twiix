const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const { connectToDatabase, closeConnection } = require('./config/db');

(async () => {
  const db = await connectToDatabase();
  const userId = '__test_user_12345__';
  const del1 = await db.collection('likes').deleteMany({ userId });
  const del2 = await db.collection('seen_memes').deleteMany({ userId });
  console.log('🗑️  Deleted ' + del1.deletedCount + ' likes, ' + del2.deletedCount + ' seen memes');
  const r1 = await db.collection('likes').countDocuments();
  const r2 = await db.collection('seen_memes').countDocuments();
  console.log('📊 Remaining: ' + r1 + ' likes, ' + r2 + ' seen memes');
  await closeConnection();
})();
