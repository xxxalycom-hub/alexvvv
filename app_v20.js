// Utility: Database & Sync Wrapper
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

// Custom modal replace for confirm()
function showConfirm(message, okLabel = 'Confirmar') {
  return new Promise(resolve => {
    const modal = document.getElementById('confirmModal');
    const msg   = document.getElementById('confirm-message');
    const okBtn = document.getElementById('confirm-ok-btn');
    const cancelBtn = document.getElementById('confirm-cancel-btn');
    msg.textContent = message;
    okBtn.textContent = okLabel;
    modal.classList.add('active');
    const cleanup = (result) => {
      modal.classList.remove('active');
      okBtn.removeEventListener('click', onOk);
      cancelBtn.removeEventListener('click', onCancel);
      resolve(result);
    };
    const onOk     = () => cleanup(true);
    const onCancel = () => cleanup(false);
    okBtn.addEventListener('click', onOk);
    cancelBtn.addEventListener('click', onCancel);
  });
}

// Custom toast replace for alert()
function showToast(message, duration = 2500) {
  const toast = document.getElementById('app-toast');
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add('visible');
  setTimeout(() => toast.classList.remove('visible'), duration);
}

async function syncToCloud(key, data) {
    if (!db) return;
    try {
        const companyId = 'roseapp_main';
        await db.collection('companies').doc(companyId).collection('data').doc(key).set({
            content: JSON.stringify(data),
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
    } catch (e) { console.error("Sync error:", e); }
}

async function loadFromCloud() {
    if (!db || !auth || !auth.currentUser) return;
    try {
        const companyId = 'roseapp_main';
        const keysToSync = [KEYS.MASTER, KEYS.ENTRIES];
        let changedLocal = false;
        
        for (const key of keysToSync) {
            const doc = await db.collection('companies').doc(companyId).collection('data').doc(key).get();
            const localRaw = localStorage.getItem(key);
            const localData = localRaw ? JSON.parse(localRaw) : [];
            
            const exists = typeof doc.exists === 'function' ? doc.exists() : doc.exists;
            
            if (exists) {
                const cloudData = JSON.parse(doc.data().content);
                let mergedData = [...localData];
                let cloudNeedsUpdate = false;

                for (const cloudItem of cloudData) {
                    if (!localData.find(l => l.id === cloudItem.id)) {
                        mergedData.push(cloudItem);
                    }
                }

                if (JSON.stringify(mergedData) !== JSON.stringify(cloudData)) {
                    cloudNeedsUpdate = true;
                }

                const mergedStr = JSON.stringify(mergedData);
                const localStr = localStorage.getItem(key);
                
                if (localStr !== mergedStr) {
                    localStorage.setItem(key, mergedStr);
                    changedLocal = true;
                }

                if (cloudNeedsUpdate) {
                    syncToCloud(key, mergedData);
                }
            } else if (localData.length > 0) {
                syncToCloud(key, localData);
            }
        }
        
        if (changedLocal) {
            refreshAllViews();
        }
    } catch (e) {
        console.error("Load error:", e);
    }
}

// Keys
const KEYS = {
  MASTER: 'rose_master_v1',
  ENTRIES: 'rose_entries_v1',
  SETTINGS: 'rose_settings_v1',
  FIREBASE_CONFIG: 'rose_fb_config',
  SESSION: 'rose_user_session'
};

const APP_VERSION = "20.1.0";

// --- FIREBASE CONFIG ---
const firebaseConfig = {
  apiKey: "AIzaSyCWN1R22xxZ6U9MLuMuzssE8KWegZIR6W0",
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

    auth.signInAnonymously().then(() => {
      loadFromCloud();
    }).catch(e => console.error("Anon auth failed", e));

  } catch (e) {
    console.error("Firebase init failed:", e);
    updateCloudBadge(false);
  }
}

// ================= APP INIT =================
document.addEventListener('DOMContentLoaded', () => {
  initApp();
});

function initApp() {
  // CONFIGURACIÓN GLOBAL: ACCESO TOTAL SIN BLOQUEO
  window.currentUserProfile = { name: "Administrador", role: "admin", sede: "ALL" };

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

  if (Array.isArray(masterData)) {
    masterData.forEach(m => {
      if (!m.sede || m.sede === 'N/A' || m.sede === 'SEDE NORTE') {
        m.sede = 'ROYAL NORTE';
        changed = true;
      }
    });
  }

  if (Array.isArray(entriesData)) {
    entriesData.forEach(e => {
      if (!e.sede || e.sede === 'N/A' || e.sede === 'SEDE NORTE') {
        e.sede = 'ROYAL NORTE';
        changed = true;
      }
    });
  }

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
    const activeFilter = document.getElementById('filter-group')?.value || 'general';
    renderInventory(activeFilter);
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
    if (exists) {
      showToast("Esta variedad ya existe en este bloque.");
      return;
    }

    masterData.push({
      id: DB.addId(),
      zona,
      bloque,
      variedad,
      tallosMalla,
      sede
    });

    DB.set(KEYS.MASTER, masterData);
    form.reset();
    refreshAllViews();
    showToast("Maestro guardado");
  });

  const modal = document.getElementById('masterSearchModal');
  const btnOpen = document.getElementById('btn-master-search');
  const btnClose = document.getElementById('close-master-search');
  const searchInput = document.getElementById('input-master-search');
  const resultsDiv = document.getElementById('master-search-results');

  if (btnOpen) {
    btnOpen.addEventListener('click', () => {
      if (modal) {
        modal.classList.add('active');
        if (searchInput) {
          searchInput.value = '';
          renderMasterSearch('');
          setTimeout(() => searchInput.focus(), 100);
        }
      }
    });
  }

  if (btnClose) btnClose.addEventListener('click', () => modal.classList.remove('active'));

  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      renderMasterSearch(e.target.value.toLowerCase());
    });
  }

  function renderMasterSearch(query) {
    const data = DB.get(KEYS.MASTER);
    resultsDiv.innerHTML = '';

    const filtered = data.filter(m =>
      m.variedad.toLowerCase().includes(query) ||
      m.bloque.toLowerCase().includes(query) ||
      m.zona.toLowerCase().includes(query)
    );

    filtered.forEach(m => {
      const el = document.createElement('div');
      el.className = 'list-item clickable';
      el.innerHTML = `
        <div class="item-info">
          <span class="item-title">${m.variedad}</span>
          <span class="item-subtitle">${m.sede} - B${m.bloque} - Z${m.zona} (${m.tallosMalla} tallos)</span>
        </div>
        <button class="btn-icon-danger" onclick="deleteMaster('${m.id}')"><i class="ph ph-trash"></i></button>
      `;
      el.onclick = (e) => {
        if (e.target.closest('button')) return;
        selectMasterForRegistry(m);
        modal.classList.remove('active');
        switchView('view-registry');
      };
      resultsDiv.appendChild(el);
    });
  }
}

