import pandas as pd
import joblib
from scipy.sparse import load_npz
from flask import Flask, request, jsonify
from flask_cors import CORS

# --- Global variables (unchanged) ---
app = Flask(__name__)
CORS(app) 
nn_model = None
df_final = None
combined_features = None
mood_filters = {
    "happy": {"energy": (0.6, 1.0), "valence": (0.6, 1.0), "danceability": (0.6, 1.0)},
    "sad": {"energy": (0.0, 0.4), "valence": (0.0, 0.4), "acousticness": (0.5, 1.0)},
    "chill": {"energy": (0.2, 0.6), "valence": (0.3, 0.7), "acousticness": (0.5, 1.0), "tempo": (60, 120)},
    "energetic": {"energy": (0.7, 1.0), "danceability": (0.6, 1.0), "tempo": (120, 200)},
    "live": {"liveness": (0.7, 1.0), "energy": (0.5, 1.0)},
    "romantic": {"valence": (0.4, 0.8), "acousticness": (0.3, 1.0), "energy": (0.3, 0.7)}
}

def load_models():
    """Load all necessary models and data into memory."""
    global nn_model, df_final, combined_features
    print("Loading models and data...")
    nn_model = joblib.load('nn_model.joblib')
    combined_features = load_npz('combined_features.npz')
    df_final = pd.read_parquet('music_data.parquet')
    print("Models and data loaded successfully.")

@app.route('/recommend-song', methods=['POST'])
def recommend_song_api():
    data = request.json
    song_name = data.get('song_name')
    artist_name = data.get('artist_name')
    # *** CHANGED: Get num_recommendations from request, default to 12 ***
    num_recommendations = data.get('num_recommendations', 12)

    if not song_name or not artist_name:
        return jsonify({"error": "Song name and artist name are required."}), 400

    mask = (
        df_final['name'].str.lower() == song_name.lower()
    ) & (
        df_final['artist'].str.lower() == artist_name.lower()
    )

    if not mask.any():
        return jsonify({"error": f"Song '{song_name}' by '{artist_name}' not found."}), 404

    idx = df_final[mask].index[0]
    song_vector = combined_features[idx]

    # *** CHANGED: Use the num_recommendations variable ***
    distances, neighbors = nn_model.kneighbors(song_vector, n_neighbors=num_recommendations + 1)

    results_df = df_final.iloc[neighbors[0][1:]][['name', 'artist', 'year', 'spotify_id', 'tags_unified']]
    results_df['similarity_score'] = 1 - distances[0][1:]
    
    return jsonify(results_df.to_dict('records'))

@app.route('/recommend-mood', methods=['POST'])
def recommend_mood_api():
    data = request.json
    mood = data.get('mood')
    selected_tags = data.get('tags', [])
    # *** CHANGED: Get num_recommendations from request, default to 12 ***
    top_n = data.get('num_recommendations', 12)

    if not mood or mood not in mood_filters:
        return jsonify({"error": f"Invalid or missing mood. Choose from {list(mood_filters.keys())}"}), 400

    mood_range = mood_filters[mood]
    mood_df = df_final.copy()
    for feature, (low, high) in mood_range.items():
        mood_df = mood_df[(mood_df[feature] >= low) & (mood_df[feature] <= high)]

    if mood_df.empty:
        return jsonify({"error": f"No songs found for mood '{mood}'."}), 404

    if selected_tags:
        selected_tags = [t.lower().strip() for t in selected_tags]
        mood_df = mood_df[
            mood_df["tags_unified"].apply(
                lambda x: any(tag in x.lower() for tag in selected_tags)
            )
        ]

    if mood_df.empty:
        return jsonify({"error": f"No songs found for mood '{mood}' with tags {selected_tags}."}), 404

    mood_df = mood_df.sort_values(by=list(mood_range.keys()), ascending=False)
    
    display_cols = ['name', 'artist', 'year', 'spotify_id', 'tags_unified']
    
    # *** CHANGED: Use the top_n variable (which is our num_recommendations) ***
    return jsonify(mood_df[display_cols].head(top_n).to_dict('records'))

if __name__ == '__main__':
    load_models()
    app.run(port=5000, debug=True)