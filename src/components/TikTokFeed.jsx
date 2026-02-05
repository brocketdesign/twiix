import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { debouncedFetch, exponentialBackoff } from '../utils/apiUtils';
import { REDDIT_API_CONFIG } from '../config/redditApi';
import LikeButton from './LikeButton';
import { TbDownload, TbPhoto, TbVideo, TbLayoutGrid, TbChevronLeft, TbChevronRight, TbVolume, TbVolumeOff, TbShare } from 'react-icons/tb';
import './TikTokFeed.css';

// Horizontal swipeable gallery for posts with multiple images
const GallerySwiper = ({ galleryData, mediaMetadata }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [touchStart, setTouchStart] = useState(null);
  const [touchEnd, setTouchEnd] = useState(null);
  const containerRef = useRef(null);

  const minSwipeDistance = 50;

  const images = React.useMemo(() => {
    if (!galleryData?.items || !mediaMetadata) return [];
    
    return galleryData.items
      .map(item => {
        const media = mediaMetadata[item.media_id];
        if (!media || media.status !== 'valid') return null;
        
        const sourceUrl = media.s?.u || media.s?.gif;
        if (!sourceUrl) return null;
        
        const decodedUrl = sourceUrl.replace(/&amp;/g, '&');
        
        return {
          id: item.media_id,
          src: decodedUrl,
          width: media.s?.x,
          height: media.s?.y,
          type: media.e,
        };
      })
      .filter(Boolean);
  }, [galleryData, mediaMetadata]);

  const onTouchStart = (e) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  };

  const onTouchMove = (e) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const onTouchEnd = () => {
    if (!touchStart || !touchEnd) return;
    
    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > minSwipeDistance;
    const isRightSwipe = distance < -minSwipeDistance;
    
    if (isLeftSwipe && currentIndex < images.length - 1) {
      setCurrentIndex(prev => prev + 1);
    }
    if (isRightSwipe && currentIndex > 0) {
      setCurrentIndex(prev => prev - 1);
    }
  };

  const goToNext = () => {
    if (currentIndex < images.length - 1) {
      setCurrentIndex(prev => prev + 1);
    }
  };

  const goToPrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex(prev => prev - 1);
    }
  };

  if (images.length === 0) {
    return <div className="tiktok-media-error">Gallery images not available</div>;
  }

  return (
    <div 
      className="tiktok-gallery-container"
      ref={containerRef}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      <div 
        className="tiktok-gallery-track"
        style={{ transform: `translateX(-${currentIndex * 100}%)` }}
      >
        {images.map((image, idx) => (
          <div key={image.id} className="tiktok-gallery-slide">
            <img 
              src={image.src} 
              alt={`Gallery image ${idx + 1}`}
              className="tiktok-gallery-image"
            />
          </div>
        ))}
      </div>
      
      {/* Navigation arrows */}
      {images.length > 1 && (
        <>
          {currentIndex > 0 && (
            <button onClick={goToPrev} className="tiktok-gallery-nav tiktok-gallery-nav-prev">
              <TbChevronLeft size={28} />
            </button>
          )}
          {currentIndex < images.length - 1 && (
            <button onClick={goToNext} className="tiktok-gallery-nav tiktok-gallery-nav-next">
              <TbChevronRight size={28} />
            </button>
          )}
        </>
      )}
      
      {/* Dots indicator */}
      {images.length > 1 && (
        <div className="tiktok-gallery-dots">
          {images.map((_, idx) => (
            <button
              key={idx}
              onClick={() => setCurrentIndex(idx)}
              className={`tiktok-gallery-dot ${idx === currentIndex ? 'active' : ''}`}
            />
          ))}
        </div>
      )}
      
      {/* Counter */}
      {images.length > 1 && (
        <div className="tiktok-gallery-counter">
          {currentIndex + 1} / {images.length}
        </div>
      )}
    </div>
  );
};

