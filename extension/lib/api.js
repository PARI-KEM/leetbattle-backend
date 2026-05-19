(function (global) {
  const DEFAULT_BACKEND = 'http://localhost:8080';

  function getBackend() {
    return new Promise((resolve) => {
      chrome.storage.local.get(['backendUrl'], (res) => {
        resolve(res.backendUrl || DEFAULT_BACKEND);
      });
    });
  }

  async function request(path, options = {}) {
    const base = await getBackend();
    const res = await fetch(base + path, {
      headers: { 'Content-Type': 'application/json' },
      ...options,
    });
    if (!res.ok) {
      let msg = 'HTTP ' + res.status;
      try {
        const body = await res.json();
        if (body && body.error) msg = body.error;
      } catch (_) {}
      throw new Error(msg);
    }
    return res.json();
  }

  const LeetBattleAPI = {
    getBackend,
    setBackend(url) {
      return new Promise((resolve) =>
        chrome.storage.local.set({ backendUrl: url }, resolve)
      );
    },
    createRoom(payload) {
      return request('/api/rooms', { method: 'POST', body: JSON.stringify(payload) });
    },
    getRoom(code) {
      return request('/api/rooms/' + encodeURIComponent(code));
    },
    joinRoom(code, playerName) {
      return request('/api/rooms/' + encodeURIComponent(code) + '/join', {
        method: 'POST',
        body: JSON.stringify({ playerName }),
      });
    },
    setQuestions(code, playerId, questions) {
      return request('/api/rooms/' + encodeURIComponent(code) + '/questions', {
        method: 'POST',
        body: JSON.stringify({ playerId, questions }),
      });
    },
    startBattle(code, playerId) {
      return request('/api/rooms/' + encodeURIComponent(code) + '/start', {
        method: 'POST',
        body: JSON.stringify({ playerId }),
      });
    },
    postChat(code, playerId, text) {
      return request('/api/rooms/' + encodeURIComponent(code) + '/messages', {
        method: 'POST',
        body: JSON.stringify({ playerId, text }),
      });
    },
    complete(code, playerId, slug) {
      return request('/api/rooms/' + encodeURIComponent(code) + '/complete', {
        method: 'POST',
        body: JSON.stringify({ playerId, slug }),
      });
    },
    searchQuestions(q, limit = 25) {
      const params = new URLSearchParams();
      params.set('limit', String(limit));
      if (q) params.set('q', q);
      return request('/api/questions/search?' + params.toString());
    },
    async openSocket(code, onEvent, onClose) {
      const base = await getBackend();
      const wsUrl = base.replace(/^http/, 'ws') + '/ws/rooms/' + encodeURIComponent(code);
      const ws = new WebSocket(wsUrl);
      ws.onmessage = (e) => {
        try { onEvent(JSON.parse(e.data)); } catch (_) {}
      };
      ws.onclose = () => { if (onClose) onClose(); };
      return ws;
    },
  };

  global.LeetBattleAPI = LeetBattleAPI;
})(typeof self !== 'undefined' ? self : window);
