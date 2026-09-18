function clone(value) {
  return structuredClone(value);
}

export function createBroadcastController({ plan, obs } = {}) {
  if (!plan) throw new TypeError('broadcast plan is required');
  if (!obs || typeof obs.request !== 'function') throw new TypeError('OBS adapter is required');

  const status = {
    state: 'boot',
    recording: false,
    stream: false,
    currentScene: null,
    fault: null,
  };
  const started = { recording: false, stream: false };
  const sceneChanges = [];
  const faults = [];

  function getStatus() {
    return clone(status);
  }

  function setFault(error, state = 'faulted') {
    const message = error instanceof Error ? error.message : String(error);
    status.state = state;
    status.fault = message;
    faults.push(message);
  }

  async function preflight() {
    status.state = 'preflight';
    status.fault = null;
    try {
      const collection = await obs.request('GetSceneCollectionList');
      if (collection.currentSceneCollectionName !== plan.obs.sceneCollection) {
        throw new Error(`OBS scene collection mismatch: expected ${plan.obs.sceneCollection}, got ${collection.currentSceneCollectionName ?? 'unknown'}`);
      }

      const sceneList = await obs.request('GetSceneList');
      const available = new Set((sceneList.scenes || []).map((scene) => scene.sceneName));
      const required = [
        plan.obs.standbyScene,
        plan.obs.fallbackScene,
        ...Object.values(plan.scenes).map((scene) => scene.obsSceneName),
      ];
      const missing = required.filter((sceneName) => !available.has(sceneName));
      if (missing.length) throw new Error(`OBS is missing declared scenes: ${missing.join(', ')}`);

      const recordStatus = await obs.request('GetRecordStatus');
      const streamStatus = await obs.request('GetStreamStatus');
      if (recordStatus.outputActive || streamStatus.outputActive) {
        throw new Error('OBS already has active recording or streaming output');
      }

      status.recording = false;
      status.stream = false;
      status.currentScene = sceneList.currentProgramSceneName ?? null;
      status.state = 'ready';
      return getStatus();
    } catch (error) {
      setFault(error, 'blocked');
      throw error;
    }
  }

  async function goLive() {
    if (status.state !== 'ready') throw new Error(`GO LIVE requires ready state, got ${status.state}`);
    status.fault = null;

    try {
      await obs.request('StartRecord');
      const recording = await obs.request('GetRecordStatus');
      if (recording.outputActive !== true) throw new Error('OBS did not confirm recording active');
      status.recording = true;
      started.recording = true;
      status.state = 'recording';
    } catch (error) {
      setFault(error, 'faulted');
      throw error;
    }

    try {
      await obs.request('SetCurrentProgramScene', { sceneName: plan.obs.standbyScene });
      status.currentScene = plan.obs.standbyScene;

      if (plan.stream.enabled) {
        await obs.request('StartStream');
        const streaming = await obs.request('GetStreamStatus');
        if (streaming.outputActive !== true) throw new Error('OBS did not confirm stream active');
        status.stream = true;
        started.stream = true;
        status.state = 'live';
      } else {
        status.state = 'recording_only';
      }
      return getStatus();
    } catch (error) {
      status.stream = false;
      setFault(error, 'recording_only');
      throw error;
    }
  }

  async function changeScene(sceneId) {
    if (!['recording', 'recording_only', 'live'].includes(status.state)) {
      throw new Error(`scene change requires active recording, got ${status.state}`);
    }
    const scene = plan.scenes[sceneId];
    if (!scene) throw new Error(`undeclared scene id: ${sceneId}`);
    await obs.request('SetCurrentProgramScene', { sceneName: scene.obsSceneName });
    status.currentScene = scene.obsSceneName;
    sceneChanges.push({
      sequence: sceneChanges.length + 1,
      sceneId,
      obsSceneName: scene.obsSceneName,
      result: 'confirmed',
    });
    return getStatus();
  }

  function receipt(disposition, recordingOutputPath = undefined, ended = {}) {
    return {
      version: 'static-live.broadcast-receipt/v0.1',
      eventId: plan.event.id,
      planDigest: plan.planDigest,
      started: clone(started),
      sceneChanges: clone(sceneChanges),
      ended: {
        stream: ended.stream ?? (started.stream ? 'unknown' : 'not-started'),
        recording: ended.recording ?? (started.recording ? 'unknown' : 'not-started'),
      },
      ...(recordingOutputPath ? { recordingOutputPath } : {}),
      disposition,
      faults: [...faults],
    };
  }

  async function endAndPreserve() {
    if (!status.recording && !status.stream) {
      throw new Error(`END + PRESERVE requires active output, got ${status.state}`);
    }
    status.state = 'ending';
    status.fault = null;
    const ended = {};
    let outputPath;

    if (status.stream) {
      try {
        await obs.request('StopStream');
        const streamStatus = await obs.request('GetStreamStatus');
        if (streamStatus.outputActive !== false) throw new Error('OBS did not confirm stream stopped');
        status.stream = false;
        ended.stream = 'confirmed-stopped';
      } catch (error) {
        ended.stream = 'unknown';
        setFault(error, 'faulted');
        return receipt('faulted', undefined, ended);
      }
    } else {
      ended.stream = started.stream ? 'unknown' : 'not-started';
    }

    if (status.recording) {
      try {
        const stopped = await obs.request('StopRecord');
        outputPath = stopped.outputPath;
        const recordStatus = await obs.request('GetRecordStatus');
        if (recordStatus.outputActive !== false) throw new Error('OBS did not confirm recording stopped');
        status.recording = false;
        ended.recording = 'confirmed-stopped';
      } catch (error) {
        ended.recording = 'unknown';
        setFault(error, 'faulted');
        return receipt('faulted', outputPath, ended);
      }
    } else {
      ended.recording = started.recording ? 'unknown' : 'not-started';
    }

    status.state = 'preserved';
    status.fault = null;
    return receipt(started.stream ? 'preserved' : 'recording_only', outputPath, ended);
  }

  return { preflight, goLive, changeScene, endAndPreserve, getStatus };
}
