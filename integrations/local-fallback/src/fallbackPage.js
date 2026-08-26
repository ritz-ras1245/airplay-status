const escapeHtml = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[c]));

/**
 * Render the "primary unavailable" status page with a live probe matrix.
 * Pure (string in → HTML out) so it can be asserted in tests.
 */
export const renderFallbackPage = (service, health) => {
  const rows = health.ports
    .map((p) => {
      const state = p.up ? 'up' : 'down';
      const latency = p.up && p.latencyMs != null ? `${p.latencyMs} ms` : '—';
      return `<tr class="p p--${state}">
        <td>${escapeHtml(p.port)}/${escapeHtml(p.check)}</td>
        <td class="state">${p.up ? '● up' : '○ down'}</td>
        <td>${escapeHtml(latency)}</td>
        <td>${escapeHtml(p.error || '')}</td>
      </tr>`;
    })
    .join('\n');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapeHtml(service.fallbackTitle)} — unavailable</title>
<style>
  :root { color-scheme: dark; }
  body { font-family: system-ui, -apple-system, sans-serif; background:#0a0a0a; color:#f5f5f5;
         min-height:100vh; margin:0; display:flex; align-items:center; justify-content:center; padding:2rem; }
  .card { max-width:520px; width:100%; background:#141414; border:1px solid #2a2a2a; border-radius:16px; padding:2rem; }
  h1 { font-size:1.25rem; margin:0 0 .25rem; }
  .sub { color:#a3a3a3; margin:0 0 1.5rem; font-size:.9rem; }
  table { width:100%; border-collapse:collapse; font-size:.85rem; }
  th, td { text-align:left; padding:.5rem .4rem; border-bottom:1px solid #222; }
  th { color:#a3a3a3; font-weight:500; }
  .p--up .state { color:#5de87a; }
  .p--down .state { color:#ff6b6b; }
  .hint { margin-top:1.5rem; color:#a3a3a3; font-size:.8rem; line-height:1.5; }
  code { color:#6eb6ff; }
</style>
</head>
<body>
  <div class="card">
    <h1>${escapeHtml(service.fallbackTitle)} is unavailable</h1>
    <p class="sub">Primary host <code>${escapeHtml(service.primaryHost)}</code> is not responding — status <strong>${escapeHtml(health.status)}</strong>.</p>
    <table>
      <thead><tr><th>Port</th><th>State</th><th>Latency</th><th>Detail</th></tr></thead>
      <tbody>
${rows}
      </tbody>
    </table>
    <p class="hint">The fallback gateway is up and will resume proxying automatically once the primary recovers. Check the host's power / Ethernet.</p>
  </div>
</body>
</html>`;
};
