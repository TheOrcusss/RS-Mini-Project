import React from 'react';
import { motion } from 'framer-motion';
// import { FaPlus } from 'react-icons/fa'; // Removed

// Helper component (unchanged)
const SpotifyEmbed = ({ trackId }) => {
    if (!trackId) {
        return <div className="spotify-embed-placeholder">Preview Not Available</div>;
    }
    const embedUrl = `https://open.spotify.com/embed/track/${trackId}`;
    return (
        <iframe
            src={embedUrl}
            width="100%"
            height="80"
            frameBorder="0"
            allowTransparency="true"
            allow="encrypted-media"
            title="spotify-player"
            style={{ borderRadius: '8px', pointerEvents: 'none' }}
        ></iframe>
    );
};

// Song card (unchanged)
const SongCard = ({ song, index, onCardClick }) => {
    const tags = song.tags_unified ? song.tags_unified.split(',').slice(0, 3) : [];
    return (
        <motion.div
            className="song-card"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
            onClick={() => onCardClick(song)} // <-- Pass song obj to handler
        >
            <div className="card-embed">
                <SpotifyEmbed trackId={song.spotify_id} />
            </div>
            <div className="card-info">
                <h4 className="card-title">{song.name}</h4>
                <p className="card-artist">{song.artist} ({song.year})</p>
                {song.similarity_score && (
                    <p className="card-score">
                        Similarity: {Math.round(song.similarity_score * 100)}%
                    </p>
                )}
                {tags.length > 0 && (
                    <div className="card-tags">
                        {tags.map(tag => (
                            <span key={tag} className="card-tag">{tag}</span>
                        ))}
                    </div>
                )}
            </div>
        </motion.div>
    );
};

// *** CHANGED: Main component now receives 'onCardClick' and has no 'Load More' button ***
function ResultsGrid({ data, onCardClick }) {
    if (!data || data.length === 0) {
        return <p>No results found.</p>;
    }

    return (
        <div className="results">
            <h3>Your VibeCheck Results:</h3>
            <div className="results-grid">
                {data.map((song, index) => (
                    <SongCard 
                        key={`${song.spotify_id}-${index}`} 
                        song={song} 
                        index={index} 
                        onCardClick={onCardClick} // Pass the handler from App.js
                    />
                ))}
            </div>
            
            {/* --- "LOAD MORE" BUTTON REMOVED --- */}
        </div>
    );
}

export default ResultsGrid;