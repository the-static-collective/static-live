import { readFileSync, openSync, writeFileSync, closeSync } from 'node:fs';
import { liveHashCanonical } from './canonical-json.js';

export const INPUT_SCHEMA = 'static-live.fragment-choir-input/v0.1';
export const OUTPUT_SCHEMA = 'static-live.fragment-choir-score/v0.1';
const KINDS = new Set(['word', 'sound', 'object', 'gesture', 'image-description']);
const ORIGINS = new Set(['witnessed', 'imagined', 'found']);
const DECISIONS = new Set(['admit', 'hold', 'refuse']);
const ACTIONS = new Set(['present', 'loop', 'echo', 'braid', 'fracture']);
const TRANSFORMS = new Set(['loop', 'echo', 'braid', 'fracture']);

function requireThat(condition, message) { if (!condition) throw new TypeError(message); }
const record = x => x !== null && typeof x === 'object' && !Array.isArray(x);
function id(value, name) {
  requireThat(typeof value === 'string' && /^[a-zA-Z0-9._:-]{1,96}$/.test(value), 'invalid ' + name);
  return value;
}
function line(value, name, max = 800) {
  requireThat(typeof value === 'string' && value.trim().length > 0 && value.length <= max, 'invalid ' + name);
  return value.trim();
}
function boolean(value, name) {
  requireThat(typeof value === 'boolean', 'invalid ' + name);
  return value;
}
function unique(values, name) {
  requireThat(new Set(values).size === values.length, 'duplicate ' + name);
}
function normalizeFragment(fragment) {
  requireThat(record(fragment), 'fragment must be an object');
  const fragmentId = id(fragment.id, 'fragment id');
  requireThat(KINDS.has(fragment.kind), 'unsupported fragment kind');
  requireThat(record(fragment.source) && ORIGINS.has(fragment.source.mode), 'invalid fragment source mode');
  requireThat(record(fragment.credit), 'credit declaration required');
  requireThat(['named', 'anonymous'].includes(fragment.credit.mode), 'invalid credit mode');
  const creditName = fragment.credit.mode === 'named'
    ? line(fragment.credit.name, 'credit name', 100)
    : null;
  requireThat(record(fragment.permission), 'explicit fragment permission required');
  const permission = {
    perform: boolean(fragment.permission.perform, 'permission.perform'),
    transform: boolean(fragment.permission.transform, 'permission.transform'),
    preserve: boolean(fragment.permission.preserve, 'permission.preserve'),
  };
  requireThat(record(fragment.review) && DECISIONS.has(fragment.review.decision), 'explicit human review required');
  const review = {
    decision: fragment.review.decision,
    by: id(fragment.review.by, 'reviewer id'),
  };
  return {
    id: fragmentId,
    kind: fragment.kind,
    material: line(fragment.material, 'fragment material', 2000),
    source: { mode: fragment.source.mode, description: line(fragment.source.description, 'source description', 240) },
    credit: { mode: fragment.credit.mode, name: creditName },
    permission,
    review,
  };
}
function normalizeCue(cue) {
  requireThat(record(cue), 'cue must be an object');
  requireThat(ACTIONS.has(cue.action), 'unsupported cue action');
  return {
    id: id(cue.id, 'cue id'),
    fragmentId: id(cue.fragmentId, 'cue fragment id'),
    action: cue.action,
    instruction: line(cue.instruction, 'cue instruction', 240),
  };
}

// A stage-score PROPOSAL, not sound, video, broadcast, consent authentication, or a performance witness.
export function compileFragmentChoir(input) {
  requireThat(record(input) && input.schema === INPUT_SCHEMA, 'unsupported fragment choir schema');
  requireThat(record(input.performance), 'performance declaration required');
  const performance = {
    id: id(input.performance.id, 'performance id'),
    title: line(input.performance.title, 'performance title', 160),
    host: id(input.performance.host, 'host id'),
  };
  requireThat(Array.isArray(input.fragments) && input.fragments.length <= 100, 'fragments must be an array of at most 100');
  requireThat(Array.isArray(input.cues) && input.cues.length <= 200, 'cues must be an array of at most 200');
  const fragments = input.fragments.map(normalizeFragment);
  const cues = input.cues.map(normalizeCue);
  unique(fragments.map(f => f.id), 'fragment id');
  unique(cues.map(c => c.id), 'cue id');
  const byId = new Map(fragments.map(f => [f.id, f]));

  const scoredCues = cues.map(cue => {
    const fragment = byId.get(cue.fragmentId);
    requireThat(fragment, 'cue references missing fragment ' + cue.fragmentId);
    requireThat(fragment.review.decision === 'admit', 'cue references unadmitted fragment ' + cue.fragmentId);
    requireThat(fragment.permission.perform && fragment.permission.preserve, 'cue lacks performance and preservation permission ' + cue.fragmentId);
    if (TRANSFORMS.has(cue.action)) requireThat(fragment.permission.transform, 'cue lacks transform permission ' + cue.fragmentId);
    return {
      ...cue,
      fragment: {
        id: fragment.id,
        kind: fragment.kind,
        material: fragment.material,
        source: fragment.source,
        credit: fragment.credit,
        permission: fragment.permission,
        reviewedBy: fragment.review.by,
      },
    };
  });
  const unsigned = {
    schema: OUTPUT_SCHEMA,
    performance,
    cues: scoredCues,
    heldFragmentIds: fragments.filter(f => f.review.decision === 'hold').map(f => f.id),
    refusedFragmentIds: fragments.filter(f => f.review.decision === 'refuse').map(f => f.id),
    admittedUnusedFragmentIds: fragments.filter(f => f.review.decision === 'admit' && !cues.some(c => c.fragmentId === f.id)).map(f => f.id),
    boundaries: {
      status: 'human-authored-stage-proposal',
      performed: false,
      broadcast: false,
      recorded: false,
      published: false,
      authenticatedContributorConsent: false,
      renderedAudio: false,
      obsControl: false,
      note: 'Operator-declared permissions are not independently authenticated; review them with each contributor before public use.',
    },
  };
  return { ...unsigned, receiptId: liveHashCanonical(unsigned) };
}

export function main(argv = process.argv.slice(2)) {
  requireThat(argv.length === 3 && argv[0] === 'compile', 'usage: node src/pastor-funk-001.js compile INPUT.json NEW_SCORE.json');
  const input = JSON.parse(readFileSync(argv[1], 'utf8'));
  const score = compileFragmentChoir(input);
  const fd = openSync(argv[2], 'wx', 0o600);
  try { writeFileSync(fd, JSON.stringify(score, null, 2) + '\n', 'utf8'); }
  finally { closeSync(fd); }
  console.log(JSON.stringify({ status: score.boundaries.status, receiptId: score.receiptId, cueCount: score.cues.length }));
}
if (process.argv[1] && import.meta.url === new URL('file://' + process.argv[1]).href) {
  try { main(); } catch (error) { console.error('FRAGMENT CHOIR REFUSED:', error.message); process.exitCode = 1; }
}
