// AlexG - Versión 23.0.0 (Restauración de LOGICA ESTABLE)
// Basada en v21.2.0 (Clon fiel de v17) con parches de v22.

// Utility: Database & Sync Wrapper
const DB = {
  get: (key) => {
    try {
      const data = localStorage.getItem(key);
      return data ? JSON.parse(data) : [];
    } catch(e) { return []; }
  },
  set: (key, data) => {
    localStorage.setItem(key, JSON.stringify(data));
    if (key === KEYS.MASTER || key === KEYS.ENTRIES) syncToCloud(key, data);
  },
  addId: () => '_' + Math.random().toString(36).substr(2, 9)
};

// Custom modal replace for confirm()
function showConfirm(message, okLabel = 'Confirmar') {
  return new Promise(resolve => {
    const modal = document.getElementById('confirmModal');
    const msg   = document.getElementById('confirm-message');
    const okBtn = document.getElementById('confirm-ok-btn');
    const cancelBtn = document.getElementById('confirm-cancel-btn');
    if(!modal) return resolve(window.confirm(message));
    msg.textContent = message;
    okBtn.textContent = okLabel;
    modal.classList.add('active');
    const cleanup = (result) => {
      modal.classList.remove('active');
      okBtn.onclick = null;
      cancelBtn.onclick = null;
      resolve(result);
    };
    okBtn.onclick = () => cleanup(true);
    cancelBtn.onclick = () => cleanup(false);
  });
}

// Custom toast replace for alert()
function showToast(message, duration = 2500) {
  const toast = document.getElementById('app-toast');
  if(!toast) return;
  toast.textContent = message;
  toast.classList.add('visible');
  toast.classList.add('active');
  setTimeout(() => {
      toast.classList.remove('visible');
      toast.classList.remove('active');
  }, duration);
}

// Keys
const KEYS = {
  MASTER: 'rose_master_v1',
  ENTRIES: 'rose_entries_v1',
  SETTINGS: 'rose_settings_v1',
  FIREBASE_CONFIG: 'rose_fb_config'
};

const APP_VERSION = "23.0.0";

// --- FIREBASE CONFIG (CORREGIDA) ---
const firebaseConfig = {
  apiKey: "AIzaSyCWN1R22xxZ6U9MLuMUzssE8KWegZIR6W0",
  authDomain: "roseapp-c57dc.firebaseapp.com",
  projectId: "roseapp-c57dc",
  storageBucket: "roseapp-c57dc.firebasestorage.app",
  messagingSenderId: "765179334313",
  appId: "1:765179334313:web:ad5224a5b89648827b23b8",
  measurementId: "G-0TMWHD7LVP"
};

let db = null;
let auth = null;

function updateCloudBadge(isOnline) {
  const badges = document.querySelectorAll('.cloud-status-badge');
  badges.forEach(b => {
    if (isOnline) {
        b.classList.remove('offline');
        b.classList.add('online');
        b.innerHTML = '<i class="ph ph-cloud-check"></i>';
    } else {
        b.classList.remove('online');
        b.classList.add('offline');
        b.innerHTML = '<i class="ph ph-cloud-slash"></i>';
    }
  });
}

function initFirebase() {
  if (typeof firebase === 'undefined') { updateCloudBadge(false); return; }
  try {
    if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
    db = firebase.firestore();
    auth = firebase.auth();
    auth.signInAnonymously().then(() => {
      updateCloudBadge(true);
      loadFromCloud();
    }).catch(e => { console.error("Cloud connection failed", e); updateCloudBadge(false); });
  } catch (e) {
    console.error("Firebase init failed:", e);
    updateCloudBadge(false);
  }
}

// ================= APP INIT =================
document.addEventListener('DOMContentLoaded', initApp);

