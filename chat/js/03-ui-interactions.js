function forceScrollBottom() {
  if (!userScrolledUp) $msgs.scrollTop = $msgs.scrollHeight;
}

// Kalo user keluar app/tab bentar pas AI lagi ngetik (streaming), langsung flush draft ke localStorage
// biar kalo browser/OS reload halamannya pas di-background, balasan yang udah kebentuk gak ilang.
// Terus pas balik lagi ke app, paksa render ulang chat aktif biar konten yang sempet ketinggalan tetep muncul.
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    if (activeDraftFlush) activeDraftFlush();
  } else {
    if (activeStream && activeStream.sessionId === activeId) {
      renderMessages();
    }
  }
});
window.addEventListener('pagehide', () => { if (activeDraftFlush) activeDraftFlush(); });
function scrollToBottomManual() {
  userScrolledUp = false;
  $msgs.scrollTo({ top: $msgs.scrollHeight, behavior: 'smooth' });
  $scrollBtn.classList.remove('show');
}

(function() {
  let startX = 0, startY = 0;
  let isDragging = false, isHoriz = null;
  const THRESHOLD = 80;
  const MAX_VERT  = 40;

  $sidebar.addEventListener('touchstart', e => {
    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
    isDragging = false;
    isHoriz = null;
  }, { passive: true });

  $sidebar.addEventListener('touchmove', e => {
    const dx = e.touches[0].clientX - startX;
    const dy = Math.abs(e.touches[0].clientY - startY);
    if (isHoriz === null && (Math.abs(dx) > 6 || dy > 6)) {
      isHoriz = Math.abs(dx) > dy;
    }
    if (!isHoriz || dx > 0) return;
    e.preventDefault();
    isDragging = true;
    $sidebar.classList.add('dragging');
    $sidebar.style.transform = 'translateX(' + Math.min(0, dx) + 'px)';
  }, { passive: false });

  $sidebar.addEventListener('touchend', e => {
    if (!isDragging) { isHoriz = null; return; }
    isDragging = false; isHoriz = null;
    $sidebar.classList.remove('dragging');
    $sidebar.style.transform = '';
    const dx = e.changedTouches[0].clientX - startX;
    const dy = Math.abs(e.changedTouches[0].clientY - startY);
    if (dx < -THRESHOLD && dy < MAX_VERT) closeSidebar();
  }, { passive: true });
})();

function setPillModel(m) {
  document.getElementById('pill-icon').innerHTML = m.icon || '';
  document.getElementById('pill-label').textContent = getModelCode(m.value) || m.label;
}
function modelCardHTML(value, small) {
  const m = getAllModels().find(x => x.value === value);
  if (!m) return '';
  const sel = selectedModel.value === value;
  const modelUnlocked = isModelUnlocked(value);
  const locked = m.pro && currentPlan === 'gratis' && !modelUnlocked;
  return '<div class="model-card' + (small ? ' model-card-sm' : '') + (sel ? ' selected' : '') + (locked ? ' locked' : '') + '" onclick="selectModelFromSheet(\'' + value + '\')">'
    + '<div class="model-card-icon" style="color:' + getModelColor(value) + '">' + (m.icon || '') + '</div>'
    + '<div class="model-card-text"><div class="model-card-code">' + escHtml(getModelCode(value)) + '</div></div>'
    + (m.pro && !modelUnlocked ? '<span class="model-card-pro-badge">PRO</span>' : '')
    + (modelUnlocked ? '<span class="model-card-unlock-badge">24 JAM</span>' : '')
    + (sel ? '<span class="model-card-check"><svg width="22" height="22" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M3 8.5l3.3 3.3L13 5"/></svg></span>' : '')
    + '</div>';
}
function buildModelDD() {
  document.getElementById('model-main-grid').innerHTML = MAIN_MODEL_VALUES.map(v => modelCardHTML(v, false)).join('');
  document.getElementById('model-other-list').innerHTML = OTHER_MODEL_VALUES.map(v => modelCardHTML(v, true)).join('');
}
function selectModelFromSheet(value) {
  const m = getAllModels().find(x => x.value === value);
  if (!m) return;
  const modelUnlocked = isModelUnlocked(value);
  if (m.pro && currentPlan === 'gratis' && !modelUnlocked) {
    toast('Model ' + m.label + ' cuma buat Paket Pro/Maks. Redeem code atau upgrade dulu ya');
    return;
  }
  selectedModel = m;
  setPillModel(m);
  localStorage.setItem(LS_MODEL, m.value);
  buildModelDD();
  closeModelDD();
}
function openModelPage(name) {
  if (name === 'other') document.getElementById('model-page-other').classList.add('active');
}
function closeModelPage() {
  document.getElementById('model-page-other').classList.remove('active');
}
function toggleModelDD() {
  if (chatMode === 'multi') { toast('Di Multi Chat semua model otomatis jawab bareng'); return; }
  buildModelDD();
  document.getElementById('model-sheet-backdrop').classList.add('show');
  document.getElementById('model-sheet').classList.add('show');
}
function closeModelDD() {
  document.getElementById('model-sheet-backdrop').classList.remove('show');
  document.getElementById('model-sheet').classList.remove('show');
  setTimeout(closeModelPage, 300);
}