window.deleteMaster = function(id) {
  showConfirm("¿Eliminar este registro maestro?").then(ok => {
    if (ok) {
      let data = DB.get(KEYS.MASTER);
      data = data.filter(m => m.id !== id);
      DB.set(KEYS.MASTER, data);
      refreshAllViews();
    }
  });
};

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

// --- REGISTRY ---
function setupRegistryForm() {
  const form = document.getElementById('form-registry');
  const regSede = document.getElementById('reg-sede');
  const regBloque = document.getElementById('reg-bloque');
  const regVariedad = document.getElementById('reg-variedad');
  const regTallos = document.getElementById('reg-tallos-read');
  const regMallas = document.getElementById('reg-mallas');
  const regTotal = document.getElementById('reg-total-calc');

  if (regSede) regSede.addEventListener('change', populateRegistryDropdowns);
  if (regBloque) regBloque.addEventListener('input', populateRegistryDropdowns);

  if (regVariedad) {
    regVariedad.addEventListener('change', () => {
      const masterData = DB.get(KEYS.MASTER);
      const selected = masterData.find(m => m.id === regVariedad.value);
      if (selected && regTallos) {
        regTallos.value = selected.tallosMalla;
        calculateTotal();
      }
    });
  }

  if (regMallas) regMallas.addEventListener('input', calculateTotal);

  function calculateTotal() {
    const t = parseInt(regTallos.value) || 0;
    const m = parseInt(regMallas.value) || 0;
    if (regTotal) regTotal.textContent = (t * m).toLocaleString();
  }

  if (form) {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const masterId = regVariedad.value;
      const mallas = parseInt(regMallas.value, 10);
      const tallosMalla = parseInt(regTallos.value, 10);
      const sede = regSede.value;

      if (!masterId || isNaN(mallas) || !sede) return;

      const entries = DB.get(KEYS.ENTRIES);
      entries.push({
        id: DB.addId(),
        masterId,
        mallas,
        totalTallos: mallas * tallosMalla,
        sede,
        date: new Date().toISOString()
      });

      DB.set(KEYS.ENTRIES, entries);
      form.reset();
      if (regTotal) regTotal.textContent = '0';
      refreshAllViews();
      showToast("Registro guardado");
    });
  }

  // Header Search in Registry
  const btnSearchHeader = document.getElementById('btn-master-search-reg-header');
  if (btnSearchHeader) {
      btnSearchHeader.onclick = () => {
          const btnMasterSearch = document.getElementById('btn-master-search');
          if (btnMasterSearch) btnMasterSearch.click();
      };
  }
}

