import React from 'react';
import { Link } from 'react-router-dom';
import { FaSearch, FaHeart } from 'react-icons/fa';
import { SignedIn, SignedOut, SignInButton, UserButton } from '@clerk/clerk-react';
import { useLikes } from '../context/LikesContext';

function Navigation() {
  const { likesCount } = useLikes();

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-14 max-w-screen-2xl items-center px-4">
        <Link to="/" className="mr-6 flex items-center space-x-2">
          <img src="/logo.png" alt="Logo" className="h-8 w-8 object-contain" />
          <span className="hidden font-bold sm:inline-block text-foreground">
            reddgallery
          </span>
        </Link>
        <nav className="flex flex-1 items-center space-x-6 text-sm font-medium">
          <Link
            to="/"
            className="transition-colors hover:text-foreground/80 text-foreground/60"
          >
            Home
          </Link>
          <Link
            to="/subreddits"
            className="transition-colors hover:text-foreground/80 text-foreground/60"
          >
            Subreddits
          </Link>
          <SignedIn>
            <Link
              to="/likes"
              className="transition-colors hover:text-foreground/80 text-foreground/60 flex items-center gap-1.5"
            >
              <FaHeart className="h-3.5 w-3.5 text-red-500" />
              Likes
              {likesCount > 0 && (
                <span className="inline-flex items-center justify-center px-1.5 py-0.5 text-xs font-medium bg-red-500 text-white rounded-full min-w-[18px]">
                  {likesCount > 99 ? '99+' : likesCount}
                </span>
              )}
            </Link>
          </SignedIn>
        </nav>
        <div className="flex items-center space-x-4">
          <Link 
            to="/search" 
            className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 hover:bg-accent hover:text-accent-foreground h-9 w-9"
          >
            <FaSearch className="h-4 w-4" />
            <span className="sr-only">Search</span>
          </Link>
          
          {/* Auth Buttons */}
          <SignedOut>
            <SignInButton mode="modal">
              <button className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 transition-colors">
                Sign In
              </button>
            </SignInButton>
          </SignedOut>
          <SignedIn>
            <UserButton 
              afterSignOutUrl="/"
              appearance={{
                elements: {
                  avatarBox: "w-8 h-8"
                }
              }}
            />
          </SignedIn>
        </div>
      </div>
    </header>
  );
}

export default Navigation;