function initApp() {
  // PERFIL GLOBAL DE ADMINISTRADOR (SIN BLOQUEO)
  window.currentUserProfile = { name: "Usuario AlexG", role: "admin", sede: "ALL" };

  setupNavigation();
  setupMasterForm();
  setupRegistryForm();
  setupInventoryFilters();
  setupTimeFilters();
  setupBackupRestore();
  setupSettings();

  // Load preferences
  let settings = DB.get(KEYS.SETTINGS);
  if (Array.isArray(settings)) settings = {};
  if (settings.theme) document.body.setAttribute('data-theme', settings.theme);

  initFirebase();
  refreshAllViews();
  switchView('view-registry');
}

function refreshAllViews() {
  renderMasterList();
  populateSedeDropdowns();
  populateRegistryDropdowns();
  renderRecentEntries();
  updateRegistryTotal();
  renderInventory(document.getElementById('filter-group')?.value || 'general');
}

function populateSedeDropdowns() {
  const masterData = DB.get(KEYS.MASTER);
  const uniqueSedes = [...new Set(masterData.map(m => m.sede).filter(s => s))].sort();
  const regSede = document.getElementById('reg-sede');
  const invSede = document.getElementById('filter-sede');
  if (regSede) {
    regSede.innerHTML = `<option value="" disabled selected>Seleccionar Sede</option>`;
    uniqueSedes.forEach(s => regSede.innerHTML += `<option value="${s.toUpperCase()}">${s.toUpperCase()}</option>`);
  }
  if (invSede) {
    invSede.innerHTML = `<option value="TODAS">TODAS LAS SEDES</option>`;
    uniqueSedes.forEach(s => invSede.innerHTML += `<option value="${s.toUpperCase()}">${s.toUpperCase()}</option>`);
  }
}

// --- NAVIGATION ---
function setupNavigation() {
  document.querySelectorAll('.nav-item').forEach(btn => {
    btn.onclick = () => switchView(btn.getAttribute('data-target'));
  });
}

function switchView(targetId) {
  document.querySelectorAll('.view').forEach(v => v.classList.toggle('active', v.id === targetId));
  document.querySelectorAll('.nav-item').forEach(b => b.classList.toggle('active', b.getAttribute('data-target') === targetId));
  if (targetId === 'view-inventory') renderInventory(document.getElementById('filter-group')?.value || 'general');
}

// --- MASTER DATA ---
function setupMasterForm() {
  const form = document.getElementById('form-master');
  if (!form) return;
  form.onsubmit = (e) => {
    e.preventDefault();
    const zona = document.getElementById('master-zona').value.trim().toUpperCase();
    const bloque = document.getElementById('master-bloque').value.trim().toUpperCase();
    const variedad = document.getElementById('master-variedad').value.trim().toUpperCase();
    const tallosMalla = parseInt(document.getElementById('master-tallos').value, 10);
    const sede = document.getElementById('master-sede').value.trim().toUpperCase();

    const data = DB.get(KEYS.MASTER);
    data.push({ id: DB.addId(), zona, bloque, variedad, tallosMalla, sede });
    DB.set(KEYS.MASTER, data);
    form.reset();
    refreshAllViews();
    showToast("Maestro guardado");
  };

  const modal = document.getElementById('masterSearchModal');
  const btnOpen = document.getElementById('btn-master-search');
  const searchInput = document.getElementById('input-master-search');
  const resultsDiv = document.getElementById('master-search-results');

  if (btnOpen) {
    btnOpen.onclick = () => {
      modal.classList.add('active');
      searchInput.value = '';
      renderSearch('');
      setTimeout(() => searchInput.focus(), 100);
    };
  }
  if (document.getElementById('close-master-search')) {
      document.getElementById('close-master-search').onclick = () => modal.classList.remove('active');
  }
  if (searchInput) searchInput.oninput = (e) => renderSearch(e.target.value.toLowerCase());

  function renderSearch(query) {
    if(!resultsDiv) return;
    resultsDiv.innerHTML = '';
    DB.get(KEYS.MASTER).filter(m => m.variedad.toLowerCase().includes(query) || m.bloque.toLowerCase().includes(query)).forEach(m => {
      const el = document.createElement('div');
      el.className = 'list-item clickable';
      el.innerHTML = `<div class="item-info"><span class="item-title">${m.variedad}</span><span class="item-subtitle">${m.sede} - B${m.bloque}</span></div>`;
      el.onclick = () => { selectMasterForRegistry(m); modal.classList.remove('active'); switchView('view-registry'); };
      resultsDiv.appendChild(el);
    });
  }
}

