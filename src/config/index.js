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

  const videoDurationSeconds = parseInteger(env.VIDEO_DURATION_SECONDS, 10, 'VIDEO_DURATION_SECONDS');
  if (videoDurationSeconds < 9 || videoDurationSeconds > 10) {
    throw new Error('VIDEO_DURATION_SECONDS deve ficar entre 9 e 10 segundos.');
  }
  const aiProvider = (env.AI_PROVIDER || 'openai').toLowerCase();
  if (!['openai', 'anthropic'].includes(aiProvider)) {
    throw new Error('AI_PROVIDER deve ser "openai" ou "anthropic".');
  }
  const audioDir = path.resolve(env.AUDIO_DIR || path.join(projectRoot, 'assets/audio'));

  return Object.freeze({
    projectRoot,
    activeSeason: env.ACTIVE_SEASON || 'season-1-carros.json',
    statePath: path.resolve(env.DATA_DIR || path.join(projectRoot, 'data/seasons'), env.ACTIVE_SEASON || 'season-1-carros.json'),
    outputDir: path.resolve(env.OUTPUT_DIR || path.join(projectRoot, 'output')),
    audioDir,
    cronSchedule: env.CRON_SCHEDULE || '0 12 * * *',
    timezone,
    publishEnabled: parseBoolean(env.PUBLISH_ENABLED, false),
    discordWebhookUrl: env.DISCORD_WEBHOOK_URL || '',
    ffmpegPath: env.FFMPEG_PATH || 'ffmpeg',
    renderConcurrency: env.REMOTION_CONCURRENCY || null,
    videoDurationSeconds,
    wheelSpinSoundPath: path.resolve(env.WHEEL_SPIN_SOUND_PATH || path.join(audioDir, 'wheel-spin.mp3')),
    aiProvider,
    aiModel: env.AI_MODEL || (aiProvider === 'openai' ? 'gpt-4o-mini' : 'claude-3-5-haiku-latest'),
    openaiApiKey: aiProvider === 'openai' ? (env.OPENAI_API_KEY || '') : '',
    anthropicApiKey: aiProvider === 'anthropic' ? (env.ANTHROPIC_API_KEY || '') : '',
    aiWebSearchEnabled: parseBoolean(env.AI_WEB_SEARCH_ENABLED, false),
    aiTimeoutMs: parseInteger(env.AI_TIMEOUT_MS, 15000, 'AI_TIMEOUT_MS'),
    logLevel: env.LOG_LEVEL || 'info',
  });
}

module.exports = {loadConfig, parseBoolean};
