#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { compileBroadcastPlan } from './broadcast-compiler.js';
import { createObsClient } from './obs-client.js';
import { createBroadcastController } from './broadcast-controller.js';
import { createBroadcastServer } from './broadcast-server.js';
import { createMomentMarker } from './lifestream-002-marker.js';

export function parseBroadcastCliArgs(argv) {
  if (!Array.isArray(argv) || argv.length === 0 || argv[0].startsWith('--')) {
    throw new TypeError('broadcast packet path is required');
  }
  const packetPath = argv[0];
  let port = 3008;
  let momentJournal = null;
  for (let index = 1; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--port') {
      const raw = argv[index + 1];
      const parsed = Number(raw);
      if (!Number.isInteger(parsed) || parsed < 0 || parsed > 65535) {
        throw new TypeError('port must be an integer from 0 to 65535');
      }
      port = parsed;
      index += 1;
      continue;
    }
    if (arg === '--moment-journal') {
      if (!argv[index + 1] || argv[index + 1].startsWith('--') || momentJournal !== null)
        throw new TypeError('--moment-journal requires one private local file path');
      momentJournal = argv[++index];
      continue;
    }
    throw new TypeError(`unknown argument: ${arg}`);
  }
  return { packetPath, port, momentJournal };
}

export async function runBroadcastCli({
  argv = process.argv.slice(2),
  env = process.env,
  readFileFn = readFile,
  createObsClientFn = createObsClient,
  createBroadcastControllerFn = createBroadcastController,
  createBroadcastServerFn = createBroadcastServer,
  logger = console,
  installSignalHandlers = true,
} = {}) {
  const { packetPath, port, momentJournal } = parseBroadcastCliArgs(argv);
  const packet = JSON.parse(await readFileFn(packetPath, 'utf8'));
  const plan = compileBroadcastPlan(packet);
  const obs = createObsClientFn({
    url: plan.obs.url,
    password: env.STATIC_BROADCAST_OBS_PASSWORD || '',
    logger: {
      info: (...args) => logger.log?.(...args),
      error: (...args) => logger.error?.(...args),
    },
  });

  await obs.connect();
  const controller = createBroadcastControllerFn({ plan, obs });
  await controller.preflight();
  const markerBook = momentJournal ? createMomentMarker({ journalPath: momentJournal, eventId: plan.event.id }) : null;
  const server = createBroadcastServerFn({ controller, plan, markerBook, host: '127.0.0.1', port });
  const address = await server.start();

  logger.log?.(`STATIC BROADCAST — ${plan.event.title}`);
  logger.log?.(address.url);

  let closed = false;
  async function shutdown() {
    if (closed) return;
    closed = true;
    await server.stop();
    obs.close();
  }

  if (installSignalHandlers) {
    const onSignal = () => {
      shutdown().catch((error) => logger.error?.(error instanceof Error ? error.message : String(error)));
    };
    process.once('SIGINT', onSignal);
    process.once('SIGTERM', onSignal);
  }

  return { plan, obs, controller, server, address, shutdown };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runBroadcastCli().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
