// The renderer, rather than wasm initialization, decides when play can begin.
export function createStartup({ canvas, loading, status, errorText, enter, retry }, onStage = () => {}) {
  let failed = false;
  let ready = false;
  function fail(error) {
    // winit uses this exception to hand control back to the browser event loop.
    const message = String(error?.message ?? error);
    if (message.includes('Using exceptions for control flow')) return;
    failed = true;
    canvas.dataset.startupState = 'error';
    onStage('error');
    loading.hidden = false;
    status.textContent = 'The arena could not start.';
    errorText.textContent = message;
    errorText.hidden = false;
    enter.hidden = true;
    retry.hidden = false;
  }
  function update(state) {
    if (failed || ready) return;
    if (state === 'error') {
      fail('The arena assets or graphics could not load. Please try again.');
      return;
    }
    if (!['assets', 'warming', 'ready'].includes(state)) return;
    canvas.dataset.startupState = state;
    onStage(state);
    if (state === 'ready') {
      ready = true;
      loading.hidden = true;
      canvas.focus();
    } else {
      loading.hidden = false;
      status.textContent = state === 'assets' ? 'Preparing the knights…' : 'Preparing the arena lighting…';
    }
  }
  return {
    fail,
    update,
    compiled() {
      if (failed) return;
      status.textContent = 'The gates are open.';
      enter.hidden = false;
      enter.focus();
    },
    begin() {
      enter.hidden = true;
      update('assets');
      // Keep the window active while the covered canvas renders its warmup.
      canvas.focus();
    },
  };
}
