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
