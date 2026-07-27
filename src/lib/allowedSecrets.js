/** Keys allowed in one-time setup upload / apply-secrets-file (never commit values). */
export const ALLOWED_SECRET_KEYS = new Set([
  'TIDBYT_DEVICE_ID',
  'TIDBYT_API_TOKEN',
  'TIDBYT_INSTALLATION_ID',
  'TIDBYT_ENABLED',
]);

export const parseEnvLines = (text) => {
  const entries = [];
  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!ALLOWED_SECRET_KEYS.has(key)) continue;
    entries.push({ key, value, line: `${key}=${value}` });
  }
  return entries;
};

export const mergeEnvFile = (existingText, newEntries) => {
  const byKey = new Map(newEntries.map((e) => [e.key, e.line]));
  const out = [];
  const seen = new Set();

  for (const line of existingText.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      out.push(line);
      continue;
    }
    const eq = trimmed.indexOf('=');
    if (eq <= 0) {
      out.push(line);
      continue;
    }
    const key = trimmed.slice(0, eq).trim();
    if (byKey.has(key)) {
      out.push(byKey.get(key));
      seen.add(key);
    } else {
      out.push(line);
    }
  }

  for (const [key, line] of byKey) {
    if (!seen.has(key)) out.push(line);
  }

  return `${out.join('\n').replace(/\n+$/, '')}\n`;
};
