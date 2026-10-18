import { intakePhonographPerformance } from '../../../src/phonograph-intake.js';
import { hpHashCanonical, liveHashCanonical } from '../../../src/canonical-json.js';

/**
 * Optional ancestry annotation for Living Hymnal stage preparation.
 *
 * Keeps Vault and Phonograph ownership in their native projects, while
 * proving that the verified source witness, Phonograph completion receipt,
 * resolved performance and Static Live packet describe one specific chain.
 */
export function intakeVaultPhonoLive({
  vaultBridge, phonographReceipt, performance, liveIntent,
}) {
  if (vaultBridge?.schema !== 'haunted-phonograph.vault-provenance-bridge/v0.1' ||
      vaultBridge?.provider !== 'suno' ||
      typeof vaultBridge.providerTrackId !== 'string' ||
      !vaultBridge.providerTrackId ||
      typeof vaultBridge.sourceHash !== 'string' ||
      !/^sha256:[a-f0-9]{64}$/.test(vaultBridge.sourceHash) ||
      !Number.isSafeInteger(vaultBridge.byteLength) ||
      vaultBridge.byteLength <= 44 ||
      vaultBridge.sourceHash !== performance?.sourceHash ||
      vaultBridge.sourceHash !== phonographReceipt?.sourceHash ||
      vaultBridge.resolvedPerformanceHash !== phonographReceipt.resolvedPerformanceHash ||
      vaultBridge.receiptHash !== hpHashCanonical(phonographReceipt)) {
    throw new Error('INVALID_VAULT_PHONOGRAPH_ANCESTRY');
  }
  const crossing = intakePhonographPerformance({
    performance, phonographReceipt, liveIntent,
  });
  return {
    packet: crossing.packet,
    crossingReceipt: crossing.crossingReceipt,
    vaultAncestry: Object.freeze({
      schema: 'living-hymnal.vault-phono-live-ancestry/v0.1',
      vaultSourceHash: vaultBridge.sourceHash,
      vaultBytes: vaultBridge.byteLength,
      phonographReceiptHash: vaultBridge.receiptHash,
      resolvedPerformanceHash: phonographReceipt.resolvedPerformanceHash,
      performancePacketHash: crossing.crossingReceipt.performancePacketHash,
      ancestryHash: liveHashCanonical({
        vaultSourceHash: vaultBridge.sourceHash,
        vaultBytes: vaultBridge.byteLength,
        phonographReceiptHash: vaultBridge.receiptHash,
        resolvedPerformanceHash: phonographReceipt.resolvedPerformanceHash,
        performancePacketHash: crossing.crossingReceipt.performancePacketHash,
      }),
      assertedLimits: [
        'VERIFIED_BYTES != REUSE_LICENSE',
        'PHONOGRAPH PROPOSAL != MUSICAL EVIDENCE',
        'STAGE INTENT != AUTOMATIC WORSHIP APPROVAL',
      ],
    }),
  };
}
