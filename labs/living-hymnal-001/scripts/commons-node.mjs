// Separate-process loopback harness for Church Commons 001.
// Intentionally cannot bind to a public interface.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';
import { createApp } from '../src/server.mjs';
import { createCommonsMirror } from '../src/commons.mjs';

const mode = process.argv[2];
const tenant = 'sample-church';
const dataDir = process.env.COMMONS_DATA_DIR;
if (!dataDir) throw new Error('COMMONS_DATA_DIR required');
const server = mode === 'owner'
  ? createApp({ dataDir, tenants: { [tenant]: { name: 'Commons Demonstration Church' } },
    allowSubmissions: false })
  : mode === 'mirror'
    ? createCommonsMirror({ tenant, dataDir,
      trustedPublicKeyPem: readFileSync(process.env.COMMONS_TRUSTED_KEY_FILE, 'utf8') })
    : null;
if (!server) throw new Error('Specify owner or mirror');
server.listen(0, '127.0.0.1', () => {
  const message = { ready: true, mode, port: server.address().port };
  if (process.send) process.send(message);
  else process.stdout.write(JSON.stringify(message) + '\n');
});
process.on('SIGTERM', () => server.close(() => process.exit(0)));
