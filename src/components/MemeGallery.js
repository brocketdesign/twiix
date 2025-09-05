import React, { useState, useEffect, useRef, useCallback } from 'react';
import Masonry from 'react-masonry-css';
import { Link, useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { debouncedFetch, exponentialBackoff } from '../utils/apiUtils';
import { REDDIT_API_CONFIG, MEDIA_CONFIG, ERROR_MESSAGES } from '../config/redditApi';
// Icon imports
import { TbDownload, TbHome, TbSearch, TbPuzzle, TbTag } from 'react-icons/tb';

// Create a reusable LazyVideo component for all video types
const LazyVideo = React.memo(({ videoUrl, thumbnailUrl, videoType = "video/mp4" }) => {
  const [error, setError] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const videoRef = useRef(null);
  const containerRef = useRef(null);

  // Add cleanup function to free resources when component unmounts or video scrolls far away
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        // If video is far out of view and playing, pause it to save resources
        if (!entries[0].isIntersecting && videoRef.current && !videoRef.current.paused) {
          videoRef.current.pause();
        }
      },
      { threshold: 0.1, rootMargin: '100px' }
    );

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    return () => {
      if (containerRef.current) {
        observer.unobserve(containerRef.current);
      }
    };
  }, []);

  // Added cleanup effect to pause video on unmount
  useEffect(() => {
    return () => {
      if (videoRef.current) {
        videoRef.current.pause();
      }
    };
  }, []);

  const handleVideoError = () => {
    setError("Failed to load video");
  };

  return (
    <div className="video-container" ref={containerRef}>
      <video 
        ref={videoRef}
        controls 
        preload="metadata"
        loop 
        muted 
        className="media-content"
        onError={handleVideoError}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        poster={thumbnailUrl}
      >
        <source src={videoUrl} type={videoType} />
        Your browser does not support video playback.
      </video>
      {error && (
        <div className="error-message">
          {error}
          <button onClick={() => {
            setError(null);
            if (videoRef.current) {
              videoRef.current.load();
            }
          }} className="retry-button">
            Retry
          </button>
        </div>
      )}
    </div>
  );
});

// Create a new component for lazy-loaded RedGifs
const LazyRedGif = React.memo(({ gifId, thumbnailUrl, memeId }) => {
  const [isVisible, setIsVisible] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [videoUrl, setVideoUrl] = useState(null);
  const [error, setError] = useState(null);
  const containerRef = useRef(null);
  const videoRef = useRef(null);

  useEffect(() => {
    // Set up intersection observer to detect when element is visible
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !isLoading && !videoUrl && !error) {
          setIsVisible(true);
        }
      },
      { threshold: 0.1 } // Trigger when at least 10% of the element is visible
    );

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    return () => {
      if (containerRef.current) {
        observer.unobserve(containerRef.current);
      }
    };
  }, [isLoading, videoUrl, error]);

  // Load the video when it becomes visible
  useEffect(() => {
    if (isVisible && !isLoading && !videoUrl && !error) {
      setIsLoading(true);
      const serverUrl = 'http://localhost:3001';
      const url = `${serverUrl}/api/redgifs/${gifId}`;

      // Check if the endpoint is available
      fetch(`${url}`, { method: 'HEAD' })
        .then(response => {
          if (!response.ok) {
            throw new Error(`Server responded with status: ${response.status}`);
          }
          setVideoUrl(url);
        })
        .catch(err => {
          console.error('Error fetching RedGifs:', err);
          setError(err.message);
        })
        .finally(() => {
          setIsLoading(false);
        });
    }
  }, [isVisible, isLoading, videoUrl, error, gifId]);

  return (
    <div className="video-container" ref={containerRef}>
      {videoUrl ? (
        <video 
          ref={videoRef}
          controls 
          preload="metadata"
          loop 
          muted 
          className="media-content"
          poster={thumbnailUrl}
          onError={() => setError("Failed to load video")}
        >
          <source src={videoUrl} type="video/mp4" />
          Your browser does not support video playback.
        </video>
      ) : error ? (
        <div className="error-message">
          Failed to load RedGifs content: {error}
          <button onClick={() => {
            setError(null);
            setIsVisible(true);
          }} className="retry-button">
            Retry
          </button>
        </div>
      ) : isLoading ? (
        <div className="loading-container">
          <div className="loading-spinner">
            <svg viewBox="0 0 32 32" width="32" height="32">
              <circle cx="16" cy="16" r="14" fill="none" strokeWidth="4" stroke="#fff" strokeDasharray="87.96459430051421 87.96459430051421" transform="rotate(120 16 16)">
                <animateTransform attributeName="transform" attributeType="XML" type="rotate" dur="0.75s" from="0 16 16" to="360 16 16" repeatCount="indefinite"/>
              </circle>
            </svg>
          </div>
          <span>Loading RedGifs content...</span>
        </div>
      ) : (
        <div className="loading-container" onClick={() => setIsVisible(true)}>
          {thumbnailUrl && <img src={thumbnailUrl} alt="RedGifs thumbnail" className="poster-image" />}
          <div className="loading-message">Click to load content</div>
        </div>
      )}
    </div>
  );
});

