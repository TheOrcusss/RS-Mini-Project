// Import useEffect and useCallback
import React, { useState, useEffect, useCallback } from 'react'; 
import axios from 'axios';
import { motion } from 'framer-motion'; 
import { FaSearch } from 'react-icons/fa'; 

const API_URL = 'http://localhost:8000'; 
const REC_COUNT = 12;

function SongRecommender({ setResults, setLoading, setError, setActiveSong }) {
    const [song, setSong] = useState('');
    const [artist, setArtist] = useState('');
    const [numRecs, setNumRecs] = useState(REC_COUNT);

    // *** CHANGED: Wrap handleSubmit in useCallback ***
    const handleSubmit = useCallback(async (e, loadMore = false) => {
        if (e) e.preventDefault(); 
        
        let count = REC_COUNT;
        // *** FIXED: Base the new count on the *current* numRecs state ***
        if (loadMore) {
            count = numRecs + REC_COUNT; 
        } else {
            setResults(null); 
        }
        
        setLoading(true);
        setError('');
        setActiveSong(null);
        setNumRecs(count); // Set the new count
        
        try {
            const response = await axios.post(`${API_URL}/api/recommend-song`, {
                song_name: song,
                artist_name: artist,
                num_recommendations: count 
            });
            setResults(response.data);
        } catch (err) {
            setError(err.response?.data?.error || 'An unknown error occurred.');
            setResults(null);
        }
        setLoading(false);
    // *** CHANGED: Add all dependencies for useCallback ***
    }, [song, artist, numRecs, setResults, setLoading, setError, setActiveSong]);


    // This event listener now correctly uses the stable handleSubmit function
    useEffect(() => {
        const form = document.getElementById('song-recommender-form');
        // This function wrapper ensures it calls the *latest* handleSubmit
        const handleLoadMore = () => handleSubmit(null, true);
        
        if (form) { // Check if form exists
            form.addEventListener('loadMore', handleLoadMore);
            return () => form.removeEventListener('loadMore', handleLoadMore);
        }
    }, [handleSubmit]); // This dependency is now stable

    return (
        <div className="recommender">
            <h2>Find Songs Like...</h2>
            <form onSubmit={handleSubmit} id="song-recommender-form">
                <div className="form-group">
                    <label htmlFor="song">Song Name</label>
                    <input 
                        type="text" 
                        id="song" 
                        value={song} 
                        onChange={(e) => setSong(e.target.value)} 
                        placeholder="e.g., Smells Like Teen Spirit"
                        required 
                    />
                </div>
                <div className="form-group">
                    <label htmlFor="artist">Artist Name</label>
                    <input 
                        type="text" 
                        id="artist" 
                        value={artist} 
                        onChange={(e) => setArtist(e.target.value)} 
                        placeholder="e.g., Nirvana"
                        required 
                    />
                </div>
                <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    type="submit"
                    className="submit-button" 
                >
                    <FaSearch style={{ marginRight: '8px' }} /> 
                    Get Recommendations
                </motion.button>
            </form>
        </div>
    );
}

export default SongRecommender;