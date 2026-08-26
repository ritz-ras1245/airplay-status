import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseServicesConfig } from './config.js';
import { createGateway } from './gateway.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const configPath =
  process.env.SERVICES_CONFIG || path.join(__dirname, '..', 'config', 'services.json');

let raw;
try {
  raw = readFileSync(configPath, 'utf8');
} catch {
  console.error(`local-fallback: cannot read config at ${configPath}`);
  console.error('Set SERVICES_CONFIG or copy config/services.example.json to config/services.json');
  process.exit(1);
}

const config = parseServicesConfig(raw);
const timeoutMs = Number(process.env.PROBE_TIMEOUT_MS || 2000);
const cacheMs = Number(process.env.PROBE_CACHE_MS || 3000);

const server = createGateway({ config, timeoutMs, cacheMs });
server.listen(config.gatewayPort, () => {
  console.log(`local-fallback gateway on :${config.gatewayPort}`);
  for (const s of Object.values(config.services)) {
    console.log(`  service ${s.name} → ${s.proxyTo || '(no proxy)'} (primary ${s.primaryHost})`);
  }
});