function populateRegistryDropdowns() {
  const sede = document.getElementById('reg-sede')?.value;
  const bloque = document.getElementById('reg-bloque')?.value.trim().toUpperCase();
  const regVariedad = document.getElementById('reg-variedad');
  
  if (!regVariedad) return;
  
  regVariedad.innerHTML = '<option value="" disabled selected>Seleccionar Variedad</option>';
  
  if (!sede || !bloque) {
    regVariedad.disabled = true;
    return;
  }

  const masterData = DB.get(KEYS.MASTER);
  const filtered = masterData.filter(m => m.sede === sede && m.bloque === bloque);

  if (filtered.length > 0) {
    regVariedad.disabled = false;
    filtered.forEach(m => {
      regVariedad.innerHTML += `<option value="${m.id}">${m.variedad}</option>`;
    });
  } else {
    regVariedad.disabled = true;
  }
}

function renderRecentEntries() {
  const entries = DB.get(KEYS.ENTRIES);
  const masterData = DB.get(KEYS.MASTER);
  const list = document.getElementById('recent-list');
  const card = document.getElementById('recent-records-card');

  if (!list) return;

  const today = new Date().toISOString().split('T')[0];
  const todayEntries = entries.filter(e => e.date.startsWith(today)).reverse();

  if (todayEntries.length === 0) {
    if (card) card.style.display = 'none';
    return;
  }

  if (card) card.style.display = 'block';
  list.innerHTML = '';

  todayEntries.forEach(e => {
    const m = masterData.find(md => md.id === e.masterId);
    if (!m) return;
    
    const el = document.createElement('div');
    el.className = 'list-item';
    el.innerHTML = `
      <div class="item-info">
        <span class="item-title">${m.variedad}</span>
        <span class="item-subtitle">Sede: ${e.sede} | B${m.bloque} | ${e.mallas} mallas</span>
      </div>
      <div style="text-align:right;">
        <span class="item-value">${e.totalTallos}</span>
        <button class="btn-icon-danger" style="margin-top:5px;" onclick="deleteEntry('${e.id}')"><i class="ph ph-trash"></i></button>
      </div>
    `;
    list.appendChild(el);
  });
}

