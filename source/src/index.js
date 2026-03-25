// Azure Functions v4 Programming Model Entry Point
// This file ensures all functions are loaded and registered

// Import all function definitions
require('./functions/telegramWebhook');

// Functions are automatically registered via app.http() calls in each file

// https://api.telegram.org/bot8766864488:AAFh83ea8xLzjNlK-GRzm8V9EBHW87y7kzE/setWebhook?url=https://b463-125-22-135-2.ngrok-free.app/api/telegramWebhook