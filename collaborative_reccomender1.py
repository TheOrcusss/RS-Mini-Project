import pandas as pd
from sklearn.preprocessing import MinMaxScaler
from sklearn.neighbors import NearestNeighbors  # <-- IMPORT THIS
# from sklearn.metrics.pairwise import cosine_similarity  <-- NO LONGER NEEDED
import warnings

# Suppress warnings
warnings.filterwarnings('ignore')

# --- 0. Load the Dataset ---
try:
    df = pd.read_csv('shuffled_spotify_tracks_dataset.csv')
    print("Dataset loaded successfully.")
except FileNotFoundError:
    print("Error: Dataset file 'shuffled_spotify_tracks_dataset.csv' not found.")
    exit()

# --- 1. Data Preparation ---
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

    # --- 2. Feature Engineering ---
    numerical_features = ['popularity', 'duration_ms', 'danceability', 'energy', 'key', 
                            'loudness', 'mode', 'speechiness', 'acousticness', 
                            'instrumentalness', 'liveness', 'valence', 'tempo']
    categorical_features = ['track_genre']

    # Scale Numerical Features
    scaler = MinMaxScaler()
    df_numerical = pd.DataFrame(scaler.fit_transform(df_cleaned[numerical_features]), 
                                columns=numerical_features)

    # One-Hot Encode Categorical Features
    df_categorical = pd.get_dummies(df_cleaned[categorical_features], drop_first=True)

    # Combine numerical and categorical features
    content_matrix = pd.concat([df_numerical, df_categorical], axis=1)
    print(f"Content matrix created with {content_matrix.shape[0]} songs and {content_matrix.shape[1]} features.")

    # --- 3. Model Fitting (REPLACED SIMILARITY CALCULATION) ---
    print("Fitting NearestNeighbors model... (This is fast)")
    
    # Create the model:
    # 'metric='cosine'' means we'll use cosine distance (1 - similarity)
    # 'algorithm='brute'' will just compute cosine distance directly
    # 'n_jobs=-1' will use all your CPU cores
    nn_model = NearestNeighbors(metric='cosine', algorithm='brute', n_jobs=-1)
    
    # Fit the model on the content matrix
    nn_model.fit(content_matrix)
    
    print("Model fitting complete.")
    # We no longer create the giant 'cosine_sim' matrix

# --- 4. Recommendation Function (UPDATED) ---

def get_content_based_recommendations(track_name, artist_name, n=10):
    """
    Gets N song recommendations based on a seed song's content,
    identified by both track name and artist name.
    """
    
    try:
        # Search for the song
        seed_song = df_cleaned[
            (df_cleaned['track_name'].str.lower() == track_name.lower()) &
            (df_cleaned['artists'].str.lower().str.contains(artist_name.lower()))
        ]

        if seed_song.empty:
            print(f"\n--- !!! ---")
            print(f"Error: Song '{track_name}' by '{artist_name}' not found.")
            print(f"--- !!! ---\n")
            track_matches = df_cleaned[df_cleaned['track_name'].str.lower().str.contains(track_name.lower())]['track_name'].unique()
            if len(track_matches) > 0:
                print(f"Found tracks matching '{track_name}': {track_matches[:5]}")
            return pd.DataFrame() 

        # Get the index and feature vector for the seed song
        idx = seed_song.index[0]
        seed_song_features = content_matrix.iloc[idx]
        
    except Exception as e:
        print(f"An error occurred during lookup: {e}")
        return pd.DataFrame()
        
    # --- USE THE MODEL TO FIND NEIGHBORS ---
    # We ask for n+1 neighbors because the first neighbor will be the song itself
    # 'kneighbors' returns (distances, indices)
    distances, indices = nn_model.kneighbors(
        [seed_song_features], # Needs to be in a list/2D array
        n_neighbors=n+1
    )
    
    # Get the indices and distances, skipping the first one (index 0)
    song_indices = indices[0][1:]
    song_distances = distances[0][1:]
    
    # Calculate similarity (1 - distance)
    song_similarities = 1 - song_distances

    # Return the top n most similar songs
    recommendations = df_cleaned.iloc[song_indices][['track_name', 'artists', 'track_genre', 'popularity']]
    recommendations['similarity'] = [round(sim, 3) for sim in song_similarities]
    
    return recommendations

# --- 5. Interactive Recommender ---

def run_recommender():
    if 'nn_model' not in globals():
        print("Error: Recommender model not fitted. Please load data first.")
        return

    while True:
        print("\n--- New Song Recommendation ---")
        input_song_name = input("Enter the song name: ")
        input_artist_name = input("Enter the artist name: ")
        
        try:
            input_n = int(input("How many recommendations do you want? (e.g., 5): "))
        except ValueError:
            print("Invalid number. Defaulting to 5 recommendations.")
            input_n = 5
            
        recs = get_content_based_recommendations(track_name=input_song_name, 
                                                 artist_name=input_artist_name, 
                                                 n=input_n)
        
        if not recs.empty:
            print(f"\nRecommendations for '{input_song_name}' by '{input_artist_name}':")
            print(recs)

        again = input("\nDo you want to find more recommendations? (y/n): ").lower()
        if again != 'y' and again != 'yes':
            print("Exiting recommender. Goodbye!")
            break

# Only run the recommender if the script is executed directly
if __name__ == "__main__":
    if 'df' in locals():
        run_recommender()
    else:
        print("Could not start recommender because data was not loaded.")