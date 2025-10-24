import pandas as pd
import warnings
from sklearn.preprocessing import MinMaxScaler
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.neighbors import NearestNeighbors
from sklearn.decomposition import TruncatedSVD # <-- This is 'PCA' for sparse data
from scipy.sparse import hstack # <-- To combine sparse matrices
import numpy as np

# --- TensorFlow / Keras Imports for Autoencoder ---
# Suppress TensorFlow GPU warnings
import os
os.environ['TF_CPP_MIN_LOG_LEVEL'] = '2' 
warnings.filterwarnings('ignore', category=UserWarning, module='tensorflow')
try:
    import tensorflow as tf
    from tensorflow.keras.models import Model
    from tensorflow.keras.layers import Input, Dense
    print(f"TensorFlow Version: {tf.__version__} loaded.")
except ImportError:
    print("TensorFlow not found. Approach 2 (Autoencoder) will fail.")
    print("Please install it: pip install tensorflow")
    tf = None

# Suppress other warnings
warnings.filterwarnings('ignore')

# --- 0. Load the Dataset ---
try:
    df = pd.read_csv('shuffled_spotify_tracks_dataset.csv')
    print("Dataset loaded successfully.")
except FileNotFoundError:
    print("Error: Dataset file 'shuffled_spotify_tracks_dataset.csv' not found.")
    exit()

# --- 1. Data Preparation (Common for Both Approaches) ---
if 'df' in locals():
    # Drop rows with any missing values
    df_cleaned = df.dropna()

    # Remove duplicate songs
    original_count = len(df_cleaned)
    df_cleaned = df_cleaned.drop_duplicates(subset=['track_name', 'artists'])
    new_count = len(df_cleaned)
    print(f"Removed {original_count - new_count} duplicate songs.")

    # Reset index
    df_cleaned = df_cleaned.reset_index(drop=True)

    # --- 2. Advanced Feature Engineering (Common for Both Approaches) ---
    print("\n--- Feature Engineering with TF-IDF ---")
    
    # 2.1: Scale Numerical Features
    numerical_features = ['popularity', 'duration_ms', 'danceability', 'energy', 'key', 
                            'loudness', 'mode', 'speechiness', 'acousticness', 
                            'instrumentalness', 'liveness', 'valence', 'tempo']
    scaler = MinMaxScaler()
    scaled_numerical = scaler.fit_transform(df_cleaned[numerical_features])
    print(f"Scaled {scaled_numerical.shape[1]} numerical features.")

    # 2.2: TF-IDF for 'artists'
    # Use max_features to keep the matrix size manageable
    # This finds the top 1000 most frequent/important artists
    artist_tfidf = TfidfVectorizer(max_features=1000)
    artist_matrix = artist_tfidf.fit_transform(df_cleaned['artists'])
    print(f"Created artist TF-IDF matrix with shape: {artist_matrix.shape}")

    # 2.3: TF-IDF for 'track_genre'
    # No max_features needed, as there are only ~113 genres
    genre_tfidf = TfidfVectorizer()
    genre_matrix = genre_tfidf.fit_transform(df_cleaned['track_genre'])
    print(f"Created genre TF-IDF matrix with shape: {genre_matrix.shape}")

    # 2.4: Combine all features into one sparse matrix
    # 'hstack' stacks matrices horizontally
    combined_sparse_features = hstack([scaled_numerical, artist_matrix, genre_matrix])
    
    # Convert to Compressed Sparse Row format for faster operations
    combined_sparse_features = combined_sparse_features.tocsr()
    print(f"Combined sparse feature matrix created with shape: {combined_sparse_features.shape}")
    
    # --- 3. Approach 1: TF-IDF + TruncatedSVD (PCA) ---
    print("\n--- Approach 1: Fitting TruncatedSVD (PCA) ---")
    
    # We use TruncatedSVD because it works directly on sparse matrices.
    # PCA would require converting to a dense matrix, which would cause a MemoryError.
    # We'll reduce our 1120+ features down to 100 components.
    SVD_COMPONENTS = 100
    svd_model = TruncatedSVD(n_components=SVD_COMPONENTS, random_state=42)
    
    # Fit and transform the sparse data
    svd_features = svd_model.fit_transform(combined_sparse_features)
    print(f"Reduced features to {svd_features.shape} using SVD.")
    
    # Fit the NearestNeighbors model on these SVD features
    nn_model_svd = NearestNeighbors(metric='cosine', algorithm='brute', n_jobs=-1)
    nn_model_svd.fit(svd_features)
    print("Fitted NearestNeighbors model on SVD features.")

    # --- 4. Approach 2: TF-IDF + Autoencoder ---
    if tf is not None:
        print("\n--- Approach 2: Fitting Autoencoder ---")
        
        # We will use the output of the SVD as the *input* to the autoencoder.
        # This is a common technique: SVD cleans the data, and the Autoencoder finds
        # even deeper, non-linear patterns.
        
        # 4.1: Scale the SVD features (Autoencoders train better on 0-1 data)
        svd_scaler = MinMaxScaler()
        scaled_svd_features = svd_scaler.fit_transform(svd_features)
        
        # 4.2: Define Autoencoder architecture
        INPUT_DIM = SVD_COMPONENTS
        EMBEDDING_DIM = 32 # This is our goal: compress 100 features -> 32
        
        input_layer = Input(shape=(INPUT_DIM,))
        # Encoder
        encoder = Dense(64, activation='relu')(input_layer)
        # Bottleneck (the "deep" features)
        bottleneck = Dense(EMBEDDING_DIM, activation='relu', name='encoder_output')(encoder)
        # Decoder
        decoder = Dense(64, activation='relu')(bottleneck)
        # Output layer
        output_layer = Dense(INPUT_DIM, activation='sigmoid')(decoder) # Sigmoid for 0-1 data
        
        # Create the Autoencoder model
        autoencoder = Model(inputs=input_layer, outputs=output_layer)
        autoencoder.compile(optimizer='adam', loss='mse')
        
        print(f"Training Autoencoder to compress {INPUT_DIM} features to {EMBEDDING_DIM}...")
        # Train the model
        autoencoder.fit(
            scaled_svd_features,       # Input data
            scaled_svd_features,       # Target data (it learns to reconstruct itself)
            epochs=20,                 # 20 passes over the data
            batch_size=256,            # In chunks of 256 songs
            shuffle=True,              # Shuffle data each epoch
            validation_split=0.1,      # Use 10% of data for validation
            verbose=1                  # Show training progress
        )
        
        # 4.3: Create a separate "Encoder" model to get the embeddings
        encoder_model = Model(inputs=input_layer, outputs=bottleneck)
        
        # 4.4: Get the new "deep" features for all songs
        autoencoder_features = encoder_model.predict(scaled_svd_features)
        print(f"Reduced features to {autoencoder_features.shape} using Autoencoder.")
        
        # 4.5: Fit a new NearestNeighbors model on the Autoencoder features
        nn_model_autoencoder = NearestNeighbors(metric='cosine', algorithm='brute', n_jobs=-1)
        nn_model_autoencoder.fit(autoencoder_features)
        print("Fitted NearestNeighbors model on Autoencoder features.")

