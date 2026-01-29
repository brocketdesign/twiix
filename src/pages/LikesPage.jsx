import React, { useState, useMemo, useRef } from 'react';
import { useUser, SignInButton } from '@clerk/clerk-react';
import { Link, useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { useLikes } from '../context/LikesContext';
import LikeButton from '../components/LikeButton';
import { FaHeart, FaClock, FaLayerGroup, FaFilter, FaSignInAlt, FaPlay, FaExternalLinkAlt } from 'react-icons/fa';
import { TbPhoto, TbVideo, TbFileText, TbLink, TbLayoutGrid } from 'react-icons/tb';
import Masonry from 'react-masonry-css';
import '../styles/MemeGallery.css';

// Click-to-play video component
const VideoPlayer = ({ videoUrl, thumbnail, title }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const videoRef = useRef(null);

  const handlePlay = (e) => {
    e.stopPropagation();
    setIsPlaying(true);
    // Start playing after state update
    setTimeout(() => {
      if (videoRef.current) {
        videoRef.current.play();
      }
    }, 0);
  };

  if (!isPlaying) {
    return (
      <div className="relative cursor-pointer" onClick={handlePlay}>
        <img
          src={thumbnail || 'https://via.placeholder.com/300x200?text=Video'}
          alt={title}
          className="w-full h-auto object-cover"
          loading="lazy"
        />
        <div className="absolute inset-0 flex items-center justify-center bg-black/20 hover:bg-black/30 transition-colors">
          <div className="bg-black/60 rounded-full p-4 hover:bg-black/80 transition-colors">
            <FaPlay className="w-8 h-8 text-white" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full bg-black">
      <video
        ref={videoRef}
        src={videoUrl}
        controls
        muted
        loop
        preload="metadata"
        className="w-full h-auto"
        poster={thumbnail}
        onClick={(e) => e.stopPropagation()}
      />
    </div>
  );
};

// Click-to-play rich video component (YouTube, etc.)
const RichVideoPlayer = ({ embedHtml, thumbnail, title }) => {
  const [isPlaying, setIsPlaying] = useState(false);

  const handlePlay = (e) => {
    e.stopPropagation();
    setIsPlaying(true);
  };

  if (!isPlaying) {
    return (
      <div className="relative cursor-pointer" onClick={handlePlay}>
        <img
          src={thumbnail || 'https://via.placeholder.com/300x200?text=Video'}
          alt={title}
          className="w-full h-auto object-cover"
          loading="lazy"
        />
        <div className="absolute inset-0 flex items-center justify-center bg-black/20 hover:bg-black/30 transition-colors">
          <div className="bg-black/60 rounded-full p-4 hover:bg-black/80 transition-colors">
            <FaPlay className="w-8 h-8 text-white" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full bg-black">
      <div 
        className="w-full"
        dangerouslySetInnerHTML={{ __html: embedHtml }}
        onClick={(e) => e.stopPropagation()}
      />
    </div>
  );
};

const LikesPage = () => {
  const { isSignedIn, isLoaded } = useUser();
  const { likes, getLikesByDate, getLikesBySubreddit, getSubredditsFromLikes, isLoading } = useLikes();
  const navigate = useNavigate();

  const [viewMode, setViewMode] = useState('latest'); // 'latest' or 'subreddit'
  const [selectedSubreddit, setSelectedSubreddit] = useState('all');

  const subreddits = useMemo(() => getSubredditsFromLikes(), [getSubredditsFromLikes]);
  const likesBySubreddit = useMemo(() => getLikesBySubreddit(), [getLikesBySubreddit]);
  const likesByDate = useMemo(() => getLikesByDate(), [getLikesByDate]);

  const filteredLikes = useMemo(() => {
    if (viewMode === 'latest') {
      if (selectedSubreddit === 'all') {
        return likesByDate;
      }
      return likesByDate.filter((like) => like.subreddit === selectedSubreddit);
    } else {
      if (selectedSubreddit === 'all') {
        return likesByDate;
      }
      return likesBySubreddit[selectedSubreddit] || [];
    }
  }, [viewMode, selectedSubreddit, likesByDate, likesBySubreddit]);

  const breakpointColumnsObj = {
    default: 4,
    1100: 3,
    700: 2,
    500: 1,
  };

  const getMediaType = (data) => {
    if (data.is_video || data.post_hint === 'hosted:video') return 'video';
    if (data.post_hint === 'rich:video') return 'rich:video';
    if (data.is_gallery) return 'gallery';
    if (data.post_hint === 'image' || (data.url && data.url.match(/\.(jpeg|jpg|gif|png|webp)$/i))) return 'image';
    if (data.is_self || data.post_hint === 'self') return 'text';
    return 'link';
  };

  const renderMediaIcon = (mediaType) => {
    const iconClass = "w-4 h-4";
    switch (mediaType) {
      case 'video':
      case 'rich:video':
        return <TbVideo className={iconClass} />;
      case 'image':
        return <TbPhoto className={iconClass} />;
      case 'gallery':
        return <TbLayoutGrid className={iconClass} />;
      case 'text':
        return <TbFileText className={iconClass} />;
      default:
        return <TbLink className={iconClass} />;
    }
  };

  const formatDate = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const handleMemeClick = (like) => {
    navigate('/r/' + like.subreddit + '/' + like.id);
  };

  // Render media content based on type
  const renderMediaContent = (like) => {
    const mediaType = getMediaType(like);
    
    // Get thumbnail URL
    const getThumbnail = () => {
      if (like.preview?.images?.[0]?.resolutions) {
        const resolutions = like.preview.images[0].resolutions;
        const best = resolutions[resolutions.length - 1] || resolutions[0];
        return best?.url?.replace(/&amp;/g, '&');
      }
      if (like.thumbnail && like.thumbnail !== 'default' && like.thumbnail !== 'self' && like.thumbnail !== 'nsfw') {
        return like.thumbnail;
      }
      return null;
    };

    const thumbnail = getThumbnail();

    switch (mediaType) {
      case 'video':
        const videoUrl = like.media?.reddit_video?.fallback_url || 
                        like.preview?.reddit_video_preview?.fallback_url;
        if (videoUrl) {
          return (
            <VideoPlayer 
              videoUrl={videoUrl} 
              thumbnail={thumbnail} 
              title={like.title} 
            />
          );
        }
        // Fallback to thumbnail with play icon
        return (
          <div className="relative">
            <img
              src={thumbnail || 'https://via.placeholder.com/300x200?text=Video'}
              alt={like.title}
              className="w-full h-auto object-cover transition-transform duration-300 group-hover:scale-105"
              loading="lazy"
            />
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="bg-black/60 rounded-full p-3">
                <FaPlay className="w-6 h-6 text-white" />
              </div>
            </div>
          </div>
        );

      case 'rich:video':
        // Check if we have embed HTML for rich videos (like YouTube)
        if (like.secure_media?.oembed?.html) {
          return (
            <RichVideoPlayer 
              embedHtml={like.secure_media.oembed.html} 
              thumbnail={thumbnail} 
              title={like.title} 
            />
          );
        }
        // Check if we have a preview video
        if (like.preview?.reddit_video_preview?.fallback_url) {
          return (
            <VideoPlayer 
              videoUrl={like.preview.reddit_video_preview.fallback_url} 
              thumbnail={thumbnail} 
              title={like.title} 
            />
          );
        }
        // Fallback to thumbnail with play icon
        return (
          <div className="relative">
            <img
              src={thumbnail || 'https://via.placeholder.com/300x200?text=Video'}
              alt={like.title}
              className="w-full h-auto object-cover transition-transform duration-300 group-hover:scale-105"
              loading="lazy"
            />
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="bg-black/60 rounded-full p-3">
                <FaPlay className="w-6 h-6 text-white" />
              </div>
            </div>
          </div>
        );

      case 'gallery':
        // For galleries, show the first image or thumbnail
        let galleryImage = thumbnail;
        if (like.media_metadata) {
          const firstKey = Object.keys(like.media_metadata)[0];
          if (firstKey && like.media_metadata[firstKey]?.s?.u) {
            galleryImage = like.media_metadata[firstKey].s.u.replace(/&amp;/g, '&');
          }
        }
        return (
          <div className="relative">
            <img
              src={galleryImage || 'https://via.placeholder.com/300x200?text=Gallery'}
              alt={like.title}
              className="w-full h-auto object-cover transition-transform duration-300 group-hover:scale-105"
              loading="lazy"
            />
            <div className="absolute bottom-2 right-2 bg-black/60 text-white text-xs px-2 py-1 rounded">
              Gallery
            </div>
          </div>
        );

      case 'image':
        return (
          <img
            src={like.url}
            alt={like.title}
            className="w-full h-auto object-cover transition-transform duration-300 group-hover:scale-105"
            loading="lazy"
          />
        );

      case 'text':
        return (
          <div className="p-4 bg-muted min-h-[150px]">
            <p className="text-sm text-muted-foreground line-clamp-6">
              {like.selftext || 'Text post'}
            </p>
          </div>
        );

      default:
        return (
          <div className="relative">
            <img
              src={thumbnail || 'https://via.placeholder.com/300x200?text=Link'}
              alt={like.title}
              className="w-full h-auto object-cover transition-transform duration-300 group-hover:scale-105 min-h-[150px]"
              loading="lazy"
            />
            {like.domain && (
              <div className="absolute bottom-2 right-2 bg-black/60 text-white text-xs px-2 py-1 rounded">
                {like.domain}
              </div>
            )}
          </div>
        );
    }
  };

  // Render a single meme card
  const renderMemeCard = (like) => {
    const mediaType = getMediaType(like);
    return (
      <div
        key={like.id}
        className="group relative overflow-hidden rounded-xl border border-border bg-card text-card-foreground shadow-sm transition-all hover:shadow-md cursor-pointer"
        onClick={() => handleMemeClick(like)}
      >
        {/* Media Type Icon */}
        <div className="absolute top-2 right-2 z-10 p-1.5 rounded-full bg-black/60 text-white">
          {renderMediaIcon(mediaType)}
        </div>

        {/* Like Button */}
        <div className="absolute top-2 left-2 z-10 p-1 rounded-full bg-black/60">
          <LikeButton meme={{ data: like }} size="sm" />
        </div>

        {/* Media Content */}
        <div className="relative overflow-hidden bg-muted">
          {renderMediaContent(like)}
        </div>

        {/* Info Overlay */}
        <div className="p-3 bg-card">
          <h3 className="text-sm font-medium text-foreground line-clamp-2 mb-2">
            {like.title}
          </h3>
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <Link
              to={'/r/' + like.subreddit}
              onClick={(e) => e.stopPropagation()}
              className="hover:text-orange-500 transition-colors"
            >
              r/{like.subreddit}
            </Link>
            <div className="flex items-center gap-2">
              <span>{formatDate(like.likedAt)}</span>
              <Link
                to={'/r/' + like.subreddit + '/' + like.id}
                onClick={(e) => e.stopPropagation()}
                className="hover:text-orange-500 transition-colors"
                title="View post"
              >
                <FaExternalLinkAlt className="w-3 h-3" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Render grid grouped by subreddit
  const renderBySubreddit = () => {
    const sortedSubreddits = Object.keys(likesBySubreddit).sort((a, b) => {
      return likesBySubreddit[b].length - likesBySubreddit[a].length;
    });

    return (
      <div className="space-y-10">
        {sortedSubreddits.map((subreddit) => {
          const subredditLikes = likesBySubreddit[subreddit];
          return (
            <div key={subreddit} className="border-b border-border pb-8 last:border-b-0">
              {/* Subreddit Header */}
              <div className="flex items-center justify-between mb-4">
                <Link
                  to={'/r/' + subreddit}
                  className="flex items-center gap-2 group/header"
                >
                  <h2 className="text-xl font-bold text-foreground group-hover/header:text-orange-500 transition-colors">
                    r/{subreddit}
                  </h2>
                  <span className="text-sm text-muted-foreground">
                    ({subredditLikes.length} {subredditLikes.length === 1 ? 'like' : 'likes'})
                  </span>
                </Link>
                <Link
                  to={'/r/' + subreddit}
                  className="text-sm text-muted-foreground hover:text-orange-500 transition-colors"
                >
                  View subreddit →
                </Link>
              </div>

              {/* Subreddit Memes Grid */}
              <Masonry
                breakpointCols={breakpointColumnsObj}
                className="masonry-grid"
                columnClassName="masonry-grid-column"
              >
                {subredditLikes.map((like) => renderMemeCard(like))}
              </Masonry>
            </div>
          );
        })}
      </div>
    );
  };

  // Loading state
  if (!isLoaded || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-orange-500"></div>
      </div>
    );
  }

  // Not signed in state
  if (!isSignedIn) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-4">
        <Helmet>
          <title>{'Liked Memes - twiix'}</title>
        </Helmet>
        <FaHeart className="w-16 h-16 text-gray-300 mb-4" />
        <h1 className="text-2xl font-bold text-foreground mb-2">Sign in to view your likes</h1>
        <p className="text-muted-foreground text-center mb-6 max-w-md">
          Keep track of your favorite memes by signing in. Your likes will be saved and synced across sessions.
        </p>
        <SignInButton mode="modal">
          <button className="inline-flex items-center gap-2 px-6 py-3 bg-orange-500 hover:bg-orange-600 text-white font-medium rounded-lg transition-colors">
            <FaSignInAlt />
            Sign In
          </button>
        </SignInButton>
      </div>
    );
  }

  // Empty likes state
  if (likes.length === 0) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-4">
        <Helmet>
          <title>{'Liked Memes - twiix'}</title>
        </Helmet>
        <FaHeart className="w-16 h-16 text-gray-300 mb-4" />
        <h1 className="text-2xl font-bold text-foreground mb-2">No liked memes yet</h1>
        <p className="text-muted-foreground text-center mb-6 max-w-md">
          Start exploring and like your favorite memes! They'll appear here.
        </p>
        <Link
          to="/"
          className="inline-flex items-center gap-2 px-6 py-3 bg-orange-500 hover:bg-orange-600 text-white font-medium rounded-lg transition-colors"
        >
          Explore Memes
        </Link>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-6 max-w-screen-2xl">
      <Helmet>
        <title>{'Liked Memes (' + likes.length + ') - twiix'}</title>
      </Helmet>

      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <FaHeart className="text-red-500" />
          Liked Memes
          <span className="text-lg font-normal text-muted-foreground">({likes.length})</span>
        </h1>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4 mb-6 p-4 bg-card rounded-lg border border-border">
        {/* View Mode Toggle */}
        <div className="flex items-center gap-2">
          <FaFilter className="text-muted-foreground" />
          <span className="text-sm font-medium text-muted-foreground">View:</span>
          <div className="flex rounded-lg overflow-hidden border border-border">
            <button
              onClick={() => {
                setViewMode('latest');
                setSelectedSubreddit('all');
              }}
              className={'px-3 py-1.5 text-sm font-medium flex items-center gap-1.5 transition-colors ' + (
                viewMode === 'latest'
                  ? 'bg-orange-500 text-white'
                  : 'bg-background text-foreground hover:bg-accent'
              )}
            >
              <FaClock className="w-3.5 h-3.5" />
              Latest
            </button>
            <button
              onClick={() => {
                setViewMode('subreddit');
                setSelectedSubreddit('all');
              }}
              className={'px-3 py-1.5 text-sm font-medium flex items-center gap-1.5 transition-colors ' + (
                viewMode === 'subreddit'
                  ? 'bg-orange-500 text-white'
                  : 'bg-background text-foreground hover:bg-accent'
              )}
            >
              <FaLayerGroup className="w-3.5 h-3.5" />
              By Subreddit
            </button>
          </div>
        </div>

        {/* Subreddit Filter - Only show in latest mode */}
        {viewMode === 'latest' && (
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-muted-foreground">Filter:</span>
            <select
              value={selectedSubreddit}
              onChange={(e) => setSelectedSubreddit(e.target.value)}
              className="px-3 py-1.5 text-sm rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-orange-500"
            >
              <option value="all">All Subreddits ({likes.length})</option>
              {subreddits.map((subreddit) => (
                <option key={subreddit} value={subreddit}>
                  r/{subreddit} ({likesBySubreddit[subreddit]?.length || 0})
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Results count */}
      {viewMode === 'latest' && (
        <p className="text-sm text-muted-foreground mb-4">
          Showing {filteredLikes.length} of {likes.length} liked memes
          {selectedSubreddit !== 'all' && ' from r/' + selectedSubreddit}
        </p>
      )}

      {/* Content */}
      {viewMode === 'subreddit' ? (
        renderBySubreddit()
      ) : (
        <>
          {/* Meme Grid for Latest view */}
          {filteredLikes.length > 0 ? (
            <Masonry
              breakpointCols={breakpointColumnsObj}
              className="masonry-grid"
              columnClassName="masonry-grid-column"
            >
              {filteredLikes.map((like) => renderMemeCard(like))}
            </Masonry>
          ) : (
            <div className="text-center py-12">
              <p className="text-muted-foreground">No memes found for the selected filter.</p>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default LikesPage;
