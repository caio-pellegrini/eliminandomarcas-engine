const {dailyRun} = require('../src/jobs/dailyRun');

test('falha de publicação notifica o Discord e não avança o estado da temporada', async () => {
  const state = {
    seasonId: 'season-test',
    seasonNumber: 1,
    name: 'Teste',
    niche: 'Teste',
    totalDays: 1,
    brands: ['A', 'B'],
    eliminationOrder: ['A'],
    currentDay: 1,
    history: [],
    lastRunAt: null,
  };
  const publicationError = new Error('Instagram — aguardar processamento do container: timeout');
  const releaseLock = jest.fn().mockResolvedValue();
  const writeState = jest.fn();
  const notifier = {
    success: jest.fn(),
    skipped: jest.fn(),
    failure: jest.fn().mockResolvedValue(),
  };

  await expect(dailyRun({
    config: {
      timezone: 'America/Sao_Paulo',
      statePath: '/app/data/seasons/test.json',
      projectRoot: '/app',
      publishEnabled: true,
    },
    logger: {info: jest.fn(), error: jest.fn()},
    notifier,
    now: new Date('2026-07-28T15:00:00.000Z'),
    services: {
      lockState: jest.fn().mockResolvedValue(releaseLock),
      readState: jest.fn().mockResolvedValue(state),
      writeState,
      render: jest.fn().mockResolvedValue({outputPath: '/app/output/temporada-1/dia-01.mp4'}),
      generateCaption: jest.fn().mockResolvedValue('Legenda'),
      publish: jest.fn().mockRejectedValue(publicationError),
    },
  })).rejects.toBe(publicationError);

  expect(writeState).not.toHaveBeenCalled();
  expect(notifier.success).not.toHaveBeenCalled();
  expect(notifier.failure).toHaveBeenCalledWith({
    stage: 'publicar vídeo',
    day: 1,
    error: publicationError,
  });
  expect(releaseLock).toHaveBeenCalledTimes(1);
});
