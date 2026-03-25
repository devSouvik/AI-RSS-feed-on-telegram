'use strict';

const winston = require('winston');

// Lazy-load config to avoid circular deps; fallback defaults for early-init logging
let logLevel = 'info';
let isProduction = false;

try {
  const config = require('../config');
  logLevel = config.app.logLevel;
  isProduction = config.app.isProduction;
} catch (_) {
  // Config not yet loaded — use defaults
}

const { combine, timestamp, json, colorize, printf, errors } = winston.format;

const devFormat = combine(
  colorize(),
  timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  errors({ stack: true }),
  printf(({ level, message, timestamp: ts, ...meta }) => {
    const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
    return `${ts} [${level}]: ${message}${metaStr}`;
  }),
);

const prodFormat = combine(
  timestamp(),
  errors({ stack: true }),
  json(),
);

const logger = winston.createLogger({
  level: logLevel,
  format: isProduction ? prodFormat : devFormat,
  transports: [
    new winston.transports.Console(),
  ],
  exitOnError: false,
});

module.exports = logger;
