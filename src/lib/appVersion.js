import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const pkg = JSON.parse(readFileSync(path.join(projectRoot, 'package.json'), 'utf8'));

export const APP_NAME = pkg.name;
export const APP_VERSION = pkg.version;

/** Deploy metadata — set on RPi/Docker via env at install time. */
export function getVersionInfo() {
  const major = parseInt(APP_VERSION.split('.')[0], 10) || 0;
  return {
    name: APP_NAME,
    version: APP_VERSION,
    releaseLine: major >= 1 ? major : null,
    gitCommit: process.env.GIT_COMMIT || process.env.BUILD_SHA || null,
    deployPhase: process.env.DEPLOY_PHASE || null,
    deployHost: process.env.DEPLOY_HOST || null,
    node: process.version,
  };
}
