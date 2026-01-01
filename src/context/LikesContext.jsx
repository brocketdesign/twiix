import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useUser } from '@clerk/clerk-react';

const LikesContext = createContext();

export function useLikes() {
  return useContext(LikesContext);
}

export function LikesProvider({ children }) {
  const { user, isSignedIn } = useUser();
  const [likes, setLikes] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // Storage key based on user ID for authenticated users
  const getStorageKey = useCallback(() => {
    return isSignedIn && user ? `likes_${user.id}` : 'likes_anonymous';
  }, [isSignedIn, user]);

  // Load likes from localStorage
  useEffect(() => {
    const loadLikes = () => {
      try {
        const storageKey = getStorageKey();
        const storedLikes = localStorage.getItem(storageKey);
        if (storedLikes) {
          setLikes(JSON.parse(storedLikes));
        } else {
          setLikes([]);
        }
      } catch (error) {
        console.error('Error loading likes:', error);
        setLikes([]);
      } finally {
        setIsLoading(false);
      }
    };

    loadLikes();
  }, [getStorageKey]);

  // Save likes to localStorage whenever they change
  useEffect(() => {
    if (!isLoading) {
      try {
        const storageKey = getStorageKey();
        localStorage.setItem(storageKey, JSON.stringify(likes));
      } catch (error) {
        console.error('Error saving likes:', error);
      }
    }
  }, [likes, isLoading, getStorageKey]);

  // Add a like
  const addLike = useCallback((meme) => {
    const memeData = meme.data || meme;
    const likeEntry = {
      id: memeData.id,
      title: memeData.title,
      url: memeData.url,
      thumbnail: memeData.thumbnail,
      subreddit: memeData.subreddit,
      subreddit_name_prefixed: memeData.subreddit_name_prefixed,
      permalink: memeData.permalink,
      author: memeData.author,
      created_utc: memeData.created_utc,
      is_video: memeData.is_video,
      post_hint: memeData.post_hint,
      media: memeData.media,
      preview: memeData.preview,
      is_gallery: memeData.is_gallery,
      gallery_data: memeData.gallery_data,
      media_metadata: memeData.media_metadata,
      selftext: memeData.selftext,
      domain: memeData.domain,
      likedAt: Date.now(),
    };

    setLikes((prevLikes) => {
      // Check if already liked
      if (prevLikes.some((like) => like.id === likeEntry.id)) {
        return prevLikes;
      }
      return [likeEntry, ...prevLikes];
    });
  }, []);

  // Remove a like
  const removeLike = useCallback((memeId) => {
    setLikes((prevLikes) => prevLikes.filter((like) => like.id !== memeId));
  }, []);

  // Toggle like
  const toggleLike = useCallback((meme) => {
    const memeData = meme.data || meme;
    const memeId = memeData.id;
    
    if (likes.some((like) => like.id === memeId)) {
      removeLike(memeId);
    } else {
      addLike(meme);
    }
  }, [likes, addLike, removeLike]);

  // Check if a meme is liked
  const isLiked = useCallback((memeId) => {
    return likes.some((like) => like.id === memeId);
  }, [likes]);

  // Get likes by subreddit
  const getLikesBySubreddit = useCallback(() => {
    const grouped = {};
    likes.forEach((like) => {
      const subreddit = like.subreddit || 'unknown';
      if (!grouped[subreddit]) {
        grouped[subreddit] = [];
      }
      grouped[subreddit].push(like);
    });
    return grouped;
  }, [likes]);

  // Get likes sorted by date (latest first)
  const getLikesByDate = useCallback(() => {
    return [...likes].sort((a, b) => b.likedAt - a.likedAt);
  }, [likes]);

  // Get unique subreddits from likes
  const getSubredditsFromLikes = useCallback(() => {
    const subreddits = [...new Set(likes.map((like) => like.subreddit).filter(Boolean))];
    return subreddits.sort();
  }, [likes]);

  const value = {
    likes,
    isLoading,
    addLike,
    removeLike,
    toggleLike,
    isLiked,
    getLikesBySubreddit,
    getLikesByDate,
    getSubredditsFromLikes,
    likesCount: likes.length,
  };

  return <LikesContext.Provider value={value}>{children}</LikesContext.Provider>;
}

export default LikesContext;
