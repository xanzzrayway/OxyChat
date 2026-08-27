function renderHistList() {
  $histList.innerHTML = '';
  const sorted = Object.values(sessions).sort((a,b) => (b.ts||0)-(a.ts||0));
  if (!sorted.length) {
    $histList.innerHTML = '<div style="padding:24px 14px;font-size:12px;color:#ccc;text-align:center;">Belum ada riwayat</div>';
    return;
  }
  sorted.forEach(s => {
    const el = document.createElement('div');
    el.className = 'hist-item' + (s.id === activeId ? ' active' : '');
    el.innerHTML = '<div class="hist-meta"><div class="hist-title">' + (s.mode === 'multi' ? '⚡ ' : '') + escHtml(s.title||'Chat') + '</div></div>';
    attachLongPress(el, (x, y) => {
      showCtxMenu(x, y, [
        { label: 'Hapus', icon: '<svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M2 3.5h10M5.5 3.5V2a1 1 0 011-1h1a1 1 0 011 1v1.5M5 6.5v5M9 6.5v5"/></svg>', danger: true, action: () => deleteHistory(s.id) },
        { label: 'Edit Nama', icon: '<svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M8 2l4 4-7 7H1v-4l7-7z"/></svg>', action: () => { loadHistory(s.id); setTimeout(renameChat, 100); } },
      ]);
    });
    el.onclick = () => loadHistory(s.id);
    $histList.appendChild(el);
  });
}
function loadHistory(id) {
  if (!sessions[id]) return;
  activeId = id; saveSessions(); renderHistList(); renderMessages(); updateTopbarTitle();
  chatMode = sessions[id].mode || 'normal';
  localStorage.setItem(LS_CHATMODE, chatMode);
  updateChatModeTabsUI();
  $tokenInfo.textContent = sessions[id].tokens ? '~' + sessions[id].tokens + ' tok' : '';
  if (window.innerWidth < 700) closeSidebar();
}
function deleteHistory(id) {
  delete sessions[id]; saveSessions();
  if (id === activeId) {
    activeId = null;
    const remaining = Object.values(sessions).sort((a,b)=>(b.ts||0)-(a.ts||0));
    if (remaining.length) {
      activeId = remaining[0].id;
      renderHistList(); renderMessages(); updateTopbarTitle();
      $tokenInfo.textContent = sessions[activeId].tokens ? '~'+sessions[activeId].tokens+' tok' : '';
    } else {
      renderHistList(); showEmptyState(); updateTopbarTitle(); $tokenInfo.textContent = '';
    }
  } else { renderHistList(); }
  toast('Riwayat dihapus');
}
function newChat() {
  const id = uid();
  sessions[id] = { id, title:'Tanpa Judul', messages:[], tokens:0, ts:Date.now(), mode: chatMode };
  activeId = id; saveSessions(); renderHistList(); showEmptyState(); updateTopbarTitle();
  $tokenInfo.textContent = '';
  if (window.innerWidth < 700) closeSidebar();
}

function showEmptyState() {
  $msgs.innerHTML = '';
  const es = document.createElement('div');
  es.className = 'slide-in-right';
  if (chatMode === 'multi') {
    es.id = 'empty-state';
    const models = getAllModels();
    es.className += ' multi-hero';
    es.innerHTML = '<div class="multi-hero-title">Multi<br>Chat</div>'
      + '<div class="multi-hero-sub">Bandingkan AI sekaligus dalam satu pertanyaan</div>'
      + '<div class="multi-hero-cards">' + models.map(m =>
        '<div class="multi-hero-card" style="--mc:' + getModelColor(m.value) + '">'
        + '<div class="mhc-icon">' + (m.icon || '') + '</div>'
        + '<div class="mhc-name">' + escHtml(m.label.replace('Oxy ', '')) + '</div>'
        + '<div class="mhc-sub">' + escHtml(getModelSub(m.value)) + '</div>'
        + '</div>'
      ).join('') + '</div>'
      + '<div class="multi-hero-hint">✏️ Ketik pertanyaan di bawah untuk mulai</div>';
    $msgs.appendChild(es);
    return;
  }
  es.id = 'empty-state';
  es.innerHTML = '<div class="es-title" id="es-title"><span id="es-greeting-text"></span></div>';
  $msgs.appendChild(es);
  typeGreetingText();
}

