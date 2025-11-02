import React from 'react';
import { motion } from 'framer-motion';

// Helper component for the Spotify Embed (Unchanged)
const SpotifyEmbed = ({ trackId }) => {
    if (!trackId) {
        return <div className="spotify-embed-placeholder" style={{height: '152px'}}>Preview Not Available</div>;
    }
    const embedUrl = `https://open.spotify.com/embed/track/${trackId}`;
    return (
        <iframe
            src={embedUrl}
            width="100%"
            height="152"
            frameBorder="0"
            allowTransparency="true"
            allow="encrypted-media"
            title="spotify-player"
            style={{ borderRadius: '8px', pointerEvents: 'none' }}
        ></iframe>
    );
};

// SimilarityMeter Component (Unchanged)
const SimilarityMeter = ({ score }) => {
    const percentage = Math.round(score * 100);
    return (
        <div className="similarity-meter">
            <div className="vibe-label">
                <span>VibeCheck™ Similarity</span>
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
                    transition={{ duration: 0.5, delay: 0.3 }}
                />
            </div>
        </div>
    );
};


// *** CHANGED: SongCard JSX is simplified ***
const SongCard = ({ song, index, onCardClick }) => {
    const tags = song.tags_unified ? song.tags_unified.split(',').slice(0, 3) : [];

    return (
        <motion.div
            className="song-card"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
            onClick={() => onCardClick(song)}
        >
            <div className="card-embed">
                <SpotifyEmbed trackId={song.spotify_id} />
            </div>
            <div className="card-info">
                {/* Text and meter are now just one after another */}
                <h4 className="card-title">{song.name}</h4>
                <p className="card-artist">{song.artist} ({song.year})</p>

                {song.similarity_score && (
                    <div className="card-info-middle"> {/* This div just adds space */}
                        <SimilarityMeter score={song.similarity_score} />
                    </div>
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


// Main component (unchanged)
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
                        onCardClick={onCardClick}
                    />
                ))}
            </div>
        </div>
    );
}

export default ResultsGrid;