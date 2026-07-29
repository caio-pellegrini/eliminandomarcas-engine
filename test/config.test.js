const {loadConfig} = require('../src/config');

test.each([
  ['9', 9],
  ['10', 10],
])('aceita duração de %ss', (value, expected) => {
  expect(loadConfig({VIDEO_DURATION_SECONDS: value}).videoDurationSeconds).toBe(expected);
});

test('rejeita duração fora da nova janela', () => {
  expect(() => loadConfig({VIDEO_DURATION_SECONDS: '8'})).toThrow(/entre 9 e 10/);
});

test('mantém somente a chave do provider ativo', () => {
  const config = loadConfig({
    AI_PROVIDER: 'anthropic',
    ANTHROPIC_API_KEY: 'anthropic-secret',
    OPENAI_API_KEY: 'openai-secret',
  });
  expect(config.anthropicApiKey).toBe('anthropic-secret');
  expect(config.openaiApiKey).toBe('');
});

test('carrega a configuração da publicação real no Instagram', () => {
  const config = loadConfig({
    IG_ACCESS_TOKEN: 'token',
    IG_BUSINESS_ACCOUNT_ID: '123',
    PUBLIC_VIDEO_BASE_URL: 'https://videos.example.com/',
    IG_API_VERSION: 'v25.0',
    IG_POLL_INTERVAL_MS: '7000',
    IG_POLL_TIMEOUT_MS: '240000',
  });
  expect(config).toEqual(expect.objectContaining({
    igAccessToken: 'token',
    igBusinessAccountId: '123',
    publicVideoBaseUrl: 'https://videos.example.com/',
    igApiVersion: 'v25.0',
    igPollIntervalMs: 7000,
    igPollTimeoutMs: 240000,
  }));
});
