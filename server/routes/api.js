const express = require('express');
const router = express.Router();
const fetch = require('node-fetch');
const { query } = require('../config/db');

// In-memory cache for Reddit API responses
const cache = new Map();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

// Rate limiting for Reddit API calls
const rateLimiter = new Map();
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const MAX_REQUESTS_PER_WINDOW = 30; // Conservative limit

// Helper function to check rate limit
const isRateLimited = (clientId) => {
  const now = Date.now();
  const clientRequests = rateLimiter.get(clientId) || [];
  
  // Remove requests older than the window
  const recentRequests = clientRequests.filter(timestamp => now - timestamp < RATE_LIMIT_WINDOW);
  
  if (recentRequests.length >= MAX_REQUESTS_PER_WINDOW) {
    return true;
  }
  
  // Add current request
  recentRequests.push(now);
  rateLimiter.set(clientId, recentRequests);
  
  return false;
};

// Helper function to get cache key
const getCacheKey = (subreddit, sort, limit, after = '') => {
  return `${subreddit}-${sort}-${limit}-${after}`;
};

// Reddit API endpoints
router.get('/reddit/:subreddit', async (req, res) => {
  const { subreddit } = req.params;
  const { sort = 'hot', limit = 25, after = '' } = req.query;
  const clientId = req.ip || 'unknown';

  // Check rate limit
  if (isRateLimited(clientId)) {
    console.log(`[Reddit] Rate limited client: ${clientId}`);
    return res.status(429).json({ 
      error: 'Rate limit exceeded. Please wait before making more requests.',
      retryAfter: 60
    });
  }

  // Check cache first
  const cacheKey = getCacheKey(subreddit, sort, limit, after);
  const cachedData = cache.get(cacheKey);
  
  if (cachedData && (Date.now() - cachedData.timestamp < CACHE_DURATION)) {
    console.log(`[Reddit] Serving cached data for ${cacheKey}`);
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

    // Filter for posts with media (images or videos)
    const mediaPosts = posts
      .filter(post => {
        const postData = post.data;
        return (
          // Images: direct image, preview, or gallery
          postData.post_hint === 'image' ||
          (postData.preview && postData.preview.images && postData.preview.images.length > 0) ||
          (postData.is_gallery && postData.media_metadata) ||
          // Videos: Reddit-hosted or embedded
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

    // Cache the response
    cache.set(cacheKey, {
      data: responseData,
      timestamp: Date.now()
    });

    // Clean up old cache entries periodically
    if (cache.size > 100) {
      const oldestKey = cache.keys().next().value;
      cache.delete(oldestKey);
    }

    console.log(`[Reddit] Fetched ${mediaPosts.length} media posts from r/${subreddit}`);
    res.json(responseData);
  } catch (error) {
    console.error(`[Reddit] Error fetching from r/${subreddit}:`, error);
    res.status(500).json({ error: 'Failed to fetch Reddit media posts' });
  }
});

// RedGif video handling endpoint
router.get('/redgifs/:id', async (req, res) => {
  const id = req.params.id;
  console.log(`[RedGifs] Processing request for ID: ${id}`);
  
  try {
    // Make request to RedGifs API
    const response = await fetch(`https://api.redgifs.com/v2/gifs/${id}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });
    
    if (!response.ok) {
      console.error(`[RedGifs] API error for ${id}: ${response.status} ${response.statusText}`);
      return res.status(response.status).json({ error: 'Failed to fetch from RedGifs API' });
    }
    
    const data = await response.json();
    console.log(`[RedGifs] Successfully retrieved data for ID: ${id}`);
    
    return res.json(data);
  } catch (error) {
    console.error(`[RedGifs] Exception for ID ${id}:`, error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Health check endpoint
router.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Likes endpoints
router.get('/likes/:userId', async (req, res) => {
  const { userId } = req.params;
  console.log('[Likes] Fetching likes for user:', userId);
  try {
    const likes = await query('SELECT meme_data FROM likes WHERE user_id = ? ORDER BY created_at DESC', [userId]);
    console.log('[Likes] Found', likes.length, 'likes for user:', userId);
    // Parse the meme_data JSON for each like
    const parsedLikes = likes.map(l => {
      if (typeof l.meme_data === 'string') {
        return JSON.parse(l.meme_data);
      }
      return l.meme_data;
    });
    res.json(parsedLikes);
  } catch (error) {
    console.error('[Likes] Error fetching likes:', error);
    res.status(500).json({ error: 'Failed to fetch likes' });
  }
});

router.post('/likes', async (req, res) => {
  const { userId, meme } = req.body;
  console.log('[Likes] Saving like for user:', userId, 'meme:', meme?.id);
  if (!userId || !meme) {
    console.error('[Likes] Missing userId or meme in request body');
    return res.status(400).json({ error: 'userId and meme are required' });
  }
  
  const memeId = meme.id || (meme.data && meme.data.id);
  
  if (!memeId) {
    console.error('[Likes] Could not determine meme ID from:', meme);
    return res.status(400).json({ error: 'Could not determine meme ID' });
  }
  
  try {
    await query(
      'INSERT INTO likes (user_id, meme_id, meme_data) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE meme_data = VALUES(meme_data)',
      [userId, memeId, JSON.stringify(meme)]
    );
    console.log('[Likes] Successfully saved like for user:', userId, 'meme:', memeId);
    res.json({ success: true });
  } catch (error) {
    console.error('[Likes] Error saving like:', error);
    res.status(500).json({ error: 'Failed to save like' });
  }
});

router.delete('/likes/:userId/:memeId', async (req, res) => {
  const { userId, memeId } = req.params;
  console.log('[Likes] Deleting like for user:', userId, 'meme:', memeId);
  try {
    const result = await query('DELETE FROM likes WHERE user_id = ? AND meme_id = ?', [userId, memeId]);
    console.log('[Likes] Delete result:', result);
    res.json({ success: true });
  } catch (error) {
    console.error('[Likes] Error deleting like:', error);
    res.status(500).json({ error: 'Failed to delete like' });
  }
});

module.exports = router;
