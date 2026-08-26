FROM node:20-alpine

WORKDIR /app

# No runtime dependencies (Node http/net only) — copy source as-is.
COPY package.json ./
COPY src ./src

ENV GATEWAY_HTTP_PORT=80
ENV SERVICES_CONFIG=/app/config/services.json

# Config is mounted at runtime (see docker-compose.yml); never bake LAN
# hostnames/IPs into the image.
EXPOSE 80

CMD ["node", "src/server.js"]
