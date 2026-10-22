// Bevy owns the same home menu on every platform. The renderer decides when
// that menu is ready to replace this browser-only download/loading cover.
export function createStartup({ canvas, loading, status, errorText, retry, progressBar, progressFill, progressText, progressLabel }, onStage = () => {}) {
  let failed = false;
  let ready = false;
  let progress = 0;
  let lastState;
  function setStage(state) {
    canvas.dataset.startupState = state;
    loading.dataset.state = state;
    if (state !== lastState) {
      lastState = state;
      onStage(state);
    }
  }
  function setProgress(value, complete = false) {
    // These are completed startup milestones, not elapsed time or estimated
    // download bytes. Only the renderer's readiness signal may reach 100%.
    if (typeof value !== 'number' || !Number.isFinite(value)) return;
    progress = Math.max(progress, Math.min(complete ? 1 : 0.99, Math.max(0, value)));
    // Rust sends f32 values; allow its rounding error at whole-percent edges.
    const percentage = Math.floor(progress * 100 + 1e-5);
    progressFill.style.width = `${percentage}%`;
    progressText.textContent = `${percentage}%`;
    progressBar.setAttribute('aria-valuenow', String(percentage));
  }
  setProgress(0);
  function fail(error) {
    // winit uses this exception to hand control back to the browser event loop.
    const message = String(error?.message ?? error);
    if (failed || message.includes('Using exceptions for control flow')) return;
    failed = true;
    setStage('error');
    loading.hidden = false;
    status.textContent = 'The arena could not start.';
    if (progressLabel) progressLabel.textContent = 'PREPARATION PAUSED';
    errorText.textContent = message;
    errorText.hidden = false;
    retry.hidden = false;
    retry.focus();
  }
  function update(state, value) {
    if (failed || ready) return;
    if (state === 'error') {
      fail('The arena assets or graphics could not load. Please try again.');
      return;
    }
    if (!['assets', 'warming', 'ready'].includes(state)) return;
    setStage(state);
    if (state === 'ready') {
      ready = true;
      setProgress(1, true);
      loading.hidden = true;
      canvas.focus();
    } else {
      setProgress(value);
      loading.hidden = false;
      status.textContent = state === 'assets' ? 'Preparing the knights…' : 'Preparing the arena lighting…';
    }
  }
  return {
    fail,
    update,
    compiled() {
      if (failed || ready) return;
      setProgress(0.1);
      status.textContent = 'Preparing the arena…';
    },
    begin() {
      if (failed || ready) return;
      update('assets');
      // Keep the window active while the covered canvas renders its warmup.
      canvas.focus();
    },
  };
}

// cpal creates its WebAudio context inside WASM. Automatic startup can suspend
// that context until a browser gesture; resume it from the real menu interaction
// without adding a second, browser-only play button.
export function installAudioUnlock(scope) {
  if (!scope.AudioContext) return;
  const contexts = new Set();
  scope.AudioContext = new Proxy(scope.AudioContext, {
    construct(Constructor, args, NewTarget) {
      const context = Reflect.construct(Constructor, args, NewTarget);
      contexts.add(context);
      return context;
    },
  });
  const unlock = () => {
    for (const context of contexts) {
      if (context.state === 'closed') {
        contexts.delete(context);
      } else if (context.state !== 'running') {
        // A rejected resume must not interrupt the menu. Retry at the next
        // interaction, including after the browser suspends background audio.
        try { context.resume().catch(() => {}); } catch {}
      }
    }
  };
  scope.addEventListener('pointerdown', unlock, { capture: true });
  scope.addEventListener('keydown', unlock, { capture: true });
}