function selectMasterForRegistry(m) {
  const s = document.getElementById('reg-sede');
  const b = document.getElementById('reg-bloque');
  const v = document.getElementById('reg-variedad');
  const t = document.getElementById('reg-tallos-read');
  if (s) s.value = m.sede;
  if (b) b.value = m.bloque;
  populateRegistryDropdowns();
  if (v) v.value = m.id;
  if (t) t.value = m.tallosMalla;
}

window.deleteMaster = function(id) {
  showConfirm("¿Eliminar registro maestro?").then(ok => {
    if (ok) {
        DB.set(KEYS.MASTER, DB.get(KEYS.MASTER).filter(m => m.id !== id));
        refreshAllViews();
    }
  });
};

function renderMasterList() {
    const list = document.getElementById('master-list-settings');
    if(!list) return;
    list.innerHTML = '';
    DB.get(KEYS.MASTER).forEach(m => {
        list.innerHTML += `<div class="list-item">
            <div class="item-info"><span class="item-title">${m.variedad}</span><span class="item-subtitle">${m.sede} | B${m.bloque}</span></div>
            <button class="btn-icon-danger" onclick="deleteMaster('${m.id}')"><i class="ph ph-trash"></i></button>
        </div>`;
    });
}

// --- REGISTRY ---
function setupRegistryForm() {
    const form = document.getElementById('form-registry');
    const regSede = document.getElementById('reg-sede');
    const regBloque = document.getElementById('reg-bloque');
    const regVariedad = document.getElementById('reg-variedad');
    const regTallos = document.getElementById('reg-tallos-read');
    const regMallas = document.getElementById('reg-mallas');
    const regTotal = document.getElementById('reg-total-calc');

    if (regSede) regSede.onchange = populateRegistryDropdowns;
    if (regBloque) regBloque.oninput = populateRegistryDropdowns;
    if (regVariedad) regVariedad.onchange = () => {
        const m = DB.get(KEYS.MASTER).find(x => x.id === regVariedad.value);
        if (m && regTallos) { regTallos.value = m.tallosMalla; calc(); }
    };
    if (regMallas) regMallas.oninput = calc;

    function calc() {
        if (regTotal) regTotal.textContent = ((parseInt(regTallos?.value) || 0) * (parseInt(regMallas?.value) || 0)).toLocaleString();
    }

    if (form) form.onsubmit = (e) => {
        e.preventDefault();
        const entries = DB.get(KEYS.ENTRIES);
        entries.push({
            id: DB.addId(),
            masterId: regVariedad.value,
            mallas: parseInt(regMallas.value),
            totalTallos: parseInt(regMallas.value) * parseInt(regTallos.value),
            sede: regSede.value,
            date: new Date().toISOString()
        });
        DB.set(KEYS.ENTRIES, entries);
        form.reset();
        if (regTotal) regTotal.textContent = '0';
        refreshAllViews();
        showToast("Registro guardado");
    };
}

function populateRegistryDropdowns() {
    const s = document.getElementById('reg-sede')?.value;
    const b = document.getElementById('reg-bloque')?.value.trim().toUpperCase();
    const v = document.getElementById('reg-variedad');
    if (!v) return;
    v.innerHTML = '<option value="" disabled selected>Seleccionar Variedad</option>';
    if (!s || !b) { v.disabled = true; return; }
    const filtered = DB.get(KEYS.MASTER).filter(m => m.sede === s && m.bloque === b);
    v.disabled = filtered.length === 0;
    filtered.forEach(m => v.innerHTML += `<option value="${m.id}">${m.variedad}</option>`);
}

