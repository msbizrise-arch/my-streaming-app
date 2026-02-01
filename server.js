// server.js
const express = require('express');
const cors = require('cors');
const path = require('path');
const proxyRoute = require('./routes/proxy');
const { encode } = require('./utils/crypto');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// API to Generate Encrypted Link
app.post('/api/generate-link', (req, res) => {
    const { originalUrl } = req.body;
    if (!originalUrl) return res.status(400).json({ error: 'URL required' });
    
    const encrypted = encode(originalUrl);
    // Returns the link to the player page
    res.json({ playbackUrl: `/player.html?v=${encrypted}` });
});

// The Stream Proxy Route
app.use('/stream', proxyRoute);

// Start Server
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Open http://localhost:${PORT} to start`);
});

