'use strict';

const TelegramBot = require('node-telegram-bot-api');
const config = require('./config');
const { handleTopic } = require('./handlers/topicHandler');
const rateLimiter = require('./utils/rateLimiter');
const { formatRateLimitMessage } = require('./utils/formatter');
const logger = require('./utils/logger');

const WELCOME_MESSAGE =
  `👋 <b>Welcome to RSS Feed Bot!</b>\n\n` +
  `I fetch the <b>Top 10 hottest news</b> on any topic from across the internet, powered by AI.\n\n` +
  `<b>How to use:</b>\n` +
  `• Send any topic name directly as a message\n` +
  `• Or use the <code>/top &lt;topic&gt;</code> command\n\n` +
  `<b>Examples:</b>\n` +
  `<code>/top artificial intelligence</code>\n` +
  `<code>/top climate change</code>\n` +
  `<code>climate change</code>\n\n` +
  `Type /help for more info.`;

const HELP_MESSAGE =
  `ℹ️ <b>RSS Feed Bot — Help</b>\n\n` +
  `<b>Commands:</b>\n` +
  `• <code>/start</code> — Welcome message\n` +
  `• <code>/help</code> — Show this help\n` +
  `• <code>/top &lt;topic&gt;</code> — Get top 10 news for a topic\n\n` +
  `<b>Tips:</b>\n` +
  `• Be specific for better results (e.g. "GPT-4 benchmark" vs "AI")\n` +
  `• Works for any topic: tech, finance, sports, science, politics...\n` +
  `• Results are ranked by relevance and recency by AI\n\n` +
  `<b>Rate limit:</b> ${config.app.rateLimitPerUserPerMin} requests per minute per user.`;

/**
 * Creates and configures the Telegram bot instance.
 * @returns {TelegramBot}
 */
function createBot() {
  const bot = new TelegramBot(config.telegram.botToken, {
    polling: false, // Serverless: we will rely on Webhooks instead
  });

  // ── /start ──────────────────────────────────────────────────────────────────
  bot.onText(/\/start/, async (msg) => {
    const chatId = msg.chat.id;
    try {
      await bot.sendMessage(chatId, WELCOME_MESSAGE, { parse_mode: 'HTML' });
    } catch (err) {
      logger.error('[bot] Failed to send /start reply', { error: err.message });
    }
  });

  // ── /help ───────────────────────────────────────────────────────────────────
  bot.onText(/\/help/, async (msg) => {
    const chatId = msg.chat.id;
    try {
      await bot.sendMessage(chatId, HELP_MESSAGE, { parse_mode: 'HTML' });
    } catch (err) {
      logger.error('[bot] Failed to send /help reply', { error: err.message });
    }
  });

  // ── /top <topic> ─────────────────────────────────────────────────────────────
  bot.onText(/\/top (.+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const topic = match[1].trim();

    if (!topic) {
      await bot.sendMessage(chatId, '⚠️ Please provide a topic. Example: <code>/top artificial intelligence</code>', {
        parse_mode: 'HTML',
      });
      return;
    }

    await _handleTopicWithRateLimit(bot, chatId, userId, topic);
  });

  // ── Plain text messages (treated as topic queries) ──────────────────────────
  bot.on('message', async (msg) => {
    // Ignore commands (they are handled above)
    if (!msg.text || msg.text.startsWith('/')) { return; }

    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const topic = msg.text.trim();

    if (topic.length < 2) {
      await bot.sendMessage(chatId, '⚠️ Please enter a topic with at least 2 characters.', {
        parse_mode: 'HTML',
      });
      return;
    }

    await _handleTopicWithRateLimit(bot, chatId, userId, topic);
  });

  // ── Global polling error handler ─────────────────────────────────────────────
  bot.on('polling_error', (err) => {
    logger.error('[bot] Polling error', { message: err.message, code: err.code });
  });

  bot.on('error', (err) => {
    logger.error('[bot] General bot error', { message: err.message });
  });

  return bot;
}

/**
 * Rate-limit check wrapper before calling the topic handler.
 * @param {TelegramBot} bot
 * @param {number} chatId
 * @param {number} userId
 * @param {string} topic
 */
async function _handleTopicWithRateLimit(bot, chatId, userId, topic) {
  if (!rateLimiter.isAllowed(userId)) {
    const retryAfter = rateLimiter.getRetryAfterSeconds(userId);
    logger.warn('[bot] Rate limit exceeded', { userId, chatId });
    try {
      await bot.sendMessage(chatId, formatRateLimitMessage(retryAfter), {
        parse_mode: 'HTML',
      });
    } catch (err) {
      logger.error('[bot] Failed to send rate-limit message', { error: err.message });
    }
    return;
  }

  await handleTopic(bot, chatId, userId, topic);
}

module.exports = { createBot };
