const LS_THINKING = 'oxychat_thinking_v1';
const LS_EFFORT = 'oxychat_effort_v1';
const EFFORT_LABELS = { rendah: 'Rendah', sedang: 'Sedang', tinggi: 'Tinggi', maks: 'Maks' };
const EFFORT_INSTRUCTIONS = {
  rendah: 'Sebelum jawab, mikir singkat aja (1-2 kalimat) di dalam tag <think>...</think>, to the point.',
  sedang: 'Sebelum jawab, mikir langkah-langkah utamanya secara ringkas di dalam tag <think>...</think>.',
  tinggi: 'Sebelum jawab, mikir agak mendalam di dalam tag <think>...</think>, pertimbangkan beberapa sudut pandang atau kemungkinan.',
  maks: 'Sebelum jawab, mikir super detail dan step-by-step di dalam tag <think>...</think>, pertimbangkan berbagai kemungkinan, edge case, dan cek ulang logikanya sebelum yakin sama jawabannya.'
};
let thinkingEnabled = localStorage.getItem(LS_THINKING) === '1';
let currentEffort = EFFORT_LABELS[localStorage.getItem(LS_EFFORT)] ? localStorage.getItem(LS_EFFORT) : 'sedang';
function getThinkingInstruction() {
  if (!thinkingEnabled) return '';
  return '\n\n' + EFFORT_INSTRUCTIONS[currentEffort] +
    ' Aturan ini WAJIB dipatuhi APAPUN model/karakter lu, gak peduli lu biasanya langsung jawab atau kagak.' +
    ' WAJIB bungkus SELURUH proses mikirnya di dalam tag <think> dan </think> (buka tag <think> di baris PALING AWAL sebelum nulis apapun lain, tutup dengan </think> sebelum mulai jawaban final).' +
    ' Jawaban final WAJIB ditulis SETELAH tag </think> ditutup, di luar tag itu. JANGAN PERNAH skip proses mikir ini, JANGAN PERNAH langsung jawab tanpa tag <think> lebih dulu.';
}
function onThinkingToggle(el) {
  thinkingEnabled = el.checked;
  localStorage.setItem(LS_THINKING, thinkingEnabled ? '1' : '0');
}
// Kirim parameter reasoning native (kalo providernya support, dia bakal kepake; kalo enggak ya diabaikan aja).
// Ini biar model yang emang punya mode reasoning bawaan (bukan cuma ngandelin instruksi prompt) beneran mikir juga.
const EFFORT_TO_LEVEL = { rendah: 'low', sedang: 'medium', tinggi: 'high', maks: 'high' };
function getReasoningExtraParams(modelValue) {
  if (!thinkingEnabled) return {};
  // Parameter reasoning native ini gak semua provider/model ngerti formatnya (bisa bikin request-nya
  // ditolak alias error 400 kalo dikasih field yang gak dikenal). Aman-nya cuma dikirim ke Groq, dan cuma
  // field yang emang didukung Groq (reasoning_effort/reasoning_format). "enable_thinking" & "thinking" itu
  // format punya provider lain (bukan Groq), makanya di-reject servernya kalo dipaksa kirim ke Groq.
  // Provider selain Groq tetep dapet efek mikir dari instruksi prompt (getThinkingInstruction).
  if (getProviderName(modelValue) !== 'groq') return {};
  const level = EFFORT_TO_LEVEL[currentEffort] || 'medium';
  return {
    reasoning_effort: level,
    reasoning_format: 'parsed'
  };
}
function openEffortPopup(e) {
  if (e) e.stopPropagation();
  renderEffortPopup();
  openSettingPopup('effort-popup', 'effort-row');
}
function closeEffortPopup() { document.getElementById('effort-popup').classList.remove('show'); }
function setEffort(v) {
  if (!EFFORT_LABELS[v]) v = 'sedang';
  currentEffort = v;
  localStorage.setItem(LS_EFFORT, currentEffort);
  renderEffortPopup();
  closeEffortPopup();
}
function renderEffortPopup() {
  document.getElementById('effort-current-label').textContent = EFFORT_LABELS[currentEffort] || 'Sedang';
  document.querySelectorAll('#effort-popup .theme-option').forEach(el => {
    el.classList.toggle('active', el.dataset.effortValue === currentEffort);
  });
}
document.getElementById('thinking-toggle').checked = thinkingEnabled;
renderEffortPopup();

document.getElementById('custom-instr-textarea').addEventListener('input', updateCustomInstrCount);

function saveSessions() {
  try {
    const toSave = {};
    for (const [id, s] of Object.entries(sessions)) {
      toSave[id] = { ...s, messages: s.messages.slice(-100) };
    }
    localStorage.setItem(scopedKey(LS_KEY), JSON.stringify(toSave));
    localStorage.setItem(scopedKey(LS_ACTIVE), activeId || '');
  } catch(e) {}
}

