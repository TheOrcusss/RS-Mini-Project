const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const axios = require('axios');
require('dotenv').config();
const { Client } = require('genius-lyrics'); 

const app = express();
const PORT = process.env.PORT || 8000;

app.use(cors());
app.use(express.json());

const MONGO_URI = process.env.MONGO_URI; 
const PYTHON_ML_SERVICE_URL = 'https://rs-mini-project-1.onrender.com';

// --- Spotify API Setup ---
const SPOTIFY_CLIENT_ID = process.env.SPOTIFY_CLIENT_ID;
const SPOTIFY_CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET;
let spotifyToken = { value: null, expiresAt: null };

// --- Genius API Setup ---
const GENIUS_ACCESS_TOKEN = process.env.GENIUS_ACCESS_TOKEN;
const geniusClient = GENIUS_ACCESS_TOKEN ? new Client(GENIUS_ACCESS_TOKEN) : null;

// Function to get a new Spotify token (Unchanged)
const getSpotifyToken = async () => {
    try {
        const response = await axios({
            method: 'post',
            url: 'https://accounts.spotify.com/api/token',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Authorization': 'Basic ' + (Buffer.from(SPOTIFY_CLIENT_ID + ':' + SPOTIFY_CLIENT_SECRET).toString('base64'))
            },
            data: 'grant_type=client_credentials'
        });
        const { access_token, expires_in } = response.data;
        spotifyToken = {
            value: access_token,
            expiresAt: Date.now() + (expires_in - 300) * 1000 
        };
        console.log("New Spotify token fetched!");
        return access_token;
    } catch (error) {
        console.error('Error fetching Spotify token:', error.response ? error.response.data : error.message);
        throw new Error('Failed to get Spotify token');
    }
};

// Middleware to ensure we have a valid token (Unchanged)
const ensureValidToken = async () => {
    if (!spotifyToken.value || Date.now() >= spotifyToken.expiresAt) {
        await getSpotifyToken();
    }
    return spotifyToken.value;
};

// --- MongoDB Connection (Unchanged) ---
mongoose.connect(MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
})
.then(() => console.log('MongoDB connected successfully.'))
.catch(err => console.error('MongoDB connection error:', err));


// --- API Routes ---

// Recommendation routes (Unchanged)
app.post('/api/recommend-song', async (req, res) => {
    try {
        const response = await axios.post(`${PYTHON_ML_SERVICE_URL}/recommend-song`, req.body);
        res.json(response.data);
    } catch (error) {
        if (error.response) { res.status(error.response.status).json(error.response.data); } 
        else { res.status(500).json({ error: 'Error communicating with ML service.' }); }
    }
});
app.post('/api/recommend-mood', async (req, res) => {
    try {
        const response = await axios.post(`${PYTHON_ML_SERVICE_URL}/recommend-mood`, req.body);
        res.json(response.data);
    } catch (error) {
        if (error.response) { res.status(error.response.status).json(error.response.data); }
        else { res.status(500).json({ error: 'Error communicating with ML service.' }); }
    }
});

// Spotify metadata endpoint (Unchanged)
app.get('/api/spotify-metadata', async (req, res) => {
    const { trackId } = req.query;
    if (!trackId) { return res.status(400).json({ error: 'Track ID is required' }); }
    try {
        const token = await ensureValidToken();
        const response = await axios.get(`https://api.spotify.com/v1/tracks/${trackId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const { name, album, artists } = response.data;
        res.json({
            name: name,
            albumName: album.name,
            releaseDate: album.release_date,
            albumArt: album.images[0] ? album.images[0].url : null,
            artistName: artists[0] ? artists[0].name : 'Unknown Artist'
        });
    } catch (error) {
        console.error('Error fetching Spotify metadata:', error.response ? error.response.data : error.message);
        res.status(500).json({ error: 'Failed to fetch Spotify metadata' });
    }
});

// Spotify Audio Features endpoint (Unchanged)
app.get('/api/audio-features', async (req, res) => {
    const { trackId } = req.query;
    if (!trackId) {
        return res.status(400).json({ error: 'Track ID is required' });
    }
    try {
        const token = await ensureValidToken();
        const response = await axios.get(`https://open.spotify.com/embed/track/${trackId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const { danceability, energy, valence, acousticness, instrumentalness } = response.data;
        res.json({
            danceability,
            energy,
            valence,
            acousticness,
            instrumentalness
        });
    } catch (error) {
        console.error('Error fetching audio features:', error.response ? error.response.data : error.message);
        res.status(500).json({ error: 'Failed to fetch audio features' });
    }
});


// *** CHANGED: Genius Info Endpoint (re-added, but simplified) ***
app.get('/api/genius-info', async (req, res) => {
    const { song, artist } = req.query;
    if (!song || !artist) {
        return res.status(400).json({ error: 'Song and artist are required' });
    }

    if (!geniusClient) {
        console.error("Genius Access Token is missing. Check your .env file.");
        return res.status(500).json({ error: 'Genius API key not configured on server.' });
    }

    try {
        // 1. Use the library's search method
        const searchQuery = `${song} ${artist}`;
        const songs = await geniusClient.songs.search(searchQuery);

        if (!songs || songs.length === 0) {
            return res.status(404).json({ error: 'Song not found on Genius' });
        }

        // 2. Get the first song (most likely match)
        const songData = songs[0];
        
        // 3. ONLY send back the URL
        res.json({
            geniusUrl: songData.url
        });

    } catch (error) {
        console.error('Error fetching Genius info with genius-lyrics:', error.message);
        res.status(500).json({ error: 'Failed to fetch Genius info. Check backend logs.' });
    }
});


// --- Start Server ---
app.listen(PORT, () => {
    console.log(`Node.js server running on http://localhost:${PORT}`);
});
