const path = require('node:path');
const dotenv = require('dotenv');

dotenv.config({quiet: true});

const projectRoot = path.resolve(__dirname, '../..');

function parseBoolean(value, fallback = false) {
  if (value === undefined || value === '') return fallback;
  if (value === 'true') return true;
  if (value === 'false') return false;
  throw new Error(`Valor booleano inválido: ${value}. Use true ou false.`);
}

function parseInteger(value, fallback, name) {
  const parsed = Number.parseInt(value ?? String(fallback), 10);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${name} deve ser um número inteiro positivo.`);
  }
  return parsed;
}

function loadConfig(env = process.env) {
  const timezone = env.TIMEZONE || 'America/Sao_Paulo';
  try {
    new Intl.DateTimeFormat('pt-BR', {timeZone: timezone}).format();
  } catch {
    throw new Error(`TIMEZONE inválido: ${timezone}`);
  }

  const videoDurationSeconds = parseInteger(env.VIDEO_DURATION_SECONDS, 7, 'VIDEO_DURATION_SECONDS');
  if (videoDurationSeconds < 5 || videoDurationSeconds > 8) {
    throw new Error('VIDEO_DURATION_SECONDS deve ficar entre 5 e 8 segundos.');
  }

  return Object.freeze({
    projectRoot,
    activeSeason: env.ACTIVE_SEASON || 'season-1-carros.json',
    statePath: path.resolve(env.DATA_DIR || path.join(projectRoot, 'data/seasons'), env.ACTIVE_SEASON || 'season-1-carros.json'),
    outputDir: path.resolve(env.OUTPUT_DIR || path.join(projectRoot, 'output')),
    audioDir: path.resolve(env.AUDIO_DIR || path.join(projectRoot, 'assets/audio')),
    cronSchedule: env.CRON_SCHEDULE || '0 12 * * *',
    timezone,
    publishEnabled: parseBoolean(env.PUBLISH_ENABLED, false),
    discordWebhookUrl: env.DISCORD_WEBHOOK_URL || '',
    ffmpegPath: env.FFMPEG_PATH || 'ffmpeg',
    renderConcurrency: env.REMOTION_CONCURRENCY || null,
    videoDurationSeconds,
    logLevel: env.LOG_LEVEL || 'info',
  });
}

module.exports = {loadConfig, parseBoolean};
