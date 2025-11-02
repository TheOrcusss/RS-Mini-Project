import React from 'react';
import { motion } from 'framer-motion';
import './App.css'; // We'll add styles to App.css

// This is the placeholder for a single card
const SkeletonCard = ({ index }) => {
    return (
        <motion.div
            className="skeleton-card"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: index * 0.05 }}
        >
            <div className="skeleton-embed"></div>
            <div className="skeleton-info">
                <div className="skeleton-line title"></div>
                <div className="skeleton-line text"></div>
                <div className="skeleton-line text short"></div>
            </div>
        </motion.div>
    );
};

// This component renders a full grid of placeholders
const SkeletonGrid = ({ count = 12 }) => {
    return (
        <div className="results">
            <h3>Checking vibes...</h3>
            <div className="results-grid">
                {[...Array(count)].map((_, i) => (
                    <SkeletonCard key={i} index={i} />
                ))}
            </div>
        </div>
    );
};

export default SkeletonGrid;