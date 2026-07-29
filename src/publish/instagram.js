const path = require('node:path');

const DEFAULT_API_VERSION = 'v25.0';
const DEFAULT_POLL_INTERVAL_MS = 5_000;
const DEFAULT_POLL_TIMEOUT_MS = 5 * 60_000;
const TERMINAL_ERROR_STATUSES = new Set(['ERROR', 'EXPIRED', 'PUBLISHED']);

function sleep(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function requireSetting(value, name) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`${name} é obrigatório para publicar no Instagram.`);
  }
  return value.trim();
}

function buildPublicVideoUrl(videoPath, {outputDir, publicVideoBaseUrl}) {
  const baseUrlValue = requireSetting(publicVideoBaseUrl, 'PUBLIC_VIDEO_BASE_URL');
  let baseUrl;
  try {
    baseUrl = new URL(baseUrlValue.endsWith('/') ? baseUrlValue : `${baseUrlValue}/`);
  } catch {
    throw new Error('PUBLIC_VIDEO_BASE_URL deve ser uma URL válida.');
  }
  if (baseUrl.protocol !== 'https:') {
    throw new Error('PUBLIC_VIDEO_BASE_URL deve usar HTTPS.');
  }

  const absoluteOutputDir = path.resolve(outputDir);
  const absoluteVideoPath = path.resolve(videoPath);
  const relativePath = path.relative(absoluteOutputDir, absoluteVideoPath);
  if (!relativePath || relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
    throw new Error('O vídeo a publicar precisa estar dentro de OUTPUT_DIR.');
  }
  if (path.extname(relativePath).toLowerCase() !== '.mp4') {
    throw new Error('A publicação no Instagram aceita somente o vídeo final .mp4.');
  }

  const encodedPath = relativePath.split(path.sep).map(encodeURIComponent).join('/');
  return new URL(encodedPath, baseUrl).toString();
}

function formatApiError(body, response) {
  const apiError = body && typeof body === 'object' ? body.error : null;
  if (apiError) {
    const details = [
      apiError.message,
      apiError.type && `tipo ${apiError.type}`,
      apiError.code !== undefined && `código ${apiError.code}`,
      apiError.error_subcode !== undefined && `subcódigo ${apiError.error_subcode}`,
      apiError.error_user_msg,
    ].filter(Boolean).join('; ');
    return details || 'erro não detalhado pela API';
  }
  if (typeof body === 'string' && body) return body.slice(0, 500);
  return response.statusText || 'resposta sem detalhes';
}

