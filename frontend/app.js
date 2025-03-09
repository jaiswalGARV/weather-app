// Constants
const API_BASE_URL = 'http://localhost:5000/api';
let currentUnit = 'metric'; // Default unit (Celsius)
let currentCity = '';

// DOM Elements
const cityInput = document.getElementById('city-input');
const searchBtn = document.getElementById('search-btn');
const locationBtn = document.getElementById('location-btn');
const loader = document.getElementById('loader');
const currentWeatherDiv = document.getElementById('current-weather');
const forecastContainer = document.getElementById('forecast-container');
const predictionContainer = document.getElementById('prediction-container');
const getPredictionBtn = document.getElementById('get-prediction');
const celsiusBtn = document.getElementById('celsius');
const fahrenheitBtn = document.getElementById('fahrenheit');

// Event Listeners
searchBtn.addEventListener('click', () => {
    const city = cityInput.value.trim();
    if (city) {
        currentCity = city;
        getWeatherData(city);
    }
});

cityInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        const city = cityInput.value.trim();
        if (city) {
            currentCity = city;
            getWeatherData(city);
        }
    }
});

locationBtn.addEventListener('click', () => {
    if (navigator.geolocation) {
        showLoader();
        navigator.geolocation.getCurrentPosition(
            position => {
                const lat = position.coords.latitude;
                const lon = position.coords.longitude;
                getWeatherByCoords(lat, lon);
            },
            error => {
                hideLoader();
                alert('Unable to retrieve your location. Please enter a city manually.');
                console.error(error);
            }
        );
    } else {
        alert('Geolocation is not supported by your browser. Please enter a city manually.');
    }
});

getPredictionBtn.addEventListener('click', () => {
    if (currentCity) {
        getAIPrediction(currentCity);
    } else {
        alert('Please search for a city first.');
    }
});

celsiusBtn.addEventListener('click', () => {
    if (currentUnit !== 'metric') {
        currentUnit = 'metric';
        updateUnitButtons();
        if (currentCity) {
            getWeatherData(currentCity);
        }
    }
});

fahrenheitBtn.addEventListener('click', () => {
    if (currentUnit !== 'imperial') {
        currentUnit = 'imperial';
        updateUnitButtons();
        if (currentCity) {
            getWeatherData(currentCity);
        }
    }
});

// Functions
function updateUnitButtons() {
    if (currentUnit === 'metric') {
        celsiusBtn.classList.add('active');
        fahrenheitBtn.classList.remove('active');
    } else {
        celsiusBtn.classList.remove('active');
        fahrenheitBtn.classList.add('active');
    }
}

function showLoader() {
    loader.style.display = 'flex';
}

function hideLoader() {
    loader.style.display = 'none';
}

async function getWeatherData(city) {
    showLoader();
    try {
        // Get current weather
        const currentWeatherResponse = await fetch(`${API_BASE_URL}/current-weather?city=${city}&units=${currentUnit}`);
        const currentWeatherData = await currentWeatherResponse.json();
        
        if (currentWeatherData.error) {
            throw new Error(currentWeatherData.error);
        }
        
        displayCurrentWeather(currentWeatherData);
        
        // Get forecast
        const forecastResponse = await fetch(`${API_BASE_URL}/forecast?city=${city}&units=${currentUnit}`);
        const forecastData = await forecastResponse.json();
        
        if (forecastData.error) {
            throw new Error(forecastData.error);
        }
        
        displayForecast(forecastData);
        
    } catch (error) {
        currentWeatherDiv.innerHTML = `<div class="error-message">Error: ${error.message}</div>`;
        forecastContainer.innerHTML = '';
        console.error('Error:', error);
    } finally {
        hideLoader();
    }
}

async function getWeatherByCoords(lat, lon) {
    showLoader();
    try {
        // In this version, we'll use our backend to keep things consistent
        const response = await fetch(`${API_BASE_URL}/current-weather?lat=${lat}&lon=${lon}&units=${currentUnit}`);
        const data = await response.json();
        
        if (data.error) {
            throw new Error(data.error);
        }
        
        currentCity = data.name;
        cityInput.value = currentCity;
        displayCurrentWeather(data);
        
        // Get forecast after getting current weather
        const forecastResponse = await fetch(`${API_BASE_URL}/forecast?lat=${lat}&lon=${lon}&units=${currentUnit}`);
        const forecastData = await forecastResponse.json();
        
        if (forecastData.error) {
            throw new Error(forecastData.error);
        }
        
        displayForecast(forecastData);
        
    } catch (error) {
        currentWeatherDiv.innerHTML = `<div class="error-message">Error: ${error.message}</div>`;
        forecastContainer.innerHTML = '';
        console.error('Error:', error);
    } finally {
        hideLoader();
    }
}

async function getAIPrediction(city) {
    showLoader();
    try {
        const response = await fetch(`${API_BASE_URL}/prediction?city=${city}&days=5&units=${currentUnit}`);
        const data = await response.json();
        
        if (data.error) {
            throw new Error(data.error);
        }
        
        displayPrediction(data);
        
    } catch (error) {
        predictionContainer.innerHTML = `<div class="error-message">Error: ${error.message}</div>`;
        console.error('Error:', error);
    } finally {
        hideLoader();
    }
}

