const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const axios = require('axios'); // To talk to our Python service

const app = express();
const PORT = process.env.PORT || 8000;

// --- Middleware ---
app.use(cors()); // Allow requests from React
app.use(express.json()); // Parse JSON bodies

// --- Configuration ---
// !!! REPLACE THIS WITH YOUR MONGODB ATLAS CONNECTION STRING !!!
const MONGO_URI = 'mongodb+srv://smayankulkarni05_db_user:i4qU47VqhPcdF9ED@cluster0.gqordau.mongodb.net/?appName=Cluster0';
const PYTHON_ML_SERVICE_URL = 'http://127.0.0.1:5000'; // Our Flask server

// --- MongoDB Connection ---
mongoose.connect(MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
})
.then(() => console.log('MongoDB connected successfully.'))
.catch(err => console.error('MongoDB connection error:', err));


// --- API Routes ---

// 1. Route to get song-based recommendations
app.post('/api/recommend-song', async (req, res) => {
    try {
        const { song_name, artist_name } = req.body;
        
        // Forward the request to the Python ML service
        const response = await axios.post(`${PYTHON_ML_SERVICE_URL}/recommend-song`, {
            song_name,
            artist_name
        });
        
        // Return the results from the Python service
        res.json(response.data);
        
    } catch (error) {
        if (error.response) {
            res.status(error.response.status).json(error.response.data);
        } else {
            res.status(500).json({ error: 'Error communicating with ML service.' });
        }
    }
});

// 2. Route to get mood-based recommendations
app.post('/api/recommend-mood', async (req, res) => {
    try {
        const { mood, tags } = req.body;
        
        // Forward the request to the Python ML service
        const response = await axios.post(`${PYTHON_ML_SERVICE_URL}/recommend-mood`, {
            mood,
            tags
        });
        
        res.json(response.data);
        
    } catch (error) {
        if (error.response) {
            res.status(error.response.status).json(error.response.data);
        } else {
            res.status(500).json({ error: 'Error communicating with ML service.' });
        }
    }
});

// --- Start Server ---
app.listen(PORT, () => {
    console.log(`Node.js server running on http://localhost:${PORT}`);
});