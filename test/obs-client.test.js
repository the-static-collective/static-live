import test from 'node:test';
import assert from 'node:assert/strict';
import {
  computeObsAuthentication,
  createObsClient,
  ObsRequestError,
  ObsTimeoutError,
} from '../src/obs-client.js';

class FakeWebSocket {
  constructor() {
    this.listeners = new Map();
    this.sent = [];
    this.readyState = 1;
  }
  addEventListener(type, handler) {
    const handlers = this.listeners.get(type) || [];
    handlers.push(handler);
    this.listeners.set(type, handlers);
  }
  emit(type, event = {}) {
    for (const handler of this.listeners.get(type) || []) handler(event);
  }
  open() { this.emit('open', {}); }
  message(payload) { this.emit('message', { data: JSON.stringify(payload) }); }
  send(payload) { this.sent.push(payload); }
  close() { this.readyState = 3; this.emit('close', { code: 1000, reason: 'closed' }); }
}

function connectClient({ password = '', timeoutMs = 30, logger = { info() {}, error() {} } } = {}) {
  const socket = new FakeWebSocket();
  const WebSocketImpl = class { constructor() { return socket; } };
  const client = createObsClient({
    url: 'ws://127.0.0.1:4455',
    password,
    WebSocketImpl,
    timeoutMs,
    logger,
  });
  return { client, socket };
}

async function identify(client, socket, hello = { op: 0, d: { rpcVersion: 1 } }) {
  const connecting = client.connect();
  socket.open();
  socket.message(hello);
  socket.message({ op: 2, d: { negotiatedRpcVersion: 1 } });
  await connecting;
}

test('OBS authentication matches the documented v5 formula fixture', () => {
  assert.equal(
    computeObsAuthentication(
      'supersecretpassword',
      'lM1GncleQOaCu9lT1yeUZhFYnqhsLLP1G5lAGo3ixaI=',
      '+IxH4CnCiqpX1rM9scsNynZzbOe4KhDeYcTNS3PDaeY=',
    ),
    '1Ct943GAT+6YQUUX47Ia/ncufilbe6+oD6lY+5kaCu4=',
  );
});

test('client sends authenticated Identify only after Hello', async () => {
  const { client, socket } = connectClient({ password: 'supersecretpassword' });
  const connecting = client.connect();
  socket.open();
  assert.equal(socket.sent.length, 0);
  socket.message({
    op: 0,
    d: {
      rpcVersion: 1,
      authentication: {
        challenge: '+IxH4CnCiqpX1rM9scsNynZzbOe4KhDeYcTNS3PDaeY=',
        salt: 'lM1GncleQOaCu9lT1yeUZhFYnqhsLLP1G5lAGo3ixaI=',
      },
    },
  });
  const identifyMessage = JSON.parse(socket.sent[0]);
  assert.equal(identifyMessage.op, 1);
  assert.equal(identifyMessage.d.rpcVersion, 1);
  assert.equal(identifyMessage.d.eventSubscriptions, 0);
  assert.equal(identifyMessage.d.authentication, '1Ct943GAT+6YQUUX47Ia/ncufilbe6+oD6lY+5kaCu4=');
  socket.message({ op: 2, d: { negotiatedRpcVersion: 1 } });
  await connecting;
});

test('OBS request failures reject with typed errors', async () => {
  const { client, socket } = connectClient();
  await identify(client, socket);
  const pending = client.request('StartStream');
  const request = JSON.parse(socket.sent.at(-1));
  socket.message({
    op: 7,
    d: {
      requestType: 'StartStream',
      requestId: request.d.requestId,
      requestStatus: { result: false, code: 500, comment: 'boom' },
    },
  });
  await assert.rejects(pending, (error) => error instanceof ObsRequestError && error.code === 500);
});

test('successful responses correlate by request id', async () => {
  const { client, socket } = connectClient();
  await identify(client, socket);
  const pending = client.request('GetSceneList');
  const request = JSON.parse(socket.sent.at(-1));
  socket.message({
    op: 7,
    d: {
      requestType: 'GetSceneList',
      requestId: request.d.requestId,
      requestStatus: { result: true, code: 100 },
      responseData: { currentProgramSceneName: 'Wide' },
    },
  });
  assert.deepEqual(await pending, { currentProgramSceneName: 'Wide' });
});

test('unanswered OBS request times out instead of becoming success', async () => {
  const { client, socket } = connectClient({ timeoutMs: 10 });
  await identify(client, socket);
  await assert.rejects(client.request('GetSceneList'), ObsTimeoutError);
});

test('logs never receive the password or authentication string', async () => {
  const lines = [];
  const logger = { info: (...args) => lines.push(args.join(' ')), error: (...args) => lines.push(args.join(' ')) };
  const { client, socket } = connectClient({ password: 'top-secret-password', logger });
  const connecting = client.connect();
  socket.open();
  socket.message({ op: 0, d: { rpcVersion: 1, authentication: { salt: 'salt', challenge: 'challenge' } } });
  const identifyMessage = JSON.parse(socket.sent[0]);
  socket.message({ op: 2, d: { negotiatedRpcVersion: 1 } });
  await connecting;
  const joined = lines.join('\n');
  assert.equal(joined.includes('top-secret-password'), false);
  assert.equal(joined.includes(identifyMessage.d.authentication), false);
});