document.addEventListener('click', e => {
  if (!e.target.closest('#model-sheet') && !e.target.closest('#model-pill-wrap')) closeModelDD();
  if (!e.target.closest('#modal-menu-wrap'))  closeModalMenu();
  if (!e.target.closest('#img-modal-menu-wrap'))  closeImgModalMenu();
});

function togglePlusSheet() {
  const sheet = document.getElementById('plus-sheet');
  const backdrop = document.getElementById('plus-sheet-backdrop');
  const btn = document.getElementById('plus-btn');
  const isOpen = sheet.classList.contains('show');
  if (isOpen) { sheet.classList.remove('show'); backdrop.classList.remove('show'); btn.classList.remove('sheet-open'); }
  else { sheet.classList.add('show'); backdrop.classList.add('show'); btn.classList.add('sheet-open'); }
}
function closePlusSheet() {
  document.getElementById('plus-sheet').classList.remove('show');
  document.getElementById('plus-sheet-backdrop').classList.remove('show');
  document.getElementById('plus-btn').classList.remove('sheet-open');
}

let pendingAttachment = null;

function formatFileSize(bytes) {
  if (!bytes && bytes !== 0) return '';
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

const FILE_ICON_SVG = '<svg width="18" height="18" viewBox="0 0 22 22" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M13 2H6a2 2 0 00-2 2v14a2 2 0 002 2h10a2 2 0 002-2V7z"/><polyline points="13 2 13 7 18 7"/></svg>';

function clearAttachmentUI() {
  const chip = document.getElementById('attach-chip');
  if (chip) chip.remove();
  const preview = document.getElementById('attach-preview');
  if (preview) preview.remove();
}

function showImagePreview(attach) {
  clearAttachmentUI();
  const box = document.createElement('div');
  box.id = 'attach-preview';
  box.className = 'attach-image-preview';
  box.innerHTML = '<div class="attach-image-thumb"><img src="data:' + attach.mediaType + ';base64,' + attach.base64 + '" alt="' + escHtml(attach.name) + '"></div>'
    + '<button class="attach-remove-btn" onclick="clearAttachment()" aria-label="Hapus gambar"><svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M1 1l8 8M9 1l-8 8"/></svg></button>';
  const inputBox = document.getElementById('input-box');
  inputBox.insertBefore(box, inputBox.firstChild);
}

function showFilePreview(attach) {
  clearAttachmentUI();
  const box = document.createElement('div');
  box.id = 'attach-preview';
  box.className = 'attach-file-preview';
  const canRead = attach.type === 'file' && attach.textContent != null;
  const sizeLabel = formatFileSize(attach.size) + (canRead ? '' : (attach.type === 'pdf' ? ' · PDF' : ' · isi belum bisa dibaca AI'));
  box.innerHTML = '<div class="attach-file-icon">' + FILE_ICON_SVG + '</div>'
    + '<div class="attach-file-info">'
    + '<div class="attach-file-name">' + escHtml(attach.name) + '</div>'
    + '<div class="attach-file-size">' + sizeLabel + '</div>'
    + '</div>'
    + '<button class="attach-remove-btn" onclick="clearAttachment()" aria-label="Hapus file"><svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M1 1l8 8M9 1l-8 8"/></svg></button>';
  const inputBox = document.getElementById('input-box');
  inputBox.insertBefore(box, inputBox.firstChild);
}

function clearAttachment() {
  pendingAttachment = null;
  clearAttachmentUI();
}

function activateImageGenMode() {
  if (!activeId || !sessions[activeId]) newChat();
  imageGenModeActive = true;
  let chip = document.getElementById('image-mode-chip');
  if (!chip) {
    chip = document.createElement('div');
    chip.id = 'image-mode-chip';
    chip.className = 'image-mode-chip';
    chip.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="16" rx="2.5"/><circle cx="8.5" cy="9.5" r="1.6"/><path d="M3 16l4.5-4.5a1.5 1.5 0 0 1 2.1 0L13 15l2-2a1.5 1.5 0 0 1 2.1 0L21 17"/></svg>'
      + '<span>Generate Image</span>';
    const inputLine = document.getElementById('input-line');
    inputLine.insertBefore(chip, inputLine.firstChild);
  }
  $input.placeholder = 'Deskripsi gambar...';
  $input.focus();
}
function deactivateImageGenMode() {
  imageGenModeActive = false;
  const chip = document.getElementById('image-mode-chip');
  if (chip) chip.remove();
  $input.placeholder = 'Tanya Qwerty...';
}

function readFileAsBase64(file) {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result.split(',')[1]);
    r.onerror = () => rej(new Error('Read failed'));
    r.readAsDataURL(file);
  });
}

