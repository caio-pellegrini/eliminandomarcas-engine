const {
  buildCaption,
  fallbackCaption,
  generateCaption,
  selectVariation,
  slugifyHashtag,
} = require('../src/ai/generateCaption');

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

test('monta a legenda completa com quatro separadores, CTA e hashtags', async () => {
  const caption = await generateCaption({
    brand: 'Rolls-Royce',
    niche: 'Carros Clássicos',
    day: 1,
    config: baseConfig,
    logger,
    sdk: makeSdk(jest.fn().mockResolvedValue({text: '**Curiosidade:** Foi fundada em 1900. Nasceu no Brasil.'})),
  });
  expect(caption).toBe([
    'Mais uma marca cai hoje... será a sua? 😰',
    '.',
    '.',
    '.',
    '.',
    'Curiosidade: Foi fundada em 1900. Nasceu no Brasil.',
    '',
    'Essa marca faz parte da sua história? Comenta aí 👇',
    '',
    '@eliminandomarcas',
    '#eliminandomarcas #carrosclassicos #rollsroyce',
  ].join('\n'));
  expect(logger.error).not.toHaveBeenCalled();
});

test('varia gancho e CTA de forma determinística com offsets diferentes', () => {
  const dayOne = buildCaption({curiosity: 'Fato.', brand: 'A', niche: 'Carros', currentDay: 1});
  const repeatedDayOne = buildCaption({curiosity: 'Fato.', brand: 'A', niche: 'Carros', currentDay: 1});
  const dayTwo = buildCaption({curiosity: 'Fato.', brand: 'A', niche: 'Carros', currentDay: 2});
  expect(dayOne).toBe(repeatedDayOne);
  expect(dayTwo).not.toBe(dayOne);
  expect(selectVariation(['a', 'b', 'c'], 1)).toBe('b');
  expect(selectVariation(['a', 'b', 'c'], 1, 2)).toBe('a');
});

test.each([
  ['Carros Clássicos', 'carrosclassicos'],
  ['Rolls-Royce', 'rollsroyce'],
  ['Citroën C4', 'citroenc4'],
  ['Škoda', 'skoda'],
])('normaliza %s para hashtag %s', (value, expected) => {
  expect(slugifyHashtag(value)).toBe(expected);
});

test('usa fallback completo e registra o erro sem interromper quando a IA falha', async () => {
  const data = {brand: 'Marca A', niche: 'Carros', day: 3};
  const caption = await generateCaption({
    ...data,
    config: baseConfig,
    logger,
    sdk: makeSdk(jest.fn().mockRejectedValue(new Error('rate limit'))),
  });
  expect(caption).toBe(fallbackCaption({brand: data.brand, niche: data.niche, currentDay: data.day}));
  expect(caption).toContain('#eliminandomarcas #carros #marcaa');
  expect(logger.error).toHaveBeenCalledTimes(1);
});

test('usa fallback quando falta a chave do provider ativo', async () => {
  const data = {brand: 'Marca A', niche: 'Carros', day: 4};
  const caption = await generateCaption({
    ...data,
    config: {...baseConfig, openaiApiKey: ''},
    logger,
  });
  expect(caption).toBe(fallbackCaption({brand: data.brand, niche: data.niche, currentDay: data.day}));
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
    day: 1,
    config: {...baseConfig, ...keys, aiProvider: provider, aiWebSearchEnabled: true},
    logger,
    sdk: makeSdk(generateTextMock),
  });
  expect(generateTextMock.mock.calls[0][0].tools).toHaveProperty('web_search');
});
