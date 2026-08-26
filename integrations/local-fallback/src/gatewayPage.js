const escapeHtml = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[c]));

const badge = (status) => {
  const label = { up: '● up', degraded: '◐ degraded', down: '○ down' }[status] || status;
  return `<span class="badge badge--${escapeHtml(status)}">${escapeHtml(label)}</span>`;
};

/**
 * Render the human-friendly gateway status page (all services + probe matrix).
 * Pure (data in → HTML out) so it can be asserted in tests.
 *
 * @param {{uptimeSec:number}} gateway
 * @param {Record<string, {status:string, proxying:boolean, primaryHost:string, ports:Array}>} services
 * @param {number} [refreshSec]
 */
export const renderGatewayPage = (gateway, services, refreshSec = 5) => {
  const cards = Object.entries(services)
    .map(([name, s]) => {
      const rows = s.ports
        .map(
          (p) => `<tr class="p p--${p.up ? 'up' : 'down'}">
            <td>${escapeHtml(p.port)}/${escapeHtml(p.check)}</td>
            <td class="state">${p.up ? '● up' : '○ down'}</td>
            <td>${escapeHtml(p.up && p.latencyMs != null ? `${p.latencyMs} ms` : '—')}</td>
            <td>${escapeHtml(p.error || '')}</td>
          </tr>`,
        )
        .join('\n');

      return `<section class="card">
        <div class="card__head">
          <h2>${escapeHtml(name)}</h2>
          ${badge(s.status)}
        </div>
        <p class="host">primary <code>${escapeHtml(s.primaryHost)}</code> · ${s.proxying ? 'proxying' : 'serving fallback'}</p>
        <table>
          <thead><tr><th>Port</th><th>State</th><th>Latency</th><th>Detail</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </section>`;
    })
    .join('\n');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta http-equiv="refresh" content="${Number(refreshSec)}">
<title>Fallback gateway status</title>
<style>
  :root { color-scheme: dark; }
  body { font-family: system-ui, -apple-system, sans-serif; background:#0a0a0a; color:#f5f5f5; margin:0; padding:2rem; }
  h1 { font-size:1.25rem; margin:0 0 .25rem; }
  .sub { color:#a3a3a3; font-size:.85rem; margin:0 0 1.5rem; }
  .card { max-width:640px; background:#141414; border:1px solid #2a2a2a; border-radius:14px; padding:1.25rem 1.5rem; margin-bottom:1rem; }
  .card__head { display:flex; align-items:center; justify-content:space-between; }
  h2 { font-size:1.05rem; margin:0; }
  .host { color:#a3a3a3; font-size:.8rem; margin:.35rem 0 1rem; }
  code { color:#6eb6ff; }
  table { width:100%; border-collapse:collapse; font-size:.85rem; }
  th, td { text-align:left; padding:.4rem; border-bottom:1px solid #222; }
  th { color:#a3a3a3; font-weight:500; }
  .p--up .state { color:#5de87a; } .p--down .state { color:#ff6b6b; }
  .badge { font-size:.75rem; padding:.15rem .5rem; border-radius:999px; }
  .badge--up { background:rgba(48,209,88,.15); color:#5de87a; }
  .badge--degraded { background:rgba(255,159,10,.18); color:#ffb340; }
  .badge--down { background:rgba(255,69,58,.15); color:#ff6b6b; }
</style>
</head>
<body>
  <h1>Fallback gateway</h1>
  <p class="sub">up ${escapeHtml(gateway.uptimeSec)}s · auto-refresh ${escapeHtml(refreshSec)}s · JSON at <code>/_gateway/services</code></p>
  ${cards || '<p class="sub">No services configured.</p>'}
</body>
</html>`;
};