// Video player with auto-play support
const TikTokVideo = ({ videoUrl, thumbnailUrl, isActive }) => {
  const videoRef = useRef(null);
  const [isMuted, setIsMuted] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (videoRef.current) {
      if (isActive) {
        videoRef.current.play().catch(err => {
          console.log('Autoplay prevented:', err);
        });
        setIsPlaying(true);
      } else {
        videoRef.current.pause();
        videoRef.current.currentTime = 0;
        setIsPlaying(false);
      }
    }
  }, [isActive]);

  const toggleMute = (e) => {
    e.stopPropagation();
    if (videoRef.current) {
      videoRef.current.muted = !videoRef.current.muted;
      setIsMuted(!isMuted);
    }
  };

  const togglePlay = () => {
    if (videoRef.current) {
      if (videoRef.current.paused) {
        videoRef.current.play();
        setIsPlaying(true);
      } else {
        videoRef.current.pause();
        setIsPlaying(false);
      }
    }
  };

  if (error) {
    return (
      <div className="tiktok-media-error">
        <p>Failed to load video</p>
        <button onClick={() => setError(null)} className="tiktok-retry-btn">Retry</button>
      </div>
    );
  }

  return (
    <div className="tiktok-video-container" onClick={togglePlay}>
      <video
        ref={videoRef}
        src={videoUrl}
        poster={thumbnailUrl}
        loop
        muted={isMuted}
        playsInline
        className="tiktok-video"
        onError={() => setError('Failed to load video')}
      />
      
      {/* Play/Pause overlay */}
      {!isPlaying && (
        <div className="tiktok-play-overlay">
          <div className="tiktok-play-icon">▶</div>
        </div>
      )}
      
      {/* Mute toggle */}
      <button onClick={toggleMute} className="tiktok-mute-btn">
        {isMuted ? <TbVolumeOff size={24} /> : <TbVolume size={24} />}
      </button>
    </div>
  );
};

// Single image display
const TikTokImage = ({ imageUrl, title }) => {
  const [error, setError] = useState(false);

  if (error) {
    return (
      <div className="tiktok-media-error">
        <p>Failed to load image</p>
      </div>
    );
  }

  return (
    <div className="tiktok-image-container">
      <img 
        src={imageUrl} 
        alt={title}
        className="tiktok-image"
        onError={() => setError(true)}
      />
    </div>
  );
};

