'use strict';

const axios = require('axios');
const axiosRetry = require('axios-retry').default;
const RssParser = require('rss-parser');
const logger = require('../utils/logger');

// Configure axios with retry logic for transient failures
const httpClient = axios.create({ timeout: 8000 });
axiosRetry(httpClient, {
  retries: 2,
  retryDelay: axiosRetry.exponentialDelay,
  retryCondition: (err) =>
    axiosRetry.isNetworkOrIdempotentRequestError(err) ||
    (err.response && err.response.status >= 500),
});

const rssParser = new RssParser({
  timeout: 8000,
  customFields: {
    item: ['media:content', 'enclosure'],
  },
});

/**
 * Curated list of RSS feed factory functions.
 * Each returns { name, url } given the search topic.
 * @param {string} topic
 * @returns {Array<{name: string, url: string}>}
 */
function buildFeedSources(topic) {
  const encodedTopic = encodeURIComponent(topic);
  return [
    {
      name: 'Google News',
      url: `https://news.google.com/rss/search?q=${encodedTopic}&hl=en-US&gl=US&ceid=US:en`,
    },
    {
      name: 'Reddit r/worldnews',
      url: `https://www.reddit.com/r/worldnews/search.rss?q=${encodedTopic}&restrict_sr=on&sort=new&limit=20`,
    },
    {
      name: 'Reddit r/news',
      url: `https://www.reddit.com/r/news/search.rss?q=${encodedTopic}&restrict_sr=on&sort=new&limit=20`,
    },
    {
      name: 'Reddit All',
      url: `https://www.reddit.com/search.rss?q=${encodedTopic}&sort=new&limit=20`,
    },
    {
      name: 'HackerNews',
      url: `https://hnrss.org/newest?q=${encodedTopic}&count=20`,
    },
    {
      name: 'Dev.to',
      url: `https://dev.to/feed/tag/${encodedTopic.toLowerCase().replace(/%20/g, '')}`,
    },
    {
      name: 'TechCrunch',
      url: `https://techcrunch.com/wp-json/tc/v1/magazine?tag=${encodedTopic}&per_page=20&_envelope=true`,
    },
    {
      name: 'Wired',
      url: `https://www.wired.com/feed/tag/${encodedTopic}/latest/rss`,
    },
    {
      name: 'BBC News',
      url: 'http://feeds.bbci.co.uk/news/rss.xml',
    },
  ];
}

/**
 * Fetches a single RSS feed and returns normalised articles.
 * @param {{ name: string, url: string }} feedSource
 * @returns {Promise<Array<{title: string, link: string, pubDate: Date|null, source: string}>>}
 */
async function fetchSingleFeed({ name, url }) {
  try {
    const response = await httpClient.get(url, {
      headers: {
        'User-Agent': 'RSSFeedBot/1.0 (+https://github.com/rss-feed-bot)',
        'Accept': 'application/rss+xml, application/xml, text/xml, */*',
      },
      responseType: 'text',
    });

    const feed = await rssParser.parseString(response.data);

    return (feed.items || [])
      .filter(item => item.title && item.link)
      .map(item => ({
        title: item.title.trim(),
        link: item.link.trim(),
        pubDate: item.pubDate ? new Date(item.pubDate) : null,
        source: name,
      }));
  } catch (err) {
    logger.warn(`[rssFetcher] Failed to fetch feed "${name}"`, {
      url,
      error: err.message,
    });
    return [];
  }
}

/**
 * De-duplicates articles by link URL.
 * @param {Array} articles
 * @returns {Array}
 */
function deduplicateByLink(articles) {
  const seen = new Set();
  return articles.filter(article => {
    if (seen.has(article.link)) { return false; }
    seen.add(article.link);
    return true;
  });
}

/**
 * Fetches articles from all curated RSS sources in parallel for a given topic.
 * Returns up to 40 de-duplicated, newest-first articles.
 *
 * @param {string} topic - The user's search topic
 * @returns {Promise<Array<{title: string, link: string, pubDate: Date|null, source: string}>>}
 */
async function fetchRssFeeds(topic) {
  const sources = buildFeedSources(topic);

  logger.info(`[rssFetcher] Fetching ${sources.length} feeds for topic: "${topic}"`);

  const results = await Promise.allSettled(sources.map(fetchSingleFeed));

  const allArticles = results.flatMap((result, index) => {
    if (result.status === 'fulfilled') {
      return result.value;
    }
    logger.warn(`[rssFetcher] Feed ${sources[index].name} rejected`, {
      reason: result.reason?.message,
    });
    return [];
  });

  const deduplicated = deduplicateByLink(allArticles);

  // Sort by date descending (nulls last)
  deduplicated.sort((a, b) => {
    if (!a.pubDate && !b.pubDate) { return 0; }
    if (!a.pubDate) { return 1; }
    if (!b.pubDate) { return -1; }
    return b.pubDate.getTime() - a.pubDate.getTime();
  });

  const candidates = deduplicated.slice(0, 40);

  logger.info(`[rssFetcher] Fetched ${candidates.length} candidate articles for topic: "${topic}"`);

  return candidates;
}

module.exports = { fetchRssFeeds, buildFeedSources };
