/**
 * AlexG v22.0.0 - SANEAMIENTO TOTAL
 * Versión definitiva sin seguridad, acceso abierto y sincronización robusta.
 */

// --- CONFIGURACIÓN ---
const APP_VERSION = "22.0.0";
const KEYS = {
  MASTER: 'rose_master_v1',
  ENTRIES: 'rose_entries_v1',
  SETTINGS: 'rose_settings_v1',
  FIREBASE_CONFIG: 'rose_fb_config'
};

const firebaseConfig = {
  apiKey: "AIzaSyCWN1R22xxZ6U9MLuMUzssE8KWegZIR6W0",
  authDomain: "roseapp-c57dc.firebaseapp.com",
  projectId: "roseapp-c57dc",
  storageBucket: "roseapp-c57dc.firebasestorage.app",
  messagingSenderId: "765179334313",
  appId: "1:765179334313:web:ad5224a5b89648827b23b8",
  measurementId: "G-0TMWHD7LVP"
};

// --- ESTADO GLOBAL ---
window.currentUserProfile = { name: "Administrador", role: "admin", sede: "ALL" };
let db = null;
let auth = null;

// --- DATABASE WRAPPER ---
const DB = {
  get: (key) => JSON.parse(localStorage.getItem(key)) || [],
  set: (key, data) => {
    localStorage.setItem(key, JSON.stringify(data));
    if (db && auth && auth.currentUser) {
        if (key === KEYS.MASTER || key === KEYS.ENTRIES) {
            syncToCloud(key, data);
        }
    }
  },
  addId: () => '_' + Math.random().toString(36).substr(2, 9)
};

// --- UI HELPERS ---
function showToast(msg, duration = 2500) {
  const t = document.getElementById('app-toast');
  if (!t) return;
  t.textContent = msg;
  t.classList.add('visible');
  setTimeout(() => t.classList.remove('visible'), duration);
}

function showConfirm(msg, okText = 'Confirmar') {
  return new Promise(resolve => {
    const modal = document.getElementById('confirmModal');
    if (!modal) return resolve(window.confirm(msg));
    document.getElementById('confirm-message').textContent = msg;
    const okBtn = document.getElementById('confirm-ok-btn');
    const cnBtn = document.getElementById('confirm-cancel-btn');
    okBtn.textContent = okText;
    modal.classList.add('active');
    const done = (r) => {
      modal.classList.remove('active');
      okBtn.onclick = null;
      cnBtn.onclick = null;
      resolve(r);
    };
    okBtn.onclick = () => done(true);
    cnBtn.onclick = () => done(false);
  });
}

// --- CLOUD SYNC ---
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
        updateCloudBadge(true);
        // Load Master
        const mSnap = await db.collection('master').get();
        const mData = mSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        if (mData.length > 0) localStorage.setItem(KEYS.MASTER, JSON.stringify(mData));

        // Load Entries
        const eSnap = await db.collection('entries').get();
        const eData = eSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        if (eData.length > 0) localStorage.setItem(KEYS.ENTRIES, JSON.stringify(eData));

        refreshAllViews();
    } catch (e) {
        console.error("Load error:", e);
        updateCloudBadge(false);
    }
}

function initFirebase() {
  if (typeof firebase === 'undefined') return;
  try {
    if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
    db = firebase.firestore();
    auth = firebase.auth();
    auth.signInAnonymously().then(() => {
        loadFromCloud();
    }).catch(e => console.error("Anon auth failed", e));
  } catch (e) { console.error("FB init err", e); }
}

// --- APP INIT ---
document.addEventListener('DOMContentLoaded', initApp);

