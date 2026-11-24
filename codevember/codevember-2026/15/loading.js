export function createLoadingScreen() {
  const screen = document.querySelector('#loading');
  const status = document.querySelector('#status');
  const progress = document.querySelector('#loading-progress');
  const fill = document.querySelector('#loading-fill');
  const number = document.querySelector('#loading-number');
  let completed = 0, dismiss;

  function update(fraction, message) {
    // Weighted preparation stages, not a download estimate or a timer.
    completed = Math.max(completed, Math.min(1, fraction));
    const percent = Math.round(completed * 100);
    status.textContent = message;
    number.textContent = `${percent}%`;
    fill.style.transform = `scaleX(${completed})`;
    progress.setAttribute('aria-valuenow', percent);
    progress.setAttribute('aria-valuetext', `${percent}% — ${message}`);
  }

  return {
    update,
    finish() {
      update(1, 'Ready to explore');
      screen.classList.add('is-ready');
      dismiss = setTimeout(() => { screen.hidden = true; }, 300);
    },
    fail(message) {
      clearTimeout(dismiss);
      screen.hidden = false; screen.classList.remove('is-ready');
      progress.hidden = true; number.hidden = true;
      status.textContent = message;
    }
  };
}
