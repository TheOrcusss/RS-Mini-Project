import React, { useState } from 'react';
import SongRecommender from './SongRecommender';
import MoodRecommender from './MoodRecommender';
import SkeletonGrid from './SkeletonGrid';
import ResultsGrid from './ResultsGrid';

import { motion, AnimatePresence } from 'framer-motion'; 
import './App.css';

function App() {
    const [mode, setMode] = useState('song');
    
    // This state will be lifted up
    const [results, setResults] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [activeSong, setActiveSong] = useState(null);

    return (
        <div className="app-container">
            {/* === SIDEBAR === */}
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

                {/* Render forms based on mode */}
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
                            <SkeletonGrid /> {/* New Skeleton Loader */}
                        </motion.div>
                    )}
                    {error && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="error-container" // Full page error
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
                            {/* We now pass the 'setter' for "Load More" */}
                            <ResultsGrid 
                                data={results} 
                                setActiveSong={setActiveSong} 
                            />
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* === MODAL (UNCHANGED LOGIC) === */}
            <AnimatePresence>
                {activeSong && (
                    <motion.div
                        className="modal-backdrop"
                        onClick={() => setActiveSong(null)}
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
                            <SpotifyEmbed trackId={activeSong.spotify_id} height="352" />
                            <h3>{activeSong.name}</h3>
                            <p>{activeSong.artist} ({activeSong.year})</p>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

// Helper (we can put this here)
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

export default App;