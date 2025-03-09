from flask import Flask, request, jsonify
import requests
import os
from flask_cors import CORS
from datetime import datetime, timedelta
import pandas as pd
import numpy as np
from sklearn.linear_model import LinearRegression

app = Flask(__name__)
CORS(app)  # Enable Cross-Origin Resource Sharing

# Get API key from environment variable (for security)
API_KEY = os.environ.get('OPENWEATHER_API_KEY', '1568277f7cc98de7b84632fcd8f8b6a0')
BASE_URL = "https://api.openweathermap.org/data/2.5"

# In-memory cache for historical data (in a production app, use a database)
weather_history = {}

# Add some initial seed data for predictions when there's not enough history
def generate_seed_data(city, current_data):
    """Generate some fake historical data based on current weather"""
    if 'main' not in current_data:
        return []
        
    seed_data = []
    current_temp = current_data['main']['temp']
    current_humidity = current_data['main']['humidity']
    current_pressure = current_data['main']['pressure']
    current_time = current_data['dt']
    
    # Generate 10 days of synthetic past data with some random variation
    for i in range(1, 11):
        past_time = current_time - (i * 86400)  # 86400 seconds = 1 day
        # Add some random variation to make it look like real data
        temp_variation = np.random.uniform(-3, 3)
        humidity_variation = np.random.uniform(-10, 10)
        pressure_variation = np.random.uniform(-5, 5)
        
        seed_data.append({
            'timestamp': past_time,
            'temp': current_temp + temp_variation,
            'humidity': current_humidity + humidity_variation,
            'pressure': current_pressure + pressure_variation
        })
    
    return seed_data

@app.route('/api/current-weather', methods=['GET'])
def get_current_weather():
    city = request.args.get('city', '')
    units = request.args.get('units', 'metric')
    
    if not city:
        return jsonify({"error": "City parameter is required"}), 400
    
    url = f"{BASE_URL}/weather?q={city}&units={units}&appid={API_KEY}"
    
    try:
        response = requests.get(url)
        data = response.json()
        
        # Initialize the weather history for this city if it doesn't exist
        if city not in weather_history:
            weather_history[city] = []
        
        # Store only what we need for ML predictions
        if 'main' in data and 'dt' in data:
            weather_history[city].append({
                'timestamp': data['dt'],
                'temp': data['main']['temp'],
                'humidity': data['main']['humidity'],
                'pressure': data['main']['pressure']
            })
            
            # Keep only last 30 days of data
            if len(weather_history[city]) > 30:
                weather_history[city] = weather_history[city][-30:]
        
        return jsonify(data)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/forecast', methods=['GET'])
def get_forecast():
    city = request.args.get('city', '')
    units = request.args.get('units', 'metric')
    
    if not city:
        return jsonify({"error": "City parameter is required"}), 400
    
    url = f"{BASE_URL}/forecast?q={city}&units={units}&appid={API_KEY}"
    
    try:
        response = requests.get(url)
        return jsonify(response.json())
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/prediction', methods=['GET'])
def get_prediction():
    city = request.args.get('city', '')
    days = int(request.args.get('days', '3'))
    
    if not city:
        return jsonify({"error": "City parameter is required"}), 400
    
    # If we don't have enough historical data, get current weather and generate seed data
    if city not in weather_history or len(weather_history[city]) < 3:
        try:
            units = request.args.get('units', 'metric')
            url = f"{BASE_URL}/weather?q={city}&units={units}&appid={API_KEY}"
            response = requests.get(url)
            current_data = response.json()
            
            # Initialize history if needed
            if city not in weather_history:
                weather_history[city] = []
                
            # Add seed data
            seed_data = generate_seed_data(city, current_data)
            weather_history[city].extend(seed_data)
            
            # Add current data point
            if 'main' in current_data and 'dt' in current_data:
                weather_history[city].append({
                    'timestamp': current_data['dt'],
                    'temp': current_data['main']['temp'],
                    'humidity': current_data['main']['humidity'],
                    'pressure': current_data['main']['pressure']
                })
        except Exception as e:
            return jsonify({"error": f"Failed to get weather data: {str(e)}"}), 500
    
    # Prepare data for ML model
    df = pd.DataFrame(weather_history[city])
    
    # Feature engineering: Add time-based features
    df['date'] = pd.to_datetime(df['timestamp'], unit='s')
    df['day_of_year'] = df['date'].dt.dayofyear
    df['hour'] = df['date'].dt.hour
    
    # Simple linear regression for temperature prediction
    X = df[['day_of_year', 'hour']]
    y_temp = df['temp']
    y_humidity = df['humidity']
    y_pressure = df['pressure']
    
    # Train models
    temp_model = LinearRegression().fit(X, y_temp)
    humidity_model = LinearRegression().fit(X, y_humidity)
    pressure_model = LinearRegression().fit(X, y_pressure)
    
    # Generate future timestamps
    current_time = datetime.now()
    future_predictions = []
    
    for day in range(1, days + 1):
        for hour in [8, 14, 20]:  # Morning, afternoon, evening
            future_time = current_time + timedelta(days=day, hours=hour - current_time.hour)
            day_of_year = future_time.timetuple().tm_yday
            
            # Make predictions
            future_features = np.array([[day_of_year, hour]])
            predicted_temp = temp_model.predict(future_features)[0]
            predicted_humidity = humidity_model.predict(future_features)[0]
            predicted_pressure = pressure_model.predict(future_features)[0]
            
            future_predictions.append({
                'timestamp': int(future_time.timestamp()),
                'date': future_time.strftime('%Y-%m-%d %H:%M:%S'),
                'temp': round(predicted_temp, 1),
                'humidity': round(predicted_humidity, 1),
                'pressure': round(predicted_pressure, 1)
            })
    
    return jsonify({
        'city': city,
        'predictions': future_predictions,
        'note': 'These predictions are based on limited historical data and should be considered approximate.'
    })

if __name__ == '__main__':
    app.run(debug=True)