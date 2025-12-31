const express = require('express');
const { getGif } = require('redgif');
const path = require('path');
const cors = require('cors');
const apiRoutes = require('./routes/api');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// API Routes
app.use('/api', apiRoutes);

// RedGifs endpoint
app.get('/api/redgifs/:id', async (req, res) => {
  try {
    const gifId = req.params.id;
    console.log(`Fetching RedGif: ${gifId}`);
    
    // Get the video data using getGif - it returns a buffer with the actual video content
    const videoBuffer = await getGif(gifId);
    console.log('Received buffer of size:', videoBuffer.length, 'bytes');
    
    // Option 1: Serve the video directly with proper headers
    res.set('Content-Type', 'video/mp4');
    res.set('Content-Length', videoBuffer.length);
    res.set('Cache-Control', 'public, max-age=31536000'); // Cache for a year
    return res.send(videoBuffer);
    
    /* 
    // Option 2: Create a base64 data URL (could be inefficient for large videos)
    const base64Video = videoBuffer.toString('base64');
    const dataUrl = `data:video/mp4;base64,${base64Video}`;
    return res.json({ url: dataUrl });
    */
  } catch (error) {
    console.error('Error fetching RedGifs data:', error);
    res.status(500).json({ error: 'Failed to fetch RedGifs video' });
  }
});

// Serve static assets in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../build')));
  app.get('*', (req, res) => {
    res.sendFile(path.resolve(__dirname, '../build', 'index.html'));
  });
}

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
