const path = require('node:path');
const {
  buildPublicVideoUrl,
  publish,
  waitForContainer,
} = require('../src/publish/instagram');

function jsonResponse(body, {status = 200, statusText = 'OK'} = {}) {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText,
    text: jest.fn().mockResolvedValue(JSON.stringify(body)),
  };
}

function createLogger() {
  return {info: jest.fn(), error: jest.fn()};
}

const outputDir = path.resolve('/app/output');
const baseConfig = {
  outputDir,
  publicVideoBaseUrl: 'https://videos.example.com/',
  igAccessToken: 'secret-token',
  igBusinessAccountId: '17841400000000000',
  igApiVersion: 'v25.0',
  igPollIntervalMs: 5_000,
  igPollTimeoutMs: 300_000,
};
const metadata = {day: 5, brand: 'Marca', caption: 'Legenda do Reel'};

test('monta a URL pública com o caminho relativo a OUTPUT_DIR', () => {
  expect(buildPublicVideoUrl('/app/output/temporada-1/dia-05.mp4', baseConfig))
    .toBe('https://videos.example.com/temporada-1/dia-05.mp4');
});

test.each([
  ['/app/data/seasons/season.json', /dentro de OUTPUT_DIR/],
  ['/app/output/temporada-1/dia-05.json', /somente o vídeo final \.mp4/],
])('rejeita arquivo que não pode ser exposto: %s', (videoPath, expectedError) => {
  expect(() => buildPublicVideoUrl(videoPath, baseConfig)).toThrow(expectedError);
});

test('cria o container, aguarda FINISHED e publica o Reel', async () => {
  const fetchImpl = jest.fn()
    .mockResolvedValueOnce(jsonResponse({id: 'container-1'}))
    .mockResolvedValueOnce(jsonResponse({id: 'container-1', status_code: 'IN_PROGRESS'}))
    .mockResolvedValueOnce(jsonResponse({id: 'container-1', status_code: 'FINISHED'}))
    .mockResolvedValueOnce(jsonResponse({id: 'media-1'}));
  let currentTime = 0;
  const sleepImpl = jest.fn(async (milliseconds) => { currentTime += milliseconds; });
  const logger = createLogger();

  const result = await publish('/app/output/temporada-1/dia-05.mp4', metadata, {
    logger,
    config: baseConfig,
    fetchImpl,
    sleepImpl,
    now: () => currentTime,
  });

  expect(result).toEqual(expect.objectContaining({
    platform: 'instagram',
    success: true,
    simulated: false,
    containerId: 'container-1',
    mediaId: 'media-1',
  }));
  expect(fetchImpl).toHaveBeenCalledTimes(4);
  expect(String(fetchImpl.mock.calls[0][0])).toBe('https://graph.instagram.com/v25.0/17841400000000000/media');
  expect(fetchImpl.mock.calls[0][1].headers.authorization).toBe('Bearer secret-token');
  expect(new URLSearchParams(fetchImpl.mock.calls[0][1].body).get('video_url'))
    .toBe('https://videos.example.com/temporada-1/dia-05.mp4');
  expect(new URLSearchParams(fetchImpl.mock.calls[0][1].body).get('caption')).toBe(metadata.caption);
  expect(new URLSearchParams(fetchImpl.mock.calls[3][1].body).get('creation_id')).toBe('container-1');
  expect(sleepImpl).toHaveBeenCalledWith(5_000);
  expect(logger.error).not.toHaveBeenCalled();
});

test('interrompe imediatamente quando o container retorna ERROR', async () => {
  const fetchImpl = jest.fn()
    .mockResolvedValueOnce(jsonResponse({id: 'container-error'}))
    .mockResolvedValueOnce(jsonResponse({
      id: 'container-error',
      status_code: 'ERROR',
      status: 'Video format is not supported',
    }));
  const logger = createLogger();

  await expect(publish('/app/output/temporada-1/dia-05.mp4', metadata, {
    logger,
    config: baseConfig,
    fetchImpl,
    sleepImpl: jest.fn(),
  })).rejects.toThrow(/status ERROR: Video format is not supported/);

  expect(fetchImpl).toHaveBeenCalledTimes(2);
  expect(logger.error).toHaveBeenCalledWith(
    expect.objectContaining({stage: 'aguardar processamento do container'}),
    'Publicação no Instagram falhou',
  );
});

test('encerra o polling no timeout máximo e não publica', async () => {
  const getStatus = jest.fn().mockResolvedValue({status_code: 'IN_PROGRESS'});
  let currentTime = 0;
  const sleepImpl = jest.fn(async (milliseconds) => { currentTime += milliseconds; });

  await expect(waitForContainer({
    containerId: 'container-timeout',
    getStatus,
    logger: createLogger(),
    pollIntervalMs: 5_000,
    pollTimeoutMs: 12_000,
    sleepImpl,
    now: () => currentTime,
  })).rejects.toThrow(/Timeout de 12000ms/);

  expect(sleepImpl.mock.calls.map(([milliseconds]) => milliseconds)).toEqual([5_000, 5_000, 2_000]);
  expect(getStatus).toHaveBeenCalledTimes(4);
});

test('propaga detalhes estruturados de erro da Graph API sem expor o token', async () => {
  const fetchImpl = jest.fn().mockResolvedValue(jsonResponse({
    error: {message: 'Invalid OAuth access token', type: 'OAuthException', code: 190},
  }, {status: 400, statusText: 'Bad Request'}));

  await expect(publish('/app/output/temporada-1/dia-05.mp4', metadata, {
    logger: createLogger(),
    config: baseConfig,
    fetchImpl,
  })).rejects.toThrow(/Invalid OAuth access token; tipo OAuthException; código 190/);

  const requestUrl = String(fetchImpl.mock.calls[0][0]);
  expect(requestUrl).not.toContain('secret-token');
});
