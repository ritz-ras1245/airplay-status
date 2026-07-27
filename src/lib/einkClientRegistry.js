const TTL_MS = Number(process.env.EINK_CLIENT_TTL_SEC || 300) * 1000;
const SWEEP_MS = Number(process.env.EINK_CLIENT_SWEEP_SEC || 60) * 1000;

const clients = new Map();
let sweepTimer = null;

const prune = () => {
  const now = Date.now();
  for (const [profileId, entry] of clients) {
    if (now - entry.lastSeenAt > TTL_MS) {
      clients.delete(profileId);
    }
  }
};

const ensureSweep = () => {
  if (sweepTimer) return;
  sweepTimer = setInterval(prune, SWEEP_MS);
  if (sweepTimer.unref) sweepTimer.unref();
};

export const touchEinkClient = (profileId, source = 'html') => {
  ensureSweep();
  clients.set(profileId, { lastSeenAt: Date.now(), source });
};

export const getActiveEinkProfiles = () => {
  prune();
  return [...clients.keys()];
};

export const isEinkProfileActive = (profileId) => {
  prune();
  const entry = clients.get(profileId);
  if (!entry) return false;
  return Date.now() - entry.lastSeenAt <= TTL_MS;
};

export const resetEinkClientRegistry = () => {
  clients.clear();
  if (sweepTimer) {
    clearInterval(sweepTimer);
    sweepTimer = null;
  }
};
