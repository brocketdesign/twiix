const { connectToDatabase } = require('./_db');

module.exports = async function handler(req, res) {
  const db = await connectToDatabase();
  const seenCollection = db.collection('seen_memes');

  if (req.method === 'GET') {
    // GET /api/seen?userId=xxx&feedKey=yyy
    const { userId, feedKey } = req.query;
    if (!userId || !feedKey) {
      return res.status(400).json({ error: 'userId and feedKey are required' });
    }

    try {
      const docs = await seenCollection
        .find({ userId, feedKey })
        .toArray();
      const ids = docs.map(d => d.memeId);
      return res.json(ids);
    } catch (error) {
      console.error('[Seen] Error fetching seen memes:', error);
      return res.status(500).json({ error: 'Failed to fetch seen memes' });
    }
  }

  if (req.method === 'POST') {
    // POST /api/seen  body: { userId, feedKey, memeIds }
    const { userId, feedKey, memeIds } = req.body;
    if (!userId || !feedKey || !Array.isArray(memeIds) || memeIds.length === 0) {
      return res.status(400).json({ error: 'userId, feedKey, and memeIds[] are required' });
    }

    try {
      const operations = memeIds.map(memeId => ({
        updateOne: {
          filter: { userId, feedKey, memeId },
          update: { $setOnInsert: { userId, feedKey, memeId, createdAt: new Date() } },
          upsert: true
        }
      }));

      await seenCollection.bulkWrite(operations, { ordered: false });
      return res.json({ success: true });
    } catch (error) {
      console.error('[Seen] Error saving seen memes:', error);
      return res.status(500).json({ error: 'Failed to save seen memes' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
};
