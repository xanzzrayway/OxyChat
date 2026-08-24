// Satu origin sama halaman utama, jadi SERVER_URL & device id nyambung lewat localStorage.
const SERVER_URL = (localStorage.getItem('oxychat_server_url_v1') || '').replace(/\/+$/, '');
const LS_DEVICE_ID = 'oxychat_device_id_v1';
const LS_BANNED = 'oxychat_banned_v1';

function getDeviceId() {
  let id = localStorage.getItem(LS_DEVICE_ID);
  if (!id) {
    id = 'dev_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 12);
    localStorage.setItem(LS_DEVICE_ID, id);
  }
  return id;
}

let toastTimer;
function toast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2400);
}

function fmtTime(ts) {
  if (!ts) return '-';
  try { return new Date(ts).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' }); }
  catch (e) { return '-'; }
}

function hideAllNotifs() {
  document.getElementById('notif-loading').style.display = 'none';
  document.getElementById('notif-sent').style.display = 'none';
  document.getElementById('notif-banned').style.display = 'none';
  document.getElementById('notif-restored').style.display = 'none';
}

// ==== 3 status: Terkirim (kuning) / Terbanned Permanent (merah) / Terpulihkan (hijau) ====
function renderStatus(data) {
  hideAllNotifs();
  if (!data.banned) {
    document.getElementById('notif-restored').style.display = 'block';
    try { localStorage.removeItem(LS_BANNED); } catch (e) {}
    return;
  }
  if (data.reviewRequested) {
    document.getElementById('notif-sent').style.display = 'block';
    return;
  }
  document.getElementById('notif-banned').style.display = 'block';
  document.getElementById('notif-banned-reason').textContent = data.reason || 'Kami Telah Mendeteksi Jailbreak';
  document.getElementById('notif-banned-meta').textContent = data.ts ? ('Diblokir pada ' + fmtTime(data.ts)) : '';
}

async function checkStatus() {
  if (!SERVER_URL) {
    hideAllNotifs();
    toast('Server belum kesetting, buka dulu halaman utama Qwerty');
    return;
  }
  try {
    const res = await fetch(SERVER_URL + '/api/account-status', {
      headers: { 'X-Device-Id': getDeviceId() }
    });
    const data = await res.json();
    renderStatus(data);
  } catch (e) {
    toast('Gagal ngecek status, coba lagi');
  }
}

// ==== Tombol "Ajukan Peninjauan" (di kartu merah) ====
async function requestReview() {
  const btn = document.getElementById('request-review-btn');
  btn.disabled = true;
  btn.textContent = 'Mengirim...';
  try {
    const res = await fetch(SERVER_URL + '/api/account-review-request', {
      method: 'POST',
      headers: { 'X-Device-Id': getDeviceId() }
    });
    const data = await res.json().catch(() => null);
    if (data && data.requested) {
      checkStatus(); // langsung refresh -> pindah ke status "Terkirim" (kuning)
    } else {
      toast('Gagal ngirim, coba lagi');
      btn.disabled = false;
      btn.textContent = 'Ajukan Peninjauan';
    }
  } catch (e) {
    toast('Gagal ngirim, coba lagi');
    btn.disabled = false;
    btn.textContent = 'Ajukan Peninjauan';
  }
}

// ==== Tombol "Cek Ulang Status" ====
async function manualRecheck() {
  const btn = document.getElementById('recheck-btn');
  btn.disabled = true;
  btn.textContent = 'Mengecek...';
  await checkStatus();
  btn.disabled = false;
  btn.textContent = 'Cek Ulang Status';
}

// ==== Auto-poll tiap 4 detik + instan pas balik ke tab ini ====
setInterval(checkStatus, 4000);
document.addEventListener('visibilitychange', () => { if (!document.hidden) checkStatus(); });

checkStatus();