window.deleteEntry = function(id) {
  showConfirm("¿Eliminar este registro?").then(ok => {
    if (ok) {
      let data = DB.get(KEYS.ENTRIES);
      data = data.filter(e => e.id !== id);
      DB.set(KEYS.ENTRIES, data);
      refreshAllViews();
    }
  });
};

window.deleteAllRegistry = function() {
    showConfirm("¿BORRAR TODO EL HISTORIAL DE HOY?").then(ok => {
        if (ok) {
            const entries = DB.get(KEYS.ENTRIES);
            const today = new Date().toISOString().split('T')[0];
            const filtered = entries.filter(e => !e.date.startsWith(today));
            DB.set(KEYS.ENTRIES, filtered);
            refreshAllViews();
        }
    });
};

function updateRegistryTotal() {
  const entries = DB.get(KEYS.ENTRIES);
  const elTallos = document.getElementById('reg-daily-total');
  const elMallas = document.getElementById('reg-daily-mallas');
  
  const today = new Date().toISOString().split('T')[0];
  const todayData = entries.filter(e => e.date.startsWith(today));
  
  const totalTallos = todayData.reduce((acc, curr) => acc + curr.totalTallos, 0);
  const totalMallas = todayData.reduce((acc, curr) => acc + curr.mallas, 0);
  
  if (elTallos) elTallos.textContent = totalTallos.toLocaleString();
  if (elMallas) elMallas.textContent = totalMallas.toLocaleString();
}

// --- INVENTORY REPORT ---
function setupInventoryFilters() {
  const groupFilter = document.getElementById('filter-group');
  const sedeFilter = document.getElementById('filter-sede');
  
  if (groupFilter) groupFilter.addEventListener('change', (e) => renderInventory(e.target.value));
  if (sedeFilter) sedeFilter.addEventListener('change', () => renderInventory(groupFilter?.value || 'general'));

  const btnRefresh = document.getElementById('btn-refresh-inventory');
  if (btnRefresh) {
    btnRefresh.onclick = () => {
      loadFromCloud();
      showToast("Actualizando datos...");
    };
  }

  const btnExcel = document.getElementById('btn-export-excel');
  if (btnExcel) btnExcel.onclick = exportToCSV;
}

function setupTimeFilters() {
    const start = document.getElementById('filter-date-start');
    const end = document.getElementById('filter-date-end');
    const clear = document.getElementById('clear-date-filter');
    
    if (start) start.onchange = () => renderInventory(document.getElementById('filter-group')?.value || 'general');
    if (end) end.onchange = () => renderInventory(document.getElementById('filter-group')?.value || 'general');
    if (clear) {
        clear.onclick = () => {
            if (start) start.value = '';
            if (end) end.value = '';
            renderInventory(document.getElementById('filter-group')?.value || 'general');
        };
    }
}

