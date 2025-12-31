import React from 'react';
import { Link } from 'react-router-dom';
import { FaSearch } from 'react-icons/fa';

function Navigation() {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-14 max-w-screen-2xl items-center px-4">
        <Link to="/" className="mr-6 flex items-center space-x-2">
          <img src="/logo.png" alt="Logo" className="h-8 w-8 object-contain" />
          <span className="hidden font-bold sm:inline-block text-foreground">
            RedditGallery
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
            to="/r/nsfw"
            className="transition-colors hover:text-foreground/80 text-foreground/60"
          >
            NSFW
          </Link>
        </nav>
        <div className="flex items-center space-x-4">
          <Link 
            to="/search" 
            className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 hover:bg-accent hover:text-accent-foreground h-9 w-9"
          >
            <FaSearch className="h-4 w-4" />
            <span className="sr-only">Search</span>
          </Link>
        </div>
      </div>
    </header>
  );
}

export default Navigation;