function MemeGallery({ subreddit = 'memes' }) {
  const [memes, setMemes] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [after, setAfter] = useState(null);
  const [hasMore, setHasMore] = useState(true);
  const [renderedMedia, setRenderedMedia] = useState({});
  const [thumbnails, setThumbnails] = useState({});
  
  // Increase batch size for better efficiency while staying under Reddit's rate limits
  const memesPerPage = REDDIT_API_CONFIG.MEMES_PER_REQUEST;

  // Track seen post IDs to avoid duplicates
  const [seenIds, setSeenIds] = useState(new Set());
  
  // New state to track seen titles
  const [seenTitles, setSeenTitles] = useState(new Set());
  
  // New state to track seen URLs
  const [seenUrls, setSeenUrls] = useState(new Set());
  
  // New state to track already fetched URL paths to prevent duplicate requests
  const [fetchedUrlPaths, setFetchedUrlPaths] = useState(new Set());
  
  // Add request throttling state
  const [lastRequestTime, setLastRequestTime] = useState(0);
  const requestCooldown = REDDIT_API_CONFIG.REQUEST_COOLDOWN;
  
  // Cache for Reddit API responses
  const apiCache = useRef(new Map());
  const cacheExpiry = REDDIT_API_CONFIG.CACHE_EXPIRY;
  
  const observer = useRef();
  const throttleTimeoutRef = useRef();
  
  const lastMemeElementRef = useCallback(node => {
    if (isLoading) return;
    if (observer.current) observer.current.disconnect();
    
    // Create intersection observer with optimized options
    observer.current = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && hasMore && !isLoading) {
        // Throttle requests to prevent spam
        const now = Date.now();
        if (now - lastRequestTime >= requestCooldown) {
          loadMoreMemes();
        } else {
          // Schedule the request for when cooldown expires
          const remainingCooldown = requestCooldown - (now - lastRequestTime);
          if (throttleTimeoutRef.current) {
            clearTimeout(throttleTimeoutRef.current);
          }
          throttleTimeoutRef.current = setTimeout(() => {
            if (hasMore && !isLoading) {
              loadMoreMemes();
            }
          }, remainingCooldown);
        }
      }
    }, {
      // Optimize intersection observer options
      threshold: REDDIT_API_CONFIG.INTERSECTION_THRESHOLD,
      rootMargin: REDDIT_API_CONFIG.INTERSECTION_ROOT_MARGIN
    });
    
    if (node) observer.current.observe(node);
  }, [isLoading, hasMore, lastRequestTime]);
  
  // Add a new state variable to track if the first page has been loaded
  const [firstPageLoaded, setFirstPageLoaded] = useState(false);
  
  const navigate = useNavigate();

  // Add this state at the top level of the component
  const [showRelatedFor, setShowRelatedFor] = useState(null);

  // Handler: Download media
  const handleDownload = (mediaUrl, title) => {
    if (!mediaUrl) return;
    // Create a temporary anchor to trigger download
    const link = document.createElement('a');
    link.href = mediaUrl;
    link.download = title ? `${title}` : 'download';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Handler: Show similar subreddits (from meme data, e.g., crossposts)
  const getRelatedSubreddits = (meme) => {
    // Try to extract related subreddits from crossposts or other available fields
    const related = new Set();
    if (meme.data.crosspost_parent_list && Array.isArray(meme.data.crosspost_parent_list)) {
      meme.data.crosspost_parent_list.forEach(cp => {
        if (cp.subreddit && cp.subreddit !== meme.data.subreddit) {
          related.add(cp.subreddit);
        }
      });
    }
    // Optionally, add more logic here for other sources of related subreddits
    return Array.from(related);
  };

  useEffect(() => {
    // Reset state when subreddit changes
    setMemes([]);
    setAfter(null);
    setHasMore(true);
    setSeenIds(new Set()); // Reset seen IDs when changing subreddit
    setSeenTitles(new Set()); // Reset seen titles when changing subreddit
    setSeenUrls(new Set()); // Reset seen URLs when changing subreddit
    setFetchedUrlPaths(new Set()); // Reset fetched URL paths when changing subreddit
    setFirstPageLoaded(false); // Reset first page loaded state
    setRenderedMedia({}); // Clear rendered media cache
    setThumbnails({}); // Clear thumbnails cache
    
    // Clear API cache for this subreddit
    const keysToDelete = [];
    for (const key of apiCache.current.keys()) {
      if (key.startsWith(subreddit + '-')) {
        keysToDelete.push(key);
      }
    }
    keysToDelete.forEach(key => apiCache.current.delete(key));
    
    // Clear any pending throttle timeouts
    if (throttleTimeoutRef.current) {
      clearTimeout(throttleTimeoutRef.current);
      throttleTimeoutRef.current = null;
    }
    
    fetchMemes();
  }, [subreddit]);
  
  // Cleanup effect for component unmount
  useEffect(() => {
    return () => {
      // Clean up observer
      if (observer.current) {
        observer.current.disconnect();
      }
      
      // Clear throttle timeout
      if (throttleTimeoutRef.current) {
        clearTimeout(throttleTimeoutRef.current);
      }
    };
  }, []);
  
  // Helper to extract the best thumbnail for a meme
  const extractThumbnailUrl = (meme) => {
    const { thumbnail, preview } = meme.data;
    let thumbnailUrl = null;
    if (preview && preview.images && preview.images.length > 0) {
      const image = preview.images[0];
      const resolutions = [...image.resolutions].sort((a, b) => b.width - a.width);
      const bestResolution = resolutions.find(r => r.width <= 640) || resolutions[resolutions.length - 1];
      if (bestResolution) {
        thumbnailUrl = bestResolution.url.replace(/&amp;/g, '&');
      } else if (image.source) {
        thumbnailUrl = image.source.url.replace(/&amp;/g, '&');
      }
    }
    if (!thumbnailUrl && thumbnail && thumbnail !== 'self' && thumbnail !== 'default') {
      thumbnailUrl = thumbnail;
    }
    return thumbnailUrl;
  };

  const fetchMemes = () => {
    // Prevent fetching the first page multiple times
    if (!after && firstPageLoaded) {
      return;
    }
    
    // Throttle requests to avoid being flagged by Reddit
    const now = Date.now();
    if (now - lastRequestTime < requestCooldown) {
      console.log('Request throttled, waiting for cooldown');
      return;
    }
    
    // Construct the URL path
    const urlPath = after 
      ? `https://www.reddit.com/r/${subreddit}.json?after=${after}&limit=${memesPerPage}&include_over_18=1` 
      : `https://www.reddit.com/r/${subreddit}.json?limit=${memesPerPage}&include_over_18=1`;
    
    // Check cache first
    const cacheKey = `${subreddit}-${after || 'initial'}`;
    const cachedData = apiCache.current.get(cacheKey);
    if (cachedData && (now - cachedData.timestamp < cacheExpiry)) {
      console.log(`Using cached data for ${cacheKey}`);
      processFetchedData(cachedData.data);
      return;
    }
    
    // Check if this URL path has already been fetched
    if (fetchedUrlPaths.has(urlPath)) {
      console.log(`Skipping duplicate fetch for ${urlPath}`);
      return;
    }
    
    setIsLoading(true);
    setLastRequestTime(now);
    
    // Add this URL path to the set of fetched URLs
    setFetchedUrlPaths(prevFetchedUrls => new Set([...prevFetchedUrls, urlPath]));
      
    // Use exponential backoff for resilient API calls
    exponentialBackoff(async () => {
      const response = await debouncedFetch(urlPath);
      return response.json();
    }, 3, 1000)
      .then(data => {
        if (!data) return; // Handle null response
        
        // Cache the successful response
        apiCache.current.set(cacheKey, {
          data: data,
          timestamp: now
        });
        
        // Clean up old cache entries
        if (apiCache.current.size > REDDIT_API_CONFIG.MAX_CACHE_SIZE) {
          const oldestKey = apiCache.current.keys().next().value;
          apiCache.current.delete(oldestKey);
        }
        
        processFetchedData(data);
      })
      .catch(error => {
        console.error('Error fetching data from Reddit API:', error);
        setIsLoading(false);
        
        // If rate limited, set longer backoff
        if (error.message.includes('Rate limited')) {
          console.log('Rate limited - implementing backoff strategy');
          setHasMore(false); // Temporarily disable more loading
          
          // Re-enable after configured backoff time
          setTimeout(() => {
            setHasMore(true);
          }, REDDIT_API_CONFIG.RATE_LIMIT_BACKOFF);
        } else {
          setHasMore(false);
        }
      });
  };

  const processFetchedData = (data) => {
    if (data.data && data.data.children) {
      if (data.data.children.length === 0) {
        setHasMore(false);
      } else {
        
        // Filter out duplicates by ID, title, and URL
        const newMemes = data.data.children.filter(meme => 
          !seenIds.has(meme.data.id) && 
          !seenTitles.has(meme.data.title) && 
          (!meme.data.url || !seenUrls.has(meme.data.url))
        );
        
        
        // Update seenIds with new meme IDs
        const updatedSeenIds = new Set(seenIds);
        newMemes.forEach(meme => updatedSeenIds.add(meme.data.id));
        setSeenIds(updatedSeenIds);
        
        // Update seenTitles with new meme titles
        const updatedSeenTitles = new Set(seenTitles);
        newMemes.forEach(meme => updatedSeenTitles.add(meme.data.title));
        setSeenTitles(updatedSeenTitles);
        
        // Update seenUrls with new meme URLs if they exist
        const updatedSeenUrls = new Set(seenUrls);
        newMemes.forEach(meme => {
          if (meme.data.url) {
            updatedSeenUrls.add(meme.data.url);
          }
        });
        setSeenUrls(updatedSeenUrls);
        
        // Precompute and set thumbnails for new memes before rendering media
        const newThumbnails = {};
        newMemes.forEach(meme => {
          const thumb = extractThumbnailUrl(meme);
          if (thumb) newThumbnails[meme.data.id] = thumb;
        });
        if (Object.keys(newThumbnails).length > 0) {
          setThumbnails(prev => ({ ...prev, ...newThumbnails }));
        }

        // Add new unique memes
        setMemes(prevMemes => [...prevMemes, ...newMemes]);
        setAfter(data.data.after);
        setHasMore(!!data.data.after);
        
        // Set firstPageLoaded to true after the initial load
        if (!after) {
          setFirstPageLoaded(true);
        }
      }
    } else {
      console.error('Invalid data structure from Reddit API:', data);
      setHasMore(false);
    }
    setIsLoading(false);
  };
  
  const loadMoreMemes = () => {
    // Enhanced condition checking with throttling
    if (!isLoading && hasMore && after) {
      const now = Date.now();
      if (now - lastRequestTime >= requestCooldown) {
        fetchMemes();
      } else {
        console.log('Load more request throttled');
      }
    }
  };

  // Remove thumbnail extraction from renderMedia, just use thumbnails state
  const renderMedia = useCallback(async (meme) => {
    const { url, media, post_hint, secure_media, thumbnail, preview } = meme.data;

    // Use precomputed thumbnail
    const thumbUrl = thumbnails[meme.data.id];

    if (media && media.reddit_video) {
      return (
        <LazyVideo 
          videoUrl={media.reddit_video.fallback_url} 
          thumbnailUrl={thumbUrl}
          videoType="video/mp4"
        />
      );
    }
    // Handle all RedGifs URLs - including those embedded in secure_media
    if ((url && url.includes('redgifs')) || 
        (secure_media && secure_media.oembed && 
         secure_media.oembed.html && 
         secure_media.oembed.html.includes('redgifs'))) {
          
          // First check if we have a Reddit video preview available
          if (preview && preview.reddit_video_preview && preview.reddit_video_preview.fallback_url) {
            return (
              <LazyVideo 
                videoUrl={preview.reddit_video_preview.fallback_url} 
                thumbnailUrl={thumbUrl}
                videoType="video/mp4"
              />
            );
          }
          
          // If no preview is available, extract RedGifs ID for backend call
          let redgifsId = null;
          
          if (url && url.includes('redgifs')) {
            // Extract ID from direct URL
            const urlParts = url.split('/');
            redgifsId = urlParts[urlParts.length - 1];
            // Remove any query parameters
            redgifsId = redgifsId.split('?')[0];
          } else if (secure_media && secure_media.oembed && secure_media.oembed.html) {
            // Extract ID from embedded HTML
            const html = secure_media.oembed.html;
            const match = html.match(/redgifs\.com\/(?:watch|ifr)\/([^"&?/]+)/);
            if (match && match[1]) {
              redgifsId = match[1];
            }
          }
          
          if (redgifsId) {
            return (
              <LazyRedGif 
                gifId={redgifsId} 
                thumbnailUrl={thumbUrl}
                memeId={meme.data.id}
              />
            );
          }
          
          return <p>Unable to load RedGifs content (no preview or ID available)</p>;
    }
    
    // Handle Imgur GIFV links
    if (url && url.includes('.gifv')) {
      // Convert .gifv to .mp4 for direct playback
      const mp4Url = url.replace('.gifv', '.mp4');
      
      return (
        <LazyVideo 
          videoUrl={mp4Url} 
          thumbnailUrl={thumbUrl}
          videoType="video/mp4"
        />
      );
    }
    
    // Handle standard GIFs, JPGs, PNGs
    if (url) {
      const isGif = url.endsWith('.gif') || url.includes('.gif');
      const isVideo = url.endsWith('.mp4') || url.endsWith('.webm');
      
      if (isVideo) {
        const videoType = url.endsWith('.mp4') ? 'video/mp4' : 'video/webm';
        return (
          <LazyVideo 
            videoUrl={url} 
            thumbnailUrl={thumbUrl}
            videoType={videoType}
          />
        );
      } else {
        // For images or GIFs we can use img tag
        return new Promise((resolve) => {
          const img = new Image();
          img.src = url;
          img.onload = () => resolve(<img src={url} alt={meme.data.title} className="media-content" />);
          img.onerror = () => {
            console.error(`Failed to load image: ${url}`);
            resolve(null); // Return null if image fails to load
          };
        });
      }
    }
    
    return <p>Media not available</p>;
  }, [thumbnails]); // Remove redgifsUrls from dependencies

  // Remove the useEffect that was fetching RedGifs URLs with loading limits
  // since we're now doing lazy loading in the LazyRedGif component

  // Optimized media rendering - only render what's not already rendered
  useEffect(() => {
    // Batch process new memes that don't have rendered media
    const newMemes = memes.filter(meme => !renderedMedia[meme.data.id]);
    
    if (newMemes.length > 0) {
      // Process in smaller batches to prevent blocking
      const batchSize = REDDIT_API_CONFIG.MEDIA_BATCH_SIZE;
      const batchDelay = REDDIT_API_CONFIG.MEDIA_BATCH_DELAY;
      let currentBatch = 0;
      
      const processBatch = async () => {
        const start = currentBatch * batchSize;
        const end = Math.min(start + batchSize, newMemes.length);
        const batch = newMemes.slice(start, end);
        
        const batchResults = {};
        await Promise.all(
          batch.map(async (meme) => {
            try {
              const media = await renderMedia(meme);
              batchResults[meme.data.id] = media;
            } catch (error) {
              console.error(`Error rendering media for meme ${meme.data.id}:`, error);
              batchResults[meme.data.id] = <p>Media not available</p>;
            }
          })
        );
        
        setRenderedMedia(prev => ({ ...prev, ...batchResults }));
        
        currentBatch++;
        if (currentBatch * batchSize < newMemes.length) {
          // Schedule next batch with a small delay to prevent blocking
          setTimeout(processBatch, batchDelay);
        }
      };
      
      processBatch();
    }
  }, [memes, renderMedia]);

  // Add debugging effect for development
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      console.log(`MemeGallery Debug - Subreddit: ${subreddit}, Memes loaded: ${memes.length}, Has more: ${hasMore}, Loading: ${isLoading}`);
    }
  }, [subreddit, memes.length, hasMore, isLoading]);

  // Add a debugging effect to check for duplicates after rendering
  useEffect(() => {
    if (memes.length > 0 && !isLoading) {
      // Check for any duplicates by title that might have slipped through
      const titles = memes.map(meme => meme.data.title);
      const titleCounts = titles.reduce((acc, title) => {
        acc[title] = (acc[title] || 0) + 1;
        return acc;
      }, {});
      
      const duplicateTitles = Object.entries(titleCounts)
        .filter(([_, count]) => count > 1)
        .map(([title]) => title);
      
      if (duplicateTitles.length > 0) {
        console.warn('Found duplicate titles after filtering:', duplicateTitles);
      }
      
      // Check for any duplicates by ID
      const ids = memes.map(meme => meme.data.id);
      const idCounts = ids.reduce((acc, id) => {
        acc[id] = (acc[id] || 0) + 1;
        return acc;
      }, {});
      
      const duplicateIds = Object.entries(idCounts)
        .filter(([_, count]) => count > 1)
        .map(([id]) => id);
      
      if (duplicateIds.length > 0) {
        console.warn('Found duplicate IDs after filtering:', duplicateIds);
      }
      
      // Check for any duplicates by URL
      const urls = memes.map(meme => meme.data.url).filter(Boolean);
      const urlCounts = urls.reduce((acc, url) => {
        acc[url] = (acc[url] || 0) + 1;
        return acc;
      }, {});
      
      const duplicateUrls = Object.entries(urlCounts)
        .filter(([_, count]) => count > 1)
        .map(([url]) => url);
      
      if (duplicateUrls.length > 0) {
        console.warn('Found duplicate URLs after filtering:', duplicateUrls);
      }
    }
  }, [memes, isLoading]);

  // Configure breakpoints for responsive design
  const breakpointColumnsObj = {
    default: 4, // Default column count
    1400: 3,    // 3 columns at 1400px or less
    1100: 2,    // 2 columns at 1100px or less
    700: 1      // 1 column at 700px or less
  };

  return (
    <div className="meme-gallery">
      <Helmet>
        <title>r/{subreddit} - Reddit Meme Gallery</title>
      </Helmet>
      <h2 className="text-2xl font-bold mb-6 text-center">r/{subreddit}</h2>
      
      {/* Remove the pagination UI controls */}
      
      <Masonry
        breakpointCols={breakpointColumnsObj}
        className="masonry-grid"
        columnClassName="masonry-grid_column"
      >
        {memes.map((meme, index) => {
          // Extract tags if available (Reddit doesn't provide tags, but we can use flair_text)
          const tags = meme.data.link_flair_text
            ? [meme.data.link_flair_text]
            : [];

          // Use the best media URL for download/search
          let mediaUrl = meme.data.url;
          if (meme.data.media && meme.data.media.reddit_video) {
            mediaUrl = meme.data.media.reddit_video.fallback_url;
          } else if (
            meme.data.preview &&
            meme.data.preview.reddit_video_preview &&
            meme.data.preview.reddit_video_preview.fallback_url
          ) {
            mediaUrl = meme.data.preview.reddit_video_preview.fallback_url;
          }

          // Related subreddits
          const relatedSubreddits = getRelatedSubreddits(meme);

          return (
            <div 
              className="masonry-item" 
              key={meme.data.id || index}
              ref={index === memes.length - 1 ? lastMemeElementRef : null}
            >
              {renderedMedia[meme.data.id] || <div className="loading">Loading media...</div>}
              <p className="p-3 text-sm">
                <Link to={`/r/${subreddit}/${meme.data.id}`} className="meme-link">
                  {meme.data.title}
                </Link>
              </p>
              {/* Action icons row */}
              <div className="flex flex-wrap gap-2 px-3 pb-2 text-lg items-center">
                {/* Download */}
                <button
                  title="Download"
                  onClick={() => handleDownload(mediaUrl, meme.data.title)}
                  className="hover:text-blue-500"
                  style={{ background: 'none', border: 'none', cursor: 'pointer' }}
                >
                  <TbDownload />
                </button>
                {/* Show similar subreddits */}
                {relatedSubreddits.length > 0 && (
                  <div className="relative">
                    <button
                      title="Show similar subreddits"
                      onClick={() =>
                        setShowRelatedFor(
                          showRelatedFor === meme.data.id ? null : meme.data.id
                        )
                      }
                      className="hover:text-purple-500"
                      style={{ background: 'none', border: 'none', cursor: 'pointer' }}
                    >
                      <TbPuzzle />
                    </button>
                    {showRelatedFor === meme.data.id && (
                      <div className="absolute z-10 bg-white border rounded shadow p-2 mt-1 min-w-[150px]">
                        <div className="font-semibold text-xs mb-1">Related subreddits:</div>
                        {relatedSubreddits.map((sub, i) => (
                          <button
                            key={sub}
                            className="block text-left w-full hover:bg-gray-100 px-2 py-1 text-sm"
                            onClick={() => {
                              setShowRelatedFor(null);
                              navigate(`/r/${sub}`);
                            }}
                          >
                            r/{sub}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                {/* Tags */}
                {tags.length > 0 && tags.map((tag, i) => (
                  <button
                    key={i}
                    title={`Search tag: ${tag}`}
                    onClick={() => navigate(`/search?tag=${encodeURIComponent(tag)}`)}
                    className="hover:text-pink-500 px-1 flex items-center gap-1"
                    style={{ background: 'none', border: 'none', cursor: 'pointer' }}
                  >
                    <TbTag className="inline" /> <span className="text-xs">{tag}</span>
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </Masonry>
      
      {isLoading && <div className="loading">Loading more memes...</div>}
      {!hasMore && memes.length > 0 && (
        <div className="end-message">
          <p>{ERROR_MESSAGES.NO_MORE_CONTENT}</p>
          <button 
            onClick={() => {
              setMemes([]);
              setAfter(null);
              setHasMore(true);
              setSeenIds(new Set());
              setSeenTitles(new Set());
              setSeenUrls(new Set()); // Reset seen URLs as well
              setFetchedUrlPaths(new Set()); // Reset fetched URL paths when refreshing
              setRenderedMedia({}); // Clear rendered media cache
              setThumbnails({}); // Clear thumbnails cache
              setLastRequestTime(0); // Reset throttling
              
              // Clear throttle timeout
              if (throttleTimeoutRef.current) {
                clearTimeout(throttleTimeoutRef.current);
                throttleTimeoutRef.current = null;
              }
              
              // Clear cache for current subreddit
              const keysToDelete = [];
              for (const key of apiCache.current.keys()) {
                if (key.startsWith(subreddit + '-')) {
                  keysToDelete.push(key);
                }
              }
              keysToDelete.forEach(key => apiCache.current.delete(key));
              
              fetchMemes();
            }}
            className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded mt-2"
          >
            Refresh Feed
          </button>
        </div>
      )}
    </div>
  );
}

export default MemeGallery;
