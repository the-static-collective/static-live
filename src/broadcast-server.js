import { createServer } from 'node:http';

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function operatorPage(plan) {
  const sceneButtons = Object.values(plan.scenes)
    .map((scene) => `<button class="scene" data-scene-id="${escapeHtml(scene.id)}">${escapeHtml(scene.label)}</button>`)
    .join('\n');
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(plan.event.title)} — Static Broadcast</title>
<style>
:root { font-family: system-ui, sans-serif; color-scheme: dark; background:#111; color:#f5f5f5; }
body { max-width: 860px; margin: 0 auto; padding: 24px; }
header { display:flex; justify-content:space-between; gap:16px; align-items:end; }
small { opacity:.7; }
.status { display:grid; grid-template-columns:repeat(auto-fit,minmax(140px,1fr)); gap:10px; margin:24px 0; }
.card { background:#1d1d1d; padding:14px; border-radius:10px; }
.controls { display:grid; gap:16px; }
button { min-height:58px; font:inherit; font-weight:700; border:1px solid #555; border-radius:10px; cursor:pointer; }
.primary { font-size:1.25rem; }
.scenes { display:grid; grid-template-columns:repeat(auto-fit,minmax(140px,1fr)); gap:10px; }
#fault { white-space:pre-wrap; background:#2a1919; padding:14px; border-radius:10px; display:none; }
</style>
</head>
<body>
<header><div><small>STATIC BROADCAST / STREAM-001</small><h1>${escapeHtml(plan.event.title)}</h1></div><div id="state">loading</div></header>
<section class="status">
<div class="card"><small>RECORDING</small><div id="recording">—</div></div>
<div class="card"><small>STREAM</small><div id="stream">—</div></div>
<div class="card"><small>SCENE</small><div id="scene">—</div></div>
</section>
<div id="fault"></div>
<section class="controls">
<button id="live" class="primary">GO LIVE</button>
<div class="scenes">${sceneButtons}</div>
<button id="mark" type="button">MARK MOMENT · private observation only</button>
<button id="end" class="primary">END + PRESERVE</button>
</section>
<script>
async function api(path, method='GET') {
  const response = await fetch(path, { method });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error || 'request failed');
  return body;
}
function paint(body) {
  const s = body.status || body;
  document.querySelector('#state').textContent = s.state;
  document.querySelector('#recording').textContent = s.recording ? 'ACTIVE' : 'OFF';
  document.querySelector('#stream').textContent = s.stream ? 'LIVE' : 'OFF';
  document.querySelector('#scene').textContent = s.currentScene || '—';
  const fault = document.querySelector('#fault');
  fault.textContent = s.fault || '';
  fault.style.display = s.fault ? 'block' : 'none';
  document.querySelector('#live').disabled = s.state !== 'ready';
  document.querySelector('#end').disabled = !(s.recording || s.stream);
  document.querySelector('#mark').disabled = !(s.momentMarkingAvailable && s.recording && ['recording','recording_only','live'].includes(s.state));
  document.querySelectorAll('.scene').forEach((button) => {
    button.disabled = !['recording','recording_only','live'].includes(s.state);
  });
}
async function refresh() {
  try { paint(await api('/api/status')); } catch (error) {
    document.querySelector('#fault').textContent = error.message;
    document.querySelector('#fault').style.display = 'block';
  }
}
document.querySelector('#live').addEventListener('click', async () => { try { paint(await api('/api/live','POST')); } catch (e) { await refresh(); } });
document.querySelector('#mark').addEventListener('click', async () => {
  try { const result = await api('/api/moment/mark','POST');
    document.querySelector('#mark').textContent = 'MARKED #' + result.marker.sequence;
  } catch (e) { const fault = document.querySelector('#fault'); fault.textContent = e.message; fault.style.display = 'block'; }
});
document.querySelector('#end').addEventListener('click', async () => { try { paint(await api('/api/end','POST')); } catch (e) { await refresh(); } });
document.querySelectorAll('.scene').forEach((button) => button.addEventListener('click', async () => {
  try { paint(await api('/api/scene/' + encodeURIComponent(button.dataset.sceneId),'POST')); } catch (e) { await refresh(); }
}));
refresh();
setInterval(refresh, 1000);
</script>
</body>
</html>`;
}

export function createBroadcastServer({ controller, plan, markerBook = null, host = '127.0.0.1', port = 0 } = {}) {
  if (host !== '127.0.0.1') throw new TypeError('STREAM-001 server must bind 127.0.0.1');
  if (!controller || !plan) throw new TypeError('controller and plan are required');

  let listening = false;
  const server = createServer(async (req, res) => {
    const url = new URL(req.url || '/', 'http://127.0.0.1');
    const json = (statusCode, body) => {
      const payload = JSON.stringify(body);
      res.writeHead(statusCode, { 'content-type': 'application/json; charset=utf-8', 'content-length': Buffer.byteLength(payload) });
      res.end(payload);
    };

    if (req.method === 'GET' && url.pathname === '/') {
      const html = operatorPage(plan);
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'content-length': Buffer.byteLength(html) });
      res.end(html);
      return;
    }

    // Identity is a descriptive local door contract, not authentication or readiness proof.
    // The control plane remains entirely owned by Static Broadcast.
    if (req.method === 'GET' && url.pathname === '/api/house/identity') {
      json(200, {
        service: 'static-live.broadcast',
        contract: 'static-live.broadcast-house-door/v0.1',
        consolePath: '/',
        eventId: plan.event.id,
      });
      return;
    }

    if (req.method === 'GET' && url.pathname === '/api/status') {
      json(200, {
        status: { ...controller.getStatus(), momentMarkingAvailable: Boolean(markerBook) },
        event: { id: plan.event.id, title: plan.event.title },
        scenes: Object.values(plan.scenes).map(({ id, label, obsSceneName }) => ({ id, label, obsSceneName })),
      });
      return;
    }

    const actionRoute = url.pathname === '/api/live' || url.pathname === '/api/end' || url.pathname === '/api/moment/mark' || url.pathname.startsWith('/api/scene/');
    if (actionRoute && req.method !== 'POST') {
      json(405, { error: 'method not allowed' });
      return;
    }

    try {
      if (req.method === 'POST' && url.pathname === '/api/live') {
        try { await controller.goLive(); }
        finally { if (markerBook && controller.getStatus().recording) markerBook.begin(); }
        json(200, { status: { ...controller.getStatus(), momentMarkingAvailable: Boolean(markerBook) } });
        return;
      }
      if (req.method === 'POST' && url.pathname === '/api/moment/mark') {
        if (!markerBook) { json(409, { error: 'private marker journal not configured' }); return; }
        const marker = markerBook.mark(controller.getStatus());
        json(200, { marker, status: controller.getStatus() });
        return;
      }
      if (req.method === 'POST' && url.pathname === '/api/end') {
        const receipt = await controller.endAndPreserve();
        json(200, { status: controller.getStatus(), receipt });
        return;
      }
      if (req.method === 'POST' && url.pathname.startsWith('/api/scene/')) {
        const sceneId = decodeURIComponent(url.pathname.slice('/api/scene/'.length));
        if (!plan.scenes[sceneId]) {
          json(404, { error: 'undeclared scene id' });
          return;
        }
        await controller.changeScene(sceneId);
        json(200, { status: controller.getStatus() });
        return;
      }
      json(404, { error: 'not found' });
    } catch (error) {
      json(409, { error: error instanceof Error ? error.message : String(error), status: controller.getStatus() });
    }
  });

  async function start() {
    if (listening) throw new Error('broadcast server already started');
    await new Promise((resolve, reject) => {
      server.once('error', reject);
      server.listen(port, host, () => {
        server.off('error', reject);
        resolve();
      });
    });
    listening = true;
    const address = server.address();
    const actualPort = typeof address === 'object' && address ? address.port : port;
    return { host, port: actualPort, url: `http://${host}:${actualPort}` };
  }

  async function stop() {
    if (!listening) return;
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    listening = false;
  }

  return { start, stop };
}
