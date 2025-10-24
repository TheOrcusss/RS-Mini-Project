import pandas as pd
import warnings
import time
import re
from sklearn.preprocessing import MinMaxScaler
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.neighbors import NearestNeighbors
from sklearn.decomposition import TruncatedSVD
from scipy.sparse import hstack
import numpy as np

# --- TensorFlow / Keras Imports ---
import os
os.environ['TF_CPP_MIN_LOG_LEVEL'] = '2' 
warnings.filterwarnings('ignore', category=UserWarning, module='tensorflow')
try:
    import tensorflow as tf
    from tensorflow.keras.models import Model
    from tensorflow.keras.layers import Input, Dense
    from tensorflow.keras.callbacks import EarlyStopping
    print(f"TensorFlow Version: {tf.__version__} loaded.")
except ImportError:
    print("TensorFlow not found. Approach 2 (Autoencoder) will fail.")
    print("Please install it: pip install tensorflow")
    tf = None

warnings.filterwarnings('ignore')

# --- 1. Data Preparation ---

def load_and_prepare_data(filepath):
    """
    Loads, cleans, and prepares the Spotify dataset.
    """
    print("Loading dataset...")
    try:
        df = pd.read_csv(filepath)
        print("Dataset loaded successfully.")
    except FileNotFoundError:
        print(f"Error: Dataset file '{filepath}' not found.")
        return None

    print("Preparing data (cleaning, dropping duplicates)...")
    df_cleaned = df.dropna()
    original_count = len(df_cleaned)
    df_cleaned = df_cleaned.drop_duplicates(subset=['track_name', 'artists'])
    new_count = len(df_cleaned)
    print(f"Removed {original_count - new_count} duplicate songs.")
    df_cleaned = df_cleaned.reset_index(drop=True)
    return df_cleaned

# --- 2. Advanced Feature Engineering ---

def split_artists(artist_string):
    """
    Custom tokenizer for TF-IDF to split artists by ';'.
    """
    if artist_string is None:
        return []
    artists = str(artist_string).split(';')
    cleaned_artists = [re.sub(r'[^a-zA-Z0-9\s]', '', artist).strip() for artist in artists]
    return [artist for artist in cleaned_artists if artist]

def build_feature_matrix(df_cleaned):
    """
    Builds the combined sparse feature matrix from numerical and text features.
    """
    print("\n--- Feature Engineering with TF-IDF ---")
    
    numerical_features = ['popularity', 'duration_ms', 'danceability', 'energy', 'key', 
                            'loudness', 'mode', 'speechiness', 'acousticness', 
                            'instrumentalness', 'liveness', 'valence', 'tempo']
    scaler = MinMaxScaler()
    scaled_numerical = scaler.fit_transform(df_cleaned[numerical_features])
    print(f"Scaled {scaled_numerical.shape[1]} numerical features.")

    artist_tfidf = TfidfVectorizer(max_features=1000, tokenizer=split_artists)
    artist_matrix = artist_tfidf.fit_transform(df_cleaned['artists'])
    print(f"Created artist TF-IDF matrix with shape: {artist_matrix.shape}")
    
    genre_tfidf = TfidfVectorizer(max_features=115)
    genre_matrix = genre_tfidf.fit_transform(df_cleaned['track_genre'])
    print(f"Created genre TF-IDF matrix with shape: {genre_matrix.shape}")
    
    album_tfidf = TfidfVectorizer(max_features=1000)
    album_matrix = album_tfidf.fit_transform(df_cleaned['album_name'])
    print(f"Created album TF-IDF matrix with shape: {album_matrix.shape}")

    combined_sparse_features = hstack([
        scaled_numerical, 
        artist_matrix, 
        genre_matrix, 
        album_matrix
    ]).tocsr()
    print(f"Combined sparse feature matrix created: {combined_sparse_features.shape}")
    return combined_sparse_features

# --- 3. Approach 1: SVD (PCA) Model ---

def build_svd_model(features):
    """
    Builds the TruncatedSVD model and NearestNeighbors model.
    """
    print("\n--- Approach 1: Fitting TruncatedSVD (PCA) ---")
    SVD_COMPONENTS = 150
    svd_model = TruncatedSVD(n_components=SVD_COMPONENTS, random_state=42)
    
    print(f"Reducing features to {SVD_COMPONENTS} components...")
    svd_features = svd_model.fit_transform(features)
    
    nn_model_svd = NearestNeighbors(metric='cosine', algorithm='brute', n_jobs=-1)
    nn_model_svd.fit(svd_features)
    print("Fitted NearestNeighbors model on SVD features.")
    return nn_model_svd, svd_features

# --- 4. Approach 2: Autoencoder Model ---

