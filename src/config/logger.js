const pino = require('pino');

function createLogger(level = process.env.LOG_LEVEL || 'info') {
  return pino({
    level,
    base: {app: 'eliminandomarcas-engine'},
    timestamp: pino.stdTimeFunctions.isoTime,
  });
}

module.exports = {createLogger};
