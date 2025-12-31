import React, { useEffect } from 'react';
import { Routes, Route, useNavigate, useParams } from 'react-router-dom';
import './App.css';
import Search from './components/Search';
import Navigation from './components/Navigation';
import MemePage from './components/MemePage';
import MemeGallery from './components/MemeGallery';

function App() {
  // Retrieve visitedSubreddits from local storage
  const visitedSubreddits = JSON.parse(localStorage.getItem('visitedSubreddits')) || [];
  const navigate = useNavigate();
  const location = window.location;

  useEffect(() => {
    // Only perform redirection if currently at the root path
    if (location.pathname === "/") {
      if (visitedSubreddits.length > 0) {
        // Redirect to the last visited subreddit
        const lastVisitedSubreddit = visitedSubreddits[0].display_name;
        navigate(`/r/${lastVisitedSubreddit}`);
      } else {
        // Redirect to search page when no visited subreddits are available
        navigate('/search');
      }
    }
  }, [visitedSubreddits, navigate, location.pathname]);

  return (
    <div className="min-h-screen bg-background font-sans antialiased text-foreground">
      <Navigation />
      <main>
        <Routes>
          <Route path="/search" element={<Search />} />
          <Route path="/r/:subreddit" element={<SubredditRoute />} />
          <Route path="/r/:subreddit/:memeId" element={<MemePage />} />
        </Routes>
      </main>
    </div>
  );
}

function SubredditRoute() {
  const { subreddit } = useParams();
  return <MemeGallery subreddit={subreddit} />;
}

export default App;
