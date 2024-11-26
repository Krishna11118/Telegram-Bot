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

// /start command
bot.onText(/\/start/, (msg) => {
    bot.sendMessage(
        msg.chat.id,
        `Welcome to the Weather Bot! 🌤️\nYou can:\n- Send a location or city name to get weather updates.\n- Use /subscribe <city> to subscribe to daily weather updates.\n- Use /unsubscribe to stop updates.`
    );
});

// Subscribe command
bot.onText(/\/subscribe (.+)/, (msg, match) => {
    const chatId = msg.chat.id;
    const location = match[1];

    console.log("sub")

    if (subscribers.some((sub) => sub.chatId === chatId)) {
        bot.sendMessage(chatId, "You are already subscribed. Use /unsubscribe to stop updates.");
        return;
    }

    subscribers.push({ chatId, location });
    saveSubscribers();
    bot.sendMessage(chatId, `You have subscribed to daily weather updates for ${location}.`);
});

// Unsubscribe command
bot.onText(/\/unsubscribe/, (msg) => {
    const chatId = msg.chat.id;

    subscribers = subscribers.filter((sub) => sub.chatId !== chatId);
    saveSubscribers();
    bot.sendMessage(chatId, "You have unsubscribed from daily weather updates.");
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
        🌍 *Location*: ${data.name}, ${data.sys.country}
        🌡️ *Temperature*: ${data.main.temp}°C
        🌥️ *Weather*: ${data.weather[0].description}
        💨 *Wind Speed*: ${data.wind.speed} m/s
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
        🌍 *Location*: ${data.name}, ${data.sys.country}
        🌡️ *Temperature*: ${data.main.temp}°C
        🌥️ *Weather*: ${data.weather[0].description}
        💨 *Wind Speed*: ${data.wind.speed} m/s
        `;

        bot.sendMessage(chatId, weatherInfo, { parse_mode: 'Markdown' });
    } catch (error) {
        bot.sendMessage(chatId, "Sorry, I couldn't find the weather for that location. Please try again!");
    }
});
