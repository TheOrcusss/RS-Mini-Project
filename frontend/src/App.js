import React, { useState } from 'react';
import axios from 'axios'; 
import SongRecommender from './SongRecommender';
import MoodRecommender from './MoodRecommender';
import SkeletonGrid from './SkeletonGrid'; 
import ResultsGrid from './ResultsGrid'; 
import { motion, AnimatePresence } from 'framer-motion'; 
import './App.css';

// Helper component for the Spotify Embed
const SpotifyEmbed = ({ trackId, height = 80 }) => {
    if (!trackId) {
        return <div className="spotify-embed-placeholder" style={{height: `${height}px`}}>Preview Not Available</div>;
    }
    const embedUrl = `https://open.spotify.com/embed/track/${trackId}`;
    return (
        <iframe
            src={embedUrl}
            width="100%"
            height={height}
            frameBorder="0"
            allowTransparency="true"
            allow="encrypted-media"
            title="spotify-player"
            style={{ borderRadius: '8px' }}
        ></iframe>
    );
};

// Modal Loader Component (Updated)
const ModalLoader = () => {
    return (
        <div className="modal-loader">
            {/* Placeholder for Album Art */}
            <div className="skeleton-line" style={{ height: '300px', width: '300px', margin: '0 auto 20px auto' }}></div>
            {/* Placeholder for Spotify Player */}
            <div className="skeleton-line" style={{ height: '80px', marginBottom: '20px' }}></div>
            {/* Placeholder for Text */}
            <div className="skeleton-line title" style={{ width: '60%', height: '24px' }}></div>
            <div className="skeleton-line text" style={{ width: '40%' }}></div>
        </div>
    );
};


