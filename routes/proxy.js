// routes/proxy.js
const express = require('express');
const axios = require('axios');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const { decode } = require('../utils/crypto');

// Load Token
const tokenData = JSON.parse(fs.readFileSync(path.join(__dirname, '../token.json'), 'utf8'));
const AUTH_TOKEN = tokenData.authToken;

router.get('/', async (req, res) => {
    try {
        const encryptedUrl = req.query.url;
        if (!encryptedUrl) return res.status(400).send('No URL provided');

        // 1. Decrypt the Source URL
        let sourceUrl;
        try {
            sourceUrl = decode(encryptedUrl);
        } catch (e) {
            // Fallback if not encrypted or sub-segment request
            sourceUrl = encryptedUrl; 
        }

        // Validate URL
        if (!sourceUrl.startsWith('http')) {
            return res.status(400).send('Invalid URL');
        }

        // 2. Setup Headers (Inject Token)
        const headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Authorization': `Bearer ${AUTH_TOKEN}`,
            'Referer': 'https://physicswallah.com/', // Setup referer to bypass simple checks
            'Origin': 'https://physicswallah.com'
        };

        // 3. Fetch Data from CloudFront
        const response = await axios({
            method: 'get',
            url: sourceUrl,
            responseType: 'stream',
            headers: headers,
            validateStatus: (status) => status < 500 // Handle 404s gracefully
        });

        // Set Content Type
        res.set('Content-Type', response.headers['content-type']);
        res.set('Access-Control-Allow-Origin', '*'); // Allow playback on your site

        // 4. Handle M3U8 Playlist rewriting (Fixing CORS for segments)
        if (sourceUrl.includes('.m3u8')) {
            let m3u8Content = '';
            response.data.on('data', (chunk) => { m3u8Content += chunk; });
            
            response.data.on('end', () => {
                // Get the Base URL (remove the filename from the end)
                const baseUrl = sourceUrl.substring(0, sourceUrl.lastIndexOf('/') + 1);
                
                // Rewrite logic: Find all .ts or .key or sub-.m3u8 files and route them through our proxy
                // The regex captures lines that don't start with # (URLs)
                const lines = m3u8Content.toString().split('\n');
                const rewrittenLines = lines.map(line => {
                    if (line.trim() && !line.startsWith('#')) {
                        // It's a URL (segment or key)
                        let absoluteUrl = line.startsWith('http') ? line : baseUrl + line;
                        // Recursively proxy this segment
                        // We do NOT encrypt segment URLs to save CPU, just direct pass
                        return `${req.protocol}://${req.get('host')}/stream?url=${encodeURIComponent(absoluteUrl)}`;
                    }
                    return line;
                });

                const finalM3u8 = rewrittenLines.join('\n');
                res.send(finalM3u8);
            });
        } else {
            // 5. Direct Pipe for TS segments (Video data)
            response.data.pipe(res);
        }

    } catch (error) {
        console.error("Proxy Error:", error.message);
        res.status(500).send("Stream Error");
    }
});

module.exports = router;

