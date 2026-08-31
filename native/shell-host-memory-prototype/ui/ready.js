requestAnimationFrame(() => requestAnimationFrame(() => {
  document.querySelector('#status').textContent = 'Local document rendered. Measurement may begin.';
  document.title = 'TH-PROTOTYPE-RENDERED';
}));
