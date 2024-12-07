const fs = require('fs');
const cron = require('node-cron');
const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');
require('dotenv').config();

const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const WEATHER_API_KEY = process.env.WEATHER_API_KEY;

const bot = new TelegramBot(TOKEN, { polling: true });

let subscribers = [];

// Load existing subscribers from file
if (fs.existsSync('subscribers.json')) {
    subscribers = JSON.parse(fs.readFileSync('subscribers.json', 'utf-8'));
}

// Save subscribers to file
const saveSubscribers = () => {
    fs.writeFileSync('subscribers.json', JSON.stringify(subscribers, null, 2));
};

// Helper function to get weather emoji
const getWeatherEmoji = (weatherMain) => {
    const emojiMap = {
        'Clear': '☀️',
        'Clouds': '☁️',
        'Rain': '🌧️',
        'Snow': '❄️',
        'Thunderstorm': '⛈️',
        'Drizzle': '🌦️',
        'Mist': '🌫️',
        'Smoke': '🌫️',
        'Haze': '🌫️',
        'Dust': '💨',
        'Fog': '🌫️',
        'Sand': '💨',
        'Ash': '💨',
        'Squall': '💨',
        'Tornado': '🌪️'
    };
    return emojiMap[weatherMain] || '🌈';
};

// /start command
bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    bot.sendMessage(
        chatId,
        `Welcome to the Enhanced Weather Bot! 🌤️

You can:
- Send a location or city name to get weather updates.
- Use /subscribe <city> to get daily weather updates.
- Use /unsubscribe to stop updates.
- Use /forecast <city> to get a 5-day forecast.
- Use /help to see this message again.

Enjoy your weather updates! ☀️🌧️❄️`
    );
});

// Subscribe command
bot.onText(/\/subscribe (.+)/, (msg, match) => {
    const chatId = msg.chat.id;
    const location = match[1];

    if (subscribers.some((sub) => sub.chatId === chatId)) {
        bot.sendMessage(chatId, "You are already subscribed. Use /unsubscribe to stop updates.");
        return;
    }

    subscribers.push({ chatId, location });
    saveSubscribers();
    bot.sendMessage(chatId, `You have subscribed to daily weather updates for ${location}. You'll receive updates every day at 8:00 AM.`);
});

// Unsubscribe command
bot.onText(/\/unsubscribe/, (msg) => {
    const chatId = msg.chat.id;

    subscribers = subscribers.filter((sub) => sub.chatId !== chatId);
    saveSubscribers();
    bot.sendMessage(chatId, "You have unsubscribed from daily weather updates. You can always subscribe again using /subscribe <city>.");
});

// Forecast command
bot.onText(/\/forecast (.+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    const location = match[1];

    try {
        const forecastResponse = await axios.get(
            `https://api.openweathermap.org/data/2.5/forecast?q=${location}&appid=${WEATHER_API_KEY}&units=metric`
        );
        const data = forecastResponse.data;

        let forecastMessage = `5-Day Forecast for ${data.city.name}, ${data.city.country}:\n\n`;

        for (let i = 0; i < data.list.length; i += 8) {
            const forecast = data.list[i];
            const date = new Date(forecast.dt * 1000);
            forecastMessage += `${date.toDateString()}:\n`;
            forecastMessage += `${getWeatherEmoji(forecast.weather[0].main)} ${forecast.weather[0].description}\n`;
            forecastMessage += `🌡️ Temp: ${Math.round(forecast.main.temp)}°C\n`;
            forecastMessage += `💨 Wind: ${forecast.wind.speed} m/s\n\n`;
        }

        bot.sendMessage(chatId, forecastMessage);
    } catch (error) {
        bot.sendMessage(chatId, `Sorry, I couldn't fetch the forecast for ${location}. Please check the city name and try again.`);
    }
});

// Help command
bot.onText(/\/help/, (msg) => {
    const chatId = msg.chat.id;
    bot.sendMessage(
        chatId,
        `Here's how you can use the Enhanced Weather Bot:

- Send a city name to get current weather.
- /subscribe <city>: Get daily weather updates.
- /unsubscribe: Stop daily updates.
- /forecast <city>: Get a 5-day forecast.
- /help: See this message.

Need more help? Contact our support!`
    );
});

// Fetch and send weather
const sendWeatherUpdate = async (subscriber) => {
    const { chatId, location } = subscriber;

    try {
        const weatherResponse = await axios.get(
            `https://api.openweathermap.org/data/2.5/weather?q=${location}&appid=${WEATHER_API_KEY}&units=metric`
        );
        const data = weatherResponse.data;

        const weatherInfo = `
        ${getWeatherEmoji(data.weather[0].main)} *Weather Update for ${data.name}, ${data.sys.country}*

🌡️ *Temperature*: ${Math.round(data.main.temp)}°C
🌥️ *Weather*: ${data.weather[0].description}
💧 *Humidity*: ${data.main.humidity}%
💨 *Wind Speed*: ${data.wind.speed} m/s
🌅 *Sunrise*: ${new Date(data.sys.sunrise * 1000).toLocaleTimeString()}
🌇 *Sunset*: ${new Date(data.sys.sunset * 1000).toLocaleTimeString()}

Have a great day! ☀️
        `;

        bot.sendMessage(chatId, weatherInfo, { parse_mode: 'Markdown' });
    } catch (error) {
        bot.sendMessage(chatId, `Could not fetch weather for ${location}. Please check the location name.`);
    }
};

// Schedule daily updates
cron.schedule('0 8 * * *', () => { // Runs daily at 8:00 AM
    console.log('Sending daily weather updates...');
    subscribers.forEach(sendWeatherUpdate);
});

// Handle city messages
bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text;

    if (text.startsWith('/')) return; // Ignore commands

    try {
        const weatherResponse = await axios.get(
            `https://api.openweathermap.org/data/2.5/weather?q=${text}&appid=${WEATHER_API_KEY}&units=metric`
        );
        const data = weatherResponse.data;

        const weatherInfo = `
        ${getWeatherEmoji(data.weather[0].main)} *Current Weather in ${data.name}, ${data.sys.country}*

🌡️ *Temperature*: ${Math.round(data.main.temp)}°C
🌥️ *Weather*: ${data.weather[0].description}
💧 *Humidity*: ${data.main.humidity}%
💨 *Wind Speed*: ${data.wind.speed} m/s
🌅 *Sunrise*: ${new Date(data.sys.sunrise * 1000).toLocaleTimeString()}
🌇 *Sunset*: ${new Date(data.sys.sunset * 1000).toLocaleTimeString()}

Want daily updates? Use /subscribe ${data.name}
        `;

        bot.sendMessage(chatId, weatherInfo, { parse_mode: 'Markdown' });
    } catch (error) {
        bot.sendMessage(chatId, "Sorry, I couldn't find the weather for that location. Please try again with a different city name!");
    }
});

// console.log('Weather bot is running...');