const HANDLE = '@eliminandomarcas';
const SEPARATOR_LINES = Array(4).fill('.').join('\n');

const hookVariations = [
  'Sua marca favorita ainda está no jogo? 👀',
  'Mais uma marca cai hoje... será a sua? 😰',
  'A eliminação de hoje pode doer 💔',
  'Prepara o coração, tem marca saindo hoje 👀',
  'Hoje a roleta não vai perdoar... 😬',
];

const ctaVariations = [
  'Você sabia? Comenta aí outra curiosidade que você conhece sobre a marca 👇',
  'Manda aqui embaixo o que você lembra dessa marca 👇',
  'Quem já teve ou andou de carro dessa marca? Conta nos comentários 👇',
  'Essa marca faz parte da sua história? Comenta aí 👇',
];

async function loadAiSdk() {
  const [ai, openai, anthropic] = await Promise.all([
    import('ai'),
    import('@ai-sdk/openai'),
    import('@ai-sdk/anthropic'),
  ]);
  return {generateText: ai.generateText, createOpenAI: openai.createOpenAI, createAnthropic: anthropic.createAnthropic};
}

function slugifyHashtag(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

function selectVariation(variations, currentDay, offset = 0) {
  const day = Number.isInteger(currentDay) ? currentDay : 1;
  const index = ((day + offset) % variations.length + variations.length) % variations.length;
  return variations[index];
}

function buildCaption({curiosity, brand, niche, currentDay}) {
  const hook = selectVariation(hookVariations, currentDay);
  const cta = selectVariation(ctaVariations, currentDay, 2);
  const hashtags = ['eliminandomarcas', slugifyHashtag(niche), slugifyHashtag(brand)]
    .filter(Boolean)
    .map((hashtag) => `#${hashtag}`)
    .join(' ');
  const curiosityBlock = curiosity ? `\nCuriosidade: ${curiosity}\n` : '';
  return `${hook}\n${SEPARATOR_LINES}${curiosityBlock}\n${cta}\n\n${HANDLE}\n${hashtags}`;
}

function fallbackCaption({brand, niche, currentDay} = {}) {
  return buildCaption({brand, niche, currentDay});
}

function captionWithCuriosity(curiosity, {brand, niche, currentDay} = {}) {
  return buildCaption({curiosity, brand, niche, currentDay});
}

function createProvider(config, sdk) {
  if (config.aiProvider === 'openai') {
    if (!config.openaiApiKey) throw new Error('OPENAI_API_KEY não configurada.');
    const provider = sdk.createOpenAI({apiKey: config.openaiApiKey});
    return {
      model: provider(config.aiModel),
      tools: config.aiWebSearchEnabled ? {web_search: provider.tools.webSearch({searchContextSize: 'low'})} : undefined,
    };
  }
  if (!config.anthropicApiKey) throw new Error('ANTHROPIC_API_KEY não configurada.');
  const provider = sdk.createAnthropic({apiKey: config.anthropicApiKey});
  return {
    model: provider(config.aiModel),
    tools: config.aiWebSearchEnabled ? {web_search: provider.tools.webSearch_20250305({maxUses: 2})} : undefined,
  };
}

function cleanCuriosity(text) {
  return text
    .trim()
    .replace(/[*_`#]/g, '')
    .replace(/^Curiosidade:\s*/i, '')
    .replace(/\s+/g, ' ');
}

async function generateCaption({brand, niche, day, config, logger, sdk}) {
  const captionData = {brand, niche, currentDay: day};
  try {
    if (config.aiProvider === 'openai' && !config.openaiApiKey) throw new Error('OPENAI_API_KEY não configurada.');
    if (config.aiProvider === 'anthropic' && !config.anthropicApiKey) throw new Error('ANTHROPIC_API_KEY não configurada.');
    const loadedSdk = sdk || await loadAiSdk();
    const {model, tools} = createProvider(config, loadedSdk);
    const result = await loadedSdk.generateText({
      model,
      tools,
      maxOutputTokens: 300,
      maxRetries: 1,
      timeout: config.aiTimeoutMs,
      prompt: [
        `Escreva exatamente duas frases curtas, somando no máximo 55 palavras, em português do Brasil, com curiosidades sobre a marca ${brand}, do nicho ${niche}.`,
        'Use apenas fatos amplamente documentados e fáceis de verificar, como ano de fundação, país de origem, um marco histórico conhecido ou uma curiosidade popular.',
        'Evite dados obscuros, controversos, vagos ou incertos. Se não tiver segurança sobre um fato, não o inclua.',
        'Responda sem título, lista, citações ou formatação Markdown e termine obrigatoriamente com ponto final.',
      ].join(' '),
    });
    const curiosity = cleanCuriosity(result.text || '');
    if (!curiosity) throw new Error('O modelo retornou uma curiosidade vazia.');
    return captionWithCuriosity(curiosity, captionData);
  } catch (error) {
    logger.error({err: error, brand, provider: config.aiProvider, model: config.aiModel}, 'Falha ao gerar curiosidade; usando legenda padrão');
    return fallbackCaption(captionData);
  }
}

module.exports = {
  buildCaption,
  captionWithCuriosity,
  cleanCuriosity,
  ctaVariations,
  fallbackCaption,
  generateCaption,
  hookVariations,
  loadAiSdk,
  selectVariation,
  slugifyHashtag,
};
