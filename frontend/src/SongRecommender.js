import React, { useState } from 'react'; // Removed useEffect, useCallback
import axios from 'axios';
import { motion } from 'framer-motion'; 
import { FaSearch } from 'react-icons/fa'; 

const API_URL = 'http://localhost:8000'; 
// const REC_COUNT = 12; // Removed

function SongRecommender({ setResults, setLoading, setError, setActiveSong }) {
    const [song, setSong] = useState('');
    const [artist, setArtist] = useState('');
    // const [numRecs, setNumRecs] = useState(REC_COUNT); // Removed

    // *** CHANGED: Simplified handleSubmit, removed 'loadMore' logic ***
    const handleSubmit = async (e) => {
        if (e) e.preventDefault(); 
        
        setLoading(true);
        setError('');
        setActiveSong(null); // Clear modal
        setResults(null); // Clear previous results
        
        try {
            const response = await axios.post(`${API_URL}/api/recommend-song`, {
                song_name: song,
                artist_name: artist
                // num_recommendations is no longer sent, Python will use its default
            });
            setResults(response.data);
        } catch (err) {
            setError(err.response?.data?.error || 'An unknown error occurred.');
            setResults(null);
        }
        setLoading(false);
    };

    // *** REMOVED: useEffect for loadMore event listener ***

    return (
        <div className="recommender">
            <h2>Find Songs Like...</h2>
            {/* *** REMOVED: id from form *** */}
            <form onSubmit={handleSubmit}> 
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