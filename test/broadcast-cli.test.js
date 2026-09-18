import test from 'node:test';
import assert from 'node:assert/strict';
import { parseBroadcastCliArgs, runBroadcastCli } from '../src/broadcast-cli.js';

test('CLI parser accepts packet path and bounded port', () => {
  assert.deepEqual(parseBroadcastCliArgs(['fixture.json', '--port', '4567']), { packetPath: 'fixture.json', port: 4567 });
  assert.throws(() => parseBroadcastCliArgs(['fixture.json', '--port', '99999']), /port/);
  assert.throws(() => parseBroadcastCliArgs([]), /packet/);
});

test('CLI startup never prints the OBS secret and returns local console url', async () => {
  const lines = [];
  const fakePacket = {
    version: 'static-live.broadcast-packet/v0.1',
    event: { id: 'demo', title: 'Demo' },
    obs: {
      url: 'ws://127.0.0.1:4455', sceneCollection: 'Demo', standbyScene: 'Standby', fallbackScene: 'Fallback',
      allowedScenes: [{ id: 'wide', label: 'Wide', obsSceneName: 'Wide' }],
    },
    recording: { requiredBeforeStream: true }, stream: { enabled: true },
  };
  let receivedSecret;
  const obs = { async connect() {}, close() {}, async request() {} };
  const controller = { async preflight() {}, getStatus() { return { state: 'ready' }; } };
  const server = { async start() { return { host: '127.0.0.1', port: 4444, url: 'http://127.0.0.1:4444' }; }, async stop() {} };

  const result = await runBroadcastCli({
    argv: ['fixture.json', '--port', '4444'],
    env: { STATIC_BROADCAST_OBS_PASSWORD: 'very-secret' },
    readFileFn: async () => JSON.stringify(fakePacket),
    createObsClientFn: (options) => { receivedSecret = options.password; return obs; },
    createBroadcastControllerFn: () => controller,
    createBroadcastServerFn: () => server,
    logger: { log: (...args) => lines.push(args.join(' ')), error: (...args) => lines.push(args.join(' ')) },
    installSignalHandlers: false,
  });

  assert.equal(receivedSecret, 'very-secret');
  assert.equal(result.address.url, 'http://127.0.0.1:4444');
  assert.equal(lines.join('\n').includes('very-secret'), false);
  assert.match(lines.join('\n'), /http:\/\/127\.0\.0\.1:4444/);
});