function readFileAsText(file) {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result);
    r.onerror = () => rej(new Error('Read failed'));
    r.readAsText(file);
  });
}

const TEXT_FILE_EXTENSIONS = ['txt','md','markdown','json','js','jsx','ts','tsx','py','html','htm','css','csv','xml','yaml','yml','c','cpp','h','hpp','java','go','rs','php','rb','sh','bat','log','ini','conf','cfg','sql','lua','vue','svelte','env','gitignore','toml'];

function isTextFile(file) {
  if (file.type && (file.type.startsWith('text/') || file.type === 'application/json' || file.type === 'application/xml' || file.type === 'application/javascript')) return true;
  const ext = (file.name.split('.').pop() || '').toLowerCase();
  return TEXT_FILE_EXTENSIONS.includes(ext);
}

const MAX_FILE_TEXT_CHARS = 20000;

async function onFileSelected(input) {
  if (input.files && input.files[0]) {
    const file = input.files[0];
    try {
      const isPdf = file.type === 'application/pdf';
      const base64 = await readFileAsBase64(file);
      let textContent = null;
      if (!isPdf && isTextFile(file)) {
        try {
          textContent = await readFileAsText(file);
          if (textContent.length > MAX_FILE_TEXT_CHARS) {
            textContent = textContent.slice(0, MAX_FILE_TEXT_CHARS) + '\n\n...[isi file dipotong karena kepanjangan]...';
          }
        } catch (e) { textContent = null; }
      }
      pendingAttachment = { type: isPdf ? 'pdf' : 'file', file, base64, textContent, mediaType: file.type || 'application/octet-stream', name: file.name, size: file.size };
      showFilePreview(pendingAttachment);
      closePlusSheet();
    } catch(e) { toast('Gagal membaca file'); }
  }
  input.value = '';
}
async function onImageSelected(input) {
  if (input.files && input.files[0]) {
    const file = input.files[0];
    try {
      const base64 = await readFileAsBase64(file);
      pendingAttachment = { type: 'image', file, base64, mediaType: file.type || 'image/jpeg', name: file.name, size: file.size };
      showImagePreview(pendingAttachment);
      closePlusSheet();
    } catch(e) { toast('Gagal membaca gambar'); }
  }
  input.value = '';
}
function onWebSearchToggle(el) {
  webSearchEnabled = el.checked;
  document.getElementById('web-search-row').classList.toggle('active', webSearchEnabled);
  toast(webSearchEnabled ? 'Pencarian web aktif' : 'Pencarian web nonaktif');
}

