// ==== Overlay Pilih Paket ====
function showPlanOverlay() {
  pendingPlanChoice = null;
  document.querySelectorAll('.plan-box').forEach(el => el.classList.remove('selected'));
  document.getElementById('plan-continue-btn').disabled = true;
  document.getElementById('plan-overlay').classList.add('show');
}
function hidePlanOverlay() {
  document.getElementById('plan-overlay').classList.remove('show');
}
function selectPlanBox(p) {
  if (p === 'pro' || p === 'maks') {
    toast('Paket ' + PLANS[p].label + ' belum bisa diakses saat ini');
    return;
  }
  pendingPlanChoice = p;
  document.querySelectorAll('.plan-box').forEach(el => el.classList.toggle('selected', el.dataset.plan === p));
  document.getElementById('plan-continue-btn').disabled = false;
}
function confirmPlanSelection() {
  if (!pendingPlanChoice || pendingPlanChoice === 'pro' || pendingPlanChoice === 'maks') return;
  const isActualChange = pendingPlanChoice !== currentPlan;
  applyPlan(pendingPlanChoice);
  localStorage.setItem(scopedKey(LS_PLAN_CHOSEN), '1');
  if (isActualChange) resetMsgCount();
  hidePlanOverlay();
  buildModelDD();
  toast('Kamu sekarang di ' + PLANS[currentPlan].label);
}

// ==== Redeem Code ====
function openRedeemModal() {
  document.getElementById('redeem-input').value = '';
  document.getElementById('redeem-modal').classList.add('open');
}
function closeRedeemModal() {
  document.getElementById('redeem-modal').classList.remove('open');
}
async function submitRedeemCode() {
  const input = document.getElementById('redeem-input');
  const code = input.value.trim().toUpperCase();
  if (!code) { toast('Isi kode dulu'); return; }
  const btn = document.getElementById('redeem-submit-btn');
  if (btn) { btn.disabled = true; btn.textContent = 'Memproses...'; }
  try {
    const res = await fetch(SERVER_URL + '/api/redeem', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Device-Id': getDeviceId() },
      body: JSON.stringify({ code }),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok || !data || !data.success) {
      toast((data && data.error) || 'Kode gak valid atau udah gak berlaku');
      return;
    }
    if (data.type === 'unlock_model' && data.unlockModel) {
      const m = getAllModels().find(x => x.value === data.unlockModel);
      const until = Date.now() + (data.hours || 24) * 3600000;
      localStorage.setItem(scopedKey(LS_MODEL_UNLOCK_PREFIX + data.unlockModel), String(until));
      buildModelDD();
      toast('Berhasil! ' + (m ? m.label : 'Model') + ' kebuka selama ' + (data.hours || 24) + ' jam');
      closeRedeemModal();
      return;
    }
    if (data.type === 'plan' && data.plan && PLANS[data.plan]) {
      const redeemIsChange = data.plan !== currentPlan;
      applyPlan(data.plan);
      localStorage.setItem(scopedKey(LS_PLAN_CHOSEN), '1');
      if (redeemIsChange) resetMsgCount();
      buildModelDD();
      toast('Berhasil! Sekarang kamu di ' + PLANS[data.plan].label + (data.permanent ? ' (selamanya)' : ''));
      closeRedeemModal();
      return;
    }
    toast('Kode berhasil dipake');
    closeRedeemModal();
  } catch (e) {
    toast('Gagal ngirim kode, cek koneksi');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = 'Redeem'; }
  }
}
function renderSidebarAccount() {
  const avatar = document.getElementById('sidebar-account-avatar');
  const nameEl = document.getElementById('sidebar-account-name');
  if (!avatar || !nameEl) return;
  if (!userName) { const stored = localStorage.getItem(LS_NAME); if (stored) userName = stored; }
  if (!userPicture) { const storedPic = localStorage.getItem(LS_PICTURE); if (storedPic) userPicture = storedPic; }
  const name = userName || 'Pengguna';
  if (userPicture) {
    avatar.innerHTML = '<img src="' + userPicture + '" class="sidebar-account-avatar-img" alt="">';
  } else {
    avatar.textContent = name.trim().charAt(0) || '?';
  }
  nameEl.textContent = name;
}
function logoutAccount() {
  document.getElementById('logout-modal-backdrop').classList.add('show');
  document.getElementById('logout-modal').classList.add('show');
}
function closeLogoutModal() {
  document.getElementById('logout-modal-backdrop').classList.remove('show');
  document.getElementById('logout-modal').classList.remove('show');
}
function confirmLogout() {
  closeLogoutModal();
  if (isStreaming && abortController) { abortController.abort(); abortController = null; isStreaming = false; }
  userName = '';
  userPicture = '';
  userEmail = '';
  localStorage.removeItem(LS_NAME);
  localStorage.removeItem(LS_PICTURE);
  localStorage.removeItem(LS_EMAIL);
  localStorage.removeItem(LS_IS_TRIAL);
  if (typeof google !== 'undefined' && google.accounts && google.accounts.id) {
    google.accounts.id.disableAutoSelect();
  }
  reloadAccountScopedState();
  closeSidebar();
  showWelcomeOverlay();
}

