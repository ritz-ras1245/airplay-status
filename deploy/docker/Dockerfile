FROM node:20-bookworm-slim

WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends curl \
  && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY src ./src
COPY config ./config

ENV PORT=3003
ENV METADATA_PIPE=/tmp/shairport-sync-metadata
ENV SKIP_SHAIRPORT_CHECK=1

EXPOSE 3003

CMD ["node", "src/index.js"]
