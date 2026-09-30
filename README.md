# Eliminando Marcas Engine

**A headless content-production pipeline that turns a daily elimination state into a rendered short-form video and can publish it automatically to Instagram.**

I built the engine to automate an entire recurring media workflow rather than a single generation step. On each scheduled run it safely advances the season, renders a vertical video with Remotion, mixes audio with FFmpeg, builds the caption, publishes when enabled, persists state, and reports the result through Discord.

### Engineering highlights

- Idempotent daily execution with an exclusive lock and atomic JSON state updates.
- 1080×1920 video rendering with **Remotion** and audio composition with **FFmpeg**.
- Instagram publishing behind a feature flag, with a manual workflow available when publishing is disabled.
- Static caption facts first, with configurable AI generation only as a fallback.
- Dockerized development and production flows, including persistent volumes and a read-only video-serving path.
- Explicit failure handling and Discord notifications around the scheduled pipeline.

The interesting part of this project is orchestration: rendering, media processing, external APIs, persistent state, scheduling, and deployment all have to behave as one repeatable workflow.

> Detailed deployment and operational documentation below is in Portuguese.

## Como funciona

O job adquire um lock exclusivo, lê e valida a temporada ativa, verifica se a data local já foi processada, renderiza o visual, adiciona uma trilha, publica apenas se a feature flag estiver habilitada, grava o JSON de forma atômica e notifica o Discord. Uma nova execução na mesma data não avança o estado.

Cada temporada tem 61 marcas: 60 itens em `eliminationOrder` e uma vencedora que não aparece nessa ordem. Ao terminar o Dia 60, `currentDay` passa a 61 e as execuções seguintes são ignoradas como temporada concluída.

## Pré-requisitos

- Docker Engine com Docker Compose v2;
- webhook de um canal do Discord;
- espaço e CPU suficientes para renderizar vídeo 1080x1920 com Chromium.

Para execução fora do Docker, use Node.js 24.18.0 LTS (Krypton), FFmpeg e as bibliotecas do Chrome necessárias ao Remotion.

## Desenvolvimento com Docker

```bash
cp .env.example .env
# preencha DISCORD_WEBHOOK_URL
docker compose -f docker-compose.dev.yaml build
docker compose -f docker-compose.dev.yaml up
```

O processo fica aguardando o cron. Para disparar imediatamente em outro terminal:

```bash
docker compose -f docker-compose.dev.yaml exec eliminandomarcas-engine npm run run:now
```

O código é montado em `/app` e observado pelo nodemon. `data/`, `output/` e `assets/audio/` são bind mounts e ficam acessíveis diretamente no host.

O serviço `video-server` expõe localmente, apenas para inspeção, os MP4 finais em `http://localhost:8080/temporada-N/dia-XX.mp4`. Esse endereço local não é acessível pela Instagram API e não deve ser usado em `PUBLIC_VIDEO_BASE_URL`.

Para abrir o Remotion Studio e ajustar o visual:

```bash
npm install
npm run studio
```

## Produção no VPS

No Dokploy, crie o domínio público para o serviço `video-server`, apontando o Traefik para a porta interna `80`, e habilite HTTPS/Let's Encrypt no próprio Dokploy. O Compose não publica portas do Nginx no host; somente o Traefik tem acesso externo ao serviço pela rede Docker.

```bash
cp .env.example .env
# preencha as credenciais, use PUBLIC_VIDEO_BASE_URL=https://videos.seudominio.com.br/
# revise o checklist abaixo e proteja o arquivo: chmod 600 .env
docker compose -f docker-compose.prod.yaml build
docker compose -f docker-compose.prod.yaml up -d
docker compose -f docker-compose.prod.yaml logs -f eliminandomarcas-engine
```

O Compose de produção usa `restart: always`, não monta o código e mantém o estado de `data/` e os vídeos de `output/` em volumes nomeados do Docker. O Nginx lê o mesmo volume `rendered-videos` em modo somente leitura e aceita apenas caminhos no formato `/temporada-N/dia-XX.mp4`; listagem de diretórios e qualquer outro arquivo retornam 404. O HTTPS, o certificado e o redirecionamento HTTP→HTTPS são responsabilidade do Traefik/Dokploy. As trilhas são incluídas na imagem durante o build. Faça backup periódico dos volumes `season-data` e `rendered-videos`; no Dokploy, eles podem ser configurados na aba **Volume Backups**.

Na primeira criação, o Docker inicializa `season-data` com a temporada incluída na imagem. Não remova os volumes ao fazer redeploy, pois eles guardam o avanço da temporada e os vídeos renderizados.

Para testar uma execução imediata em produção:

```bash
docker compose -f docker-compose.prod.yaml exec eliminandomarcas-engine node src/index.js --run-now
```

## Checklist do `.env`

