import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getDeployStage } from './deployStage.js';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const pkg = JSON.parse(readFileSync(path.join(projectRoot, 'package.json'), 'utf8'));

export const APP_NAME = pkg.name;
export const APP_VERSION = pkg.version;

/** Deploy metadata — set on RPi/Docker via env at install time. */
export function getVersionInfo() {
  const stage = getDeployStage();
  const major = parseInt(APP_VERSION.split('.')[0], 10) || 0;
  return {
    name: APP_NAME,
    version: APP_VERSION,
    releaseLine: major >= 1 ? major : null,
    gitCommit: process.env.GIT_COMMIT || process.env.BUILD_SHA || null,
    deployPhase: stage.deployPhase,
    deployHost: stage.deployHost,
    deployStage: stage.id,
    stageLabel: stage.label,
    airplayReceiverName: stage.airplayReceiverName,
    dashboardTitle: stage.dashboardTitle,
    logLevel: stage.logLevel,
    node: process.version,
  };
}
