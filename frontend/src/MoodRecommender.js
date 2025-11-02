import React, { useState } from 'react'; // Removed useEffect, useCallback
import axios from 'axios';
import { motion } from 'framer-motion'; 
import { FaSmileBeam } from 'react-icons/fa'; 

const API_URL = 'http://localhost:8000';
const moods = ["happy", "sad", "chill", "energetic", "live", "romantic"];
// const REC_COUNT = 12; // Removed

function MoodRecommender({ setResults, setLoading, setError, setActiveSong }) {
    const [mood, setMood] = useState('happy');
    const [tags, setTags] = useState('');
    // const [numRecs, setNumRecs] = useState(REC_COUNT); // Removed

    // *** CHANGED: Simplified handleSubmit, removed 'loadMore' logic ***
    const handleSubmit = async (e) => {
        if (e) e.preventDefault();
        
        setLoading(true);
        setError('');
        setActiveSong(null); // Clear modal
        setResults(null); // Clear previous results
        
        const tagsArray = tags.split(',').map(tag => tag.trim()).filter(tag => tag);
        
        try {
            const response = await axios.post(`${API_URL}/api/recommend-mood`, {
                mood: mood,
                tags: tagsArray
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
            <h2>Find Songs For Your Mood...</h2>
            {/* *** REMOVED: id from form *** */}
            <form onSubmit={handleSubmit}>
                <div className="form-group">
                    <label htmlFor="mood">Select Mood</label>
                    <select id="mood" value={mood} onChange={(e) => setMood(e.target.value)}>
                        {moods.map(m => <option key={m} value={m}>{m.charAt(0).toUpperCase() + m.slice(1)}</option>)}
                    </select>
                </div>
                <div className="form-group">
                    <label htmlFor="tags">Tags (optional, comma-separated)</label>
                    <input 
                        type="text" 
                        id="tags" 
                        value={tags} 
                        onChange={(e) => setTags(e.target.value)} 
                        placeholder="e.g., rock, indie, electronic"
                    />
                </div>
                <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    type="submit"
                    className="submit-button"
                >
                    <FaSmileBeam style={{ marginRight: '8px' }} /> 
                    Get Recommendations
                </motion.button>
            </form>
        </div>
    );
}

export default MoodRecommender;