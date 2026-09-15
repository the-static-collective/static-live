function bulletList(items, emptyText) {
  if (items.length === 0) return `- ${emptyText}`;
  return items.map((item) => `- ${item}`).join('\n');
}

export function renderSetlist(projection) {
  const live = projection.liveContributions.map(
    (entry) => `${entry.label} — ${entry.capabilities.join(', ')}`,
  );
  const fallback = projection.fallbackCoverage.map(
    (entry) => `${entry.capability} — ${entry.stemId}`,
  );
  const landmarks = projection.landmarks.map((landmark, index) => `${index + 1}. ${landmark}`);

  return `# ${projection.song.title} — ${projection.configuration.label}\n\n` +
    `**Tempo:** ${projection.tempo.bpm} BPM · ${projection.tempo.meter}\n\n` +
    `**Playable:** ${projection.playable ? 'YES' : 'NO'}\n\n` +
    `## Live lanes\n\n${bulletList(live, 'none')}\n\n` +
    `## Fallback lanes\n\n${bulletList(fallback, 'none')}\n\n` +
    `## Landmarks\n\n${landmarks.join('\n')}\n`;
}

export function renderRouting(projection) {
  const rows = [];

  for (const contribution of projection.liveContributions) {
    for (const capability of contribution.capabilities) {
      rows.push(`| LIVE | ${contribution.label} | ${capability} | stage input |`);
    }
  }

  for (const stem of projection.enabledStems) {
    const capability = stem.kind === 'fallback' ? stem.coversCapability : 'always';
    rows.push(`| STEM | ${stem.id} | ${capability} | ${stem.output} |`);
  }

  const unresolved = projection.unresolvedCapabilities.length === 0
    ? '- none'
    : projection.unresolvedCapabilities.map((capability) => `- ${capability}`).join('\n');

  return `# Routing — ${projection.song.title} / ${projection.configuration.label}\n\n` +
    `| Lane | Source | Function | Output |\n` +
    `| --- | --- | --- | --- |\n` +
    `${rows.join('\n')}\n\n` +
    `## Cues\n\n` +
    `- click: ${projection.cues.click}\n` +
    `- voice: ${projection.cues.voice}\n\n` +
    `## Unresolved required capabilities\n\n${unresolved}\n`;
}

function describeMidiInput(input) {
  if (input.type === 'note') return `note ${input.note} ch ${input.channel}`;
  if (input.type === 'cc') return `cc ${input.controller} ch ${input.channel}`;
  return `${input.type} ch ${input.channel}`;
}

export function renderControls(projection) {
  const sections = (projection.midiControls ?? []).map((control) => {
    const providers = control.providers.map((provider) => provider.label).join(', ');
    const bindings = control.bindings.map(
      (binding) => `- ${describeMidiInput(binding.input)} → ${binding.action}`,
    ).join('\n');

    return `## ${control.id}\n\n` +
      `- device hint: ${control.deviceHint}\n` +
      `- capability: ${control.capability}\n` +
      `- provider: ${providers}\n\n` +
      `${bindings}`;
  });

  const body = sections.length === 0 ? '- none' : sections.join('\n\n');
  return `# Controls — ${projection.song.title} / ${projection.configuration.label}\n\n${body}\n`;
}
