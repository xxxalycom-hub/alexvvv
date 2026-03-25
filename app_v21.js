// AlexG - Versión 21.0.0 (Restauración de Núcleo + Sin Seguridad)

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
    // Sincronización inyectada abajo
  },
  addId: () => '_' + Math.random().toString(36).substr(2, 9)
};

// Custom modal replace for confirm()
function showConfirm(message, okLabel = 'Eliminar') {
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

const APP_VERSION = "21.2.0";

// --- FIREBASE CONFIG ---
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
  if (typeof firebase === 'undefined') {
    updateCloudBadge(false);
    return;
  }
  
  try {
    if (!firebase.apps.length) {
      firebase.initializeApp(firebaseConfig);
    }
    db = firebase.firestore();
    auth = firebase.auth();
    updateCloudBadge(true);

    // INGRESO ANÓNIMO PARA SINCRONIZACIÓN SIN BLOQUEO
    auth.signInAnonymously().then(() => {
      console.log("Conectado a la nube (Anónimo)");
      loadFromCloud();
    }).catch(e => console.error("Cloud connection failed", e));

  } catch (e) {
    console.error("Firebase init failed:", e);
    updateCloudBadge(false);
  }
}

// Translations
const translations = {
  es: {
    nav_master: "Base de Datos", nav_registry: "Registro", nav_inventory: "Inventario", nav_settings: "Ajustes",
    settings_title: "Configuración", appearance_section: "Apariencia", theme_label: "TEMA VISUAL",
    theme_dark: "Oscuro Industrial", theme_light: "Claro Minimalista",
    master_title: "Base de Datos Maestro", master_save: "GUARDAR MAESTRO", master_search: "BUSCAR",
    reg_title: "Registro Diario", reg_save: "GUARDAR", inv_title: "Reporte de Inventario",
    inv_group_general: "GENERAL (DETALLADA)", inv_group_zona: "ZONA", inv_group_bloque: "BLOQUE",
    inv_group_variedad: "VARIEDAD", inv_group_totales: "TOTALES ACUMULADOS",
    select_sede: "Seleccionar Sede", inv_time_all: "TODOS", sede_label: "Sede", mesh_label: "mallas"
  },
  en: {
    nav_master: "Database", nav_registry: "Registry", nav_inventory: "Inventory", nav_settings: "Settings",
    settings_title: "Settings", appearance_section: "Appearance", theme_label: "VISUAL THEME",
    theme_dark: "Industrial Dark", theme_light: "Minimalist Light",
    master_title: "Master Database", master_save: "SAVE MASTER", master_search: "SEARCH",
    reg_title: "Daily Registry", reg_save: "SAVE", inv_title: "Inventory Report",
    inv_group_general: "GENERAL (DETAILED)", inv_group_zona: "ZONE", inv_group_bloque: "BLOCK",
    inv_group_variedad: "VARIETY", inv_group_totales: "CUMULATIVE TOTALS",
    select_sede: "Select Site", inv_time_all: "ALL", sede_label: "Site", mesh_label: "mesh"
  }
};

function getTranslation(key) {
  const lang = DB.get(KEYS.SETTINGS).lang || 'es';
  if (Array.isArray(lang)) return key; 
  return (translations[lang] && translations[lang][key]) ? translations[lang][key] : key;
}

// ================= APP INIT =================
document.addEventListener('DOMContentLoaded', () => {
  initApp();
});

function initApp() {
  // PERFIL GLOBAL DE ADMINISTRADOR (SIN BLOQUEO)
  window.currentUserProfile = { name: "Usuario AlexG", role: "admin", sede: "ALL", permissions: "delete" };

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
  if (settings.lang) translateApp(settings.lang);

  initFirebase();
  runDataMigration();

  // Initial render
  refreshAllViews();
  switchView('view-registry');
}

