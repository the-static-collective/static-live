(function (root) {
  'use strict';

  const VERSION = 'kinship-fall-share-room/v0.1';
  const STORAGE_KEY = 'kinship-fall-share-room:v0.1';
  const MEMORY_POLICY = 'kinship-station-memory-from-toaster/v0.1';
  const RECENT_AIR_WINDOW = 12;
  const PORCH_SCHEMA = 'kinship.porch-item/v0.1';
  const CUSTOMS_SCHEMA = 'kinship.creative-customs/v0.1';
  const HANDOFF_SCHEMA = 'kinship.shift-handoff/v0.1';

  const OFFICIAL_LINKS = [
    { id: 'fall-share', label: 'Fall Share 2026', href: 'https://kinshipradio.org/main/fall-share-2026-landing/', kind: 'station-public', protected: false },
    { id: 'give', label: 'Give to Kinship', href: 'https://kinshipradio.org/main/giving', kind: 'station-owned-action', protected: false },
    { id: 'listen', label: 'Kinship Radio home / listen', href: 'https://kinshipradio.org/main/', kind: 'station-public', protected: false },
    { id: 'events', label: 'Community calendar', href: 'https://kinshipradio.org/main/events/', kind: 'station-public', protected: false },
    { id: 'volunteer', label: 'Volunteers / Ambassadors', href: 'https://kinshipradio.org/main/ambassador-and-volunteer-faqs/', kind: 'station-owned-action', protected: false },
    { id: 'prayer', label: 'Prayer requests — open only', href: 'https://kinshipradio.org/main/prayer-requests/', kind: 'station-owned-sensitive', protected: true },
    { id: 'director', label: 'The Director’s Chair', href: 'https://kinshipradio.org/main/the-directors-chair/', kind: 'station-public', protected: false },
    { id: 'community-appearances', label: 'Kinship community appearances', href: 'https://kinshipradio.org/main/find-kinship-radio-near-you-this-summer/', kind: 'station-public', protected: false },
    { id: 'coffee-day', label: 'National Coffee Association · September 29', href: 'https://www.ncausa.org/Newsroom/Grounds-for-celebration-Americans-remain-committed-to-coffee', kind: 'external-public', protected: false },
    { id: 'goose-day', label: 'Pomeroy Foundation · Goose Day historic marker', href: 'https://www.wgpfoundation.org/historic-markers/goose-day/', kind: 'external-public', protected: false }
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

  function starterCards() {
    const first = makeCard({
      doorId: 'why-kinship',
      title: 'More than radio',
      sourceIds: ['fall-share', 'director', 'give'],
      claimMode: 'interpretation',
      duration: 55,
      operator: 'gift:starter',
      copy: [
        'SOURCE',
        'Kinship’s public 2026 messages describe the ministry as a family, invite listeners to join the support team, and point people to the station’s own giving path.',
        '',
        'STORY',
        'What has Kinship carried into your family, church, commute, hospital room, farm, town, or ordinary Tuesday?',
        '',
        'INVITATION',
        'If this ministry has carried something to you, the official Kinship giving page is the money door.'
      ].join('\\n')
    });
    const second = makeCard({
      doorId: 'community-door',
      title: 'Tonight: KJCY Soup & Sweets',
      sourceIds: ['community-appearances'],
      claimMode: 'observed',
      duration: 25,
      operator: 'gift:starter',
      copy: [
        'SOURCE',
        'Kinship’s public community-appearance schedule lists KJCY Soup & Sweets in Mason City on September 29 from 4:30–7:00 PM at Grace E Free Church. Re-check before air.',
        '',
        'QUESTION',
        'Who are you bringing with you?',
        '',
        'INVITATION',
        'Meet Kinship people face-to-face tonight in Mason City.'
      ].join('\\n')
    });
    const third = makeCard({
      doorId: 'volunteer-door',
      title: 'Support can look like showing up',
      sourceIds: ['director', 'volunteer'],
      claimMode: 'derived',
      duration: 35,
      operator: 'gift:starter',
      copy: [
        'SOURCE',
        'Kinship publicly invites volunteers and ambassadors into a station-owned application, screening, interview and training process.',
        '',
        'INVITATION',
        'If giving money is not your door today, volunteering may be. Use Kinship’s own volunteer path.',
        '',
        'RETURN',
        'Later: remember what new capacity became possible because somebody showed up.'
      ].join('\\n')
    });
    const fourth = makeCard({
      doorId: 'what-day',
      title: 'Coffee Day → Goose Day',
      sourceIds: ['coffee-day', 'goose-day'],
      claimMode: 'observed',
      duration: 45,
      operator: 'gift:starter',
      copy: [
        'SOURCE',
        'September 29 is National Coffee Day. It is also Goose Day in Pennsylvania’s Juniata River Valley, a regional Michaelmas tradition with old rent-and-goose lore.',
        '',
        'STORY',
        'The compressed version is almost absurdly radio-perfect: settle the rent, bring a goose, then eat the goose.',
        '',
        'QUESTION',
        'What strange tradition does your family or town still keep?'
      ].join('\\n')
    });
    second.title = 'Historical example — September 29 Soup & Sweets';
    second.copy = 'HISTORICAL SEPTEMBER 29, 2026 EXAMPLE. Reverify a current event before use.\n\n' + second.copy;
    fourth.title = 'Historical example — Coffee Day → Goose Day';
    return [first, second, third, fourth];
  }


  // KINSHIP-007: consent and editorial use belong to people, not a donor ledger.
  const LIVING_GIFT_SCHEMA = 'kinship.living-gift/v0.1';
  const GIFT_KINDS = ['statement', 'photo', 'audio', 'video'];
  const GIFT_USES = ['quote', 'broadcast', 'gallery', 'archive'];
  const GIFT_MIMES = {
    photo: ['image/jpeg', 'image/png', 'image/webp'],
    audio: ['audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/mp4', 'audio/webm'],
    video: ['video/mp4', 'video/webm']
  };
  const MAX_GIFT_FILE = 50 * 1024 * 1024;

  function giftText(value, maximum, field, required = false) {
    if (typeof value !== 'string') throw new Error(field + ' must be text');
    const result = value.trim();
    if (result.length > maximum || (required && !result)) throw new Error(field + ' is missing or too long');
    return result;
  }
  function makeLivingGift({ title, kind, attribution = '', note = '', rightsRef = '', permissions = [] }) {
    if (!GIFT_KINDS.includes(kind)) throw new Error('Unsupported Living Gift form');
    if (!Array.isArray(permissions) || permissions.some(p => !GIFT_USES.includes(p))) throw new Error('Unknown proposed use');
    const cleanNote = giftText(note, 2000, 'statement / caption', kind === 'statement');
    return {
      schema: LIVING_GIFT_SCHEMA, id: uid('gift'), createdAt: new Date().toISOString(),
      title: giftText(title, 120, 'title', true), kind,
      attribution: giftText(attribution, 80, 'public credit') || 'Anonymous',
      note: cleanNote, rightsRef: giftText(rightsRef, 160, 'permission evidence reference'),
      permissions: [...new Set(permissions)], asset: null, reviews: [], withdrawnAt: null,
      needsRecheck: false, needsReattach: false, trustedReviewCount: 0
    };
  }
  function bindLivingGiftAsset(gift, sha256, mime, size) {
    if (!gift || !GIFT_MIMES[gift.kind]) throw new Error('This form does not use files');
    if (typeof sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(sha256)) throw new Error('Exact SHA-256 required');
    if (!GIFT_MIMES[gift.kind].includes(mime)) throw new Error('Unsupported media type');
    if (!Number.isSafeInteger(size) || size < 1 || size > MAX_GIFT_FILE) throw new Error('File size exceeds local safe limit');
    if (gift.asset && (gift.asset.sha256 !== sha256 || gift.asset.mime !== mime || gift.asset.size !== size))
      throw new Error('Changed bytes require a new Living Gift and new permissions');
    gift.asset = { sha256, mime, size };
    gift.needsReattach = false;
    return gift.asset;
  }
  function reviewLivingGift(gift, use, disposition, operator, releaseCheck = '') {
    if (!gift || gift.schema !== LIVING_GIFT_SCHEMA || gift.withdrawnAt) throw new Error('Living Gift has been withdrawn or is unknown');
    if (!GIFT_USES.includes(use) || !['hold', 'refuse', 'admit'].includes(disposition)) throw new Error('Unknown scope or review decision');
    const reviewer = giftText(operator, 100, 'human reviewer', true);
    const evidence = giftText(releaseCheck, 200, 'release review reference');
    if (disposition === 'admit') {
      if (!gift.permissions.includes(use)) throw new Error('Contributor did not offer this use');
      if (!gift.rightsRef || !evidence) throw new Error('Human check of applicable release is required');
      if (gift.kind !== 'statement' && (!gift.asset || gift.needsReattach)) throw new Error('Exact local media bytes must be attached');
    }
    const receipt = {
      id: uid('gift-review'), createdAt: new Date().toISOString(), use, disposition,
      operator: reviewer, releaseCheck: evidence,
      assetSha256: gift.asset?.sha256 || null,
      publicationAuthority: false
    };
    gift.reviews.push(receipt);
    gift.needsRecheck = false; // imported earlier reviews remain behind the trust boundary
    return receipt;
  }
  function livingGiftUseEligible(gift, use) {
    if (!gift || gift.schema !== LIVING_GIFT_SCHEMA || gift.withdrawnAt || gift.needsRecheck ||
        !GIFT_USES.includes(use) || !Array.isArray(gift.permissions) || !gift.permissions.includes(use)) return false;
    if (gift.kind !== 'statement' && (!gift.asset?.sha256 || gift.needsReattach)) return false;
    const trusted = (gift.reviews || []).slice(gift.trustedReviewCount || 0).filter(r => r.use === use);
    const last = trusted.at(-1);
    return !!(last && last.disposition === 'admit' && last.assetSha256 === (gift.asset?.sha256 || null) &&
      last.publicationAuthority === false);
  }
  function withdrawLivingGift(gift, operator, reason = '') {
    if (!gift || gift.schema !== LIVING_GIFT_SCHEMA || gift.withdrawnAt) throw new Error('Gift already withdrawn or unknown');
    const by = giftText(operator, 100, 'operator', true);
    const note = giftText(reason, 200, 'withdrawal note');
    gift.withdrawnAt = new Date().toISOString();
    gift.reviews.push({ id: uid('gift-review'), createdAt: gift.withdrawnAt, use: 'all',
      disposition: 'withdraw', operator: by, note, publicationAuthority: false });
    return gift;
  }
  function assertLivingGiftShape(gift) {
    const fields = ['schema','id','createdAt','title','kind','attribution','note','rightsRef',
      'permissions','asset','reviews','withdrawnAt','needsRecheck','needsReattach','trustedReviewCount'];
    if (!gift || typeof gift !== 'object' || Array.isArray(gift) ||
        Object.keys(gift).some(k => !fields.includes(k)) || gift.schema !== LIVING_GIFT_SCHEMA ||
        !giftText(gift.id, 100, 'id', true) ||
        !GIFT_KINDS.includes(gift.kind) || !Array.isArray(gift.permissions) ||
        gift.permissions.some(p => !GIFT_USES.includes(p)) || !Array.isArray(gift.reviews) ||
        gift.reviews.length > 100) throw new Error('Malformed or unbounded Living Gift import');
    giftText(gift.title, 120, 'title', true); giftText(gift.attribution, 80, 'credit');
    giftText(gift.note, 2000, 'note'); giftText(gift.rightsRef, 160, 'rights');
    if (gift.asset && (!GIFT_MIMES[gift.kind]?.includes(gift.asset.mime) ||
      !/^[a-f0-9]{64}$/.test(gift.asset.sha256) ||
      !Number.isSafeInteger(gift.asset.size) || gift.asset.size < 1 || gift.asset.size > MAX_GIFT_FILE ||
      Object.keys(gift.asset).some(k => !['sha256','mime','size'].includes(k))))
      throw new Error('Malformed or unsupported Living Gift asset');
    return gift;
  }
  function recheckImportedLivingGifts(value) {
    if (!value || !Array.isArray(value.items) || value.items.length > 100) throw new Error('Invalid Living Gift shelf');
    return { items: value.items.map(original => {
      const gift = structuredClone(assertLivingGiftShape(original));
      gift.needsRecheck = true; // nobody imports an editorial approval
      gift.needsReattach = !!gift.asset; // exact bytes are never in handoffs/exports
      gift.trustedReviewCount = gift.reviews.length; // previous admissions are history, not local grants
      return gift;
    }) };
  }
  function draftFromLivingGift(gift, operator = '') {
    if (!livingGiftUseEligible(gift, 'broadcast')) throw new Error('A current broadcast-specific human review is required');
    const card = makeCard({ doorId: 'listener-story', title: gift.title,
      copy: 'LIVING GIFT · REVIEWABLE DRAFT ONLY\nAttribution: ' + gift.attribution +
        '\nSource: ' + gift.id + '\n' + gift.note +
        '\n\nProducer: verify subject, release, exact media, and current permission before any air.',
      operator });
    card.livingGiftId = gift.id;
    card.livingGiftAssetHash = gift.asset?.sha256 || null;
    return card;
  }
  function enforceLivingGiftUse(card, gifts) {
    if (!card.livingGiftId) return true;
    const gift = gifts?.items?.find(g => g.id === card.livingGiftId);
    if (!livingGiftUseEligible(gift, 'broadcast') ||
        card.livingGiftAssetHash !== (gift.asset?.sha256 || null))
      throw new Error('Living Gift broadcast permission is absent, stale, or withdrawn; hold this card');
    return true;
  }
  function holdUnbroadcastLivingGiftCards(cards, giftId) {
    for (const card of cards) if (card.livingGiftId === giftId && !card.airedAt) {
      card.copy = 'HELD — Living Gift permission withdrawn or requires renewed review. Original draft copy is no longer retained here.';
      card.status = 'hold';
    }
  }

  function blankState() {
    return {
      schema: VERSION,
      station: 'Kinship Radio',
      title: 'Fall Share Room',
      createdAt: new Date().toISOString(),
      pulse: { goal: '', raised: '', match: '', note: '' },
      cards: starterCards(),
      sources: OFFICIAL_LINKS.map(item => ({ ...item })),
      archive: [],
      track: blankTrack(),
      memory: { verdicts: [] },
      porch: { items: [], receipts: [] },
      livingGifts: { items: [] },
      handoffs: { inbox: [], receipts: [] },
      settings: { date: '', operator: '' }
    };
  }

  function safePublicRef(value) {
    const raw = String(value || '').trim();
    if (!raw) return '';
    let parsed;
    try { parsed = new URL(raw); } catch { throw new Error('public reference must be a valid URL'); }
    if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('public reference must use http/https');
    return parsed.href;
  }

  function makePorchItem({ title, origin = '', kind = 'story-lead', publicRef = '', rights = 'unknown', note = '', operator = '' }) {
    const allowedKinds = new Set(['story-lead', 'event', 'public-link', 'voice-letter-ref', 'audio-ref', 'video-ref', 'idea']);
    const allowedRights = new Set(['unknown', 'permission-declared', 'license-ref', 'station-owned-public']);
    const cleanTitle = String(title || '').trim();
    if (!cleanTitle) throw new Error('porch title required');
    if (!allowedKinds.has(kind)) throw new Error('unsupported porch kind');
    if (!allowedRights.has(rights)) throw new Error('unsupported rights posture');
    return {
      schema: PORCH_SCHEMA,
      itemId: uid('porch'),
      createdAt: new Date().toISOString(),
      title: cleanTitle,
      origin: String(origin || '').trim(),
      kind,
      publicRef: safePublicRef(publicRef),
      rights,
      note: String(note || '').trim(),
      operator: String(operator || '').trim()
    };
  }

  function recordCustoms(item, disposition, note = '') {
    if (!item || item.schema !== PORCH_SCHEMA) throw new Error('known porch item required');
    if (!['welcome', 'hold', 'refuse'].includes(disposition)) throw new Error('customs disposition must be welcome, hold, or refuse');
    return {
      schema: CUSTOMS_SCHEMA,
      receiptId: uid('customs'),
      itemId: item.itemId,
      createdAt: new Date().toISOString(),
      disposition,
      note: String(note || '').trim(),
      semanticEffect: 'none'
    };
  }

  function latestCustoms(itemId, receipts = []) {
    return receipts
      .filter(receipt => receipt?.schema === CUSTOMS_SCHEMA && receipt.itemId === itemId)
      .slice()
      .sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)) || String(a.receiptId).localeCompare(String(b.receiptId)))
      .at(-1) || null;
  }

  function admitPorchToWorkshop(item, receipts = [], operator = '') {
    const latest = latestCustoms(item?.itemId, receipts);
    if (!item || item.schema !== PORCH_SCHEMA) throw new Error('known porch item required');
    if (latest?.disposition !== 'welcome') throw new Error('porch item must be welcomed before Workshop admission');
    return makeCard({
      doorId: item.kind === 'event' ? 'community-door' : 'listener-story',
      title: item.title,
      sourceIds: [],
      claimMode: item.publicRef ? 'observed' : 'interpretation',
      operator,
      copy: [
        'PORCH SOURCE',
        item.publicRef || 'No public source attached. Treat this as a human-submitted lead, not established fact.',
        '',
        'MATERIAL',
        item.note || item.title,
        '',
        'RIGHTS POSTURE',
        item.rights + ' — Creative Customs WELCOME did not establish ownership, license, factual truth, or broadcast authority.'
      ].join('\n')
    });
  }

  function makeShiftHandoff(stateValue, fromOperator = '') {
    const snapshot = {
      station: stateValue.station,
      title: stateValue.title,
      pulse: structuredClone(stateValue.pulse),
      cards: structuredClone(stateValue.cards),
      sources: structuredClone(stateValue.sources),
      memory: structuredClone(stateValue.memory || { verdicts: [] }),
      porch: structuredClone(stateValue.porch || { items: [], receipts: [] }),
      livingGifts: structuredClone(stateValue.livingGifts || { items: [] }),
      track: structuredClone(stateValue.track || blankTrack()),
      settings: structuredClone(stateValue.settings)
    };
    return {
      schema: HANDOFF_SCHEMA,
      handoffId: uid('handoff'),
      createdAt: new Date().toISOString(),
      fromOperator: String(fromOperator || '').trim(),
      semanticEffect: 'none',
      snapshot
    };
  }

  function receiveShiftHandoff(value) {
    if (!value || value.schema !== HANDOFF_SCHEMA || !value.handoffId || !value.snapshot) throw new Error('unsupported shift handoff');
    if (!Array.isArray(value.snapshot.cards) || !Array.isArray(value.snapshot.sources)) throw new Error('shift handoff missing bounded room snapshot');
    return {
      schema: 'kinship.shift-receipt/v0.1',
      receiptId: uid('shift-receipt'),
      handoffId: value.handoffId,
      createdAt: new Date().toISOString(),
      disposition: 'received',
      semanticEffect: 'none'
    };
  }

  function adoptShiftHandoff(currentState, handoff, disposition) {
    if (!['admit', 'hold', 'refuse'].includes(disposition)) throw new Error('shift disposition must be admit, hold, or refuse');
    const receipt = {
      schema: 'kinship.shift-receipt/v0.1',
      receiptId: uid('shift-receipt'),
      handoffId: handoff.handoffId,
      createdAt: new Date().toISOString(),
      disposition,
      semanticEffect: disposition === 'admit' ? 'local-room-replaced-by-explicit-human-choice' : 'none'
    };
    if (disposition !== 'admit') return { state: currentState, receipt };

    const next = {
      ...currentState,
      station: handoff.snapshot.station,
      title: handoff.snapshot.title,
      pulse: structuredClone(handoff.snapshot.pulse),
      cards: structuredClone(handoff.snapshot.cards),
      sources: structuredClone(handoff.snapshot.sources),
      memory: structuredClone(handoff.snapshot.memory || { verdicts: [] }),
      porch: structuredClone(handoff.snapshot.porch || { items: [], receipts: [] }),
      livingGifts: recheckImportedLivingGifts(handoff.snapshot.livingGifts || { items: [] }),
      track: structuredClone(handoff.snapshot.track || blankTrack()),
      settings: structuredClone(handoff.snapshot.settings),
      handoffs: structuredClone(currentState.handoffs || { inbox: [], receipts: [] })
    };
    for (const gift of next.livingGifts.items) holdUnbroadcastLivingGiftCards(next.cards, gift.id);
    return { state: next, receipt };
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

  function makeCard({ doorId, blocks, title, copy, sourceIds, claimMode, duration, operator, ancestorId = null }) {
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
      returnNote: '',
      ancestorId: ancestorId || null
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

  function stableUnique(values) {
    return [...new Set((values || []).filter(Boolean).map(String))].sort();
  }

  function stationFeatures(card) {
    return stableUnique([
      card?.doorId ? 'door:' + card.doorId : null,
      card?.claimMode ? 'claim:' + card.claimMode : null,
      ...(card?.blocks || []).map(value => 'block:' + value),
      ...(card?.sourceIds || []).map(value => 'source:' + value)
    ]);
  }

  function memoryVerdictWeight(verdict) {
    if (!verdict) return 0;
    const disposition = verdict.disposition === 'keep' ? 0.5 : verdict.disposition === 'compost' ? -0.5 : 0;
    return disposition + (verdict.wouldReopen ? 0.25 : 0);
  }

  function makeMemoryVerdict(cardId, disposition, wouldReopen = false, now = new Date()) {
    if (!['keep', 'weird', 'compost'].includes(disposition)) throw new Error('memory verdict must be keep, weird, or compost');
    return {
      schema: 'kinship.station-memory-verdict/v0.1',
      verdictId: uid('verdict'),
      cardId: String(cardId),
      createdAt: now.toISOString(),
      disposition,
      wouldReopen: wouldReopen === true
    };
  }

  function buildStationMemory(cards = [], verdicts = []) {
    const aired = cards
      .filter(card => card?.airedAt)
      .slice()
      .sort((a, b) => String(a.airedAt).localeCompare(String(b.airedAt)) || String(a.id).localeCompare(String(b.id)));

    const orderedVerdicts = verdicts
      .filter(item => item?.schema === 'kinship.station-memory-verdict/v0.1')
      .slice()
      .sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)) || String(a.verdictId).localeCompare(String(b.verdictId)));

    const latestVerdicts = {};
    for (const verdict of orderedVerdicts) latestVerdicts[verdict.cardId] = verdict;

    const featureCounts = {};
    const recentFeatureCounts = {};
    const increment = (target, key, amount = 1) => { target[key] = (target[key] || 0) + amount; };
    for (const card of aired) for (const feature of stationFeatures(card)) increment(featureCounts, feature);
    for (const card of aired.slice(-RECENT_AIR_WINDOW)) for (const feature of stationFeatures(card)) increment(recentFeatureCounts, feature);

    const featureAffection = {};
    for (const card of aired) {
      const weight = memoryVerdictWeight(latestVerdicts[card.id]);
      if (!weight) continue;
      for (const feature of stationFeatures(card)) increment(featureAffection, feature, weight);
    }

    const evidenceForDoor = doorId => aired.filter(card => card.doorId === doorId).map(card => 'air:' + card.id);
    const pressures = [];

    const doorCounts = DOORS.map(door => ({ door, count: featureCounts['door:' + door.id] || 0 }));
    if (doorCounts.length) {
      const minimum = Math.min(...doorCounts.map(item => item.count));
      const underexplored = doorCounts.filter(item => item.count === minimum).sort((a, b) => a.door.id.localeCompare(b.door.id))[0];
      if (underexplored) {
        pressures.push({
          kind: 'underexplored',
          targetDoorId: underexplored.door.id,
          label: underexplored.door.label,
          weight: 1 / (1 + underexplored.count),
          evidenceRefs: ['memory:aired-count=' + aired.length, ...evidenceForDoor(underexplored.door.id)],
          explanation: underexplored.count === 0
            ? 'This door has not appeared in the witnessed air history yet.'
            : 'This is among the least-used witnessed doors.'
        });
      }
    }

    const favored = aired
      .map(card => ({ card, verdict: latestVerdicts[card.id], weight: memoryVerdictWeight(latestVerdicts[card.id]) }))
      .filter(item => item.weight > 0)
      .sort((a, b) => b.weight - a.weight || String(b.card.airedAt).localeCompare(String(a.card.airedAt)))[0];
    if (favored) {
      pressures.push({
        kind: 'explicit-return',
        targetCardId: favored.card.id,
        targetDoorId: favored.card.doorId,
        label: favored.card.title,
        weight: favored.weight,
        evidenceRefs: ['air:' + favored.card.id, 'verdict:' + favored.verdict.verdictId],
        explanation: 'A human explicitly marked this witnessed air as worth carrying forward.'
      });
    }

    const recentDoorCounts = DOORS
      .map(door => ({ door, count: recentFeatureCounts['door:' + door.id] || 0 }))
      .filter(item => item.count >= 2)
      .sort((a, b) => b.count - a.count || a.door.id.localeCompare(b.door.id));
    if (recentDoorCounts.length) {
      const saturated = recentDoorCounts[0];
      const alternative = doorCounts.slice().sort((a, b) => a.count - b.count || a.door.id.localeCompare(b.door.id))
        .find(item => item.door.id !== saturated.door.id);
      if (alternative) {
        pressures.push({
          kind: 'saturation',
          targetDoorId: alternative.door.id,
          avoidsDoorId: saturated.door.id,
          label: alternative.door.label,
          weight: saturated.count,
          evidenceRefs: evidenceForDoor(saturated.door.id).slice(-RECENT_AIR_WINDOW),
          explanation: saturated.door.label + ' has repeated in recent witnessed air history; this nudge points elsewhere.'
        });
      }
    }

    return {
      schema: 'kinship.station-memory-projection/v0.1',
      policy: MEMORY_POLICY,
      airedCount: aired.length,
      recentWindow: RECENT_AIR_WINDOW,
      featureCounts: Object.fromEntries(Object.entries(featureCounts).sort(([a], [b]) => a.localeCompare(b))),
      recentFeatureCounts: Object.fromEntries(Object.entries(recentFeatureCounts).sort(([a], [b]) => a.localeCompare(b))),
      featureAffection: Object.fromEntries(Object.entries(featureAffection).sort(([a], [b]) => a.localeCompare(b))),
      latestVerdicts: Object.fromEntries(Object.entries(latestVerdicts).sort(([a], [b]) => a.localeCompare(b))),
      pressures: pressures.slice(0, 3)
    };
  }

  function reopenCard(card, operator = '') {
    if (!card?.airedAt) throw new Error('only witnessed aired cards can be re-opened');
    return makeCard({
      doorId: card.doorId,
      blocks: card.blocks,
      title: 'Return: ' + card.title,
      copy: [
        'ANCESTOR',
        'Explicitly re-opened from witnessed air: ' + card.id + '. Prior wording is history, not current truth.',
        '',
        card.copy
      ].join('\n'),
      sourceIds: card.sourceIds,
      claimMode: card.claimMode,
      duration: card.duration,
      operator,
      ancestorId: card.id
    });
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


  function blankTrack() { return { slots: [], revisions: [], media: [] }; }
  function planSlot(cardId, when, intent) {
    if (!cardId || !String(intent || '').trim()) throw new Error('Choose a card and an intention.');
    return { id: uid('slot'), cardId, when: String(when || ''), intent: String(intent).trim(), createdAt: new Date().toISOString() };
  }
  function trackProjection(track, cards) {
    return track.slots.map(slot => {
      const card = cards.find(c => c.id === slot.cardId);
      return { ...slot, title: card?.title || 'Missing card — hold',
        category: card?.airedAt ? 'receipt' : 'prophecy',
        airedAt: card?.airedAt || null, returnNote: card?.returnNote || '', status: card?.status || 'hold' };
    });
  }
  function reviseFuture(track, cards, evidenceIds, learning, proposal, operator) {
    const ids = stableUnique(evidenceIds);
    if (!ids.length || ids.some(id => !cards.find(c => c.id === id)?.airedAt)) throw new Error('Learning requires witnessed air references.');
    if (![learning, proposal, operator].every(v => String(v || '').trim())) throw new Error('Learning, future proposal and operator are required.');
    return { id: uid('revision'), evidenceIds: ids, learning: String(learning), proposal: String(proposal), operator: String(operator),
      createdAt: new Date().toISOString(), programmingAuthority: false };
  }
  function makeMedia(title, kind, rightsRef) {
    if (!String(title || '').trim() || !['audio', 'video', 'voice-letter'].includes(kind)) throw new Error('Media title and supported kind required.');
    return { id: uid('media'), title: String(title), kind, rightsRef: String(rightsRef || ''), reviews: [], responses: [], broadcast: false };
  }
  function sealResponse(media, listener, response) {
    if (!media.sha256) throw new Error('Attach and identify the exact media bytes before listening.');
    if (!String(listener || '').trim() || !String(response || '').trim()) throw new Error('Listener role and first response required.');
    if (media.responses.length >= 2 || media.responses.some(r => r.listener === listener)) throw new Error('Two different listener roles, one sealed response each.');
    return { listener, response, sha256: media.sha256, createdAt: new Date().toISOString() };
  }
  function reviewMedia(media, disposition, scope, operator) {
    if (!['hold', 'refuse', 'admit'].includes(disposition)) throw new Error('Unsupported review.');
    if (!String(operator || '').trim()) throw new Error('Identify the reviewing operator.');
    if (disposition === 'admit' && !media.sha256) throw new Error('Attach exact local media bytes before admission.');
    if (disposition === 'admit' && (!media.rightsRef.trim() || !String(scope || '').trim())) throw new Error('Admission requires a permission/license reference and permitted use.');
    return { disposition, scope: String(scope || ''), operator, sha256: media.sha256 || null, createdAt: new Date().toISOString(), broadcast: false };
  }
  function bindMediaBytes(media, sha256) {
    if (!/^[a-f0-9]{64}$/.test(sha256)) throw new Error('Expected SHA-256 of local bytes.');
    if (media.sha256 && media.sha256 !== sha256) throw new Error('Different bytes require a new media reference and new first listens.');
    media.sha256 = sha256;
  }

  const core = {
    blankTrack, planSlot, trackProjection, reviseFuture, makeMedia, sealResponse, reviewMedia, bindMediaBytes,
    LIVING_GIFT_SCHEMA, GIFT_KINDS, GIFT_USES, makeLivingGift, bindLivingGiftAsset, reviewLivingGift,
    livingGiftUseEligible, withdrawLivingGift, recheckImportedLivingGifts, draftFromLivingGift,
    enforceLivingGiftUse, holdUnbroadcastLivingGiftCards,
    VERSION, STORAGE_KEY, MEMORY_POLICY, RECENT_AIR_WINDOW, PORCH_SCHEMA, CUSTOMS_SCHEMA, HANDOFF_SCHEMA,
    OFFICIAL_LINKS, DOORS, BLOCKS, TRANSITIONS, blankState, safePublicRef, makePorchItem, recordCustoms, latestCustoms,
    admitPorchToWorkshop, makeShiftHandoff, receiveShiftHandoff, adoptShiftHandoff, asMoneyNumber, money, progress,
    composeText, makeCard, transition, stationFeatures, memoryVerdictWeight, makeMemoryVerdict, buildStationMemory,
    reopenCard, roomState, buildRundown, exportState
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
      if (!parsed.memory || !Array.isArray(parsed.memory.verdicts)) parsed.memory = { verdicts: [] };
      if (!parsed.porch || !Array.isArray(parsed.porch.items) || !Array.isArray(parsed.porch.receipts)) parsed.porch = { items: [], receipts: [] };
      if (!parsed.livingGifts) parsed.livingGifts = { items: [] };
      // Local media never survives the browser process even if its digest remains.
      parsed.livingGifts.items = (parsed.livingGifts.items || []).map(gift => {
        assertLivingGiftShape(gift);
        gift.needsReattach = !!gift.asset;
        return gift;
      });
      if (!parsed.handoffs || !Array.isArray(parsed.handoffs.inbox) || !Array.isArray(parsed.handoffs.receipts)) parsed.handoffs = { inbox: [], receipts: [] };
      for (const card of parsed.cards || []) if (!Object.prototype.hasOwnProperty.call(card, 'ancestorId')) card.ancestorId = null;
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
    state.track = state.track || blankTrack();
    renderTrack();
    renderPulse();
    renderDoors();
    renderBlocks();
    renderSources();
    renderPorch();
    renderLivingGifts();
    renderCards();
    renderMemory();
    renderArchive();
    renderHandoffs();
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
        '<label><input type="checkbox" class="source-check" value="' + esc(source.id) + '"' + (source.protected ? ' disabled' : '') + '> <strong>' + esc(source.label) + '</strong></label>' +
        '<div class="source-meta"><span class="badge">' + esc(source.kind) + '</span>' + protectedBadge + '</div>' +
        '<a href="' + esc(source.href) + '" target="_blank" rel="noopener">open official source ↗</a>' +
      '</article>';
    }).join('');
  }

  function renderPorch() {
    const items = state.porch?.items || [];
    const receipts = state.porch?.receipts || [];
    q('#porch-items').innerHTML = items.length ? items.map(item => {
      const latest = latestCustoms(item.itemId, receipts);
      const status = latest?.disposition || 'arrived';
      return '<article class="porch-item">' +
        '<header><div><span class="eyebrow">' + esc(item.kind) + '</span><h3>' + esc(item.title) + '</h3></div><span class="status">' + esc(status) + '</span></header>' +
        '<p>' + esc(item.note || 'No note.') + '</p>' +
        '<div class="segment-meta"><span>rights: ' + esc(item.rights) + '</span>' + (item.origin ? '<span>origin: ' + esc(item.origin) + '</span>' : '') + '</div>' +
        (item.publicRef ? '<a href="' + esc(item.publicRef) + '" target="_blank" rel="noopener">open public reference ↗</a>' : '') +
        '<footer>' +
          '<button data-customs="welcome" data-id="' + esc(item.itemId) + '">WELCOME</button>' +
          '<button data-customs="hold" data-id="' + esc(item.itemId) + '">HOLD</button>' +
          '<button data-customs="refuse" data-id="' + esc(item.itemId) + '">REFUSE</button>' +
          (status === 'welcome' ? '<button class="primary" data-porch-admit="' + esc(item.itemId) + '">Admit to Workshop</button>' : '') +
        '</footer>' +
      '</article>';
    }).join('') : '<div class="empty">The Porch is empty. Nothing needs to arrive.</div>';
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
        '<div class="segment-meta"><span>' + esc(card.duration) + 's</span><span>' + esc(card.claimMode) + '</span><span>' + esc((card.sourceIds || []).length) + ' source(s)</span>' +
        (card.ancestorId ? '<span>re-opened from ' + esc(card.ancestorId) + '</span>' : '') + '</div>' +
        '<pre>' + esc(card.copy) + '</pre>' +
        (card.returnNote ? '<div class="return-note"><strong>Return:</strong> ' + esc(card.returnNote) + '</div>' : '') +
        '<footer>' + cardButtons(card) + '</footer>' +
      '</article>'
    ).join('') : '<div class="empty">No cards yet. Pick a door or assemble Lego blocks.</div>';
  }

  function renderMemory() {
    const memory = buildStationMemory(state.cards, state.memory?.verdicts || []);
    q('#memory-summary').textContent = memory.airedCount
      ? memory.airedCount + ' witnessed air(s) · memory may nudge attention, never establish meaning'
      : 'No witnessed air history yet. Memory begins only after a human confirms something actually aired.';

    q('#memory-pressures').innerHTML = memory.pressures.length ? memory.pressures.map((pressure, index) =>
      '<article class="memory-pressure">' +
        '<div><span class="eyebrow">' + esc(pressure.kind) + '</span><h3>' + esc(pressure.label) + '</h3></div>' +
        '<p>' + esc(pressure.explanation) + '</p>' +
        '<details><summary>Influence trace</summary><code>' + esc(pressure.evidenceRefs.join(' · ')) + '</code></details>' +
        (pressure.targetCardId
          ? '<button data-reopen="' + esc(pressure.targetCardId) + '">Re-open this witnessed ancestor</button>'
          : '<button data-memory-door="' + esc(pressure.targetDoorId) + '">Open this door in Workshop</button>') +
      '</article>'
    ).join('') : '<div class="empty">No memory pressure yet. An empty memory is an honest state.</div>';

    const aired = state.cards.filter(card => card.airedAt).slice()
      .sort((a, b) => String(b.airedAt).localeCompare(String(a.airedAt)));
    const latest = memory.latestVerdicts;
    q('#past-airs').innerHTML = aired.length ? aired.map(card => {
      const verdict = latest[card.id];
      return '<article class="past-air">' +
        '<div><span class="eyebrow">' + esc(card.doorLabel) + '</span><h3>' + esc(card.title) + '</h3>' +
        '<small>' + esc(card.airedAt) + '</small></div>' +
        '<p>' + (verdict ? 'Latest human verdict: <strong>' + esc(verdict.disposition) + '</strong>' + (verdict.wouldReopen ? ' · would re-open' : '') : 'No human memory verdict yet.') + '</p>' +
        '<div class="memory-actions">' +
          '<button data-memory-verdict="keep" data-id="' + esc(card.id) + '">keep</button>' +
          '<button data-memory-verdict="weird" data-id="' + esc(card.id) + '">weird</button>' +
          '<button data-memory-verdict="compost" data-id="' + esc(card.id) + '">compost</button>' +
          '<button data-reopen="' + esc(card.id) + '">Re-open</button>' +
        '</div>' +
      '</article>';
    }).join('') : '<div class="empty">Past Airs stays empty until an operator explicitly confirms an air event.</div>';
  }

  function renderArchive() {
    const returned = state.cards.filter(card => card.status === 'returned');
    q('#return-archive').innerHTML = returned.length ? returned.map(card =>
      '<article class="archive-card"><strong>' + esc(card.title) + '</strong><p>' + esc(card.returnNote) + '</p><small>' + esc(card.airedAt || '') + '</small></article>'
    ).join('') : '<div class="empty">Nothing has returned yet. That is allowed.</div>';
  }

  function renderHandoffs() {
    const inbox = state.handoffs?.inbox || [];
    q('#handoff-inbox').innerHTML = inbox.length ? inbox.map(handoff =>
      '<article class="handoff-card">' +
        '<div><span class="eyebrow">RECEIVED · semantic effect none</span><h3>' + esc(handoff.fromOperator || 'Unnamed prior operator') + '</h3></div>' +
        '<p>' + esc(handoff.createdAt) + ' · ' + esc(handoff.snapshot.cards.length) + ' card(s)</p>' +
        '<code>' + esc(handoff.handoffId) + '</code>' +
        '<footer>' +
          '<button data-handoff="admit" data-id="' + esc(handoff.handoffId) + '">ADMIT AS WORKING ROOM</button>' +
          '<button data-handoff="hold" data-id="' + esc(handoff.handoffId) + '">HOLD</button>' +
          '<button data-handoff="refuse" data-id="' + esc(handoff.handoffId) + '">REFUSE</button>' +
        '</footer>' +
      '</article>'
    ).join('') : '<div class="empty">No received shift handoff is waiting.</div>';
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
      if (['ready', 'aired'].includes(next)) enforceLivingGiftUse(card, state.livingGifts);
      if (card.mediaId && ['ready', 'aired'].includes(next)) {
        const media = state.track?.media.find(m => m.id === card.mediaId);
        if (media?.reviews.at(-1)?.disposition !== 'admit') throw new Error('Media use is currently held or refused. Review it before preparing or airing this card.');
      }
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
    const plannedIds = stableUnique((state.track?.slots || []).map(slot => slot.cardId));
    const orderedCards = plannedIds.length
      ? plannedIds.map(id => state.cards.find(card => card.id === id)).filter(Boolean)
      : state.cards;
    const rundown = buildRundown(orderedCards, state.sources);
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
    const memoryDoor = event.target.closest('[data-memory-door]');
    if (memoryDoor) {
      const door = DOORS.find(item => item.id === memoryDoor.dataset.memoryDoor);
      if (door) fillComposer(door);
      return;
    }
    const memoryVerdict = event.target.closest('[data-memory-verdict]');
    if (memoryVerdict) {
      const card = state.cards.find(item => item.id === memoryVerdict.dataset.id);
      if (!card?.airedAt) return alert('Memory verdicts attach only to witnessed air.');
      const wouldReopen = confirm('Also mark this witnessed air as something you would intentionally re-open later?');
      state.memory = state.memory || { verdicts: [] };
      state.memory.verdicts.push(makeMemoryVerdict(card.id, memoryVerdict.dataset.memoryVerdict, wouldReopen));
      save(); renderMemory();
      return;
    }
    const reopenButton = event.target.closest('[data-reopen]');
    if (reopenButton) {
      const card = state.cards.find(item => item.id === reopenButton.dataset.reopen);
      try {
        const fresh = reopenCard(card, state.settings.operator);
        state.cards.push(fresh);
        save(); render();
        editCard(fresh.id);
      } catch (error) {
        alert(error.message);
      }
      return;
    }

    const customsButton = event.target.closest('[data-customs]');
    if (customsButton) {
      const item = state.porch.items.find(value => value.itemId === customsButton.dataset.id);
      if (!item) return;
      const note = prompt('Optional Creative Customs note:') || '';
      state.porch.receipts.push(recordCustoms(item, customsButton.dataset.customs, note));
      save(); renderPorch();
      return;
    }
    const porchAdmit = event.target.closest('[data-porch-admit]');
    if (porchAdmit) {
      const item = state.porch.items.find(value => value.itemId === porchAdmit.dataset.porchAdmit);
      try {
        const card = admitPorchToWorkshop(item, state.porch.receipts, state.settings.operator);
        if (item.publicRef) {
          let source = state.sources.find(value => value.href === item.publicRef);
          if (!source) {
            source = { id: uid('source'), label: 'Porch: ' + item.title, href: item.publicRef, kind: 'porch-public', protected: false };
            state.sources.push(source);
          }
          card.sourceIds = [source.id];
        }
        state.cards.push(card);
        save(); render();
        editCard(card.id);
      } catch (error) {
        alert(error.message);
      }
      return;
    }
    const handoffButton = event.target.closest('[data-handoff]');
    if (handoffButton) {
      const handoff = state.handoffs.inbox.find(value => value.handoffId === handoffButton.dataset.id);
      if (!handoff) return;
      const disposition = handoffButton.dataset.handoff;
      if (disposition === 'admit' && !confirm('Replace the current working room with this received shift snapshot? Export the current room first if you need it.')) return;
      try {
        const result = adoptShiftHandoff(state, handoff, disposition);
        result.state.handoffs = result.state.handoffs || { inbox: [], receipts: [] };
        result.state.handoffs.receipts.push(result.receipt);
        result.state.handoffs.inbox = result.state.handoffs.inbox.filter(value => value.handoffId !== handoff.handoffId);
        state = result.state;
        save(); render();
      } catch (error) {
        alert(error.message);
      }
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

  q('#add-source').addEventListener('click', () => {
    const label = q('#new-source-label').value.trim();
    const href = q('#new-source-url').value.trim();
    if (!label || !href) return alert('Source label and public URL are required.');
    let parsed;
    try { parsed = new URL(href); } catch { return alert('Use a valid http/https public URL.'); }
    if (!['http:', 'https:'].includes(parsed.protocol)) return alert('Only public http/https sources are admitted here.');
    state.sources.push({ id: uid('source'), label, href: parsed.href, kind: 'operator-added-public', protected: false });
    q('#new-source-label').value = '';
    q('#new-source-url').value = '';
    save(); renderSources();
  });

  q('#porch-add').addEventListener('click', () => {
    try {
      const item = makePorchItem({
        title: q('#porch-title').value,
        origin: q('#porch-origin').value,
        kind: q('#porch-kind').value,
        publicRef: q('#porch-ref').value,
        rights: q('#porch-rights').value,
        note: q('#porch-note').value,
        operator: state.settings.operator
      });
      state.porch.items.push(item);
      for (const id of ['#porch-title','#porch-origin','#porch-ref','#porch-note']) q(id).value = '';
      save(); renderPorch();
    } catch (error) {
      alert(error.message);
    }
  });

  q('#handoff-export').addEventListener('click', () => {
    const handoff = makeShiftHandoff(state, state.settings.operator);
    download('kinship-shift-handoff.json', JSON.stringify(handoff, null, 2));
  });

  q('#handoff-import').addEventListener('change', event => {
    const file = event.target.files && event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const handoff = JSON.parse(reader.result);
        const receipt = receiveShiftHandoff(handoff);
        state.handoffs.inbox.push(handoff);
        state.handoffs.receipts.push(receipt);
        save(); renderHandoffs();
      } catch (error) {
        alert('Shift handoff refused: ' + error.message);
      }
      event.target.value = '';
    };
    reader.readAsText(file);
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
        parsed.livingGifts = recheckImportedLivingGifts(parsed.livingGifts || { items: [] });
        for (const gift of parsed.livingGifts.items) holdUnbroadcastLivingGiftCards(parsed.cards, gift.id);
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



  // The gallery is local editorial preview only, not a public station page.
  const localGiftMedia = new Map();
  function renderLivingGifts() {
    const shelf = state.livingGifts?.items || [];
    q('#gift-items').innerHTML = shelf.length ? shelf.map(gift => {
      const current = gift.reviews.at(-1)?.disposition || 'held';
      const attached = localGiftMedia.get(gift.id);
      const player = !attached ? '<p>Local file absent. Reattach exact bytes to review/use.</p>' :
        gift.kind === 'photo' ? '<img class="gift-media" alt="Locally offered photo" src="' + esc(attached) + '">' :
        '<' + (gift.kind === 'video' ? 'video' : 'audio') + ' class="gift-media" controls preload="none" src="' + esc(attached) + '"></' + (gift.kind === 'video' ? 'video' : 'audio') + '>';
      return '<article class="door-card gift-card"><header><div><span class="eyebrow">' + esc(gift.kind) +
        ' · ' + esc(current) + '</span><h3>' + esc(gift.title) + '</h3></div></header>' +
        '<p>Credit: ' + esc(gift.attribution) + '</p><p>' + esc(gift.note) + '</p>' +
        '<p class="micro">Offered uses: ' + esc(gift.permissions.join(', ') || 'private review only') +
        ' · hash: ' + esc(gift.asset?.sha256 || 'text only / unbound') +
        (gift.needsRecheck ? ' · fresh review required' : '') + '</p>' +
        (gift.kind !== 'statement' ? player : '') +
        '<footer>' + (!gift.withdrawnAt ? (
          (gift.kind !== 'statement' ? '<button data-gift-attach="' + esc(gift.id) + '">Attach exact file</button>' : '') +
          '<button data-gift-review="broadcast" data-id="' + esc(gift.id) + '">Review broadcast</button>' +
          '<button data-gift-review="gallery" data-id="' + esc(gift.id) + '">Review gallery</button>' +
          '<button data-gift-draft="' + esc(gift.id) + '">Workshop draft</button>' +
          '<button class="danger ghost" data-gift-withdraw="' + esc(gift.id) + '">Withdraw / restrict</button>'
        ) : '<strong>WITHDRAWN — no new use</strong>') + '</footer></article>';
    }).join('') : '<p class="empty">No Living Gifts yet. Participation never requires a payment.</p>';
    const visible = shelf.filter(g => livingGiftUseEligible(g, 'gallery'));
    q('#gift-gallery').innerHTML = visible.length ? visible.map(g => {
      const attached = localGiftMedia.get(g.id);
      const media = g.kind === 'photo' && attached ? '<img class="gift-media" alt="Reviewed local photo" src="' + esc(attached) + '">' :
        g.kind === 'video' && attached ? '<video class="gift-media" controls preload="none" src="' + esc(attached) + '"></video>' :
        g.kind === 'audio' && attached ? '<audio class="gift-media" controls preload="none" src="' + esc(attached) + '"></audio>' : '';
      return '<article class="door-card"><h3>' + esc(g.title) + '</h3>' + media +
        '<p>' + esc(g.note) + '</p><small>' + esc(g.attribution) + ' · editorial preview, not public</small></article>';
    }).join('') : '<p class="empty">No gallery-specific admitted material yet. A broadcast permission does not grant web display.</p>';
  }
  q('#gift-add').addEventListener('click', () => {
    try {
      const permissions = qa('#gift-permissions input:checked').map(input => input.value);
      const gift = makeLivingGift({ title: q('#gift-title').value, kind: q('#gift-kind').value,
        attribution: q('#gift-credit').value, note: q('#gift-note').value,
        rightsRef: q('#gift-rights').value, permissions });
      state.livingGifts = state.livingGifts || { items: [] };
      if (state.livingGifts.items.length >= 100) throw new Error('Local shelf full; review and archive separately.');
      state.livingGifts.items.push(gift);
      for (const id of ['#gift-title','#gift-credit','#gift-note','#gift-rights']) q(id).value = '';
      qa('#gift-permissions input:checked').forEach(input => { input.checked = false; });
      save(); renderLivingGifts();
    } catch (e) { alert(e.message); }
  });
  document.addEventListener('click', event => {
    const button = event.target.closest('[data-gift-attach],[data-gift-review],[data-gift-draft],[data-gift-withdraw]');
    if (!button) return;
    const id = button.dataset.giftAttach || button.dataset.giftDraft || button.dataset.giftWithdraw || button.dataset.id;
    const gift = state.livingGifts.items.find(g => g.id === id);
    if (!gift) return;
    try {
      if (button.dataset.giftAttach) {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = GIFT_MIMES[gift.kind].join(',');
        input.onchange = async () => {
          try {
            const file = input.files?.[0]; if (!file) return;
            if (file.size > MAX_GIFT_FILE) throw new Error('File exceeds 50 MB local ceiling');
            const sha256 = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', await file.arrayBuffer())),
              b => b.toString(16).padStart(2, '0')).join('');
            bindLivingGiftAsset(gift, sha256, file.type, file.size);
            if (localGiftMedia.has(gift.id)) URL.revokeObjectURL(localGiftMedia.get(gift.id));
            localGiftMedia.set(gift.id, URL.createObjectURL(file));
            save(); renderLivingGifts();
          } catch (e) { alert(e.message); }
        };
        input.click(); return;
      }
      if (button.dataset.giftReview) {
        const use = button.dataset.giftReview;
        const disposition = prompt('Local editorial review for ' + use + ': hold / refuse / admit', 'hold');
        if (!disposition) return;
        const evidence = disposition === 'admit' ? prompt('Reference for CURRENT, human-verified permission (no personal details):') : '';
        if (disposition === 'admit' && !evidence) return;
        reviewLivingGift(gift, use, disposition, state.settings.operator, evidence || '');
      }
      if (button.dataset.giftDraft) {
        state.cards.push(draftFromLivingGift(gift, state.settings.operator));
      }
      if (button.dataset.giftWithdraw) {
        if (!confirm('Restrict all future use of this Living Gift? Previously aired/public copies need separate manual remediation.')) return;
        withdrawLivingGift(gift, state.settings.operator, 'Owner / operator restriction');
        holdUnbroadcastLivingGiftCards(state.cards, gift.id);
        if (localGiftMedia.has(gift.id)) URL.revokeObjectURL(localGiftMedia.get(gift.id));
        localGiftMedia.delete(gift.id);
      }
      save(); render();
    } catch (e) { alert(e.message); }
  });

  const localMedia = new Map();
  function renderTrack() {
    q('#track-card').innerHTML = state.cards.filter(c => !c.airedAt).map(c => '<option value="'+esc(c.id)+'">'+esc(c.title)+'</option>').join('');
    q('#track-evidence').innerHTML = state.cards.filter(c => c.airedAt).map(c => '<label><input type="checkbox" value="'+esc(c.id)+'">'+esc(c.title)+'</label>').join('') || 'No witnessed airs yet.';
    q('#track-slots').innerHTML = trackProjection(state.track, state.cards).map(s => '<article class="door-card"><span class="eyebrow">'+esc(s.category)+'</span><h3>'+esc(s.when)+' · '+esc(s.title)+'</h3><p>'+esc(s.intent)+'</p><small>'+esc(s.airedAt || 'Planned only; confirm air in Live Stack.')+'</small><p>'+esc(s.returnNote)+'</p></article>').join('') || '<p class="empty">Choose existing drafts to build an ordered campaign track.</p>';
    q('#track-revisions').innerHTML = state.track.revisions.map(r => '<article class="door-card"><h3>Learning → future proposal</h3><p>'+esc(r.learning)+'</p><p><strong>PROPHECY:</strong> '+esc(r.proposal)+'</p><details><summary>Evidence and author</summary>'+esc(r.evidenceIds.join(', '))+' · '+esc(r.operator)+' · '+esc(r.createdAt)+'</details></article>').join('');
    q('#track-media').innerHTML = state.track.media.map(m => {
      const latest = m.reviews.at(-1);
      return '<article class="door-card"><h3>'+esc(m.title)+'</h3><p>'+esc(m.kind)+' · '+esc(latest?.disposition || 'unreviewed')+'</p><p>Permission reference: '+esc(m.rightsRef || 'unknown')+'</p>'+ (localMedia.has(m.id) ? '<'+(m.kind === 'video'?'video':'audio')+' controls preload="metadata" src="'+esc(localMedia.get(m.id))+'" style="max-width:100%"></'+(m.kind === 'video'?'video':'audio')+'>' : '<p>Reattach local bytes after reopening; exports contain metadata only.</p>') +
        '<footer><button data-media-attach="'+esc(m.id)+'">Attach local file</button><button data-media-listen="'+esc(m.id)+'">Seal first response</button><button data-media-review="'+esc(m.id)+'">Review permitted use</button><button data-media-draft="'+esc(m.id)+'">Create Workshop draft</button></footer>'+ (m.responses.length === 2 ? '<details><summary>Both sealed responses</summary>'+m.responses.map(r=>'<p>'+esc(r.listener)+': '+esc(r.response)+'</p>').join('')+'</details>' : '<p>'+m.responses.length+'/2 responses sealed; text hidden until both arrive.</p>') +'</article>';
    }).join('');
  }
  q('#track-add').onclick = () => {
    try { state.track.slots.push(planSlot(q('#track-card').value, q('#track-time').value, q('#track-intent').value)); save(); renderTrack(); }
    catch(e) { alert(e.message); }
  };
  q('#track-revise').onclick = () => {
    try { state.track.revisions.push(reviseFuture(state.track, state.cards, qa('#track-evidence input:checked').map(e=>e.value), q('#track-learning').value, q('#track-proposal').value, state.settings.operator)); save(); renderTrack(); }
    catch(e) { alert(e.message); }
  };
  q('#media-add').onclick = () => {
    try { state.track.media.push(makeMedia(q('#media-title').value, q('#media-kind').value, q('#media-rights').value)); save(); renderTrack(); }
    catch(e) { alert(e.message); }
  };
  document.addEventListener('click', event => {
    const button = event.target.closest('[data-media-attach], [data-media-listen], [data-media-review], [data-media-draft]');
    if (!button) return;
    const id = Object.values(button.dataset)[0];
    const m = state.track.media.find(m=>m.id === id);
    if (!m) return;
    try {
      if (button.dataset.mediaAttach) {
        const input = document.createElement('input'); input.type='file'; input.accept=m.kind==='video'?'video/*':'audio/*';
        input.onchange=async()=>{
          try {
            const file=input.files[0]; if(!file) return;
            const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',await file.arrayBuffer())), b=>b.toString(16).padStart(2,'0')).join('');
            bindMediaBytes(m,hash);
            if(localMedia.has(id)) URL.revokeObjectURL(localMedia.get(id));
            localMedia.set(id, URL.createObjectURL(file)); save(); renderTrack();
          } catch(e) { alert(e.message); }
        }; input.click(); return;
      }
      if (button.dataset.mediaListen) {
        const listener=prompt('Distinct listener role (do not enter private listener details):'); if(!listener) return;
        const response=prompt('Your independent first response. The other response remains hidden until both are sealed.'); if(!response) return;
        m.responses.push(sealResponse(m,listener,response));
      }
      if (button.dataset.mediaReview) {
        const disposition=prompt('Review: hold / refuse / admit', 'hold'); if(!disposition) return;
        const scope=prompt('Permitted use / review note:') || '';
        m.reviews.push(reviewMedia(m,disposition,scope,state.settings.operator));
      }
      if (button.dataset.mediaDraft) {
        const review=m.reviews.at(-1); if(review?.disposition!=='admit') throw new Error('Explicit permitted-use admission required first.');
        const card=makeCard({doorId:'listener-story',title:m.title,copy:'MEDIA REFERENCE: '+m.id+'\nPermission: '+m.rightsRef+'\nPermitted use: '+review.scope+'\nDraft only. Recheck source and permitted use before air.',operator:state.settings.operator});
        card.mediaId=m.id; state.cards.push(card);
      }
      save(); render();
    } catch(e) { alert(e.message); }
  });

  render();
})(globalThis);