function initApp() {
  setupNavigation();
  setupMasterForm();
  setupRegistryForm();
  setupInventoryFilters();
  setupTimeFilters();
  setupSettings();
  setupBackupRestore();

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

// --- BUSINESS LOGIC (Core from v17) ---

function setupNavigation() {
  document.querySelectorAll('.nav-item').forEach(btn => {
    btn.onclick = () => switchView(btn.getAttribute('data-target'));
  });
}

function switchView(id) {
  document.querySelectorAll('.view').forEach(v => {
    v.classList.toggle('active', v.id === id);
  });
  document.querySelectorAll('.nav-item').forEach(b => {
    b.classList.toggle('active', b.getAttribute('data-target') === id);
  });
  if (id === 'view-inventory') renderInventory(document.getElementById('filter-group')?.value || 'general');
}

function populateSedeDropdowns() {
    const data = DB.get(KEYS.MASTER);
    const sedes = [...new Set(data.map(m => m.sede).filter(s => s))].sort();
    const regSede = document.getElementById('reg-sede');
    const invSede = document.getElementById('filter-sede');
    if (regSede) {
        regSede.innerHTML = '<option value="" disabled selected>Sede</option>';
        sedes.forEach(s => regSede.innerHTML += `<option value="${s}">${s}</option>`);
    }
    if (invSede) {
        invSede.innerHTML = '<option value="TODAS">TODAS</option>';
        sedes.forEach(s => invSede.innerHTML += `<option value="${s}">${s}</option>`);
    }
}

function setupMasterForm() {
    const form = document.getElementById('form-master');
    if (!form) return;
    form.onsubmit = (e) => {
        e.preventDefault();
        const zona = document.getElementById('master-zona').value.trim().toUpperCase();
        const bloque = document.getElementById('master-bloque').value.trim().toUpperCase();
        const variedad = document.getElementById('master-variedad').value.trim().toUpperCase();
        const tallos = parseInt(document.getElementById('master-tallos').value);
        const sede = document.getElementById('master-sede').value.trim().toUpperCase();

        if (!zona || !bloque || !variedad || isNaN(tallos) || !sede) return;

        const data = DB.get(KEYS.MASTER);
        data.push({ id: DB.addId(), zona, bloque, variedad, tallosMalla: tallos, sede });
        DB.set(KEYS.MASTER, data);
        form.reset();
        refreshAllViews();
        showToast("Maestro guardado");
    };

    // Modal buscador
    const modal = document.getElementById('masterSearchModal');
    const searchInp = document.getElementById('input-master-search');
    const results = document.getElementById('master-search-results');

    document.getElementById('btn-master-search').onclick = () => {
        modal.classList.add('active');
        searchInp.value = '';
        renderSearch('');
        setTimeout(() => searchInp.focus(), 100);
    };
    document.getElementById('close-master-search').onclick = () => modal.classList.remove('active');
    searchInp.oninput = (e) => renderSearch(e.target.value.toLowerCase());

    function renderSearch(q) {
        const data = DB.get(KEYS.MASTER);
        results.innerHTML = '';
        data.filter(m => m.variedad.toLowerCase().includes(q) || m.bloque.includes(q)).forEach(m => {
            const el = document.createElement('div');
            el.className = 'list-item clickable';
            el.innerHTML = `
                <div class="item-info">
                    <span class="item-title">${m.variedad}</span>
                    <span class="item-subtitle">B${m.bloque} - ${m.sede}</span>
                </div>
                <button class="btn-icon-danger" onclick="deleteMaster('${m.id}')"><i class="ph ph-trash"></i></button>
            `;
            el.onclick = (e) => {
                if (e.target.closest('button')) return;
                selectMaster(m);
                modal.classList.remove('active');
                switchView('view-registry');
            };
            results.appendChild(el);
        });
    }
}

function selectMaster(m) {
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

window.deleteMaster = (id) => {
    showConfirm("¿Eliminar registro maestro?").then(ok => {
        if (ok) {
            DB.set(KEYS.MASTER, DB.get(KEYS.MASTER).filter(m => m.id !== id));
            refreshAllViews();
        }
    });
};

function setupRegistryForm() {
    const regSede = document.getElementById('reg-sede');
    const regBloque = document.getElementById('reg-bloque');
    const regVariedad = document.getElementById('reg-variedad');
    const regMallas = document.getElementById('reg-mallas');
    const regTallos = document.getElementById('reg-tallos-read');
    const totalCalc = document.getElementById('reg-total-calc');

    if (regSede) regSede.onchange = populateRegistryDropdowns;
    if (regBloque) regBloque.oninput = populateRegistryDropdowns;
    if (regVariedad) regVariedad.onchange = () => {
        const m = DB.get(KEYS.MASTER).find(x => x.id === regVariedad.value);
        if (m) regTallos.value = m.tallosMalla;
        calc();
    };
    if (regMallas) regMallas.oninput = calc;

    function calc() {
        const m = parseInt(regMallas.value) || 0;
        const t = parseInt(regTallos.value) || 0;
        if (totalCalc) totalCalc.textContent = (m * t).toLocaleString();
    }

    const form = document.getElementById('form-registry');
    if (form) form.onsubmit = (e) => {
        e.preventDefault();
        const mId = regVariedad.value;
        const mallas = parseInt(regMallas.value);
        const sede = regSede.value;
        const m = DB.get(KEYS.MASTER).find(x => x.id === mId);
        if (!mId || isNaN(mallas) || !sede || !m) return;

        const entries = DB.get(KEYS.ENTRIES);
        entries.push({
            id: DB.addId(),
            masterId: mId,
            mallas,
            totalTallos: mallas * m.tallosMalla,
            sede,
            date: new Date().toISOString()
        });
        DB.set(KEYS.ENTRIES, entries);
        form.reset();
        if (totalCalc) totalCalc.textContent = '0';
        refreshAllViews();
        showToast("Registro guardado");
    };

    const headerSearch = document.getElementById('btn-master-search-reg-header');
    if (headerSearch) headerSearch.onclick = () => document.getElementById('btn-master-search').click();
}

function populateRegistryDropdowns() {
    const s = document.getElementById('reg-sede')?.value;
    const b = document.getElementById('reg-bloque')?.value.trim().toUpperCase();
    const v = document.getElementById('reg-variedad');
    if (!v) return;
    v.innerHTML = '<option value="" disabled selected>Variedad</option>';
    if (!s || !b) return v.disabled = true;
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
        if (!m) return;
        const el = document.createElement('div');
        el.className = 'list-item';
        el.innerHTML = `
            <div class="item-info">
                <span class="item-title">${m.variedad}</span>
                <span class="item-subtitle">${e.sede} - B${m.bloque} - ${e.mallas} mallas</span>
            </div>
            <div style="text-align:right">
                <span class="item-value">${e.totalTallos}</span>
                <button class="btn-text-danger" onclick="deleteEntry('${e.id}')">Eliminar</button>
            </div>
        `;
        list.appendChild(el);
    });
}

