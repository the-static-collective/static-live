import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { hpHashCanonical } from '../../../src/canonical-json.js';
import { compileStageProjection } from '../../../src/compiler.js';
import { intakeVaultPhonoLive } from '../src/vault-phono-live.mjs';

const fixture = n => JSON.parse(readFileSync('fixtures/phono-live-001/' + n + '.json', 'utf8'));
function witnesses() {
  const performance = fixture('resolved-performance');
  const phonographReceipt = fixture('phonograph-receipt');
  const liveIntent = fixture('live-intent');
  const vaultBridge = {
    schema: 'haunted-phonograph.vault-provenance-bridge/v0.1',
    sourceHash: phonographReceipt.sourceHash,
    byteLength: 8044,
    provider: 'suno',
    providerTrackId: 'synthetic-fixture',
    resolvedPerformanceHash: phonographReceipt.resolvedPerformanceHash,
    receiptHash: hpHashCanonical(phonographReceipt),
    laws: ['VAULT_BYTES != MUSICAL EVIDENCE'],
  };
  return { performance, phonographReceipt, liveIntent, vaultBridge };
}
test('Verified Vault witness binds real Phonograph receipt and existing Static Live compiler', () => {
  const parts = witnesses();
  const crossing = intakeVaultPhonoLive(parts);
  assert.equal(crossing.packet.version, 'static-live.performance-packet/v0.1');
  assert.equal(crossing.vaultAncestry.vaultSourceHash, parts.performance.sourceHash);
  assert.equal(crossing.vaultAncestry.performancePacketHash, crossing.crossingReceipt.performancePacketHash);
  assert.equal(crossing.vaultAncestry.phonographReceiptHash, hpHashCanonical(parts.phonographReceipt));
  assert.equal(JSON.stringify(crossing.vaultAncestry).includes('synthetic-fixture'), false);
  const projection = compileStageProjection(crossing.packet, fixture('configurations/pl1'));
  assert.equal(projection.playable, true);
  assert.equal(projection.fallbackCoverage.length, 1);
});
test('unrelated Vault/Phonograph ancestry refuses even if the performance is individually valid', () => {
  const altered = witnesses();
  altered.vaultBridge.sourceHash = 'sha256:' + '0'.repeat(64);
  assert.throws(() => intakeVaultPhonoLive(altered), /INVALID_VAULT_PHONOGRAPH_ANCESTRY/);
  const alteredReceipt = witnesses();
  alteredReceipt.vaultBridge.receiptHash = 'sha256:' + 'f'.repeat(64);
  assert.throws(() => intakeVaultPhonoLive(alteredReceipt), /INVALID_VAULT_PHONOGRAPH_ANCESTRY/);
  const changedPerformance = witnesses();
  changedPerformance.performance.events[0].note = 10;
  assert.throws(() => intakeVaultPhonoLive(changedPerformance), /PHONOGRAPH_PERFORMANCE_HASH_MISMATCH/);
});
