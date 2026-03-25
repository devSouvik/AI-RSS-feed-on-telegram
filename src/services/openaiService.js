'use strict';

const { AzureOpenAI } = require('openai');
const config = require('../config');
const logger = require('../utils/logger');

const MAX_ARTICLES_TO_SEND = 30;
const MAX_TOKENS_RESPONSE = 50000;

/**
 * Lazily created Azure OpenAI client (singleton).
 * @type {AzureOpenAI|null}
 */
let _client = null;

function getClient () {
  if (!_client) {
    // If the user provided a full URL in AZURE_OPENAI_ENDPOINT that already includes the deployment
    // (e.g. https://.../openai/deployments/model), use it directly. Otherwise, construct the base URL.
    let baseUrl = config.azure.endpoint;
    if (!baseUrl.includes('/openai/deployments/')) {
      // Ensure no trailing slash before appending
      baseUrl = baseUrl.replace(/\/$/, '');
      baseUrl = `${baseUrl}/openai/deployments/${config.azure.deploymentName}`;
    }

    logger.info(`[openaiService] Initialising Azure OpenAI client with baseURL: ${baseUrl}`);

    _client = new AzureOpenAI({
      baseURL: baseUrl,
      apiVersion: "2024-12-01-preview",
      apiKey: config.azure.apiKey,
      defaultQuery: { 'api-version': "2024-12-01-preview" },
    });
  }
  return _client;
}

/**
 * Builds the system prompt for ranking.
 * @returns {string}
 */
function buildSystemPrompt () {
  return `You are a news analyst AI. Your task is to analyse a list of news articles fetched from RSS feeds and identify the top 10 most relevant, interesting, and "hot" (trending/recent) articles for the given topic.

Rules:
- Select exactly 10 articles (or fewer if less than 10 are provided).
- Prioritise recency, relevance to the topic, and newsworthiness.
- Remove duplicates or near-duplicate stories — keep only the most informative version.
- For each selected article, write a detailed and highly informative yet crisp summary (approx. 3-4 sentences, 40-60 words). It MUST capture the core facts, context, and key takeaways so the user doesn't need to read the full article.
- Return ONLY a valid JSON array, no other text, no markdown, no code fences.

Output format (strict JSON array):
[
  {
    "title": "Article title here",
    "url": "https://article-url-here",
    "summary": "Detailed, highly informative 3-4 sentence summary here that captures all key facts.",
    "source": "Source name"
  }
]`;
}

/**
 * Builds the user message with the topic and articles.
 * @param {string} topic
 * @param {Array<{title: string, link: string, source: string}>} articles
 * @returns {string}
 */
function buildUserMessage (topic, articles) {
  const articleList = articles
    .slice(0, MAX_ARTICLES_TO_SEND)
    .map((a, i) => `${i + 1}. [${a.source}] ${a.title} — ${a.link}`)
    .join('\n');

  return `Topic: "${topic}"\n\nArticles to analyse:\n${articleList}`;
}

/**
 * Robustly extracts a JSON array from a raw model response string.
 * Handles: plain JSON array, code-fenced JSON, or object-wrapped arrays.
 * @param {string} raw
 * @returns {Array}
 */
function extractJsonArray (raw) {
  // Strip markdown code fences (```json ... ``` or ``` ... ```)
  const stripped = raw.replace(/```(?:json)?\s*([\s\S]*?)```/gi, '$1').trim();

  // Try direct parse first
  try {
    const parsed = JSON.parse(stripped);
    if (Array.isArray(parsed)) { return parsed; }
    // Unwrap common envelope shapes: { results: [] }, { articles: [] }, etc.
    const firstArray = Object.values(parsed).find(v => Array.isArray(v));
    if (firstArray) { return firstArray; }
  } catch (_) { /* fall through to regex extraction */ }

  // Fallback: find the first [...] block in the raw text
  const match = raw.match(/\[[\s\S]*\]/);
  if (match) {
    const parsed = JSON.parse(match[0]);
    if (Array.isArray(parsed)) { return parsed; }
  }

  throw new Error('No valid JSON array found in model response');
}

/**
 * Uses Azure OpenAI to rank and summarise the top 10 RSS articles for a topic.
 *
 * @param {string} topic - The user's search topic
 * @param {Array<{title: string, link: string, source: string}>} articles - Candidate articles from RSS
 * @returns {Promise<Array<{title: string, url: string, summary: string, source: string}>>}
 */
async function rankTopResults (topic, articles) {
  const client = getClient();

  const userMessage = buildUserMessage(topic, articles);

  logger.info('[openaiService] Sending articles to Azure OpenAI for ranking', {
    topic,
    articleCount: Math.min(articles.length, MAX_ARTICLES_TO_SEND),
    deployment: config.azure.deploymentName,
  });

  const response = await client.chat.completions.create({
    model: config.azure.deploymentName,
    messages: [
      { role: 'system', content: buildSystemPrompt() },
      { role: 'user', content: userMessage },
    ],
    max_completion_tokens: MAX_TOKENS_RESPONSE,
    // temperature: 0.3,
    // Note: response_format is intentionally omitted — not all Azure deployments/
    // API versions support JSON mode. We extract JSON from plain text instead.
  });

  const raw = response.choices?.[0]?.message?.content;

  if (!raw) {
    console.error('[openaiService] Full response object:', JSON.stringify(response, null, 2));
    throw new Error('Azure OpenAI returned an empty response');
  }

  logger.debug('[openaiService] Raw OpenAI response', { raw });

  // Robustly extract a JSON array from the response.
  // The model may wrap it in code fences or a JSON object — handle all cases.
  let results;
  try {
    results = extractJsonArray(raw);
  } catch (err) {
    logger.error('[openaiService] Failed to extract JSON from response', { raw, error: err.message });
    throw new Error(`Failed to parse OpenAI JSON response: ${err.message}`);
  }

  if (!Array.isArray(results)) {
    throw new Error('OpenAI response is not a valid array of articles');
  }

  // Validate and sanitise each result
  const sanitised = results
    .filter(item => item && typeof item.title === 'string' && typeof item.url === 'string')
    .slice(0, 10)
    .map(item => ({
      title: String(item.title).trim(),
      url: String(item.url).trim(),
      summary: item.summary ? String(item.summary).trim() : '',
      source: item.source ? String(item.source).trim() : 'Unknown',
    }));

  logger.info('[openaiService] Successfully ranked articles', {
    topic,
    resultCount: sanitised.length,
  });

  return sanitised;
}

module.exports = { rankTopResults };
