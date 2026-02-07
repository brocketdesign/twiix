const express = require('express');
const router = express.Router();
const fetch = require('node-fetch');
const { getDb, getConnectionStatus } = require('../config/db');

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

// ====== DEBUG ENDPOINT ======
// Access at: /api/debug
// This provides a full database connection test and diagnostic page
router.get('/debug', async (req, res) => {
  const connectionStatus = getConnectionStatus();
  const results = {
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    database: {
      type: 'MongoDB',
      connected: false,
      name: connectionStatus.databaseName,
      uri: connectionStatus.uri,
      error: null
    },
    tests: {
      connection: { passed: false, message: '', duration: 0 },
      likesCollectionExists: { passed: false, message: '', duration: 0 },
      seenMemesCollectionExists: { passed: false, message: '', duration: 0 },
      writeTest: { passed: false, message: '', duration: 0 },
      readTest: { passed: false, message: '', duration: 0 },
      deleteTest: { passed: false, message: '', duration: 0 }
    },
    stats: {
      totalLikes: 0,
      totalSeenMemes: 0,
      uniqueUsers: 0
    }
  };

  // Test 1: Database Connection
  let startTime = Date.now();
  let db;
  try {
    db = getDb();
    await db.command({ ping: 1 });
    results.database.connected = true;
    results.tests.connection = {
      passed: true,
      message: 'Successfully connected to MongoDB database',
      duration: Date.now() - startTime
    };
  } catch (error) {
    results.database.error = error.message;
    results.tests.connection = {
      passed: false,
      message: `Connection failed: ${error.message}`,
      duration: Date.now() - startTime
    };
  }

  // Only continue if connection succeeded
  if (results.database.connected && db) {
    // Test 2: Check if likes collection exists
    startTime = Date.now();
    try {
      const collections = await db.listCollections({ name: 'likes' }).toArray();
      if (collections.length > 0) {
        results.tests.likesCollectionExists = {
          passed: true,
          message: 'likes collection exists and is accessible',
          duration: Date.now() - startTime
        };
      } else {
        // Collection doesn't exist yet but we can still use it (MongoDB creates on first write)
        results.tests.likesCollectionExists = {
          passed: true,
          message: 'likes collection will be created on first write',
          duration: Date.now() - startTime
        };
      }
    } catch (error) {
      results.tests.likesCollectionExists = {
        passed: false,
        message: `likes collection check failed: ${error.message}`,
        duration: Date.now() - startTime
      };
    }

    // Test 3: Check if seen_memes collection exists
    startTime = Date.now();
    try {
      const collections = await db.listCollections({ name: 'seen_memes' }).toArray();
      if (collections.length > 0) {
        results.tests.seenMemesCollectionExists = {
          passed: true,
          message: 'seen_memes collection exists and is accessible',
          duration: Date.now() - startTime
        };
      } else {
        results.tests.seenMemesCollectionExists = {
          passed: true,
          message: 'seen_memes collection will be created on first write',
          duration: Date.now() - startTime
        };
      }
    } catch (error) {
      results.tests.seenMemesCollectionExists = {
        passed: false,
        message: `seen_memes collection check failed: ${error.message}`,
        duration: Date.now() - startTime
      };
    }

    // Test 4: Write Test (insert a test record)
    const testUserId = '__debug_test_user__';
    const testMemeId = '__debug_test_meme__';
    const testMemeData = { id: testMemeId, title: 'Debug Test Meme', timestamp: Date.now() };
    
    startTime = Date.now();
    try {
      const likesCollection = db.collection('likes');
      await likesCollection.updateOne(
        { userId: testUserId, memeId: testMemeId },
        { $set: { userId: testUserId, memeId: testMemeId, memeData: testMemeData, createdAt: new Date() } },
        { upsert: true }
      );
      results.tests.writeTest = {
        passed: true,
        message: 'Successfully wrote test record to database',
        duration: Date.now() - startTime
      };
    } catch (error) {
      results.tests.writeTest = {
        passed: false,
        message: `Write test failed: ${error.message}`,
        duration: Date.now() - startTime
      };
    }

    // Test 5: Read Test (read the test record back)
    startTime = Date.now();
    try {
      const likesCollection = db.collection('likes');
      const doc = await likesCollection.findOne({ userId: testUserId, memeId: testMemeId });
      if (doc) {
        results.tests.readTest = {
          passed: true,
          message: 'Successfully read test record from database',
          duration: Date.now() - startTime
        };
      } else {
        results.tests.readTest = {
          passed: false,
          message: 'Read test failed: record not found after write',
          duration: Date.now() - startTime
        };
      }
    } catch (error) {
      results.tests.readTest = {
        passed: false,
        message: `Read test failed: ${error.message}`,
        duration: Date.now() - startTime
      };
    }

    // Test 6: Delete Test (clean up test record)
    startTime = Date.now();
    try {
      const likesCollection = db.collection('likes');
      await likesCollection.deleteOne({ userId: testUserId, memeId: testMemeId });
      results.tests.deleteTest = {
        passed: true,
        message: 'Successfully deleted test record from database',
        duration: Date.now() - startTime
      };
    } catch (error) {
      results.tests.deleteTest = {
        passed: false,
        message: `Delete test failed: ${error.message}`,
        duration: Date.now() - startTime
      };
    }

    // Gather stats
    try {
      const likesCollection = db.collection('likes');
      results.stats.totalLikes = await likesCollection.countDocuments();
    } catch (e) { /* ignore */ }

    try {
      const seenCollection = db.collection('seen_memes');
      results.stats.totalSeenMemes = await seenCollection.countDocuments();
    } catch (e) { /* ignore */ }

    try {
      const likesCollection = db.collection('likes');
      const uniqueUsers = await likesCollection.distinct('userId');
      results.stats.uniqueUsers = uniqueUsers.length;
    } catch (e) { /* ignore */ }
  }

  // Calculate overall status
  const allTestsPassed = Object.values(results.tests).every(t => t.passed);
  
  // Return HTML page for easy viewing
  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Database Debug - Reddit Meme Gallery</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { 
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
      color: #e0e0e0;
      min-height: 100vh;
      padding: 20px;
    }
    .container { max-width: 800px; margin: 0 auto; }
    h1 { 
      text-align: center; 
      margin-bottom: 30px;
      color: #ff6b35;
    }
    .status-banner {
      padding: 20px;
      border-radius: 10px;
      text-align: center;
      margin-bottom: 30px;
      font-size: 1.5em;
      font-weight: bold;
    }
    .status-success { background: #1b5e20; color: #a5d6a7; }
    .status-error { background: #b71c1c; color: #ef9a9a; }
    .card {
      background: rgba(255,255,255,0.05);
      border-radius: 10px;
      padding: 20px;
      margin-bottom: 20px;
      border: 1px solid rgba(255,255,255,0.1);
    }
    .card h2 {
      color: #64b5f6;
      margin-bottom: 15px;
      font-size: 1.2em;
      border-bottom: 1px solid rgba(255,255,255,0.1);
      padding-bottom: 10px;
    }
    .test-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 10px 0;
      border-bottom: 1px solid rgba(255,255,255,0.05);
    }
    .test-item:last-child { border-bottom: none; }
    .test-name { font-weight: 500; }
    .test-result {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .badge {
      padding: 4px 12px;
      border-radius: 20px;
      font-size: 0.85em;
      font-weight: 600;
    }
    .badge-pass { background: #2e7d32; color: #a5d6a7; }
    .badge-fail { background: #c62828; color: #ef9a9a; }
    .duration { color: #888; font-size: 0.85em; }
    .info-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
      gap: 15px;
    }
    .info-item {
      background: rgba(0,0,0,0.2);
      padding: 15px;
      border-radius: 8px;
      text-align: center;
    }
    .info-item .label { color: #888; font-size: 0.85em; margin-bottom: 5px; }
    .info-item .value { font-size: 1.5em; font-weight: bold; color: #ff6b35; }
    .json-toggle {
      background: #ff6b35;
      color: white;
      border: none;
      padding: 10px 20px;
      border-radius: 5px;
      cursor: pointer;
      font-size: 1em;
      margin-top: 20px;
    }
    .json-toggle:hover { background: #ff8c5a; }
    .json-output {
      display: none;
      background: #0d1117;
      padding: 20px;
      border-radius: 8px;
      margin-top: 20px;
      overflow-x: auto;
      font-family: monospace;
      font-size: 0.9em;
      white-space: pre-wrap;
      color: #c9d1d9;
    }
    .json-output.show { display: block; }
    .timestamp { text-align: center; color: #666; margin-top: 20px; font-size: 0.85em; }
    .message { color: #888; font-size: 0.85em; margin-top: 5px; }
  </style>
</head>
<body>
  <div class="container">
    <h1>🔧 Database Debug Panel</h1>
    
    <div class="status-banner ${allTestsPassed ? 'status-success' : 'status-error'}">
      ${allTestsPassed ? '✅ All Systems Operational' : '❌ Some Tests Failed'}
    </div>

    <div class="card">
      <h2>📊 Database Information</h2>
      <div class="info-grid">
        <div class="info-item">
          <div class="label">Environment</div>
          <div class="value">${results.environment}</div>
        </div>
        <div class="info-item">
          <div class="label">Host</div>
          <div class="value" style="font-size: 0.9em; word-break: break-all;">${results.database.host}</div>
        </div>
        <div class="info-item">
          <div class="label">Database</div>
          <div class="value" style="font-size: 0.9em;">${results.database.name}</div>
        </div>
        <div class="info-item">
          <div class="label">Connected</div>
          <div class="value">${results.database.connected ? '✅' : '❌'}</div>
        </div>
      </div>
    </div>

    <div class="card">
      <h2>🧪 Connection & Table Tests</h2>
      ${Object.entries(results.tests).map(([name, test]) => `
        <div class="test-item">
          <div>
            <div class="test-name">${name.replace(/([A-Z])/g, ' $1').trim()}</div>
            <div class="message">${test.message}</div>
          </div>
          <div class="test-result">
            <span class="duration">${test.duration}ms</span>
            <span class="badge ${test.passed ? 'badge-pass' : 'badge-fail'}">
              ${test.passed ? 'PASS' : 'FAIL'}
            </span>
          </div>
        </div>
      `).join('')}
    </div>

    <div class="card">
      <h2>📈 Database Statistics</h2>
      <div class="info-grid">
        <div class="info-item">
          <div class="label">Total Likes</div>
          <div class="value">${results.stats.totalLikes}</div>
        </div>
        <div class="info-item">
          <div class="label">Seen Memes</div>
          <div class="value">${results.stats.totalSeenMemes}</div>
        </div>
        <div class="info-item">
          <div class="label">Unique Users</div>
          <div class="value">${results.stats.uniqueUsers}</div>
        </div>
      </div>
    </div>

    <button class="json-toggle" onclick="toggleJson()">Show Raw JSON</button>
    <pre class="json-output" id="jsonOutput">${JSON.stringify(results, null, 2)}</pre>
    
    <p class="timestamp">Generated at: ${results.timestamp}</p>
  </div>
  
  <script>
    function toggleJson() {
      const output = document.getElementById('jsonOutput');
      const btn = document.querySelector('.json-toggle');
      output.classList.toggle('show');
      btn.textContent = output.classList.contains('show') ? 'Hide Raw JSON' : 'Show Raw JSON';
    }
  </script>
</body>
</html>
  `;

  // Check if JSON format is requested
  if (req.query.format === 'json') {
    return res.json(results);
  }

  res.send(html);
});

// Likes endpoints
router.get('/likes/:userId', async (req, res) => {
  const { userId } = req.params;
  console.log('[Likes] Fetching likes for user:', userId);
  try {
    const db = getDb();
    const likesCollection = db.collection('likes');
    const likes = await likesCollection
      .find({ userId })
      .sort({ createdAt: -1 })
      .toArray();
    console.log('[Likes] Found', likes.length, 'likes for user:', userId);
    // Return just the meme data
    const memeDataList = likes.map(l => l.memeData);
    res.json(memeDataList);
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
    const db = getDb();
    const likesCollection = db.collection('likes');
    await likesCollection.updateOne(
      { userId, memeId },
      { 
        $set: { 
          userId, 
          memeId, 
          memeData: meme, 
          createdAt: new Date() 
        } 
      },
      { upsert: true }
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
    const db = getDb();
    const likesCollection = db.collection('likes');
    const result = await likesCollection.deleteOne({ userId, memeId });
    console.log('[Likes] Delete result:', result);
    res.json({ success: true });
  } catch (error) {
    console.error('[Likes] Error deleting like:', error);
    res.status(500).json({ error: 'Failed to delete like' });
  }
});

// === Seen Memes endpoints ===

// Get seen meme IDs for a user + feed key
router.get('/seen/:userId/:feedKey', async (req, res) => {
  const { userId, feedKey } = req.params;
  try {
    const db = getDb();
    const seenCollection = db.collection('seen_memes');
    const docs = await seenCollection
      .find({ userId, feedKey })
      .toArray();
    const ids = docs.map(d => d.memeId);
    res.json(ids);
  } catch (error) {
    console.error('[Seen] Error fetching seen memes:', error);
    res.status(500).json({ error: 'Failed to fetch seen memes' });
  }
});

// Batch add seen meme IDs
router.post('/seen', async (req, res) => {
  const { userId, feedKey, memeIds } = req.body;
  if (!userId || !feedKey || !Array.isArray(memeIds) || memeIds.length === 0) {
    return res.status(400).json({ error: 'userId, feedKey, and memeIds[] are required' });
  }
  try {
    const db = getDb();
    const seenCollection = db.collection('seen_memes');
    
    // Use bulkWrite with upsert to handle duplicates gracefully
    const operations = memeIds.map(memeId => ({
      updateOne: {
        filter: { userId, feedKey, memeId },
        update: { $setOnInsert: { userId, feedKey, memeId, createdAt: new Date() } },
        upsert: true
      }
    }));
    
    await seenCollection.bulkWrite(operations, { ordered: false });
    res.json({ success: true });
  } catch (error) {
    console.error('[Seen] Error saving seen memes:', error);
    res.status(500).json({ error: 'Failed to save seen memes' });
  }
});

module.exports = router;