function runDataMigration() {
  let masterData = DB.get(KEYS.MASTER);
  let entriesData = DB.get(KEYS.ENTRIES);
  let changed = false;

  const fixSede = (item) => {
    if (!item.sede || item.sede === 'N/A' || item.sede === 'SEDE NORTE') {
      item.sede = 'ROYAL NORTE';
      return true;
    }
    return false;
  };

  if (Array.isArray(masterData)) masterData.forEach(m => { if(fixSede(m)) changed = true; });
  if (Array.isArray(entriesData)) entriesData.forEach(e => { if(fixSede(e)) changed = true; });

  if (changed) {
    DB.set(KEYS.MASTER, masterData);
    DB.set(KEYS.ENTRIES, entriesData);
  }
}

function refreshAllViews() {
  const activeFilter = document.getElementById('filter-group')?.value || 'general';
  renderMasterList();
  populateSedeDropdowns();
  populateRegistryDropdowns();
  renderRecentEntries();
  updateRegistryTotal();
  renderInventory(activeFilter);
}

function populateSedeDropdowns() {
  const masterData = DB.get(KEYS.MASTER);
  const uniqueSedes = [...new Set(masterData.map(m => m.sede).filter(s => s))].sort();
  
  const regSede = document.getElementById('reg-sede');
  const invSede = document.getElementById('filter-sede');
  
  if (regSede) {
    const currentReg = regSede.value;
    regSede.innerHTML = `<option value="" disabled selected>Seleccionar Sede</option>`;
    uniqueSedes.forEach(s => {
      regSede.innerHTML += `<option value="${s.toUpperCase()}">${s.toUpperCase()}</option>`;
    });
    if (uniqueSedes.some(s => s.toUpperCase() === currentReg)) regSede.value = currentReg;
  }
  
  if (invSede) {
    const currentInv = invSede.value;
    invSede.innerHTML = `<option value="TODAS">TODAS LAS SEDES</option>`;
    uniqueSedes.forEach(s => {
      invSede.innerHTML += `<option value="${s.toUpperCase()}">${s.toUpperCase()}</option>`;
    });
    if (uniqueSedes.some(s => s.toUpperCase() === currentInv) || currentInv === 'TODAS') invSede.value = currentInv;
  }
}

// --- NAVIGATION ---
function setupNavigation() {
  const navBtns = document.querySelectorAll('.nav-item');
  navBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const targetId = btn.getAttribute('data-target');
      switchView(targetId);
    });
  });
}

function switchView(targetId) {
  const views = document.querySelectorAll('.view');
  const navBtns = document.querySelectorAll('.nav-item');
  views.forEach(v => {
    v.classList.remove('active');
    if (v.id === targetId) v.classList.add('active');
  });
  navBtns.forEach(b => {
    b.classList.remove('active');
    if (b.getAttribute('data-target') === targetId) b.classList.add('active');
  });
  if (targetId === 'view-registry') {
    populateRegistryDropdowns();
    renderRecentEntries();
  } else if (targetId === 'view-inventory') {
    renderInventory(document.getElementById('filter-group')?.value || 'general');
  }
  window.scrollTo(0, 0);
}

