# RSS Feed Telegram Bot

A **production-ready Telegram chatbot** powered by **Azure OpenAI GPT-4o** and live **RSS feeds**.  
Send any topic name, get the **Top 10 hottest news items** from across the internet — ranked and summarised by AI.

---

## Features

- 🔍 **Multi-source RSS** — Google News, Reddit, HackerNews, TechCrunch, Wired, BBC, Dev.to fetched in parallel
- 🤖 **AI Ranking** — Azure OpenAI GPT-4o selects, de-duplicates, and summarises the most relevant results
- ⚡ **Rate Limiting** — per-user configurable throttle to prevent abuse
- 📋 **Structured Logging** — Winston JSON logs in production, pretty console in dev
- 🔒 **Validated Config** — Joi schema validation at startup; fails fast on missing secrets
- 🛡️ **Graceful Shutdown** — SIGTERM/SIGINT handling
- ✅ **Unit Tested** — Jest test suite with mocked external dependencies

---

## Prerequisites

| Requirement | Version |
|---|---|
| Node.js | ≥ 18.0.0 |
| npm | ≥ 9.0.0 |
| Telegram Bot Token | From [@BotFather](https://t.me/BotFather) |
| Azure OpenAI Resource | With GPT-4o deployed |

---

## Setup

### 1. Clone & Install
```bash
cd c:\my_works\RSS_feed
npm install
```

### 2. Configure Environment
```bash
copy .env.example .env
```
Then edit `.env` and fill in:
- `TELEGRAM_BOT_TOKEN` — from @BotFather
- `AZURE_OPENAI_ENDPOINT` — your Azure OpenAI resource URL
- `AZURE_OPENAI_API_KEY` — from Azure Portal → Keys and Endpoint
- `AZURE_OPENAI_DEPLOYMENT_NAME` — your GPT-4o deployment name (e.g. `gpt-4o`)

### 3. Run
```bash
# Development (with file watch)
npm run dev

# Production
npm start
```

---

## Usage (Telegram)

| Command | Description |
|---|---|
| `/start` | Welcome message & quick guide |
| `/help` | Full usage instructions |
| `/top <topic>` | Get top 10 news for a topic |
| Any plain text | Also treated as a topic search |

**Example:**
```
/top artificial intelligence
/top climate change
/top crypto market
```

---

## Project Structure

```
├── index.js                  # Entry point & graceful shutdown
├── src/
│   ├── bot.js                # Telegram bot setup & routing
│   ├── config/
│   │   └── index.js          # Env validation (Joi)
│   ├── services/
│   │   ├── rssFetcher.js     # Parallel RSS fetching
│   │   └── openaiService.js  # Azure OpenAI GPT-4o client
│   ├── handlers/
│   │   └── topicHandler.js   # Orchestration pipeline
│   └── utils/
│       ├── logger.js         # Winston logger
│       ├── rateLimiter.js    # Per-user rate limiter
│       ├── formatter.js      # Telegram Markdown builder
│       └── errorHandler.js   # Error categorisation
├── tests/                    # Jest unit tests
├── .env.example              # Environment template
└── .eslintrc.json            # ESLint config
```

---

## Scripts

```bash
npm start             # Run in production
npm run dev           # Run with file watch (Node 18+)
npm test              # Run unit tests
npm run test:coverage # Run with coverage report
npm run lint          # Lint check
npm run lint:fix      # Auto-fix lint issues
```

---

## Rate Limiting

Default: **5 messages/user/minute** (configurable via `RATE_LIMIT_PER_USER_PER_MIN` in `.env`).  
Users who exceed the limit receive a friendly cooldown message.

---

## Environment Variables Reference

| Variable | Required | Default | Description |
|---|---|---|---|
| `TELEGRAM_BOT_TOKEN` | ✅ | — | Telegram bot token from @BotFather |
| `AZURE_OPENAI_ENDPOINT` | ✅ | — | Azure OpenAI resource endpoint URL |
| `AZURE_OPENAI_API_KEY` | ✅ | — | Azure OpenAI API key |
| `AZURE_OPENAI_DEPLOYMENT_NAME` | ✅ | — | GPT-4o deployment name |
| `AZURE_OPENAI_API_VERSION` | ✅ | `2024-02-01` | Azure OpenAI API version |
| `NODE_ENV` | ❌ | `development` | `development` or `production` |
| `LOG_LEVEL` | ❌ | `info` | `error`, `warn`, `info`, `debug` |
| `RATE_LIMIT_PER_USER_PER_MIN` | ❌ | `5` | Messages per user per minute |

---

## Deployment to Azure Functions

### Prerequisites
1. An Azure subscription
2. Azure Functions resource created (Node.js 22.x runtime)

### Step 1: Download Publish Profile

1. Go to **Azure Portal** → Your Function App
2. Click **Get publish profile** (or **Download publish profile**) in the toolbar
3. A `.PublishSettings` XML file will be downloaded
4. Open it with a text editor and copy the entire contents

### Step 2: Configure GitHub Secret

Go to your GitHub repository → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**

Add the following secret:

| Secret Name | Value |
|---|---|
| `AZURE_FUNCTIONAPP_PUBLISH_PROFILE` | Paste the entire contents of the `.PublishSettings` file |

### Step 3: Configure Application Settings in Azure

In Azure Portal, go to your Function App → **Configuration** → **Application settings** and add:

- `TELEGRAM_BOT_TOKEN`
- `AZURE_OPENAI_ENDPOINT`
- `AZURE_OPENAI_API_KEY`
- `AZURE_OPENAI_DEPLOYMENT_NAME`
- `AZURE_OPENAI_API_VERSION`
- `NODE_ENV=production`
- `LOG_LEVEL=info`
- `RATE_LIMIT_PER_USER_PER_MIN=5`

### Step 4: Update Workflow

Edit `.github/workflows/azure-functions-deploy.yml` and replace `AZURE_FUNCTIONAPP_NAME` with your actual Function App name.

### Step 5: Deploy

Push to `main` branch or manually trigger the workflow:
```bash
git add .
git commit -m "Configure deployment"
git push origin main
```

Or use the GitHub Actions UI: **Actions** tab → **Deploy to Azure Functions** → **Run workflow**

---

## License

MIT
