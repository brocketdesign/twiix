const { connectToDatabase } = require('./_db');

module.exports = async function handler(req, res) {
  const db = await connectToDatabase();
  const likesCollection = db.collection('likes');

  if (req.method === 'GET') {
    // GET /api/likes?userId=xxx
    const { userId } = req.query;
    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }

    try {
      const likes = await likesCollection
        .find({ userId })
        .sort({ createdAt: -1 })
        .toArray();
      const memeDataList = likes.map(l => l.memeData);
      return res.json(memeDataList);
    } catch (error) {
      console.error('[Likes] Error fetching likes:', error);
      return res.status(500).json({ error: 'Failed to fetch likes' });
    }
  }

  if (req.method === 'POST') {
    // POST /api/likes  body: { userId, meme }
    const { userId, meme } = req.body;
    if (!userId || !meme) {
      return res.status(400).json({ error: 'userId and meme are required' });
    }

    const memeId = meme.id || (meme.data && meme.data.id);
    if (!memeId) {
      return res.status(400).json({ error: 'Could not determine meme ID' });
    }

    try {
      await likesCollection.updateOne(
        { userId, memeId },
        { $set: { userId, memeId, memeData: meme, createdAt: new Date() } },
        { upsert: true }
      );
      return res.json({ success: true });
    } catch (error) {
      console.error('[Likes] Error saving like:', error);
      return res.status(500).json({ error: 'Failed to save like' });
    }
  }

  if (req.method === 'DELETE') {
    // DELETE /api/likes?userId=xxx&memeId=yyy
    const { userId, memeId } = req.query;
    if (!userId || !memeId) {
      return res.status(400).json({ error: 'userId and memeId are required' });
    }

    try {
      await likesCollection.deleteOne({ userId, memeId });
      return res.json({ success: true });
    } catch (error) {
      console.error('[Likes] Error deleting like:', error);
      return res.status(500).json({ error: 'Failed to delete like' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
};