// --- MASTER DATA ---
function setupMasterForm() {
  const form = document.getElementById('form-master');
  if (!form) return;
  
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const zona = document.getElementById('master-zona').value.trim().toUpperCase();
    const bloque = document.getElementById('master-bloque').value.trim().toUpperCase();
    const variedad = document.getElementById('master-variedad').value.trim().toUpperCase();
    const tallosMalla = parseInt(document.getElementById('master-tallos').value, 10);
    const sede = document.getElementById('master-sede').value.trim().toUpperCase();

    if (!zona || !bloque || !variedad || isNaN(tallosMalla) || !sede) return;

    const masterData = DB.get(KEYS.MASTER);
    const exists = masterData.find(m => m.zona === zona && m.bloque === bloque && m.variedad === variedad && m.sede === sede);
    if (exists) { showToast("Esta variedad ya existe en este bloque."); return; }

    masterData.push({ id: DB.addId(), zona, bloque, variedad, tallosMalla, sede });
    DB.set(KEYS.MASTER, masterData);
    form.reset();
    refreshAllViews();
    showToast("Maestro guardado");
  });

  const modal = document.getElementById('masterSearchModal') || { classList: { add:()=>{}, remove:()=>{} } };
  const btnOpen = document.getElementById('btn-master-search');
  const btnClose = document.getElementById('close-master-search');
  const searchInput = document.getElementById('input-master-search');
  const resultsDiv = document.getElementById('master-search-results');

  if (btnOpen) {
    btnOpen.onclick = () => {
      modal.classList.add('active');
      if (searchInput) { searchInput.value = ''; renderMasterSearch(''); setTimeout(() => searchInput.focus(), 100); }
    };
  }
  if (btnClose) btnClose.onclick = () => modal.classList.remove('active');
  if (searchInput) searchInput.oninput = (e) => renderMasterSearch(e.target.value.toLowerCase());

  function renderMasterSearch(query) {
    if(!resultsDiv) return;
    const data = DB.get(KEYS.MASTER);
    resultsDiv.innerHTML = '';
    const filtered = data.filter(m => m.variedad.toLowerCase().includes(query) || m.bloque.toLowerCase().includes(query) || m.zona.toLowerCase().includes(query));
    filtered.forEach(m => {
      const el = document.createElement('div');
      el.className = 'list-item clickable';
      el.innerHTML = `<div class="item-info"><span class="item-title">${m.variedad}</span><span class="item-subtitle">${m.sede} - B${m.bloque} - Z${m.zona}</span></div>`;
      el.onclick = () => { selectMasterForRegistry(m); modal.classList.remove('active'); switchView('view-registry'); };
      resultsDiv.appendChild(el);
    });
  }
}

function selectMasterForRegistry(m) {
  const regSede = document.getElementById('reg-sede');
  const regBloque = document.getElementById('reg-bloque');
  const regVariedad = document.getElementById('reg-variedad');
  const regTallos = document.getElementById('reg-tallos-read');
  if (regSede) regSede.value = m.sede;
  if (regBloque) regBloque.value = m.bloque;
  populateRegistryDropdowns();
  if (regVariedad) regVariedad.value = m.id;
  if (regTallos) regTallos.value = m.tallosMalla;
}

function renderMasterList() {
  const list = document.getElementById('master-list');
  if(!list) return;
  const data = DB.get(KEYS.MASTER);
  list.innerHTML = '';
  data.sort((a,b) => a.variedad.localeCompare(b.variedad)).forEach(m => {
    list.innerHTML += `<div class="list-item">
      <div class="item-info"><span class="item-title">${m.variedad}</span><span class="item-subtitle">${m.sede} | B${m.bloque} | ${m.tallosMalla} t/m</span></div>
      <button class="btn-icon-danger" onclick="deleteMaster('${m.id}')"><i class="ph ph-trash"></i></button>
    </div>`;
  });
}

window.deleteMaster = function(id) {
  showConfirm("¿Eliminar este registro maestro?").then(ok => {
    if (ok) {
      let data = DB.get(KEYS.MASTER);
      DB.set(KEYS.MASTER, data.filter(m => m.id !== id));
      refreshAllViews();
    }
  });
};

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

  if (regVariedad) {
    regVariedad.onchange = () => {
      const m = DB.get(KEYS.MASTER).find(x => x.id === regVariedad.value);
      if (m && regTallos) { regTallos.value = m.tallosMalla; calcTotal(); }
    };
  }

  if (regMallas) regMallas.oninput = calcTotal;

  function calcTotal() {
    const t = parseInt(regTallos?.value) || 0;
    const m = parseInt(regMallas?.value) || 0;
    if (regTotal) regTotal.textContent = (t * m).toLocaleString();
  }

  if (form) {
    form.onsubmit = (e) => {
      e.preventDefault();
      const masterId = regVariedad.value;
      const mallas = parseInt(regMallas.value, 10);
      const tallos = parseInt(regTallos.value, 10);
      const sede = regSede.value;
      if (!masterId || isNaN(mallas) || !sede) return;

      const entries = DB.get(KEYS.ENTRIES);
      entries.push({ id: DB.addId(), masterId, mallas, totalTallos: mallas * tallos, sede, date: new Date().toISOString() });
      DB.set(KEYS.ENTRIES, entries);
      form.reset();
      if (regTotal) regTotal.textContent = '0';
      refreshAllViews();
      showToast("Registro guardado");
    };
  }
}

