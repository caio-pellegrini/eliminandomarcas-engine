const cron = require('node-cron');
const {loadConfig} = require('./config');
const {createLogger} = require('./config/logger');
const {readSeasonState} = require('./core/seasonState');
const {dailyRun} = require('./jobs/dailyRun');
const {createDiscordNotifier} = require('./notify/discord');

async function main() {
  const config = loadConfig();
  const logger = createLogger(config.logLevel);
  const notifier = createDiscordNotifier({webhookUrl: config.discordWebhookUrl, logger});
  await readSeasonState(config.statePath);

  const run = () => dailyRun({config, logger, notifier});

  if (process.argv.includes('--run-now')) {
    await run();
    return;
  }

  if (!cron.validate(config.cronSchedule)) {
    throw new Error(`CRON_SCHEDULE inválido: ${config.cronSchedule}`);
  }
  cron.schedule(config.cronSchedule, async () => {
    try {
      await run();
    } catch {
      // dailyRun já registrou e notificou o erro; o cron deve continuar ativo.
    }
  }, {timezone: config.timezone, noOverlap: true});
  logger.info({schedule: config.cronSchedule, timezone: config.timezone, publishEnabled: config.publishEnabled}, 'Eliminando Marcas Engine iniciado; aguardando próxima execução');
}

main().catch((error) => {
  const logger = createLogger();
  logger.fatal({err: error}, 'Não foi possível iniciar o Eliminando Marcas Engine');
  process.exitCode = 1;
});
