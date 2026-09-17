// MediVault Client Authentication & RBAC Module

const AUTH_KEY = 'medivault_auth_token';
const USER_KEY = 'medivault_user_info';

function getStoredToken() {
  return localStorage.getItem(AUTH_KEY) || '';
}

function getStoredUser() {
  try {
    const u = localStorage.getItem(USER_KEY);
    return u ? JSON.parse(u) : null;
  } catch (e) {
    return null;
  }
}

function saveAuthSession(token, user) {
  localStorage.setItem(AUTH_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
  applyUserPermissions();
}

function clearAuthSession() {
  localStorage.removeItem(AUTH_KEY);
  localStorage.removeItem(USER_KEY);
  applyUserPermissions();
}

function isAuthenticated() {
  return Boolean(getStoredToken());
}

function getUserRole() {
  const user = getStoredUser();
  return user ? (user.role || 'Pharmacist') : 'Guest';
}

function getAuthHeaders() {
  const token = getStoredToken();
  return token ? { 'Authorization': `Bearer ${token}` } : {};
}

function applyUserPermissions() {
  const authed = isAuthenticated();
  const user = getStoredUser();
  const role = getUserRole();

  const userProfileBadge = document.getElementById('userProfileBadge');
  const userNameEl = document.getElementById('sidebarUserName');
  const userRoleEl = document.getElementById('sidebarUserRole');
  const loginTriggerBtn = document.getElementById('loginTriggerBtn');

  if (authed && user && userNameEl && userRoleEl) {
    userNameEl.textContent = user.name || user.email;
    userRoleEl.textContent = role.toUpperCase();
    if (userProfileBadge) userProfileBadge.style.display = 'flex';
    if (loginTriggerBtn) loginTriggerBtn.style.display = 'none';
  } else {
    if (userProfileBadge) userProfileBadge.style.display = 'none';
    if (loginTriggerBtn) loginTriggerBtn.style.display = 'flex';
  }

  // Toggle internal management navigation sections (Only visible when authenticated)
  const mgmtGroup = document.getElementById('managementNavGroup');
  const adminGroup = document.getElementById('adminNavGroup');

  if (mgmtGroup) mgmtGroup.style.display = authed ? '' : 'none';
  if (adminGroup) adminGroup.style.display = authed ? '' : 'none';

  if (authed) {
    // Role Gating UI Navigation Elements
    const adminOnlyEls = document.querySelectorAll('.role-admin-only');
    adminOnlyEls.forEach(el => {
      el.style.display = (role === 'Admin') ? '' : 'none';
    });

    const staffEls = document.querySelectorAll('.role-staff-only');
    staffEls.forEach(el => {
      el.style.display = (role === 'Admin' || role === 'Pharmacist') ? '' : 'none';
    });

    // Settings access: Admin and Pharmacist only (Hidden for Cashier)
    const settingsEls = document.querySelectorAll('.role-settings-only');
    settingsEls.forEach(el => {
      el.style.display = (role === 'Admin' || role === 'Pharmacist') ? '' : 'none';
    });
  }
}

function quickDemoLogin(roleType) {
  let email = 'admin@medivault.com';
  let pass = 'admin123';

  if (roleType === 'pharmacist') {
    email = 'pharmacist@medivault.com';
    pass = 'pharm123';
  } else if (roleType === 'cashier') {
    email = 'cashier@medivault.com';
    pass = 'cash123';
  }

  const emailInp = document.getElementById('loginEmail');
  const passInp = document.getElementById('loginPassword');
  if (emailInp) emailInp.value = email;
  if (passInp) passInp.value = pass;

  showAlert(`Loaded demo ${roleType.toUpperCase()} credentials. Click 'Sign In' below to submit.`, 'info');
}

function handleLoginSubmit(e) {
  if (e) e.preventDefault();

  const email = document.getElementById('loginEmail')?.value;
  const password = document.getElementById('loginPassword')?.value;

  if (!email || !password) {
    return showAlert('Please enter both email and password', 'warning');
  }

  fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  })
    .then(r => r.json())
    .then(resp => {
      if (resp && resp.ok && resp.token) {
        saveAuthSession(resp.token, resp.user);
        closeAuthModal();
        showAlert(`Welcome back, ${resp.user.name} (${resp.user.role})`, 'success');
        showPage('dashboard');
        if (typeof fetchAndRenderMedicines === 'function') fetchAndRenderMedicines();
        if (typeof fetchAndRenderSales === 'function') fetchAndRenderSales();
      } else {
        showAlert('Login Failed: ' + (resp.error || 'Invalid credentials'), 'error');
      }
    })
    .catch(err => {
      console.error('Login error:', err);
      showAlert('Login error — check server connection', 'error');
    });
}

function logoutUser() {
  clearAuthSession();
  showAlert('Signed out successfully.', 'info');
  showLandingPage();
}

function openAuthModal() {
  const modal = document.getElementById('authModal');
  if (modal) {
    modal.style.display = 'flex';
    modal.setAttribute('aria-hidden', 'false');
  }
}

function closeAuthModal() {
  const modal = document.getElementById('authModal');
  if (modal) {
    modal.style.display = 'none';
    modal.setAttribute('aria-hidden', 'true');
  }
}

document.addEventListener('DOMContentLoaded', () => {
  applyUserPermissions();
  if (isAuthenticated()) {
    showPage('dashboard');
  } else {
    showLandingPage();
  }
});
