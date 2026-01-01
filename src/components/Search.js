import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { X } from 'lucide-react';
import { Helmet } from 'react-helmet-async';

function Search() {
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [visitedSubreddits, setVisitedSubreddits] = useState([]);
  const [hoveredSubredditId, setHoveredSubredditId] = useState(null);
  const [timeoutIds, setTimeoutIds] = useState({});
  const [hasSearched, setHasSearched] = useState(false);
  const location = useLocation();

  // Helper to extract tag from query string
  const getTagFromQuery = () => {
    const params = new URLSearchParams(location.search);
    return params.get('tag') || '';
  };

  // Effect: If ?tag= is present in URL, auto-search for that tag
  useEffect(() => {
    const tag = getTagFromQuery();
    if (tag) {
      setSearchTerm(tag);
      setHasSearched(true);
      handleSearch(tag);
    }
    // eslint-disable-next-line
  }, [location.search]);

  useEffect(() => {
    // Load data from local storage on component mount
    const storedSearchTerm = localStorage.getItem('searchTerm');
    const storedSearchResults = localStorage.getItem('searchResults');

    if (storedSearchTerm && storedSearchResults) {
      setSearchTerm(storedSearchTerm);
      setSearchResults(JSON.parse(storedSearchResults));
      setHasSearched(true);
    }

    // Load visited subreddits from local storage
    const storedVisitedSubreddits = localStorage.getItem('visitedSubreddits');
    if (storedVisitedSubreddits) {
      setVisitedSubreddits(JSON.parse(storedVisitedSubreddits));
    }
  }, []);

  const handleSearchChange = (event) => {
    const newSearchTerm = event.target.value;
    setSearchTerm(newSearchTerm);
    setHasSearched(false);
    // No longer trigger search here, only update the input value
    if (!newSearchTerm.trim()) {
      setSearchResults([]);
      localStorage.removeItem('searchTerm');
      localStorage.removeItem('searchResults');
    }
  };

  const handleSearch = async (term) => {
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`https://www.reddit.com/subreddits/search.json?q=${encodeURIComponent(term)}&include_over_18=1`);
      const data = await response.json();
      
      if (data && data.data && data.data.children) {
        const results = data.data.children.map(item => item.data);
        setSearchResults(results);

        localStorage.setItem('searchTerm', term);
        localStorage.setItem('searchResults', JSON.stringify(results));
      } else {
        setError('No results found');
        setSearchResults([]);

        localStorage.removeItem('searchTerm');
        localStorage.removeItem('searchResults');
      }
    } catch (error) {
      console.error('Error searching subreddits:', error);
      setError('Error searching subreddits. Please try again.');
      setSearchResults([]);

      localStorage.removeItem('searchTerm');
      localStorage.removeItem('searchResults');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSearchSubmit = async (event) => {
    event.preventDefault();
    setHasSearched(true);
    if (!searchTerm.trim()) {
      // Clear local storage if search term is empty
      localStorage.removeItem('searchTerm');
      localStorage.removeItem('searchResults');
      setSearchResults([]);
      return;
    }
    
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`https://www.reddit.com/subreddits/search.json?q=${encodeURIComponent(searchTerm)}&include_over_18=1`);
      const data = await response.json();
      
      if (data && data.data && data.data.children) {
        const results = data.data.children.map(item => item.data);
        setSearchResults(results);

        // Save search term and results to local storage
        localStorage.setItem('searchTerm', searchTerm);
        localStorage.setItem('searchResults', JSON.stringify(results));
      } else {
        setError('No results found');
        setSearchResults([]);

        // Clear local storage if no results are found
        localStorage.removeItem('searchTerm');
        localStorage.removeItem('searchResults');
      }
    } catch (error) {
      console.error('Error searching subreddits:', error);
      setError('Error searching subreddits. Please try again.');
      setSearchResults([]);

      // Clear local storage on error
      localStorage.removeItem('searchTerm');
      localStorage.removeItem('searchResults');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubredditClick = (subreddit) => {
    // Update visited subreddits in local storage
    let updatedVisitedSubreddits = [
      subreddit,
      ...visitedSubreddits.filter((v) => v.id !== subreddit.id),
    ].slice(0, 5); // Limit to last 5 visited subreddits

    localStorage.setItem(
      'visitedSubreddits',
      JSON.stringify(updatedVisitedSubreddits)
    );
    setVisitedSubreddits(updatedVisitedSubreddits);
  };

  const handleMouseEnter = (subredditId) => {
    const timeoutId = setTimeout(() => {
      setHoveredSubredditId(subredditId);
    }, 1000); // 1 second delay
    setTimeoutIds((prev) => ({ ...prev, [subredditId]: timeoutId }));
  };

  const handleMouseLeave = (subredditId) => {
    clearTimeout(timeoutIds[subredditId]);
    setHoveredSubredditId(null);
    setTimeoutIds((prev) => ({ ...prev, [subredditId]: null }));
  };

  const handleRemoveVisited = (subredditId) => {
    const updatedVisitedSubreddits = visitedSubreddits.filter(
      (v) => v.id !== subredditId
    );
    localStorage.setItem(
      'visitedSubreddits',
      JSON.stringify(updatedVisitedSubreddits)
    );
    setVisitedSubreddits(updatedVisitedSubreddits);
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <Helmet>
        <title>{`Search Subreddits - reddgallery NSFW Viewer`}</title>
      </Helmet>
      <div className="mx-auto">
        <h1 className="text-3xl font-bold mb-8 text-center">Search Subreddits</h1>
        
        <div className="mb-8 mx-auto max-w-md">
          <form className="flex gap-2" onSubmit={handleSearchSubmit}>
            <input
              type="text"
              placeholder="Enter subreddit name or tag..."
              value={searchTerm}
              onChange={handleSearchChange}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 flex-1"
            />
            <button
              type="submit"
              className="h-10 px-4 rounded-md bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors"
              disabled={isLoading || !searchTerm.trim()}
            >
              {isLoading ? 'Searching...' : 'Search'}
            </button>
          </form>
        </div>

        {error && (
          <div className="bg-destructive/15 text-destructive p-4 rounded-md mb-6">
            {error}
          </div>
        )}

        {visitedSubreddits.length > 0 && (
          <div className="mb-6">
            <h2 className="text-xl font-semibold mb-3">Last Visited Subreddits</h2>
            <div className="flex flex-wrap gap-3">
              {visitedSubreddits.map((subreddit) => (
                <div
                  key={subreddit.id}
                  className="relative"
                  onMouseEnter={() => handleMouseEnter(subreddit.id)}
                  onMouseLeave={() => handleMouseLeave(subreddit.id)}
                >
                  <Link
                    to={`/r/${subreddit.display_name}`}
                    className="block overflow-hidden rounded-xl border border-border bg-card text-card-foreground shadow-sm transition-all hover:shadow-md hover:ring-1 hover:ring-ring"
                    onClick={() => handleSubredditClick(subreddit)}
                  >
                    <div className="p-4">
                      <h3 className="text-lg font-semibold">
                        r/{subreddit.display_name}
                      </h3>
                    </div>
                  </Link>
                  {hoveredSubredditId === subreddit.id && (
                    <button
                      className="absolute top-2 right-2 rounded-full bg-background/80 p-1 text-foreground backdrop-blur-sm hover:bg-accent hover:text-accent-foreground"
                      onClick={() => handleRemoveVisited(subreddit.id)}
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {searchResults.map((subreddit) => (
            <Link 
              to={`/r/${subreddit.display_name}`} 
              key={subreddit.id}
              className="block overflow-hidden rounded-xl border border-border bg-card text-card-foreground shadow-sm transition-all hover:shadow-md hover:ring-1 hover:ring-ring"
              onClick={() => handleSubredditClick(subreddit)}
            >
              <div className="p-4">
                <h2 className="text-xl font-semibold mb-1">r/{subreddit.display_name}</h2>
                <p className="text-sm text-muted-foreground mb-2">
                  {subreddit.subscribers?.toLocaleString() || 0} subscribers
                </p>
                <p className="text-sm line-clamp-3">
                  {subreddit.public_description || 'No description available'}
                </p>
              </div>
            </Link>
          ))}
        </div>

        {searchResults.length === 0 && !isLoading && !error && hasSearched && (
          <p className="text-center text-muted-foreground">No results found. Try a different search term.</p>
        )}
      </div>
    </div>
  );
}

export default Search;