function openPersonalizeModal() {
  renderPersonalizeModal();
  document.getElementById('personalize-modal').classList.add('open');
}
function closePersonalizeModal() {
  document.getElementById('personalize-modal').classList.remove('open');
  closeThemePopup();
}
function renderPersonalizeModal() {
  if (!userName) { const stored = localStorage.getItem(LS_NAME); if (stored) userName = stored; }
  if (!userPicture) { const storedPic = localStorage.getItem(LS_PICTURE); if (storedPic) userPicture = storedPic; }
  const name = userName || 'Pengguna';
  const pAvatar = document.getElementById('personalize-avatar');
  if (userPicture) {
    pAvatar.innerHTML = '<img src="' + userPicture + '" class="personalize-avatar-img" alt="">';
  } else {
    pAvatar.textContent = name.trim().charAt(0) || '?';
  }
  document.getElementById('personalize-name').textContent = name;
  document.getElementById('theme-current-label').textContent = THEME_LABELS[currentTheme] || 'Terang';
  document.querySelectorAll('.theme-option').forEach(el => {
    el.classList.toggle('active', el.dataset.themeValue === currentTheme);
  });
  document.getElementById('font-current-label').textContent = FONT_LABELS[currentFont] || 'Plus Jakarta Sans';
  document.querySelectorAll('#font-popup .theme-option').forEach(el => {
    el.classList.toggle('active', el.dataset.fontValue === currentFont);
  });
  document.getElementById('uisize-current-label').textContent = UISIZE_LABELS[currentUiSize] || 'Sedang';
  document.querySelectorAll('#uisize-popup .theme-option').forEach(el => {
    el.classList.toggle('active', el.dataset.uisizeValue === currentUiSize);
  });
  document.getElementById('textsize-current-label').textContent = TEXTSIZE_LABELS[currentTextSize] || 'Sedang';
  document.querySelectorAll('#textsize-popup .theme-option').forEach(el => {
    el.classList.toggle('active', el.dataset.textsizeValue === currentTextSize);
  });
  document.getElementById('custom-instr-status').textContent = customInstructions ? 'Aktif' : 'Belum diatur';
}