// ==== Animasi ngetik buat sapaan di halaman awal chat kosong ====
let greetingTypeTimer = null;
function typeGreetingText() {
  clearTimeout(greetingTypeTimer);
  const el = document.getElementById('es-greeting-text');
  if (!el) return;
  const name = userName || 'Pengguna';
  const full = 'Halo, ' + name + ' Mau Bikin Apa Hari Ini?';
  el.textContent = '';
  let i = 0;
  (function step() {
    if (!document.getElementById('es-greeting-text')) return; // elemen udah gak ada (pindah chat dll)
    el.textContent = full.slice(0, i);
    i++;
    if (i <= full.length) greetingTypeTimer = setTimeout(step, 28);
  })();
}
function toPlainSpeech(text) {
  let t = stripThinkBlocks(text || '');
  t = t.replace(/```[\s\S]*?```/g, ' Ada blok kode di sini. ');
  t = t.replace(/`([^`]+)`/g, '$1');
  t = t.replace(/!\[[^\]]*\]\([^)]+\)/g, '');
  t = t.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
  t = t.replace(/[*_#>~]/g, '');
  t = t.replace(/\n{2,}/g, '. ');
  t = t.replace(/\n/g, ' ');
  return t.trim();
}
let activeUtterance = null, activeSoundBtn = null;
function toggleSpeech(text, btn) {
  if (!('speechSynthesis' in window)) { toast('Browser gak support text-to-speech'); return; }
  if (activeSoundBtn === btn) {
    speechSynthesis.cancel();
    btn.classList.remove('speaking');
    activeUtterance = null; activeSoundBtn = null;
    return;
  }
  speechSynthesis.cancel();
  if (activeSoundBtn) activeSoundBtn.classList.remove('speaking');
  const plain = toPlainSpeech(text);
  if (!plain) { toast('Gak ada teks buat dibacain'); return; }
  const utter = new SpeechSynthesisUtterance(plain);
  utter.lang = 'id-ID';
  const reset = () => { btn.classList.remove('speaking'); if (activeSoundBtn === btn) { activeUtterance = null; activeSoundBtn = null; } };
  utter.onend = reset; utter.onerror = reset;
  activeUtterance = utter; activeSoundBtn = btn;
  btn.classList.add('speaking');
  speechSynthesis.speak(utter);
}
function buildMsgActionBar(m, content) {
  const bar = document.createElement('div');
  bar.className = 'msg-action-bar';

  const copyBtn = document.createElement('button');
  copyBtn.className = 'msg-action-btn';
  copyBtn.title = 'Salin';
  copyBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="8" y="8" width="13" height="13" rx="2.5"/><path d="M4.5 15.5A2 2 0 0 1 3 13.5v-9A2 2 0 0 1 5 2.5h9a2 2 0 0 1 2 2"/></svg>';
  copyBtn.onclick = () => navigator.clipboard.writeText(stripThinkBlocks(content)).then(() => toast('Disalin!'));
  bar.appendChild(copyBtn);

  const upBtn = document.createElement('button');
  upBtn.className = 'msg-action-btn' + (m.feedback === 'up' ? ' active' : '');
  upBtn.title = 'Suka';
  upBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 10v12"/><path d="M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2a3.13 3.13 0 0 1 3 3.88Z"/></svg>';
  const downBtn = document.createElement('button');
  downBtn.className = 'msg-action-btn' + (m.feedback === 'down' ? ' active' : '');
  downBtn.title = 'Gak suka';
  downBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 14V2"/><path d="M9 18.12 10 14H4.17a2 2 0 0 1-1.92-2.56l2.33-8A2 2 0 0 1 6.5 2H20a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-2.76a2 2 0 0 0-1.79 1.11L12 22a3.13 3.13 0 0 1-3-3.88Z"/></svg>';
  upBtn.onclick = () => {
    m.feedback = (m.feedback === 'up') ? null : 'up';
    upBtn.classList.toggle('active', m.feedback === 'up');
    downBtn.classList.remove('active');
    saveSessions();
  };
  downBtn.onclick = () => {
    m.feedback = (m.feedback === 'down') ? null : 'down';
    downBtn.classList.toggle('active', m.feedback === 'down');
    upBtn.classList.remove('active');
    saveSessions();
  };
  bar.appendChild(upBtn);
  bar.appendChild(downBtn);

  const soundBtn = document.createElement('button');
  soundBtn.className = 'msg-action-btn';
  soundBtn.title = 'Dengarkan';
  soundBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/></svg>';
  soundBtn.onclick = () => toggleSpeech(content, soundBtn);
  bar.appendChild(soundBtn);

  return bar;
}
function renderMessages() {
  $msgs.innerHTML = '';
  const sess = sessions[activeId];
  if (!sess || !sess.messages || !sess.messages.length) { showEmptyState(); return; }
  sess.messages.forEach((m, idx) => {
    const content = typeof m.content === 'string' ? m.content : '';
    if (m.role === 'user') {
      const next = sess.messages[idx + 1];
      if (next && next.role === 'assistant' && next.mode === 'multi') return;
      const row = document.createElement('div');
      row.className = 'msg-row user';
      const bub = document.createElement('div');
      bub.className = 'bubble user-bubble';
      bub.innerHTML = renderMDInline(content);
      bub.style.userSelect = 'none';
      bub.style.webkitUserSelect = 'none';
      attachLongPress(bub, (x, y) => {
        showCtxMenu(x, y, [
          { label: 'Salin', icon: '<svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="4" y="4" width="8" height="8" rx="1.5"/><path d="M2 10V2h8"/></svg>', action: () => navigator.clipboard.writeText(content).then(() => toast('Disalin!')) },
          { label: 'Edit', icon: '<svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M8 2l4 4-7 7H1v-4l7-7z"/></svg>', action: () => startEditBubble(bub, row, idx, content) },
        ]);
      });
      row.appendChild(bub);
      $msgs.appendChild(row);
    } else if (m.role === 'assistant' && m.mode === 'multi' && Array.isArray(m.answers)) {
      const prevUser = sess.messages[idx - 1];
      const qText = (prevUser && typeof prevUser.content === 'string') ? prevUser.content : '';
      const allModels = getAllModels();
      const modelsForNodes = m.answers.map(a => {
        const def = allModels.find(mm => mm.value === a.model);
        return { value: a.model, label: a.label || a.model || 'AI', icon: (def && def.icon) || '' };
      });
      const { turn, boxByModel } = buildMultiCanvasTurn(qText, modelsForNodes);
      m.answers.forEach(a => {
        const body = boxByModel[a.model];
        if (!body) return;
        if (a.error) {
          body.className = 'multi-answer-body err';
          body.textContent = a.error;
        } else {
          body.className = 'multi-answer-body';
          renderMDFull(a.content || '', body);
        }
      });
      $msgs.appendChild(turn);
    } else if (m.role === 'assistant' && !m.draft) {
      const row = document.createElement('div');
      row.className = 'msg-row ai';
      const cnt = document.createElement('div');
      cnt.className = 'ai-content';
      row.appendChild(cnt);
      $msgs.appendChild(row);
      renderMDFull(content, cnt);
      if (m.interrupted) {
        const note = document.createElement('div');
        note.style.cssText = 'font-size:11.5px;color:var(--text-muted);font-style:italic;margin-top:4px;';
        note.textContent = 'Terputus pas lagi jalan (app sempet ketutup/direload), balasan ini gak lengkap.';
        cnt.appendChild(note);
      }
      if (webSearchEnabled) {
        const srcs = extractSources(stripThinkBlocks(content));
        const srcEl = buildSourcesEl(srcs);
        if (srcEl) cnt.appendChild(srcEl);
      }
      cnt.appendChild(buildMsgActionBar(m, content));
    }
  });
  if (activeStream && activeStream.sessionId === activeId) {
    const aiRow = document.createElement('div');
    aiRow.className = 'msg-row ai';
    const cnt = document.createElement('div');
    cnt.className = 'ai-content';
    aiRow.appendChild(cnt);
    $msgs.appendChild(aiRow);
    activeStream.rebind(cnt);
  }
  requestAnimationFrame(() => { $msgs.scrollTop = $msgs.scrollHeight; });
}

