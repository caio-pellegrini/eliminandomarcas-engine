const HOOK = 'Sua marca favorita ainda está no jogo? 👀';
const HANDLE = '@eliminandomarcas';

async function loadAiSdk() {
  const [ai, openai, anthropic] = await Promise.all([
    import('ai'),
    import('@ai-sdk/openai'),
    import('@ai-sdk/anthropic'),
  ]);
  return {generateText: ai.generateText, createOpenAI: openai.createOpenAI, createAnthropic: anthropic.createAnthropic};
}

function fallbackCaption() {
  return `${HOOK}\n\n${HANDLE}`;
}

function captionWithCuriosity(curiosity) {
  return `${HOOK}\n.\n.\n.\nCuriosidade: ${curiosity}\n\n${HANDLE}`;
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

async function generateCaption({brand, niche, config, logger, sdk}) {
  try {
    if (config.aiProvider === 'openai' && !config.openaiApiKey) throw new Error('OPENAI_API_KEY não configurada.');
    if (config.aiProvider === 'anthropic' && !config.anthropicApiKey) throw new Error('ANTHROPIC_API_KEY não configurada.');
    const loadedSdk = sdk || await loadAiSdk();
    const {model, tools} = createProvider(config, loadedSdk);
    const result = await loadedSdk.generateText({
      model,
      tools,
      maxOutputTokens: 180,
      maxRetries: 1,
      timeout: config.aiTimeoutMs,
      prompt: [
        `Escreva 2 ou 3 frases curtas, em português do Brasil, com curiosidades sobre a marca ${brand}, do nicho ${niche}.`,
        'Use apenas fatos amplamente documentados e fáceis de verificar, como ano de fundação, país de origem, um marco histórico conhecido ou uma curiosidade popular.',
        'Evite dados obscuros, controversos, vagos ou incertos. Se não tiver segurança sobre um fato, não o inclua.',
        'Responda em texto corrido curto, sem título, lista, citações ou formatação Markdown, pronto para ser inserido em uma legenda.',
      ].join(' '),
    });
    const curiosity = cleanCuriosity(result.text || '');
    if (!curiosity) throw new Error('O modelo retornou uma curiosidade vazia.');
    return captionWithCuriosity(curiosity);
  } catch (error) {
    logger.error({err: error, brand, provider: config.aiProvider, model: config.aiModel}, 'Falha ao gerar curiosidade; usando legenda padrão');
    return fallbackCaption();
  }
}

module.exports = {captionWithCuriosity, cleanCuriosity, fallbackCaption, generateCaption, loadAiSdk};
