# Database Implementation Documentation

## Overview

The Reddit Meme Gallery application uses **MongoDB** as its database system to persist user likes and seen memes across sessions and devices. The database implementation follows a simple, focused design that stores only the essential data needed for the likes and tracking features.

---

## Technology Stack

| Component | Technology |
|-----------|------------|
| Database | MongoDB Atlas |
| Driver | `mongodb` (Node.js) |
| Connection | MongoDB Client |
| ORM | None (Native MongoDB driver) |

---

## Database Schema

### Collection: `likes`

Stores all user likes:

```javascript
{
  _id: ObjectId,           // Auto-generated MongoDB ID
  userId: String,          // Clerk authentication user ID (e.g., "user_2abc123...")
  memeId: String,          // Reddit post ID (e.g., "1ab2cd3")
  memeData: Object,        // Complete meme data object
  createdAt: Date          // Timestamp when the like was created
}
```

#### Indexes

- **Unique Compound Index**: `{ userId: 1, memeId: 1 }` - Prevents duplicate likes
- **User Index**: `{ userId: 1 }` - Fast user-specific queries
- **Date Index**: `{ createdAt: -1 }` - Efficient sorting by date

---

### Collection: `seen_memes`

Tracks which memes a user has already seen:

```javascript
{
  _id: ObjectId,           // Auto-generated MongoDB ID
  userId: String,          // Clerk authentication user ID
  feedKey: String,         // Identifier for the feed/subreddit
  memeId: String,          // Reddit post ID
  createdAt: Date          // Timestamp when marked as seen
}
```

#### Indexes

- **Unique Compound Index**: `{ userId: 1, feedKey: 1, memeId: 1 }` - Prevents duplicates
- **User-Feed Index**: `{ userId: 1, feedKey: 1 }` - Fast feed-specific queries

---

## What Data is Stored

### User Identification

The `userId` comes from **Clerk Authentication**. When a user signs in via Clerk (Google, email, etc.), their unique Clerk user ID is used to identify them in the database.

### Meme Data Structure

The `memeData` field stores the complete meme object with the following fields:

```json
{
  "id": "1abc2de",
  "title": "Meme title from Reddit",
  "url": "https://i.redd.it/example.jpg",
  "thumbnail": "https://b.thumbs.redditmedia.com/...",
  "subreddit": "memes",
  "subreddit_name_prefixed": "r/memes",
  "permalink": "/r/memes/comments/1abc2de/...",
  "author": "reddit_username",
  "created_utc": 1706745600,
  "is_video": false,
  "post_hint": "image",
  "media": null,
  "preview": { "images": [...] },
  "is_gallery": false,
  "gallery_data": null,
  "media_metadata": null,
  "selftext": "",
  "domain": "i.redd.it",
  "likedAt": 1706832000000
}
```

#### Why Store Full Meme Data?

The full meme data is stored (denormalized) for several reasons:

1. **Offline Availability**: Liked memes can be displayed without fetching from Reddit API
2. **Data Persistence**: Reddit posts can be deleted; stored data remains accessible
3. **Performance**: No additional API calls needed to display liked content
4. **Simplicity**: Single query retrieves everything needed to render the UI

---

## Connection Configuration

The database connection is managed in [server/config/db.js](../server/config/db.js):

```javascript
const { MongoClient } = require('mongodb');

const MONGODB_URI = process.env.MONGODB_URI;
const DB_NAME = process.env.DB_NAME || 'twiix';

let client = null;
let db = null;

async function connectToDatabase() {
  if (db) return db;
  
  client = new MongoClient(MONGODB_URI);
  await client.connect();
  db = client.db(DB_NAME);
  return db;
}
```

### Environment Variables Required

| Variable | Description | Example |
|----------|-------------|---------|
| `MONGODB_URI` | MongoDB connection string | `mongodb+srv://user:pass@cluster.mongodb.net/` |
| `DB_NAME` | Database name | `twiix` |

---

## API Endpoints

The database is accessed through REST API endpoints defined in [server/routes/api.js](../server/routes/api.js):

### GET `/api/debug`

**Debug endpoint for verifying database connectivity and operations.**

Access this endpoint in your browser to get a visual diagnostic page showing:
- Database connection status
- Collection existence verification
- Write/Read/Delete operation tests
- Database statistics (total likes, seen memes, unique users)

**URL:** `https://your-domain.com/api/debug`

**Query Parameters:**
- `format=json` - Returns raw JSON instead of HTML page

**Example Response (JSON format):**
```json
{
  "timestamp": "2026-02-07T12:00:00.000Z",
  "environment": "production",
  "database": {
    "type": "MongoDB",
    "connected": true,
    "name": "twiix",
    "uri": "mongodb+srv://***:***@cluster.mongodb.net/",
    "error": null
  },
  "tests": {
    "connection": { "passed": true, "message": "...", "duration": 5 },
    "likesCollectionExists": { "passed": true, "message": "...", "duration": 3 },
    "seenMemesCollectionExists": { "passed": true, "message": "...", "duration": 2 },
    "writeTest": { "passed": true, "message": "...", "duration": 10 },
    "readTest": { "passed": true, "message": "...", "duration": 4 },
    "deleteTest": { "passed": true, "message": "...", "duration": 3 }
  },
  "stats": {
    "totalLikes": 150,
    "totalSeenMemes": 5000,
    "uniqueUsers": 25
  }
}
```

---

