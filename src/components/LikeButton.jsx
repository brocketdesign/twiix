import React from 'react';
import { useUser, useClerk } from '@clerk/clerk-react';
import { useLikes } from '../context/LikesContext';
import { FaHeart, FaRegHeart } from 'react-icons/fa';

const LikeButton = ({ meme, size = 'md', showText = false, className = '' }) => {
  const { isSignedIn } = useUser();
  const { openSignIn } = useClerk();
  const { toggleLike, isLiked } = useLikes();

  const memeData = meme?.data || meme;
  const memeId = memeData?.id;
  const liked = isLiked(memeId);

  const handleClick = (e) => {
    e.stopPropagation();
    e.preventDefault();

    if (!isSignedIn) {
      openSignIn();
      return;
    }

    toggleLike(meme);
  };

  const sizeClasses = {
    sm: 'h-6 w-6 text-sm',
    md: 'h-8 w-8 text-base',
    lg: 'h-10 w-10 text-lg',
  };

  const iconSizes = {
    sm: 14,
    md: 18,
    lg: 22,
  };

  return (
    <button
      onClick={handleClick}
      className={`inline-flex items-center justify-center gap-1.5 rounded-full transition-all duration-200 hover:scale-110 ${
        liked
          ? 'text-red-500 hover:text-red-600'
          : 'text-gray-400 hover:text-red-400'
      } ${sizeClasses[size]} ${className}`}
      title={liked ? 'Unlike' : isSignedIn ? 'Like' : 'Sign in to like'}
      aria-label={liked ? 'Unlike' : 'Like'}
    >
      {liked ? (
        <FaHeart size={iconSizes[size]} className="fill-current" />
      ) : (
        <FaRegHeart size={iconSizes[size]} className="fill-current" />
      )}
      {showText && (
        <span className="text-xs font-medium">
          {liked ? 'Liked' : 'Like'}
        </span>
      )}
    </button>
  );
};

export default LikeButton;
