import { liveHashCanonical } from './canonical-json.js';

const PACKET_VERSION = 'static-live.broadcast-packet/v0.1';
const PLAN_VERSION = 'static-live.broadcast-plan/v0.1';
const LOOPBACK_HOSTS = new Set(['127.0.0.1', 'localhost', '[::1]']);

function fail(message) {
  throw new TypeError(message);
}

function assertLoopback(urlText) {
  let url;
  try {
    url = new URL(urlText);
  } catch {
    fail('OBS url must be a valid ws:// loopback URL');
  }
  if (url.protocol !== 'ws:') fail('OBS url must use ws:// in STREAM-001');
  if (!LOOPBACK_HOSTS.has(url.hostname)) fail('OBS url must be loopback in STREAM-001');
}

export function compileBroadcastPlan(packet) {
  if (!packet || packet.version !== PACKET_VERSION) fail('unsupported broadcast packet version');
  if (!packet.event?.id?.trim()) fail('event.id is required');
  if (!packet.obs?.sceneCollection?.trim()) fail('obs.sceneCollection is required');
  if (!packet.obs?.standbyScene?.trim()) fail('obs.standbyScene is required');
  if (!packet.obs?.fallbackScene?.trim()) fail('obs.fallbackScene is required');
  assertLoopback(packet.obs.url);

  if (packet.recording?.requiredBeforeStream !== true) {
    fail('recording is required before streaming in STREAM-001');
  }
  if (!Array.isArray(packet.obs.allowedScenes) || packet.obs.allowedScenes.length === 0) {
    fail('at least one operator scene is required');
  }

  const ids = new Set();
  const names = new Set();
  const scenes = {};
  for (const scene of packet.obs.allowedScenes) {
    if (!scene?.id?.trim() || !scene?.obsSceneName?.trim()) {
      fail('scene id and OBS scene name are required');
    }
    if (ids.has(scene.id)) fail(`duplicate scene id: ${scene.id}`);
    if (names.has(scene.obsSceneName)) fail(`duplicate OBS scene name: ${scene.obsSceneName}`);
    ids.add(scene.id);
    names.add(scene.obsSceneName);
    scenes[scene.id] = {
      id: scene.id,
      label: scene.label || scene.id,
      obsSceneName: scene.obsSceneName,
    };
  }

  if (packet.obs.standbyScene === packet.obs.fallbackScene) {
    fail('standby and fallback scenes must be distinct');
  }
  if (names.has(packet.obs.standbyScene) || names.has(packet.obs.fallbackScene)) {
    fail('standby/fallback scenes must not collide with operator scenes');
  }

  const body = {
    version: PLAN_VERSION,
    event: structuredClone(packet.event),
    obs: {
      url: packet.obs.url,
      sceneCollection: packet.obs.sceneCollection,
      standbyScene: packet.obs.standbyScene,
      fallbackScene: packet.obs.fallbackScene,
    },
    scenes,
    recording: { requiredBeforeStream: true },
    stream: { enabled: packet.stream?.enabled !== false },
  };

  return { ...body, planDigest: liveHashCanonical(body) };
}
