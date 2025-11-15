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

// Modal Loader Component
const ModalLoader = () => {
    return (
        <div className="modal-loader">
            <div className="skeleton-line" style={{ height: '300px', width: '300px', margin: '0 auto 20px auto' }}></div>
            <div className="skeleton-line" style={{ height: '80px', marginBottom: '20px' }}></div>
            <div className="skeleton-line title" style={{ width: '60%', height: '24px' }}></div>
            <div className="skeleton-line text" style={{ width: '40%' }}></div>
        </div>
    );
};


function App() {
    const [mode, setMode] = useState('song');
    const [results, setResults] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [activeSong, setActiveSong] = useState(null);
    const [metadata, setMetadata] = useState(null); 
    const [modalLoading, setModalLoading] = useState(false); 

    // *** NEW: State to control the layout ***
    const [hasSearched, setHasSearched] = useState(false);

    // Function to open the modal
    const handleCardClick = async (song) => {
        setActiveSong(song);
        setModalLoading(true);
        setMetadata(null); 

        const metadataRequest = axios.get(`https://rs-mini-project.onrender.com/api/spotify-metadata?trackId=${song.spotify_id}`);
        const featuresRequest = axios.get(`https://rs-mini-project.onrender.com/api/audio-features?trackId=${song.spotify_id}`);
        const geniusRequest = axios.get(`https://rs-mini-project.onrender.com/api/genius-info?song=${song.name}&artist=${song.artist}`);

        const [
            metadataResult,
            featuresResult,
            geniusResult
        ] = await Promise.allSettled([
            metadataRequest,
            featuresRequest,
            geniusRequest
        ]);

        let combinedData = { name: song.name, artistName: song.artist };
        if (metadataResult.status === 'fulfilled') {
            combinedData = { ...combinedData, ...metadataResult.value.data };
        }
        if (featuresResult.status === 'fulfilled') {
            combinedData = { ...combinedData, ...featuresResult.value.data };
        }
        if (geniusResult.status === 'fulfilled') {
            combinedData = { ...combinedData, ...geniusResult.value.data };
        }
        
        setMetadata(combinedData);
        setModalLoading(false);
    };

    // Function to close the modal
    const closeModal = () => {
        setActiveSong(null);
        setMetadata(null);
    };

    return (
        <div className={`app-container ${hasSearched ? 'has-searched' : ''}`}>
            
            {/* === SIDEBAR === */}
            <motion.div 
                className="sidebar" 
                layout // This prop tells framer-motion to animate the layout change
                transition={{ duration: 0.7, ease: [0.32, 0.72, 0, 1] }} 
            >
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
                                setHasSearched={setHasSearched} // Pass the setter
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
                                setHasSearched={setHasSearched} // Pass the setter
                            />
                        </motion.div>
                    )}
                </AnimatePresence>
            </motion.div> 

            {/* === MAIN CONTENT (RESULTS) === */}
            <AnimatePresence>
                {hasSearched && (
                    <motion.div 
                        className="main-content"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ duration: 0.5, delay: 0.3 }} // Delay to let sidebar move
                    >
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
                                    style={{ display: 'flex', flexDirection: 'column', flexGrow: 1 }}
                                >
                                    <ResultsGrid 
                                        data={results} 
                                        onCardClick={handleCardClick} 
                                    />
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* === MODAL === */}
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
                                        {metadata && metadata.energy && (
                                            <div className="vibe-check">
                                                <h4>VibeCheck™</h4>
                                                <VibeMeter label="Energy" value={metadata.energy} />
                                                <VibeMeter label="Danceability" value={metadata.danceability} />
                                                <VibeMeter label="Happiness" value={metadata.valence} />
                                            </div>
                                        )}
                                        {metadata && metadata.geniusUrl && (
                                            <div className="genius-info">
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

// VibeMeter Component
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
                    style={{ 
                        backgroundColor: percentage > 85 ? '#1DB954' : percentage > 70 ? '#FFFB65' : '#ff6b6b'
                    }}
                    initial={{ width: 0 }}
                    animate={{ width: `${percentage}%` }}
                    transition={{ duration: 0.5, delay: 0.2 }}
                />
            </div>
        </div>
    );
};

export default App;
