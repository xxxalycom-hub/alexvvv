// AlexG - Versión 24.0.0 (Ajuste Visual Exacto según Imagen)
// Basada en v21/v23 con diseño 1:1 de la captura de pantalla.

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

const KEYS = {
  MASTER: 'rose_master_v1',
  ENTRIES: 'rose_entries_v1',
  SETTINGS: 'rose_settings_v1'
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

let db = null;
let auth = null;

function updateCloudBadge(isOnline) {
  const badge = document.getElementById('cloud-status');
  if(!badge) return;
  if(isOnline) {
    badge.className = 'cloud-status-badge online';
    badge.innerHTML = '<i class="ph ph-cloud-check"></i>';
  } else {
    badge.className = 'cloud-status-badge offline';
    badge.innerHTML = '<i class="ph ph-cloud-slash"></i>';
  }
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
    }).catch(e => { console.error("Cloud failed", e); updateCloudBadge(false); });
  } catch (e) { updateCloudBadge(false); }
}

document.addEventListener('DOMContentLoaded', initApp);

function initApp() {
  setupNavigation();
  setupMasterForm();
  setupRegistryForm();
  setupInventoryFilters();
  setupBackupRestore();
  setupSettings();

  const settings = DB.get(KEYS.SETTINGS);
  if (settings && settings.theme) document.body.setAttribute('data-theme', settings.theme);

  initFirebase();
  refreshAllViews();
  switchView('view-database'); // Iniciamos en la vista solicitada por la imagen
}

function refreshAllViews() {
  renderMasterList();
  populateDropdowns();
  renderRecentEntries();
  renderInventory(document.getElementById('filter-group')?.value || 'general');
}

function setupNavigation() {
  document.querySelectorAll('.nav-item').forEach(btn => {
    btn.onclick = () => switchView(btn.getAttribute('data-target'));
  });
}

function switchView(id) {
  document.querySelectorAll('.view').forEach(v => v.classList.toggle('active', v.id === id));
  document.querySelectorAll('.nav-item').forEach(b => b.classList.toggle('active', b.getAttribute('data-target') === id));
}

// --- MASTER DATA (BASE DE DATOS) ---
function setupMasterForm() {
    const form = document.getElementById('form-master');
    if(form) {
        form.onsubmit = (e) => {
            e.preventDefault();
            const b = document.getElementById('master-bloque').value.trim().toUpperCase();
            const v = document.getElementById('master-variedad').value.trim().toUpperCase();
            const t = parseInt(document.getElementById('master-tallos').value, 10);
            
            const data = DB.get(KEYS.MASTER);
            data.push({ id: DB.addId(), bloque: b, variedad: v, tallosMalla: t, zona: 'Z0', sede: 'PRINCIPAL' });
            DB.set(KEYS.MASTER, data);
            form.reset();
            refreshAllViews();
            showToast("Maestro guardado");
        };
    }

    const mSearch = document.getElementById('masterSearchModal');
    if(document.getElementById('btn-master-search')) {
        document.getElementById('btn-master-search').onclick = () => {
            mSearch.classList.add('active');
            renderSearch('');
        };
    }
    if(document.getElementById('close-search')) document.getElementById('close-search').onclick = () => mSearch.classList.remove('active');
    
    const searchInput = document.getElementById('input-search');
    if(searchInput) searchInput.oninput = (e) => renderSearch(e.target.value.toLowerCase());

    function renderSearch(q) {
        const res = document.getElementById('search-results');
        if(!res) return;
        res.innerHTML = '';
        DB.get(KEYS.MASTER).filter(m => m.variedad.toLowerCase().includes(q) || m.bloque.toLowerCase().includes(q)).forEach(m => {
            const el = document.createElement('div');
            el.className = 'list-item clickable';
            el.innerHTML = `<div class="item-info"><span class="item-title">${m.variedad}</span><span class="item-subtitle">Bloque ${m.bloque}</span></div>`;
            el.onclick = () => { selectMasterForRegistry(m); mSearch.classList.remove('active'); switchView('view-registry'); };
            res.appendChild(el);
        });
    }
}