function populateRegistryDropdowns() {
  const sede = document.getElementById('reg-sede')?.value;
  const bloque = document.getElementById('reg-bloque')?.value.trim().toUpperCase();
  const regVariedad = document.getElementById('reg-variedad');
  if (!regVariedad) return;
  regVariedad.innerHTML = '<option value="" disabled selected>Seleccionar Variedad</option>';
  if (!sede || !bloque) { regVariedad.disabled = true; return; }
  const filtered = DB.get(KEYS.MASTER).filter(m => m.sede === sede && m.bloque === bloque);
  if (filtered.length > 0) {
    regVariedad.disabled = false;
    filtered.forEach(m => { regVariedad.innerHTML += `<option value="${m.id}">${m.variedad}</option>`; });
  } else { regVariedad.disabled = true; }
}

function renderRecentEntries() {
  const list = document.getElementById('recent-list');
  const card = document.getElementById('recent-records-card');
  if (!list) return;
  const entries = DB.get(KEYS.ENTRIES);
  const masterData = DB.get(KEYS.MASTER);
  const today = new Date().toISOString().split('T')[0];
  const filtered = entries.filter(e => e.date.startsWith(today)).reverse().slice(0, 10);

  if (filtered.length === 0) { if(card) card.style.display = 'none'; return; }
  if(card) card.style.display = 'block';
  list.innerHTML = '';
  filtered.forEach(e => {
    const m = masterData.find(md => md.id === e.masterId);
    if (!m) return;
    list.innerHTML += `<div class="list-item">
      <div class="item-info"><span class="item-title">${m.variedad}</span><span class="item-subtitle">${e.sede} | B${m.bloque} | ${e.mallas} mall.</span></div>
      <div style="text-align:right;"><span class="item-value" style="display:block;">${e.totalTallos} t.</span><button class="btn-icon-danger" onclick="deleteEntry('${e.id}')"><i class="ph ph-trash"></i></button></div>
    </div>`;
  });
}

window.deleteEntry = function(id) {
  showConfirm("¿Eliminar este registro?").then(ok => {
    if (ok) {
        DB.set(KEYS.ENTRIES, DB.get(KEYS.ENTRIES).filter(e => e.id !== id));
        refreshAllViews();
    }
  });
};

window.deleteAllRegistry = function() {
    showConfirm("¿BORRAR TODO EL HISTORIAL DE HOY?").then(ok => {
        if (ok) {
            const today = new Date().toISOString().split('T')[0];
            DB.set(KEYS.ENTRIES, DB.get(KEYS.ENTRIES).filter(e => !e.date.startsWith(today)));
            refreshAllViews();
        }
    });
};

function updateRegistryTotal() {
  const tEl = document.getElementById('reg-daily-total');
  const mEl = document.getElementById('reg-daily-mallas');
  const today = new Date().toISOString().split('T')[0];
  const data = DB.get(KEYS.ENTRIES).filter(e => e.date.startsWith(today));
  if (tEl) tEl.textContent = data.reduce((s, c) => s + c.totalTallos, 0).toLocaleString();
  if (mEl) mEl.textContent = data.reduce((s, c) => s + c.mallas, 0).toLocaleString();
}

