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

  // Load likes from localStorage or Backend
  useEffect(() => {
    const loadLikes = async () => {
      setIsLoading(true);
      try {
        if (isSignedIn && user) {
          // Load from Backend for authenticated users
          console.log('Fetching likes for user:', user.id);
          const response = await fetch(`/api/likes/${user.id}`);
          if (response.ok) {
            const backendLikes = await response.json();
            console.log('Loaded likes from backend:', backendLikes.length);
            setLikes(backendLikes);
            // Sync to localStorage as backup
            localStorage.setItem(`likes_${user.id}`, JSON.stringify(backendLikes));
          } else {
            console.error('Failed to fetch likes from backend, status:', response.status);
            // Fallback to local storage
            const storedLikes = localStorage.getItem(`likes_${user.id}`);
            if (storedLikes) {
              const parsedLikes = JSON.parse(storedLikes);
              setLikes(parsedLikes);
              // Try to sync localStorage likes to backend
              console.log('Syncing localStorage likes to backend...');
              for (const like of parsedLikes) {
                try {
                  await fetch('/api/likes', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ userId: user.id, meme: like }),
                  });
                } catch (syncError) {
                  console.error('Failed to sync like to backend:', syncError);
                }
              }
            }
          }
        } else {
          // Load from localStorage for anonymous users
          const storageKey = getStorageKey();
          const storedLikes = localStorage.getItem(storageKey);
          if (storedLikes) {
            setLikes(JSON.parse(storedLikes));
          } else {
            setLikes([]);
          }
        }
      } catch (error) {
        console.error('Error loading likes:', error);
        // Fallback to localStorage on network error — do NOT reset to empty
        if (isSignedIn && user) {
          const storedLikes = localStorage.getItem(`likes_${user.id}`);
          if (storedLikes) {
            setLikes(JSON.parse(storedLikes));
          }
          // If no localStorage either, leave likes as-is (don't overwrite with [])
        }
      } finally {
        setIsLoading(false);
      }
    };

    loadLikes();
  }, [isSignedIn, user, getStorageKey]);

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
  const addLike = useCallback(async (meme) => {
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

    // Optimistically update UI
    setLikes((prevLikes) => {
      if (prevLikes.some((like) => like.id === likeEntry.id)) {
        return prevLikes;
      }
      return [likeEntry, ...prevLikes];
    });

    // Save to Backend if signed in
    if (isSignedIn && user) {
      try {
        console.log('Saving like to backend for user:', user.id, 'meme:', likeEntry.id);
        const response = await fetch('/api/likes', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            userId: user.id,
            meme: likeEntry,
          }),
        });
        if (!response.ok) {
          console.error('Failed to save like to backend, status:', response.status);
        } else {
          console.log('Like saved successfully to backend');
        }
      } catch (error) {
        console.error('Error saving like to backend:', error);
      }
    }
  }, [isSignedIn, user]);

  // Remove a like
  const removeLike = useCallback(async (memeId) => {
    // Optimistically update UI
    setLikes((prevLikes) => prevLikes.filter((like) => like.id !== memeId));

    // Remove from Backend if signed in
    if (isSignedIn && user) {
      try {
        console.log('Removing like from backend for user:', user.id, 'meme:', memeId);
        const response = await fetch(`/api/likes/${user.id}/${memeId}`, {
          method: 'DELETE',
        });
        if (!response.ok) {
          console.error('Failed to remove like from backend, status:', response.status);
        } else {
          console.log('Like removed successfully from backend');
        }
      } catch (error) {
        console.error('Error removing like from backend:', error);
      }
    }
  }, [isSignedIn, user]);

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