function selectMasterForRegistry(m) {
    const b = document.getElementById('reg-bloque');
    const v = document.getElementById('reg-variedad');
    const t = document.getElementById('reg-tallos-read');
    if(b) b.value = m.bloque;
    populateDropdowns();
    if(v) v.value = m.id;
    if(t) t.value = m.tallosMalla;
}

function renderMasterList() {
    const list = document.getElementById('master-list-preview');
    if(!list) return;
    list.innerHTML = '';
    DB.get(KEYS.MASTER).forEach(m => {
        list.innerHTML += `<div class="list-item">
            <div class="item-info"><span class="item-title">${m.variedad}</span><span class="item-subtitle">Bloque ${m.bloque}</span></div>
            <button class="btn-text-danger" onclick="deleteMaster('${m.id}')">Eliminar</button>
        </div>`;
    });
}

window.deleteMaster = (id) => {
    if(confirm("¿Eliminar registro maestro?")) {
        DB.set(KEYS.MASTER, DB.get(KEYS.MASTER).filter(m => m.id !== id));
        refreshAllViews();
    }
};

// --- REGISTRY ---
function setupRegistryForm() {
    const form = document.getElementById('form-registry');
    const mInput = document.getElementById('reg-mallas');
    const tInput = document.getElementById('reg-tallos-read');
    const totalDisp = document.getElementById('reg-total-calc');

    if(mInput) mInput.oninput = () => {
        const total = (parseInt(mInput.value) || 0) * (parseInt(tInput.value) || 0);
        if(totalDisp) totalDisp.textContent = total.toLocaleString();
    };

    if(form) {
        form.onsubmit = (e) => {
            e.preventDefault();
            const entries = DB.get(KEYS.ENTRIES);
            const vId = document.getElementById('reg-variedad').value;
            const m = parseInt(mInput.value);
            const t = parseInt(tInput.value);
            entries.push({
                id: DB.addId(),
                masterId: vId,
                mallas: m,
                totalTallos: m * t,
                date: new Date().toISOString(),
                sede: 'PRINCIPAL'
            });
            DB.set(KEYS.ENTRIES, entries);
            form.reset();
            if(totalDisp) totalDisp.textContent = '0';
            refreshAllViews();
            showToast("Registro guardado");
        };
    }
}

function populateDropdowns() {
    const vSelect = document.getElementById('reg-variedad');
    if(!vSelect) return;
    vSelect.innerHTML = '<option value="" disabled selected>Seleccionar Variedad</option>';
    DB.get(KEYS.MASTER).forEach(m => {
        vSelect.innerHTML += `<option value="${m.id}">${m.variedad}</option>`;
    });
}

function renderRecentEntries() {
    const list = document.getElementById('recent-list');
    if(!list) return;
    const today = new Date().toISOString().split('T')[0];
    const data = DB.get(KEYS.ENTRIES).filter(e => e.date.startsWith(today)).reverse();
    const master = DB.get(KEYS.MASTER);
    list.innerHTML = '';
    data.forEach(e => {
        const m = master.find(x => x.id === e.masterId);
        if(m) list.innerHTML += `<div class="list-item"><div class="item-info"><span class="item-title">${m.variedad}</span><span class="item-subtitle">Bloque ${m.bloque} | ${e.mallas} mallas</span></div><div class="item-value">${e.totalTallos}</div></div>`;
    });
}

// --- INVENTORY ---
function setupInventoryFilters() {
    const g = document.getElementById('filter-group');
    if(g) g.onchange = () => renderInventory(g.value);
    if(document.getElementById('btn-export-csv')) document.getElementById('btn-export-csv').onclick = exportCSV;
}