function App() {
    const [mode, setMode] = useState('song');
    
    // State is lifted up
    const [results, setResults] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    
    // Modal State
    const [activeSong, setActiveSong] = useState(null);
    const [metadata, setMetadata] = useState(null); 
    const [modalLoading, setModalLoading] = useState(false); 

    // *** UPDATED: Function to open modal and fetch ALL data ***
    const handleCardClick = async (song) => {
        setActiveSong(song);
        setModalLoading(true);
        setMetadata(null); 

        // 1. Create all three API requests
        const metadataRequest = axios.get(`http://localhost:8000/api/spotify-metadata?trackId=${song.spotify_id}`);
        // This next one is from our "VibeCheck" idea, let's assume you added that endpoint
        const featuresRequest = axios.get(`http://localhost:8000/api/audio-features?trackId=${song.spotify_id}`);
        // The new Genius request
        const geniusRequest = axios.get(`http://localhost:8000/api/genius-info?song=${song.name}&artist=${song.artist}`);

        try {
            // 2. Run all three requests in parallel
            const [
                metadataRes, 
                featuresRes, 
                geniusRes
            ] = await Promise.all([
                metadataRequest, 
                featuresRequest, 
                geniusRequest
            ]);
            
            // 3. Combine all data into one state object
            setMetadata({
                ...metadataRes.data,
                ...featuresRes.data,
                ...geniusRes.data
            });

        } catch (err) {
            console.error("Failed to fetch all song data:", err);
            // If it fails, just show the basic info
            setMetadata({ name: song.name, artistName: song.artist }); 
        } finally {
            setModalLoading(false);
        }
    };

    // Function to close the modal
    const closeModal = () => {
        setActiveSong(null);
        setMetadata(null);
    };

    return (
        <div className="app-container">
            {/* === SIDEBAR (Unchanged) === */}
            <div className="sidebar">
                <header className="header">
                    <h1>VibeCheck 🎵</h1>
                    <p>Music Recommendation Engine</p>
                </header>

                <div className="toggle-buttons">
                    <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        className={mode === 'song' ? 'active' : ''}
                        onClick={() => setMode('song')}
                    >
                        Recommend by Song
                    </motion.button>
                    <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        className={mode === 'mood' ? 'active' : ''}
                        onClick={() => setMode('mood')}
                    >
                        Recommend by Mood
                    </motion.button>
                </div>

                <AnimatePresence mode="wait">
                    {mode === 'song' ? (
                        <motion.div
                            key="song"
                            initial={{ opacity: 0, x: -50 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -50 }}
                            transition={{ duration: 0.3 }}
                        >
                            <SongRecommender 
                                setResults={setResults}
                                setLoading={setLoading}
                                setError={setError}
                                setActiveSong={setActiveSong} 
                            />
                        </motion.div>
                    ) : (
                        <motion.div
                            key="mood"
                            initial={{ opacity: 0, x: -50 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -50 }}
                            transition={{ duration: 0.3 }}
                        >
                            <MoodRecommender 
                                setResults={setResults}
                                setLoading={setLoading}
                                setError={setError}
                                setActiveSong={setActiveSong} 
                            />
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* === MAIN CONTENT (RESULTS) === */}
            <div className="main-content">
                <AnimatePresence>
                    {loading && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                        >
                            <SkeletonGrid /> 
                        </motion.div>
                    )}
                    {error && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="error-container"
                        >
                            <h3>Error</h3>
                            <p>{error}</p>
                        </motion.div>
                    )}
                    {results && !loading && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                        >
                            <ResultsGrid 
                                data={results} 
                                onCardClick={handleCardClick} 
                            />
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* === MODAL (CHANGED) === */}
            <AnimatePresence>
                {activeSong && (
                    <motion.div
                        className="modal-backdrop"
                        onClick={closeModal} 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                    >
                        <motion.div
                            className="modal-content"
                            onClick={(e) => e.stopPropagation()}
                            initial={{ y: "100vh", opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            exit={{ y: "100vh", opacity: 0 }}
                            transition={{ type: "spring", damping: 20, stiffness: 300 }}
                        >
                            {/* Show loader OR content */}
                            {modalLoading ? (
                                <ModalLoader />
                            ) : (
                                <div className="modal-data">
                                    {metadata && metadata.albumArt && (
                                        <img src={metadata.albumArt} alt={metadata.albumName} className="modal-album-art" />
                                    )}
                                    <SpotifyEmbed trackId={activeSong.spotify_id} height="80" /> 
                                    <div className="modal-info">
                                        <h3>{metadata ? metadata.name : activeSong.name}</h3>
                                        <p>
                                            <strong>{metadata ? metadata.artistName : activeSong.artist}</strong>
                                            <br />
                                            {metadata ? metadata.albumName : `(${activeSong.year})`}
                                            {metadata && metadata.releaseDate && ` (${metadata.releaseDate.split('-')[0]})`}
                                        </p>

                                        {/* --- NEW: VIBECHECK FEATURES --- */}
                                        {metadata && metadata.energy && (
                                            <div className="vibe-check">
                                                <h4>VibeCheck™</h4>
                                                <VibeMeter label="Energy" value={metadata.energy} />
                                                <VibeMeter label="Danceability" value={metadata.danceability} />
                                                <VibeMeter label="Happiness" value={metadata.valence} />
                                            </div>
                                        )}

                                        {/* --- NEW: GENIUS HISTORY & LYRICS --- */}
                                        {metadata && metadata.description && (
                                            <div className="genius-info">
                                                <h4>About the Song</h4>
                                                <p className="modal-description">
                                                    {metadata.description}
                                                </p>
                                                <a 
                                                    href={metadata.geniusUrl} 
                                                    target="_blank" 
                                                    rel="noopener noreferrer" 
                                                    className="genius-button"
                                                >
                                                    View Full Lyrics & Annotations on Genius
                                                </a>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

// *** NEW: VibeMeter Component (for Spotify Features) ***
const VibeMeter = ({ label, value }) => {
    const percentage = Math.round(value * 100);
    return (
        <div className="vibe-meter">
            <div className="vibe-label">
                <span>{label}</span>
                <span>{percentage}%</span>
            </div>
            <div className="vibe-bar-background">
                <motion.div 
                    className="vibe-bar-foreground"
                    initial={{ width: 0 }}
                    animate={{ width: `${percentage}%` }}
                    transition={{ duration: 0.5, delay: 0.2 }}
                />
            </div>
        </div>
    );
};

export default App;