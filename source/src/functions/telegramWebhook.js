const { app } = require('@azure/functions');
const { createBot } = require('../bot');
const logger = require('../utils/logger');

// Initialise the bot exactly once per cold start to save overhead
let botInstance = null;
try {
  botInstance = createBot();
  logger.info('[webhook] Bot instance created and configured for serverless execution');
} catch (err) {
  logger.error('[webhook] Failed to initialise bot', { error: err.message });
}

app.http('telegramWebhook', {
  methods: ['POST'],
  authLevel: 'anonymous', // Telegram webhooks hit an unpredictable path (or secret token path), no function keys needed if token is in URL
  handler: async (request, context) => {
    try {
      if (!botInstance) {
        context.error('[webhook] Bot instance failed to load previously');
        return { status: 500 };
      }

      // Parse incoming Telegram Webhook payload
      const update = await request.json();
      
      // Pass directly to the bot routing logic
      botInstance.processUpdate(update);

      // Acknowledge receipt to Telegram immediately so it doesn't retry
      return { status: 200, body: 'OK' };
    } catch (err) {
      context.error('[webhook] Unexpected error processing update', err);
      // Even on error, returning 200 stops Telegram from endlessly retrying a poison message
      return { status: 200, body: 'Error but acknowledged' };
    }
  },
});