function renderInventory(group) {
    const list = document.getElementById('inventory-list');
    if(!list) return;
    const entries = DB.get(KEYS.ENTRIES);
    const master = DB.get(KEYS.MASTER);
    
    let totalT = 0;
    let totalM = 0;
    
    list.innerHTML = '';
    if(group === 'general') {
        entries.slice().reverse().forEach(e => {
            const m = master.find(x => x.id === e.masterId);
            if(m) {
                totalT += e.totalTallos; totalM += e.mallas;
                list.innerHTML += `<div class="list-item"><div class="item-info"><span class="item-title">${m.variedad}</span><span class="item-subtitle">Bloque ${m.bloque} | ${e.date.split('T')[0]}</span></div><div class="item-value">${e.totalTallos}</div></div>`;
            }
        });
    } else {
        const aggregated = {};
        entries.forEach(e => {
            const m = master.find(x => x.id === e.masterId);
            if(m) {
                let k = (group === 'bloque') ? m.bloque : m.variedad;
                if(!aggregated[k]) aggregated[k] = 0;
                aggregated[k] += e.totalTallos;
                totalT += e.totalTallos; totalM += e.mallas;
            }
        });
        Object.keys(aggregated).forEach(k => {
            list.innerHTML += `<div class="list-item"><div class="item-info"><span class="item-title">${k}</span></div><div class="item-value">${aggregated[k]}</div></div>`;
        });
    }
    document.getElementById('inv-total-tallos').textContent = totalT.toLocaleString();
    document.getElementById('inv-total-mallas').textContent = totalM.toLocaleString();
}

function exportCSV() {
    let csv = "Fecha,Bloque,Variedad,Mallas,Total\n";
    DB.get(KEYS.ENTRIES).forEach(e => {
        const m = DB.get(KEYS.MASTER).find(x => x.id === e.masterId);
        if(m) csv += `${e.date.split('T')[0]},${m.bloque},${m.variedad},${e.mallas},${e.totalTallos}\n`;
    });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    a.download = 'RoseReport.csv'; a.click();
}

// --- BACKUP & SETTINGS ---
function setupBackupRestore() {
    if(document.getElementById('btn-export')) {
        document.getElementById('btn-export').onclick = () => {
            const d = JSON.stringify({ master: DB.get(KEYS.MASTER), entries: DB.get(KEYS.ENTRIES) });
            const a = document.createElement('a');
            a.href = URL.createObjectURL(new Blob([d], { type: 'application/json' }));
            a.download = 'RoseAppBackup.json'; a.click();
        };
    }
    const impFile = document.getElementById('input-import');
    if(impFile) {
        impFile.onchange = (e) => {
            const rd = new FileReader();
            rd.onload = (ev) => {
                const data = JSON.parse(ev.target.result);
                if(data.master) DB.set(KEYS.MASTER, data.master);
                if(data.entries) DB.set(KEYS.ENTRIES, data.entries);
                showToast("Restauración completa");
                setTimeout(() => location.reload(), 1000);
            };
            rd.readAsText(e.target.files[0]);
        };
    }
}

function setupSettings() {
    const t = document.getElementById('theme-select');
    if(t) t.onchange = (e) => {
        document.body.setAttribute('data-theme', e.target.value);
        DB.set(KEYS.SETTINGS, { theme: e.target.value });
    };
}

async function syncToCloud(key, data) {
    if(!db || !auth.currentUser) return;
    try {
        const col = (key === KEYS.MASTER) ? 'master' : 'entries';
        if(data.length > 0) {
            const last = data[data.length - 1];
            const dId = last.id;
            const payload = {...last}; delete payload.id;
            await db.collection(col).doc(dId).set(payload, { merge: true });
        }
    } catch(e) {}
}

async function loadFromCloud() {
    if(!db || !auth.currentUser) return;
    try {
        const mSnap = await db.collection('master').get();
        const mData = mSnap.docs.map(d => ({id: d.id, ...d.data()}));
        if(mData.length > 0) localStorage.setItem(KEYS.MASTER, JSON.stringify(mData));
        
        const eSnap = await db.collection('entries').get();
        const eData = eSnap.docs.map(d => ({id: d.id, ...d.data()}));
        if(eData.length > 0) localStorage.setItem(KEYS.ENTRIES, JSON.stringify(eData));
        
        refreshAllViews();
    } catch(e) {}
}

function showToast(m) {
    const t = document.getElementById('toast');
    if(!t) return;
    t.textContent = m; t.className = 'toast visible';
    setTimeout(() => t.className = 'toast', 2500);
}

window.forceAppRefresh = () => {
    if('serviceWorker' in navigator) navigator.serviceWorker.getRegistrations().then(r => r.forEach(s => s.unregister()));
    caches.keys().then(k => k.forEach(x => caches.delete(x)));
    setTimeout(() => location.href = location.origin + location.pathname + '?v=' + Date.now(), 500);
};
