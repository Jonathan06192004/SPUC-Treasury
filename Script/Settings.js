// ── Preferences helpers ────────────────────────────────────────────────────────
function getPref(key, def) {
  const v = localStorage.getItem('spuc_pref_' + key);
  if (v === null) return def;
  if (v === 'true') return true;
  if (v === 'false') return false;
  return v;
}

function savePref(key, value) {
  localStorage.setItem('spuc_pref_' + key, value);
  showToast('Preference saved');
}

// ── Init ───────────────────────────────────────────────────────────────────────
(async function init() {
  // Session start time
  if (!sessionStorage.getItem('spuc_session_start')) {
    sessionStorage.setItem('spuc_session_start', new Date().toISOString());
  }
  const start = new Date(sessionStorage.getItem('spuc_session_start'));
  document.getElementById('sessionTime').textContent = start.toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
  document.getElementById('lastActivity').textContent = new Date().toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });

  // Load preferences
  document.getElementById('prefAutoLogout').checked = getPref('autoLogout', false);

  // Password strength listener
  document.getElementById('profileNewPw').addEventListener('input', function () {
    updateStrength(this.value);
  });

  // Load profile from Supabase
  await loadProfile();
  render2faStatus();
})();

async function loadProfile() {
  const loading = document.getElementById('profileLoading');
  const stored = sessionStorage.getItem('spuc_user');
  if (!stored) { loading.textContent = 'NOT LOGGED IN'; return; }

  const user = JSON.parse(stored);
  document.getElementById('sessionUsername').textContent = user.username || '—';

  try {
    const profile = await fetchCurrentUser(user.id);
    if (!profile) { loading.textContent = 'FAILED TO LOAD'; return; }

    // Store fresh data back
    sessionStorage.setItem('spuc_user', JSON.stringify(profile));

    document.getElementById('profileFullName').value = profile.full_name || '';
    document.getElementById('profileUsername').value  = profile.username  || '';
    document.getElementById('profileEmail').value     = profile.email     || '';
    document.getElementById('profilePhone').value     = profile.phone     || '';
    document.getElementById('sessionUsername').textContent = profile.username || '—';
    loading.textContent = '';
  } catch {
    loading.textContent = 'ERROR';
  }
}

// ── Save Profile ───────────────────────────────────────────────────────────────
async function saveProfile() {
  const stored = sessionStorage.getItem('spuc_user');
  if (!stored) return showToast('Not logged in');

  const user    = JSON.parse(stored);
  const msg     = document.getElementById('profileMsg');
  const newPw   = document.getElementById('profileNewPw').value;
  const confPw  = document.getElementById('profileConfirmPw').value;

  msg.className = 'form-msg';

  if (newPw && newPw.length < 6) return showMsg(msg, 'error', 'Password must be at least 6 characters.');
  if (newPw && newPw !== confPw) return showMsg(msg, 'error', 'Passwords do not match.');

  const fields = {
    full_name: document.getElementById('profileFullName').value.trim(),
    username:  document.getElementById('profileUsername').value.trim(),
    email:     document.getElementById('profileEmail').value.trim(),
    phone:     document.getElementById('profilePhone').value.trim(),
  };
  if (!fields.username) return showMsg(msg, 'error', 'Username cannot be empty.');
  if (newPw) fields.password_hash = newPw;

  try {
    const result = await updateUserProfile(user.id, fields);
    if (Array.isArray(result) && result.length) {
      sessionStorage.setItem('spuc_user', JSON.stringify(result[0]));
      document.getElementById('sessionUsername').textContent = result[0].username;
      document.getElementById('profileNewPw').value    = '';
      document.getElementById('profileConfirmPw').value = '';
      updateStrength('');
      showMsg(msg, 'success', '✓ Profile updated successfully.');
      showToast('Profile saved');
    } else {
      showMsg(msg, 'error', 'Update failed. Please try again.');
    }
  } catch {
    showMsg(msg, 'error', 'Connection error. Please try again.');
  }
}

// ── Toggle password visibility ─────────────────────────────────────────────────
function toggleVis(inputId, btn) {
  const input = document.getElementById(inputId);
  input.type = input.type === 'password' ? 'text' : 'password';
  btn.textContent = input.type === 'password' ? '👁' : '🙈';
}

// ── Password strength meter ────────────────────────────────────────────────────
function updateStrength(pw) {
  const fill  = document.getElementById('pwStrengthFill');
  const label = document.getElementById('pwStrengthLabel');
  let score = 0;
  if (pw.length >= 8)          score++;
  if (/[A-Z]/.test(pw))        score++;
  if (/[0-9]/.test(pw))        score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;

  const levels = [
    { pct: '0%',   color: 'transparent', text: '' },
    { pct: '25%',  color: '#ef4444',     text: 'WEAK' },
    { pct: '50%',  color: '#f97316',     text: 'FAIR' },
    { pct: '75%',  color: '#eab308',     text: 'GOOD' },
    { pct: '100%', color: '#22c55e',     text: 'STRONG' }
  ];
  const lvl = levels[score];
  fill.style.width      = pw.length ? lvl.pct : '0%';
  fill.style.background = lvl.color;
  label.textContent     = pw.length ? lvl.text : '';
  label.style.color     = lvl.color;
}

// ── Logout ─────────────────────────────────────────────────────────────────────
function openLogout() {
  document.getElementById('logoutOverlay').classList.remove('hidden');
  document.getElementById('logoutModal').classList.remove('hidden');
}

function closeLogout() {
  document.getElementById('logoutOverlay').classList.add('hidden');
  document.getElementById('logoutModal').classList.add('hidden');
}

function confirmLogout() {
  localStorage.setItem('spuc_logout', Date.now());
  sessionStorage.clear();
  location.href = '../index.html';
}