// Dipanggil tiap konteks akun berubah (login Google, ganti akun, mode uji coba, logout) supaya
// riwayat chat, sesi aktif, dan paket yang ke-render selalu punya punya akun yang lagi aktif sekarang.
function reloadAccountScopedState() {
  sessions = {};
  try {
    const raw = localStorage.getItem(scopedKey(LS_KEY));
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) sessions = parsed;
    }
  } catch (e) { sessions = {}; }
  activeId = resolveActiveId();
  currentPlan = localStorage.getItem(scopedKey(LS_PLAN)) || 'gratis';
  if (selectedModel.pro && currentPlan === 'gratis' && !isModelUnlocked(selectedModel.value)) {
    const freeModel = getAllModels().find(m => !m.pro);
    if (freeModel) { selectedModel = freeModel; localStorage.setItem(LS_MODEL, freeModel.value); setPillModel(freeModel); }
  }
  if (activeId && sessions[activeId]) {
    renderHistList(); renderMessages(); updateTopbarTitle();
    $tokenInfo.textContent = sessions[activeId].tokens ? '~' + sessions[activeId].tokens + ' tok' : '';
  } else {
    renderHistList(); showEmptyState(); updateTopbarTitle();
    $tokenInfo.textContent = '';
  }
  buildModelDD();
  updateLimitBannerUI();
}

