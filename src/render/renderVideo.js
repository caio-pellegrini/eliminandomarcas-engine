const fs = require('node:fs/promises');
const path = require('node:path');
const {bundle} = require('@remotion/bundler');
const {renderMedia, selectComposition} = require('@remotion/renderer');
const {addBackgroundMusic} = require('./addBackgroundMusic');

let bundlePromise;

function getBundle(entryPoint) {
  if (!bundlePromise) bundlePromise = bundle({entryPoint, webpackOverride: (config) => config});
  return bundlePromise;
}

async function renderVideo({state, day, brand, config, logger}) {
  const seasonDirectory = path.join(config.outputDir, `temporada-${state.seasonNumber}`);
  await fs.mkdir(seasonDirectory, {recursive: true});
  const basename = `dia-${String(day).padStart(2, '0')}`;
  const visualPath = path.join(seasonDirectory, `${basename}.visual.mp4`);
  const outputPath = path.join(seasonDirectory, `${basename}.mp4`);
  const eliminatedBrands = new Set(
    state.history.filter((entry) => entry.day < day).map((entry) => entry.brand),
  );
  const remainingBrands = state.brands.filter((candidate) => !eliminatedBrands.has(candidate));
  const inputProps = {
    day,
    totalDays: state.totalDays,
    niche: state.niche,
    seasonName: state.name,
    eliminatedBrand: brand,
    brands: remainingBrands,
    durationSeconds: config.videoDurationSeconds,
  };
  const serveUrl = await getBundle(path.join(__dirname, 'remotion/index.jsx'));
  const composition = await selectComposition({serveUrl, id: 'SeasonElimination', inputProps});
  logger.info({day, brand, visualPath}, 'Iniciando render visual');
  await renderMedia({
    composition,
    serveUrl,
    codec: 'h264',
    pixelFormat: 'yuv420p',
    outputLocation: visualPath,
    inputProps,
    concurrency: config.renderConcurrency,
    chromiumOptions: {enableMultiProcessOnLinux: true},
  });
  try {
    const result = await addBackgroundMusic({
      visualPath,
      outputPath,
      audioDir: config.audioDir,
      day,
      durationSeconds: config.videoDurationSeconds,
      ffmpegPath: config.ffmpegPath,
    });
    logger.info({day, outputPath, audioSource: result.audioSource}, 'Trilha adicionada ao vídeo');
    return result;
  } finally {
    await fs.rm(visualPath, {force: true});
  }
}

if (require.main === module) {
  const {loadConfig} = require('../config');
  const {createLogger} = require('../config/logger');
  const {readSeasonState} = require('../core/seasonState');
  const config = loadConfig();
  const logger = createLogger(config.logLevel);
  readSeasonState(config.statePath)
    .then((state) => renderVideo({state, day: state.currentDay, brand: state.eliminationOrder[state.currentDay - 1], config, logger}))
    .then((result) => logger.info(result, 'Render de amostra concluído'))
    .catch((error) => { logger.error({err: error}, 'Render de amostra falhou'); process.exitCode = 1; });
}

module.exports = {renderVideo};
