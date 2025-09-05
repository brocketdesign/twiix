// API utility functions for Reddit API optimization

// Request queue to prevent simultaneous duplicate requests
const requestQueue = new Map();

// Request statistics for monitoring
const requestStats = {
  totalRequests: 0,
  successfulRequests: 0,
  failedRequests: 0,
  rateLimitedRequests: 0,
  cachedRequests: 0
};

/**
 * Debounced fetch to prevent duplicate requests
 * @param {string} url - The URL to fetch
 * @param {object} options - Fetch options
 * @returns {Promise} - The fetch promise
 */
export const debouncedFetch = (url, options = {}) => {
  // If there's already a pending request for this URL, return that promise
  if (requestQueue.has(url)) {
    requestStats.cachedRequests++;
    return requestQueue.get(url);
  }

  // Create new request promise
  const requestPromise = fetch(url, {
    ...options,
    headers: {
      'User-Agent': 'RedditMemeGallery/1.0 (https://reddit-meme-gallery.netlify.app)',
      ...options.headers
    }
  })
    .then(response => {
      requestStats.totalRequests++;
      
      if (response.status === 429) {
        requestStats.rateLimitedRequests++;
        throw new Error('Rate limited by Reddit API');
      }
      
      if (!response.ok) {
        requestStats.failedRequests++;
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      requestStats.successfulRequests++;
      return response;
    })
    .finally(() => {
      // Remove from queue when completed
      requestQueue.delete(url);
    });

  // Add to queue
  requestQueue.set(url, requestPromise);
  return requestPromise;
};

/**
 * Get request statistics for debugging
 * @returns {object} - Request statistics
 */
export const getRequestStats = () => ({ ...requestStats });

/**
 * Reset request statistics
 */
export const resetRequestStats = () => {
  requestStats.totalRequests = 0;
  requestStats.successfulRequests = 0;
  requestStats.failedRequests = 0;
  requestStats.rateLimitedRequests = 0;
  requestStats.cachedRequests = 0;
};

/**
 * Create a throttled function that limits execution frequency
 * @param {Function} func - Function to throttle
 * @param {number} limit - Minimum time between executions (ms)
 * @returns {Function} - Throttled function
 */
export const throttle = (func, limit) => {
  let inThrottle;
  return function(...args) {
    if (!inThrottle) {
      func.apply(this, args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
};

/**
 * Create a debounced function that delays execution
 * @param {Function} func - Function to debounce
 * @param {number} delay - Delay in milliseconds
 * @returns {Function} - Debounced function
 */
export const debounce = (func, delay) => {
  let timeoutId;
  return function(...args) {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func.apply(this, args), delay);
  };
};

/**
 * Exponential backoff for retry logic
 * @param {Function} fn - Function to retry
 * @param {number} maxRetries - Maximum number of retries
 * @param {number} baseDelay - Base delay in milliseconds
 * @returns {Promise} - Promise that resolves with the result or rejects after all retries
 */
export const exponentialBackoff = async (fn, maxRetries = 3, baseDelay = 1000) => {
  let lastError;
  
  for (let i = 0; i <= maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      
      if (i === maxRetries) {
        break;
      }
      
      // Calculate delay: baseDelay * 2^attempt + random jitter
      const delay = baseDelay * Math.pow(2, i) + Math.random() * 1000;
      console.log(`Attempt ${i + 1} failed, retrying in ${delay}ms...`);
      
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError;
};

// Log API usage statistics periodically (for development)
if (process.env.NODE_ENV === 'development') {
  setInterval(() => {
    const stats = getRequestStats();
    if (stats.totalRequests > 0) {
      console.log('API Usage Stats:', stats);
    }
  }, 30000); // Log every 30 seconds
}
