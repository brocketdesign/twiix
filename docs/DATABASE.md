# Database Implementation Documentation

## Overview

The Reddit Meme Gallery application uses **MySQL** as its database system to persist user likes across sessions and devices. The database implementation follows a simple, focused design that stores only the essential data needed for the likes feature.

---

## Technology Stack

| Component | Technology |
|-----------|------------|
| Database | MySQL |
| Driver | `mysql2/promise` (Node.js) |
| Connection | Connection Pool |
| ORM | None (Raw SQL queries) |

---

## Database Schema

### Table: `likes`

The application uses a single table to store all user likes:

```sql
CREATE TABLE IF NOT EXISTS likes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL,
  meme_id VARCHAR(255) NOT NULL,
  meme_data JSON NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY user_meme (user_id, meme_id)
)
```

#### Column Descriptions

| Column | Type | Description |
|--------|------|-------------|
| `id` | INT (AUTO_INCREMENT) | Primary key, auto-incremented unique identifier |
| `user_id` | VARCHAR(255) | Clerk authentication user ID (e.g., `user_2abc123...`) |
| `meme_id` | VARCHAR(255) | Reddit post ID (e.g., `1ab2cd3`) |
| `meme_data` | JSON | Complete meme data object stored as JSON |
| `created_at` | TIMESTAMP | Timestamp when the like was created |

#### Constraints

- **Primary Key**: `id` - Ensures each row is uniquely identifiable
- **Unique Composite Key**: `(user_id, meme_id)` - Prevents duplicate likes from the same user for the same meme

---

## What Data is Stored

### User Identification

The `user_id` comes from **Clerk Authentication**. When a user signs in via Clerk (Google, email, etc.), their unique Clerk user ID is used to identify them in the database.

### Meme Data Structure

The `meme_data` JSON column stores the complete meme object with the following fields:

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

The database connection is managed through a connection pool configured in [server/config/db.js](../server/config/db.js):

```javascript
const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});
```

### Environment Variables Required

| Variable | Description | Default |
|----------|-------------|---------|
| `DB_HOST` | MySQL server hostname | `localhost` |
| `DB_USER` | MySQL username | Required |
| `DB_PASSWORD` | MySQL password | Required |
| `DB_NAME` | Database name | Required |

### Connection Pool Settings

| Setting | Value | Purpose |
|---------|-------|---------|
| `waitForConnections` | `true` | Queue requests when no connections available |
| `connectionLimit` | `10` | Maximum concurrent connections |
| `queueLimit` | `0` | Unlimited queue (0 = no limit) |

---

## API Endpoints

The database is accessed through REST API endpoints defined in [server/routes/api.js](../server/routes/api.js):

### GET `/api/likes/:userId`

Retrieves all likes for a specific user.

**Logic:**
```sql
SELECT meme_data FROM likes WHERE user_id = ? ORDER BY created_at DESC
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

**Logic:**
```sql
INSERT INTO likes (user_id, meme_id, meme_data) 
VALUES (?, ?, ?) 
ON DUPLICATE KEY UPDATE meme_data = ?
```

The `ON DUPLICATE KEY UPDATE` clause ensures:
- New likes are inserted normally
- Re-liking an already-liked meme updates the stored data (upsert pattern)

---

### DELETE `/api/likes/:userId/:memeId`

Removes a like from the database.

**Logic:**
```sql
DELETE FROM likes WHERE user_id = ? AND meme_id = ?
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
              │    MySQL     │
              │   Database   │
              │              │
              │ ┌──────────┐ │
              │ │  likes   │ │
              │ │  table   │ │
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
  // Fetch from backend API → MySQL
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

The database table is automatically created on server startup via `initializeDb()`:

```javascript
// server/index.js
const { initializeDb } = require('./config/db');

// Initialize Database
initializeDb();
```

The `initializeDb()` function uses `CREATE TABLE IF NOT EXISTS`, making it safe to run repeatedly without data loss.

---

## Performance Considerations

### Current Implementation

1. **Connection Pooling**: Reuses connections, reducing overhead
2. **JSON Storage**: Avoids complex JOINs, single-table queries
3. **Composite Index**: Fast lookups by `(user_id, meme_id)`
4. **Optimistic Updates**: UI updates immediately, API call happens async

### Potential Optimizations

1. **Pagination**: Currently fetches all likes at once; add LIMIT/OFFSET for large collections
2. **Caching**: Add Redis layer for frequently accessed user likes
3. **Data Pruning**: Consider archiving very old likes or implementing soft delete
4. **Read Replicas**: For high traffic, use MySQL read replicas

---

## Security Considerations

### Current Implementation

- **Parameterized Queries**: All SQL uses parameterized queries to prevent SQL injection
- **User Isolation**: Each user can only access their own likes (enforced by user_id in queries)

### Recommendations

1. **Rate Limiting**: Add rate limiting to prevent abuse (currently only on Reddit API calls)
2. **Input Validation**: Validate meme data structure before storing
3. **Data Size Limits**: Limit JSON payload size to prevent storage attacks
4. **API Authentication**: Consider adding JWT/session validation for API endpoints

---

## Error Handling

The implementation includes basic error handling:

```javascript
try {
  const likes = await query('SELECT ...', [userId]);
  res.json(likes.map(l => l.meme_data));
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
| **Database** | MySQL with `mysql2/promise` |
| **Schema** | Single `likes` table with JSON storage |
| **Authentication** | Clerk user IDs |
| **Data Stored** | Full meme objects for offline display |
| **Sync Strategy** | Backend for auth users, localStorage for anonymous |
| **Query Safety** | Parameterized queries |
| **Initialization** | Auto-create table on startup |
