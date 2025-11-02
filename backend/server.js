const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const axios = require('axios');
require('dotenv').config(); 

const app = express();
const PORT = process.env.PORT || 8000;

app.use(cors());
app.use(express.json());

const MONGO_URI = 'mongodb+srv://<username>:<password>@cluster0.xxxxx.mongodb.net/musicDB?retryWrites=true&w=majority';
const PYTHON_ML_SERVICE_URL = 'http://127.0.0.1:5000';

// --- Spotify API Setup ---
const SPOTIFY_CLIENT_ID = process.env.SPOTIFY_CLIENT_ID;
const SPOTIFY_CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET;
let spotifyToken = { value: null, expiresAt: null };

// --- Genius API Setup ---
const GENIUS_ACCESS_TOKEN = process.env.GENIUS_ACCESS_TOKEN;
const GENIUS_API_URL = 'https://api.genius.com'; 

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


// *** CHANGED: Genius Info Endpoint (This is the fix) ***
app.get('/api/genius-info', async (req, res) => {
    const { song, artist } = req.query;
    if (!song || !artist) {
        return res.status(400).json({ error: 'Song and artist are required' });
    }

    if (!GENIUS_ACCESS_TOKEN) {
        console.error("Genius Access Token is missing. Check your .env file.");
        return res.status(500).json({ error: 'Genius API key not configured on server.' });
    }

    try {
        // 1. Search for the song on Genius
        const searchQuery = encodeURIComponent(`${song} ${artist}`);
        const searchResponse = await axios.get(`${GENIUS_API_URL}/search?q=${searchQuery}`, {
            headers: { 'Authorization': `Bearer ${GENIUS_ACCESS_TOKEN}` }
        });

        // 2. Find the first (best) hit
        const hits = searchResponse.data.response.hits;
        if (!hits || hits.length === 0 || !hits[0].result) {
            return res.status(404).json({ error: 'Song not found on Genius' });
        }
        
        const songId = hits[0].result.id;

        // 3. Get the full song details using the ID
        const songResponse = await axios.get(`${GENIUS_API_URL}/songs/${songId}`, {
            headers: { 'Authorization': `Bearer ${GENIUS_ACCESS_TOKEN}` }
        });

        if (!songResponse.data || !songResponse.data.response || !songResponse.data.response.song) {
            return res.status(404).json({ error: 'Could not get song details from Genius' });
        }
        
        const songData = songResponse.data.response.song;

        // 4. *** THIS IS THE CRITICAL FIX ***
        // We will find the *correct* annotation, which is the "description_annotation"
        let description = 'No description available for this song.'; // Default
        
        try {
            // Find the annotation that is the "description"
            const descriptionAnnotation = songData.description_annotation;

            // Now, safely extract the 'plain' text from its body
            if (descriptionAnnotation && 
                descriptionAnnotation.annotations && 
                descriptionAnnotation.annotations.length > 0 &&
                descriptionAnnotation.annotations[0].body &&
                descriptionAnnotation.annotations[0].body.plain) {
                
                description = descriptionAnnotation.annotations[0].body.plain;
            }
        } catch (e) {
            // This catch block prevents a server crash if the path is broken
            console.log("Could not parse Genius description, using default.", e.message);
        }

        res.json({
            description: description,
            geniusUrl: songData.url
        });

    } catch (error) {
        console.error('Error fetching Genius info:', error.response ? error.response.data : error.message);
        res.status(500).json({ error: 'Failed to fetch Genius info. Check backend logs and API keys.' });
    }
});


// --- Start Server ---
app.listen(PORT, () => {
    console.log(`Node.js server running on http://localhost:${PORT}`);
});