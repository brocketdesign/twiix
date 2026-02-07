const { connectToDatabase } = require('./_db');

module.exports = async function handler(req, res) {
  // Only allow GET
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const db = await connectToDatabase();
    await db.command({ ping: 1 });
    res.json({ status: 'ok', database: 'connected' });
  } catch (error) {
    console.error('[Health] Error:', error);
    res.status(500).json({ status: 'error', message: error.message });
  }
};