window.deleteEntry = (id) => {
    showConfirm("¿Eliminar registro?").then(ok => {
        if (ok) {
            DB.set(KEYS.ENTRIES, DB.get(KEYS.ENTRIES).filter(e => e.id !== id));
            refreshAllViews();
        }
    });
};

function updateRegistryTotal() {
    const today = new Date().toISOString().split('T')[0];
    const data = DB.get(KEYS.ENTRIES).filter(e => e.date.startsWith(today));
    const t = data.reduce((a, b) => a + b.totalTallos, 0);
    const m = data.reduce((a, b) => a + b.mallas, 0);
    if (document.getElementById('reg-daily-total')) document.getElementById('reg-daily-total').textContent = t.toLocaleString();
    if (document.getElementById('reg-daily-mallas')) document.getElementById('reg-daily-mallas').textContent = m.toLocaleString();
}

function setupInventoryFilters() {
    const g = document.getElementById('filter-group');
    const s = document.getElementById('filter-sede');
    if (g) g.onchange = () => renderInventory(g.value);
    if (s) s.onchange = () => renderInventory(g?.value || 'general');
    document.getElementById('btn-refresh-inventory').onclick = () => {
        loadFromCloud();
        showToast("Actualizando...");
    };
    document.getElementById('btn-export-excel').onclick = exportCSV;
}

function setupTimeFilters() {
    const start = document.getElementById('filter-date-start');
    const end = document.getElementById('filter-date-end');
    if (start) start.onchange = () => renderInventory(document.getElementById('filter-group')?.value || 'general');
    if (end) end.onchange = () => renderInventory(document.getElementById('filter-group')?.value || 'general');
    document.getElementById('clear-date-filter').onclick = () => {
        if (start) start.value = '';
        if (end) end.value = '';
        renderInventory(document.getElementById('filter-group')?.value || 'general');
    };
}

