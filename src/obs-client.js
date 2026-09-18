import { createHash, randomUUID } from 'node:crypto';

export class ObsRequestError extends Error {
  constructor(requestType, code, comment = '') {
    super(`OBS request ${requestType} failed (${code})${comment ? `: ${comment}` : ''}`);
    this.name = 'ObsRequestError';
    this.requestType = requestType;
    this.code = code;
    this.comment = comment;
  }
}

export class ObsTimeoutError extends Error {
  constructor(requestType, timeoutMs) {
    super(`OBS request ${requestType} timed out after ${timeoutMs}ms`);
    this.name = 'ObsTimeoutError';
    this.requestType = requestType;
    this.timeoutMs = timeoutMs;
  }
}

export function computeObsAuthentication(password, salt, challenge) {
  const secret = createHash('sha256').update(password + salt, 'utf8').digest('base64');
  return createHash('sha256').update(secret + challenge, 'utf8').digest('base64');
}

export function createObsClient({
  url,
  password = '',
  WebSocketImpl = globalThis.WebSocket,
  timeoutMs = 5000,
  logger = console,
} = {}) {
  if (!url) throw new TypeError('OBS url is required');
  if (typeof WebSocketImpl !== 'function') throw new TypeError('WebSocket implementation is required');

  let socket = null;
  let identified = false;
  let connectPromise = null;
  let resolveConnect = null;
  let rejectConnect = null;
  const pending = new Map();

  function settlePending(error) {
    for (const { reject, timer } of pending.values()) {
      clearTimeout(timer);
      reject(error);
    }
    pending.clear();
  }

  function send(payload) {
    socket.send(JSON.stringify(payload));
  }

  function onMessage(event) {
    let message;
    try {
      message = JSON.parse(String(event.data));
    } catch {
      logger.error?.('OBS sent an unreadable JSON message');
      return;
    }

    if (message.op === 0) {
      const rpcVersion = Math.min(Number(message.d?.rpcVersion) || 1, 1);
      const identify = { rpcVersion, eventSubscriptions: 0 };
      if (message.d?.authentication) {
        identify.authentication = computeObsAuthentication(
          password,
          message.d.authentication.salt,
          message.d.authentication.challenge,
        );
      }
      send({ op: 1, d: identify });
      return;
    }

    if (message.op === 2) {
      identified = true;
      logger.info?.('OBS WebSocket identified');
      resolveConnect?.();
      resolveConnect = null;
      rejectConnect = null;
      return;
    }

    if (message.op === 7) {
      const entry = pending.get(message.d?.requestId);
      if (!entry) return;
      pending.delete(message.d.requestId);
      clearTimeout(entry.timer);
      if (message.d?.requestStatus?.result === true) {
        entry.resolve(message.d.responseData ?? {});
      } else {
        entry.reject(new ObsRequestError(
          message.d?.requestType || entry.requestType,
          message.d?.requestStatus?.code ?? 0,
          message.d?.requestStatus?.comment || '',
        ));
      }
    }
  }

  function connect() {
    if (identified) return Promise.resolve();
    if (connectPromise) return connectPromise;

    connectPromise = new Promise((resolve, reject) => {
      resolveConnect = resolve;
      rejectConnect = reject;
      socket = new WebSocketImpl(url, 'obswebsocket.json');
      socket.addEventListener('message', onMessage);
      socket.addEventListener('error', () => {
        if (!identified) rejectConnect?.(new Error('OBS WebSocket connection error'));
      });
      socket.addEventListener('close', (event) => {
        const error = new Error(`OBS WebSocket closed (${event.code ?? 'unknown'})${event.reason ? `: ${event.reason}` : ''}`);
        if (!identified) rejectConnect?.(error);
        identified = false;
        settlePending(error);
      });
    });

    return connectPromise;
  }

  function request(requestType, requestData = {}) {
    if (!identified || !socket) {
      return Promise.reject(new Error('OBS client is not identified'));
    }
    const requestId = randomUUID();
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        pending.delete(requestId);
        reject(new ObsTimeoutError(requestType, timeoutMs));
      }, timeoutMs);
      pending.set(requestId, { resolve, reject, timer, requestType });
      send({
        op: 6,
        d: {
          requestType,
          requestId,
          ...(Object.keys(requestData).length ? { requestData } : {}),
        },
      });
    });
  }

  function close() {
    socket?.close();
  }

  return { connect, request, close };
}