const WELCOME_WORDS = ['Qwerty', 'Asisten Pintarmu', 'Siap Membantu', 'Cepat & Cerdas', 'Mulai Ngobrol'];
let welcomeTypeTimer = null;
function startWelcomeTypewriter() {
  const el = document.getElementById('welcome-type-text');
  let wordIdx = 0, charIdx = 0, phase = 'typing';
  const TYPE_MS = 90, ERASE_MS = 45, HOLD_MS = 1100, GAP_MS = 350;
  function step() {
    const word = WELCOME_WORDS[wordIdx];
    if (phase === 'typing') {
      charIdx++;
      el.textContent = word.slice(0, charIdx);
      if (charIdx >= word.length) { phase = 'hold'; welcomeTypeTimer = setTimeout(step, HOLD_MS); return; }
      welcomeTypeTimer = setTimeout(step, TYPE_MS);
    } else if (phase === 'hold') {
      phase = 'erasing';
      welcomeTypeTimer = setTimeout(step, ERASE_MS);
    } else {
      charIdx--;
      el.textContent = word.slice(0, charIdx);
      if (charIdx <= 0) {
        phase = 'typing';
        wordIdx = (wordIdx + 1) % WELCOME_WORDS.length;
        welcomeTypeTimer = setTimeout(step, GAP_MS);
        return;
      }
      welcomeTypeTimer = setTimeout(step, ERASE_MS);
    }
  }
  step();
}
function stopWelcomeTypewriter() {
  if (welcomeTypeTimer) { clearTimeout(welcomeTypeTimer); welcomeTypeTimer = null; }
}
function showWelcomeOverlay() {
  document.getElementById('welcome-overlay').classList.add('show');
  startWelcomeTypewriter();
}
function triggerGoogleLogin() {
  if (typeof google === 'undefined' || !google.accounts || !google.accounts.id) {
    toast('Google Login gagal dimuat, coba lagi...');
    return;
  }
  google.accounts.id.prompt((notification) => {
    if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
      toast('Login Google gagal ditampilkan, coba lagi ya');
    }
  });
}
function handleGoogleLogin(response) {
  try {
    const payload = JSON.parse(atob(response.credential.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    userName = payload.name || payload.given_name || 'Pengguna';
    userPicture = payload.picture || '';
    userEmail = payload.email || '';
    localStorage.setItem(LS_NAME, userName);
    localStorage.setItem(LS_PICTURE, userPicture);
    localStorage.setItem(LS_EMAIL, userEmail);
    localStorage.setItem(LS_GOOGLE_NAME, userName);
    localStorage.setItem(LS_GOOGLE_PICTURE, userPicture);
    localStorage.removeItem(LS_IS_TRIAL);
    // Akun Google pertama yang login mewarisi riwayat/paket lama (kalau ada); akun lain mulai bersih
    migrateLegacyAccountData(accountKey());
    reloadAccountScopedState();
    hideWelcomeOverlay();
    renderSidebarAccount();
    toast('Halo, ' + userName + '!');
    // Tiap akun punya flag pilihan paket sendiri, jadi akun Google baru selalu ditawarin pilih paket
    if (!localStorage.getItem(scopedKey(LS_PLAN_CHOSEN))) {
      showPlanOverlay();
    }
  } catch (err) {
    toast('Gagal login Google, coba lagi ya');
  }
}
function startTrialSession() {
  userName = 'Trial Account';
  userPicture = '';
  userEmail = '';
  localStorage.setItem(LS_NAME, userName);
  localStorage.removeItem(LS_PICTURE);
  localStorage.removeItem(LS_EMAIL);
  localStorage.setItem(LS_IS_TRIAL, '1');
  reloadAccountScopedState();
  hideWelcomeOverlay();
  renderSidebarAccount();
  toast('Mode uji coba aktif, chat kamu gak tersimpan permanen');
}
function hideWelcomeOverlay() {
  stopWelcomeTypewriter();
  document.getElementById('welcome-overlay').classList.remove('show');
}

