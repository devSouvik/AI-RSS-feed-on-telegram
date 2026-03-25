'use strict';

const axios = require('axios');
const axiosRetry = require('axios-retry');
const config = require('../config');
const logger = require('./logger');

// Configure axios with retry logic for Telegram API
const telegramAxios = axios.create({
  baseURL: `https://api.telegram.org/bot${config.telegram.botToken}`,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Retry failed requests (network errors, 429 rate limits, 5xx errors)
axiosRetry(telegramAxios, {
  retries: 3,
  retryDelay: axiosRetry.exponentialDelay,
  retryCondition: (error) => {
    return (
      axiosRetry.isNetworkOrIdempotentRequestError(error) ||
            error.response?.status === 429 ||
            (error.response?.status >= 500 && error.response?.status < 600)
    );
  },
  onRetry: (retryCount, error) => {
    logger.warn('[telegramApi] Retrying request', {
      retryCount,
      error: error.message,
      url: error.config?.url,
    });
  },
});

/**
 * Send a message via Telegram Bot API using axios (more reliable in serverless)
 * @param {number|string} chatId - Telegram chat ID
 * @param {string} text - Message text
 * @param {object} options - Additional options (parse_mode, reply_markup, etc.)
 * @returns {Promise<object>} Telegram API response
 */
async function sendMessage (chatId, text, options = {}) {
  try {
    const response = await telegramAxios.post('/sendMessage', {
      chat_id: chatId,
      text,
      ...options,
    });

    logger.debug('[telegramApi] Message sent successfully', {
      chatId,
      messageId: response.data.result?.message_id,
    });

    return response.data;
  } catch (error) {
    logger.error('[telegramApi] Failed to send message', {
      chatId,
      error: error.message,
      status: error.response?.status,
      data: error.response?.data,
    });
    throw error;
  }
}

/**
 * Send a chat action (typing, upload_photo, etc.)
 * @param {number|string} chatId - Telegram chat ID
 * @param {string} action - Action type (typing, upload_photo, etc.)
 */
async function sendChatAction (chatId, action) {
  try {
    await telegramAxios.post('/sendChatAction', {
      chat_id: chatId,
      action,
    });
  } catch (error) {
    logger.warn('[telegramApi] Failed to send chat action', {
      chatId,
      action,
      error: error.message,
    });
    // Don't throw - chat actions are not critical
  }
}

module.exports = {
  sendMessage,
  sendChatAction,
};
