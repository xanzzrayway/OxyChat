function makeStreamingRenderer(container, signal) {
  const nodes = [];
  let targetText = '';
  let shownLen = 0;
  let rafId = null;
  let lastScrollTs = 0;

  let lockedParts = [];
  let lockedUpTo = 0;

  // Dipanggil dari task-sheet (di 06-modals-render.js) buat narik daftar task/file kode di respons ini.
  container._getCodeTasks = function() {
    return nodes.filter(n => n && n.type === 'code').map(n => ({
      title: n.title || guessTitleFromCode(n.prevContent, n.lang),
      lang: n.lang,
      content: n.prevContent,
      closed: !!n.closed
    }));
  };
  container._getThinkTask = function() {
    const t = nodes.find(n => n && n.type === 'think');
    return t ? { closed: !!t.closed, content: t.prevContent, ref: t } : null;
  };
  function refreshTaskSheetIfOpen() {
    if (activeTaskSheetContainer === container && isTaskSheetOpen()) renderTaskSheetList();
  }

  function scrollIfNeeded() {
    const now = performance.now();
    if (now - lastScrollTs < 80) return;
    lastScrollTs = now;
    forceScrollBottom();
  }

  function ensureTextNode(i) {
    if (nodes[i] && nodes[i].type === 'text') return nodes[i];
    if (nodes[i]) nodes[i].el.remove();
    const div = document.createElement('div');
    container.appendChild(div);
    nodes[i] = { type:'text', el: div, prevContent: '' };
    return nodes[i];
  }

  // Selagi AI lagi nulis kode, yang tampil cuma pill "Membuat (nama file) >" dengan glow jalan.
  // Begitu fence-nya ketutup (kode kelar), pill ini diganti jadi kartu file (lihat renderCodeFileCard).
  function ensureCodeNode(i, lang) {
    if (nodes[i] && nodes[i].type === 'code') return nodes[i];
    if (nodes[i]) nodes[i].el.remove();

    const pill = document.createElement('div');
    pill.className = 'code-gen-pill';
    const badge = document.createElement('span');
    badge.className = 'code-gen-badge';
    const label = document.createElement('span');
    label.className = 'code-gen-label';
    label.textContent = 'Membuat Kode';
    const chevron = document.createElement('span');
    chevron.className = 'code-gen-chevron';
    chevron.textContent = '›';
    pill.appendChild(badge);
    pill.appendChild(label);
    pill.appendChild(chevron);
    pill.onclick = () => openTaskSheet(container);
    container.appendChild(pill);

    const ref = { type:'code', el: pill, pill, label, badge, lang, prevContent:'', closed:false, title:'' };
    nodes[i] = ref;
    updateCodeTitle(ref, lang, '');
    refreshTaskSheetIfOpen();
    refreshOverallPill();
    return ref;
  }

  // Nama file di pill nyesuain otomatis: ```html -> "Membuat index.html", ```css -> "Membuat style.css",
  // ```js -> "Membuat script.js", dst (logikanya di guessTitleFromCode, sudah ada dari sebelumnya).
  function updateCodeTitle(ref, lang, content) {
    const t = guessTitleFromCode(content || '', lang) || 'Kode';
    if (ref.title !== t) {
      ref.title = t;
      if (ref.label) ref.label.textContent = 'Membuat ' + t;
      if (ref.badge) {
        const meta = fileIconMeta(t, lang);
        ref.badge.style.background = meta.color;
        ref.badge.innerHTML = meta.svg;
      }
    }
  }

  // Ganti pill jadi kartu file final begitu kode-nya kelar (fence ketutup).
  function renderCodeFileCard(ref) {
    const title = ref.title || guessTitleFromCode(ref.prevContent, ref.lang);
    const card = buildCodeFileCard(title, ref.lang, ref.prevContent);
    if (ref.pill && ref.pill.parentNode) ref.pill.parentNode.replaceChild(card, ref.pill);
    else container.appendChild(card);
    ref.el = card;
    ref.pill = null;
  }

  function ensureThinkNode(i) {
    if (nodes[i] && nodes[i].type === 'think') return nodes[i];
    if (nodes[i]) nodes[i].el.remove();
    const pill = document.createElement('div');
    pill.className = 'think-pill';
    pill.innerHTML = '<span class="think-icon"><svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" stroke-width="1.4"><circle cx="6.5" cy="6.5" r="5.2"/><path d="M6.5 4v2.6l1.7 1.3" stroke-linecap="round" stroke-linejoin="round"/></svg></span>'
      + '<span class="think-label">Berpikir</span><span class="think-chevron">&gt;</span>';
    container.appendChild(pill);
    const ref = { type:'think', el: pill, iconEl: pill.querySelector('.think-icon'), labelEl: pill.querySelector('.think-label'), prevContent: '', closed:false };
    pill.onclick = () => openTaskSheet(container);
    nodes[i] = ref;
    refreshTaskSheetIfOpen();
    return ref;
  }
  // Pill ini gak pernah ilang lagi — begitu semua kelar (mikir + semua kode), labelnya jadi "Task Selesai".
  function refreshOverallPill() {
    const thinkRef = nodes.find(n => n && n.type === 'think');
    if (!thinkRef || !thinkRef.el) return;
    const codeRefs = nodes.filter(n => n && n.type === 'code');
    const allCodeDone = codeRefs.length === 0 || codeRefs.every(n => n.closed);
    const overallDone = thinkRef.closed && allCodeDone;
    const label = overallDone ? 'Task Selesai' : (thinkRef.closed ? 'Sedang Mengerjakan' : 'Berpikir');
    if (thinkRef.labelEl) thinkRef.labelEl.textContent = label;
    thinkRef.el.classList.toggle('done', overallDone);
    if (thinkRef.iconEl) {
      thinkRef.iconEl.innerHTML = overallDone
        ? '<svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M2.7 6.7l2.6 2.6L10.3 3.7"/></svg>'
        : '<svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" stroke-width="1.4"><circle cx="6.5" cy="6.5" r="5.2"/><path d="M6.5 4v2.6l1.7 1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    }
  }
  function updateThinkNode(ref, content, closed) {
    if (ref.prevContent !== content) {
      ref.prevContent = content;
      if (activeThinkRef === ref) {
        document.getElementById('think-modal-body').textContent = content.trim();
      }
    }
    ref.closed = closed;
    refreshTaskSheetIfOpen();
    refreshOverallPill();
  }

  function updateCodeNode(ref, newContent, isClosed) {
    if (ref.prevContent === newContent && ref.closed === isClosed) return;
    ref.prevContent = newContent;
    updateCodeTitle(ref, ref.lang, newContent);
    if (isClosed && !ref.closed) {
      ref.closed = true;
      renderCodeFileCard(ref);
    } else {
      ref.closed = isClosed;
    }
    refreshTaskSheetIfOpen();
    refreshOverallPill();
  }

  function updateTextNode(ref, newContent, isClosed) {
    if (ref.prevContent === newContent && ref.closed === isClosed) return;
    ref.el.innerHTML = renderMDInline(newContent);
    ref.prevContent = newContent;
    ref.closed = isClosed;
  }

  function tokenizeTail(tail) {
    const tailParts = [];
    let i = 0;
    while (i < tail.length) {
      const fenceIdx = tail.indexOf('```', i);
      const thinkIdx = tail.indexOf('<think>', i);
      let nextIdx = -1, kind = null;
      if (fenceIdx !== -1 && (thinkIdx === -1 || fenceIdx < thinkIdx)) { nextIdx = fenceIdx; kind = 'code'; }
      else if (thinkIdx !== -1) { nextIdx = thinkIdx; kind = 'think'; }

      if (nextIdx === -1) {
        const rest = tail.slice(i);
        if (rest) tailParts.push({ type:'text', content: rest, closed:false, consumedLen: rest.length });
        break;
      }

      if (nextIdx > i) {
        const t = tail.slice(i, nextIdx);
        if (t) tailParts.push({ type:'text', content: t, closed:true, consumedLen: t.length });
      }

      if (kind === 'code') {
        const afterFence = tail.slice(nextIdx + 3);
        const nlIdx = afterFence.indexOf('\n');
        if (nlIdx === -1) {
          // Baris bahasa (```html dst) belum kebaca lengkap — tahan dulu, jangan bikin box
          // duluan pake lang kosong (itu penyebab sempet muncul nama generik/txt).
          break;
        }
        const lang = afterFence.slice(0, nlIdx).trim().toLowerCase().split(/[\s,;:()]+/)[0] || '';
        const bodyAndRest = afterFence.slice(nlIdx + 1);
        const endIdx = bodyAndRest.indexOf('```');
        if (endIdx === -1) {
          tailParts.push({ type:'code', lang, content: bodyAndRest, closed:false, consumedLen: tail.length - nextIdx });
          i = tail.length; break;
        } else {
          const consumedLen = (nextIdx + 3 + nlIdx + 1 + endIdx + 3) - nextIdx;
          tailParts.push({ type:'code', lang, content: bodyAndRest.slice(0, endIdx), closed:true, consumedLen });
          i = nextIdx + consumedLen;
        }
      } else {
        const afterTag = tail.slice(nextIdx + 7);
        const endIdx = afterTag.indexOf('</think>');
        if (endIdx === -1) {
          tailParts.push({ type:'think', content: afterTag, closed:false, consumedLen: tail.length - nextIdx });
          i = tail.length; break;
        } else {
          const consumedLen = (nextIdx + 7 + endIdx + 8) - nextIdx;
          tailParts.push({ type:'think', content: afterTag.slice(0, endIdx), closed:true, consumedLen });
          i = nextIdx + consumedLen;
        }
      }
    }
    return tailParts;
  }

  function getParts(visibleText) {
    const tail = visibleText.slice(lockedUpTo);
    const tailParts = tokenizeTail(tail);

    if (tailParts.length > 1) {
      const newlyLocked = tailParts.slice(0, -1);
      newlyLocked.forEach(p => { p.closed = true; });
      const consumed = newlyLocked.reduce((acc, p) => acc + p.consumedLen, 0);
      lockedParts = lockedParts.concat(newlyLocked);
      lockedUpTo += consumed;
    }

    const last = tailParts.length ? tailParts[tailParts.length - 1] : null;
    return last ? lockedParts.concat([last]) : lockedParts.slice();
  }

  function paint() {
    const visibleText = targetText.slice(0, shownLen);
    const parts = getParts(visibleText);

    parts.forEach((seg, i) => {
      if (seg.type === 'text') {
        const ref = ensureTextNode(i);
        updateTextNode(ref, seg.content, !!seg.closed);
      } else if (seg.type === 'code') {
        const ref = ensureCodeNode(i, seg.lang);
        updateCodeNode(ref, seg.content, !!seg.closed);
      } else if (seg.type === 'think') {
        const ref = ensureThinkNode(i);
        updateThinkNode(ref, seg.content, !!seg.closed);
      }
    });
  }

  function activeSegmentType() {
    const visibleText = targetText.slice(0, shownLen);
    const tail = visibleText.slice(lockedUpTo);
    const tailParts = tokenizeTail(tail);
    return tailParts.length ? tailParts[tailParts.length - 1].type : null;
  }

  // ====== SETTING KECEPATAN TYPING (edit di sini sesuka lo) ======
  // TICK_INTERVAL = jeda waktu (ms) tiap langkah muncul
  // CHARS_PER_TICK = jumlah HURUF yang muncul setiap langkah (1 = 1 huruf, 2 = 2 huruf, dst)
  const TEXT_TICK_INTERVAL = 25;
  const TEXT_CHARS_PER_TICK = 5;
  const CODE_TICK_INTERVAL = 30;
  const CODE_CHARS_PER_TICK = 30;
  const THINK_TICK_INTERVAL = 1;
  const THINK_CHARS_PER_TICK = 60;
  // =================================================================
  let lastTickTime = 0;

  function isWordChar(c) {
    return c !== undefined && /[A-Za-z0-9_]/.test(c);
  }

  function nextWordEnd(fromIdx) {
    if (isWordChar(targetText[fromIdx])) {
      let i = fromIdx;
      while (i < targetText.length && isWordChar(targetText[i])) i++;
      return i;
    }
    return fromIdx + 1;
  }

  function isSpaceChar(c) {
    return c === ' ' || c === '\n' || c === '\t' || c === '\r';
  }

  function nextWordsEnd(fromIdx, count) {
    let i = fromIdx;
    const len = targetText.length;
    for (let w = 0; w < count && i < len; w++) {
      while (i < len && isSpaceChar(targetText[i])) i++;
      while (i < len && !isSpaceChar(targetText[i])) i++;
    }
    while (i < len && isSpaceChar(targetText[i])) i++;
    return i > fromIdx ? i : fromIdx + 1;
  }

  function tick(ts) {
    if (signal && signal.aborted) { rafId = null; lastTickTime = 0; return; }
    if (!lastTickTime) lastTickTime = ts;
    const segType = activeSegmentType();
    const isCode = segType === 'code';
    const isThink = segType === 'think';
    const interval = isCode ? CODE_TICK_INTERVAL : (isThink ? THINK_TICK_INTERVAL : TEXT_TICK_INTERVAL);
    if (ts - lastTickTime >= interval) {
      if (shownLen < targetText.length) {
        let step;
        if (isCode) {
          step = Math.min(targetText.length - shownLen, CODE_CHARS_PER_TICK);
        } else if (isThink) {
          step = Math.min(targetText.length - shownLen, THINK_CHARS_PER_TICK);
        } else {
          step = Math.min(targetText.length - shownLen, TEXT_CHARS_PER_TICK);
        }
        shownLen = Math.min(targetText.length, shownLen + step);
        paint();
        scrollIfNeeded();
      }
      lastTickTime = ts;
    }
    if (shownLen < targetText.length && !(signal && signal.aborted)) {
      rafId = requestAnimationFrame(tick);
    } else {
      rafId = null;
      lastTickTime = 0;
    }
  }

  function update(fullText) {
    targetText = fullText;
    if (!rafId && !(signal && signal.aborted)) rafId = requestAnimationFrame(tick);
  }

  update.flush = function(fullText) {
    targetText = fullText;
    shownLen = fullText.length;
    if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
    paint();
    nodes.forEach(ref => {
      if (ref && ref.type === 'code' && !ref.closed) {
        ref.closed = true;
        renderCodeFileCard(ref);
      }
      if (ref && ref.type === 'think' && !ref.closed) {
        ref.closed = true;
      }
    });
    refreshTaskSheetIfOpen();
    refreshOverallPill();
    forceScrollBottom();
  };

  update.waitUntilDone = function(sig) {
    return new Promise(resolve => {
      function check() {
        if (sig && sig.aborted) { resolve(true); return; }
        if (shownLen >= targetText.length) { resolve(false); return; }
        requestAnimationFrame(check);
      }
      check();
    });
  };

  return update;
}


function fill(text) {
  if (!activeId || !sessions[activeId]) newChat();
  $input.value = text; autoResize($input); send();
}
async function sendMulti(text) {
  if (isMsgLimitReached()) {
    updateLimitBannerUI();
    toast('Limit Tercapai! Upgrade ke Paket Pro atau Max');
    return;
  }
  userScrolledUp = false; $scrollBtn.classList.remove('show');
  isStreaming = true;
  const ac = new AbortController();
  abortController = ac;
  $input.value = ''; autoResize($input); setSendLoading(true);

  const sess = sessions[activeId];
  sess.messages.push({ role:'user', content:text });
  sess.ts = Date.now(); saveSessions(); renderHistList();
  incrementMsgCount();

  document.getElementById('empty-state')?.remove();

  const models = getAllModels();
  const { turn, boxByModel } = buildMultiCanvasTurn(text, models);
  $msgs.appendChild(turn); forceScrollBottom();

  const historyMsgs = sess.messages.slice(0, -1).filter(m => typeof m.content === 'string');
  const apiMessages = historyMsgs.concat([{ role:'user', content:text }]);

  const systemMsg = [{
    role: 'system',
    content: 'Kamu adalah Qwerty, asisten yang dibuat oleh Abid. Akun TikTok pembuat lu adalah @BidzQwerty. Jawab pertanyaan pengguna dengan jelas, singkat, padat, dan akurat.' +
      ' WAJIB pake bahasa gaul Indonesia yang santai dan kekinian, JANGAN PERNAH pake bahasa formal atau baku. Contoh yang wajib lu pake:' +
      ' Saya = Gw/Gue, Enggak = Gak/Ga, Kamu = Lu/Lo, Ini = Ni, Itu = Tuh, Bentar = Tar/Santai, Baik = Oke/Sip, Bagus = Keren/Mantep, ' +
      ' Sangat = Banget/Bgt, Sekarang = Skrg, Nanti = Tar, Sudah = Udah, Belum = Blom, Tidak Bisa = Gabisa, ' +
      ' Mungkin = Kayanya/Kali, Tidak = Nga, Kenapa = Napa, Dimana = Dmn, Kapan = Kpn, Bagaimana = Gimana, ' +
      ' Tolong = Bantu, Terima Kasih = Makasih/Makasi, Sama-Sama = Sama-sama/Sip.' +
      ' Jangan pake kata "bro", "cuy", "bang", atau "gan". Boleh pake emoji sesekali secukupnya, jangan berlebihan.' +
      (userName ? ' Nama pengguna adalah "' + userName + '". Panggil sesekali secara natural.' : '') +
      (customInstructions ? '\n\n=== INSTRUKSI KHUSUS DARI USER (WAJIB DIPATUHI) ===\n' + customInstructions : '') +
      getThinkingInstruction()
  }];

  const results = new Array(models.length).fill(null);

  await Promise.allSettled(models.map(async (m, i) => {
    const body = boxByModel[m.value];
    try {
      const res = await callOxyAPI(m.value, {
        model: m.value,
        messages: [...systemMsg, ...apiMessages],
        stream: false,
        temperature: 1.0,
        ...getReasoningExtraParams(m.value)
      }, { signal: ac.signal });
      if (!res.ok) { const e = await res.json().catch(()=>{}); throw new Error((e && e.error && e.error.message) || 'HTTP ' + res.status); }
      const data = await res.json();
      const msgObj = (data.choices && data.choices[0] && data.choices[0].message) || {};
      const reasoningTxt = msgObj.reasoning_content || msgObj.reasoning || '';
      const content = (reasoningTxt ? ('<think>' + reasoningTxt + '</think>') : '') + (msgObj.content || (reasoningTxt ? '' : '(kosong)'));
      const clean = stripThinkBlocks(content);
      results[i] = { model: m.value, label: m.label, content: clean, error: null };
      body.innerHTML = '';
      renderMDFull(content, body);
      if (data.usage) { sess.tokens = (sess.tokens || 0) + (data.usage.total_tokens || 0); $tokenInfo.textContent = '~' + sess.tokens + ' tok'; }
    } catch(err) {
      const msg = err.name === 'AbortError' ? 'Dihentikan' : ('Error: ' + err.message);
      results[i] = { model: m.value, label: m.label, content: '', error: msg };
      body.className = 'multi-answer-body err';
      body.textContent = msg;
    }
    if (turn.isConnected) forceScrollBottom();
  }));

  sess.messages.push({ role: 'assistant', mode: 'multi', answers: results });
  sess.ts = Date.now();

  const isFirstExchange = sess.messages.length === 2;
  if (isFirstExchange) sess.title = text.slice(0, 30) + (text.length > 30 ? '...' : '');
  saveSessions(); renderHistList(); updateTopbarTitle();

  isStreaming = false; abortController = null; setSendLoading(false);
  $scrollBtn.classList.remove('show'); $input.blur();
}

