// Opt-in local diagnostics: ?startup-profile. No sampling during normal play.
export function startStartupProfile(canvas) {
  if (!new URLSearchParams(location.search).has('startup-profile')) return () => {};
  const started = performance.now();
  const stages = {};
  const frames = [];
  let previous = started;
  let readyAt;
  let hidden = false;
  const recordStage = state => {
    stages[state] ??= performance.now() - started;
    if (state === 'ready') readyAt ??= performance.now();
  };
  function summarize(samples) {
    if (!samples.length) return { frames: 0 };
    const sorted = [...samples].sort((a, b) => a - b);
    return {
      frames: sorted.length,
      median_ms: +sorted[Math.floor(sorted.length * 0.5)].toFixed(2),
      p95_ms: +sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))].toFixed(2),
      max_ms: +sorted.at(-1).toFixed(2),
      over_100ms: sorted.filter(value => value > 100).length,
    };
  }
  function sample(now) {
    hidden ||= document.hidden;
    frames.push({ time: now, duration: now - previous });
    previous = now;
    if ((readyAt && now - readyAt >= 20000) || now - started >= 90000) {
      const select = (from, until) => frames.filter(frame => frame.time > from && frame.time <= until).map(frame => frame.duration);
      const report = {
        stages_ms: stages,
        visibility_interrupted: hidden,
        canvas: [canvas.width, canvas.height],
        knight_model_requests: performance.getEntriesByType('resource').filter(entry => new URL(entry.name).pathname.endsWith('/fighters/knight.glb')).length,
        warmup: summarize(select(started, readyAt ?? now)),
        first_5_seconds: readyAt ? summarize(select(readyAt, readyAt + 5000)) : null,
        next_15_seconds: readyAt ? summarize(select(readyAt + 5000, readyAt + 20000)) : null,
      };
      const output = document.createElement('pre');
      output.id = 'startup-profile';
      output.hidden = true;
      output.textContent = JSON.stringify(report, null, 2);
      document.body.append(output);
      console.info('SOULS ARENA startup profile', report);
    } else requestAnimationFrame(sample);
  }
  requestAnimationFrame(sample);
  return recordStage;
}
