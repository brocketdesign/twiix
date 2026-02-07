const express = require('express');
const path = require('path');
require('dotenv').config();
const cors = require('cors');
const apiRoutes = require('./server/routes/api');
const { initializeDb } = require('./server/config/db');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// API Routes - must come before static file serving
app.use('/api', apiRoutes);

// Serve static files from the React build
app.use(express.static(path.join(__dirname, 'build')));

// For any request that doesn't match a static file or API route, send the index.html
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'build', 'index.html'));
});

// Initialize database before accepting requests
initializeDb()
  .then(() => {
    console.log('Database tables initialized');
    app.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error('Failed to initialize database:', err);
    process.exit(1);
  });
