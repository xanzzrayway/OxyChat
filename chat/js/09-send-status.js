async function send() {
  let text = $input.value.trim();
  const usingImageMode = imageGenModeActive;
  if (usingImageMode && !text) text = 'gambar acak yang unik dan keren';
  if (!text || isStreaming) return;
  if (isMsgLimitReached()) {
    updateLimitBannerUI();
    toast('Limit Tercapai! Upgrade ke Paket Pro atau Max');
    return;
  }
  if (!activeId || !sessions[activeId]) {
    const id = uid();
    sessions[id] = { id, title:'Chat baru', messages:[], tokens:0, ts:Date.now(), mode: chatMode };
    activeId = id; saveSessions(); renderHistList();
  }
  if (sessions[activeId].mode === 'multi' && !usingImageMode) {
    if (pendingAttachment && pendingAttachment.type === 'image') {
      toast('Mode Multi Chat belum bisa baca gambar, ganti ke Normal Chat dulu');
      return;
    }
    await sendMulti(text); return;
  }
  userScrolledUp = false; $scrollBtn.classList.remove('show');
  isStreaming = true;
  const ac = new AbortController();
  abortController = ac;
  $input.value = ''; autoResize($input); setSendLoading(true);

  const sess = sessions[activeId];

  let userMsgContent;
  const attach = pendingAttachment;
  if (attach) {
    const parts = [];
    if (attach.type === 'image') {
      parts.push({ type: 'image_url', image_url: { url: 'data:' + attach.mediaType + ';base64,' + attach.base64 } });
    } else if (attach.type === 'pdf') {
      parts.push({ type: 'text', text: '[File PDF dilampirkan: ' + attach.name + ', ' + formatFileSize(attach.size) + '. Isi PDF gabisa dibaca otomatis, bilang ke user kalo mau dianalisis mending copas teksnya langsung ke chat.]' });
    } else if (attach.textContent != null) {
      parts.push({ type: 'text', text: '[File dilampirkan: ' + attach.name + ', ' + formatFileSize(attach.size) + ']\nIsi file:\n```\n' + attach.textContent + '\n```' });
    } else {
      parts.push({ type: 'text', text: '[File dilampirkan: ' + attach.name + ', ' + formatFileSize(attach.size) + '. Isi file ini gabisa dibaca otomatis (format binary), kasih tau user kalo mau dianalisis mending copas isinya langsung ke chat.]' });
    }
    parts.push({ type: 'text', text });
    userMsgContent = parts;
  } else {
    userMsgContent = text;
  }

  sess.messages.push({ role:'user', content: typeof userMsgContent === 'string' ? userMsgContent : text });
  sess.ts = Date.now(); saveSessions(); renderHistList();
  incrementMsgCount();

  // Draft placeholder buat balasan AI, biar kalo app ke-reload pas lagi jalan (keluar app bentar dll),
  // isi yang udah sempet nyampe tetep kesimpen di localStorage, gak ilang pas balik lagi.
  sess.messages.push({ role:'assistant', content:'', draft:true });
  const draftIdx = sess.messages.length - 1;
  let lastDraftSaveAt = 0;
  function saveDraftThrottled(force) {
    const now = Date.now();
    if (!force && now - lastDraftSaveAt < 700) return;
    lastDraftSaveAt = now;
    if (sess.messages[draftIdx] && sess.messages[draftIdx].draft) {
      sess.messages[draftIdx].content = full;
      saveSessions();
    }
  }
  activeDraftFlush = () => saveDraftThrottled(true);

  const userRow = document.createElement('div');
  userRow.className = 'msg-row user';
  const userCol = document.createElement('div');
  userCol.className = 'user-msg-col';
  if (attach && attach.type !== 'image') {
    const fileBox = document.createElement('div');
    fileBox.className = 'msg-file-box';
    fileBox.innerHTML = FILE_ICON_SVG
      + '<div class="msg-file-box-info"><div class="msg-file-box-name">' + escHtml(attach.name) + '</div><div class="msg-file-box-size">' + formatFileSize(attach.size) + '</div></div>';
    userCol.appendChild(fileBox);
  }
  const userBub = document.createElement('div');
  userBub.className = 'bubble user-bubble';
  userBub.style.userSelect = 'none';
  userBub.style.webkitUserSelect = 'none';
  if (attach && attach.type === 'image') {
    userBub.innerHTML = '<img src="data:' + attach.mediaType + ';base64,' + attach.base64 + '" style="max-width:200px;max-height:160px;border-radius:10px;display:block;margin-bottom:6px;">';
    userBub.innerHTML += renderMDInline(text);
  } else {
    userBub.innerHTML = renderMDInline(text);
  }
  const liveMsgIdx = sess.messages.length - 1;
  const liveText = text;
  attachLongPress(userBub, (x, y) => {
    showCtxMenu(x, y, [
      { label: 'Salin', icon: '<svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="4" y="4" width="8" height="8" rx="1.5"/><path d="M2 10V2h8"/></svg>', action: () => navigator.clipboard.writeText(liveText).then(() => toast('Disalin!')) },
      { label: 'Edit', icon: '<svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M8 2l4 4-7 7H1v-4l7-7z"/></svg>', action: () => startEditBubble(userBub, userCol, liveMsgIdx, liveText) },
    ]);
  });
  userCol.appendChild(userBub);
  userRow.appendChild(userCol);
  document.getElementById('empty-state')?.remove();
  $msgs.appendChild(userRow); forceScrollBottom();

  clearAttachment();
  if (usingImageMode) deactivateImageGenMode();

  const aiRow = document.createElement('div');
  aiRow.className = 'msg-row ai';
  let aiContent = document.createElement('div');
  aiContent.className = 'ai-content';
  aiContent.innerHTML = '<div class="typing-indicator"><span></span><span></span><span></span></div>';
  aiRow.appendChild(aiContent); $msgs.appendChild(aiRow); forceScrollBottom();

  if (usingImageMode) {
    aiContent.innerHTML = imageGenLoadingHTML('Lagi bikin gambar...');
    const imgUrl = await generateImage(text, (attempt, max) => {
      aiContent.innerHTML = imageGenLoadingHTML(attempt > 1 ? 'Nyoba lagi (' + attempt + '/' + max + ')...' : 'Lagi bikin gambar...');
    });
    aiContent.innerHTML = '';
    let aiFull;
    if (imgUrl) {
      renderAIImage(aiContent, imgUrl, text);
      aiFull = '![' + text.replace(/[\[\]]/g,'') + '](' + imgUrl + ')';
    } else {
      aiContent.innerHTML = '<span style="color:#ef4444">Limit Reached</span>';
      aiFull = 'Limit Reached untuk generate gambar: ' + text;
    }
    forceScrollBottom();
    sess.messages.push({ role:'assistant', content: aiFull }); sess.ts = Date.now();

    const isFirstExchange = sess.messages.length === 2;
    if (isFirstExchange) {
      sess.title = text.slice(0, 30) + (text.length > 30 ? '...' : '');
      saveSessions(); renderHistList(); updateTopbarTitle();
      generateAITitle(text, aiFull).then(aiTitle => {
        if (aiTitle && sessions[activeId]) {
          sessions[activeId].title = aiTitle;
          saveSessions(); renderHistList(); updateTopbarTitle();
        }
      });
    } else { saveSessions(); renderHistList(); }

    isStreaming = false; abortController = null; setSendLoading(false);
    $scrollBtn.classList.remove('show'); $input.blur();
    return;
  }

  let full = '', first = true, streamUpdate = null;
  let reasoningBuf = '', contentBuf = '', reasoningClosed = false;
  function composeFull() {
    if (!reasoningBuf) return contentBuf;
    return '<think>' + reasoningBuf + (reasoningClosed ? '</think>' : '') + contentBuf;
  }

  activeStream = {
    sessionId: activeId,
    full: '',
    rebind(container) {
      aiContent = container;
      if (full) {
        streamUpdate = makeStreamingRenderer(aiContent, ac.signal);
        streamUpdate.flush(full);
        first = false;
      } else {
        aiContent.innerHTML = '<div class="typing-indicator"><span></span><span></span><span></span></div>';
        streamUpdate = null;
        first = true;
      }
    }
  };

  const apiMessages = sess.messages.slice(0, -2).concat([{ role:'user', content: userMsgContent }]);

  let searchResults = null;
  let searchContext = '';
  if (webSearchEnabled) {
    aiContent.innerHTML = '<div class="typing-indicator"><span></span><span></span><span></span></div><div style="font-size:11.5px;color:var(--text-muted);margin-top:6px;">Mencari di web...</div>';
    searchResults = await performWebSearch(text);
    if (searchResults) {
      searchContext = '\n\nHasil pencarian web terkini untuk pertanyaan pengguna:\n' +
        searchResults.map((r,i) => (i+1) + '. ' + r.text + (r.url ? ' (' + r.url + ')' : '')).join('\n') +
        '\n\nGunakan informasi di atas jika relevan untuk menjawab. Jangan mengarang sumber/URL selain yang diberikan.';
    }
    aiContent.innerHTML = '<div class="typing-indicator"><span></span><span></span><span></span></div>';
  }

const systemMsg = [
  {
    role: 'system',
    content: 'Kamu adalah Qwerty, asisten serba bisa yang dibuat oleh Abid. Akun TikTok pembuat lu adalah @BidzQwerty. Lu bisa diajak ngobrol dan bantu apa aja, mulai dari obrolan santai, curhat, nanya info, sampe hal teknis. Salah satu keahlian lu yang paling jago adalah coding tingkat lanjut, tapi itu BUKAN satu-satunya topik yang lu kuasai.' +
      ' PENTING BANGET: jawab SESUAI topik yang user tanya/omongin. Kalo user ngobrol hal yang gak nyambung sama koding (misal curhat, nanya info umum, ngobrol santai, dll), JANGAN alihin ke topik koding, jangan tiba-tiba nyaranin ngoding atau nyinggung-nyinggung soal kode kalo emang gak diminta. Ikutin arah obrolan user, jangan maksain topik lu sendiri.' +
      (userName ? ' Nama pengguna adalah "' + userName + '". Panggil pengguna dengan nama itu sesekali secara natural, jangan berlebihan.' : '') +
      ' PENTING: JANGAN PERNAH pake kata "bro", "cuy", "bang", atau "gan" dalam balasan apapun, gak peduli situasinya gimana. Panggil user dengan nama dia kalo ada, atau gak usah pake panggilan sama sekali.' +
      ' Bahasa lu WAJIB bahasa gaul Indonesia yang santai, kekinian, kayak ngobrol sama temen deket. JANGAN PERNAH pake bahasa formal, baku, atau kaku kayak robot. Contoh yang wajib lu pake:' +
      ' Saya = Gw/Gue, Enggak = Gak/Ga, Kamu = Lu/Lo, Ini = Ni, Itu = Tuh, Bentar = Tar/Santai, Baik = Oke/Sip, Bagus = Keren/Mantep, ' +
      ' Sangat = Banget/Bgt, Sekarang = Skrg, Nanti = Tar, Sudah = Udah, Belum = Blom, Tidak Bisa = Gabisa, ' +
      ' Mungkin = Kayanya/Kali, Tidak = Nga, Kenapa = Napa, Dimana = Dmn, Kapan = Kpn, Bagaimana = Gimana, ' +
      ' Tolong = Bantu, Terima Kasih = Makasih/Makasi, Sama-Sama = Sama-sama/Sip, ' +
      ' Selamat Pagi = Pagi, Selamat Siang = Siang, Selamat Sore = Sore, Selamat Malam = Malam, ' +
      ' Sampai Jumpa = Dah/Cya, Baiklah = Oke deh, Sebenarnya = Sebenernya, Memang = Emang, Sebaiknya = Lebih baik, ' +
      ' Yang = Yg, Dengan = Sama/Ama, Untuk = Buat/Utk, Karena = Soalnya/Krn, Seperti = Kayak/Kek, Banyak = Banyak/Byk, Ternyata = Ternyata/Tnyata, Iya = Iya/Ya/Yoi, Serius = Serius/Beneran.' +
      ' Lu boleh pake emoji sesekali biar gak kaku, secukupnya aja, jangan berlebihan.' +
      ' Jangan pernah pake titik koma atau tanda baca yang berlebihan. Pake titik aja atau sering-sering pake "...".' +
      ' ' +
      ' === KALO USER MINTA/NANYA SOAL KODE (dan HANYA kalo itu yang diminta) ===' +
      ' ' +
      ' Lu adalah developer expert. Kalo user minta kode, lu HARUS kasih kode yang kompleks dan tingkat lanjut, bukan kode template basic atau contoh tutorial pemula. Pikirin struktur yang rapi, best practice, dan fitur-fitur yang lengkap.' +
      ' Kode lu harus RAPI: indentasi konsisten, penamaan variabel/fungsi yang jelas, dipisah per bagian/komentar singkat kalo perlu, gampang dibaca.' +
      ' Kalo bikin UI/tampilan, pilih PALET WARNA yang nyambung/matching satu sama lain (gak asal warna nabrak), perhatiin kontras dan keserasian biar hasilnya enak dipandang.' +
      ' KALO USER MINTA KODE HTML (apapun bentuknya, mau itu landing page, web app, komponen, dll), lu WAJIB gabungin HTML + CSS + JS jadi SATU FILE aja. Jangan pernah dipisah ke file .css atau .js terpisah kecuali user secara spesifik minta dipisah.' +
      ' Kasih kode langsung, gak usah banyak basa-basi atau muter-muter di penjelasan. Penjelasan singkat aja kalo emang perlu, fokus ke kodenya.' +
      ' Aturan-aturan di atas HANYA berlaku pas user emang minta/nanya soal kode. Kalo topik obrolannya bukan soal itu, abaikan semua aturan coding ini dan jawab natural sesuai konteks obrolan.' +
      ' ' +
      ' === SOAL GENERATE GAMBAR ===' +
      ' ' +
      ' Lu SENDIRI gabisa generate gambar langsung lewat chat biasa. Kalo user minta dibuatin/gambarin sesuatu, lu HARUS bilang kalo mereka harus pencet tombol "Generate Image" yang ada di chatbox dulu, baru ketik deskripsi gambarnya di situ. Jangan pernah pura-pura bisa generate gambar sendiri atau pake format tag apapun.' +
      ' ' +
      (customInstructions ? '\n\n=== INSTRUKSI KHUSUS DARI USER (WAJIB DIPATUHI, prioritas tinggi) ===\n' + customInstructions + '\n' : '') +
      searchContext +
      getThinkingInstruction()
  }
];


  try {
    const hasImageAttach = attach && attach.type === 'image';
    let modelForThisRequest = selectedModel.value;
    let finalApiMessages = apiMessages;

    if (hasImageAttach && !VISION_CAPABLE_MODELS.includes(selectedModel.value)) {
      let imageDesc = '';
      try {
        imageDesc = await describeImageWithVision(attach);
      } catch (e) {
        imageDesc = '';
      }
      const lastMsg = apiMessages[apiMessages.length - 1];
      const keptParts = (Array.isArray(lastMsg.content) ? lastMsg.content : []).filter(p => p.type !== 'image_url');
      keptParts.unshift({ type: 'text', text: imageDesc ? ('[Gambar yang dilampirkan user]\n' + imageDesc + '\n') : '[User melampirkan gambar, tapi gagal dibaca]\n' });
      finalApiMessages = apiMessages.slice(0, -1).concat([{ role: lastMsg.role, content: keptParts }]);
    }

    const res = await callOxyAPI(modelForThisRequest, {
      model: modelForThisRequest,
      messages: [...systemMsg, ...finalApiMessages],
      stream: true,
      temperature: 1.0,
      ...getReasoningExtraParams(modelForThisRequest)
    }, { signal: ac.signal });
    if (!res.ok) { const e = await res.json().catch(()=>{}); throw new Error((e&&e.error&&e.error.message)||'HTTP '+res.status); }

    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let sseBuffer = '';
    while (true) {
      if (ac.signal.aborted) break;
      const { done, value } = await reader.read();
      if (done) break;
      sseBuffer += dec.decode(value, { stream:true });
      const parts = sseBuffer.split('\n');
      sseBuffer = parts.pop(); // simpen baris terakhir yang mungkin belum lengkap, sambung di iterasi berikutnya
      const lines = parts.filter(l => l.startsWith('data: '));
      for (const line of lines) {
        const d = line.slice(6).trim();
        if (d === '[DONE]') break;
        try {
          const p = JSON.parse(d);
          const dl = p.choices?.[0]?.delta || {};
          const reasoningDelta = thinkingEnabled ? (dl.reasoning_content || dl.reasoning || '') : '';
          const delta = dl.content || '';
          if (reasoningDelta) {
            if (first) { aiContent.innerHTML = ''; streamUpdate = makeStreamingRenderer(aiContent, ac.signal); first = false; }
            reasoningBuf += reasoningDelta;
            full = composeFull(); streamUpdate(full);
            if (activeStream) activeStream.full = full;
            saveDraftThrottled(false);
            if (aiContent.isConnected) forceScrollBottom();
          }
          if (delta) {
            if (first) { aiContent.innerHTML = ''; streamUpdate = makeStreamingRenderer(aiContent, ac.signal); first = false; }
            if (reasoningBuf && !reasoningClosed) reasoningClosed = true;
            contentBuf += delta;
            full = composeFull(); streamUpdate(full);
            if (activeStream) activeStream.full = full;
            saveDraftThrottled(false);
            if (aiContent.isConnected) forceScrollBottom();
          }
          if (p.usage) { sess.tokens = (sess.tokens||0) + (p.usage.total_tokens||0); $tokenInfo.textContent = '~' + sess.tokens + ' tok'; }
        } catch(err) {}
      }
    }
  } catch(err) {
    if (err.name === 'AbortError') {
      if (full) {
        if (!streamUpdate) { aiContent.innerHTML = ''; renderMDFull(full, aiContent); }
        sess.messages[draftIdx] = { role:'assistant', content:full };
        sess.ts = Date.now(); saveSessions();
      } else {
        aiContent.innerHTML = '<span style="color:#999;font-size:13px;font-style:italic">Dihentikan</span>';
        sess.messages.splice(draftIdx, 1); saveSessions();
      }
      if (activeStream && activeStream.sessionId === activeId) activeStream = null;
      isStreaming = false; abortController = null; setSendLoading(false); activeDraftFlush = null;
      $scrollBtn.classList.remove('show'); $input.blur();
      return;
    }

    aiContent.innerHTML = '<span style="color:#ef4444">Error: ' + escHtml(err.message) + '</span>';
    sess.messages.splice(draftIdx, 1); saveSessions(); toast('Error: ' + err.message, 3500);
    if (activeStream && activeStream.sessionId === activeId) activeStream = null;
    isStreaming = false; abortController = null; setSendLoading(false); activeDraftFlush = null;
    $scrollBtn.classList.remove('show'); $input.blur();
    return;
  }

  if (reasoningBuf && !reasoningClosed) {
    reasoningClosed = true; full = composeFull();
    if (activeStream) activeStream.full = full;
    if (streamUpdate) streamUpdate(full);
  }
  const wasStopped = streamUpdate ? await streamUpdate.waitUntilDone(ac.signal) : false;
  if (!wasStopped) {
    aiContent.innerHTML = '';
    renderMDFull(full, aiContent);
    if (webSearchEnabled) {
      let srcs = extractSources(stripThinkBlocks(full));
      if (!srcs.length && searchResults) {
        srcs = searchResults.filter(r => r.url).map(r => {
          try {
            const u = new URL(r.url);
            return { url: r.url, domain: u.hostname.replace(/^www\./,''), title: r.text.slice(0, 60) };
          } catch(e) { return null; }
        }).filter(Boolean);
      }
      const srcEl = buildSourcesEl(srcs);
      if (srcEl) aiContent.appendChild(srcEl);
    }
  }

  if (activeStream && activeStream.sessionId === activeId) activeStream = null;
  if (aiContent.isConnected) { forceScrollBottom(); $scrollBtn.classList.remove('show'); }
  sess.messages[draftIdx] = { role:'assistant', content:full }; sess.ts = Date.now();

  const isFirstExchange = sess.messages.length === 2;
  if (isFirstExchange) {
    sess.title = text.slice(0, 30) + (text.length > 30 ? '...' : '');
    saveSessions(); renderHistList(); updateTopbarTitle();
    generateAITitle(text, full).then(aiTitle => {
      if (aiTitle && sessions[activeId]) {
        sessions[activeId].title = aiTitle;
        saveSessions(); renderHistList(); updateTopbarTitle();
      }
    });
  } else { saveSessions(); renderHistList(); }

  isStreaming = false; abortController = null; setSendLoading(false); activeDraftFlush = null;
  $scrollBtn.classList.remove('show'); $input.blur();
}

