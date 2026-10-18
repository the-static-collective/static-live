/**
 * Local WAV preflight for a conventional church playback rig.
 * Reads file headers only. No sound playback, routing or cloud processing.
 * A green preflight does NOT replace a soundcheck or verify lyric/stem rights.
 */
import { openSync, closeSync, readSync, realpathSync, statSync, existsSync, readFileSync } from 'node:fs';
import { resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const validStemName = /^[A-Za-z0-9_./-]+\.wav$/;
function safePath(root, filename) {
  if (typeof filename !== 'string' || !validStemName.test(filename) ||
      filename.startsWith('/') || filename.includes('..') || filename.includes('\\')) {
    throw new Error('UNSAFE_WAV_PATH');
  }
  const realRoot = realpathSync(root);
  const physical = resolve(realRoot, filename);
  if (!(physical.startsWith(realRoot + sep))) throw new Error('WAV_OUTSIDE_ASSET_ROOT');
  if (!existsSync(physical) || !statSync(physical).isFile()) throw new Error('WAV_FILE_MISSING');
  const realFile = realpathSync(physical);
  if (!realFile.startsWith(realRoot + sep)) throw new Error('WAV_SYMLINK_ESCAPES_ASSET_ROOT');
  return realFile;
}

export function readWaveHeader(path) {
  const file = openSync(path, 'r');
  try {
    const size = statSync(path).size;
    if (size < 44) throw new Error('WAV_TOO_SHORT');
    const head = Buffer.alloc(12);
    if (readSync(file, head, 0, 12, 0) !== 12 ||
        head.toString('ascii', 0, 4) !== 'RIFF' ||
        head.toString('ascii', 8, 12) !== 'WAVE')
      throw new Error('NOT_RIFF_WAVE');
    const declared = head.readUInt32LE(4) + 8;
    if (declared > size || declared < 44) throw new Error('WAV_RIFF_SIZE_INVALID');
    let position = 12, fmt = null, dataBytes = null;
    while (position + 8 <= declared) {
      const chunk = Buffer.alloc(8);
      if (readSync(file, chunk, 0, 8, position) !== 8) throw new Error('WAV_CHUNK_TRUNCATED');
      const kind = chunk.toString('ascii', 0, 4), bytes = chunk.readUInt32LE(4);
      const start = position + 8;
      if (start + bytes > declared) throw new Error('WAV_CHUNK_TRUNCATED');
      if (kind === 'fmt ') {
        if (bytes < 16 || bytes > 4096) throw new Error('WAV_FMT_INVALID');
        const body = Buffer.alloc(bytes);
        readSync(file, body, 0, bytes, start);
        let format = body.readUInt16LE(0);
        if (format === 0xfffe) { // WAVE_FORMAT_EXTENSIBLE: first 2 bytes of GUID = real format
          if (bytes < 40) throw new Error('WAV_EXTENSIBLE_FMT_INVALID');
          format = body.readUInt16LE(24);
        }
        fmt = { format, channels: body.readUInt16LE(2),
          sampleRate: body.readUInt32LE(4), byteRate: body.readUInt32LE(8),
          blockAlign: body.readUInt16LE(12), bitDepth: body.readUInt16LE(14) };
      }
      if (kind === 'data') dataBytes = bytes;
      position = start + bytes + (bytes % 2);
    }
    if (!fmt || dataBytes === null) throw new Error('WAV_MISSING_FMT_OR_DATA');
    if (![1, 3].includes(fmt.format)) throw new Error('WAV_UNSUPPORTED_CODEC');
    if (![1, 2].includes(fmt.channels) || ![16, 24, 32].includes(fmt.bitDepth) ||
        (fmt.format === 3 && fmt.bitDepth !== 32) || fmt.sampleRate < 8000 ||
        fmt.sampleRate > 192000 || fmt.blockAlign !== fmt.channels * fmt.bitDepth / 8 ||
        fmt.byteRate !== fmt.sampleRate * fmt.blockAlign || dataBytes % fmt.blockAlign !== 0)
      throw new Error('WAV_FMT_INCONSISTENT');
    const frames = dataBytes / fmt.blockAlign;
    return { ...fmt, frames, seconds: frames / fmt.sampleRate };
  } finally {
    closeSync(file);
  }
}

export function auditStageAudio(projection, assetRoot, maxDriftSeconds = 0.05) {
  if (!projection || projection.version !== 'static-live.stage-projection/v0.1' ||
      !Array.isArray(projection.enabledStems) ||
      !projection.cues || typeof projection.cues !== 'object') {
    throw new Error('INVALID_STAGE_PROJECTION');
  }
  const report = {
    schema: 'living-hymnal.stage-audio-preflight/v0.1',
    song: projection.song?.title || 'untitled',
    configuration: projection.configuration?.label || 'unknown',
    ready: projection.playable === true,
    files: [], errors: [], warnings: []
  };
  if (!report.ready) report.errors.push('UNRESOLVED_STAGE_CAPABILITY');
  const roles = projection.enabledStems.map(stem => ({
    role: 'foh-stem', label: stem.id, path: stem.path
  }));
  for (const cue of ['click', 'voice']) {
    if (projection.cues[cue]) roles.push({ role: 'private-' + cue, label: cue, path: projection.cues[cue] });
  }
  if (!roles.length) report.warnings.push('NO_AUDIO_FILES_DECLARED: all-live configuration, nothing to validate');
  const seen = new Set();
  for (const item of roles) {
    try {
      if (seen.has(item.path)) throw new Error('WAV_DUPLICATE_ROUTE');
      seen.add(item.path);
      const wave = readWaveHeader(safePath(assetRoot, item.path));
      report.files.push({ role: item.role, label: item.label, path: item.path,
        channels: wave.channels, sampleRate: wave.sampleRate, bitDepth: wave.bitDepth,
        frames: wave.frames, seconds: wave.seconds });
    } catch (error) {
      report.errors.push(item.role + ':' + item.label + ':' + (error?.message || 'WAV_ERROR'));
    }
  }
  if (report.files.length > 1) {
    const first = report.files[0];
    for (const item of report.files.slice(1)) {
      if (item.sampleRate !== first.sampleRate) report.errors.push('SAMPLE_RATE_MISMATCH:' + item.label);
      if (Math.abs(item.seconds - first.seconds) > maxDriftSeconds)
        report.errors.push('DURATION_DRIFT:' + item.label);
    }
  }
  if (!roles.some(x => x.role === 'private-click')) {
    report.warnings.push('NO_CLICK_DECLARED: confirm the band does not expect a click');
  }
  report.ready = report.ready && report.errors.length === 0;
  return report;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  if (process.argv.length !== 4) {
    console.error('usage: node stage-ready.mjs <stage-projection.json> <wav-asset-root>');
    process.exitCode = 64;
  } else {
    try {
      const projection = JSON.parse(readFileSync(process.argv[2], 'utf8'));
      const report = auditStageAudio(projection, process.argv[3]);
      console.log(JSON.stringify(report, null, 2));
      process.exitCode = report.ready ? 0 : 1;
    } catch (error) {
      console.error('Preflight failed: ' + (error?.message || 'invalid input'));
      process.exitCode = 1;
    }
  }
}
