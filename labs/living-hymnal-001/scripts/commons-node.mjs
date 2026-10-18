// Three roles for local Church Commons prototypes.
// Always localhost-only; other machines may be reached through SSH tunnels.
import { readFileSync } from 'node:fs';
import { createApp } from '../src/server.mjs';
import { createCommonsMirror } from '../src/commons.mjs';
import { createLeasedMirror } from '../src/commons-lease.mjs';
import { createCommonsGateway } from '../src/commons-gateway.mjs';

const mode = process.argv[2];
const tenant = 'sample-church';
const dataDir = process.env.COMMONS_DATA_DIR;
if (!dataDir) throw new Error('COMMONS_DATA_DIR required');
const trustedKey = () => readFileSync(process.env.COMMONS_TRUSTED_KEY_FILE, 'utf8');
const server = mode === 'owner'
  ? createApp({ dataDir, tenants: { [tenant]: { name: 'Commons Demonstration Church' } },
    allowSubmissions: false })
  : mode === 'mirror'
    ? createCommonsMirror({ tenant, dataDir, trustedPublicKeyPem: trustedKey() })
    : mode === 'leased-mirror'
      ? createLeasedMirror({ tenant, dataDir, trustedPublicKeyPem: trustedKey() })
    : (mode === 'gateway' || mode === 'leased-gateway')
      ? createCommonsGateway({ tenant, receiptDir: dataDir,
        requireLease: mode === 'leased-gateway',
        trustedPublicKeyPem: trustedKey(),
        mirrors: JSON.parse(process.env.COMMONS_MIRRORS_JSON || '[]') })
      : null;
if (!server) throw new Error('Specify owner, mirror, leased-mirror, gateway or leased-gateway');
const port = process.env.COMMONS_PORT === undefined ? 0 : Number(process.env.COMMONS_PORT);
if (!Number.isInteger(port) || port < 0 || port > 65535) throw new Error('Invalid port');
server.listen(port, '127.0.0.1', () => {
  const message = { ready: true, mode, port: server.address().port, bind: '127.0.0.1' };
  if (process.send) process.send(message);
  else process.stdout.write(JSON.stringify(message) + '\n');
});
process.on('SIGTERM', () => server.close(() => process.exit(0)));