function displayCurrentWeather(data) {
    // Safety check
    if (!data || !data.weather || !data.weather[0] || !data.main || !data.sys) {
        currentWeatherDiv.innerHTML = '<div class="error-message">Invalid weather data received. Please try another city.</div>';
        console.error('Invalid weather data structure:', data);
        return;
    }
    
    const tempUnit = currentUnit === 'metric' ? '°C' : '°F';
    const windUnit = currentUnit === 'metric' ? 'm/s' : 'mph';
    
    const date = new Date(data.dt * 1000);
    const formattedDate = date.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
    
    const iconCode = data.weather[0].icon;
    const iconUrl = `http://openweathermap.org/img/wn/${iconCode}@2x.png`;
    
    currentWeatherDiv.innerHTML = `
        <div class="weather-main">
            <img src="${iconUrl}" alt="${data.weather[0].description}" class="weather-icon">
            <div class="temp">${Math.round(data.main.temp)}${tempUnit}</div>
            <div class="weather-description">${data.weather[0].description}</div>
            <div class="city-name">${data.name}, ${data.sys.country}</div>
            <div class="date-time">${formattedDate}</div>
        </div>
        <div class="weather-details">
            <div class="detail">
                <i class="fas fa-thermometer-half"></i>
                <span>Feels like: ${Math.round(data.main.feels_like)}${tempUnit}</span>
            </div>
            <div class="detail">
                <i class="fas fa-tint"></i>
                <span>Humidity: ${data.main.humidity}%</span>
            </div>
            <div class="detail">
                <i class="fas fa-wind"></i>
                <span>Wind: ${data.wind.speed} ${windUnit}</span>
            </div>
            <div class="detail">
                <i class="fas fa-compress-alt"></i>
                <span>Pressure: ${data.main.pressure} hPa</span>
            </div>
            <div class="detail">
                <i class="fas fa-eye"></i>
                <span>Visibility: ${(data.visibility / 1000).toFixed(1)} km</span>
            </div>
            <div class="detail">
                <i class="fas fa-sun"></i>
                <span>Sunrise: ${new Date(data.sys.sunrise * 1000).toLocaleTimeString()}</span>
            </div>
            <div class="detail">
                <i class="fas fa-moon"></i>
                <span>Sunset: ${new Date(data.sys.sunset * 1000).toLocaleTimeString()}</span>
            </div>
        </div>
    `;
}

function displayForecast(data) {
    forecastContainer.innerHTML = '';
    
    // Safety check
    if (!data || !data.list || !Array.isArray(data.list) || data.list.length === 0) {
        forecastContainer.innerHTML = '<div class="error-message">No forecast data available.</div>';
        console.error('Invalid forecast data structure:', data);
        return;
    }
    
    const tempUnit = currentUnit === 'metric' ? '°C' : '°F';
    
    // Group forecast data by day
    const dailyData = {};
    
    data.list.forEach(item => {
        const date = new Date(item.dt * 1000);
        const day = date.toLocaleDateString('en-US', { weekday: 'long' });
        
        if (!dailyData[day] || date.getHours() === 12) {
            dailyData[day] = item;
        }
    });
    
    // Display forecast for each day (limit to 5 days)
    let count = 0;
    for (const day in dailyData) {
        if (count >= 5) break;
        
        const item = dailyData[day];
        const date = new Date(item.dt * 1000);
        const formattedDate = date.toLocaleDateString('en-US', {
            weekday: 'long',
            month: 'short',
            day: 'numeric'
        });
        
        const iconCode = item.weather[0].icon;
        const iconUrl = `http://openweathermap.org/img/wn/${iconCode}@2x.png`;
        
        const forecastItem = document.createElement('div');
        forecastItem.className = 'forecast-item';
        forecastItem.innerHTML = `
            <div class="forecast-day">${formattedDate}</div>
            <img src="${iconUrl}" alt="${item.weather[0].description}" class="forecast-icon">
            <div class="forecast-temp">${Math.round(item.main.temp)}${tempUnit}</div>
            <div class="forecast-description">${item.weather[0].description}</div>
            <div class="forecast-detail">
                <i class="fas fa-tint"></i> ${item.main.humidity}%
            </div>
            <div class="forecast-detail">
                <i class="fas fa-wind"></i> ${item.wind.speed} ${currentUnit === 'metric' ? 'm/s' : 'mph'}
            </div>
        `;
        
        forecastContainer.appendChild(forecastItem);
        count++;
    }
}

function displayPrediction(data) {
    predictionContainer.innerHTML = '';
    
    // Safety check
    if (!data || !data.predictions || !Array.isArray(data.predictions) || data.predictions.length === 0) {
        predictionContainer.innerHTML = '<div class="error-message">No prediction data available.</div>';
        console.error('Invalid prediction data structure:', data);
        return;
    }
    
    const tempUnit = currentUnit === 'metric' ? '°C' : '°F';
    
    // Display each prediction
    data.predictions.forEach(item => {
        const date = new Date(item.timestamp * 1000);
        const formattedDate = date.toLocaleDateString('en-US', {
            weekday: 'short',
            month: 'short',
            day: 'numeric',
            hour: '2-digit'
        });
        
        const predictionItem = document.createElement('div');
        predictionItem.className = 'prediction-item';
        predictionItem.innerHTML = `
            <div class="prediction-date">${formattedDate}</div>
            <div class="prediction-temp">${item.temp}${tempUnit}</div>
            <div class="prediction-detail">
                <i class="fas fa-tint"></i> ${item.humidity}%
            </div>
            <div class="prediction-detail">
                <i class="fas fa-compress-alt"></i> ${item.pressure} hPa
            </div>
        `;
        
        predictionContainer.appendChild(predictionItem);
    });
}

// Initialize with a default city
window.addEventListener('load', () => {
    cityInput.value = 'New York';
    currentCity = 'New York';
    getWeatherData(currentCity);
});