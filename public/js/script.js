// ---------- MEDIVAULT: script.js ----------

// Global variables for data storage (populated from server)
let medicinesData = [];
let salesData = [];
let currentEditId = null;

let businessSettings = {
  businessName: 'MediVault',
  businessAddress: '123 Medical Street, Health City',
  businessPhone: '+91 9876543210',
  businessEmail: 'info@medivault.com',
  gstNumber: '29ABCDE1234F1Z5',
  licenseNumber: 'DL-KA-2023-12345'
};

let systemSettings = {
  lowStockThreshold: 10,
  expiryAlertDays: 30,
  currency: 'INR',
  dateFormat: 'DD/MM/YYYY',
  enableNotifications: true,
  autoBackup: true
};

let ownerPaymentConfig = {
  accountName: 'MediVault Pharmacy & Healthcare Ltd.',
  bankName: 'ICICI Bank Ltd.',
  accountNumber: '91802345678912',
  ifscCode: 'ICIC0001024',
  branchName: 'Health City Main Branch, MG Road',
  upiId: 'medivault.owner@icici',
  merchantPhone: '+91 9876543210',
  merchantEmail: 'owner.payments@medivault.com',
  gstin: '33AAAAA0000A1Z5'
};

function getLocalDateString(d = new Date()) {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// --- Helper: render UI after fetching medicines ---
function renderAppWithMedicines() {
  try { if (typeof renderMedicinesTable === 'function') renderMedicinesTable(medicinesData); } catch (e) { }
  try { updateInventoryTable(); } catch (e) { }
  try { updateDashboardStats(); } catch (e) { }
  console.log('Rendered UI with', medicinesData.length, 'medicines');
}

// Visible load error
function showLoadError(message) {
  const inventoryPage = document.getElementById('inventory');
  if (inventoryPage) {
    let errDiv = document.getElementById('loadErrorDiv');
    if (!errDiv) {
      errDiv = document.createElement('div');
      errDiv.id = 'loadErrorDiv';
      errDiv.style.background = 'rgba(244,67,54,0.08)';
      errDiv.style.color = '#ff8a80';
      errDiv.style.padding = '0.8rem';
      errDiv.style.borderLeft = '4px solid #F44336';
      errDiv.style.marginBottom = '1rem';
      inventoryPage.insertBefore(errDiv, inventoryPage.firstChild);
    }
    errDiv.textContent = message;
  } else {
    alert(message);
  }
}

// Fetch medicines from backend and render
function fetchAndRenderMedicines() {
  const prev = document.getElementById('loadErrorDiv');
  if (prev) prev.remove();

  console.log('[frontend] fetching /api/medicines ...');
  return fetch('/api/medicines', { cache: 'no-store' })
    .then(async res => {
      console.log('[frontend] /api/medicines status:', res.status, res.statusText);
      if (!res.ok) {
        let body = '';
        try { body = await res.text(); } catch (e) { body = '<no body>'; }
        const msg = `Server returned ${res.status} ${res.statusText} — response: ${body}`;
        console.error(msg);
        showLoadError(msg);
        throw new Error(msg);
      }
      return res.json();
    })
    .then(data => {
      medicinesData = Array.isArray(data) ? data.map(normalizeMedicineFromServer) : [];
      console.log('[frontend] loaded medicines:', medicinesData.length);
      renderAppWithMedicines();
      return medicinesData;
    })
    .catch(err => {
      console.error('[frontend] fetchAndRenderMedicines error:', err);
      showLoadError('Unable to load medicines from server — check console for details. Error: ' + (err.message || err));
      // Resolve with current medicinesData (possibly empty) so callers can continue safely
      return medicinesData || [];
    });
}

// Normalize server medicine fields to client shape (expiry/date keys)
function normalizeMedicineFromServer(m) {
  return {
    id: m.id || m.ID || '',
    name: m.name || m.Name || '',
    category: m.category || '',
    strength: m.strength || '',
    manufacturer: m.manufacturer || '',
    batch: m.batch || '',
    quantity: Number(m.quantity || m.qty || 0),
    price: Number(m.price || 0),
    mrp: Number(m.mrp || 0),
    expiry: m.expiry || m.expiry_date || '',
    description: m.description || '',
    dateAdded: m.date_added || m.dateAdded || ''
  };
}


// ---------- Theme Customization ----------
function setTheme(themeName) {
  const theme = (themeName === 'light') ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', theme);
  try { localStorage.setItem('medivault_theme', theme); } catch (e) {}

  const themeSelect = document.getElementById('themeSelect');
  if (themeSelect) themeSelect.value = theme;

  const sidebarIcon = document.getElementById('sidebarThemeIcon');
  const sidebarText = document.getElementById('sidebarThemeText');
  const topIcon = document.getElementById('topThemeIcon');

  if (theme === 'light') {
    if (sidebarIcon) sidebarIcon.className = 'fas fa-sun';
    if (sidebarText) sidebarText.textContent = 'Light Theme';
    if (topIcon) topIcon.className = 'fas fa-moon';
  } else {
    if (sidebarIcon) sidebarIcon.className = 'fas fa-moon';
    if (sidebarText) sidebarText.textContent = 'Dark Theme';
    if (topIcon) topIcon.className = 'fas fa-sun';
  }
}

function toggleTheme() {
  const currentTheme = document.documentElement.getAttribute('data-theme') || 'dark';
  const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
  setTheme(newTheme);
  showAlert(`Switched to ${newTheme.toUpperCase()} mode`, 'info');
}

// ---------- Page navigation ----------
function showPage(pageId) {
  if (pageId !== 'landing' && typeof isAuthenticated === 'function' && !isAuthenticated()) {
    showAlert('Portal authentication required. Please sign in.', 'warning');
    if (typeof openAuthModal === 'function') openAuthModal();
    showLandingPage();
    return;
  }

  document.querySelectorAll('.page').forEach(page => page.classList.remove('active'));
  document.querySelectorAll('.sidebar-nav-item, .header-nav-item').forEach(item => item.classList.remove('active'));
  
  const el = document.getElementById(pageId);
  if (el) el.classList.add('active');
  
  const nav = document.getElementById('nav-' + pageId);
  if (nav) nav.classList.add('active');

  const pageHeadings = {
    'dashboard': 'Dashboard Overview',
    'inventory': 'Inventory Management',
    'add-medicine': 'Add New Medicine',
    'bulk-upload': 'Bulk CSV Upload',
    'sales': 'Sales & Billing Terminal',
    'reports': 'Analytics & Reports',
    'settings': 'Settings & Customization',
    'users-page': 'Staff User Accounts',
    'audit-page': 'Security Audit Trail Logs'
  };

  const topTitle = document.getElementById('topHeaderTitle');
  if (topTitle) topTitle.textContent = pageHeadings[pageId] || 'MediVault';

  const pageNames = {
    'dashboard': 'Dashboard - MediVault',
    'inventory': 'Inventory Management - MediVault',
    'add-medicine': 'Add Medicine - MediVault',
    'bulk-upload': 'Bulk Upload - MediVault',
    'sales': 'Sales Management - MediVault',
    'reports': 'Reports - MediVault',
    'settings': 'Settings - MediVault',
    'users-page': 'User Accounts - MediVault',
    'audit-page': 'Audit Trail Logs - MediVault'
  };

  document.title = pageNames[pageId] || 'MediVault';
  window.scrollTo({ top: 0, behavior: 'smooth' });

  if (pageId === 'users-page' && typeof loadUserAccounts === 'function') {
    loadUserAccounts();
  } else if (pageId === 'audit-page' && typeof loadAuditLogs === 'function') {
    loadAuditLogs();
  }
}

function showLandingPage() {
  document.querySelectorAll('.page').forEach(page => page.classList.remove('active'));
  document.querySelectorAll('.sidebar-nav-item').forEach(item => item.classList.remove('active'));
  const landing = document.getElementById('landing');
  if (landing) landing.classList.add('active');
  const nav = document.getElementById('nav-landing');
  if (nav) nav.classList.add('active');

  const topTitle = document.getElementById('topHeaderTitle');
  if (topTitle) topTitle.textContent = 'MediVault Healthcare Platform';
  document.title = 'MediVault - Intelligent Healthcare Platform';
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ---------- Direct Stat Card Detail Pop-up Modal ----------
function showStatDetailModal(type) {
  const modal = document.getElementById('statDetailModal');
  const titleEl = document.getElementById('statModalTitle');
  const headEl = document.getElementById('statDetailHead');
  const bodyEl = document.getElementById('statDetailBody');

  if (!modal || !headEl || !bodyEl) return;

  headEl.innerHTML = '';
  bodyEl.innerHTML = '';

  const threshold = Number(systemSettings.lowStockThreshold) || 10;
  const alertDays = Number(systemSettings.expiryAlertDays) || 30;
  const todayStr = getLocalDateString();
  const today = new Date();

  if (type === 'total') {
    if (titleEl) titleEl.innerHTML = `<i class="fas fa-pills" style="color: var(--primary);"></i> Total Medicines Breakdown (${medicinesData.length} Items)`;
    headEl.innerHTML = `<tr><th>ID</th><th>Medicine Name</th><th>Category</th><th>Stock</th><th>Price</th><th>Expiry</th><th>Actions</th></tr>`;

    (medicinesData || []).forEach(m => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><code style="color: var(--primary); font-family: monospace;">${escapeHtml(m.id)}</code></td>
        <td style="font-weight: 600;">${escapeHtml(m.name)}</td>
        <td>${escapeHtml(m.category)}</td>
        <td style="font-weight: 700;">${m.quantity}</td>
        <td style="color: #34D399; font-weight: 700;">₹${Number(m.price || 0).toFixed(2)}</td>
        <td>${escapeHtml(m.expiry || 'N/A')}</td>
        <td><button class="btn btn-sm btn-secondary" onclick="closeStatDetailModal(); editMedicine('${m.id}')"><i class="fas fa-pen-to-square"></i> Edit</button></td>
      `;
      bodyEl.appendChild(tr);
    });

  } else if (type === 'lowstock') {
    const lowStockItems = (medicinesData || []).filter(m => Number(m.quantity || 0) <= threshold);
    if (titleEl) titleEl.innerHTML = `<i class="fas fa-triangle-exclamation" style="color: var(--warning);"></i> Low Stock Alert Items (${lowStockItems.length} Items ≤ ${threshold})`;
    headEl.innerHTML = `<tr><th>ID</th><th>Medicine Name</th><th>Category</th><th>Current Stock</th><th>Price</th><th>Expiry</th><th>Actions</th></tr>`;

    if (lowStockItems.length === 0) {
      bodyEl.innerHTML = `<tr><td colspan="7" style="text-align:center; padding: 2rem; color: var(--text-muted);">No low stock medicines recorded! All stock levels healthy.</td></tr>`;
    } else {
      lowStockItems.forEach(m => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td><code style="color: var(--warning); font-family: monospace;">${escapeHtml(m.id)}</code></td>
          <td style="font-weight: 600;">${escapeHtml(m.name)}</td>
          <td>${escapeHtml(m.category)}</td>
          <td><span class="badge badge-warning"><i class="fas fa-exclamation-triangle"></i> ${m.quantity} in stock</span></td>
          <td style="color: #34D399; font-weight: 700;">₹${Number(m.price || 0).toFixed(2)}</td>
          <td>${escapeHtml(m.expiry || 'N/A')}</td>
          <td><button class="btn btn-sm btn-secondary" onclick="closeStatDetailModal(); editMedicine('${m.id}')"><i class="fas fa-plus"></i> Restock</button></td>
        `;
        bodyEl.appendChild(tr);
      });
    }

  } else if (type === 'expiry') {
    const expiringItems = (medicinesData || []).filter(m => {
      if (!m.expiry) return false;
      const expiryDate = new Date(m.expiry);
      const daysToExpiry = Math.ceil((expiryDate - today) / (1000 * 60 * 60 * 24));
      return daysToExpiry <= alertDays;
    });

    if (titleEl) titleEl.innerHTML = `<i class="fas fa-calendar-xmark" style="color: var(--danger);"></i> Near Expiry Items (${expiringItems.length} Expiring in ≤ ${alertDays} Days)`;
    headEl.innerHTML = `<tr><th>ID</th><th>Medicine Name</th><th>Batch</th><th>Stock</th><th>Expiry Date</th><th>Status</th><th>Actions</th></tr>`;

    if (expiringItems.length === 0) {
      bodyEl.innerHTML = `<tr><td colspan="7" style="text-align:center; padding: 2rem; color: var(--text-muted);">No medicines nearing expiry date threshold!</td></tr>`;
    } else {
      expiringItems.forEach(m => {
        const expiryDate = new Date(m.expiry);
        const daysToExpiry = Math.ceil((expiryDate - today) / (1000 * 60 * 60 * 24));
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td><code style="color: var(--danger); font-family: monospace;">${escapeHtml(m.id)}</code></td>
          <td style="font-weight: 600;">${escapeHtml(m.name)}</td>
          <td>${escapeHtml(m.batch || 'N/A')}</td>
          <td>${m.quantity}</td>
          <td style="color: #F87171; font-weight: 700;">${escapeHtml(m.expiry)}</td>
          <td><span class="badge badge-danger"><i class="fas fa-clock"></i> ${daysToExpiry <= 0 ? 'Expired' : `${daysToExpiry} Days Left`}</span></td>
          <td><button class="btn btn-sm btn-danger" onclick="closeStatDetailModal(); deleteMedicine('${m.id}')"><i class="fas fa-trash-can"></i> Remove</button></td>
        `;
        bodyEl.appendChild(tr);
      });
    }

  } else if (type === 'todaysales') {
    const todaySalesData = (salesData || []).filter(s => String(s.date || '').split('T')[0] === todayStr);
    const totalRev = todaySalesData.reduce((sum, s) => sum + Number(s.total || 0), 0);

    if (titleEl) titleEl.innerHTML = `<i class="fas fa-indian-rupee-sign" style="color: var(--primary);"></i> Today's Sales Breakdown (₹${totalRev.toFixed(2)} — ${todaySalesData.length} Orders)`;
    headEl.innerHTML = `<tr><th>Invoice ID</th><th>Customer</th><th>Payment Method</th><th>Items Count</th><th>Total</th><th>Actions</th></tr>`;

    if (todaySalesData.length === 0) {
      bodyEl.innerHTML = `<tr><td colspan="6" style="text-align:center; padding: 2rem; color: var(--text-muted);">No sales recorded today yet. Use the Sales Terminal to process orders.</td></tr>`;
    } else {
      todaySalesData.forEach(s => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td><code style="color: var(--primary); font-family: monospace;">${escapeHtml(s.id)}</code></td>
          <td style="font-weight: 600;">${escapeHtml(s.customer_name || 'Walk-in Customer')}</td>
          <td><span class="badge badge-info"><i class="fas fa-credit-card"></i> ${escapeHtml(s.payment_method || 'Cash')}</span></td>
          <td>${s.number_of_medicines || (s.items ? s.items.length : 0)} items</td>
          <td style="color: #34D399; font-weight: 700;">₹${Number(s.total || 0).toFixed(2)}</td>
          <td><button class="btn btn-sm btn-secondary" onclick="closeStatDetailModal(); printSaleInvoice('${s.id}')"><i class="fas fa-print"></i> Print</button></td>
        `;
        bodyEl.appendChild(tr);
      });
    }
  }

  modal.style.display = 'flex';
}

function closeStatDetailModal() {
  const modal = document.getElementById('statDetailModal');
  if (modal) modal.style.display = 'none';
}

// ---------- User Management & Audit Logs (Admin) ----------
function loadUserAccounts() {
  const tbody = document.getElementById('usersTableBody');
  if (!tbody) return;
  tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;">Loading users...</td></tr>';

  const headers = typeof getAuthHeaders === 'function' ? getAuthHeaders() : {};

  fetch('/api/auth/users', { headers })
    .then(r => r.json())
    .then(users => {
      tbody.innerHTML = '';
      if (!Array.isArray(users) || users.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;">No staff user accounts found.</td></tr>';
        return;
      }
      users.forEach(u => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td><code style="color: var(--primary); font-family: monospace;">${escapeHtml(u.id)}</code></td>
          <td style="font-weight:600;">${escapeHtml(u.name)}</td>
          <td>${escapeHtml(u.email)}</td>
          <td><span class="badge badge-info">${escapeHtml(u.role)}</span></td>
          <td><span class="badge ${u.status === 'Active' ? 'badge-success' : 'badge-danger'}">${escapeHtml(u.status)}</span></td>
          <td style="color: var(--text-muted); font-size: 0.85rem;">${escapeHtml(String(u.created_at || '').split('T')[0])}</td>
        `;
        tbody.appendChild(tr);
      });
    })
    .catch(err => {
      console.error('loadUserAccounts error:', err);
      tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; color: var(--danger);">Admin permissions required to view users.</td></tr>';
    });
}

function handleCreateUserSubmit(e) {
  if (e) e.preventDefault();
  const name = document.getElementById('newUserName')?.value;
  const email = document.getElementById('newUserEmail')?.value;
  const password = document.getElementById('newUserPassword')?.value;
  const role = document.getElementById('newUserRole')?.value || 'Pharmacist';

  if (!name || !email || !password) return showAlert('All user fields required', 'warning');

  const headers = typeof getAuthHeaders === 'function' ? getAuthHeaders() : {};

  fetch('/api/auth/users', {
    method: 'POST',
    headers: Object.assign({ 'Content-Type': 'application/json' }, headers),
    body: JSON.stringify({ name, email, password, role })
  })
    .then(r => r.json())
    .then(resp => {
      if (resp && resp.id) {
        showAlert(`Created ${resp.role} account for ${resp.name}`, 'success');
        document.getElementById('createUserForm')?.reset();
        loadUserAccounts();
      } else {
        showAlert('Create user failed: ' + (resp.error || 'Server error'), 'error');
      }
    })
    .catch(err => {
      showAlert('Failed to create user account', 'error');
    });
}

function loadAuditLogs() {
  const tbody = document.getElementById('auditLogsBody');
  if (!tbody) return;
  tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">Loading audit history...</td></tr>';

  const headers = typeof getAuthHeaders === 'function' ? getAuthHeaders() : {};

  fetch('/api/audit-logs', { headers })
    .then(r => r.json())
    .then(logs => {
      tbody.innerHTML = '';
      if (!Array.isArray(logs) || logs.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">No audit log records recorded yet.</td></tr>';
        return;
      }
      logs.forEach(l => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td>#${l.id}</td>
          <td style="font-weight:600;">${escapeHtml(l.user_name || l.user_id || 'System')}</td>
          <td><span class="badge badge-success">${escapeHtml(l.action)}</span></td>
          <td style="font-size:0.85rem;">${escapeHtml(l.details)}</td>
          <td style="color: var(--text-muted); font-size:0.8rem;">${new Date(l.created_at).toLocaleString()}</td>
        `;
        tbody.appendChild(tr);
      });
    })
    .catch(err => {
      console.error('loadAuditLogs error:', err);
      tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; color: var(--danger);">Admin authorization required to view audit logs.</td></tr>';
    });
}

// ---------- Add / Edit Medicine (persists to backend) ----------
document.getElementById('addMedicineForm').addEventListener('submit', function (e) {
  e.preventDefault();

  const payload = {
    name: document.getElementById('medicineName').value,
    category: document.getElementById('medicineCategory').value,
    strength: document.getElementById('medicineStrength').value,
    manufacturer: document.getElementById('medicineManufacturer').value,
    batch: document.getElementById('medicineBatch').value,
    quantity: Number(document.getElementById('medicineQuantity').value) || 0,
    price: Number(document.getElementById('medicinePrice').value) || 0,
    mrp: Number(document.getElementById('medicineMRP').value) || 0,
    expiry: document.getElementById('medicineExpiry').value,
    description: document.getElementById('medicineDescription').value,
    date_added: getLocalDateString()
  };

  if (currentEditId) {
    fetch(`/api/medicines/${currentEditId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
      .then(r => r.json())
      .then(updated => {
        showAlert('Medicine updated successfully!', 'success');
        currentEditId = null;
        this.reset();
        fetchAndRenderMedicines();
        showPage('inventory');
      })
      .catch(err => {
        console.error('Update failed', err);
        showAlert('Failed to update medicine', 'error');
      });
  } else {
    fetch('/api/medicines', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
      .then(r => r.json())
      .then(created => {
        showAlert('Medicine added successfully!', 'success');
        this.reset();
        fetchAndRenderMedicines();
        showPage('inventory');
      })
      .catch(err => {
        console.error('Create medicine failed', err);
        showAlert('Failed to add medicine', 'error');
      });
  }
});


// ---------- CSV Upload: use server endpoint ----------
function uploadCsvFile(file) {
  if (!file) return;
  const fd = new FormData();
  fd.append('file', file);

  showAlert('Uploading CSV to server...', 'warning');

  fetch('/api/medicines/upload-csv', {
    method: 'POST',
    body: fd
  })
    .then(res => res.json())
    .then(resp => {
      if (resp && resp.ok) {
        showAlert(`CSV uploaded: ${resp.inserted || 0} rows inserted`, 'success');
        fetchAndRenderMedicines();
      } else {
        console.error('CSV upload response', resp);
        showAlert('CSV upload failed: ' + (resp.error || JSON.stringify(resp)), 'error');
      }
    })
    .catch(err => {
      console.error('CSV upload error', err);
      showAlert('CSV upload failed. See console.', 'error');
    });
}

function handleFileUpload() {
  const fileInput = document.getElementById('fileInput');
  const file = fileInput.files[0];
  if (!file) return;
  uploadCsvFile(file);
  fileInput.value = '';
}

// Download Bulk Upload CSV Template
function downloadTemplate() {
  const csvContent = `id,name,category,strength,manufacturer,batch,quantity,price,mrp,expiry_date,description
MED001,Paracetamol,tablet,500mg,Cipla,B001,100,10.50,15.00,2027-12-31,Pain reliever
MED002,Amoxicillin,tablet,250mg,Sun Pharma,B002,50,25.00,40.00,2026-11-20,Antibiotic
MED003,Cough Syrup,syrup,100ml,Dabur,B003,40,65.00,80.00,2027-05-15,Cough relief
`;
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'medicines_bulk_upload_template.csv';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showAlert('Sample template downloaded successfully!', 'success');
}

// ---------- Inventory rendering ----------
function updateInventoryTable() {
  const tbody = document.querySelector('#inventoryTable tbody');
  if (!tbody) return;
  tbody.innerHTML = '';

  medicinesData.forEach(medicine => {
    const row = document.createElement('tr');
    const status = getStockStatus(medicine);

    row.innerHTML = `
      <td><code style="color: var(--primary); font-family: monospace; font-weight: 600;">${escapeHtml(medicine.id)}</code></td>
      <td style="font-weight: 600; color: var(--text-main);">${escapeHtml(medicine.name)}</td>
      <td><span style="text-transform: capitalize; color: var(--text-muted);">${escapeHtml(medicine.category)}</span></td>
      <td style="font-weight: 700;">${medicine.quantity}</td>
      <td style="color: #34D399; font-weight: 700;">₹${Number(medicine.price || 0).toFixed(2)}</td>
      <td style="color: var(--text-muted);">${escapeHtml(medicine.expiry || 'N/A')}</td>
      <td><span class="${status.badgeClass}"><i class="fas ${status.icon}"></i> ${status.text}</span></td>
      <td>
        <div style="display: flex; gap: 0.4rem;">
          <button class="btn btn-sm btn-secondary" onclick="editMedicine('${medicine.id}')" title="Edit Medicine"><i class="fas fa-pen-to-square"></i> Edit</button>
          <button class="btn btn-sm btn-danger" onclick="deleteMedicine('${medicine.id}')" title="Delete Medicine"><i class="fas fa-trash-can"></i> Delete</button>
        </div>
      </td>
    `;
    tbody.appendChild(row);
  });
}

// ---------- Utility functions ----------
function getStockStatus(medicine) {
  const today = new Date();
  const expiryDate = medicine.expiry ? new Date(medicine.expiry) : null;
  let daysToExpiry = 36500;
  if (expiryDate && !isNaN(expiryDate)) {
    daysToExpiry = Math.ceil((expiryDate - today) / (1000 * 60 * 60 * 24));
  }

  const threshold = Number(systemSettings.lowStockThreshold) || 10;
  const alertDays = Number(systemSettings.expiryAlertDays) || 30;

  if (medicine.quantity <= threshold) {
    return { text: 'Low Stock', badgeClass: 'badge badge-warning', icon: 'fa-triangle-exclamation' };
  } else if (daysToExpiry <= alertDays) {
    return { text: 'Near Expiry', badgeClass: 'badge badge-danger', icon: 'fa-calendar-xmark' };
  } else {
    return { text: 'In Stock', badgeClass: 'badge badge-success', icon: 'fa-circle-check' };
  }
}

function editMedicine(medicineId) {
  const medicine = medicinesData.find(m => m.id === medicineId);
  if (!medicine) {
    fetch(`/api/medicines/${medicineId}`).then(r => r.json()).then(m => {
      if (!m) return showAlert('Medicine not found', 'error');
      fillMedicineForm(m);
    }).catch(() => showAlert('Failed to load medicine', 'error'));
    return;
  }
  fillMedicineForm(medicine);
}

function fillMedicineForm(med) {
  if (!med) return;
  currentEditId = med.id || med;
  const m = medicinesData.find(x => x.id === currentEditId) || med;
  document.getElementById('medicineName').value = m.name || '';
  document.getElementById('medicineCategory').value = m.category || '';
  document.getElementById('medicineStrength').value = m.strength || '';
  document.getElementById('medicineManufacturer').value = m.manufacturer || '';
  document.getElementById('medicineBatch').value = m.batch || '';
  document.getElementById('medicineQuantity').value = m.quantity || 0;
  document.getElementById('medicinePrice').value = m.price || 0;
  document.getElementById('medicineMRP').value = m.mrp || 0;
  document.getElementById('medicineExpiry').value = m.expiry || '';
  document.getElementById('medicineDescription').value = m.description || '';
  showPage('add-medicine');
  showAlert('Editing medicine: ' + (m.name || m.id), 'warning');
}

function deleteMedicine(medicineId) {
  if (!confirm('Are you sure you want to delete this medicine?')) return;
  fetch(`/api/medicines/${medicineId}`, { method: 'DELETE' })
    .then(r => r.json())
    .then(() => {
      showAlert('Medicine deleted successfully!', 'success');
      fetchAndRenderMedicines();
    })
    .catch(err => {
      console.error('Delete failed', err);
      showAlert('Failed to delete medicine', 'error');
    });
}

// ---------- Dashboard / stats ----------
function updateDashboardStats() {
  const totalMedicinesEl = document.getElementById('totalMedicines');
  if (totalMedicinesEl) totalMedicinesEl.textContent = medicinesData.length.toLocaleString();

  const threshold = Number(systemSettings.lowStockThreshold) || 10;
  const expiryDays = Number(systemSettings.expiryAlertDays) || 30;

  const lowStock = medicinesData.filter(m => Number(m.quantity || 0) <= threshold).length;
  const lowStockEl = document.getElementById('lowStock');
  if (lowStockEl) lowStockEl.textContent = lowStock;

  const lowStockEl2 = document.getElementById('lowStock2');
  if (lowStockEl2) lowStockEl2.textContent = lowStock;

  const today = new Date();
  const nearExpiry = medicinesData.filter(m => {
    if (!m.expiry) return false;
    const expiryDate = new Date(m.expiry);
    const daysToExpiry = Math.ceil((expiryDate - today) / (1000 * 60 * 60 * 24));
    return daysToExpiry <= expiryDays;
  }).length;

  const nearExpiryEl = document.getElementById('nearExpiry');
  if (nearExpiryEl) nearExpiryEl.textContent = nearExpiry;

  const nearExpiryEl2 = document.getElementById('nearExpiry2');
  if (nearExpiryEl2) nearExpiryEl2.textContent = nearExpiry;

  const todayStr = getLocalDateString();
  const todaySales = (salesData || [])
    .filter(s => String(s.date || '').split('T')[0] === todayStr)
    .reduce((total, sale) => total + Number(sale.total || 0), 0);

  const todaySalesEl = document.getElementById('todaySales');
  if (todaySalesEl) todaySalesEl.textContent = '₹' + todaySales.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 });

  const todaySalesEl2 = document.getElementById('todaySales2');
  if (todaySalesEl2) todaySalesEl2.textContent = '₹' + todaySales.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

// ---------- Search / Filter ----------
function filterInventory() {
  const searchTerm = (document.getElementById('searchInput')?.value || '').toLowerCase();
  const categoryFilter = (document.getElementById('categoryFilter')?.value || '').toLowerCase();
  const rows = document.querySelectorAll('#inventoryTable tbody tr');

  rows.forEach(row => {
    const name = row.cells[1].textContent.toLowerCase();
    const category = row.cells[2].textContent.toLowerCase();
    const matchesSearch = name.includes(searchTerm);
    const matchesCategory = !categoryFilter || category === categoryFilter;
    row.style.display = (matchesSearch && matchesCategory) ? '' : 'none';
  });
}

// ---------- Export inventory ----------
function exportInventory() {
  const headers = ['ID', 'Name', 'Category', 'Stock', 'Price', 'Expiry', 'Status'];
  let csvContent = headers.join(',') + '\n';
  medicinesData.forEach(m => {
    const status = getStockStatus(m);
    const row = [m.id, m.name, m.category, m.quantity, m.price, m.expiry, status.text];
    csvContent += row.join(',') + '\n';
  });
  const blob = new Blob([csvContent], { type: 'text/csv' });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'inventory_export_' + new Date().toISOString().split('T')[0] + '.csv';
  a.click();
  window.URL.revokeObjectURL(url);
}

// ---------- Sales helpers ----------
function addSaleItem() {
  const saleItemsDiv = document.getElementById('saleItems');
  if (!saleItemsDiv) return;
  const newItemDiv = document.createElement('div');
  newItemDiv.className = 'form-group';
  newItemDiv.innerHTML = `
    <div style="display: flex; gap: 1rem; align-items: center;">
      <select style="flex: 2;" class="sale-medicine">
        <option value="">Select Medicine</option>
        ${medicinesData.map(m => `<option value="${m.id}">${m.name} - ₹${m.price}</option>`).join('')}
      </select>
      <input type="number" placeholder="Qty" style="flex: 1;" min="1" class="sale-quantity">
      <button type="button" class="btn" style="background: #f44336; padding: 0.5rem;" onclick="removeSaleItem(this)">Remove</button>
    </div>
  `;
  saleItemsDiv.appendChild(newItemDiv);
}

function fillMedicineOptions(selectEl) {
  if (!selectEl) return;

  selectEl.innerHTML = `
    <option value="">Select Medicine</option>
    ${medicinesData.map(m => 
      `<option value="${m.id}">${m.name} - ₹${m.price}</option>`
    ).join('')}
  `;
}

function removeSaleItem(button) { button.closest('.form-group').remove(); }

function getSaleItems() {
  const items = [];
  const medicineSelects = document.querySelectorAll('.sale-medicine');
  const quantityInputs = document.querySelectorAll('.sale-quantity');

  medicineSelects.forEach((select, index) => {
    const qtyEl = quantityInputs[index];
    if (select.value && qtyEl && qtyEl.value) {
      const medicine = medicinesData.find(m => String(m.id) === String(select.value));
      items.push({
        medicineId: select.value,
        medicineName: medicine ? medicine.name : select.options[select.selectedIndex].text,
        quantity: Number(qtyEl.value),
        price: medicine ? Number(medicine.price || 0) : 0
      });
    }
  });
  return items;
}

function calculateSaleTotal() {
  const items = getSaleItems();
  return items.reduce((total, item) => total + (Number(item.quantity || 0) * Number(item.price || 0)), 0);
}

// ----Reports: preview modal + download (REPLACED) ----------

function escapeHtml(s) {
  return String(s || '').replace(/[&<>"']/g, function (m) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[m]; });
}

function createReportHTML(data, title) {
  const columns = Object.keys(data[0] || {});
  const headerHtml = columns.map(c => '<th>' + escapeHtml(c) + '</th>').join('');
  const rowsHtml = (data || []).map(item => {
    const cols = columns.map(k => '<td>' + escapeHtml(item[k]) + '</td>').join('');
    return '<tr>' + cols + '</tr>';
  }).join('');
  return `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title><style>body{font-family:Arial,Helvetica,sans-serif;color:#222;padding:20px}h1{color:#333}table{border-collapse:collapse;width:100%;margin-top:12px}th,td{border:1px solid #ddd;padding:8px;text-align:left;font-size:14px}th{background:#667eea;color:#fff;position:sticky;top:0}tbody tr:nth-child(even){background:#f9f9f9}</style></head><body><h1>${escapeHtml(title)}</h1><p>Generated on: ${new Date().toLocaleString()}</p><table><thead><tr>${headerHtml}</tr></thead><tbody>${rowsHtml}</tbody></table></body></html>`;
}

// /**
//  * Show report preview modal and enable download
//  * type: 'inventory' | 'sales' | 'expiry' | 'lowstock'
//  */
// function generateReport(type) {
//   let reportData = [];
//   let reportTitle = '';

//   switch (type) {
//     case 'inventory':
//       reportData = medicinesData;
//       reportTitle = 'Inventory Report';
//       break;
//     case 'sales':
//       reportData = salesData;
//       reportTitle = 'Sales Report';
//       break;
//     case 'expiry': {
//       const today = new Date();
//       reportData = medicinesData.filter(m => {
//         const expiryDate = new Date(m.expiry);
//         const daysToExpiry = Math.ceil((expiryDate - today) / (1000 * 60 * 60 * 24));
//         return daysToExpiry <= 30;
//       });
//       reportTitle = 'Medicines Expiring Soon';
//       break;
//     }
//     case 'lowstock':
//       reportData = medicinesData.filter(m => m.quantity <= 10);
//       reportTitle = 'Low Stock Report';
//       break;
//     default:
//       reportData = medicinesData;
//       reportTitle = 'Custom Report';
//   }

//   if (!reportData || reportData.length === 0) {
//     showAlert('No data available for this report', 'warning');
//     return;
//   }

//   const html = createReportHTML(reportData, reportTitle);
//   const blob = new Blob([html], { type: 'text/html' });
//   const url = URL.createObjectURL(blob);

//   const modal = document.getElementById('reportPreviewModal');
//   const frame = document.getElementById('reportPreviewFrame');
//   const downloadBtn = document.getElementById('downloadReportBtn');

//   frame.src = url;
//   modal.style.display = 'flex';
//   modal.setAttribute('aria-hidden', 'false');
//   modal._blobUrl = url;

//   downloadBtn.onclick = () => {
//     const filename = `${type}_report_${new Date().toISOString().split('T')[0]}.html`;
//     const a = document.createElement('a');
//     a.href = url;
//     a.download = filename;
//     document.body.appendChild(a);
//     a.click();
//     a.remove();
//   };
// }

// function closeReportPreview() {
//   const modal = document.getElementById('reportPreviewModal');
//   if (!modal) return;
//   const frame = document.getElementById('reportPreviewFrame');
//   if (frame) frame.src = 'about:blank';
//   const url = modal._blobUrl;
//   try { if (url) URL.revokeObjectURL(url); } catch (e) { }
//   modal._blobUrl = null;
//   modal.style.display = 'none';
//   modal.setAttribute('aria-hidden', 'true');
// }


// ---- Reports PDF Generation & Preview ----------

function downloadReportPDF(reportData, reportTitle, filename) {
  const container = document.createElement('div');
  container.style.padding = '20px';
  container.style.fontFamily = 'Arial, sans-serif';
  container.style.color = '#222';
  container.style.background = '#ffffff';

  const bName = businessSettings.businessName || 'MediVault';
  const bAddr = businessSettings.businessAddress || '';
  const bPhone = businessSettings.businessPhone || '';

  let headerHtml = `
    <div style="text-align: center; margin-bottom: 20px; border-bottom: 2px solid #667eea; padding-bottom: 10px;">
      <h1 style="margin: 0 0 4px 0; color: #1a1a2e; font-size: 22px;">${escapeHtml(bName)}</h1>
      ${bAddr ? `<p style="margin: 2px 0; font-size: 12px; color: #555;">${escapeHtml(bAddr)} | Tel: ${escapeHtml(bPhone)}</p>` : ''}
      <h2 style="margin: 10px 0 4px 0; color: #667eea; font-size: 18px;">${escapeHtml(reportTitle)}</h2>
      <p style="margin: 0; font-size: 11px; color: #777;">Generated Date: ${new Date().toLocaleString()}</p>
    </div>
  `;

  let tableHtml = '';
  if (Array.isArray(reportData) && reportData.length > 0) {
    const rawCols = Object.keys(reportData[0] || {}).filter(k => k !== 'ts');
    const ths = rawCols.map(c => `<th style="background:#667eea;color:#fff;padding:8px 10px;border:1px solid #ddd;font-size:12px;text-align:left;">${escapeHtml(c.replace(/_/g, ' ').toUpperCase())}</th>`).join('');
    const trs = reportData.map(item => {
      const tds = rawCols.map(k => `<td style="padding:6px 10px;border:1px solid #ddd;font-size:11px;">${escapeHtml(typeof item[k] === 'object' ? JSON.stringify(item[k]) : item[k])}</td>`).join('');
      return `<tr>${tds}</tr>`;
    }).join('');
    tableHtml = `<table style="width:100%;border-collapse:collapse;margin-top:10px;"><thead><tr>${ths}</tr></thead><tbody>${trs}</tbody></table>`;
  } else {
    tableHtml = '<p style="text-align:center;padding:20px;color:#666;">No records found for this report.</p>';
  }

  container.innerHTML = headerHtml + tableHtml;
  document.body.appendChild(container);

  const outFilename = filename || `${reportTitle.toLowerCase().replace(/\s+/g, '_')}_${getLocalDateString()}.pdf`;

  if (typeof html2pdf !== 'undefined') {
    const opt = {
      margin:       0.4,
      filename:     outFilename,
      image:        { type: 'jpeg', quality: 0.98 },
      html2canvas:  { scale: 2, logging: false },
      jsPDF:        { unit: 'in', format: 'letter', orientation: 'portrait' }
    };
    html2pdf().set(opt).from(container).save().then(() => {
      document.body.removeChild(container);
      showAlert('Report PDF downloaded successfully!', 'success');
    }).catch(err => {
      console.error('html2pdf error:', err);
      document.body.removeChild(container);
      showAlert('PDF downloaded.', 'success');
    });
  } else {
    // Fallback: browser print dialog
    const win = window.open('', '_blank');
    if (win) {
      win.document.write(`<!doctype html><html><head><title>${escapeHtml(reportTitle)}</title></head><body>${container.innerHTML}</body></html>`);
      win.document.close();
      win.focus();
      win.print();
    }
    document.body.removeChild(container);
  }
}

// Ensure report preview modal exists; create it if missing
function ensureReportModalExists() {
  let modal = document.getElementById('reportPreviewModal');
  if (modal) return modal;

  modal = document.createElement('div');
  modal.id = 'reportPreviewModal';
  modal.setAttribute('aria-hidden', 'true');
  modal.style.cssText = 'position:fixed;inset:0;display:none;align-items:center;justify-content:center;background:rgba(0,0,0,0.5);z-index:9999;padding:20px;';

  modal.innerHTML = `
    <div style="background:#fff;max-width:1100px;width:100%;max-height:90vh;overflow:auto;border-radius:8px;box-shadow:0 10px 30px rgba(0,0,0,0.25);">
      <div style="display:flex;justify-content:space-between;align-items:center;padding:12px 16px;border-bottom:1px solid #eee;">
        <strong id="reportPreviewTitle" style="color:#333;font-size:16px;">Report Preview</strong>
        <div>
          <button id="downloadReportBtn" class="btn" style="margin-right:8px"><i class="fas fa-file-pdf"></i> Download PDF</button>
          <button id="printReportBtn" class="btn" style="margin-right:8px"><i class="fas fa-print"></i> Print</button>
          <button id="closeReportBtn" class="btn"><i class="fas fa-times"></i> Close</button>
        </div>
      </div>
      <div style="padding:12px;">
        <iframe id="reportPreviewFrame" style="width:100%;height:70vh;border:1px solid #ddd"></iframe>
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  // wire up buttons
  document.getElementById('closeReportBtn').addEventListener('click', closeReportPreview);
  document.getElementById('printReportBtn').addEventListener('click', () => {
    const frame = document.getElementById('reportPreviewFrame');
    if (!frame) return;
    try {
      frame.contentWindow.focus();
      frame.contentWindow.print();
    } catch (e) {
      console.warn('Print via iframe failed, opening fallback window', e);
      const url = modal._blobUrl;
      if (url) window.open(url, '_blank');
    }
  });

  return modal;
}

// Generate report with custom date filtering & PDF option
function generateReport(type, fromDate, toDate) {
  try {
    let reportData = [];
    let reportTitle = '';

    const threshold = Number(systemSettings.lowStockThreshold) || 10;
    const expiryDays = Number(systemSettings.expiryAlertDays) || 30;

    switch (type) {
      case 'inventory':
        reportData = (medicinesData || []).slice();
        reportTitle = 'Inventory Report';
        if (fromDate && toDate) {
          reportData = reportData.filter(m => {
            const added = m.dateAdded || m.date_added || '';
            return !added || (added >= fromDate && added <= toDate);
          });
        }
        break;

      case 'sales':
        reportData = (salesData || []).slice();
        reportTitle = 'Sales Report';
        if (fromDate && toDate) {
          reportData = reportData.filter(s => {
            const d = String(s.date || '').split('T')[0];
            return d >= fromDate && d <= toDate;
          });
        }
        break;

      case 'expiry': {
        const today = new Date();
        reportData = (medicinesData || []).filter(m => {
          if (!m.expiry) return false;
          const expiryDate = new Date(m.expiry);
          const daysToExpiry = Math.ceil((expiryDate - today) / (1000 * 60 * 60 * 24));
          return daysToExpiry <= expiryDays;
        });
        reportTitle = 'Medicines Expiring Soon';
        if (fromDate && toDate) {
          reportData = reportData.filter(m => m.expiry >= fromDate && m.expiry <= toDate);
        }
        break;
      }

      case 'lowstock':
        reportData = (medicinesData || []).filter(m => Number(m.quantity || 0) <= threshold);
        reportTitle = 'Low Stock Report';
        break;

      default:
        reportData = (medicinesData || []).slice();
        reportTitle = 'Custom Report';
    }

    if (!reportData || reportData.length === 0) {
      showAlert('No data available for the selected report filters', 'warning');
      return;
    }

    const html = createReportHTML(reportData, reportTitle);
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);

    const modal = ensureReportModalExists();
    const frame = document.getElementById('reportPreviewFrame');
    const downloadBtn = document.getElementById('downloadReportBtn');
    const titleEl = document.getElementById('reportPreviewTitle');

    if (titleEl) titleEl.textContent = reportTitle + (fromDate && toDate ? ` (${fromDate} to ${toDate})` : '');
    if (frame) {
      try { frame.src = url; } catch (e) { window.open(url, '_blank'); }
    }

    modal._blobUrl = url;
    modal.style.display = 'flex';
    modal.setAttribute('aria-hidden', 'false');

    // PDF download button handler
    if (downloadBtn) {
      downloadBtn.onclick = () => {
        downloadReportPDF(reportData, reportTitle, `${type}_report_${getLocalDateString()}.pdf`);
      };
    }

  } catch (err) {
    console.error('generateReport unexpected error', err);
    showAlert('Failed to generate report: ' + (err.message || err), 'error');
  }
}

// Close & cleanup modal
function closeReportPreview() {
  const modal = document.getElementById('reportPreviewModal');
  if (!modal) return;
  const frame = document.getElementById('reportPreviewFrame');
  if (frame) try { frame.src = 'about:blank'; } catch(e){}

  const url = modal._blobUrl;
  try { if (url) URL.revokeObjectURL(url); } catch (e) {}
  modal._blobUrl = null;
  modal.style.display = 'none';
  modal.setAttribute('aria-hidden', 'true');
}


// ---------- Sales fetching and rendering ----------

function normalizeSaleRow(s) {
  const sale = Object.assign({}, s || {});

  // Normalize date to YYYY-MM-DD (strip time if present)
  if (!sale.date) sale.date = new Date().toISOString().split('T')[0];
  else if (String(sale.date).includes('T')) sale.date = String(sale.date).split('T')[0];
  else sale.date = String(sale.date);

  // timestamp for sorting
  sale.ts = (new Date(sale.date + 'T00:00:00')).getTime() || Date.now();

  // Ensure total is number
  sale.total = Number(sale.total || 0);

  // Normalize customer fields
  sale.customer_name = sale.customer_name || sale.customerName || sale.customer || '';
  sale.customer_phone = sale.customer_phone || sale.customerPhone || sale.phone || '';

  // If items is already present, keep it (and ensure structure)
  if (Array.isArray(sale.items) && sale.items.length > 0) {
    sale.number_of_medicines = sale.number_of_medicines || sale.items.length;
    // Try to standardize item keys (medicine_name, qty, price)
    sale.items = sale.items.map(it => ({
      medicine_name: it.medicine_name || it.medicineName || it.name || '',
      qty: Number(it.qty || it.quantity || 1),
      price: Number(it.price || it.unit_price || 0),
      subtotal: Number(it.subtotal || ( (it.qty||it.quantity||1) * (it.price||it.unit_price||0) ) || 0)
    }));
  } else {
    // If server returned aggregated medicine_names, construct items fallback
    if (sale.medicine_names && typeof sale.medicine_names === 'string') {
      const names = sale.medicine_names.split(',').map(x => x.trim()).filter(x => x.length > 0);
      sale.items = names.map(name => ({
        medicine_name: name,
        qty: 1,
        price: 0,
        subtotal: 0
      }));
      sale.number_of_medicines = sale.number_of_medicines || sale.items.length;
    } else {
      // No items info at all: ensure empty array and zero count
      sale.items = sale.items || [];
      sale.number_of_medicines = sale.number_of_medicines || (sale.items.length || 0);
    }
  }

  return sale;
}



/*function fetchAndRenderSales() {
  console.log('[frontend] fetching /api/sales ...');
  return fetch('/api/sales', { cache: 'no-store' })
    .then(async res => {
      if (!res.ok) {
        const body = await res.text().catch(() => '<no body>');
        throw new Error(`GET /api/sales failed: ${res.status} ${res.statusText} — ${body}`);
      }
      return res.json();
    })
    .then(data => {
      // server returns array of sales
      salesData = Array.isArray(data) ? data : [];

      // normalize date -> YYYY-MM-DD and compute timestamp for sorting
      salesData = salesData.map(s => {
        const obj = Object.assign({}, s);
        if (!obj.date) {
          obj.date = new Date().toISOString().split('T')[0];
        } else if (String(obj.date).includes('T')) {
          // truncate time portion
          try { obj.date = String(obj.date).split('T')[0]; } catch (e) { }
        } else {
          // already YYYY-MM-DD likely — keep as is
          obj.date = String(obj.date);
        }
        // compute numeric timestamp from date for robust sorting
        obj.ts = (new Date(obj.date + 'T00:00:00')).getTime() || Date.now();
        obj.total = Number(obj.total || 0);
        return obj;
      });

      updateDashboardStats();    // uses salesData
      updateSalesPageStats();
      populateRecentSalesTable();
      console.log('[frontend] loaded sales:', salesData.length);
      return salesData;
    })
    .catch(err => {
      console.error('[frontend] fetchAndRenderSales error:', err);
      showAlert('Unable to load sales from server — check console for details.', 'warning');
      salesData = salesData || [];
      updateDashboardStats();
      updateSalesPageStats();
      populateRecentSalesTable();
    });
}*/

function fetchAndRenderSales() {
  console.log('[frontend] fetching /api/sales ...');
  return fetch('/api/sales', { cache: 'no-store' })
    .then(async res => {
      if (!res.ok) {
        const body = await res.text().catch(() => '<no body>');
        throw new Error(`GET /api/sales failed: ${res.status} ${res.statusText} — ${body}`);
      }
      return res.json();
    })
    .then(data => {
      const raw = Array.isArray(data) ? data : [];
      salesData = raw.map(normalizeSaleRow);

      // update UI
      updateDashboardStats();
      updateSalesPageStats();
      populateRecentSalesTable();
      console.log('[frontend] loaded sales:', salesData.length);
      return salesData;
    })
    .catch(err => {
      console.error('[frontend] fetchAndRenderSales error:', err);
      showAlert('Unable to load sales from server — check console for details.', 'warning');
      salesData = salesData || [];
      updateDashboardStats();
      updateSalesPageStats();
      populateRecentSalesTable();
    });
}


//
// Update the stats shown in the Sales page (without changing HTML)
// - selects the four stat-card <h3> elements inside #sales (assumes same visual order)
//
function updateSalesPageStats() {
  try {
    const salesPage = document.getElementById('sales');
    if (!salesPage) return;
    const statH3s = salesPage.querySelectorAll('.stat-card h3');

    const todayStr = getLocalDateString();
    const todaySales = (salesData || [])
      .filter(s => String(s.date || '').split('T')[0] === todayStr)
      .reduce((sum, s) => sum + Number(s.total || 0), 0);

    const transactionsToday = (salesData || []).filter(s => String(s.date || '').split('T')[0] === todayStr).length;

    const uniqueCustomers = new Set(
      (salesData || [])
        .map(s => (s.customer_phone || s.customerPhone || s.customer_name || s.customerName || '').toString().trim())
        .filter(x => x.length > 0)
    ).size;

    const now = new Date();
    const thisMonthStr = `${String(now.getFullYear())}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const monthSales = (salesData || [])
      .filter(s => String(s.date || '').startsWith(thisMonthStr))
      .reduce((sum, s) => sum + Number(s.total || 0), 0);

    if (statH3s[0]) statH3s[0].textContent = '₹' + todaySales.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
    if (statH3s[1]) statH3s[1].textContent = transactionsToday.toString();
    if (statH3s[2]) statH3s[2].textContent = '₹' + monthSales.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
    if (statH3s[3]) statH3s[3].textContent = uniqueCustomers.toString();
  } catch (e) {
    console.error('updateSalesPageStats error', e);
  }
}

//
// Populate Recent Sales table on Sales page from salesData
//
/*function populateRecentSalesTable() {
  const salesTableBody = document.querySelector('#sales .table-container table tbody');
  if (!salesTableBody) {
    // try a fallback search for a table under #sales
    const tb = document.querySelector('#sales table tbody');
    if (!tb) return;
    tb.innerHTML = '';
  }
  const tbody = document.querySelector('#sales table tbody');
  if (!tbody) return;
  tbody.innerHTML = '';

  // Show most recent first
  const toShow = (salesData || []).slice().sort((a,b) => (b.ts || 0) - (a.ts || 0));

  toShow.forEach(sale => {
    const saleItemsCount = sale.items ? sale.items.length : 0;
    const tr = document.createElement('tr');
    const actions = `
      <button class="btn" style="padding:0.3rem 0.8rem;font-size:0.8rem;" onclick="viewSale('${sale.id}')">View</button>
      <button class="btn" style="padding:0.3rem 0.8rem;font-size:0.8rem;" onclick="printSaleInvoice('${sale.id}')">Print</button>
    `;
    tr.innerHTML = `
      <td>${escapeHtml(sale.id)}</td>
      <td>${escapeHtml(sale.date)}</td>
      <td>${escapeHtml(sale.customer_name || sale.customerName || '')}</td>
      <td>${saleItemsCount}</td>
      <td>₹${Number(sale.total || 0).toLocaleString()}</td>
      <td>${actions}</td>
    `;
    tbody.appendChild(tr);
  });
}*/

function populateRecentSalesTable() {
  const tbFallback = document.querySelector('#sales table tbody');
  if (!tbFallback) return;
  const tbody = tbFallback;
  tbody.innerHTML = '';

  // Sort by timestamp (newest first)
  const toShow = (salesData || []).slice().sort((a, b) => (b.ts || 0) - (a.ts || 0));

  toShow.forEach(sale => {
    const saleItemsCount = sale.number_of_medicines || (sale.items ? sale.items.length : 0);
    const tr = document.createElement('tr');
    const actions = `
      <div style="display: flex; gap: 0.4rem;">
        <button class="btn btn-sm btn-secondary" onclick="viewSale('${sale.id}')" title="View Sale Details"><i class="fas fa-eye"></i> View</button>
        <button class="btn btn-sm btn-secondary" onclick="printSaleInvoice('${sale.id}')" title="Print Invoice"><i class="fas fa-print"></i> Print</button>
      </div>
    `;
    tr.innerHTML = `
      <td><code style="color: var(--primary); font-family: monospace; font-weight: 600;">${escapeHtml(sale.id)}</code></td>
      <td style="color: var(--text-muted);">${escapeHtml(sale.date)}</td>
      <td style="font-weight: 600; color: var(--text-main);">${escapeHtml(sale.customer_name || 'Walk-in Customer')}</td>
      <td style="font-weight: 600;">${saleItemsCount} items</td>
      <td style="color: #34D399; font-weight: 700;">₹${Number(sale.total || 0).toFixed(2)}</td>
      <td>${actions}</td>
    `;
    tbody.appendChild(tr);
  });
}


//
// View sale details (open modal or alert) - lightweight viewer
//
/*function viewSale(saleId) {
  const sale = (salesData || []).find(s => s.id === saleId);
  if (!sale) return showAlert('Sale not found', 'warning');
  // simple popup with details
  const lines = [
    `Sale ID: ${sale.id}`,
    `Date: ${sale.date}`,
    `Customer: ${sale.customer_name || sale.customerName || ''}`,
    `Phone: ${sale.customer_phone || sale.customerPhone || ''}`,
    `Total: ₹${Number(sale.total || 0).toFixed(2)}`,
    'Items:'
  ];
  (sale.items || []).forEach(it => lines.push(` - ${it.medicine_name || it.medicineName || it.name || ''} x ${it.qty || it.quantity} @ ₹${Number(it.price || 0)}`));
  alert(lines.join('\n'));
}*/
function viewSale(saleId) {
  const sale = (salesData || []).find(s => String(s.id) === String(saleId));
  if (!sale) return showAlert('Sale not found', 'warning');

  const lines = [
    `Sale ID: ${sale.id}`,
    `Date: ${sale.date}`,
    `Customer: ${sale.customer_name || ''}`,
    `Phone: ${sale.customer_phone || ''}`,
    `Total: ₹${Number(sale.total || 0).toFixed(2)}`,
    `Number of medicines: ${sale.number_of_medicines || (sale.items ? sale.items.length : 0)}`,
    'Items:'
  ];

  if (sale.items && sale.items.length > 0) {
    (sale.items || []).forEach(it => {
      const name = it.medicine_name || it.medicineName || it.name || '';
      const qty = it.qty || it.quantity || 1;
      const price = Number(it.price || 0).toFixed(2);
      lines.push(` - ${name} x ${qty} @ ₹${price}`);
    });
  } else if (sale.medicine_names) {
    lines.push(' ' + sale.medicine_names);
  } else {
    lines.push(' No item details available.');
  }

  alert(lines.join('\n'));
}

//
// Generate a printable invoice window for a sale object
//
function generateInvoiceWindow(sale) {
  if (!sale) return;
  const companyName = document.getElementById('businessName')?.value || document.getElementById('businessName')?.textContent || 'MediVault';
  const itemsRows = (sale.items || []).map(it => `
    <tr>
      <td>${escapeHtml(it.medicine_name || it.medicineName || it.name || '')}</td>
      <td style="text-align:center">${escapeHtml(String(it.qty || it.quantity || ''))}</td>
      <td style="text-align:right">₹${Number(it.price || 0).toFixed(2)}</td>
      <td style="text-align:right">₹${Number(it.subtotal || ((it.qty || it.quantity || 0) * (it.price || 0))).toFixed(2)}</td>
    </tr>`).join('');

  const total = Number(sale.total || 0).toFixed(2);
  const html = `
  <!doctype html>
  <html>
    <head>
      <meta charset="utf-8">
      <title>Invoice - ${escapeHtml(sale.id)}</title>
      <style>
        body { font-family: Arial, Helvetica, sans-serif; color:#222; padding:20px; }
        h1 { margin:0 0 10px 0; }
        table { width:100%; border-collapse: collapse; margin-top: 10px; }
        th, td { border:1px solid #ddd; padding:8px; }
        th { background:#f4f4f4; }
        .right { text-align:right; }
      </style>
    </head>
    <body>
      <h1>${escapeHtml(companyName)}</h1>
      <p><strong>Invoice ID:</strong> ${escapeHtml(sale.id)}<br/>
         <strong>Date:</strong> ${escapeHtml(sale.date)}<br/>
         <strong>Customer Name:</strong> ${escapeHtml(sale.customer_name || sale.customerName || 'Walk-in Customer')}<br/>
         ${(sale.customer_phone || sale.customerPhone) ? `<strong>Phone Number:</strong> ${escapeHtml(sale.customer_phone || sale.customerPhone)}<br/>` : ''}
         <strong>Payment Method:</strong> ${escapeHtml(sale.payment_method || sale.paymentMethod || 'Cash')} ${sale.transaction_ref ? `(Ref: ${escapeHtml(sale.transaction_ref)})` : ''}<br/>
         <strong>Payment Status:</strong> <span style="color:#10b981; font-weight:600;">Completed ✓</span>
      </p>
      <table>
        <thead><tr><th>Item</th><th style="text-align:center">Qty</th><th style="text-align:right">Unit</th><th style="text-align:right">Subtotal</th></tr></thead>
        <tbody>
          ${itemsRows}
        </tbody>
        <tfoot>
          <tr><td colspan="3" class="right"><strong>Total Amount Owed / Paid</strong></td><td style="text-align:right"><strong>₹${total}</strong></td></tr>
        </tfoot>
      </table>
      <div style="margin-top:25px; border-top:1px dashed #cbd5e1; padding-top:15px; font-size:12px; color:#64748b; text-align:center;">
        <p style="font-weight:600; color:#1e293b; margin:0 0 4px 0;">Thank you for your purchase!</p>
        <span>GSTIN: ${escapeHtml(businessSettings.gstNumber || ownerPaymentConfig.gstin || '29ABCDE1234F1Z5')} | Drug Lic: ${escapeHtml(businessSettings.licenseNumber || 'DL-KA-2023-12345')}</span><br/>
        <span style="font-size:11px; color:#94a3b8; display:block; margin-top:4px;">This is a computer-generated tax invoice. No signature required.</span>
      </div>
    </body>
  </html>`;

  const w = window.open('', '_blank', 'width=800,height=900');
  if (!w) return showAlert('Popup blocked. Please allow popups to print invoice.', 'warning');
  w.document.open();
  w.document.write(html);
  w.document.close();
  // Give the popup a short time to render then call print.
  setTimeout(() => {
    try { w.focus(); w.print(); } catch (e) { console.warn('Print failed', e); }
  }, 500);
}

// System Data Backup Export & Database Reset
function exportSystemBackup() {
  const headers = typeof getAuthHeaders === 'function' ? getAuthHeaders() : {};
  showAlert('Generating system data backup...', 'info');

  fetch('/api/settings/backup', { headers })
    .then(res => {
      if (!res.ok) throw new Error('Backup failed or unauthorized');
      return res.blob();
    })
    .then(blob => {
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `medivault_backup_${getLocalDateString()}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      showAlert('Database backup exported successfully!', 'success');
    })
    .catch(err => {
      console.error('Backup export error:', err);
      showAlert('Failed to export backup. Admin role required.', 'error');
    });
}

function triggerRestoreBackup() {
  const inp = document.getElementById('restoreFileInput');
  if (inp) inp.click();
}

function handleRestoreFile(input) {
  const file = input.files ? input.files[0] : null;
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function (e) {
    try {
      const backupPayload = JSON.parse(e.target.result);
      if (!backupPayload || !backupPayload.data) {
        return showAlert('Invalid backup JSON format. Missing data structure.', 'error');
      }

      if (!confirm(`Confirm Database Restore: This will replace current records with ${backupPayload.data.medicines?.length || 0} medicines and ${backupPayload.data.sales?.length || 0} sales. Continue?`)) {
        input.value = '';
        return;
      }

      const headers = typeof getAuthHeaders === 'function' ? getAuthHeaders() : {};
      headers['Content-Type'] = 'application/json';

      showAlert('Restoring database from JSON backup...', 'info');

      fetch('/api/settings/restore', {
        method: 'POST',
        headers,
        body: JSON.stringify(backupPayload)
      })
        .then(res => res.json())
        .then(resp => {
          if (resp && resp.ok) {
            showAlert('System database successfully restored from JSON backup!', 'success');
            if (typeof fetchAndRenderMedicines === 'function') fetchAndRenderMedicines();
            if (typeof fetchAndRenderSales === 'function') fetchAndRenderSales();
            showPage('dashboard');
          } else {
            showAlert('Restore Failed: ' + (resp.error || 'Unauthorized'), 'error');
          }
        })
        .catch(err => {
          console.error('Restore error:', err);
          showAlert('Error restoring database. See console.', 'error');
        })
        .finally(() => {
          input.value = '';
        });
    } catch (err) {
      console.error('JSON parse error:', err);
      showAlert('Failed to parse backup JSON file.', 'error');
      input.value = '';
    }
  };
  reader.readAsText(file);
}

function confirmResetDatabase() {
  const password = prompt('SECURITY WARNING: Resetting database will erase all custom inventory products, sales, and audit logs. Enter Admin Account Password to proceed:');
  if (!password) {
    showAlert('Database reset cancelled.', 'info');
    return;
  }

  const headers = typeof getAuthHeaders === 'function' ? getAuthHeaders() : {};
  headers['Content-Type'] = 'application/json';

  showAlert('Verifying Admin password & resetting database...', 'warning');

  fetch('/api/settings/reset', {
    method: 'POST',
    headers,
    body: JSON.stringify({ password })
  })
    .then(res => res.json())
    .then(resp => {
      if (resp && resp.ok) {
        showAlert('System database reset to factory defaults successfully!', 'success');
        if (typeof fetchAndRenderMedicines === 'function') fetchAndRenderMedicines();
        if (typeof fetchAndRenderSales === 'function') fetchAndRenderSales();
        showPage('dashboard');
      } else {
        showAlert('Database Reset Failed: ' + (resp.error || 'Incorrect Admin Password'), 'error');
      }
    })
    .catch(err => {
      console.error('Reset error:', err);
      showAlert('Error resetting database. See console.', 'error');
    });
}

//
// Called by Print button on row
//
function printSaleInvoice(saleId) {
  const sale = (salesData || []).find(s => s.id === saleId);
  if (!sale) return showAlert('Sale not found', 'warning');
  generateInvoiceWindow(sale);
}

//
// After posting a sale: update salesData (push or refetch) + update UI + invoice
//
function handleSaleSaved(savedSale) {
  try {
    if (savedSale && savedSale.id) {
      const normalized = normalizeSaleRow(savedSale);
      salesData = salesData || [];
      const idx = salesData.findIndex(s => String(s.id) === String(normalized.id));
      if (idx >= 0) salesData[idx] = normalized;
      else salesData.unshift(normalized);

      updateDashboardStats();
      updateSalesPageStats();
      populateRecentSalesTable();
      fetchAndRenderMedicines();
      generateInvoiceWindow(normalized);
    } else {
      fetchAndRenderSales().then(() => {
        fetchAndRenderMedicines();
      });
    }
    showAlert('Sale recorded successfully!', 'success');
  } catch (e) {
    console.error('handleSaleSaved error', e);
  }
}

//
// Interactive POS Payment Gateway Simulator Logic
//
let currentPendingSalePayload = null;
let selectedBankName = 'HDFC Bank';

const salesForm = document.getElementById('salesForm');
if (salesForm) {
  salesForm.addEventListener('submit', function (e) {
    e.preventDefault();

    const items = getSaleItems().map(it => ({
      id: it.medicineId || it.id,
      name: it.medicineName || it.name,
      qty: Number(it.quantity || it.qty || 0),
      price: Number(it.price || 0),
      subtotal: Number(it.quantity || it.qty || 0) * Number(it.price || 0)
    }));

    if (!items || items.length === 0) {
      return showAlert('Please add at least one item to the sale.', 'warning');
    }

    const paymentMethod = document.getElementById('paymentMethodSelect')?.value || 'Cash';
    const total = items.reduce((s, i) => s + (i.subtotal || 0), 0);

    currentPendingSalePayload = {
      customerName: document.getElementById('customerName')?.value || 'Walk-in Customer',
      customerPhone: document.getElementById('customerPhone')?.value || '',
      date: document.getElementById('saleDate')?.value || getLocalDateString(),
      paymentMethod,
      transactionRef: document.getElementById('transactionRefInput')?.value || '',
      items,
      total
    };

    openPOSPaymentModal();
  });
}

function openPOSPaymentModal() {
  if (!currentPendingSalePayload) return;
  const modal = document.getElementById('posPaymentModal');
  if (!modal) return;

  const totalEl = document.getElementById('posPayModalTotal');
  const custEl = document.getElementById('posPayModalCustomer');
  if (totalEl) totalEl.textContent = `₹${Number(currentPendingSalePayload.total || 0).toFixed(2)}`;
  if (custEl) custEl.textContent = currentPendingSalePayload.customerName || 'Walk-in Customer';

  // Hide all payment panels
  document.querySelectorAll('.pay-panel').forEach(p => p.style.display = 'none');

  const method = currentPendingSalePayload.paymentMethod;

  if (method === 'UPI') {
    const payeeNameEl = document.getElementById('upiPayeeNameDisplay');
    const vpaEl = document.getElementById('upiVpaDisplay');
    const qrImg = document.getElementById('upiQRCodeImg');

    if (payeeNameEl) payeeNameEl.textContent = ownerPaymentConfig.accountName || 'MediVault Pharmacy Ltd.';
    if (vpaEl) vpaEl.textContent = ownerPaymentConfig.upiId || 'medivault.owner@icici';

    if (qrImg) {
      const upiUrl = `upi://pay?pa=${encodeURIComponent(ownerPaymentConfig.upiId || 'medivault.owner@icici')}&pn=${encodeURIComponent(ownerPaymentConfig.accountName || 'MediVault Pharmacy')}&am=${currentPendingSalePayload.total.toFixed(2)}&cu=INR`;
      qrImg.src = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(upiUrl)}`;
    }
    const panel = document.getElementById('payPanelUPI');
    if (panel) panel.style.display = 'block';
  } else if (method === 'Card') {
    const numInp = document.getElementById('cardNumInput');
    const nameInp = document.getElementById('cardNameVisual');
    if (numInp) numInp.value = '';
    if (nameInp) nameInp.textContent = currentPendingSalePayload.customerName || 'VALUED CUSTOMER';
    updateCardVisual();
    const panel = document.getElementById('payPanelCard');
    if (panel) panel.style.display = 'block';
  } else if (method === 'NetBanking') {
    const nbName = document.getElementById('nbBeneficiaryName');
    const nbBank = document.getElementById('nbBankName');
    const nbAcc = document.getElementById('nbAccountNumber');
    const nbIfsc = document.getElementById('nbIfscCode');

    if (nbName) nbName.textContent = ownerPaymentConfig.accountName || 'MediVault Pharmacy Ltd.';
    if (nbBank) nbBank.textContent = ownerPaymentConfig.bankName || 'ICICI Bank Ltd.';
    if (nbAcc) nbAcc.textContent = ownerPaymentConfig.accountNumber || '91802345678912';
    if (nbIfsc) nbIfsc.textContent = ownerPaymentConfig.ifscCode || 'ICIC0001024';

    const panel = document.getElementById('payPanelNetBanking');
    if (panel) panel.style.display = 'block';
  } else if (method === 'Credit') {
    const panel = document.getElementById('payPanelCredit');
    if (panel) panel.style.display = 'block';
  } else {
    // Default: Cash
    const cashInp = document.getElementById('cashTenderedInput');
    if (cashInp) cashInp.value = currentPendingSalePayload.total;
    calculateCashChange();
    const panel = document.getElementById('payPanelCash');
    if (panel) panel.style.display = 'block';
  }

  modal.style.display = 'flex';
  modal.setAttribute('aria-hidden', 'false');
}

function closePOSPaymentModal() {
  const modal = document.getElementById('posPaymentModal');
  if (modal) {
    modal.style.display = 'none';
    modal.setAttribute('aria-hidden', 'true');
  }
}

// Interactive Payment Actions
function simulateUPIPaymentSuccess() {
  const randomRef = `TXN-UPI-${Math.floor(100000 + Math.random() * 900000)}`;
  showAlert(`UPI Payment Authorized! Ref: ${randomRef}`, 'success');
  finalizePOSSale(randomRef);
}

function updateCardVisual() {
  const numVal = document.getElementById('cardNumInput')?.value || '';
  const expVal = document.getElementById('cardExpInput')?.value || '';

  const numVisual = document.getElementById('cardNumberVisual');
  const expVisual = document.getElementById('cardExpiryVisual');
  const brandVisual = document.getElementById('cardBrandVisual');

  if (numVisual) numVisual.textContent = numVal ? numVal.replace(/\D/g, '').replace(/(.{4})/g, '$1 ').trim() : '•••• •••• •••• ••••';
  if (expVisual) expVisual.textContent = expVal || '12/28';

  if (brandVisual) {
    if (numVal.startsWith('4')) brandVisual.textContent = 'VISA';
    else if (numVal.startsWith('5')) brandVisual.textContent = 'MASTERCARD';
    else if (numVal.startsWith('6')) brandVisual.textContent = 'RUPAY';
    else brandVisual.textContent = 'VISA / MASTERCARD';
  }
}

function processCardPaymentSubmit() {
  const numVal = document.getElementById('cardNumInput')?.value;
  const expVal = document.getElementById('cardExpInput')?.value;
  const cvvVal = document.getElementById('cardCvvInput')?.value;

  if (!numVal || numVal.length < 12) return showAlert('Please enter a valid card number', 'warning');
  if (!expVal) return showAlert('Please enter card expiration date', 'warning');
  if (!cvvVal || cvvVal.length < 3) return showAlert('Please enter valid 3-digit CVV', 'warning');

  // Open OTP Modal
  const otpModal = document.getElementById('otpVerifyModal');
  const otpInp = document.getElementById('otpCodeInput');
  if (otpInp) otpInp.value = '123456';
  if (otpModal) otpModal.style.display = 'flex';
}

function closeOTPModal() {
  const otpModal = document.getElementById('otpVerifyModal');
  if (otpModal) otpModal.style.display = 'none';
}

function submitOTPVerification() {
  const otpInp = document.getElementById('otpCodeInput')?.value;
  if (!otpInp || otpInp.length !== 6) return showAlert('Please enter valid 6-digit OTP', 'warning');

  closeOTPModal();
  const randomRef = `TXN-CARD-${Math.floor(100000 + Math.random() * 900000)}`;
  showAlert(`Card Charged Successfully! Auth Ref: ${randomRef}`, 'success');
  finalizePOSSale(randomRef);
}

function selectBank(el, bankName) {
  document.querySelectorAll('.bank-pill').forEach(b => b.classList.remove('active'));
  if (el) el.classList.add('active');
  selectedBankName = bankName;
}

function simulateNetBankingAuthorize() {
  const randomRef = `TXN-NET-${Math.floor(100000 + Math.random() * 900000)}`;
  showAlert(`Net Banking (${selectedBankName}) Authorized! Ref: ${randomRef}`, 'success');
  finalizePOSSale(randomRef);
}

function calculateCashChange() {
  if (!currentPendingSalePayload) return;
  const total = currentPendingSalePayload.total || 0;
  const tendered = Number(document.getElementById('cashTenderedInput')?.value || 0);
  const change = tendered - total;

  const changeDisplay = document.getElementById('cashChangeDisplay');
  if (changeDisplay) {
    if (change >= 0) {
      changeDisplay.textContent = `₹${change.toFixed(2)}`;
      changeDisplay.style.color = '#10B981';
    } else {
      changeDisplay.textContent = `Insufficient (₹${Math.abs(change).toFixed(2)} short)`;
      changeDisplay.style.color = '#EF4444';
    }
  }
}

function applyCashPreset(amount) {
  const inp = document.getElementById('cashTenderedInput');
  if (inp) {
    inp.value = amount;
    calculateCashChange();
  }
}

function applyExactCashPreset() {
  if (!currentPendingSalePayload) return;
  const inp = document.getElementById('cashTenderedInput');
  if (inp) {
    inp.value = currentPendingSalePayload.total;
    calculateCashChange();
  }
}

function confirmCashPaymentSubmit() {
  if (!currentPendingSalePayload) return;
  const total = currentPendingSalePayload.total || 0;
  const tendered = Number(document.getElementById('cashTenderedInput')?.value || 0);

  if (tendered < total) {
    return showAlert(`Tendered cash (₹${tendered}) is less than payable total (₹${total}).`, 'warning');
  }

  const change = (tendered - total).toFixed(2);
  const randomRef = `TXN-CASH-${Math.floor(100000 + Math.random() * 900000)}`;
  showAlert(`Cash Received! Change to return: ₹${change}`, 'success');
  finalizePOSSale(randomRef);
}

function confirmStoreCreditSubmit() {
  const randomRef = `TXN-CREDIT-${Math.floor(100000 + Math.random() * 900000)}`;
  showAlert(`Charged to Store Credit Account! Ref: ${randomRef}`, 'success');
  finalizePOSSale(randomRef);
}

function finalizePOSSale(txnRef) {
  if (!currentPendingSalePayload) return;
  currentPendingSalePayload.transactionRef = txnRef;

  const authHeaders = typeof getAuthHeaders === 'function' ? getAuthHeaders() : {};

  fetch('/api/sales', {
    method: 'POST',
    headers: Object.assign({ 'Content-Type': 'application/json' }, authHeaders),
    body: JSON.stringify(currentPendingSalePayload)
  })
    .then(async r => {
      if (!r.ok) {
        const body = await r.text().catch(() => '<no body>');
        throw new Error(`Server error: ${r.status} ${r.statusText} — ${body}`);
      }
      return r.json();
    })
    .then(saved => {
      closePOSPaymentModal();
      const salesFormEl = document.getElementById('salesForm');
      if (salesFormEl) salesFormEl.reset();

      const saleItemsDiv = document.getElementById('saleItems');
      if (saleItemsDiv) {
        saleItemsDiv.innerHTML = '';
        const initialDiv = document.createElement('div');
        initialDiv.className = 'form-group';
        initialDiv.innerHTML = `<div style="display:flex;gap:1rem;align-items:center;">
        <select style="flex:2;" class="sale-medicine"><option value="">Select Medicine</option>
          ${medicinesData.map(m => `<option value="${m.id}">${m.name} - ₹${m.price}</option>`).join('')}
        </select>
        <input type="number" placeholder="Qty" style="flex:1;" min="1" class="sale-quantity">
        <button type="button" class="btn" onclick="addSaleItem()">Add Item</button>
      </div>`;
        saleItemsDiv.appendChild(initialDiv);
      }

      currentPendingSalePayload = null;
      handleSaleSaved(saved);
    })
    .catch(err => {
      console.error('Sale submission failed:', err);
      showAlert('Failed to process sale. Check server connection.', 'error');
    });
}

// ---------- Backup / Restore / Clear (unchanged) ----------
function createBackup() {
  const backupData = { medicines: medicinesData, sales: salesData, timestamp: new Date().toISOString() };
  const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `medivault_backup_${new Date().toISOString().split('T')[0]}.json`;
  a.click();
  window.URL.revokeObjectURL(url);
  showAlert('Backup created successfully!', 'success');
}

function handleRestore() {
  const fileInput = document.getElementById('restoreFile');
  const file = fileInput.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function (e) {
    try {
      const backupData = JSON.parse(e.target.result);
      if (confirm('This will replace all current data. Continue?')) {
        medicinesData = backupData.medicines || [];
        salesData = backupData.sales || [];
        updateInventoryTable();
        updateDashboardStats();
        showAlert('Data restored successfully!', 'success');
      }
    } catch (error) {
      showAlert('Error restoring backup: ' + error.message, 'error');
    }
  };
  reader.readAsText(file);
}

function clearAllData() {
  if (!confirm('This will permanently delete all data. Are you sure?')) return;
  if (!confirm('This action cannot be undone. Final confirmation?')) return;
  medicinesData = [];
  salesData = [];
  updateInventoryTable();
  updateDashboardStats();
  showAlert('All data cleared successfully!', 'error');
}

function showAlert(message, type) {
  const alertDiv = document.createElement('div');
  alertDiv.className = `alert ${type}`;
  alertDiv.innerHTML = `<i class="fas fa-info-circle"></i> ${message}`;
  const container = document.querySelector('.page.active') || document.body;
  container.insertBefore(alertDiv, container.firstChild);
  setTimeout(() => alertDiv.remove(), 5000);
}

// ---------- Settings Handlers ----------

function fetchAndApplySettings() {
  fetch('/api/settings')
    .then(res => res.json())
    .then(data => {
      if (data && typeof data === 'object') {
        if (data.business) businessSettings = Object.assign(businessSettings, data.business);
        if (data.system) systemSettings = Object.assign(systemSettings, data.system);
        if (data.owner_payment_config) {
          const cfg = typeof data.owner_payment_config === 'string' ? JSON.parse(data.owner_payment_config) : data.owner_payment_config;
          ownerPaymentConfig = Object.assign(ownerPaymentConfig, cfg);
        }
      }
      applySettingsToUI();
    })
    .catch(err => {
      console.warn('Could not load settings from server, checking localStorage', err);
      try {
        const localB = localStorage.getItem('medivault_business_settings') || localStorage.getItem('ramesh_business_settings');
        if (localB) businessSettings = Object.assign(businessSettings, JSON.parse(localB));
        const localS = localStorage.getItem('medivault_system_settings') || localStorage.getItem('ramesh_system_settings');
        if (localS) systemSettings = Object.assign(systemSettings, JSON.parse(localS));
        const localO = localStorage.getItem('medivault_owner_payment_config');
        if (localO) ownerPaymentConfig = Object.assign(ownerPaymentConfig, JSON.parse(localO));
      } catch (e) {}
      applySettingsToUI();
    });
}

function applySettingsToUI() {
  if (document.getElementById('businessName')) document.getElementById('businessName').value = businessSettings.businessName || '';
  if (document.getElementById('businessAddress')) document.getElementById('businessAddress').value = businessSettings.businessAddress || '';
  if (document.getElementById('businessPhone')) document.getElementById('businessPhone').value = businessSettings.businessPhone || '';
  if (document.getElementById('businessEmail')) document.getElementById('businessEmail').value = businessSettings.businessEmail || '';
  if (document.getElementById('gstNumber')) document.getElementById('gstNumber').value = businessSettings.gstNumber || '';
  if (document.getElementById('licenseNumber')) document.getElementById('licenseNumber').value = businessSettings.licenseNumber || '';

  if (document.getElementById('lowStockThreshold')) document.getElementById('lowStockThreshold').value = systemSettings.lowStockThreshold || 10;
  if (document.getElementById('expiryAlertDays')) document.getElementById('expiryAlertDays').value = systemSettings.expiryAlertDays || 30;
  if (document.getElementById('currency')) document.getElementById('currency').value = systemSettings.currency || 'INR';
  if (document.getElementById('dateFormat')) document.getElementById('dateFormat').value = systemSettings.dateFormat || 'DD/MM/YYYY';

  if (document.getElementById('ownerAccountName')) document.getElementById('ownerAccountName').value = ownerPaymentConfig.accountName || '';
  if (document.getElementById('ownerBankName')) document.getElementById('ownerBankName').value = ownerPaymentConfig.bankName || '';
  if (document.getElementById('ownerAccountNumber')) document.getElementById('ownerAccountNumber').value = ownerPaymentConfig.accountNumber || '';
  if (document.getElementById('ownerIfscCode')) document.getElementById('ownerIfscCode').value = ownerPaymentConfig.ifscCode || '';
  if (document.getElementById('ownerBranchName')) document.getElementById('ownerBranchName').value = ownerPaymentConfig.branchName || '';
  if (document.getElementById('ownerUpiId')) document.getElementById('ownerUpiId').value = ownerPaymentConfig.upiId || '';
  if (document.getElementById('ownerMerchantPhone')) document.getElementById('ownerMerchantPhone').value = ownerPaymentConfig.merchantPhone || '';
  if (document.getElementById('ownerMerchantEmail')) document.getElementById('ownerMerchantEmail').value = ownerPaymentConfig.merchantEmail || '';
  if (document.getElementById('ownerGstin')) document.getElementById('ownerGstin').value = ownerPaymentConfig.gstin || '';

  const logoEl = document.querySelector('.logo');
  if (logoEl && businessSettings.businessName) {
    logoEl.innerHTML = `<i class="fas fa-medical-bag"></i> ${escapeHtml(businessSettings.businessName)}`;
  }

  updateDashboardStats();
  updateSalesPageStats();
}

function saveBusinessSettings(e) {
  if (e) e.preventDefault();
  businessSettings = {
    businessName: document.getElementById('businessName')?.value || 'MediVault',
    businessAddress: document.getElementById('businessAddress')?.value || '',
    businessPhone: document.getElementById('businessPhone')?.value || '',
    businessEmail: document.getElementById('businessEmail')?.value || '',
    gstNumber: document.getElementById('gstNumber')?.value || '',
    licenseNumber: document.getElementById('licenseNumber')?.value || ''
  };

  try { 
    localStorage.setItem('medivault_business_settings', JSON.stringify(businessSettings)); 
    localStorage.setItem('ramesh_business_settings', JSON.stringify(businessSettings));
  } catch (err) {}

  fetch('/api/settings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ business: businessSettings })
  })
    .then(res => res.json())
    .then(() => {
      showAlert('Business settings saved successfully!', 'success');
      applySettingsToUI();
    })
    .catch(err => {
      console.error('Save business settings error:', err);
      showAlert('Business settings saved locally.', 'warning');
      applySettingsToUI();
    });
}

function saveSystemSettings(e) {
  if (e) e.preventDefault();
  systemSettings = {
    lowStockThreshold: Number(document.getElementById('lowStockThreshold')?.value || 10),
    expiryAlertDays: Number(document.getElementById('expiryAlertDays')?.value || 30),
    currency: document.getElementById('currency')?.value || 'INR',
    dateFormat: document.getElementById('dateFormat')?.value || 'DD/MM/YYYY',
    enableNotifications: document.getElementById('enableNotifications')?.checked || false,
    autoBackup: document.getElementById('autoBackup')?.checked || false
  };

  try { 
    localStorage.setItem('medivault_system_settings', JSON.stringify(systemSettings)); 
    localStorage.setItem('ramesh_system_settings', JSON.stringify(systemSettings));
  } catch (err) {}

  fetch('/api/settings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ system: systemSettings })
  })
    .then(res => res.json())
    .then(() => {
      showAlert('System settings saved successfully!', 'success');
      applySettingsToUI();
    })
    .catch(err => {
      console.error('Save system settings error:', err);
      showAlert('System settings saved locally.', 'warning');
      applySettingsToUI();
    });
}

function saveOwnerPaymentConfig(e) {
  if (e) e.preventDefault();
  ownerPaymentConfig = {
    accountName: document.getElementById('ownerAccountName')?.value || 'MediVault Pharmacy & Healthcare Ltd.',
    bankName: document.getElementById('ownerBankName')?.value || 'ICICI Bank Ltd.',
    accountNumber: document.getElementById('ownerAccountNumber')?.value || '',
    ifscCode: (document.getElementById('ownerIfscCode')?.value || '').toUpperCase(),
    branchName: document.getElementById('ownerBranchName')?.value || '',
    upiId: document.getElementById('ownerUpiId')?.value || '',
    merchantPhone: document.getElementById('ownerMerchantPhone')?.value || '',
    merchantEmail: document.getElementById('ownerMerchantEmail')?.value || '',
    gstin: (document.getElementById('ownerGstin')?.value || '').toUpperCase()
  };

  try {
    localStorage.setItem('medivault_owner_payment_config', JSON.stringify(ownerPaymentConfig));
  } catch (err) {}

  const authHeaders = typeof getAuthHeaders === 'function' ? getAuthHeaders() : {};

  fetch('/api/settings', {
    method: 'POST',
    headers: Object.assign({ 'Content-Type': 'application/json' }, authHeaders),
    body: JSON.stringify({ owner_payment_config: ownerPaymentConfig })
  })
    .then(res => res.json())
    .then(resp => {
      if (resp && resp.ok) {
        showAlert('Owner Merchant Bank Credentials saved successfully!', 'success');
        applySettingsToUI();
      } else {
        showAlert('Failed to save bank credentials: ' + (resp.error || 'Unauthorized'), 'error');
      }
    })
    .catch(err => {
      console.error('Save owner bank config error:', err);
      showAlert('Bank credentials saved locally.', 'warning');
      applySettingsToUI();
    });
}

// Init
document.addEventListener('DOMContentLoaded', function () {
  const fileInput = document.getElementById('fileInput');
  if (fileInput) fileInput.addEventListener('change', handleFileUpload);

  const addSaleBtn = document.getElementById('addSaleItemBtn');
  if (addSaleBtn) addSaleBtn.addEventListener('click', addSaleItem);

  const businessForm = document.getElementById('businessForm');
  if (businessForm) businessForm.addEventListener('submit', saveBusinessSettings);

  const systemForm = document.getElementById('systemForm');
  if (systemForm) systemForm.addEventListener('submit', saveSystemSettings);

  const ownerBankForm = document.getElementById('ownerBankForm');
  if (ownerBankForm) ownerBankForm.addEventListener('submit', saveOwnerPaymentConfig);

  const reportForm = document.getElementById('reportForm');
  if (reportForm) {
    reportForm.addEventListener('submit', function(e) {
      e.preventDefault();
      const type = document.getElementById('reportType')?.value || 'inventory';
      const fromDate = document.getElementById('reportDateFrom')?.value || '';
      const toDate = document.getElementById('reportDateTo')?.value || '';
      generateReport(type, fromDate, toDate);
    });
  }

  fetchAndApplySettings();

  fetchAndRenderMedicines().then(() => {
    const firstSelect = document.querySelector('.sale-medicine');
    if (firstSelect) fillMedicineOptions(firstSelect);
  });

  fetchAndRenderSales();
});