- `ACTIVE_SEASON`: arquivo da temporada dentro de `data/seasons/`;
- `CRON_SCHEDULE`: expressão cron (o padrão é diariamente ao meio-dia);
- `TIMEZONE`: fuso usado pelo cron e pela idempotência;
- `PUBLISH_ENABLED`: com `true`, exige a configuração do Instagram e publica de verdade; com `false`, mantém o fluxo manual;
- `DISCORD_WEBHOOK_URL`: webhook do canal que receberá sucesso e falha;
- `VIDEO_DURATION_SECONDS`: use 9 ou 10; o padrão é 10 (3 segundos finais são reservados ao resultado);
- `WHEEL_SPIN_SOUND_PATH`: efeito de roleta, por padrão `assets/audio/wheel-spin.mp3`; se estiver ausente, o vídeo continua sem o efeito;
- `REMOTION_CONCURRENCY`: reduza em VPS com pouca memória, por exemplo `25%`;
- `DATA_DIR`, `OUTPUT_DIR` e `AUDIO_DIR`: os defaults `/app/...` são próprios para Docker.
- `IG_ACCESS_TOKEN`: token de usuário do Instagram obtido pelo fluxo **Instagram API with Instagram Login**;
- `IG_BUSINESS_ACCOUNT_ID`: ID da conta profissional retornado por esse fluxo;
- `PUBLIC_VIDEO_BASE_URL`: origem HTTPS pública do Nginx, sempre com o subdomínio configurado no certificado;
- `IG_API_VERSION`: versão da Graph API (default `v25.0`);
- `IG_POLL_INTERVAL_MS` e `IG_POLL_TIMEOUT_MS`: intervalo e timeout total do processamento do container (defaults de 5 segundos e 5 minutos).

As legendas usam primeiro a curiosidade estática cadastrada para a temporada. A IA só é chamada quando o arquivo não existe ou a marca eliminada não tem uma entrada. Para esse fallback, configure `AI_PROVIDER` como `openai` ou `anthropic`, defina `AI_MODEL` e preencha somente a chave do provider ativo (`OPENAI_API_KEY` ou `ANTHROPIC_API_KEY`). `AI_WEB_SEARCH_ENABLED=false` mantém a busca hospedada desligada; ao mudar para `true`, o sistema habilita a ferramenta nativa do provider. `AI_TIMEOUT_MS` controla o timeout da geração. Qualquer falha também no fallback usa uma legenda padrão e não interrompe o pipeline.

O token precisa ter as permissões `instagram_business_basic` e `instagram_business_content_publish`. Esta integração usa `graph.instagram.com`, sem exigir Página do Facebook vinculada. Renovação automática do token permanece fora do escopo; atualize `IG_ACCESS_TOKEN` manualmente quando necessário.

## Trilhas sonoras

Coloque duas ou três trilhas licenciadas em `assets/audio/`. Formatos aceitos: MP3, WAV, M4A, AAC, OGG e FLAC. A escolha é determinística (`dia % quantidade`), portanto uma repetição do mesmo dia usa a mesma música. O arquivo configurado em `WHEEL_SPIN_SOUND_PATH` é excluído dessa seleção e mixado separadamente apenas durante o giro.

Se não houver arquivos, o FFmpeg gera uma de três ambientações sintéticas originais. Isso permite que o pipeline funcione do zero, mas vale substituir o fallback por faixas de melhor qualidade. Preserve o arquivo de licença/atribuição junto às trilhas.

## Testes

```bash
npm install
npm test
```

Os testes cobrem avanço, idempotência por data, limite final, data no fuso configurado, validação e leitura/escrita atômica do JSON.

## Adicionar uma temporada

1. Copie `data/seasons/season-1-carros.json` para um novo nome.
2. Troque `seasonId`, `seasonNumber`, `name` e `niche`.
3. Defina `brands` com `totalDays + 1` nomes únicos.
4. Defina `eliminationOrder` com exatamente `totalDays` nomes, sem a futura vencedora.
5. Inicie com `currentDay: 1`, `history: []` e `lastRunAt: null`.
6. Ajuste `ACTIVE_SEASON` no `.env` e reinicie o container.

Cadastre as curiosidades em `src/ai/curiosidades/temporada-{número}-{nicho}.json`, usando o nicho sem espaços, acentos ou pontuação (por exemplo, `temporada-1-carros.json`). O arquivo deve ser um objeto JSON no formato `{"Nome da marca": "Texto da curiosidade"}`. Para atualizar ou completar as curiosidades de uma temporada, basta editar o JSON correspondente; uma marca ausente usa automaticamente a IA como fallback.

Nunca altere a ordem de dias já presentes no histórico. Antes de uma correção manual, pare o container e faça uma cópia do JSON; isso evita disputar o arquivo com o job.

## Operação e recuperação

- Vídeos finais: `output/temporada-N/dia-XX.mp4`.
- Estado: arquivo indicado por `ACTIVE_SEASON`.
- Lock: `<arquivo-da-temporada>.lock`; ele existe somente durante um job. Se o processo sofrer encerramento forçado, confirme que não há execução ativa antes de remover um lock órfão.
- Se o render ou a publicação falhar, o estado não avança e o próximo disparo pode tentar novamente.
- Se a gravação do estado concluir e apenas a notificação falhar, o dia continua registrado; uma nova execução reconhecerá a data e não criará outra eliminação.

## Publicação no Instagram

Com `PUBLISH_ENABLED=true`, `src/publish/instagram.js` cria um container de Reel usando a URL pública do MP4, consulta `status_code` até `FINISHED` e então publica com `media_publish`. Status de erro, falhas HTTP ou timeout interrompem o job antes da gravação do estado e geram a notificação detalhada do Discord, permitindo repetir o mesmo dia. O TikTok permanece simulado em `src/publish/tiktok.js`.

## Referências de infraestrutura

- [Dockerização oficial do Remotion](https://www.remotion.dev/docs/docker)
- [Renderização server-side com `renderMedia()`](https://www.remotion.dev/docs/renderer/render-media)
- [Instagram API with Instagram Login](https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login)
