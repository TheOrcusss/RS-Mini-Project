import React, { useState } from 'react'; 
import axios from 'axios';
import { motion } from 'framer-motion'; 
import { FaSearch } from 'react-icons/fa'; 

const API_URL = 'http://localhost:8000'; 

// *** CHANGED: Accept setHasSearched prop ***
function SongRecommender({ setResults, setLoading, setError, setActiveSong, setHasSearched }) {
    const [song, setSong] = useState('');
    const [artist, setArtist] = useState('');

    const handleSubmit = async (e) => {
        if (e) e.preventDefault(); 
        
        // *** NEW: Trigger the animation ***
        setHasSearched(true); 
        
        setLoading(true);
        setError('');
        setActiveSong(null); 
        setResults(null); 
        
        try {
            const response = await axios.post(`${API_URL}/api/recommend-song`, {
                song_name: song,
                artist_name: artist
            });
            setResults(response.data);
        } catch (err) {
            setError(err.response?.data?.error || 'An unknown error occurred.');
            setResults(null);
        }
        setLoading(false);
    };

    return (
        <div className="recommender">
            <h2>Find Songs Like...</h2>
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