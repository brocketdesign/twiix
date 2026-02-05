# Seen Memes Tracking

## Overview

This feature prevents users from seeing the same meme multiple times by tracking which meme IDs have already been viewed in the feed and grid experiences. Seen meme IDs are persisted locally so returning users continue to get fresh content.

## How It Works

### TikTok-style Feed

- When a meme becomes the active item in the feed, its ID is marked as seen.
- Subsequent fetches filter out any meme IDs that are already seen.
- Seen IDs are stored per feed target:
  - Subreddit feeds: `seen_memes_subreddit_<subreddit>`
  - User feeds: `seen_memes_user_<username>`

### Gallery Grid (Masonry)

- When new memes are added to the gallery, their IDs are recorded as seen.
- On subreddit change or refresh, the gallery loads the stored seen IDs for that subreddit and filters future fetches accordingly.

## Storage

Seen IDs are stored in `localStorage` as JSON arrays. Example:

```json
["abc123", "def456", "ghi789"]
```

## Key Files

- Feed implementation: [src/components/TikTokFeed.jsx](../src/components/TikTokFeed.jsx)
- Gallery implementation: [src/components/MemeGallery.js](../src/components/MemeGallery.js)

## Notes

- Seen tracking is per subreddit or username to keep feeds independent.
- Clearing browser storage will reset seen history.
- This logic is client-side only and does not require backend changes.
