const express = require('express');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const apiRoutes = require('./routes/api');
const { initializeDb } = require('./config/db');

const app = express();
const PORT = process.env.PORT || 6000;

// Initialize Database
initializeDb().then(() => {
  console.log('Database tables initialized');
}).catch(err => {
  console.error('Failed to initialize database:', err);
});

// Middleware
app.use(express.json());

// API routes
app.use('/api', apiRoutes);

// Serve static files in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../client/build')));
  
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../client/build/index.html'));
  });
}

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