function renderInventory(group) {
    const entries = DB.get(KEYS.ENTRIES);
    const master = DB.get(KEYS.MASTER);
    const list = document.getElementById('inventory-list');
    const sede = document.getElementById('filter-sede')?.value || 'TODAS';
    const start = document.getElementById('filter-date-start')?.value;
    const end = document.getElementById('filter-date-end')?.value;

    if (!list) return;
    const filtered = entries.filter(e => {
        const mSede = sede === 'TODAS' || e.sede === sede;
        let mDate = true;
        const d = e.date.split('T')[0];
        if (start && d < start) mDate = false;
        if (end && d > end) mDate = false;
        return mSede && mDate;
    });

    const totalT = filtered.reduce((a, b) => a + b.totalTallos, 0);
    const totalM = filtered.reduce((a, b) => a + b.mallas, 0);
    document.getElementById('inv-total-tallos').textContent = totalT.toLocaleString();
    document.getElementById('inv-total-mallas').textContent = totalM.toLocaleString();

    list.innerHTML = '';
    if (group === 'general') {
        filtered.reverse().forEach(e => {
            const m = master.find(x => x.id === e.masterId);
            if (!m) return;
            const el = document.createElement('div');
            el.className = 'list-item';
            el.innerHTML = `
                <div class="item-info">
                    <span class="item-title">${m.variedad}</span>
                    <span class="item-subtitle">${e.sede} | B${m.bloque} | ${new Date(e.date).toLocaleDateString()}</span>
                </div>
                <div class="item-value">${e.totalTallos}</div>
            `;
            list.appendChild(el);
        });
    } else {
        const groups = {};
        filtered.forEach(e => {
            const m = master.find(x => x.id === e.masterId);
            if (!m) return;
            let k = (group === 'zona') ? m.zona : (group === 'bloque') ? "Bloque " + m.bloque : m.variedad;
            if (!groups[k]) groups[k] = { t: 0, m: 0 };
            groups[k].t += e.totalTallos;
            groups[k].m += e.mallas;
        });
        Object.keys(groups).sort().forEach(k => {
            const el = document.createElement('div');
            el.className = 'list-item';
            el.innerHTML = `<div class="item-info"><span class="item-title">${k}</span><span class="item-subtitle">${groups[k].m} mallas</span></div><div class="item-value">${groups[k].t.toLocaleString()}</div>`;
            list.appendChild(el);
        });
    }
}

function exportCSV() {
    const entries = DB.get(KEYS.ENTRIES);
    const master = DB.get(KEYS.MASTER);
    let csv = "Fecha,Sede,Zona,Bloque,Variedad,Mallas,TotalTallos\n";
    entries.forEach(e => {
        const m = master.find(x => x.id === e.masterId);
        if (m) csv += `${e.date.split('T')[0]},${e.sede},${m.zona},${m.bloque},${m.variedad},${e.mallas},${e.totalTallos}\n`;
    });
    const blob = new Blob([csv], { type: 'text/csv' });
    const u = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = u;
    a.download = `AlexG_Export_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
}

function setupSettings() {
    const th = document.getElementById('settings-theme');
    if (th) th.onchange = (e) => {
        document.body.setAttribute('data-theme', e.target.value);
        DB.set(KEYS.SETTINGS, { theme: e.target.value });
    };
}

function setupBackupRestore() {
    document.getElementById('btn-export-json').onclick = () => {
        const data = { master: DB.get(KEYS.MASTER), entries: DB.get(KEYS.ENTRIES) };
        const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `AlexG_Backup.json`;
        a.click();
    };
    document.getElementById('import-json').onchange = (e) => {
        const reader = new FileReader();
        reader.onload = (re) => {
            const d = JSON.parse(re.target.result);
            if (d.master) DB.set(KEYS.MASTER, d.master);
            if (d.entries) DB.set(KEYS.ENTRIES, d.entries);
            showToast("Restaurado");
            setTimeout(() => location.reload(), 1000);
        };
        reader.readAsText(e.target.files[0]);
    };
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

function renderMasterList() {
    const data = DB.get(KEYS.MASTER);
    // Logic for the master list in Settings view
    const list = document.getElementById('master-list-settings');
    if (!list) return;
    list.innerHTML = '';
    data.forEach(m => {
        const el = document.createElement('div');
        el.className = 'list-item';
        el.innerHTML = `
            <div class="item-info">
                <span class="item-title">${m.variedad}</span>
                <span class="item-subtitle">Sede: ${m.sede} | B${m.bloque} - Z${m.zona}</span>
            </div>
            <button class="btn-icon-danger" onclick="deleteMaster('${m.id}')"><i class="ph ph-trash"></i></button>
        `;
        list.appendChild(el);
    });
}