function renderRecentEntries() {
    const list = document.getElementById('recent-list');
    if (!list) return;
    const today = new Date().toISOString().split('T')[0];
    const data = DB.get(KEYS.ENTRIES).filter(e => e.date.startsWith(today)).reverse();
    const master = DB.get(KEYS.MASTER);
    list.innerHTML = '';
    data.forEach(e => {
        const m = master.find(x => x.id === e.masterId);
        if (m) {
            list.innerHTML += `<div class="list-item">
                <div class="item-info"><span class="item-title">${m.variedad}</span><span class="item-subtitle">${e.sede} | B${m.bloque} | ${e.mallas} mall.</span></div>
                <div style="text-align:right;"><span class="item-value">${e.totalTallos} t.</span><button class="btn-text-danger" onclick="deleteEntry('${e.id}')">Eliminar</button></div>
            </div>`;
        }
    });
}

window.deleteEntry = (id) => {
    showConfirm("¿Eliminar registro?").then(ok => {
        if (ok) { DB.set(KEYS.ENTRIES, DB.get(KEYS.ENTRIES).filter(e => e.id !== id)); refreshAllViews(); }
    });
};

function updateRegistryTotal() {
    const today = new Date().toISOString().split('T')[0];
    const data = DB.get(KEYS.ENTRIES).filter(e => e.date.startsWith(today));
    if (document.getElementById('reg-daily-total')) document.getElementById('reg-daily-total').textContent = data.reduce((s, c) => s + c.totalTallos, 0).toLocaleString();
    if (document.getElementById('reg-daily-mallas')) document.getElementById('reg-daily-mallas').textContent = data.reduce((s, c) => s + c.mallas, 0).toLocaleString();
}

// --- INVENTORY ---
function setupInventoryFilters() {
    const g = document.getElementById('filter-group');
    const s = document.getElementById('filter-sede');
    if (g) g.onchange = () => renderInventory(g.value);
    if (s) s.onchange = () => renderInventory(g?.value || 'general');
    if (document.getElementById('btn-refresh-inventory')) document.getElementById('btn-refresh-inventory').onclick = () => { loadFromCloud(); showToast("Actualizando..."); };
    if (document.getElementById('btn-export-excel')) document.getElementById('btn-export-excel').onclick = exportCSV;
}

function setupTimeFilters() {
    const s = document.getElementById('filter-date-start');
    const e = document.getElementById('filter-date-end');
    if (s) s.onchange = () => renderInventory(document.getElementById('filter-group')?.value || 'general');
    if (e) e.onchange = () => renderInventory(document.getElementById('filter-group')?.value || 'general');
    if (document.getElementById('clear-date-filter')) document.getElementById('clear-date-filter').onclick = () => { if(s) s.value=''; if(e) e.value=''; renderInventory('general'); };
}

function renderInventory(group) {
    const list = document.getElementById('inventory-list');
    if (!list) return;
    const entries = DB.get(KEYS.ENTRIES);
    const master = DB.get(KEYS.MASTER);
    const sedeF = document.getElementById('filter-sede')?.value || 'TODAS';
    const dS = document.getElementById('filter-date-start')?.value;
    const dE = document.getElementById('filter-date-end')?.value;

    const filtered = entries.filter(e => {
        if (sedeF !== 'TODAS' && e.sede !== sedeF) return false;
        const d = e.date.split('T')[0];
        if (dS && d < dS) return false;
        if (dE && d > dE) return false;
        return true;
    });

    document.getElementById('inv-total-tallos').textContent = filtered.reduce((s,c) => s + c.totalTallos, 0).toLocaleString();
    document.getElementById('inv-total-mallas').textContent = filtered.reduce((s,c) => s + c.mallas, 0).toLocaleString();

    list.innerHTML = '';
    if (group === 'general') {
        filtered.reverse().forEach(e => {
            const m = master.find(x => x.id === e.masterId);
            if (m) list.innerHTML += `<div class="list-item"><div class="item-info"><span class="item-title">${m.variedad}</span><span class="item-subtitle">${e.sede} | B${m.bloque} | ${e.date.split('T')[0]}</span></div><div class="item-value">${e.totalTallos}</div></div>`;
        });
    } else {
        const g = {};
        filtered.forEach(e => {
            const m = master.find(x => x.id === e.masterId);
            if (m) {
                let k = (group === 'zona') ? m.zona : (group === 'bloque') ? 'B'+m.bloque : m.variedad;
                if (!g[k]) g[k] = {t:0, m:0};
                g[k].t += e.totalTallos; g[k].m += e.mallas;
            }
        });
        Object.keys(g).sort().forEach(k => {
            list.innerHTML += `<div class="list-item"><div class="item-info"><span class="item-title">${k}</span><span class="item-subtitle">${g[k].m} mallas</span></div><div class="item-value">${g[k].t.toLocaleString()}</div></div>`;
        });
    }
}

