import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const stages = JSON.parse(
  readFileSync(path.join(projectRoot, 'config/deploy/stages.json'), 'utf8'),
);

const STAGE_ALIASES = {
  p49: 'beta',
  p50: 'beta',
  p99: 'beta',
  p100: 'prod',
  p101: 'prod',
};

export const STAGE_IDS = Object.keys(stages);

/** @returns {'dev' | 'beta' | 'prod'} */
export const resolveStageId = () => {
  const explicit = process.env.DEPLOY_STAGE?.trim().toLowerCase();
  if (explicit && stages[explicit]) return explicit;

  const phase = process.env.DEPLOY_PHASE?.trim().toLowerCase();
  if (phase && STAGE_ALIASES[phase]) return STAGE_ALIASES[phase];

  return 'dev';
};

export const getDeployStage = () => {
  const id = resolveStageId();
  const preset = stages[id];
  const deployPhase =
    process.env.DEPLOY_PHASE?.trim() ||
    preset.deployPhase ||
    (id === 'dev' ? null : id);

  return {
    id,
    label: preset.label,
    airplayReceiverName:
      process.env.AIRPLAY_RECEIVER_NAME?.trim() || preset.airplayReceiverName,
    dashboardTitle:
      process.env.DASHBOARD_TITLE?.trim() || preset.dashboardTitle,
    port: Number(process.env.PORT || preset.port || 3003),
    logLevel: process.env.LOG_LEVEL?.trim() || preset.logLevel || 'info',
    shairportLogVerbosity: Number(
      process.env.SHAIRPORT_LOG_VERBOSITY ?? preset.shairportLogVerbosity ?? 1,
    ),
    deployPhase: deployPhase || null,
    deployHost: process.env.DEPLOY_HOST?.trim() || null,
  };
};
