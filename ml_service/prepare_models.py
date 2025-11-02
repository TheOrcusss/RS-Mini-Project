import pandas as pd
from sklearn.preprocessing import MinMaxScaler
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.neighbors import NearestNeighbors
from scipy.sparse import hstack, save_npz
import joblib
import os

print("Starting model preparation...")

# --- 1. Load and Prep Data ---
df = pd.read_csv("Music Info.csv")
df_new = df.drop(['spotify_preview_url',  'track_id', 'key', 'mode', 'time_signature', 'duration_ms', 'genre'], axis=1)

def unify_tags(tag_string):
    if pd.isna(tag_string): return ""
    tags = [t.strip().lower().replace('_', ' ') for t in tag_string.split(',')]
    tag_groups = {
        "alt rock": "alternative rock", "alt": "alternative", "electro": "electronic",
        "electronica": "electronic", "hip hop": "hip-hop", "r&b": "rnb",
        "pop rock": "pop-rock", "hard rock": "hard-rock",
        "progressive metal": "progressive metal", "classic rock": "classic rock",
        "death": "death metal", "prog": "progressive"
    }
    mapped = [tag_groups.get(t, t) for t in tags]
    return ",".join(sorted(set(mapped)))

df_new['tags_unified'] = df['tags'].apply(unify_tags)
df_Final = df_new[[
    'name', 'artist', 'year', 'tags_unified', 'spotify_id',  # <-- ADDED 'spotify_id'
    'danceability', 'energy', 'loudness', 'speechiness',
    'acousticness', 'instrumentalness', 'liveness', 'valence', 'tempo'
]].copy()

df_Final['tags_unified'] = df_Final['tags_unified'].fillna('')
df_Final['text_features'] = (df_Final['tags_unified'] + " ") * 3 + df_Final['artist']

# --- 2. Create and Save Features/Models ---
audio_features = [
    'danceability', 'energy', 'loudness', 'speechiness',
    'acousticness', 'instrumentalness', 'liveness', 'valence', 'tempo'
]

# Scale and save scaler
scaler = MinMaxScaler()
audio_scaled = scaler.fit_transform(df_Final[audio_features])
joblib.dump(scaler, 'scaler.joblib')

# TF-IDF and save vectorizer
tfidf = TfidfVectorizer(stop_words='english', max_features=3000)
tfidf_matrix = tfidf.fit_transform(df_Final['text_features'])
joblib.dump(tfidf, 'tfidf_vectorizer.joblib')

# Combine features and save
combined_features = hstack([tfidf_matrix, audio_scaled]).tocsr()
save_npz('combined_features.npz', combined_features)

# Fit and save NN model
nn_model = NearestNeighbors(metric='cosine', algorithm='brute', n_neighbors=11)
nn_model.fit(combined_features)
joblib.dump(nn_model, 'nn_model.joblib')

# Save the final DataFrame for lookups
df_Final.to_parquet('music_data.parquet', index=True)

print("All models and data saved successfully.")    