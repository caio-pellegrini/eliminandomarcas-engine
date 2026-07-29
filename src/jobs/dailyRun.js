const path = require('node:path');
const {advanceState, getEliminationForDate, localDateKey} = require('../core/eliminationEngine');
const {acquireStateLock, readSeasonState, writeSeasonState} = require('../core/seasonState');
const {renderVideo} = require('../render/renderVideo');
const {publishToEnabledPlatforms} = require('../publish');
const {generateCaption} = require('../ai/generateCaption');

async function dailyRun({config, logger, notifier, now = new Date(), services = {}}) {
  const readState = services.readState || readSeasonState;
  const writeState = services.writeState || writeSeasonState;
  const lockState = services.lockState || acquireStateLock;
  const render = services.render || renderVideo;
  const publish = services.publish || publishToEnabledPlatforms;
  const createCaption = services.generateCaption || generateCaption;
  const runDate = localDateKey(now, config.timezone);
  let releaseLock;
  let stage = 'adquirir lock';
  let day;

  try {
    releaseLock = await lockState(config.statePath);
    stage = 'ler estado';
    const state = await readState(config.statePath);
    stage = 'validar idempotência';
    const elimination = getEliminationForDate(state, runDate);
    day = elimination.day;

    if (elimination.alreadyProcessed) {
      logger.info({runDate, day, brand: elimination.brand}, 'Data já processada; estado não será avançado');
      await notifier.skipped({day, brand: elimination.brand, reason: 'Esta data já havia sido processada; nenhum novo vídeo foi gerado.'});
      return {status: 'already-processed', ...elimination};
    }
    if (elimination.seasonComplete) {
      logger.info({seasonId: state.seasonId}, 'Temporada já concluída');
      await notifier.skipped({day: state.totalDays, brand: 'temporada concluída', reason: 'Não há mais marcas para eliminar.'});
      return {status: 'season-complete'};
    }

    stage = 'renderizar vídeo';
    const rendered = await render({state, day, brand: elimination.brand, config, logger});
    stage = 'gerar legenda';
    const caption = await createCaption({brand: elimination.brand, niche: state.niche, day, config, logger});
    let publishStatus = 'manual_required';
    let publishResults = [];
    if (config.publishEnabled) {
      stage = 'publicar vídeo';
      publishResults = await publish(rendered.outputPath, {
        seasonId: state.seasonId,
        day,
        brand: elimination.brand,
        caption,
      }, {logger, config});
      const instagramResult = publishResults.find((result) => result.platform === 'instagram');
      if (!instagramResult?.success || instagramResult.simulated) {
        throw new Error('A publicação real no Instagram não foi confirmada.');
      }
      publishStatus = 'instagram_published';
    } else {
      logger.info({day, videoPath: rendered.outputPath}, 'Publicação manual necessária');
    }

    stage = 'atualizar estado';
    const processedAt = now.toISOString();
    const nextState = advanceState(state, elimination, {
      runDate,
      videoPath: path.relative(config.projectRoot, rendered.outputPath),
      publishStatus,
      caption,
      processedAt,
    });
    await writeState(config.statePath, nextState);

    stage = 'notificar sucesso';
    await notifier.success({
      day,
      brand: elimination.brand,
      videoPath: rendered.outputPath,
      publishEnabled: config.publishEnabled,
      publishResults,
    });
    logger.info({day, brand: elimination.brand, videoPath: rendered.outputPath}, 'Execução diária concluída');
    return {status: 'completed', day, brand: elimination.brand, videoPath: rendered.outputPath};
  } catch (error) {
    logger.error({err: error, stage, day}, 'Execução diária falhou');
    try {
      await notifier.failure({stage, day, error});
    } catch (notificationError) {
      logger.error({err: notificationError, originalError: error.message}, 'Também falhou ao notificar o Discord');
    }
    throw error;
  } finally {
    if (releaseLock) {
      try {
        await releaseLock();
      } catch (error) {
        logger.error({err: error}, 'Falha ao liberar lock do estado');
      }
    }
  }
}

module.exports = {dailyRun};
