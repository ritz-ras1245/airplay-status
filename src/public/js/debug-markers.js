const markTestStep = async (label, button) => {
  try {
    const res = await fetch('/api/debug/mark', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ label }),
    });
    if (!res.ok) throw new Error('mark failed');
    if (button) {
      button.classList.add('debug-btn--sent');
      setTimeout(() => button.classList.remove('debug-btn--sent'), 1200);
    }
  } catch (err) {
    console.error('test mark failed', err);
  }
};

for (const button of document.querySelectorAll('.debug-btn[data-mark]')) {
  button.addEventListener('click', () => {
    markTestStep(button.dataset.mark, button);
  });
}