$input.addEventListener('keydown', e => {
  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); send(); }
  if (e.key === 'Backspace' && imageGenModeActive && $input.value.length === 0) { e.preventDefault(); deactivateImageGenMode(); }
});
$input.addEventListener('input', () => autoResize($input));
function handleSendBtn() {
  if (isStreaming) { abortController?.abort(); abortController = null; }
  else if (isMsgLimitReached()) { updateLimitBannerUI(); toast('Limit Tercapai! Upgrade ke Paket Pro atau Max'); }
  else send();
}

setPillModel(selectedModel);
buildModelDD();
updateChatModeTabsUI();
if (activeId && sessions[activeId]) {
  renderHistList(); renderMessages(); updateTopbarTitle();
  $tokenInfo.textContent = sessions[activeId].tokens ? '~' + sessions[activeId].tokens + ' tok' : '';
} else {
  renderHistList(); showEmptyState();
}
renderSidebarAccount();
updateLimitBannerUI();
if (!userName) { showWelcomeOverlay(); }

let wasOffline = !navigator.onLine;
let onlineBannerTimer = null;
function updateOnlineStatus() {
  const offline = !navigator.onLine;
  document.getElementById('offline-banner').classList.toggle('show', offline);
  if (!offline && wasOffline) {
    const banner = document.getElementById('online-banner');
    banner.classList.add('show');
    clearTimeout(onlineBannerTimer);
    onlineBannerTimer = setTimeout(() => banner.classList.remove('show'), 2500);
  }
  wasOffline = offline;
}
window.addEventListener('online', updateOnlineStatus);
window.addEventListener('offline', updateOnlineStatus);
updateOnlineStatus();

