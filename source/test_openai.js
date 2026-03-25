require('dotenv').config();
const { fetchRssFeeds } = require('./src/services/rssFetcher');
const { rankTopResults } = require('./src/services/openaiService');

async function test() {
  try {
    const articles = await fetchRssFeeds("Iran Iraqi war");
    console.log(`Fetched ${articles.length} articles`);
    await rankTopResults('Iran Iraqi war', articles);
  } catch (err) {
    console.error('Test failed:', err);
  }
}
test();
