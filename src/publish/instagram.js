async function publish(videoPath, metadata, {logger}) {
  logger.info({platform: 'instagram', videoPath, metadata}, 'Publicação real será implementada na Fase 2');
  // Fase 2: criar o container de mídia e publicar pela Instagram Graph API.
  // Credenciais previstas: IG_ACCESS_TOKEN e IG_BUSINESS_ACCOUNT_ID.
  return {platform: 'instagram', success: true, simulated: true};
}

module.exports = {publish};
