const MAX_DESCRIPTION_LENGTH = 4000;

function createDiscordNotifier({webhookUrl, logger, fetchImpl = global.fetch}) {
  async function send(title, description, color) {
    if (!webhookUrl) {
      logger.warn({title}, 'DISCORD_WEBHOOK_URL não configurado; notificação ignorada');
      return {skipped: true};
    }
    if (typeof fetchImpl !== 'function') {
      throw new Error('Fetch global indisponível. Use Node.js 24.18.0 LTS.');
    }
    const response = await fetchImpl(webhookUrl, {
      method: 'POST',
      headers: {'content-type': 'application/json'},
      body: JSON.stringify({
        username: 'Eliminando Marcas Engine',
        embeds: [{title, description: description.slice(0, MAX_DESCRIPTION_LENGTH), color, timestamp: new Date().toISOString()}],
      }),
    });
    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Discord respondeu HTTP ${response.status}: ${body.slice(0, 500)}`);
    }
    return {skipped: false};
  }

  return {
    success({day, brand, videoPath, publishEnabled}) {
      const action = publishEnabled
        ? 'Publicação simulada concluída (integrações reais entram na Fase 2).'
        : 'Publicação manual necessária (`PUBLISH_ENABLED=false`).';
      return send(`✅ Vídeo do Dia ${day} pronto`, `**Eliminada:** ${brand}\n**Arquivo:** ${videoPath}\n${action}`, 0x2ECC71);
    },
    skipped({day, brand, reason}) {
      return send(`ℹ️ Execução diária sem alteração`, `Dia ${day}: **${brand}**. ${reason}`, 0x3498DB);
    },
    failure({stage, day, error}) {
      const dayText = day ? ` do Dia ${day}` : '';
      return send(`❌ Falha no Eliminando Marcas Engine`, `Falhou na etapa **${stage}**${dayText}.\n\n${error.message}\n\n\`${(error.stack || '').slice(0, 2500)}\``, 0xE74C3C);
    },
  };
}

module.exports = {createDiscordNotifier};