// ==== Cek status server (SERVER_URL) ====
let serverCheckTimer = null;
async function checkServerHealth() {
  try {
    const res = await fetch(SERVER_URL, { method: 'GET', signal: AbortSignal.timeout(6000) });
    if (!res.ok) throw new Error('bad status');
    document.getElementById('server-down-banner').classList.remove('show');
  } catch (err) {
    document.getElementById('server-down-banner').classList.add('show');
  }
}
checkServerHealth();
serverCheckTimer = setInterval(checkServerHealth, 30000); // cek ulang tiap 30 detik

// ==== Popup promo kode redeem — nampilin SEKALI doang per user, per kode aktif ====
// Kode yang dipromosiin sekarang DINAMIS dari server (bukan hardcode lagi) — admin
// yang nentuin kode mana yang showPopup:true lewat Admin Panel.
function closePromoPopup() {
  const el = document.getElementById('promo-code-overlay');
  if (el) el.classList.remove('show');
}
function copyPromoCode() {
  const text = document.getElementById('promo-code-text').textContent;
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(() => toast('Kode disalin')).catch(() => toast('Gagal nyalin'));
  } else {
    toast('Gagal nyalin');
  }
}
async function maybeShowPromoPopup() {
  try {
    const res = await fetch(SERVER_URL + '/api/promo-featured');
    const data = await res.json();
    if (!data || !data.code) return; // gak ada kode yang lagi dipromosiin
    const seenKey = 'oxy_promo_' + data.code.toLowerCase() + '_seen_v1';
    if (localStorage.getItem(seenKey)) return; // kode INI udah pernah dilihat, gak diulang
    document.getElementById('promo-code-text').textContent = data.code;
    document.getElementById('promo-code-stock').textContent = (typeof data.stock === 'number' ? data.stock : '∞') + ' Stok Tersisa';
    document.getElementById('promo-code-overlay').classList.add('show');
    localStorage.setItem(seenKey, '1'); // tandain kode ini udah dilihat
  } catch (e) {}
}
maybeShowPromoPopup();