// ── Helpers ────────────────────────────────────────────────────────────────────
function showMsg(el, type, text) {
  el.textContent = text;
  el.className = 'form-msg ' + type;
  setTimeout(() => { el.className = 'form-msg hidden'; }, 4000);
}

let _toastTimer = null;
function showToast(text) {
  const toast = document.getElementById('toast');
  toast.textContent = text;
  toast.classList.remove('hidden');
  if (_toastTimer) clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => toast.classList.add('hidden'), 2800);
}

// ── Auto-logout on inactivity ──────────────────────────────────────────────────
let _inactivityTimer = null;

function resetInactivity() {
  if (!getPref('autoLogout', false)) return;
  clearTimeout(_inactivityTimer);
  _inactivityTimer = setTimeout(() => {
    sessionStorage.clear();
    location.href = '../index.html';
  }, 30 * 60 * 1000);
}

document.addEventListener('mousemove', resetInactivity);
document.addEventListener('keydown', resetInactivity);
resetInactivity();

// ── Two-Factor Authentication ──────────────────────────────────────────────────
let _pendingSecret = null;

function render2faStatus() {
  const stored = sessionStorage.getItem('spuc_user');
  if (!stored) return;
  const user = JSON.parse(stored);
  const enabled = !!user.two_fa_enabled;

  document.getElementById('twoFaStatusText').textContent = enabled ? 'Enabled' : 'Disabled';
  const dot = document.getElementById('twoFaStatusDot');
  dot.className = 'twofa-dot ' + (enabled ? 'twofa-dot--on' : 'twofa-dot--off');

  document.getElementById('btnEnable2fa').style.display  = enabled ? 'none' : '';
  document.getElementById('btnViewQr').style.display     = enabled ? '' : 'none';
  document.getElementById('btnDisable2fa').style.display = enabled ? '' : 'none';
  document.getElementById('twoFaSetupPanel').style.display = 'none';
  document.getElementById('twoFaViewPanel').style.display  = 'none';
}

function startEnable2fa() {
  const secret = new OTPAuth.Secret();
  _pendingSecret = secret.base32;
  const stored = sessionStorage.getItem('spuc_user');
  const user = JSON.parse(stored);
  const label = encodeURIComponent('SPUC Treasury:' + (user.username || user.email || 'user'));
  const issuer = encodeURIComponent('SPUC Treasury');
  const uri = `otpauth://totp/${label}?secret=${_pendingSecret}&issuer=${issuer}&algorithm=SHA1&digits=6&period=30`;

  document.getElementById('twoFaQrImg').src = 'https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=' + encodeURIComponent(uri);
  document.getElementById('twoFaManualKey').textContent = _pendingSecret;
  document.getElementById('twoFaConfirmCode').value = '';
  document.getElementById('twoFaSetupMsg').className = 'form-msg hidden';
  document.getElementById('twoFaSetupPanel').style.display = 'block';
  document.getElementById('twoFaActions').style.display = 'none';
}

async function confirmEnable2fa() {
  const code = document.getElementById('twoFaConfirmCode').value.trim();
  const msg  = document.getElementById('twoFaSetupMsg');
  if (code.length !== 6) return showMsg(msg, 'error', 'Enter a 6-digit code.');

  const totp = new OTPAuth.TOTP({ secret: OTPAuth.Secret.fromBase32(_pendingSecret), algorithm: 'SHA1', digits: 6, period: 30 });
  if (totp.validate({ token: code, window: 1 }) === null) return showMsg(msg, 'error', 'Invalid code. Try again.');

  const stored = sessionStorage.getItem('spuc_user');
  const user = JSON.parse(stored);
  const result = await updateTwoFa(user.id, { totp_secret: _pendingSecret, two_fa_enabled: true });
  if (Array.isArray(result) && result.length) {
    sessionStorage.setItem('spuc_user', JSON.stringify(result[0]));
    _pendingSecret = null;
    document.getElementById('twoFaActions').style.display = 'flex';
    render2faStatus();
    showToast('2FA enabled successfully');
  } else {
    showMsg(msg, 'error', 'Failed to save. Please try again.');
  }
}

function cancel2faSetup() {
  _pendingSecret = null;
  document.getElementById('twoFaSetupPanel').style.display = 'none';
  document.getElementById('twoFaActions').style.display = 'flex';
}

function viewQr2fa() {
  const stored = sessionStorage.getItem('spuc_user');
  const user = JSON.parse(stored);
  const label = encodeURIComponent('SPUC Treasury:' + (user.username || user.email || 'user'));
  const issuer = encodeURIComponent('SPUC Treasury');
  const uri = `otpauth://totp/${label}?secret=${user.totp_secret}&issuer=${issuer}&algorithm=SHA1&digits=6&period=30`;
  document.getElementById('twoFaViewQrImg').src = 'https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=' + encodeURIComponent(uri);
  document.getElementById('twoFaViewPanel').style.display = 'block';
}

function openDisable2faModal() {
  document.getElementById('disable2faOverlay').classList.remove('hidden');
  document.getElementById('disable2faModal').classList.remove('hidden');
}

function closeDisable2faModal() {
  document.getElementById('disable2faOverlay').classList.add('hidden');
  document.getElementById('disable2faModal').classList.add('hidden');
}

async function confirmDisable2fa() {
  closeDisable2faModal();
  const stored = sessionStorage.getItem('spuc_user');
  const user = JSON.parse(stored);
  const result = await updateTwoFa(user.id, { totp_secret: null, two_fa_enabled: false });
  if (Array.isArray(result) && result.length) {
    sessionStorage.setItem('spuc_user', JSON.stringify(result[0]));
    render2faStatus();
    showToast('2FA disabled');
  } else {
    showToast('Failed to disable 2FA');
  }
}