function renderInventory(groupBy) {
  const entries = DB.get(KEYS.ENTRIES);
  const masterData = DB.get(KEYS.MASTER);
  const list = document.getElementById('inventory-list');
  const sedeFilter = document.getElementById('filter-sede')?.value || 'TODAS';
  const dateStart = document.getElementById('filter-date-start')?.value;
  const dateEnd = document.getElementById('filter-date-end')?.value;

  if (!list) return;
  list.innerHTML = '';

  let filtered = entries.filter(e => {
      const matchSede = (sedeFilter === 'TODAS' || e.sede === sedeFilter);
      let matchDate = true;
      if (dateStart || dateEnd) {
          const entryDate = e.date.split('T')[0];
          if (dateStart && entryDate < dateStart) matchDate = false;
          if (dateEnd && entryDate > dateEnd) matchDate = false;
      }
      return matchSede && matchDate;
  });

  // Totals update
  const totalTallos = filtered.reduce((acc, curr) => acc + curr.totalTallos, 0);
  const totalMallas = filtered.reduce((acc, curr) => acc + curr.mallas, 0);
  document.getElementById('inv-total-tallos').textContent = totalTallos.toLocaleString();
  document.getElementById('inv-total-mallas').textContent = totalMallas.toLocaleString();

  if (filtered.length === 0) {
    list.innerHTML = '<p class="empty-msg">No hay datos para mostrar.</p>';
    return;
  }

  if (groupBy === 'general') {
    filtered.reverse().forEach(e => {
      const m = masterData.find(md => md.id === e.masterId);
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
    // Grouping logic (zona, bloque, variedad, totales)
    const groups = {};
    filtered.forEach(e => {
        const m = masterData.find(md => md.id === e.masterId);
        if (!m) return;
        let key = "Otro";
        if (groupBy === 'zona') key = m.zona;
        else if (groupBy === 'bloque') key = "Bloque " + m.bloque;
        else if (groupBy === 'variedad') key = m.variedad;
        else if (groupBy === 'totales') key = "TOTALES";

        if (!groups[key]) groups[key] = { tallos: 0, mallas: 0 };
        groups[key].tallos += e.totalTallos;
        groups[key].mallas += e.mallas;
    });

    Object.keys(groups).sort().forEach(key => {
        const el = document.createElement('div');
        el.className = 'list-item';
        el.innerHTML = `
          <div class="item-info">
            <span class="item-title">${key}</span>
            <span class="item-subtitle">${groups[key].mallas} mallas</span>
          </div>
          <div class="item-value">${groups[key].tallos.toLocaleString()}</div>
        `;
        list.appendChild(el);
    });
  }
}

function exportToCSV() {
    const entries = DB.get(KEYS.ENTRIES);
    const masterData = DB.get(KEYS.MASTER);
    if (entries.length === 0) return;

    let csv = "Fecha,Sede,Zona,Bloque,Variedad,Mallas,TotalTallos\n";
    entries.forEach(e => {
        const m = masterData.find(md => md.id === e.masterId);
        if (m) {
            csv += `${e.date.split('T')[0]},${e.sede},${m.zona},${m.bloque},${m.variedad},${e.mallas},${e.totalTallos}\n`;
        }
    });

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Reporte_RoseApp_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
}

// --- SETTINGS ---
function setupSettings() {
  const theme = document.getElementById('settings-theme');
  const lang = document.getElementById('settings-lang');

  if (theme) {
    theme.onchange = (e) => {
      document.body.setAttribute('data-theme', e.target.value);
      const s = DB.get(KEYS.SETTINGS);
      s.theme = e.target.value;
      DB.set(KEYS.SETTINGS, s);
    };
  }

  if (lang) {
    lang.onchange = (e) => {
      translateApp(e.target.value);
      const s = DB.get(KEYS.SETTINGS);
      s.lang = e.target.value;
      DB.set(KEYS.SETTINGS, s);
    };
  }
}

function translateApp(lang) {
    // Basic translation logic (placeholder for full i18n)
    document.querySelectorAll('[data-i18n]').forEach(el => {
        // ... translation logic ...
    });
}

function setupBackupRestore() {
    const btnExp = document.getElementById('btn-export-json');
    const inputImp = document.getElementById('import-json');

    if (btnExp) {
        btnExp.onclick = () => {
            const data = {
                master: DB.get(KEYS.MASTER),
                entries: DB.get(KEYS.ENTRIES),
                settings: DB.get(KEYS.SETTINGS)
            };
            const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `RoseApp_Backup_${new Date().toISOString().split('T')[0]}.json`;
            a.click();
        };
    }

    if (inputImp) {
        inputImp.onchange = (e) => {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (re) => {
                try {
                    const data = JSON.parse(re.target.result);
                    if (data.master) DB.set(KEYS.MASTER, data.master);
                    if (data.entries) DB.set(KEYS.ENTRIES, data.entries);
                    if (data.settings) DB.set(KEYS.SETTINGS, data.settings);
                    showToast("Restauración exitosa");
                    setTimeout(() => location.reload(), 1000);
                } catch (err) {
                    showToast("Error al importar archivo");
                }
            };
            reader.readAsText(file);
        };
    }
}
