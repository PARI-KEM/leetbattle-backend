(function () {
  if (window.__leetBattleInjected) return;
  window.__leetBattleInjected = true;

  const API = window.LeetBattleAPI;
  const SESSION_KEY = 'leetbattle.session';
  const NAME_KEY = 'leetbattle.playerName';

  const state = {
    open: false,
    view: 'idle',          // 'idle' | 'lobby' | 'battle'
    room: null,
    playerId: null,
    isHost: false,
    playerName: '',
    error: '',
    searchResults: [],
    searching: false,
    pickedSlugs: new Set(),
    ws: null,
    timerHandle: null,
  };

  let root, viewEl, chatLogEl, chatInputEl, timerEl;

  init();

  async function init() {
    const fab = document.createElement('button');
    fab.className = 'leetbattle-fab';
    fab.textContent = 'Battle';
    fab.addEventListener('click', togglePanel);
    document.body.appendChild(fab);

    root = document.createElement('div');
    root.className = 'leetbattle-root';
    root.innerHTML = `
      <div class="leetbattle-header">
        <div>
          <div class="leetbattle-title">LeetBattle</div>
          <div class="leetbattle-subtitle" data-role="subtitle">Not connected</div>
        </div>
        <button class="leetbattle-close" data-role="close" aria-label="Close">×</button>
      </div>
      <div class="leetbattle-view" data-role="view"></div>
      <div class="leetbattle-chat">
        <div class="leetbattle-chat-log" data-role="chat-log"></div>
        <form class="leetbattle-chat-form" data-role="chat-form">
          <input type="text" maxlength="500" placeholder="Type a message..." data-role="chat-input" />
          <button type="submit" class="leetbattle-btn">Send</button>
        </form>
      </div>
    `;
    document.body.appendChild(root);

    viewEl = root.querySelector('[data-role="view"]');
    chatLogEl = root.querySelector('[data-role="chat-log"]');
    chatInputEl = root.querySelector('[data-role="chat-input"]');

    root.querySelector('[data-role="close"]').addEventListener('click', togglePanel);
    root.querySelector('[data-role="chat-form"]').addEventListener('submit', onSendChat);

    chrome.storage.local.get([NAME_KEY], (res) => {
      state.playerName = res[NAME_KEY] || '';
      tryResume();
    });
  }

  function togglePanel() {
    state.open = !state.open;
    root.classList.toggle('open', state.open);
  }

  // ---------- session persistence ----------

  function saveSession() {
    if (!state.room || !state.playerId) {
      chrome.storage.local.remove(SESSION_KEY);
      return;
    }
    chrome.storage.local.set({
      [SESSION_KEY]: {
        code: state.room.code,
        playerId: state.playerId,
        isHost: state.isHost,
      },
    });
  }

  function tryResume() {
    chrome.storage.local.get([SESSION_KEY], async (res) => {
      const session = res[SESSION_KEY];
      if (!session) { render(); return; }
      try {
        const room = await API.getRoom(session.code);
        state.room = room;
        state.playerId = session.playerId;
        state.isHost = session.isHost;
        state.view = room.started ? 'battle' : 'lobby';
        await connectSocket();
        render();
      } catch (_) {
        chrome.storage.local.remove(SESSION_KEY);
        render();
      }
    });
  }

  // ---------- websocket ----------

  async function connectSocket() {
    if (state.ws) {
      try { state.ws.close(); } catch (_) {}
    }
    state.ws = await API.openSocket(state.room.code, onWsEvent, onWsClose);
  }

  function onWsEvent(event) {
    if (!state.room) return;
    switch (event.type) {
      case 'chat':
        state.room.messages = [...(state.room.messages || []), event.payload];
        renderChat();
        break;
      case 'player-joined':
        state.room.players = [...(state.room.players || []), event.payload];
        renderView();
        break;
      case 'questions-updated':
        state.room.questions = event.payload || [];
        renderView();
        break;
      case 'battle-started':
        state.room.started = true;
        state.room.startedAt = event.payload;
        state.view = 'battle';
        render();
        break;
      case 'question-solved':
        const slug = event.payload && event.payload.slug;
        if (slug && !(state.room.solvedSlugs || []).includes(slug)) {
          state.room.solvedSlugs = [...(state.room.solvedSlugs || []), slug];
          renderView();
        }
        break;
    }
  }

  function onWsClose() {
    if (state.room) {
      setTimeout(() => {
        if (state.room) connectSocket().catch(() => {});
      }, 2000);
    }
  }

  // ---------- chat ----------

  async function onSendChat(e) {
    e.preventDefault();
    const text = chatInputEl.value.trim();
    if (!text || !state.room || !state.playerId) return;
    chatInputEl.value = '';
    try {
      await API.postChat(state.room.code, state.playerId, text);
    } catch (err) {
      setError(err.message);
    }
  }

  // ---------- render ----------

  function render() {
    const sub = root.querySelector('[data-role="subtitle"]');
    if (state.room) {
      sub.textContent = `Room ${state.room.code} · ${state.view === 'battle' ? 'Battle' : 'Lobby'}`;
    } else {
      sub.textContent = 'Not connected';
    }
    renderView();
    renderChat();
  }

  function renderView() {
    if (state.view === 'idle' || !state.room) renderIdle();
    else if (state.view === 'lobby') renderLobby();
    else if (state.view === 'battle') renderBattle();
  }

  function setError(msg) {
    state.error = msg || '';
    const errEl = viewEl.querySelector('.leetbattle-error');
    if (errEl) errEl.textContent = state.error;
  }

  // ----- idle view (create / join) -----

  function renderIdle() {
    stopTimer();
    viewEl.innerHTML = `
      <div class="leetbattle-section">
        <span class="leetbattle-label">Your name</span>
        <input type="text" class="leetbattle-input" data-role="name" maxlength="40" />
      </div>

      <div class="leetbattle-section">
        <span class="leetbattle-label">Create a battle</span>
        <div class="leetbattle-row" style="margin-bottom:6px">
          <select class="leetbattle-select" data-role="duration">
            <option value="15">15 min</option>
            <option value="45" selected>45 min</option>
            <option value="60">1 hour</option>
            <option value="78">1.3 hours</option>
            <option value="90">1.5 hours</option>
          </select>
          <select class="leetbattle-select" data-role="limit">
            <option value="1">1 q</option>
            <option value="2">2 q</option>
            <option value="3">3 q</option>
            <option value="4" selected>4 q</option>
          </select>
        </div>
        <button class="leetbattle-btn" data-role="create">Create room</button>
      </div>

      <div class="leetbattle-section">
        <span class="leetbattle-label">Join with code</span>
        <div class="leetbattle-row">
          <input type="text" class="leetbattle-input" data-role="join-code" placeholder="e.g. K4N7QP" maxlength="6" style="text-transform:uppercase" />
          <button class="leetbattle-btn secondary" data-role="join">Join</button>
        </div>
      </div>

      <div class="leetbattle-error"></div>
    `;

    const nameInput = viewEl.querySelector('[data-role="name"]');
    nameInput.value = state.playerName || '';
    nameInput.addEventListener('input', () => {
      state.playerName = nameInput.value;
      chrome.storage.local.set({ [NAME_KEY]: state.playerName });
    });

    viewEl.querySelector('[data-role="create"]').addEventListener('click', onCreate);
    viewEl.querySelector('[data-role="join"]').addEventListener('click', onJoin);
  }

  async function onCreate() {
    setError('');
    if (!state.playerName.trim()) { setError('Enter your name first'); return; }
    const duration = parseInt(viewEl.querySelector('[data-role="duration"]').value, 10);
    const limit = parseInt(viewEl.querySelector('[data-role="limit"]').value, 10);
    try {
      const res = await API.createRoom({
        hostName: state.playerName,
        durationMinutes: duration,
        questionLimit: limit,
      });
      state.room = res.room;
      state.playerId = res.playerId;
      state.isHost = true;
      state.view = 'lobby';
      state.pickedSlugs = new Set((res.room.questions || []).map((q) => q.titleSlug));
      saveSession();
      await connectSocket();
      render();
    } catch (err) {
      setError(err.message);
    }
  }

  async function onJoin() {
    setError('');
    if (!state.playerName.trim()) { setError('Enter your name first'); return; }
    const codeRaw = viewEl.querySelector('[data-role="join-code"]').value.trim().toUpperCase();
    if (!codeRaw) { setError('Enter a room code'); return; }
    try {
      const res = await API.joinRoom(codeRaw, state.playerName);
      state.room = res.room;
      state.playerId = res.player.id;
      state.isHost = false;
      state.view = res.room.started ? 'battle' : 'lobby';
      saveSession();
      await connectSocket();
      render();
    } catch (err) {
      setError(err.message);
    }
  }

  // ----- lobby view -----

  function renderLobby() {
    stopTimer();
    const isHost = state.isHost;
    const room = state.room;
    viewEl.innerHTML = `
      <div class="leetbattle-section">
        <span class="leetbattle-label">Share this code</span>
        <div><span class="leetbattle-room-code">${escapeHtml(room.code)}</span></div>
        <div class="leetbattle-hint" style="margin-top:6px">${room.durationMinutes} min · up to ${room.questionLimit} questions</div>
      </div>

      <div class="leetbattle-section">
        <span class="leetbattle-label">Players (${room.players.length})</span>
        <div class="leetbattle-players" data-role="players"></div>
      </div>

      ${isHost ? renderHostPickerHtml() : renderJoinerWaitHtml()}

      <div class="leetbattle-section">
        <button class="leetbattle-btn ghost" data-role="leave">Leave room</button>
      </div>

      <div class="leetbattle-error"></div>
    `;

    renderPlayers();

    if (isHost) {
      viewEl.querySelector('[data-role="search"]').addEventListener('input', debounce(onSearch, 250));
      viewEl.querySelector('[data-role="start"]').addEventListener('click', onStart);
      renderSearchResults();
      renderPicked();
    }

    viewEl.querySelector('[data-role="leave"]').addEventListener('click', onLeave);
  }

  function renderHostPickerHtml() {
    return `
      <div class="leetbattle-section">
        <span class="leetbattle-label">Find questions</span>
        <input type="text" class="leetbattle-input" data-role="search" placeholder="Search by title or topic..." />
        <ul class="leetbattle-list" data-role="search-results" style="margin-top:6px"></ul>
      </div>

      <div class="leetbattle-section">
        <span class="leetbattle-label">Selected (<span data-role="picked-count">0</span>/${state.room.questionLimit})</span>
        <ul class="leetbattle-list" data-role="picked"></ul>
      </div>

      <div class="leetbattle-section">
        <button class="leetbattle-btn" data-role="start">Start battle</button>
      </div>
    `;
  }

  function renderJoinerWaitHtml() {
    return `
      <div class="leetbattle-section">
        <span class="leetbattle-label">Questions</span>
        <ul class="leetbattle-list" data-role="questions"></ul>
        <div class="leetbattle-hint" style="margin-top:6px">Waiting for the host to start the battle...</div>
      </div>
    `;
  }

  function renderPlayers() {
    const el = viewEl.querySelector('[data-role="players"]');
    if (!el) return;
    el.innerHTML = '';
    for (const p of state.room.players) {
      const pill = document.createElement('span');
      pill.className = 'leetbattle-pill';
      pill.textContent = p.name + (p.id === state.room.hostId ? ' (host)' : '');
      el.appendChild(pill);
    }
    if (!state.isHost) {
      const list = viewEl.querySelector('[data-role="questions"]');
      if (list) {
        list.innerHTML = '';
        for (const q of state.room.questions) {
          const li = document.createElement('li');
          const left = document.createElement('div');
          const title = document.createElement('div');
          title.className = 'title';
          title.textContent = q.title;
          const meta = document.createElement('div');
          meta.className = 'meta';
          meta.textContent = q.difficulty;
          left.appendChild(title);
          left.appendChild(meta);
          li.appendChild(left);
          list.appendChild(li);
        }
      }
    }
  }

  async function onSearch(e) {
    const q = e.target.value.trim();
    state.searching = true;
    try {
      state.searchResults = await API.searchQuestions(q, 25);
    } catch (err) {
      setError(err.message);
      state.searchResults = [];
    }
    state.searching = false;
    renderSearchResults();
  }

  function renderSearchResults() {
    const list = viewEl.querySelector('[data-role="search-results"]');
    if (!list) return;
    list.innerHTML = '';
    for (const q of state.searchResults) {
      const li = document.createElement('li');
      const left = document.createElement('div');
      const title = document.createElement('div');
      title.className = 'title';
      title.textContent = q.title;
      const meta = document.createElement('div');
      meta.className = 'meta';
      meta.textContent = q.difficulty + ' · ' + (q.topicTags || []).slice(0, 3).join(', ');
      left.appendChild(title);
      left.appendChild(meta);

      const actions = document.createElement('div');
      actions.className = 'actions';
      const btn = document.createElement('button');
      btn.className = 'leetbattle-btn';
      const already = state.pickedSlugs.has(q.titleSlug);
      btn.textContent = already ? 'Added' : 'Add';
      btn.disabled = already || state.pickedSlugs.size >= state.room.questionLimit;
      btn.addEventListener('click', () => pickQuestion(q));
      actions.appendChild(btn);

      li.appendChild(left);
      li.appendChild(actions);
      list.appendChild(li);
    }
  }

  function renderPicked() {
    const list = viewEl.querySelector('[data-role="picked"]');
    const count = viewEl.querySelector('[data-role="picked-count"]');
    if (!list || !count) return;
    list.innerHTML = '';
    const picked = (state.room.questions || []).filter((q) => state.pickedSlugs.has(q.titleSlug));
    count.textContent = String(picked.length);
    for (const q of picked) {
      const li = document.createElement('li');
      const left = document.createElement('div');
      const title = document.createElement('div');
      title.className = 'title';
      title.textContent = q.title;
      const meta = document.createElement('div');
      meta.className = 'meta';
      meta.textContent = q.difficulty;
      left.appendChild(title);
      left.appendChild(meta);

      const actions = document.createElement('div');
      actions.className = 'actions';
      const rm = document.createElement('button');
      rm.className = 'leetbattle-btn ghost';
      rm.textContent = 'Remove';
      rm.addEventListener('click', () => unpickQuestion(q));
      actions.appendChild(rm);

      li.appendChild(left);
      li.appendChild(actions);
      list.appendChild(li);
    }
  }

  async function pickQuestion(q) {
    if (state.pickedSlugs.size >= state.room.questionLimit) return;
    state.pickedSlugs.add(q.titleSlug);
    await syncPicked();
  }
  async function unpickQuestion(q) {
    state.pickedSlugs.delete(q.titleSlug);
    await syncPicked();
  }
  async function syncPicked() {
    const all = new Map((state.room.questions || []).map((q) => [q.titleSlug, q]));
    for (const r of state.searchResults) all.set(r.titleSlug, r);
    const next = [];
    for (const slug of state.pickedSlugs) {
      const q = all.get(slug);
      if (q) next.push(q);
    }
    try {
      const room = await API.setQuestions(state.room.code, state.playerId, next);
      state.room = room;
      renderSearchResults();
      renderPicked();
    } catch (err) {
      setError(err.message);
    }
  }

  async function onStart() {
    setError('');
    try {
      const room = await API.startBattle(state.room.code, state.playerId);
      state.room = room;
      state.view = 'battle';
      render();
    } catch (err) {
      setError(err.message);
    }
  }

  function onLeave() {
    if (state.ws) try { state.ws.close(); } catch (_) {}
    state.ws = null;
    state.room = null;
    state.playerId = null;
    state.isHost = false;
    state.view = 'idle';
    state.pickedSlugs.clear();
    state.searchResults = [];
    saveSession();
    render();
  }

  // ----- battle view -----

  function renderBattle() {
    const room = state.room;
    viewEl.innerHTML = `
      <div class="leetbattle-section">
        <div class="leetbattle-timer" data-role="timer">--:--</div>
      </div>
      <div class="leetbattle-section">
        <span class="leetbattle-label">Players (${room.players.length})</span>
        <div class="leetbattle-players" data-role="players"></div>
      </div>
      <div class="leetbattle-section">
        <span class="leetbattle-label">Questions</span>
        <ul class="leetbattle-list" data-role="battle-list"></ul>
      </div>
      <div class="leetbattle-section">
        <button class="leetbattle-btn ghost" data-role="leave">Leave room</button>
      </div>
      <div class="leetbattle-error"></div>
    `;
    renderPlayers();
    renderBattleList();
    timerEl = viewEl.querySelector('[data-role="timer"]');
    tickTimer();
    startTimer();
    viewEl.querySelector('[data-role="leave"]').addEventListener('click', onLeave);
  }

  function renderBattleList() {
    const list = viewEl.querySelector('[data-role="battle-list"]');
    if (!list) return;
    list.innerHTML = '';
    const solved = new Set(state.room.solvedSlugs || []);
    for (const q of state.room.questions) {
      const li = document.createElement('li');
      if (solved.has(q.titleSlug)) li.classList.add('solved');

      const left = document.createElement('div');
      const title = document.createElement('div');
      title.className = 'title';
      title.textContent = q.title;
      const meta = document.createElement('div');
      meta.className = 'meta';
      meta.textContent = q.difficulty + (solved.has(q.titleSlug) ? ' · solved' : '');
      left.appendChild(title);
      left.appendChild(meta);

      const actions = document.createElement('div');
      actions.className = 'actions';

      const openBtn = document.createElement('button');
      openBtn.className = 'leetbattle-btn ghost';
      openBtn.textContent = 'Open';
      openBtn.addEventListener('click', () => {
        window.open('https://leetcode.com/problems/' + q.titleSlug + '/', '_blank');
      });
      actions.appendChild(openBtn);

      const doneBtn = document.createElement('button');
      doneBtn.className = 'leetbattle-btn';
      doneBtn.textContent = 'Complete';
      doneBtn.disabled = solved.has(q.titleSlug);
      doneBtn.addEventListener('click', () => onComplete(q));
      actions.appendChild(doneBtn);

      li.appendChild(left);
      li.appendChild(actions);
      list.appendChild(li);
    }
  }

  async function onComplete(q) {
    setError('');
    try {
      await API.complete(state.room.code, state.playerId, q.titleSlug);
    } catch (err) {
      setError(err.message);
    }
  }

  function startTimer() {
    stopTimer();
    state.timerHandle = setInterval(tickTimer, 1000);
  }
  function stopTimer() {
    if (state.timerHandle) clearInterval(state.timerHandle);
    state.timerHandle = null;
  }
  function tickTimer() {
    if (!state.room || !timerEl) return;
    const endsAt = state.room.startedAt + state.room.durationMinutes * 60 * 1000;
    const remaining = Math.max(0, endsAt - Date.now());
    const totalSec = Math.floor(remaining / 1000);
    const mm = String(Math.floor(totalSec / 60)).padStart(2, '0');
    const ss = String(totalSec % 60).padStart(2, '0');
    timerEl.textContent = mm + ':' + ss;
  }

  // ----- chat render -----

  function renderChat() {
    if (!chatLogEl) return;
    chatLogEl.innerHTML = '';
    const messages = (state.room && state.room.messages) || [];
    for (const m of messages) {
      const row = document.createElement('div');
      row.className = 'leetbattle-chat-row ' + (m.kind || 'chat');
      if (m.kind === 'system') {
        row.textContent = m.text;
      } else {
        const who = document.createElement('span');
        who.className = 'who';
        who.textContent = m.playerName + ': ';
        row.appendChild(who);
        row.appendChild(document.createTextNode(m.text));
      }
      chatLogEl.appendChild(row);
    }
    chatLogEl.scrollTop = chatLogEl.scrollHeight;
  }

  // ----- utilities -----

  function debounce(fn, ms) {
    let h;
    return (...args) => {
      clearTimeout(h);
      h = setTimeout(() => fn(...args), ms);
    };
  }
  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    })[c]);
  }
})();