// --- INVENTORY ---
function setupInventoryFilters() {
  const group = document.getElementById('filter-group');
  const sede = document.getElementById('filter-sede');
  if (group) group.onchange = () => renderInventory(group.value);
  if (sede) sede.onchange = () => renderInventory(group?.value || 'general');
  const btnRefresh = document.getElementById('btn-refresh-inventory');
  if (btnRefresh) btnRefresh.onclick = () => { loadFromCloud(); showToast("Actualizando..."); };
  const btnExcel = document.getElementById('btn-export-excel');
  if (btnExcel) btnExcel.onclick = () => {
    let csv = "Fecha,Sede,Zona,Bloque,Variedad,Mallas,TotalTallos\n";
    DB.get(KEYS.ENTRIES).forEach(e => {
        const m = DB.get(KEYS.MASTER).find(x => x.id === e.masterId);
        if (m) csv += `${e.date.split('T')[0]},${e.sede},${m.zona},${m.bloque},${m.variedad},${e.mallas},${e.totalTallos}\n`;
    });
    const b = new Blob([csv], { type: 'text/csv' });
    const u = URL.createObjectURL(b);
    const a = document.createElement('a');
    a.href = u; a.download = `Reporte_RoseApp.csv`; a.click();
  };
}

function setupTimeFilters() {
    const s = document.getElementById('filter-date-start');
    const e = document.getElementById('filter-date-end');
    const c = document.getElementById('clear-date-filter');
    if (s) s.onchange = () => renderInventory(document.getElementById('filter-group')?.value || 'general');
    if (e) e.onchange = () => renderInventory(document.getElementById('filter-group')?.value || 'general');
    if (c) c.onclick = () => { if(s) s.value=''; if(e) e.value=''; renderInventory('general'); };
}

function renderInventory(groupBy) {
  const list = document.getElementById('inventory-list');
  if (!list) return;
  const entries = DB.get(KEYS.ENTRIES);
  const master = DB.get(KEYS.MASTER);
  const sedeF = document.getElementById('filter-sede')?.value || 'TODAS';
  const dStart = document.getElementById('filter-date-start')?.value;
  const dEnd = document.getElementById('filter-date-end')?.value;

  const filtered = entries.filter(e => {
      if (sedeF !== 'TODAS' && e.sede !== sedeF) return false;
      const d = e.date.split('T')[0];
      if (dStart && d < dStart) return false;
      if (dEnd && d > dEnd) return false;
      return true;
  });

  const tT = filtered.reduce((s,c) => s + c.totalTallos, 0);
  const tM = filtered.reduce((s,c) => s + c.mallas, 0);
  document.getElementById('inv-total-tallos').textContent = tT.toLocaleString();
  document.getElementById('inv-total-mallas').textContent = tM.toLocaleString();

  list.innerHTML = '';
  if (groupBy === 'general') {
    filtered.reverse().forEach(e => {
      const m = master.find(md => md.id === e.masterId);
      if (!m) return;
      list.innerHTML += `<div class="list-item"><div class="item-info"><span class="item-title">${m.variedad}</span><span class="item-subtitle">${e.sede} | B${m.bloque} | ${e.date.split('T')[0]}</span></div><div class="item-value">${e.totalTallos}</div></div>`;
    });
  } else {
    const g = {};
    filtered.forEach(e => {
      const m = master.find(md => md.id === e.masterId);
      if(!m) return;
      let k = (groupBy==='zona'?m.zona:(groupBy==='bloque'?'B'+m.bloque:(groupBy==='variedad'?m.variedad:'TOTAL')));
      if(!g[k]) g[k] = {t:0, m:0};
      g[k].t += e.totalTallos; g[k].m += e.mallas;
    });
    Object.keys(g).sort().forEach(k => {
      list.innerHTML += `<div class="list-item"><div class="item-info"><span class="item-title">${k}</span><span class="item-subtitle">${g[k].m} mallas</span></div><div class="item-value">${g[k].t.toLocaleString()}</div></div>`;
    });
  }
}