function exportCSV() {
    let csv = "Fecha,Sede,Zona,Bloque,Variedad,Mallas,TotalTallos\n";
    DB.get(KEYS.ENTRIES).forEach(e => {
        const m = DB.get(KEYS.MASTER).find(x => x.id === e.masterId);
        if (m) csv += `${e.date.split('T')[0]},${e.sede},${m.zona},${m.bloque},${m.variedad},${e.mallas},${e.totalTallos}\n`;
    });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    a.download = `Reporte_RoseApp.csv`; a.click();
}

function setupSettings() {
    const t = document.getElementById('settings-theme');
    if (t) t.onchange = (e) => { document.body.setAttribute('data-theme', e.target.value); let s = DB.get(KEYS.SETTINGS); s.theme = e.target.value; DB.set(KEYS.SETTINGS, s); };
}

function setupBackupRestore() {
    if (document.getElementById('btn-export-json')) document.getElementById('btn-export-json').onclick = () => {
        const d = URL.createObjectURL(new Blob([JSON.stringify({ master: DB.get(KEYS.MASTER), entries: DB.get(KEYS.ENTRIES) })], { type: 'application/json' }));
        const a = document.createElement('a'); a.href = d; a.download = `RoseBackup.json`; a.click();
    };
    if (document.getElementById('import-json')) document.getElementById('import-json').onchange = (e) => {
        const r = new FileReader(); r.onload = (ev) => {
            const d = JSON.parse(ev.target.result);
            if (d.master) DB.set(KEYS.MASTER, d.master);
            if (d.entries) DB.set(KEYS.ENTRIES, d.entries);
            showToast("Restaurado"); setTimeout(() => location.reload(), 1000);
        };
        r.readAsText(e.target.files[0]);
    };
}

// --- CLOUD SYNC ---
async function syncToCloud(key, data) {
    if (!db || !auth.currentUser) return;
    try {
        const col = (key === KEYS.MASTER) ? 'master' : 'entries';
        if (Array.isArray(data) && data.length > 0) {
            const last = data[data.length - 1];
            const dId = last.id;
            const payload = { ...last };
            delete payload.id;
            await db.collection(col).doc(dId).set(payload, { merge: true });
        }
    } catch (e) { console.error("Sync error:", e); }
}

async function loadFromCloud() {
    if (!db || !auth.currentUser) return;
    try {
        const mSnap = await db.collection('master').get();
        const mData = mSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        if (mData.length > 0) localStorage.setItem(KEYS.MASTER, JSON.stringify(mData));

        const eSnap = await db.collection('entries').get();
        const eData = eSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        if (eData.length > 0) localStorage.setItem(KEYS.ENTRIES, JSON.stringify(eData));

        refreshAllViews();
    } catch (e) { console.error("Load error:", e); }
}

// EMERGENCIA: Función de refresco forzado
window.forceAppRefresh = function() {
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.getRegistrations().then(r => r.forEach(s => s.unregister()));
    }
    if ('caches' in window) {
        caches.keys().then(keys => keys.forEach(k => caches.delete(k)));
    }
    setTimeout(() => {
        window.location.href = window.location.origin + window.location.pathname + '?v=' + Date.now();
    }, 500);
};
