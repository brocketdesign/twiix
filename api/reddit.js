const fetch = require('node-fetch');

// In-memory cache (note: resets on cold starts in serverless)
const cache = new Map();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { subreddit } = req.query;
  if (!subreddit) {
    return res.status(400).json({ error: 'subreddit parameter is required' });
  }

  const { sort = 'hot', limit = '25', after = '' } = req.query;

  // Check cache
  const cacheKey = `${subreddit}-${sort}-${limit}-${after}`;
  const cachedData = cache.get(cacheKey);
  if (cachedData && (Date.now() - cachedData.timestamp < CACHE_DURATION)) {
    return res.json(cachedData.data);
  }

  try {
    const url = after
      ? `https://www.reddit.com/r/${subreddit}/${sort}.json?limit=${limit}&after=${after}&include_over_18=1`
      : `https://www.reddit.com/r/${subreddit}/${sort}.json?limit=${limit}&include_over_18=1`;

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'RedditMemeGallery/1.0 (Server-side proxy for rate limiting)'
      }
    });

    if (!response.ok) {
      throw new Error(`Reddit API responded with status ${response.status}`);
    }

    const data = await response.json();
    const posts = data.data?.children || [];

    const mediaPosts = posts.filter(post => {
      const postData = post.data;
      return (
        postData.post_hint === 'image' ||
        (postData.preview && postData.preview.images && postData.preview.images.length > 0) ||
        (postData.is_gallery && postData.media_metadata) ||
        postData.is_video ||
        (postData.media && (postData.media.reddit_video || postData.media.oembed))
      );
    });

    const responseData = {
      data: {
        children: mediaPosts,
        after: data.data?.after,
        before: data.data?.before
      }
    };

    cache.set(cacheKey, { data: responseData, timestamp: Date.now() });

    if (cache.size > 100) {
      const oldestKey = cache.keys().next().value;
      cache.delete(oldestKey);
    }

    res.json(responseData);
  } catch (error) {
    console.error(`[Reddit] Error fetching from r/${subreddit}:`, error);
    res.status(500).json({ error: 'Failed to fetch Reddit media posts' });
  }
};
