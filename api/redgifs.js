const fetch = require('node-fetch');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { id } = req.query;
  if (!id) {
    return res.status(400).json({ error: 'id parameter is required' });
  }

  try {
    const response = await fetch(`https://api.redgifs.com/v2/gifs/${id}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });

    if (!response.ok) {
      return res.status(response.status).json({ error: 'Failed to fetch from RedGifs API' });
    }

    const data = await response.json();
    return res.json(data);
  } catch (error) {
    console.error(`[RedGifs] Exception for ID ${id}:`, error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};