function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2,5); }
function escHtml(s) { return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function toast(msg, ms) {
  $toast.textContent = msg; $toast.classList.add('show');
  setTimeout(() => $toast.classList.remove('show'), ms || 2000);
}
function autoResize(el) { el.style.height = 'auto'; el.style.height = Math.min(el.scrollHeight, 130) + 'px'; }
function fillPrompt(text) {
  $input.value = text;
  autoResize($input);
  send();
}
function setSendLoading(v) { $sendBtn.classList.toggle('loading', v); }
function updateTopbarTitle() {
  $topbarTitle.textContent = '';
}
function stripThinkBlocks(text) {
  return (text || '').replace(/<think>[\s\S]*?<\/think>/g, '');
}

async function performWebSearch(query) {
  try {
    const res = await fetch('https://api.duckduckgo.com/?q=' + encodeURIComponent(query) + '&format=json&no_html=1&skip_disambig=1');
    if (!res.ok) return null;
    const data = await res.json();
    const items = [];
    if (data.AbstractText) items.push({ text: data.AbstractText, url: data.AbstractURL || '' });
    if (Array.isArray(data.RelatedTopics)) {
      data.RelatedTopics.forEach(t => {
        if (items.length >= 6) return;
        if (t.Text && t.FirstURL) items.push({ text: t.Text, url: t.FirstURL });
        else if (Array.isArray(t.Topics)) {
          t.Topics.forEach(t2 => { if (items.length < 6 && t2.Text && t2.FirstURL) items.push({ text: t2.Text, url: t2.FirstURL }); });
        }
      });
    }
    return items.length ? items : null;
  } catch(e) { return null; }
}
function buildPollinationsUrl(prompt) {
  const seed = Math.floor(Math.random() * 1000000000);
  return 'https://image.pollinations.ai/prompt/' + encodeURIComponent(prompt) + '?width=1024&height=1024&nologo=true&seed=' + seed;
}
function generateImage(prompt, onStatus) {
  return new Promise(resolve => {
    const maxAttempts = 3;
    let attempt = 0;
    const tryLoad = () => {
      attempt++;
      if (onStatus) onStatus(attempt, maxAttempts);
      const url = buildPollinationsUrl(prompt);
      const img = new Image();
      let settled = false;
      const timer = setTimeout(() => {
        if (settled) return; settled = true;
        if (attempt < maxAttempts) tryLoad(); else resolve(null);
      }, 30000);
      img.onload = () => {
        if (settled) return; settled = true;
        clearTimeout(timer); resolve(url);
      };
      img.onerror = () => {
        if (settled) return; settled = true;
        clearTimeout(timer);
        if (attempt < maxAttempts) tryLoad(); else resolve(null);
      };
      img.src = url;
    };
    tryLoad();
  });
}
function imageGenLoadingHTML(statusText) {
  return '<div class="img-gen-box">'
    + '<div class="img-gen-bg"></div>'
    + '<div class="img-gen-dark-overlay"></div>'
    + '<svg class="img-gen-icon" width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="16" rx="2.5"/><circle cx="8.5" cy="9.5" r="1.6"/><path d="M3 16l4.5-4.5a1.5 1.5 0 0 1 2.1 0L13 15l2-2a1.5 1.5 0 0 1 2.1 0L21 17"/></svg>'
    + '</div>';
}
function renderAIImage(container, url, prompt) {
  const wrap = document.createElement('div');
  wrap.style.cssText = 'margin-top:2px;';
  const img = document.createElement('img');
  img.src = url;
  img.alt = prompt;
  img.style.cssText = 'max-width:100%;border-radius:14px;display:block;cursor:pointer;';
  img.onclick = () => openImageViewer(url);
  wrap.appendChild(img);
  container.appendChild(wrap);
}
async function describeImageWithVision(attach) {
  const res = await callOxyAPI(VISION_MODEL, {
    model: VISION_MODEL,
    messages: [
      { role: 'user', content: [
          { type: 'image_url', image_url: { url: 'data:' + attach.mediaType + ';base64,' + attach.base64 } },
          { type: 'text', text: 'Deskripsikan isi gambar ini secara detail dan objektif dalam Bahasa Indonesia: objek yang ada, teks yang kelihatan (kalau ada), warna, suasana, dan konteksnya. Jangan menjawab pertanyaan apapun, cukup deskripsikan gambarnya aja.' }
        ] }
    ],
    stream: false,
    temperature: 0.3
  });
  if (!res.ok) throw new Error('Gagal baca gambar');
  const data = await res.json();
  return data.choices?.[0]?.message?.content?.trim() || '';
}
async function generateAITitle(userMsg, aiReply) {
  try {
    const prompt = `Buat judul singkat (3-6 kata, bahasa Indonesia) untuk percakapan ini. Hanya tulis judulnya saja, tanpa tanda kutip, tanpa penjelasan.\n\nUser: ${userMsg.slice(0, 200)}\nAI: ${stripThinkBlocks(aiReply).slice(0, 300)}`;
    const res = await callOxyAPI('llama-3.1-8b-instant', {
      model: 'llama-3.1-8b-instant',
      messages: [{ role:'user', content: prompt }],
      max_tokens: 30,
      stream: false
    });
    if (!res.ok) return null;
    const data = await res.json();
    const title = data.choices?.[0]?.message?.content?.trim();
    return title ? title.replace(/^["']|["']$/g, '').trim() : null;
  } catch(e) { return null; }
}

function extractSources(text) {
  const sources = [];
  const seen = new Set();
  const urlRe = /https?:\/\/[^\s\)\]"'<>]+/g;
  let m;
  while ((m = urlRe.exec(text)) !== null) {
    let url = m[0].replace(/[.,;:!?]+$/, '');
    try {
      const u = new URL(url);
      const domain = u.hostname.replace(/^www\./, '');
      if (!seen.has(domain)) {
        seen.add(domain);
        let title = domain;
        const pathParts = u.pathname.split('/').filter(Boolean);
        if (pathParts.length) {
          const last = decodeURIComponent(pathParts[pathParts.length - 1])
            .replace(/[-_]/g, ' ').replace(/\.\w+$/, '');
          if (last && last.length > 1) title = last;
        }
        sources.push({ url, domain, title });
      }
    } catch(e) {}
  }
  return sources.slice(0, 8);
}

function makeFavBubble(domain, cls) {
  const bubble = document.createElement('div');
  bubble.className = cls;
  const faviconUrl = 'https://www.google.com/s2/favicons?sz=32&domain=' + domain;
  const img = document.createElement('img');
  img.src = faviconUrl;
  img.onerror = function() {
    img.style.display = 'none';
    const letter = document.createElement('span');
    letter.className = 'fav-letter';
    letter.textContent = domain[0];
    bubble.appendChild(letter);
  };
  bubble.appendChild(img);
  return bubble;
}

function buildSourcesEl(sources) {
  if (!sources.length) return null;

  const wrap = document.createElement('div');
  wrap.className = 'ai-sources-wrap';

  const pillRow = document.createElement('div');
  pillRow.className = 'sources-pill-row';

  const favStack = document.createElement('div');
  favStack.className = 'sources-favstack';
  sources.slice(0, 4).forEach(s => {
    favStack.appendChild(makeFavBubble(s.domain, 'sources-fav-bubble'));
  });

  const label = document.createElement('span');
  label.className = 'sources-pill-label';
  label.textContent = 'Sumber';

  const arrow = document.createElement('span');
  arrow.className = 'sources-pill-arrow';
  arrow.textContent = '▼';

  pillRow.appendChild(favStack);
  pillRow.appendChild(label);
  pillRow.appendChild(arrow);

  const list = document.createElement('div');
  list.className = 'sources-list';

  sources.forEach(s => {
    const a = document.createElement('a');
    a.className = 'source-item';
    a.href = s.url;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';

    a.appendChild(makeFavBubble(s.domain, 'source-item-fav'));

    const titleEl = document.createElement('span');
    titleEl.className = 'source-item-title';
    titleEl.textContent = s.title;

    const domainEl = document.createElement('span');
    domainEl.className = 'source-item-domain';
    domainEl.textContent = s.domain;

    a.appendChild(titleEl);
    a.appendChild(domainEl);
    list.appendChild(a);
  });

  pillRow.addEventListener('click', () => {
    const isOpen = list.classList.toggle('open');
    pillRow.classList.toggle('open', isOpen);
  });

  wrap.appendChild(pillRow);
  wrap.appendChild(list);
  return wrap;
}

let activeThinkRef = null;