# --- 5. Recommendation Function (Now takes a model and features) ---

def get_recommendations(track_name, artist_name, nn_model, feature_matrix, n=10):
    """
    Gets N song recommendations using a *specific* fitted model and feature matrix.
    """
    try:
        seed_song = df_cleaned[
            (df_cleaned['track_name'].str.lower() == track_name.lower()) &
            (df_cleaned['artists'].str.lower().str.contains(artist_name.lower()))
        ]
        if seed_song.empty:
            print(f"\n--- !!! ---")
            print(f"Error: Song '{track_name}' by '{artist_name}' not found.")
            print(f"--- !!! ---\n")
            return pd.DataFrame() 

        # Get the index and feature vector for the seed song
        idx = seed_song.index[0]
        seed_song_features = feature_matrix[idx]
        
    except Exception as e:
        print(f"An error occurred during lookup: {e}")
        return pd.DataFrame()
        
    # Find the nearest neighbors
    distances, indices = nn_model.kneighbors(
        [seed_song_features],
        n_neighbors=n+1
    )
    
    # Get indices and distances, skipping the first (itself)
    song_indices = indices[0][1:]
    song_distances = distances[0][1:]
    song_similarities = 1 - song_distances

    # Return the recommendations
    recommendations = df_cleaned.iloc[song_indices][['track_name', 'artists', 'track_genre', 'popularity']]
    recommendations['similarity'] = [round(sim, 3) for sim in song_similarities]
    
    return recommendations

# --- 6. Interactive Recommender ---

def run_recommender():
    if 'nn_model_svd' not in globals():
        print("Error: Models not fitted. Please run the script to load/train.")
        return

    while True:
        print("\n--- New Song Recommendation ---")
        
        # Ask which model to use
        model_choice = input("Select model (1=PCA/SVD, 2=Autoencoder, q=Quit): ").strip()

        if model_choice == 'q':
            print("Exiting recommender. Goodbye!")
            break
            
        if model_choice not in ('1', '2'):
            print("Invalid choice. Please enter 1, 2, or q.")
            continue
            
        if model_choice == '2' and (tf is None or 'nn_model_autoencoder' not in globals()):
            print("Autoencoder model not available (TensorFlow not found or model not trained).")
            continue
            
        # Get user input for song
        input_song_name = input("Enter the song name: ")
        input_artist_name = input("Enter the artist name: ")
        
        try:
            input_n = int(input("How many recommendations do you want? (e.g., 5): "))
        except ValueError:
            print("Invalid number. Defaulting to 5 recommendations.")
            input_n = 5
            
        # Call the correct function
        if model_choice == '1':
            print(f"\n--- Using SVD (PCA) Model ---")
            recs = get_recommendations(input_song_name, input_artist_name,
                                         nn_model=nn_model_svd,
                                         feature_matrix=svd_features,
                                         n=input_n)
        else:
            print(f"\n--- Using Autoencoder Model ---")
            recs = get_recommendations(input_song_name, input_artist_name,
                                         nn_model=nn_model_autoencoder,
                                         feature_matrix=autoencoder_features,
                                         n=input_n)
        
        if not recs.empty:
            print(f"\nRecommendations for '{input_song_name}' by '{input_artist_name}':")
            print(recs)

# --- Run the application ---
if __name__ == "__main__":
    if 'df' in locals():
        run_recommender()
    else:
        print("Could not start recommender because data was not loaded.")