async function graphRequest({apiBaseUrl, endpoint, method = 'GET', params = {}, accessToken, fetchImpl}) {
  const url = new URL(endpoint.replace(/^\//, ''), `${apiBaseUrl.replace(/\/$/, '')}/`);
  const options = {
    method,
    headers: {authorization: `Bearer ${accessToken}`},
  };
  const searchParams = new URLSearchParams(params);
  if (method === 'GET') {
    url.search = searchParams.toString();
  } else {
    options.headers['content-type'] = 'application/x-www-form-urlencoded';
    options.body = searchParams.toString();
  }

  let response;
  try {
    response = await fetchImpl(url, options);
  } catch (error) {
    throw new Error(`Falha de rede ao chamar a Instagram API: ${error.message}`, {cause: error});
  }

  const responseText = await response.text();
  let body = responseText;
  if (responseText) {
    try {
      body = JSON.parse(responseText);
    } catch {
      // Mantém o texto para produzir uma mensagem útil em respostas não JSON.
    }
  } else {
    body = {};
  }
  if (!response.ok || body.error) {
    throw new Error(`Instagram API respondeu HTTP ${response.status}: ${formatApiError(body, response)}`);
  }
  return body;
}

async function waitForContainer({
  containerId,
  getStatus,
  logger,
  pollIntervalMs = DEFAULT_POLL_INTERVAL_MS,
  pollTimeoutMs = DEFAULT_POLL_TIMEOUT_MS,
  sleepImpl = sleep,
  now = Date.now,
}) {
  const startedAt = now();
  let attempts = 0;

  while (true) {
    attempts += 1;
    const result = await getStatus(containerId);
    const statusCode = result.status_code;
    logger.info({platform: 'instagram', containerId, statusCode, attempts}, 'Status do container de mídia consultado');

    if (statusCode === 'FINISHED') return result;
    if (TERMINAL_ERROR_STATUSES.has(statusCode)) {
      const detail = result.status ? `: ${result.status}` : '';
      throw new Error(`Container de mídia ${containerId} terminou com status ${statusCode}${detail}`);
    }
    if (!statusCode) {
      throw new Error(`Instagram não retornou status_code para o container ${containerId}.`);
    }

    const elapsedMs = now() - startedAt;
    if (elapsedMs >= pollTimeoutMs) {
      throw new Error(`Timeout de ${pollTimeoutMs}ms aguardando o container de mídia ${containerId} (último status: ${statusCode}).`);
    }
    await sleepImpl(Math.min(pollIntervalMs, pollTimeoutMs - elapsedMs));
  }
}

async function publish(videoPath, metadata, {
  logger,
  config,
  fetchImpl = global.fetch,
  sleepImpl = sleep,
  now = Date.now,
} = {}) {
  if (typeof fetchImpl !== 'function') {
    throw new Error('Fetch global indisponível. Use Node.js 24.18.0 LTS.');
  }

  const accessToken = requireSetting(config?.igAccessToken, 'IG_ACCESS_TOKEN');
  const accountId = requireSetting(config?.igBusinessAccountId, 'IG_BUSINESS_ACCOUNT_ID');
  const apiVersion = config.igApiVersion || DEFAULT_API_VERSION;
  const apiBaseUrl = `https://graph.instagram.com/${apiVersion}/`;
  const videoUrl = buildPublicVideoUrl(videoPath, config);
  let stage = 'criar container de mídia';
  let containerId;

  try {
    logger.info({platform: 'instagram', videoUrl, day: metadata.day}, 'Criando container de mídia para Reel');
    const container = await graphRequest({
      apiBaseUrl,
      endpoint: `${accountId}/media`,
      method: 'POST',
      params: {media_type: 'REELS', video_url: videoUrl, caption: metadata.caption},
      accessToken,
      fetchImpl,
    });
    containerId = container.id;
    if (!containerId) throw new Error('Instagram não retornou o ID do container de mídia.');

    stage = 'aguardar processamento do container';
    await waitForContainer({
      containerId,
      logger,
      pollIntervalMs: config.igPollIntervalMs,
      pollTimeoutMs: config.igPollTimeoutMs,
      sleepImpl,
      now,
      getStatus: (id) => graphRequest({
        apiBaseUrl,
        endpoint: id,
        params: {fields: 'status_code,status'},
        accessToken,
        fetchImpl,
      }),
    });

    stage = 'publicar container de mídia';
    const published = await graphRequest({
      apiBaseUrl,
      endpoint: `${accountId}/media_publish`,
      method: 'POST',
      params: {creation_id: containerId},
      accessToken,
      fetchImpl,
    });
    if (!published.id) throw new Error('Instagram não retornou o ID da mídia publicada.');

    logger.info({platform: 'instagram', containerId, mediaId: published.id, videoUrl}, 'Reel publicado no Instagram');
    return {
      platform: 'instagram',
      success: true,
      simulated: false,
      containerId,
      mediaId: published.id,
      videoUrl,
    };
  } catch (error) {
    logger.error({err: error, platform: 'instagram', stage, containerId, videoUrl}, 'Publicação no Instagram falhou');
    throw new Error(`Instagram — ${stage}: ${error.message}`, {cause: error});
  }
}

module.exports = {
  DEFAULT_API_VERSION,
  DEFAULT_POLL_INTERVAL_MS,
  DEFAULT_POLL_TIMEOUT_MS,
  buildPublicVideoUrl,
  graphRequest,
  publish,
  waitForContainer,
};