### GET `/api/likes/:userId`

Retrieves all likes for a specific user.

**MongoDB Query:**
```javascript
db.collection('likes')
  .find({ userId })
  .sort({ createdAt: -1 })
  .toArray()
```

**Response:** Array of meme data objects, ordered by most recently liked

---

### POST `/api/likes`

Adds a new like or updates existing like data.

**Request Body:**
```json
{
  "userId": "user_2abc123...",
  "meme": { /* meme data object */ }
}
```

**MongoDB Query:**
```javascript
db.collection('likes').updateOne(
  { userId, memeId },
  { $set: { userId, memeId, memeData: meme, createdAt: new Date() } },
  { upsert: true }
)
```

The `upsert: true` option ensures:
- New likes are inserted if they don't exist
- Existing likes are updated with new data

---

### DELETE `/api/likes/:userId/:memeId`

Removes a like from the database.

**MongoDB Query:**
```javascript
db.collection('likes').deleteOne({ userId, memeId })
```

---

## Data Flow Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        FRONTEND (React)                         │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                    LikesContext.jsx                       │  │
│  │  - Manages likes state                                    │  │
│  │  - Syncs with localStorage (fallback)                     │  │
│  │  - Calls backend API for authenticated users              │  │
│  └───────────────────────────────────────────────────────────┘  │
│                              │                                   │
│                    ┌─────────┴─────────┐                        │
│                    ▼                   ▼                        │
│            Authenticated         Anonymous                      │
│            (Clerk User)          (No Auth)                      │
└────────────────────┼───────────────────┼────────────────────────┘
                     │                   │
                     ▼                   ▼
              ┌──────────────┐    ┌──────────────┐
              │   Backend    │    │ localStorage │
              │   API        │    │ (Browser)    │
              └──────┬───────┘    └──────────────┘
                     │
                     ▼
              ┌──────────────┐
              │   MongoDB    │
              │   Atlas      │
              │              │
              │ ┌──────────┐ │
              │ │  likes   │ │
              │ │seen_memes│ │
              │ └──────────┘ │
              └──────────────┘
```

---

## Authentication Integration

### Clerk Authentication

The application uses **Clerk** for user authentication. The integration works as follows:

1. **Frontend**: `@clerk/clerk-react` provides `useUser()` hook
2. **User ID**: Clerk's `user.id` is used as `user_id` in the database
3. **Conditional Storage**:
   - **Signed In**: Data saved to MySQL via backend API
   - **Anonymous**: Data saved to browser's localStorage

### Dual Storage Strategy

The [LikesContext.jsx](../src/context/LikesContext.jsx) implements a fallback mechanism:

```javascript
if (isSignedIn && user) {
  // Fetch from backend API → MongoDB
  const response = await fetch(`/api/likes/${user.id}`);
  // ...
} else {
  // Use localStorage for anonymous users
  const storedLikes = localStorage.getItem('likes_anonymous');
  // ...
}
```

**Benefits:**
- Authenticated users get cross-device sync
- Anonymous users can still use the like feature locally
- Graceful degradation if backend is unavailable

---

## Database Initialization

The database collections and indexes are automatically created on server startup via `initializeDb()`:

```javascript
// server/index.js
const { initializeDb } = require('./config/db');

// Initialize Database
initializeDb();
```

The `initializeDb()` function creates indexes with `createIndex()`, which is idempotent and safe to run repeatedly.

---

## Performance Considerations

### Current Implementation

1. **Connection Reuse**: Single client connection reused across requests
2. **Native Document Storage**: No JSON parsing needed, native object storage
3. **Compound Indexes**: Fast lookups by `(userId, memeId)`
4. **Optimistic Updates**: UI updates immediately, API call happens async

### Potential Optimizations

1. **Pagination**: Currently fetches all likes at once; add skip/limit for large collections
2. **Caching**: Add Redis layer for frequently accessed user likes
3. **TTL Indexes**: Auto-expire old seen_memes records
4. **Sharding**: For very high traffic, consider sharding by userId

---

## Security Considerations

### Current Implementation

- **MongoDB Driver Protection**: Native driver handles query escaping
- **User Isolation**: Each user can only access their own likes (enforced by userId in queries)

### Recommendations

1. **Rate Limiting**: Add rate limiting to prevent abuse (currently only on Reddit API calls)
2. **Input Validation**: Validate meme data structure before storing
3. **Data Size Limits**: Limit document size to prevent storage attacks
4. **API Authentication**: Consider adding JWT/session validation for API endpoints

---

## Error Handling

The implementation includes basic error handling:

```javascript
try {
  const db = getDb();
  const likes = await db.collection('likes').find({ userId }).toArray();
  res.json(likes.map(l => l.memeData));
} catch (error) {
  console.error('Error fetching likes:', error);
  res.status(500).json({ error: 'Failed to fetch likes' });
}
```

Frontend handles errors gracefully by falling back to localStorage or showing empty state.

---

## Summary

| Aspect | Implementation |
|--------|----------------|
| **Database** | MongoDB Atlas with native `mongodb` driver |
| **Schema** | Two collections: `likes` and `seen_memes` |
| **Authentication** | Clerk user IDs |
| **Data Stored** | Full meme objects for offline display |
| **Sync Strategy** | Backend for auth users, localStorage for anonymous |
| **Query Safety** | Native MongoDB driver protection |
| **Initialization** | Auto-create indexes on startup |
