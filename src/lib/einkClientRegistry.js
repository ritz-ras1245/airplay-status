const DEFAULT_TTL_SEC = 300;
const DEFAULT_SWEEP_SEC = 60;

/** @type {Map<string, { lastSeenAt: number, source: 'png' | 'html' }>} */
const clients = new Map();

let sweepTimer = null;
/** @type {((profileId: string) => void) | null} */
let onEvict = null;

const ttlMs = () => Number(process.env.EINK_CLIENT_TTL_SEC || DEFAULT_TTL_SEC) * 1000;
const sweepMs = () => Number(process.env.EINK_CLIENT_SWEEP_SEC || DEFAULT_SWEEP_SEC) * 1000;

export const touchClient = (profileId, source) => {
  clients.set(profileId, { lastSeenAt: Date.now(), source });
};

export const getActiveProfiles = () => {
  const now = Date.now();
  const ttl = ttlMs();
  return [...clients.entries()]
    .filter(([, entry]) => now - entry.lastSeenAt <= ttl)
    .map(([profileId]) => profileId);
};

export const isProfileActive = (profileId) => getActiveProfiles().includes(profileId);

export const pruneClients = () => {
  const now = Date.now();
  const ttl = ttlMs();
  const evicted = [];

  for (const [profileId, entry] of clients.entries()) {
    if (now - entry.lastSeenAt > ttl) {
      clients.delete(profileId);
      evicted.push(profileId);
    }
  }

  for (const profileId of evicted) {
    onEvict?.(profileId);
  }

  return evicted;
};

export const configureClientEviction = (handler) => {
  onEvict = handler;
};

export const startClientSweep = () => {
  if (sweepTimer) return;
  sweepTimer = setInterval(pruneClients, sweepMs());
  if (typeof sweepTimer.unref === 'function') sweepTimer.unref();
};

export const resetClientRegistryForTests = () => {
  clients.clear();
  if (sweepTimer) {
    clearInterval(sweepTimer);
    sweepTimer = null;
  }
  onEvict = null;
};
