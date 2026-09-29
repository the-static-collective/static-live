(function (root) {
  'use strict';

  const VERSION = 'kinship-fall-share-room/v0.1';
  const STORAGE_KEY = 'kinship-fall-share-room:v0.1';

  const OFFICIAL_LINKS = [
    { id: 'fall-share', label: 'Fall Share 2026', href: 'https://kinshipradio.org/main/fall-share-2026-landing/', kind: 'station-public', protected: false },
    { id: 'give', label: 'Give to Kinship', href: 'https://kinshipradio.org/main/giving', kind: 'station-owned-action', protected: false },
    { id: 'listen', label: 'Kinship Radio home / listen', href: 'https://kinshipradio.org/main/', kind: 'station-public', protected: false },
    { id: 'events', label: 'Community calendar', href: 'https://kinshipradio.org/main/events/', kind: 'station-public', protected: false },
    { id: 'volunteer', label: 'Volunteers / Ambassadors', href: 'https://kinshipradio.org/main/ambassador-and-volunteer-faqs/', kind: 'station-owned-action', protected: false },
    { id: 'prayer', label: 'Prayer requests — open only', href: 'https://kinshipradio.org/main/prayer-requests/', kind: 'station-owned-sensitive', protected: true },
    { id: 'director', label: 'The Director’s Chair', href: 'https://kinshipradio.org/main/the-directors-chair/', kind: 'station-public', protected: false }
  ];

  const DOORS = [
    { id: 'why-kinship', label: 'Why Kinship?', duration: 60, claimMode: 'interpretation', blocks: ['source', 'story', 'invitation'] },
    { id: 'faith-gift', label: 'Faith Gift invitation', duration: 30, claimMode: 'interpretation', blocks: ['source', 'invitation'] },
    { id: 'match-moment', label: 'Matching moment', duration: 20, claimMode: 'observed', blocks: ['source', 'invitation'] },
    { id: 'listener-story', label: 'Listener story', duration: 75, claimMode: 'observed', blocks: ['source', 'story', 'return'] },
    { id: 'community-door', label: 'Community door', duration: 30, claimMode: 'observed', blocks: ['source', 'question', 'invitation'] },
    { id: 'volunteer-door', label: 'Volunteer door', duration: 30, claimMode: 'derived', blocks: ['source', 'invitation', 'return'] },
    { id: 'scripture', label: 'Scripture address', duration: 20, claimMode: 'observed', blocks: ['scripture', 'story'] },
    { id: 'what-day', label: 'What Day Is It?', duration: 45, claimMode: 'observed', blocks: ['source', 'story', 'question'] },
    { id: 'thank-you', label: 'Thank-you / return', duration: 30, claimMode: 'observed', blocks: ['source', 'return'] },
    { id: 'one-more', label: 'Just One More Thing', duration: 25, claimMode: 'interpretation', blocks: ['story', 'question'] }
  ];

  const BLOCKS = {
    source: {
      label: 'SOURCE',
      prompt: 'Source-backed fact / exact thing we know:',
      placeholder: 'What happened, where it came from, and what is still uncertain.'
    },
    story: {
      label: 'STORY',
      prompt: 'Human meaning / story:',
      placeholder: 'Why this matters to an actual listener, volunteer, donor, church, or neighbor.'
    },
    scripture: {
      label: 'SCRIPTURE',
      prompt: 'Scripture address:',
      placeholder: 'Book chapter:verse only. Kinship chooses translation and exact on-air wording.'
    },
    question: {
      label: 'QUESTION',
      prompt: 'Listener question:',
      placeholder: 'A genuine question that opens participation without manufacturing an answer.'
    },
    invitation: {
      label: 'INVITATION',
      prompt: 'Door:',
      placeholder: 'Give, volunteer, attend, listen, or use Kinship’s own prayer path.'
    },
    return: {
      label: 'RETURN',
      prompt: 'What came back / became possible:',
      placeholder: 'Thank-you, witnessed result, follow-up, or unresolved next step.'
    }
  };

  const TRANSITIONS = {
    draft: ['ready', 'hold'],
    ready: ['draft', 'hold', 'aired'],
    hold: ['draft', 'ready'],
    aired: ['returned'],
    returned: []
  };

  function uid(prefix = 'item') {
    const suffix = root.crypto && typeof root.crypto.randomUUID === 'function'
      ? root.crypto.randomUUID()
      : Date.now().toString(36) + Math.random().toString(36).slice(2);
    return prefix + ':' + suffix;
  }

  function blankState() {
    return {
      schema: VERSION,
      station: 'Kinship Radio',
      title: 'Fall Share Room',
      createdAt: new Date().toISOString(),
      pulse: { goal: '', raised: '', match: '', note: '' },
      cards: [],
      sources: OFFICIAL_LINKS.map(item => ({ ...item })),
      archive: [],
      settings: { date: '2026-09-29', operator: '' }
    };
  }

  function asMoneyNumber(value) {
    if (value === '' || value == null) return null;
    const parsed = Number(String(value).replace(/[$,\s]/g, ''));
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
  }

  function money(value) {
    const n = asMoneyNumber(value);
    return n == null ? '—' : new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);
  }

  function progress(goal, raised) {
    const g = asMoneyNumber(goal);
    const r = asMoneyNumber(raised);
    if (g == null || r == null || g <= 0) return null;
    return Math.max(0, Math.min(100, (r / g) * 100));
  }

  function composeText(blockIds) {
    const ids = Array.from(new Set(blockIds)).filter(id => BLOCKS[id]);
    return ids.map(id => {
      const block = BLOCKS[id];
      return block.label + '\n' + block.placeholder;
    }).join('\n\n');
  }

  function makeCard({ doorId, blocks, title, copy, sourceIds, claimMode, duration, operator }) {
    const door = DOORS.find(item => item.id === doorId) || DOORS[0];
    const selectedBlocks = blocks && blocks.length ? blocks : door.blocks;
    return {
      id: uid('card'),
      doorId: door.id,
      doorLabel: door.label,
      title: String(title || door.label).trim(),
      copy: String(copy || composeText(selectedBlocks)).trim(),
      blocks: selectedBlocks.slice(),
      sourceIds: Array.from(new Set(sourceIds || [])),
      claimMode: claimMode || door.claimMode,
      duration: Number.isFinite(Number(duration)) ? Math.max(5, Math.min(300, Number(duration))) : door.duration,
      status: 'draft',
      operator: String(operator || '').trim(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      airedAt: null,
      returnNote: ''
    };
  }

  function transition(card, next, options = {}) {
    if (!card || !TRANSITIONS[card.status] || !TRANSITIONS[card.status].includes(next)) {
      throw new Error('transition refused: ' + (card ? card.status : 'missing') + ' -> ' + next);
    }
    const updated = { ...card, status: next, updatedAt: new Date().toISOString() };
    if (next === 'aired') {
      if (options.confirmed !== true) throw new Error('aired requires explicit human confirmation');
      updated.airedAt = new Date().toISOString();
    }
    if (next === 'returned') {
      const note = String(options.returnNote || '').trim();
      if (!note) throw new Error('return requires a note');
      updated.returnNote = note;
    }
    return updated;
  }

  function roomState(cards) {
    const counts = { draft: 0, ready: 0, hold: 0, aired: 0, returned: 0, sourced: 0, unresolved: 0 };
    for (const card of cards || []) {
      if (Object.prototype.hasOwnProperty.call(counts, card.status)) counts[card.status] += 1;
      if (Array.isArray(card.sourceIds) && card.sourceIds.length) counts.sourced += 1;
      else counts.unresolved += 1;
    }
    return counts;
  }

  function buildRundown(cards, sources) {
    const sourceMap = new Map((sources || []).map(source => [source.id, source]));
    return (cards || [])
      .filter(card => ['ready', 'aired', 'returned'].includes(card.status))
      .map(card => ({
        id: card.id,
        title: card.title,
        door: card.doorLabel,
        duration: card.duration,
        status: card.status,
        claimMode: card.claimMode,
        copy: card.copy,
        sources: (card.sourceIds || []).map(id => sourceMap.get(id)).filter(Boolean)
      }));
  }

  function exportState(state) {
    return JSON.stringify({ ...state, exportedAt: new Date().toISOString() }, null, 2);
  }

  const core = {
    VERSION, STORAGE_KEY, OFFICIAL_LINKS, DOORS, BLOCKS, TRANSITIONS,
    blankState, asMoneyNumber, money, progress, composeText, makeCard, transition, roomState, buildRundown, exportState
  };
  root.KinshipRoomCore = core;

  if (typeof document === 'undefined') return;

  let state = load();
  let activeBlocks = ['source', 'story', 'invitation'];

  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return blankState();
      const parsed = JSON.parse(raw);
      if (parsed.schema !== VERSION) return blankState();
      return parsed;
    } catch {
      return blankState();
    }
  }

  function save() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  function q(selector) { return document.querySelector(selector); }
  function qa(selector) { return Array.from(document.querySelectorAll(selector)); }
  function esc(value) {
    return String(value == null ? '' : value)
      .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;').replaceAll("'", '&#039;');
  }

  function render() {
    renderPulse();
    renderDoors();
    renderBlocks();
    renderSources();
    renderCards();
    renderArchive();
    renderState();
    q('#date').value = state.settings.date || '';
    q('#operator').value = state.settings.operator || '';
  }

  function renderPulse() {
    q('#goal').value = state.pulse.goal || '';
    q('#raised').value = state.pulse.raised || '';
    q('#match').value = state.pulse.match || '';
    q('#pulse-note').value = state.pulse.note || '';
    const pct = progress(state.pulse.goal, state.pulse.raised);
    q('#progress-bar').style.width = (pct == null ? 0 : pct) + '%';
    q('#progress-label').textContent = pct == null
      ? 'Enter staff-confirmed goal and raised amount'
      : money(state.pulse.raised) + ' of ' + money(state.pulse.goal) + ' · ' + pct.toFixed(1) + '%';
    q('#match-label').textContent = asMoneyNumber(state.pulse.match) == null ? 'No match entered' : 'Current match: ' + money(state.pulse.match);
  }

  function renderDoors() {
    q('#door-buttons').innerHTML = DOORS.map(door =>
      '<button class="door" data-door="' + esc(door.id) + '"><span>' + esc(door.label) + '</span><small>' + esc(door.duration) + 's · ' + esc(door.claimMode) + '</small></button>'
    ).join('');
  }

  function renderBlocks() {
    q('#lego-blocks').innerHTML = Object.entries(BLOCKS).map(([id, block]) =>
      '<button class="lego ' + (activeBlocks.includes(id) ? 'active' : '') + '" data-block="' + esc(id) + '">' + esc(block.label) + '</button>'
    ).join('');
    q('#block-preview').textContent = composeText(activeBlocks);
  }

  function renderSources() {
    q('#source-list').innerHTML = state.sources.map(source => {
      const protectedBadge = source.protected ? '<span class="badge protected">open only · never ingest</span>' : '';
      return '<article class="source-row">' +
        '<label><input type="checkbox" class="source-check" value="' + esc(source.id) + '"> <strong>' + esc(source.label) + '</strong></label>' +
        '<div class="source-meta"><span class="badge">' + esc(source.kind) + '</span>' + protectedBadge + '</div>' +
        '<a href="' + esc(source.href) + '" target="_blank" rel="noopener">open official source ↗</a>' +
      '</article>';
    }).join('');
  }

  function cardButtons(card) {
    const buttons = [];
    for (const next of TRANSITIONS[card.status] || []) {
      const label = next === 'aired' ? 'Confirm aired' : next === 'returned' ? 'Record return' : next;
      buttons.push('<button data-transition="' + esc(next) + '" data-id="' + esc(card.id) + '">' + esc(label) + '</button>');
    }
    buttons.push('<button class="ghost" data-edit="' + esc(card.id) + '">edit</button>');
    if (card.status !== 'aired' && card.status !== 'returned') buttons.push('<button class="danger ghost" data-delete="' + esc(card.id) + '">delete</button>');
    return buttons.join('');
  }

  function renderCards() {
    const cards = state.cards.slice().sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    q('#on-air-stack').innerHTML = cards.length ? cards.map(card =>
      '<article class="segment status-' + esc(card.status) + '">' +
        '<header><div><span class="eyebrow">' + esc(card.doorLabel) + '</span><h3>' + esc(card.title) + '</h3></div>' +
        '<span class="status">' + esc(card.status) + '</span></header>' +
        '<div class="segment-meta"><span>' + esc(card.duration) + 's</span><span>' + esc(card.claimMode) + '</span><span>' + esc((card.sourceIds || []).length) + ' source(s)</span></div>' +
        '<pre>' + esc(card.copy) + '</pre>' +
        (card.returnNote ? '<div class="return-note"><strong>Return:</strong> ' + esc(card.returnNote) + '</div>' : '') +
        '<footer>' + cardButtons(card) + '</footer>' +
      '</article>'
    ).join('') : '<div class="empty">No cards yet. Pick a door or assemble Lego blocks.</div>';
  }

  function renderArchive() {
    const returned = state.cards.filter(card => card.status === 'returned');
    q('#return-archive').innerHTML = returned.length ? returned.map(card =>
      '<article class="archive-card"><strong>' + esc(card.title) + '</strong><p>' + esc(card.returnNote) + '</p><small>' + esc(card.airedAt || '') + '</small></article>'
    ).join('') : '<div class="empty">Nothing has returned yet. That is allowed.</div>';
  }

  function renderState() {
    const counts = roomState(state.cards);
    q('#room-state').innerHTML = [
      ['draft', counts.draft], ['ready', counts.ready], ['hold', counts.hold],
      ['aired', counts.aired], ['returned', counts.returned], ['source-backed', counts.sourced]
    ].map(([label, value]) => '<div><strong>' + value + '</strong><span>' + label + '</span></div>').join('');
  }

  function selectedSources() {
    return qa('.source-check:checked').map(el => el.value).filter(id => id !== 'prayer');
  }

  function fillComposer(door) {
    activeBlocks = door.blocks.slice();
    q('#segment-door').value = door.id;
    q('#segment-title').value = door.label;
    q('#segment-duration').value = door.duration;
    q('#claim-mode').value = door.claimMode;
    q('#segment-copy').value = composeText(activeBlocks);
    renderBlocks();
    q('#composer').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function addCard() {
    const card = makeCard({
      doorId: q('#segment-door').value,
      blocks: activeBlocks,
      title: q('#segment-title').value,
      copy: q('#segment-copy').value,
      sourceIds: selectedSources(),
      claimMode: q('#claim-mode').value,
      duration: q('#segment-duration').value,
      operator: state.settings.operator
    });
    state.cards.push(card);
    save();
    render();
  }

  function editCard(id) {
    const card = state.cards.find(item => item.id === id);
    if (!card) return;
    activeBlocks = card.blocks || [];
    q('#segment-door').value = card.doorId;
    q('#segment-title').value = card.title;
    q('#segment-duration').value = card.duration;
    q('#claim-mode').value = card.claimMode;
    q('#segment-copy').value = card.copy;
    qa('.source-check').forEach(el => { el.checked = (card.sourceIds || []).includes(el.value); });
    renderBlocks();
    q('#composer').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function moveCard(id, next) {
    const index = state.cards.findIndex(card => card.id === id);
    if (index < 0) return;
    const card = state.cards[index];
    try {
      if (next === 'aired') {
        if (!confirm('Confirm that a human operator knows this segment actually aired. This is not inferred from a playlist or draft.')) return;
        state.cards[index] = transition(card, next, { confirmed: true });
      } else if (next === 'returned') {
        const note = prompt('What came back? Record a concrete follow-up, thank-you, correction, witnessed result, or unresolved next step.');
        if (!note) return;
        state.cards[index] = transition(card, next, { returnNote: note });
      } else {
        state.cards[index] = transition(card, next);
      }
      save(); render();
    } catch (error) {
      alert(error.message);
    }
  }

  function download(name, body, type = 'application/json') {
    const blob = new Blob([body], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = name; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function printRundown() {
    const rundown = buildRundown(state.cards, state.sources);
    if (!rundown.length) {
      alert('Nothing is ready for the rundown yet.');
      return;
    }
    q('#print-rundown').innerHTML = '<h1>Kinship Fall Share · Producer Rundown</h1>' +
      '<p>' + esc(state.settings.date || '') + ' · human-prepared local sheet</p>' +
      rundown.map((item, index) =>
        '<section><h2>' + (index + 1) + '. ' + esc(item.title) + ' <small>' + esc(item.duration) + 's</small></h2>' +
        '<p><strong>' + esc(item.door) + '</strong> · ' + esc(item.claimMode) + ' · ' + esc(item.status) + '</p>' +
        '<pre>' + esc(item.copy) + '</pre>' +
        '<ul>' + item.sources.map(source => '<li>' + esc(source.label) + ': ' + esc(source.href) + '</li>').join('') + '</ul></section>'
      ).join('');
    document.body.classList.add('printing');
    window.print();
    setTimeout(() => document.body.classList.remove('printing'), 500);
  }

  document.addEventListener('click', event => {
    const doorButton = event.target.closest('[data-door]');
    if (doorButton) {
      const door = DOORS.find(item => item.id === doorButton.dataset.door);
      if (door) fillComposer(door);
      return;
    }
    const lego = event.target.closest('[data-block]');
    if (lego) {
      const id = lego.dataset.block;
      activeBlocks = activeBlocks.includes(id) ? activeBlocks.filter(item => item !== id) : [...activeBlocks, id];
      renderBlocks();
      return;
    }
    const transitionButton = event.target.closest('[data-transition]');
    if (transitionButton) {
      moveCard(transitionButton.dataset.id, transitionButton.dataset.transition);
      return;
    }
    const editButton = event.target.closest('[data-edit]');
    if (editButton) {
      editCard(editButton.dataset.edit);
      return;
    }
    const deleteButton = event.target.closest('[data-delete]');
    if (deleteButton && confirm('Delete this local draft card?')) {
      state.cards = state.cards.filter(card => card.id !== deleteButton.dataset.delete);
      save(); render();
    }
  });

  q('#save-pulse').addEventListener('click', () => {
    state.pulse = {
      goal: q('#goal').value.trim(),
      raised: q('#raised').value.trim(),
      match: q('#match').value.trim(),
      note: q('#pulse-note').value.trim()
    };
    save(); renderPulse();
  });

  q('#date').addEventListener('change', event => { state.settings.date = event.target.value; save(); });
  q('#operator').addEventListener('change', event => { state.settings.operator = event.target.value.trim(); save(); });
  q('#assemble').addEventListener('click', () => { q('#segment-copy').value = composeText(activeBlocks); });
  q('#add-card').addEventListener('click', addCard);
  q('#print').addEventListener('click', printRundown);
  q('#export').addEventListener('click', () => download('kinship-fall-share-room.json', exportState(state)));
  q('#import').addEventListener('change', event => {
    const file = event.target.files && event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result);
        if (parsed.schema !== VERSION || !Array.isArray(parsed.cards) || !Array.isArray(parsed.sources)) throw new Error('unsupported room file');
        state = parsed;
        save(); render();
      } catch (error) {
        alert('Import refused: ' + error.message);
      }
      event.target.value = '';
    };
    reader.readAsText(file);
  });
  q('#reset').addEventListener('click', () => {
    if (!confirm('Reset this browser-local room? Export first if you need the current state.')) return;
    state = blankState(); save(); render();
  });

  render();
})(globalThis);
