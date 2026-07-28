const {fallbackCaption, generateCaption} = require('../src/ai/generateCaption');

const logger = {error: jest.fn()};
const baseConfig = {
  aiProvider: 'openai',
  aiModel: 'gpt-4o-mini',
  openaiApiKey: 'test-key',
  anthropicApiKey: '',
  aiWebSearchEnabled: false,
  aiTimeoutMs: 1000,
};
const makeSdk = (generateText) => ({
  generateText,
  createOpenAI: () => Object.assign((model) => ({provider: 'openai', model}), {tools: {webSearch: () => ({})}}),
  createAnthropic: () => Object.assign((model) => ({provider: 'anthropic', model}), {tools: {webSearch_20250305: () => ({})}}),
});

beforeEach(() => logger.error.mockClear());

test('monta a legenda com espaçamento e curiosidade limpa', async () => {
  const caption = await generateCaption({
    brand: 'Marca A',
    niche: 'Carros',
    config: baseConfig,
    logger,
    sdk: makeSdk(jest.fn().mockResolvedValue({text: '**Curiosidade:** Foi fundada em 1900. Nasceu no Brasil.'})),
  });
  expect(caption).toBe('Sua marca favorita ainda está no jogo? 👀\n.\n.\n.\nCuriosidade: Foi fundada em 1900. Nasceu no Brasil.\n\n@eliminandomarcas');
  expect(logger.error).not.toHaveBeenCalled();
});

test('usa fallback e registra o erro sem interromper quando a IA falha', async () => {
  const caption = await generateCaption({
    brand: 'Marca A',
    niche: 'Carros',
    config: baseConfig,
    logger,
    sdk: makeSdk(jest.fn().mockRejectedValue(new Error('rate limit'))),
  });
  expect(caption).toBe(fallbackCaption());
  expect(logger.error).toHaveBeenCalledTimes(1);
});

test('usa fallback quando falta a chave do provider ativo', async () => {
  const caption = await generateCaption({
    brand: 'Marca A',
    niche: 'Carros',
    config: {...baseConfig, openaiApiKey: ''},
    logger,
  });
  expect(caption).toBe(fallbackCaption());
  expect(logger.error).toHaveBeenCalledTimes(1);
});

test.each([
  ['openai', {openaiApiKey: 'key', anthropicApiKey: ''}],
  ['anthropic', {openaiApiKey: '', anthropicApiKey: 'key'}],
])('habilita a busca nativa somente no provider ativo: %s', async (provider, keys) => {
  const generateTextMock = jest.fn().mockResolvedValue({text: 'Fato conhecido e verificável.'});
  await generateCaption({
    brand: 'Marca A',
    niche: 'Carros',
    config: {...baseConfig, ...keys, aiProvider: provider, aiWebSearchEnabled: true},
    logger,
    sdk: makeSdk(generateTextMock),
  });
  expect(generateTextMock.mock.calls[0][0].tools).toHaveProperty('web_search');
});