// --- SETTINGS ---
function setupSettings() {
  const t = document.getElementById('settings-theme');
  const l = document.getElementById('settings-lang');
  if (t) t.onchange = (e) => { document.body.setAttribute('data-theme', e.target.value); let s = DB.get(KEYS.SETTINGS); s.theme = e.target.value; DB.set(KEYS.SETTINGS, s); };
  if (l) l.onchange = (e) => { translateApp(e.target.value); let s = DB.get(KEYS.SETTINGS); s.lang = e.target.value; DB.set(KEYS.SETTINGS, s); };
}

function translateApp(lang) {
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const k = el.getAttribute('data-i18n');
    if (translations[lang] && translations[lang][k]) el.textContent = translations[lang][k];
  });
}

function setupBackupRestore() {
    const eB = document.getElementById('btn-export-json');
    const iB = document.getElementById('import-json');
    if (eB) eB.onclick = () => {
        const d = { master: DB.get(KEYS.MASTER), entries: DB.get(KEYS.ENTRIES) };
        const u = URL.createObjectURL(new Blob([JSON.stringify(d, null, 2)], { type: 'application/json' }));
        const a = document.createElement('a'); a.href = u; a.download = `Rose_Backup.json`; a.click();
    };
    if (iB) iB.onchange = (ev) => {
        const reader = new FileReader();
        reader.onload = (re) => {
            try {
                const d = JSON.parse(re.target.result);
                if (d.master) DB.set(KEYS.MASTER, d.master);
                if (d.entries) DB.set(KEYS.ENTRIES, d.entries);
                showToast("Restaurado"); setTimeout(() => location.reload(), 500);
            } catch(e) { showToast("Error"); }
        };
        reader.readAsText(ev.target.files[0]);
    };
}

// --- CLOUD SYNC ---
async function syncToCloud(key, data) {
    if (!db || !auth.currentUser) return;
    try {
        const collection = (key === KEYS.MASTER) ? 'master' : 'entries';
        // In v17 style, we sync individual items on change, 
        // but since we want to ensure everything is there, let's sync the whole array 
        // if it's small or the last item if it's large. 
        // For simplicity and matching v17's logic:
        if (Array.isArray(data) && data.length > 0) {
            const last = data[data.length - 1];
            const docId = last.id;
            const cleanData = { ...last };
            delete cleanData.id;
            if (!cleanData.sede) cleanData.sede = window.currentUserProfile.sede;
            await db.collection(collection).doc(docId).set(cleanData, { merge: true });
        }
    } catch (e) { console.error("Sync error:", e); }
}

async function loadFromCloud() {
    if (!db || !auth.currentUser) return;
    try {
        const sede = window.currentUserProfile.sede;
        
        // Cargar MAESTRO
        let masterQuery = db.collection('master');
        if (sede !== 'ALL') masterQuery = masterQuery.where('sede', '==', sede);
        const masterSnap = await masterQuery.get();
        const masterData = masterSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        if (masterData.length > 0) {
            localStorage.setItem(KEYS.MASTER, JSON.stringify(masterData));
        }

        // Cargar REGISTROS (ENTRIES)
        let entriesQuery = db.collection('entries');
        if (sede !== 'ALL') entriesQuery = entriesQuery.where('sede', '==', sede);
        const entriesSnap = await entriesQuery.get();
        const entriesData = entriesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        if (entriesData.length > 0) {
            localStorage.setItem(KEYS.ENTRIES, JSON.stringify(entriesData));
        }

        refreshAllViews();
    } catch (err) {
        console.error("Cloud load failed:", err);
    }
}

// Inyectar Sync en DB.set
const originalSet = DB.set;
DB.set = function(k, v) {
  originalSet(k, v);
  if (k === KEYS.MASTER || k === KEYS.ENTRIES) syncToCloud(k, v);
};
