'use strict';

const logger = require('./logger');

/**
 * Error categories with user-friendly messages.
 */
const ErrorCategory = {
  NETWORK: 'NETWORK',
  OPENAI: 'OPENAI',
  PARSE: 'PARSE',
  RATE_LIMIT: 'RATE_LIMIT',
  VALIDATION: 'VALIDATION',
  UNKNOWN: 'UNKNOWN',
};

/**
 * Categorises an error and returns a user-friendly message.
 * @param {Error} err
 * @returns {{ category: string, userMessage: string }}
 */
function categoriseError(err) {
  const message = err.message || '';

  if (err.code === 'ECONNABORTED' || err.code === 'ETIMEDOUT' || message.includes('timeout')) {
    return {
      category: ErrorCategory.NETWORK,
      userMessage: 'The request timed out fetching news feeds. Please try again in a moment.',
    };
  }

  if (err.code === 'ENOTFOUND' || err.code === 'ECONNREFUSED') {
    return {
      category: ErrorCategory.NETWORK,
      userMessage: 'Unable to connect to news sources. Please check your internet connection.',
    };
  }

  if (message.includes('openai') || message.includes('Azure') || err.status === 429) {
    return {
      category: ErrorCategory.OPENAI,
      userMessage: 'The AI service is temporarily unavailable. Please try again in a few seconds.',
    };
  }

  if (message.includes('JSON') || message.includes('parse') || message.includes('Unexpected token')) {
    return {
      category: ErrorCategory.PARSE,
      userMessage: 'Received an unexpected response from the AI. Please try again.',
    };
  }

  return {
    category: ErrorCategory.UNKNOWN,
    userMessage: 'An unexpected error occurred. Please try again.',
  };
}

/**
 * Logs and categorises an error from a handler context.
 * @param {Error} err
 * @param {string} context - Where the error originated (e.g. 'topicHandler')
 * @returns {{ category: string, userMessage: string }}
 */
function handleError(err, context = 'unknown') {
  const { category, userMessage } = categoriseError(err);

  logger.error(`[${context}] ${category} error`, {
    message: err.message,
    stack: err.stack,
    code: err.code,
  });

  return { category, userMessage };
}

module.exports = {
  ErrorCategory,
  categoriseError,
  handleError,
};
