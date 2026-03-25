'use strict';

const { fetchRssFeeds } = require('../services/rssFetcher');
const { rankTopResults } = require('../services/openaiService');
const { formatTopResults, formatNoResults, formatErrorMessage } = require('../utils/formatter');
const { handleError } = require('../utils/errorHandler');
const logger = require('../utils/logger');

const TYPING_INTERVAL_MS = 4000;

/**
 * Sends a Telegram "typing..." action periodically until cancelled.
 * @param {import('node-telegram-bot-api')} bot
 * @param {number} chatId
 * @returns {{ stop: Function }}
 */
function startTypingIndicator(bot, chatId) {
  bot.sendChatAction(chatId, 'typing').catch(() => {});
  const interval = setInterval(() => {
    bot.sendChatAction(chatId, 'typing').catch(() => {});
  }, TYPING_INTERVAL_MS);

  return { stop: () => clearInterval(interval) };
}

/**
 * Full pipeline: fetch RSS → AI ranking → Telegram reply.
 *
 * @param {import('node-telegram-bot-api')} bot
 * @param {number} chatId
 * @param {number} userId
 * @param {string} topic
 */
async function handleTopic(bot, chatId, userId, topic) {
  const typing = startTypingIndicator(bot, chatId);

  try {
    logger.info('[topicHandler] Starting topic pipeline', { userId, chatId, topic });

    // 1. Fetch RSS articles from all sources in parallel
    const articles = await fetchRssFeeds(topic);

    if (articles.length === 0) {
      typing.stop();
      await bot.sendMessage(chatId, formatNoResults(topic), { parse_mode: 'HTML' });
      return;
    }

    // 2. Ask Azure OpenAI to rank and summarise the top 10
    const topResults = await rankTopResults(topic, articles);

    if (topResults.length === 0) {
      typing.stop();
      await bot.sendMessage(chatId, formatNoResults(topic), { parse_mode: 'HTML' });
      return;
    }

    // 3. Format and send the reply (in chunks to avoid message length limits)
    const messages = formatTopResults(topic, topResults);

    typing.stop();
    for (const msg of messages) {
      await bot.sendMessage(chatId, msg, {
        parse_mode: 'HTML',
        disable_web_page_preview: true,
      });
      // Small delay to ensure messages arrive in order
      await new Promise(resolve => setTimeout(resolve, 300));
    }

    logger.info('[topicHandler] Successfully delivered results', {
      userId,
      chatId,
      topic,
      resultCount: topResults.length,
    });
  } catch (err) {
    typing.stop();
    const { userMessage } = handleError(err, 'topicHandler');

    try {
      await bot.sendMessage(chatId, formatErrorMessage(userMessage), { parse_mode: 'HTML' });
    } catch (sendErr) {
      logger.error('[topicHandler] Failed to send error message to user', {
        sendError: sendErr.message,
        originalError: err.message,
      });
    }
  }
}

module.exports = { handleTopic };
