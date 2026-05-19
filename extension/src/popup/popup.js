(function () {
  const backendInput = document.getElementById('backend');
  const statusEl = document.getElementById('status');

  LeetBattleAPI.getBackend().then((url) => {
    backendInput.value = url;
  });

  function setStatus(msg, isErr) {
    statusEl.textContent = msg;
    statusEl.classList.toggle('err', !!isErr);
  }

  document.getElementById('save').addEventListener('click', async () => {
    const url = backendInput.value.trim() || 'http://localhost:8080';
    await LeetBattleAPI.setBackend(url);
    setStatus('Saved.');
  });

  document.getElementById('test').addEventListener('click', async () => {
    setStatus('Testing...');
    try {
      await LeetBattleAPI.searchQuestions('', 1);
      setStatus('Backend reachable.');
    } catch (err) {
      setStatus('Failed: ' + err.message, true);
    }
  });

  document.getElementById('open').addEventListener('click', () => {
    chrome.tabs.create({ url: 'https://leetcode.com/problemset/' });
  });
})();
