const tenant = location.pathname.split('/')[2] || 'sample-church';
const api = '/api/' + encodeURIComponent(tenant);
const $ = selector => document.querySelector(selector);
const node = (tag, className, value) => {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (value !== undefined) el.textContent = value;
  return el;
};
async function request(path, options = {}) {
  const response = await fetch(api + '/' + path, { ...options,
    headers: { ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...options.headers } });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Request failed');
  return data;
}
const credential = () => ({ Authorization: 'Bearer ' + $('#admin-token').value });
function openTab(which) {
  for (const id of ['plant', 'listen', 'team']) {
    $('#panel-' + id).hidden = id !== which;
    $('#tab-' + id).classList.toggle('active', id === which);
    $('#tab-' + id).setAttribute('aria-selected', String(id === which));
  }
  if (which === 'listen') loadSongs();
}
for (const id of ['plant', 'listen', 'team']) $('#tab-' + id).addEventListener('click', () => openTab(id));
(async () => {
  try {
    const c = await request('config');
    $('#church-label').textContent = c.name + ' • ' + (c.submissionsOpen ? 'Local prototype' : 'Read-only demonstration');
    $('#seed-form').querySelector('button[type="submit"]').disabled = !c.submissionsOpen;
    if (!c.submissionsOpen) $('#seed-status').textContent = 'Submission intake is disabled until an approved trial is configured.';
  } catch (error) {
    $('#church-label').textContent = error.message;
  }
})();
$('#seed-form').addEventListener('submit', async e => {
  e.preventDefault();
  const form = e.currentTarget;
  const fields = new FormData(form);
  $('#seed-status').textContent = 'Checking submission…';
  try {
    const payload = Object.fromEntries(fields.entries());
    payload.permissionToReview = fields.has('permissionToReview');
    payload.authorizedSubmitter = fields.has('authorizedSubmitter');
    const result = await request('seeds', { method: 'POST', body: JSON.stringify(payload) });
    form.reset();
    $('#seed-status').textContent = 'Received privately. Reference: ' + result.id + '. It has not been published.';
  } catch (error) { $('#seed-status').textContent = error.message; }
});
async function loadSongs() {
  const host = $('#songs'); host.replaceChildren(node('p', 'muted', 'Loading approved songs…'));
  try {
    const data = await request('songs');
    host.replaceChildren();
    if (!data.songs.length) {
      host.append(node('div', 'empty', 'No published songs yet. Every hymnal begins with a first seed.'));
      return;
    }
    for (const song of data.songs) {
      const card = node('article', 'song');
      card.append(node('div', 'kicker', song.scriptureRef || 'ORIGINAL WORSHIP'),
        node('h3', '', song.title), node('p', 'small', song.bpm + ' BPM · ' + song.meter));
      const lyrics = node('pre', 'lyrics', song.lyrics);
      card.append(lyrics); host.append(card);
    }
  } catch (error) { host.replaceChildren(node('p', 'error', error.message)); }
}
async function loadReview() {
  const host = $('#review-list'); host.replaceChildren(node('p', 'muted', 'Loading private review queue…'));
  try {
    const data = await request('admin/seeds', { headers: credential() });
    host.replaceChildren();
    if (!data.seeds.length) host.append(node('p', 'empty', 'No submitted seeds.'));
    for (const seed of data.seeds) {
      const card = node('article', 'seed');
      card.append(node('div', 'kicker', seed.status + ' · ' + seed.kind),
        node('p', 'seed-text', seed.body),
        node('p', 'small', [seed.scriptureRef, seed.contributorAlias].filter(Boolean).join(' · ')),
        node('code', 'seed-id', seed.id));
      if (seed.status === 'HOLD') {
        const buttons = node('div', 'review-actions');
        for (const decision of ['ADMIT', 'REFUSE']) {
          const btn = node('button', decision === 'ADMIT' ? 'secondary' : 'quiet', decision === 'ADMIT' ? 'Admit for composition' : 'Refuse');
          btn.type = 'button';
          btn.addEventListener('click', async () => {
            btn.disabled = true;
            try {
              await request('admin/decision', { method: 'POST', headers: credential(),
                body: JSON.stringify({ seedId: seed.id, decision }) });
              await loadReview();
            } catch (error) { alert(error.message); btn.disabled = false; }
          });
          buttons.append(btn);
        }
        card.append(buttons);
      }
      if (seed.status === 'ADMIT' && !seed.releasePermission) {
        const permission = node('form', 'permission-form');
        const note = node('p', 'fineprint',
          'Record the reference to an independently obtained contributor permission. The original submission authorizes private review only.');
        const reference = node('input');
        reference.required = true; reference.minLength = 8; reference.maxLength = 300;
        reference.placeholder = 'Consent form or signed release record reference';
        const scope = node('select');
        for (const [value, label] of [
          ['PUBLIC_LYRICS', 'Public in this church only'],
          ['PUBLIC_LYRICS_AND_INTERCHURCH', 'Also share lyrics with other churches']]) {
          const option = node('option', '', label); option.value = value; scope.append(option);
        }
        const button = node('button', 'secondary', 'Record contributor permission');
        button.type = 'submit';
        permission.append(note, reference, scope, button);
        permission.addEventListener('submit', async event => {
          event.preventDefault(); button.disabled = true;
          try {
            await request('admin/permission', { method: 'POST', headers: credential(),
              body: JSON.stringify({ seedId: seed.id, scope: scope.value, recordRef: reference.value }) });
            await loadReview();
          } catch (error) { alert(error.message); button.disabled = false; }
        });
        card.append(permission);
      }
      if (seed.releasePermission) card.append(node('p', 'small',
        'Permission recorded: ' + seed.releasePermission.scope +
        ' · ' + seed.releasePermission.recordRef));
      host.append(card);
    }
    const exports = $('#stage-exports');
    exports.replaceChildren(node('h3', '', 'Approved stage packets & reLATTE candidate specs'));
    for (const song of data.songs) {
      const row = node('div', 'export-row');
      row.append(node('span', '', song.title));
      for (const [type, label] of [['stage', 'Stage packet'], ['bundle', 'Portable lyric bundle']]) {
        const b = node('button', 'secondary', label);
        b.type = 'button'; b.addEventListener('click', async () => {
          try {
            const payload = await request('admin/' + type + '/' + song.id, { headers: credential() });
            const blob = new Blob([JSON.stringify(payload, null, 2) + '\n'], { type: 'application/json' });
            const href = URL.createObjectURL(blob), a = document.createElement('a');
            a.href = href; a.download = song.id + '-' + type + '.json'; a.click();
            setTimeout(() => URL.revokeObjectURL(href), 1000);
          } catch (error) { alert(error.message); }
        });
        row.append(b);
      }
      exports.append(row);
    }
  } catch (error) { host.replaceChildren(node('p', 'error', error.message)); }
}
$('#load-seeds').addEventListener('click', loadReview);
$('#publish-form').addEventListener('submit', async e => {
  e.preventDefault();
  const f = new FormData(e.currentTarget);
  const status = $('#publish-status');
  status.textContent = 'Validating human release…';
  try {
    const payload = Object.fromEntries(f.entries());
    payload.sourceSeedIds = payload.sourceSeedIds.split(',').map(x => x.trim()).filter(Boolean);
    payload.requiredCapabilities = payload.requiredCapabilities.split(',').map(x => x.trim()).filter(Boolean);
    payload.stems = payload.stems.trim() ? JSON.parse(payload.stems) : [];
    payload.cues = payload.cues.trim() ? JSON.parse(payload.cues) : {};
    payload.bpm = Number(payload.bpm);
    payload.rightsCleared = f.has('rightsCleared');
    payload.pastoralApproved = f.has('pastoralApproved');
    payload.interchurchSharingApproved = f.has('interchurchSharingApproved');
    const result = await request('admin/publish', { method: 'POST', headers: credential(),
      body: JSON.stringify(payload) });
    status.textContent = 'Published locally: ' + result.songId;
    await loadReview();
  } catch (error) { status.textContent = error.message; }
});
