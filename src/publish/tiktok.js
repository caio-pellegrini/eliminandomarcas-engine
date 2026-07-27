async function publish(videoPath, metadata, {logger}) {
  logger.info({platform: 'tiktok', videoPath, metadata}, 'Publicação real será implementada na Fase 2');
  // Fase 2: iniciar e concluir o upload pela TikTok Content Posting API.
  // Credenciais previstas: TIKTOK_ACCESS_TOKEN, TIKTOK_CLIENT_KEY e TIKTOK_CLIENT_SECRET.
  return {platform: 'tiktok', success: true, simulated: true};
}

module.exports = {publish};
