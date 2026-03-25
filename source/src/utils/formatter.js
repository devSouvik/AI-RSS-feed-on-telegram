'use strict';

/**
 * Escapes special characters for Telegram HTML parse mode.
 * Only &, <, > need escaping — far more robust than MarkdownV2 with AI-generated content.
 * @param {string} text
 * @returns {string}
 */
function escapeHtml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * Builds a formatted Telegram HTML message for the top results.
 *
 * @param {string} topic - The user's original topic query
 * @param {Array<{title: string, url: string, summary: string, source?: string}>} results
 * @returns {string} Telegram HTML-safe message
 */
function formatTopResults(topic, results) {
  const CHUNK_SIZE = 4; // 4 articles per message to stay safely under 4096 limit
  const messages = [];

  const header =
    `🔍 <b>Top ${results.length} results for:</b> <i>${escapeHtml(topic)}</i>\n` +
    `━━━━━━━━━━━━━━━━━━━━━━\n\n`;

  const footer =
    `\n\n━━━━━━━━━━━━━━━━━━━━━━\n` +
    `💡 <i>Send another topic to search again</i>`;

  for (let i = 0; i < results.length; i += CHUNK_SIZE) {
    const chunk = results.slice(i, i + CHUNK_SIZE);
    
    let chunkItems = chunk.map((item, chunkIdx) => {
      const globalIndex = i + chunkIdx;
      const title = escapeHtml(item.title || 'Untitled');
      const summary = escapeHtml(item.summary || '');
      const url = item.url || '';
      const source = item.source ? ` [${escapeHtml(item.source)}]` : '';

      const titleLine = url
        ? `${globalIndex + 1}. <b><a href="${url}">${title}</a></b>${source}`
        : `${globalIndex + 1}. <b>${title}</b>${source}`;

      return summary ? `${titleLine}\n<i>${summary}</i>` : titleLine;
    });

    let chunkMsg = chunkItems.join('\n\n');
    
    // Add header to the very first chunk
    if (i === 0) {
      chunkMsg = header + chunkMsg;
    }
    
    // Add footer to the very last chunk
    if (i + CHUNK_SIZE >= results.length) {
      chunkMsg = chunkMsg + footer;
    }

    messages.push(chunkMsg);
  }

  return messages;
}

/**
 * Builds a rate-limit warning message.
 * @param {number} retryAfterSeconds
 * @returns {string}
 */
function formatRateLimitMessage(retryAfterSeconds) {
  return (
    `⏳ <b>Slow down!</b>\n\n` +
    `You've sent too many requests. Please wait <b>${retryAfterSeconds} seconds</b> before trying again.`
  );
}

/**
 * Builds an error message reply.
 * @param {string} message
 * @returns {string}
 */
function formatErrorMessage(message) {
  return `❌ <b>Something went wrong</b>\n\n${escapeHtml(message)}`;
}

/**
 * Builds a "no results" reply.
 * @param {string} topic
 * @returns {string}
 */
function formatNoResults(topic) {
  return (
    `😕 <b>No results found for:</b> <i>${escapeHtml(topic)}</i>\n\n` +
    `Try a different topic or a more specific keyword.`
  );
}

module.exports = {
  escapeHtml,
  formatTopResults,
  formatRateLimitMessage,
  formatErrorMessage,
  formatNoResults,
};
