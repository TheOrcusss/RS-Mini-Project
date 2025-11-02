// Import useEffect and useCallback
import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { motion } from 'framer-motion'; 
import { FaSmileBeam } from 'react-icons/fa'; 

const API_URL = 'http://localhost:8000';
const moods = ["happy", "sad", "chill", "energetic", "live", "romantic"];
const REC_COUNT = 12;

function MoodRecommender({ setResults, setLoading, setError, setActiveSong }) {
    const [mood, setMood] = useState('happy');
    const [tags, setTags] = useState('');
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
        setNumRecs(count);
        
        const tagsArray = tags.split(',').map(tag => tag.trim()).filter(tag => tag);
        
        try {
            const response = await axios.post(`${API_URL}/api/recommend-mood`, {
                mood: mood,
                tags: tagsArray,
                num_recommendations: count 
            });
            setResults(response.data);
        } catch (err) {
            setError(err.response?.data?.error || 'An unknown error occurred.');
            setResults(null);
        }
        setLoading(false);
    // *** CHANGED: Add all dependencies for useCallback ***
    }, [mood, tags, numRecs, setResults, setLoading, setError, setActiveSong]);

    // This event listener now correctly uses the stable handleSubmit function
    useEffect(() => {
        const form = document.getElementById('mood-recommender-form');
        // This function wrapper ensures it calls the *latest* handleSubmit
        const handleLoadMore = () => handleSubmit(null, true);
        
        if (form) { // Check if form exists
            form.addEventListener('loadMore', handleLoadMore);
            return () => form.removeEventListener('loadMore', handleLoadMore);
        }
    }, [handleSubmit]); // This dependency is now stable

    return (
        <div className="recommender">
            <h2>Find Songs For Your Mood...</h2>
            <form onSubmit={handleSubmit} id="mood-recommender-form">
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