def build_autoencoder_model(svd_features):
    """
    Builds and trains the Autoencoder and fits the final NearestNeighbors model.
    """
    if tf is None:
        print("\n--- Approach 2: Autoencoder SKIPPED (TensorFlow not found) ---")
        return None, None
        
    print("\n--- Approach 2: Fitting Autoencoder ---")
    
    svd_scaler = MinMaxScaler()
    scaled_svd_features = svd_scaler.fit_transform(svd_features)
    
    INPUT_DIM = scaled_svd_features.shape[1]
    EMBEDDING_DIM = 32
    
    input_layer = Input(shape=(INPUT_DIM,))
    encoder = Dense(INPUT_DIM // 2, activation='relu')(input_layer)
    bottleneck = Dense(EMBEDDING_DIM, activation='relu', name='encoder_output')(encoder)
    decoder = Dense(INPUT_DIM // 2, activation='relu')(bottleneck)
    output_layer = Dense(INPUT_DIM, activation='sigmoid')(decoder)
    
    autoencoder = Model(inputs=input_layer, outputs=output_layer)
    autoencoder.compile(optimizer='adam', loss='mse')
    
    early_stop = EarlyStopping(monitor='val_loss', patience=5, restore_best_weights=True)
    
    print(f"Training Autoencoder (compressing {INPUT_DIM} -> {EMBEDDING_DIM})...")
    start_time = time.time()
    autoencoder.fit(
        scaled_svd_features, scaled_svd_features,
        epochs=50,
        batch_size=256,
        shuffle=True,
        validation_split=0.1,
        callbacks=[early_stop],
        verbose=1
    )
    print(f"Autoencoder trained in {time.time() - start_time:.2f} seconds.")
    
    encoder_model = Model(inputs=input_layer, outputs=bottleneck)
    autoencoder_features = encoder_model.predict(scaled_svd_features)
    
    nn_model_autoencoder = NearestNeighbors(metric='cosine', algorithm='brute', n_jobs=-1)
    nn_model_autoencoder.fit(autoencoder_features)
    print("Fitted NearestNeighbors model on Autoencoder features.")
    return nn_model_autoencoder, autoencoder_features

# --- 5. Recommendation Function (Context Removed) ---

def get_recommendations(track_name, artist_name, nn_model, feature_matrix, df_cleaned, n=10):
    """
    Gets N song recommendations based on a seed song's content.
    """
    try:
        # Find matching songs
        seed_songs = df_cleaned[
            (df_cleaned['track_name'].str.lower() == track_name.lower()) &
            (df_cleaned['artists'].str.lower().str.contains(artist_name.lower()))
        ]
        
        if seed_songs.empty:
            print(f"\n--- !!! ---\nError: Song '{track_name}' by '{artist_name}' not found.\n--- !!! ---\n")
            return pd.DataFrame() 

        # If multiple matches, pick the most popular one
        if len(seed_songs) > 1:
            print(f"Found {len(seed_songs)} versions. Selecting most popular.")
            seed_song = seed_songs.loc[seed_songs['popularity'].idxmax()]
        else:
            seed_song = seed_songs.iloc[0]
            
        idx = seed_song.name # Get the DataFrame index
        seed_song_features = feature_matrix[idx]
        
    except Exception as e:
        print(f"An error occurred during lookup: {e}")
        return pd.DataFrame()
        
    # --- Get the 'n' nearest neighbors ---
    distances, indices = nn_model.kneighbors(
        [seed_song_features],
        n_neighbors=n + 1 # +1 for the song itself
    )
    
    # Get indices and distances, skipping the first (itself)
    song_indices = indices[0][1:]
    song_distances = distances[0][1:]
    song_similarities = 1 - song_distances
    
    # Get the recommendations from the original DataFrame
    recommendations = df_cleaned.iloc[song_indices].copy()
    recommendations['similarity'] = song_similarities
    
    return recommendations[['track_name', 'artists', 'track_genre', 'popularity', 'similarity']]


# --- 6. Interactive Recommender (Context Removed) ---

def run_recommender(df_cleaned, models_features):
    """
    Main interactive loop for the recommender.
    """
    nn_model_svd, svd_features, nn_model_autoencoder, autoencoder_features = models_features
    
    if nn_model_svd is None:
        print("Error: SVD model not fitted. Exiting.")
        return

    print("\n--- Welcome to the Music Recommender! ---")

    while True:
        print("\n" + "="*50)
        
        # --- Model Choice ---
        model_choice = input("Select model (1=PCA/SVD, 2=Autoencoder, q=Quit): ").strip()
        if model_choice == 'q':
            break
        
        if model_choice == '1':
            print("--- Using SVD (PCA) Model ---")
            active_model = nn_model_svd
            active_features = svd_features
        elif model_choice == '2':
            if nn_model_autoencoder is None:
                print("Autoencoder model not available. Please select 1.")
                continue
            print("--- Using Autoencoder Model ---")
            active_model = nn_model_autoencoder
            active_features = autoencoder_features
        else:
            print("Invalid choice. Please enter 1, 2, or q.")
            continue
            
        # --- Song Choice ---
        input_song_name = input("Enter the song name: ")
        input_artist_name = input("Enter the artist name: ")
        
        # --- Number of Recs ---
        try:
            input_n = int(input("How many recommendations do you want? (e.g., 5): "))
        except ValueError:
            print("Invalid number. Defaulting to 5.")
            input_n = 5
            
        # Get recommendations
        recs = get_recommendations(
            track_name=input_song_name, 
            artist_name=input_artist_name, 
            nn_model=active_model,
            feature_matrix=active_features,
            df_cleaned=df_cleaned,
            n=input_n
        )
        
        if not recs.empty:
            print(f"\nRecommendations for '{input_song_name}' by '{input_artist_name}':")
            print(recs)

    print("Exiting recommender. Goodbye!")

# --- Run the application ---
if __name__ == "__main__":
    
    # 1. Load and prepare data
    df_cleaned = load_and_prepare_data('shuffled_spotify_tracks_dataset.csv')
    
    if df_cleaned is not None:
        # 2. Build feature matrix
        combined_features = build_feature_matrix(df_cleaned)
        
        # 3. Build SVD model
        nn_model_svd, svd_features = build_svd_model(combined_features)
        
        # 4. Build Autoencoder model
        nn_model_autoencoder, autoencoder_features = build_autoencoder_model(svd_features)
        
        # 5. Run interactive recommender
        models_features = (nn_model_svd, svd_features, nn_model_autoencoder, autoencoder_features)
        run_recommender(df_cleaned, models_features)