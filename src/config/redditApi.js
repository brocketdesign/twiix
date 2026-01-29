// Configuration for Reddit API optimization

export const REDDIT_API_CONFIG = {
  // Request settings
  MEMES_PER_REQUEST: 25, // Optimal batch size for Reddit API
  REQUEST_COOLDOWN: 1000, // Minimum time between requests (ms)
  
  // Cache settings
  CACHE_EXPIRY: 300000, // 5 minutes
  MAX_CACHE_SIZE: 50,
  
  // Rate limiting
  MAX_REQUESTS_PER_MINUTE: 30,
  RATE_LIMIT_WINDOW: 60000, // 1 minute
  
  // Retry settings
  MAX_RETRIES: 3,
  BASE_RETRY_DELAY: 1000, // Base delay for exponential backoff
  RATE_LIMIT_BACKOFF: 300000, // 5 minutes backoff when rate limited
  
  // Intersection Observer settings
  INTERSECTION_THRESHOLD: 0.1,
  INTERSECTION_ROOT_MARGIN: '200px', // Start loading when 200px away
  
  // Media rendering
  MEDIA_BATCH_SIZE: 5, // Process media in small batches
  MEDIA_BATCH_DELAY: 10, // Delay between batches (ms)
  
  // User Agent for API requests
  // USER_AGENT: 'twiix/1.0 (https://twiix.netlify.app)',
  
  // Development settings
  DEBUG_MODE: process.env.NODE_ENV === 'development',
  LOG_INTERVAL: 30000, // Log stats every 30 seconds in dev mode
};

// Default subreddits for fallback
export const DEFAULT_SUBREDDITS = [
  'memes',
  'dankmemes', 
  'wholesomememes',
  'meirl',
  'memeeconomy'
];

// Media type configurations
export const MEDIA_CONFIG = {
  // Supported image formats
  IMAGE_FORMATS: ['.jpg', '.jpeg', '.png', '.gif', '.webp'],
  
  // Supported video formats
  VIDEO_FORMATS: ['.mp4', '.webm', '.mov'],
  
  // Video quality preferences (for reddit videos)
  VIDEO_QUALITY_PREFERENCES: [
    { width: 640, height: 480 },   // 480p
    { width: 854, height: 480 },   // 480p widescreen
    { width: 1280, height: 720 },  // 720p
    { width: 1920, height: 1080 }  // 1080p
  ],
  
  // Thumbnail size preferences
  THUMBNAIL_MAX_WIDTH: 640,
  THUMBNAIL_MAX_HEIGHT: 480,
};

// Error messages
export const ERROR_MESSAGES = {
  RATE_LIMITED: 'Too many requests. Please wait a moment before loading more content.',
  API_ERROR: 'Failed to load content from Reddit. Please try again.',
  NETWORK_ERROR: 'Network error. Please check your connection and try again.',
  NO_MORE_CONTENT: 'No more content available for this subreddit.',
  INVALID_SUBREDDIT: 'Invalid subreddit name.',
};
