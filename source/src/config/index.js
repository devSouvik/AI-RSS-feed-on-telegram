'use strict';

const Joi = require('joi');

const schema = Joi.object({
  TELEGRAM_BOT_TOKEN: Joi.string().required(),
  AZURE_OPENAI_ENDPOINT: Joi.string().uri().required(),
  AZURE_OPENAI_API_KEY: Joi.string().required(),
  AZURE_OPENAI_DEPLOYMENT_NAME: Joi.string().required(),
  AZURE_OPENAI_API_VERSION: Joi.string().default('2024-02-01'),
  NODE_ENV: Joi.string().valid('development', 'production', 'test').default('development'),
  LOG_LEVEL: Joi.string().valid('error', 'warn', 'info', 'debug').default('info'),
  RATE_LIMIT_PER_USER_PER_MIN: Joi.number().integer().min(1).max(60).default(5),
}).unknown(true);

const { error, value: env } = schema.validate(process.env);

if (error) {
  throw new Error(`[Config] Invalid environment configuration: ${error.message}`);
}

const config = Object.freeze({
  telegram: {
    botToken: env.TELEGRAM_BOT_TOKEN,
  },
  azure: {
    endpoint: env.AZURE_OPENAI_ENDPOINT,
    apiKey: env.AZURE_OPENAI_API_KEY,
    deploymentName: env.AZURE_OPENAI_DEPLOYMENT_NAME,
    apiVersion: env.AZURE_OPENAI_API_VERSION,
  },
  app: {
    nodeEnv: env.NODE_ENV,
    logLevel: env.LOG_LEVEL,
    rateLimitPerUserPerMin: parseInt(env.RATE_LIMIT_PER_USER_PER_MIN, 10),
    isProduction: env.NODE_ENV === 'production',
  },
});

module.exports = config;
