# Eliminando Marcas Engine

Motor headless que executa uma eliminação por dia, renderiza um vídeo vertical de 9 a 10 segundos com Remotion, adiciona trilha e efeito de roleta com FFmpeg, gera a legenda com IA, persiste o avanço da temporada em JSON e avisa pelo Discord. A publicação real no Instagram e TikTok está preparada como stub para a Fase 2.

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

Para abrir o Remotion Studio e ajustar o visual:

```bash
npm install
npm run studio
```

## Produção no VPS

```bash
cp .env.example .env
# revise o checklist abaixo e proteja o arquivo: chmod 600 .env
docker compose -f docker-compose.prod.yaml build
docker compose -f docker-compose.prod.yaml up -d
docker compose -f docker-compose.prod.yaml logs -f eliminandomarcas-engine
```

O Compose de produção usa `restart: always`, não monta o código e mantém o estado de `data/` e os vídeos de `output/` em volumes nomeados do Docker. As trilhas são incluídas na imagem durante o build. Faça backup periódico dos volumes `season-data` e `rendered-videos`; no Dokploy, eles podem ser configurados na aba **Volume Backups**.

Na primeira criação, o Docker inicializa `season-data` com a temporada incluída na imagem. Não remova os volumes ao fazer redeploy, pois eles guardam o avanço da temporada e os vídeos renderizados.

Para testar uma execução imediata em produção:

```bash
docker compose -f docker-compose.prod.yaml exec eliminandomarcas-engine node src/index.js --run-now
```

## Checklist do `.env`

- `ACTIVE_SEASON`: arquivo da temporada dentro de `data/seasons/`;
- `CRON_SCHEDULE`: expressão cron (o padrão é diariamente ao meio-dia);
- `TIMEZONE`: fuso usado pelo cron e pela idempotência;
- `PUBLISH_ENABLED=false`: mantenha assim durante a Fase 1;
- `DISCORD_WEBHOOK_URL`: webhook do canal que receberá sucesso e falha;
- `VIDEO_DURATION_SECONDS`: use 9 ou 10; o padrão é 10 (3 segundos finais são reservados ao resultado);
- `WHEEL_SPIN_SOUND_PATH`: efeito de roleta, por padrão `assets/audio/wheel-spin.mp3`; se estiver ausente, o vídeo continua sem o efeito;
- `REMOTION_CONCURRENCY`: reduza em VPS com pouca memória, por exemplo `25%`;
- `DATA_DIR`, `OUTPUT_DIR` e `AUDIO_DIR`: os defaults `/app/...` são próprios para Docker.

Para as legendas, configure `AI_PROVIDER` como `openai` ou `anthropic`, defina `AI_MODEL` e preencha somente a chave do provider ativo (`OPENAI_API_KEY` ou `ANTHROPIC_API_KEY`). `AI_WEB_SEARCH_ENABLED=false` mantém a busca hospedada desligada; ao mudar para `true`, o sistema habilita a ferramenta nativa do provider. `AI_TIMEOUT_MS` controla o timeout da geração. Qualquer falha usa uma legenda padrão e não interrompe o pipeline.

Os placeholders de Instagram e TikTok estão comentados e não são usados na Fase 1.

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

Nunca altere a ordem de dias já presentes no histórico. Antes de uma correção manual, pare o container e faça uma cópia do JSON; isso evita disputar o arquivo com o job.

## Operação e recuperação

- Vídeos finais: `output/temporada-N/dia-XX.mp4`.
- Estado: arquivo indicado por `ACTIVE_SEASON`.
- Lock: `<arquivo-da-temporada>.lock`; ele existe somente durante um job. Se o processo sofrer encerramento forçado, confirme que não há execução ativa antes de remover um lock órfão.
- Se o render ou a publicação falhar, o estado não avança e o próximo disparo pode tentar novamente.
- Se a gravação do estado concluir e apenas a notificação falhar, o dia continua registrado; uma nova execução reconhecerá a data e não criará outra eliminação.

## Fase 2

Os contratos estão em `src/publish/instagram.js` e `src/publish/tiktok.js`. Hoje, ao habilitar `PUBLISH_ENABLED=true`, ambos retornam sucesso simulado e deixam isso explícito nos logs e no Discord. Substitua os stubs pelas APIs oficiais antes de interpretar a flag como publicação real.

## Referências de infraestrutura

- [Dockerização oficial do Remotion](https://www.remotion.dev/docs/docker)
- [Renderização server-side com `renderMedia()`](https://www.remotion.dev/docs/renderer/render-media)
