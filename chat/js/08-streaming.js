function makeStreamingRenderer(container, signal) {
  const nodes = [];
  let targetText = '';
  let shownLen = 0;
  let rafId = null;
  let lastScrollTs = 0;

  let lockedParts = [];
  let lockedUpTo = 0;

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

  function ensureCodeNode(i, lang) {
    if (nodes[i] && nodes[i].type === 'code') return nodes[i];
    if (nodes[i]) nodes[i].el.remove();
    const wrap = document.createElement('div');
    wrap.className = 'code-block-wrap';
    const hdr = document.createElement('div');
    hdr.className = 'code-block-header';
    const langLabel = document.createElement('span');
    langLabel.className = 'code-block-lang';
    langLabel.textContent = guessLangLabel(lang);
    const actions = document.createElement('div');
    actions.className = 'code-block-actions';
    const copyBtn = document.createElement('button');
    copyBtn.className = 'code-block-btn';
    copyBtn.title = 'Salin';
    copyBtn.setAttribute('aria-label', 'Salin');
    copyBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="8" y="8" width="13" height="13" rx="2.5"/><path d="M4.5 15.5A2 2 0 0 1 3 13.5v-9A2 2 0 0 1 5 2.5h9a2 2 0 0 1 2 2"/></svg>';
    actions.appendChild(copyBtn);
    let prevBtn = null;
    if (lang === 'html' || lang === 'htm') {
      prevBtn = document.createElement('button');
      prevBtn.className = 'code-block-btn code-block-btn-play';
      prevBtn.title = 'Preview';
      prevBtn.setAttribute('aria-label', 'Preview');
      prevBtn.innerHTML = '<svg viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round" stroke-linecap="round"><path d="M3 1.8v10.4c0 .7.75 1.13 1.35.76l8.2-5.2a.9.9 0 0 0 0-1.52l-8.2-5.2C3.75.67 3 1.1 3 1.8z"/></svg>';
      actions.appendChild(prevBtn);
    }
    hdr.appendChild(langLabel);
    hdr.appendChild(actions);
    const body = document.createElement('div');
    body.className = 'code-block-body';
    const pre = document.createElement('pre');
    body.appendChild(pre);
    wrap.appendChild(hdr);
    wrap.appendChild(body);
    container.appendChild(wrap);

    const ref = { type:'code', el:wrap, pre, body, lang, langLabel, copyBtn, prevBtn, prevContent:'', lastHighlightLen:0, closed:false, highlightedOnce:false };
    nodes[i] = ref;
    copyBtn.onclick = () => navigator.clipboard.writeText(ref.prevContent||'').then(() => toast('Kode disalin!'));
    if (prevBtn) prevBtn.onclick = () => {
      const c = ref.prevContent||'';
      openModal(guessTitleFromCode(c, ref.lang), ref.lang, c);
      switchTab('preview');
    };
    return ref;
  }

  function ensureThinkNode(i) {
    if (nodes[i] && nodes[i].type === 'think') return nodes[i];
    if (nodes[i]) nodes[i].el.remove();
    const pill = document.createElement('div');
    pill.className = 'think-pill';
    pill.innerHTML = '<span class="think-icon"><svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" stroke-width="1.4"><circle cx="6.5" cy="6.5" r="5.2"/><path d="M6.5 4v2.6l1.7 1.3" stroke-linecap="round" stroke-linejoin="round"/></svg></span>'
      + '<span class="think-label">Thinking</span><span class="think-chevron">&gt;</span>';
    container.appendChild(pill);
    const ref = { type:'think', el: pill, prevContent: '' };
    pill.onclick = () => openThinkModal(ref.prevContent, ref);
    nodes[i] = ref;
    return ref;
  }
  function updateThinkNode(ref, content, closed) {
    if (ref.prevContent !== content) {
      ref.prevContent = content;
      if (activeThinkRef === ref) {
        document.getElementById('think-modal-body').textContent = content.trim();
      }
    }
    if (closed && !ref.doneHidden && ref.el && ref.el.parentNode) {
      ref.doneHidden = true;
      const el = ref.el;
      el.style.overflow = 'hidden';
      el.style.maxHeight = el.offsetHeight + 'px';
      el.style.transition = 'opacity 0.25s ease, max-height 0.25s ease, margin 0.25s ease';
      requestAnimationFrame(() => {
        el.style.opacity = '0';
        el.style.maxHeight = '0px';
        el.style.marginBottom = '0px';
      });
      setTimeout(() => { if (el.parentNode) el.remove(); }, 260);
    }
  }

  function updateCodeNode(ref, newContent, isClosed) {
    if (ref.prevContent === newContent && ref.closed === isClosed) return;
    // langLabel selalu nampilin nama bahasa (HTML/JS/dll) dan gak diubah-ubah lagi selama/sesudah ngoding.
    // Nama file cuma dipake internal pas buka modal preview / download, bukan buat header codebox.

    const grew = newContent.length > ref.prevContent.length && newContent.startsWith(ref.prevContent);

    if (!ref.highlightedOnce && grew && !isClosed) {
      const addition = newContent.slice(ref.prevContent.length);
      if (addition) ref.pre.appendChild(document.createTextNode(addition));
      ref.prevContent = newContent;

      if (newContent.length - ref.lastHighlightLen > 200) {
        ref.pre.innerHTML = highlightCode(newContent, ref.lang);
        ref.lastHighlightLen = newContent.length;
      }
      ref.body.scrollTop = ref.body.scrollHeight;
      return;
    }

    ref.pre.innerHTML = highlightCode(newContent, ref.lang);
    ref.prevContent = newContent;
    ref.lastHighlightLen = newContent.length;
    ref.highlightedOnce = true;
    ref.closed = isClosed;
    ref.body.scrollTop = ref.body.scrollHeight;
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
          tailParts.push({ type:'code', lang:'', content:'', closed:false, consumedLen: tail.length - nextIdx });
          i = tail.length; break;
        }
        const lang = afterFence.slice(0, nlIdx).trim().toLowerCase();
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
        ref.pre.innerHTML = highlightCode(ref.prevContent, ref.lang);
        ref.closed = true;
      }
    });
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

