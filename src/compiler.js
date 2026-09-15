export function compileStageProjection(packet, configuration) {
  const requiredCapabilities = [...packet.requiredCapabilities];
  const requiredSet = new Set(requiredCapabilities);

  const liveContributions = configuration.performers
    .map((performer) => ({
      performerId: performer.id,
      label: performer.label,
      capabilities: performer.capabilities.filter((capability) => requiredSet.has(capability)),
    }))
    .filter((contribution) => contribution.capabilities.length > 0);

  const liveCoverage = new Set(
    liveContributions.flatMap((contribution) => contribution.capabilities),
  );

  const fallbackByCapability = new Map();
  for (const stem of packet.stems) {
    if (stem.kind === 'fallback' && !fallbackByCapability.has(stem.coversCapability)) {
      fallbackByCapability.set(stem.coversCapability, stem);
    }
  }

  const fallbackCoverage = [];
  const unresolvedCapabilities = [];

  for (const capability of requiredCapabilities) {
    if (liveCoverage.has(capability)) continue;

    const fallbackStem = fallbackByCapability.get(capability);
    if (fallbackStem) {
      fallbackCoverage.push({
        capability,
        stemId: fallbackStem.id,
        reason: 'required capability has no live provider',
      });
    } else {
      unresolvedCapabilities.push(capability);
    }
  }

  const activeFallbackIds = new Set(fallbackCoverage.map((coverage) => coverage.stemId));
  const enabledStems = packet.stems.filter(
    (stem) => stem.kind === 'always' || (stem.kind === 'fallback' && activeFallbackIds.has(stem.id)),
  );
  const disabledFallbackStems = packet.stems.filter(
    (stem) => stem.kind === 'fallback' && !activeFallbackIds.has(stem.id),
  );

  const midiControls = (packet.midiControls ?? []).flatMap((control) => {
    const providers = liveContributions
      .filter((contribution) => contribution.capabilities.includes(control.capability))
      .map(({ performerId, label }) => ({ performerId, label }));

    if (providers.length === 0) return [];

    return [{
      id: control.id,
      capability: control.capability,
      deviceHint: control.deviceHint,
      providers,
      bindings: control.bindings,
    }];
  });

  return {
    version: 'static-live.stage-projection/v0.1',
    song: packet.song,
    tempo: packet.tempo,
    landmarks: [...packet.landmarks],
    cues: packet.cues,
    configuration: {
      id: configuration.id,
      label: configuration.label,
    },
    playable: unresolvedCapabilities.length === 0,
    liveContributions,
    enabledStems,
    disabledFallbackStems,
    fallbackCoverage,
    unresolvedCapabilities,
    midiControls,
  };
}