function TikTokFeed({ subreddit, username }) {
  const [memes, setMemes] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [after, setAfter] = useState(null);
  const [hasMore, setHasMore] = useState(true);
  const [touchStart, setTouchStart] = useState(null);
  const [touchEnd, setTouchEnd] = useState(null);
  const [isScrolling, setIsScrolling] = useState(false);
  
  const containerRef = useRef(null);
  const scrollTimeoutRef = useRef(null);
  const isLoadingRef = useRef(false);
  const minSwipeDistance = 50;
  const navigate = useNavigate();

  // Fetch memes from Reddit API
  const fetchMemes = useCallback(async (afterToken = null) => {
    if (isLoadingRef.current) return;
    
    isLoadingRef.current = true;
    setIsLoading(true);
    
    const limit = REDDIT_API_CONFIG.MEMES_PER_REQUEST;
    let url;
    
    if (username) {
      url = afterToken 
        ? `https://www.reddit.com/user/${username}/submitted.json?after=${afterToken}&limit=${limit}&include_over_18=1`
        : `https://www.reddit.com/user/${username}/submitted.json?limit=${limit}&include_over_18=1`;
    } else {
      const sub = subreddit || 'memes';
      url = afterToken 
        ? `https://www.reddit.com/r/${sub}.json?after=${afterToken}&limit=${limit}&include_over_18=1`
        : `https://www.reddit.com/r/${sub}.json?limit=${limit}&include_over_18=1`;
    }
    
    try {
      const response = await exponentialBackoff(async () => {
        const res = await debouncedFetch(url);
        return res.json();
      }, 3, 1000);
      
      if (response?.data?.children) {
        // Filter to only include videos, images, and galleries (exclude text/documents)
        const filteredMemes = response.data.children.filter(meme => {
          const data = meme.data;
          
          // Include galleries
          if (data.is_gallery && data.gallery_data && data.media_metadata) {
            return true;
          }
          
          // Include videos
          if (data.is_video || data.post_hint === 'hosted:video' || 
              (data.media && data.media.reddit_video)) {
            return true;
          }
          
          // Include rich videos (like redgifs) with preview
          if (data.post_hint === 'rich:video' && 
              data.preview?.reddit_video_preview?.fallback_url) {
            return true;
          }
          
          // Include images
          if (data.post_hint === 'image') {
            return true;
          }
          
          // Include direct image URLs
          if (data.url && data.url.match(/\.(jpeg|jpg|gif|png|webp)$/i)) {
            return true;
          }
          
          // Include gifv (Imgur)
          if (data.url && data.url.includes('.gifv')) {
            return true;
          }
          
          // Include mp4/webm videos
          if (data.url && (data.url.endsWith('.mp4') || data.url.endsWith('.webm'))) {
            return true;
          }
          
          // Exclude everything else (text posts, links, documents)
          return false;
        });
        
        setMemes(prev => [...prev, ...filteredMemes]);
        setAfter(response.data.after);
        setHasMore(!!response.data.after);
      }
    } catch (error) {
      console.error('Error fetching memes:', error);
    } finally {
      setIsLoading(false);
      isLoadingRef.current = false;
    }
  }, [subreddit, username]);

  // Initial fetch
  useEffect(() => {
    setMemes([]);
    setCurrentIndex(0);
    setAfter(null);
    setHasMore(true);
    fetchMemes();
  }, [subreddit, username, fetchMemes]);

  // Load more when near the end
  useEffect(() => {
    if (currentIndex >= memes.length - 3 && hasMore && !isLoading) {
      fetchMemes(after);
    }
  }, [currentIndex, memes.length, hasMore, isLoading, after, fetchMemes]);

  // Handle vertical swipe
  const onTouchStart = (e) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientY);
  };

  const onTouchMove = (e) => {
    setTouchEnd(e.targetTouches[0].clientY);
  };

  const onTouchEnd = () => {
    if (!touchStart || !touchEnd) return;
    
    const distance = touchStart - touchEnd;
    const isUpSwipe = distance > minSwipeDistance;
    const isDownSwipe = distance < -minSwipeDistance;
    
    if (isUpSwipe && currentIndex < memes.length - 1) {
      setCurrentIndex(prev => prev + 1);
    }
    if (isDownSwipe && currentIndex > 0) {
      setCurrentIndex(prev => prev - 1);
    }
  };

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'ArrowDown' || e.key === 'j') {
        if (currentIndex < memes.length - 1) {
          setCurrentIndex(prev => prev + 1);
        }
      } else if (e.key === 'ArrowUp' || e.key === 'k') {
        if (currentIndex > 0) {
          setCurrentIndex(prev => prev - 1);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentIndex, memes.length]);

  // Handle mouse wheel with debouncing
  useEffect(() => {
    const handleWheel = (e) => {
      if (isScrolling) return;
      
      if (e.deltaY > 50 && currentIndex < memes.length - 1) {
        setIsScrolling(true);
        setCurrentIndex(prev => prev + 1);
        
        // Debounce - prevent rapid scrolling
        if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
        scrollTimeoutRef.current = setTimeout(() => setIsScrolling(false), 400);
      } else if (e.deltaY < -50 && currentIndex > 0) {
        setIsScrolling(true);
        setCurrentIndex(prev => prev - 1);
        
        if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
        scrollTimeoutRef.current = setTimeout(() => setIsScrolling(false), 400);
      }
    };

    const container = containerRef.current;
    if (container) {
      container.addEventListener('wheel', handleWheel, { passive: true });
    }
    return () => {
      if (container) {
        container.removeEventListener('wheel', handleWheel);
      }
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, [currentIndex, memes.length, isScrolling]);

  // Get media type for current meme
  const getMediaType = (data) => {
    if (data.is_gallery) return 'gallery';
    if (data.is_video || data.post_hint === 'hosted:video' || data.post_hint === 'rich:video' ||
        (data.media && data.media.reddit_video) ||
        (data.url && (data.url.includes('.gifv') || data.url.endsWith('.mp4') || data.url.endsWith('.webm')))) {
      return 'video';
    }
    return 'image';
  };

  // Get media type icon
  const getMediaTypeIcon = (type) => {
    switch (type) {
      case 'gallery':
        return <TbLayoutGrid size={20} />;
      case 'video':
        return <TbVideo size={20} />;
      default:
        return <TbPhoto size={20} />;
    }
  };

  // Get media type label
  const getMediaTypeLabel = (type) => {
    switch (type) {
      case 'gallery':
        return 'Gallery';
      case 'video':
        return 'Video';
      default:
        return 'Image';
    }
  };

  // Extract thumbnail URL
  const extractThumbnailUrl = (meme) => {
    const { thumbnail, preview } = meme.data;
    if (preview?.images?.[0]?.source?.url) {
      return preview.images[0].source.url.replace(/&amp;/g, '&');
    }
    if (thumbnail && thumbnail !== 'self' && thumbnail !== 'default') {
      return thumbnail;
    }
    return null;
  };

  // Render media content
  const renderMedia = (meme, isActive) => {
    const data = meme.data;
    const thumbnailUrl = extractThumbnailUrl(meme);

    // Gallery
    if (data.is_gallery && data.gallery_data && data.media_metadata) {
      return (
        <GallerySwiper 
          galleryData={data.gallery_data}
          mediaMetadata={data.media_metadata}
        />
      );
    }

    // Reddit video
    if (data.media?.reddit_video?.fallback_url) {
      return (
        <TikTokVideo 
          videoUrl={data.media.reddit_video.fallback_url}
          thumbnailUrl={thumbnailUrl}
          isActive={isActive}
        />
      );
    }

    // Rich video preview (e.g., redgifs)
    if (data.preview?.reddit_video_preview?.fallback_url) {
      return (
        <TikTokVideo 
          videoUrl={data.preview.reddit_video_preview.fallback_url}
          thumbnailUrl={thumbnailUrl}
          isActive={isActive}
        />
      );
    }

    // Imgur gifv
    if (data.url?.includes('.gifv')) {
      const mp4Url = data.url.replace('.gifv', '.mp4');
      return (
        <TikTokVideo 
          videoUrl={mp4Url}
          thumbnailUrl={thumbnailUrl}
          isActive={isActive}
        />
      );
    }

    // Direct video URLs
    if (data.url && (data.url.endsWith('.mp4') || data.url.endsWith('.webm'))) {
      return (
        <TikTokVideo 
          videoUrl={data.url}
          thumbnailUrl={thumbnailUrl}
          isActive={isActive}
        />
      );
    }

    // Image
    return (
      <TikTokImage 
        imageUrl={data.url}
        title={data.title}
      />
    );
  };

  // Handle download
  const handleDownload = (meme) => {
    const data = meme.data;
    let mediaUrl = data.url;
    
    if (data.media?.reddit_video?.fallback_url) {
      mediaUrl = data.media.reddit_video.fallback_url;
    } else if (data.preview?.reddit_video_preview?.fallback_url) {
      mediaUrl = data.preview.reddit_video_preview.fallback_url;
    }
    
    if (mediaUrl) {
      const link = document.createElement('a');
      link.href = mediaUrl;
      link.download = data.title || 'download';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  // Handle share
  const handleShare = async (meme) => {
    const data = meme.data;
    const shareUrl = `https://reddit.com${data.permalink}`;
    
    if (navigator.share) {
      try {
        await navigator.share({
          title: data.title,
          url: shareUrl
        });
      } catch (err) {
        console.log('Share cancelled');
      }
    } else {
      navigator.clipboard.writeText(shareUrl);
    }
  };

  if (memes.length === 0 && isLoading) {
    return (
      <div className="tiktok-loading">
        <div className="tiktok-spinner"></div>
        <p>Loading...</p>
      </div>
    );
  }

  if (memes.length === 0) {
    return (
      <div className="tiktok-empty">
        <p>No media found in r/{subreddit}</p>
        <button onClick={() => fetchMemes()} className="tiktok-retry-btn">
          Retry
        </button>
      </div>
    );
  }

  const currentMeme = memes[currentIndex];
  const mediaType = getMediaType(currentMeme.data);

  return (
    <div 
      className="tiktok-feed-container"
      ref={containerRef}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      <Helmet>
        <title>{username ? `u/${username} - twiix` : (subreddit ? `r/${subreddit} - twiix` : 'twiix')}</title>
      </Helmet>

      {/* Media type badge (top right) */}
      <div className="tiktok-media-type-badge">
        {getMediaTypeIcon(mediaType)}
        <span>{getMediaTypeLabel(mediaType)}</span>
      </div>

      {/* Context badge (top left) */}
      <div className="tiktok-subreddit-badge">
        {username ? `u/${username}` : `r/${subreddit || 'memes'}`}
      </div>

      {/* Main content area */}
      <div className="tiktok-content">
        {memes.map((meme, index) => (
          <div 
            key={meme.data.id}
            className={`tiktok-slide ${index === currentIndex ? 'active' : ''}`}
            style={{
              transform: `translateY(${(index - currentIndex) * 100}%)`,
              opacity: Math.abs(index - currentIndex) <= 1 ? 1 : 0,
              pointerEvents: index === currentIndex ? 'auto' : 'none'
            }}
          >
            {Math.abs(index - currentIndex) <= 1 && renderMedia(meme, index === currentIndex)}
          </div>
        ))}
      </div>

      {/* Action buttons (right side) */}
      <div className="tiktok-actions">
        <div className="tiktok-action-btn">
          <LikeButton meme={currentMeme} size="lg" />
        </div>
        
        <button 
          className="tiktok-action-btn"
          onClick={() => handleDownload(currentMeme)}
          title="Download"
        >
          <TbDownload size={28} />
        </button>
        
        <button 
          className="tiktok-action-btn"
          onClick={() => handleShare(currentMeme)}
          title="Share"
        >
          <TbShare size={28} />
        </button>
      </div>

      {/* Title and info (bottom) */}
      <div className="tiktok-info">
        <h3 className="tiktok-title">{currentMeme.data.title}</h3>
        <div className="tiktok-meta">
          <Link to={`/u/${currentMeme.data.author}`} className="tiktok-author-link">
            u/{currentMeme.data.author}
          </Link>
          <span>•</span>
          <span>{currentMeme.data.score} points</span>
          {currentMeme.data.link_flair_text && (
            <>
              <span>•</span>
              <span className="tiktok-flair">{currentMeme.data.link_flair_text}</span>
            </>
          )}
        </div>
      </div>

      {/* Progress indicator */}
      <div className="tiktok-progress">
        <span>{currentIndex + 1} / {memes.length}</span>
      </div>

      {/* Navigation hints */}
      <div className="tiktok-nav-hint">
        {currentIndex > 0 && <div className="tiktok-nav-up">↑</div>}
        {currentIndex < memes.length - 1 && <div className="tiktok-nav-down">↓</div>}
      </div>

      {/* Loading indicator */}
      {isLoading && (
        <div className="tiktok-loading-more">
          Loading more...
        </div>
      )}
    </div>
  );
}

export default TikTokFeed;
