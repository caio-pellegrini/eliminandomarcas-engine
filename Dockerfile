FROM node:24.18.0-bookworm-slim AS base

RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    ca-certificates \
    fonts-liberation \
    fonts-noto-color-emoji \
    libnss3 \
    libdbus-1-3 \
    libatk1.0-0 \
    libgbm-dev \
    libasound2 \
    libxrandr2 \
    libxkbcommon-dev \
    libxfixes3 \
    libxcomposite1 \
    libxdamage1 \
    libatk-bridge2.0-0 \
    libpango-1.0-0 \
    libcairo2 \
    libcups2 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci \
    && npx remotion browser ensure \
    && mkdir -p node_modules/.cache \
    && chown node:node node_modules/.cache

COPY --chown=node:node src ./src
COPY --chown=node:node data ./data
COPY --chown=node:node assets ./assets
RUN mkdir -p /app/output && chown node:node /app/output

FROM base AS development
COPY --chown=node:node test ./test
ENV NODE_ENV=development
USER node
CMD ["npm", "run", "dev"]

FROM base AS production
RUN npm prune --omit=dev
ENV NODE_ENV=production
USER node
CMD ["node", "src/index.js"]