// ==== Edit profil (custom nama & foto) ====
let pendingProfilePicture = null;
function openEditProfileModal() {
  if (!userName) { const stored = localStorage.getItem(LS_NAME); if (stored) userName = stored; }
  if (!userPicture) { const storedPic = localStorage.getItem(LS_PICTURE); if (storedPic) userPicture = storedPic; }
  pendingProfilePicture = userPicture || null;
  document.getElementById('edit-profile-name-input').value = userName || '';
  renderEditProfilePreview();
  document.getElementById('edit-profile-backdrop').classList.add('show');
  document.getElementById('edit-profile-modal').classList.add('show');
}
function closeEditProfileModal() {
  document.getElementById('edit-profile-backdrop').classList.remove('show');
  document.getElementById('edit-profile-modal').classList.remove('show');
  pendingProfilePicture = null;
}
function renderEditProfilePreview() {
  const preview = document.getElementById('edit-profile-avatar-preview');
  const nameVal = document.getElementById('edit-profile-name-input').value.trim() || userName || 'Pengguna';
  if (pendingProfilePicture) {
    preview.innerHTML = '<img src="' + pendingProfilePicture + '" alt="">';
  } else {
    preview.innerHTML = '';
    preview.textContent = nameVal.charAt(0) || '?';
  }
}
function handleProfilePhotoChange(event) {
  const file = event.target.files[0];
  if (!file) return;
  if (!file.type.startsWith('image/')) { toast('File harus berupa gambar'); return; }
  const reader = new FileReader();
  reader.onload = (e) => {
    const img = new Image();
    img.onload = () => {
      // resize ke maksimal 200x200 biar hemat localStorage
      const size = 200;
      const canvas = document.createElement('canvas');
      canvas.width = size; canvas.height = size;
      const ctx = canvas.getContext('2d');
      const minSide = Math.min(img.width, img.height);
      const sx = (img.width - minSide) / 2;
      const sy = (img.height - minSide) / 2;
      ctx.drawImage(img, sx, sy, minSide, minSide, 0, 0, size, size);
      pendingProfilePicture = canvas.toDataURL('image/jpeg', 0.85);
      renderEditProfilePreview();
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}
function saveEditProfile() {
  const nameVal = document.getElementById('edit-profile-name-input').value.trim();
  if (!nameVal) { toast('Nama gak boleh kosong'); return; }
  userName = nameVal;
  userPicture = pendingProfilePicture || '';
  localStorage.setItem(LS_NAME, userName);
  if (userPicture) localStorage.setItem(LS_PICTURE, userPicture); else localStorage.removeItem(LS_PICTURE);
  closeEditProfileModal();
  renderSidebarAccount();
  renderPersonalizeModal();
  toast('Profil diperbarui');
}
function resetToGoogleProfile() {
  const gName = localStorage.getItem(LS_GOOGLE_NAME);
  const gPic = localStorage.getItem(LS_GOOGLE_PICTURE);
  if (!gName) { toast('Belum ada data Google tersimpan'); return; }
  document.getElementById('edit-profile-name-input').value = gName;
  pendingProfilePicture = gPic || null;
  renderEditProfilePreview();
}
document.getElementById('edit-profile-name-input')?.addEventListener('input', renderEditProfilePreview);

function openCustomInstrModal() {
  const ta = document.getElementById('custom-instr-textarea');
  ta.value = customInstructions;
  updateCustomInstrCount();
  document.getElementById('custom-instr-modal').classList.add('open');
  setTimeout(() => ta.focus(), 200);
}
function closeCustomInstrModal() {
  document.getElementById('custom-instr-modal').classList.remove('open');
}
function updateCustomInstrCount() {
  const ta = document.getElementById('custom-instr-textarea');
  document.getElementById('custom-instr-count').textContent = ta.value.length + ' karakter';
}
function saveCustomInstr() {
  const ta = document.getElementById('custom-instr-textarea');
  customInstructions = ta.value.trim();
  localStorage.setItem(LS_CUSTOM_INSTR, customInstructions);
  renderPersonalizeModal();
  closeCustomInstrModal();
  toast(customInstructions ? 'Instruksi khusus disimpan' : 'Instruksi khusus dihapus');
}

// ==== Api Key OxyChat ====
// Katalog model publik yang bisa dipilih pas bikin API key (harus sinkron sama server)
const APIKEY_MODEL_CATALOG = [
  { id: 'oxy-alpha', label: 'Laventus 3' },
  { id: 'spectrax', label: 'Spectrax' },
  { id: 'vaneus-4.0', label: 'Vaneus 4.0' },
  { id: 'oxy-nemotron', label: 'Oxy Nemotron' },
  { id: 'oxy-deepseek-r1', label: 'Oxy DeepSeek R1' },
  { id: 'oxy-llama-70b-n', label: 'Oxy Llama 70B N' },
  { id: 'oxy-sonar-reasoning', label: 'Oxy Sonar Reasoning' },
  { id: 'oxy-sonar-pro', label: 'Oxy Sonar Pro' },
  { id: 'oxy-sonar', label: 'Oxy Sonar' },
  { id: 'oxy-sonar-deep-research', label: 'Oxy Sonar Deep Research' },
  { id: 'oxy-thinking', label: 'Oxy Thinking' },
  { id: 'oxy-vision', label: 'Oxy Vision' },
  { id: 'oxy-ultra', label: 'Oxy Ultra' },
  { id: 'oxy-expert', label: 'Oxy Expert' },
  { id: 'oxy-fast', label: 'Oxy Fast' },
];
// Buka halaman API key terpisah (bukan modal lagi)
function goToApiKeyPage() {
  window.location.href = 'CreateApikey/';
}

function goToRequestUpdatePage() {
  window.location.href = 'Request-Update/';
}
function openThemePopup(e) {
  if (e) e.stopPropagation();
  renderPersonalizeModal();
  const popup = document.getElementById('theme-popup');
  const row = document.getElementById('theme-row');
  const rect = row.getBoundingClientRect();
  const pw = 190;
  let left = rect.right - pw;
  if (left < 8) left = 8;
  if (left + pw > window.innerWidth - 8) left = window.innerWidth - pw - 8;
  let top = rect.bottom + 8;
  popup.style.left = left + 'px';
  popup.style.top = top + 'px';
  popup.classList.add('show');
  setTimeout(() => document.addEventListener('click', closeThemePopupOutside, { once: true }), 10);
}
function closeThemePopupOutside(e) {
  const popup = document.getElementById('theme-popup');
  if (popup.contains(e.target)) {
    setTimeout(() => document.addEventListener('click', closeThemePopupOutside, { once: true }), 10);
  } else {
    closeThemePopup();
  }
}
function closeThemePopup() {
  document.getElementById('theme-popup').classList.remove('show');
}
function setTheme(t) {
  applyTheme(t);
  renderPersonalizeModal();
  closeThemePopup();
}

// ==== Popup generik: Font, Ukuran UI, Ukuran Teks (pola sama kayak theme-popup) ====
function openSettingPopup(popupId, rowId) {
  const popup = document.getElementById(popupId);
  const row = document.getElementById(rowId);
  const rect = row.getBoundingClientRect();
  const pw = 190;
  let left = rect.right - pw;
  if (left < 8) left = 8;
  if (left + pw > window.innerWidth - 8) left = window.innerWidth - pw - 8;
  let top = rect.bottom + 8;
  popup.style.left = left + 'px';
  popup.style.top = top + 'px';
  popup.classList.add('show');
  const outsideHandler = (e) => {
    if (popup.contains(e.target)) {
      setTimeout(() => document.addEventListener('click', outsideHandler, { once: true }), 10);
    } else {
      popup.classList.remove('show');
    }
  };
  setTimeout(() => document.addEventListener('click', outsideHandler, { once: true }), 10);
}

function openFontPopup(e) {
  if (e) e.stopPropagation();
  renderPersonalizeModal();
  openSettingPopup('font-popup', 'font-row');
}
function closeFontPopup() { document.getElementById('font-popup').classList.remove('show'); }
function setFont(fontValue, label) {
  applyFont(fontValue);
  renderPersonalizeModal();
  closeFontPopup();
}

function openUiSizePopup(e) {
  if (e) e.stopPropagation();
  renderPersonalizeModal();
  openSettingPopup('uisize-popup', 'uisize-row');
}
function closeUiSizePopup() { document.getElementById('uisize-popup').classList.remove('show'); }
function setUiSize(s) {
  applyUiSize(s);
  renderPersonalizeModal();
  closeUiSizePopup();
}

function openTextSizePopup(e) {
  if (e) e.stopPropagation();
  renderPersonalizeModal();
  openSettingPopup('textsize-popup', 'textsize-row');
}
function closeTextSizePopup() { document.getElementById('textsize-popup').classList.remove('show'); }
function setTextSize(s) {
  applyTextSize(s);
  renderPersonalizeModal();
  closeTextSizePopup();
}

// ==== Thinking (semua model bisa mikir dulu sebelum jawab) + Upaya (level kedalaman mikir) ====
