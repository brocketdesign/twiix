import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';

function SubredditsPage() {
  const [subreddits, setSubreddits] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchSubreddits = async () => {
      try {
        const response = await fetch('/subreddits.json');
        const data = await response.json();
        setSubreddits(data.subreddits);
      } catch (err) {
        setError('Failed to load subreddits');
      } finally {
        setIsLoading(false);
      }
    };

    fetchSubreddits();
  }, []);

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">Loading subreddits...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center text-destructive">{error}</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <Helmet>
        <title>{`Subreddits - reddgallery NSFW Viewer`}</title>
      </Helmet>
      <h1 className="text-3xl font-bold mb-8 text-center">Subreddits</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {subreddits.map((subreddit) => (
          <Link
            to={`/r/${subreddit}`}
            key={subreddit}
            className="block overflow-hidden rounded-xl border border-border bg-card text-card-foreground shadow-sm transition-all hover:shadow-md hover:ring-1 hover:ring-ring p-4"
          >
            <h2 className="text-lg font-semibold">r/{subreddit}</h2>
          </Link>
        ))}
      </div>
    </div>
  );
}

export default SubredditsPage;