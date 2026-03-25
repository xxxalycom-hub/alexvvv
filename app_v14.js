// Utility: Database & Sync Wrapper
const DB = {
  get: (key) => JSON.parse(localStorage.getItem(key)) || [],
  set: (key, data) => {
    localStorage.setItem(key, JSON.stringify(data));
    // If Firebase is active, sync certain keys
    if (db && auth && auth.currentUser) {
        if (key === KEYS.MASTER || key === KEYS.ENTRIES) {
            syncToCloud(key, data);
        }
    }
  },
  addId: () => '_' + Math.random().toString(36).substr(2, 9)
};

async function syncToCloud(key, data) {
    try {
        const userId = auth.currentUser.uid;
        await db.collection('users').doc(userId).collection('data').doc(key).set({
            content: JSON.stringify(data),
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
    } catch (e) { console.error("Sync error:", e); }
}

async function loadFromCloud() {
    if (!db || !auth || !auth.currentUser) return;
    try {
        const userId = auth.currentUser.uid;
        const keysToSync = [KEYS.MASTER, KEYS.ENTRIES];
        for (const key of keysToSync) {
            const doc = await db.collection('users').doc(userId).collection('data').doc(key).get();
            if (doc.exists()) {
                const cloudData = JSON.parse(doc.data().content);
                // Simple merge or overwrite? For now, cloud wins if exists
                localStorage.setItem(key, JSON.stringify(cloudData));
            }
        }
        refreshAllViews();
    } catch (e) { console.error("Load error:", e); }
}

// Keys
const KEYS = {
  MASTER: 'rose_master_v1', // {id, zona, bloque, variedad, tallosMalla}
  ENTRIES: 'rose_entries_v1', // {id, masterId, mallas, totalTallos, date}
  SETTINGS: 'rose_settings_v1', // {theme, lang}
  FIREBASE_CONFIG: 'rose_fb_config'
};

const APP_VERSION = "9.5.0";

// --- FIREBASE CONFIG (REAL DATA) ---
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

// Initialize Firebase if config is provided
function initFirebase() {
  try {
    if (typeof firebase === 'undefined') {
        console.warn("Firebase scripts not loaded. Operating in Local Mode.");
        updateCloudBadge(false);
        return;
    }
    if (firebaseConfig.apiKey && firebaseConfig.apiKey !== "TU_API_KEY") {
      firebase.initializeApp(firebaseConfig);
      db = firebase.firestore();
      auth = firebase.auth();
      updateCloudBadge(true);
      
      // Inicio de sesión anónimo para sincronización transparente
      auth.signInAnonymously().catch(e => console.error("Anon auth failed:", e));
      
      checkAuth();
    } else {
      updateCloudBadge(false);
    }
  } catch (e) {
    console.error("Firebase init failed:", e);
    updateCloudBadge(false);
  }
}

function updateCloudBadge(online) {
  const badges = document.querySelectorAll('.cloud-status-badge');
  badges.forEach(b => {
    if (online) {
      b.classList.remove('offline');
      b.classList.add('online');
      b.innerHTML = '<i class="ph-fill ph-cloud-check"></i> Cloud';
      b.title = "Sincronizado";
    } else {
      b.classList.add('offline');
      b.classList.remove('online');
      b.innerHTML = '<i class="ph ph-cloud-slash"></i> Offline';
      b.title = "Modo Local";
    }
  });
}

function checkAuth() {
  auth.onAuthStateChanged(user => {
    // Ya no bloqueamos con pantalla de login
    document.getElementById('view-login').style.display = 'none';
    document.querySelector('.bottom-nav').style.display = 'flex';
    
    // Limpiar estilos inline de todas las vistas
    document.querySelectorAll('.view').forEach(v => v.style.display = '');
    
    if (user) {
      loadFromCloud(); // Cargar datos si hay usuario (aunque sea anónimo)
    }
  });
}

// Funciones de login manual eliminadas para acceso directo 
// (La sincronización ahora es automática vía Anon Auth)

// Translations
const translations = {
  es: {
    nav_master: "Base de Datos",
    nav_registry: "Registro",
    nav_inventory: "Inventario",
    nav_settings: "Ajustes",
    settings_title: "Configuración",
    appearance_section: "Apariencia",
    appearance_subtitle: "Personaliza el aspecto de tu aplicación.",
    theme_label: "TEMA VISUAL",
    theme_dark: "Oscuro Industrial (Predeterminado)",
    theme_light: "Claro Minimalista",
    language_section: "Idioma",
    language_subtitle: "Selecciona tu idioma de preferencia.",
    language_label: "IDIOMA DE LA APP",
    about_section: "Acerca de",
    select_bloque: "Seleccionar Bloque",
    select_variedad: "Seleccionar Variedad",
    total_acc: "TOTAL ACUMULADO",
    master_title: "Base de Datos Maestro",
    master_subtitle: "Define las zonas, bloques y variedades del invernadero.",
    master_zona: "ZONA",
    master_bloque: "BLOQUE",
    master_variedad: "VARIEDAD",
    master_tallos: "TALLOS POR MALLA (ESTÁNDAR)",
    master_save: "GUARDAR MAESTRO",
    master_search: "BUSCAR",
    master_backup_title: "Respaldo de Datos",
    master_backup_subtitle: "Descarga tus datos o restáuralos desde un archivo.",
    master_export: "EXPORTAR",
    master_import: "IMPORTAR",
    reg_title: "Registro de Inventario",
    reg_daily_label: "TALLOS REGISTRADOS HOY",
    reg_new_title: "Nueva Entrada",
    reg_new_subtitle: "Carga de datos de producción diaria",
    reg_bloque_label: "BLOQUE",
    reg_variedad_label: "VARIEDAD",
    reg_tallos_label: "TALLOS POR MALLA (ESTÁNDAR)",
    reg_mallas_label: "CANTIDAD DE MALLAS",
    reg_total_label: "TOTAL TALLOS",
    reg_save: "GUARDAR REGISTRO",
    reg_recent_title: "Registros Recientes",
    inv_title: "Reporte de Inventario",
    inv_stock_label: "CONTROL DE STOCK",
    inv_stock_title: "Existencias Actuales",
    inv_export: "EXPORTAR",
    inv_group_label: "AGRUPAR POR:",
    inv_group_general: "GENERAL (VISTA DETALLADA)",
    inv_group_zona: "ZONA",
    inv_group_bloque: "BLOQUE",
    inv_group_variedad: "VARIEDAD",
    inv_group_totales: "TOTALES ACUMULADOS",
    inv_time_all: "TODOS",
    inv_time_today: "HOY",
    inv_time_week: "SEMANA",
    inv_time_month: "MES",
    inv_tallos_reg: "TALLOS REGISTRADOS",
    search_modal_title: "Buscar Variedad",
    search_placeholder: "Escribe el nombre de la variedad...",
    confirm_delete_group: "¿Eliminar todos los registros agrupados en esta tarjeta?",
    confirm_delete_master: "¿Eliminar este registro maestro? Esto no afectará los datos de inventario ya guardados.",
    no_inventory: "Sin registros de inventario.",
    stems_label: "TALLOS",
    mesh_label: "mallas",
    no_master_records: "No hay registros maestros aún.",
    update_master: "ACTUALIZAR MAESTRO",
    zone_label: "Zona",
    block_label: "Bloque",
    login_title: "Acceso Seguro",
    login_subtitle: "Ingresa para sincronizar con la nube",
    login_email: "CORREO ELECTRÓNICO",
    login_pass: "CONTRASEÑA",
    login_btn: "ENTRAR AL SISTEMA"
  },
  en: {
    nav_master: "Database",
    nav_registry: "Registry",
    nav_inventory: "Inventory",
    nav_settings: "Settings",
    settings_title: "Settings",
    appearance_section: "Appearance",
    appearance_subtitle: "Personalize the look of your app.",
    theme_label: "VISUAL THEME",
    theme_dark: "Industrial Dark (Default)",
    theme_light: "Minimalist Light",
    language_section: "Language",
    language_subtitle: "Select your preferred language.",
    language_label: "APP LANGUAGE",
    about_section: "About",
    select_bloque: "Select Block",
    select_variedad: "Select Variety",
    total_acc: "ACCUMULATED TOTAL",
    master_title: "Master Database",
    master_subtitle: "Define greenhouse zones, blocks, and varieties.",
    master_zona: "ZONE",
    master_bloque: "BLOCK",
    master_variedad: "VARIETY",
    master_tallos: "STEMS PER MESH (STANDARD)",
    master_save: "SAVE MASTER",
    master_search: "SEARCH",
    master_backup_title: "Data Backup",
    master_backup_subtitle: "Download your data or restore from a file.",
    master_export: "EXPORT",
    master_import: "IMPORT",
    reg_title: "Inventory Registry",
    reg_daily_label: "STEMS REGISTERED TODAY",
    reg_new_title: "New Entry",
    reg_new_subtitle: "Upload daily production data",
    reg_bloque_label: "BLOCK",
    reg_variedad_label: "VARIETY",
    reg_tallos_label: "STEMS PER MESH (STANDARD)",
    reg_mallas_label: "MESH QUANTITY",
    reg_total_label: "TOTAL STEMS",
    reg_save: "SAVE RECORD",
    reg_recent_title: "Recent Records",
    inv_title: "Inventory Report",
    inv_stock_label: "STOCK CONTROL",
    inv_stock_title: "Current Stock",
    inv_export: "EXPORT",
    inv_group_label: "GROUP BY:",
    inv_group_general: "GENERAL (DETAILED VIEW)",
    inv_group_zona: "ZONE",
    inv_group_bloque: "BLOCK",
    inv_group_variedad: "VARIETY",
    inv_group_totales: "CUMULATIVE TOTALS",
    inv_time_all: "ALL",
    inv_time_today: "TODAY",
    inv_time_week: "WEEK",
    inv_time_month: "MONTH",
    inv_tallos_reg: "REGISTERED STEMS",
    search_modal_title: "Search Variety",
    search_placeholder: "Type variety name...",
    confirm_delete_group: "Delete all records grouped in this card?",
    confirm_delete_master: "Delete this master record? This will not affect already saved inventory data.",
    no_inventory: "No inventory records.",
    stems_label: "STEMS",
    mesh_label: "mesh",
    no_master_records: "No master records yet.",
    update_master: "UPDATE MASTER",
    zone_label: "Zone",
    block_label: "Block",
    login_title: "Secure Access",
    login_subtitle: "Log in to sync with the cloud",
    login_email: "EMAIL ADDRESS",
    login_pass: "PASSWORD",
    login_btn: "LOG IN"
  }
};

function getTranslation(key) {
  const lang = DB.get(KEYS.SETTINGS).lang || 'es';
  return translations[lang][key] || key;
}

document.addEventListener('DOMContentLoaded', () => {
  initApp();

  const loginForm = document.getElementById('form-login');
  if (loginForm) {
    loginForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const email = document.getElementById('login-email').value;
        const pass = document.getElementById('login-password').value;
        handleLogin(email, pass);
    });
  }

  const btnTogglePass = document.getElementById('btn-toggle-pass');
  if (btnTogglePass) {
    btnTogglePass.addEventListener('click', () => {
      const passInput = document.getElementById('login-password');
      const icon = btnTogglePass.querySelector('i');
      if (passInput.type === 'password') {
        passInput.type = 'text';
        icon.classList.remove('ph-eye');
        icon.classList.add('ph-eye-slash');
      } else {
        passInput.type = 'password';
        icon.classList.remove('ph-eye-slash');
        icon.classList.add('ph-eye');
      }
    });
  }

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(() => { });
  }
});

function initApp() {
  setupNavigation();
  setupMasterForm();
  setupRegistryForm();
  setupInventoryFilters();
  setupTimeFilters();
  setupBackupRestore();
  setupSettings();
  checkUpdates();

  // Load preferences
  let settings = DB.get(KEYS.SETTINGS);
  if (Array.isArray(settings)) settings = {};
  if (settings.theme) document.body.setAttribute('data-theme', settings.theme);
  if (settings.lang) translateApp(settings.lang);

  initFirebase();

  // Initial render
  refreshAllViews();
}

function refreshAllViews() {
  const activeFilter = document.getElementById('filter-group')?.value || 'general';
  
  renderMasterList();
  populateRegistryDropdowns();
  renderRecentEntries();
  updateRegistryTotal();
  renderInventory(activeFilter);
}

// --- NAVIGATION ---
function setupNavigation() {
  const navBtns = document.querySelectorAll('.nav-item');
  const views = document.querySelectorAll('.view');
  const masterPassword = 'admin'; // Nueva contraseña solicitada

  // Track if base de datos has been authenticated in this session
  let isMasterAuthenticated = false;

  navBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const targetId = btn.getAttribute('data-target');

      // Password protection for Base de Datos
      if (targetId === 'view-master' && !btn.classList.contains('active')) {
        if (!isMasterAuthenticated) {
          // Mostrar modal de contraseña
          const modal = document.getElementById('passwordModal');
          const input = document.getElementById('master-pass-input');
          const error = document.getElementById('pass-error');
          const confirmBtn = document.getElementById('pass-confirm');
          const cancelBtn = document.getElementById('pass-cancel');

          modal.classList.add('active');
          input.value = '';
          error.style.display = 'none';
          input.focus();

          const handleConfirm = () => {
            if (input.value === masterPassword) {
              isMasterAuthenticated = true;
              modal.classList.remove('active');
              cleanup();
              // Navegar a la vista
              btn.click();
            } else {
              error.style.display = 'block';
              input.value = '';
              input.focus();
            }
          };

          const handleCancel = () => {
            modal.classList.remove('active');
            cleanup();
          };

          const handleKeydown = (e) => {
            if (e.key === 'Enter') handleConfirm();
            if (e.key === 'Escape') handleCancel();
          };

          const cleanup = () => {
            confirmBtn.removeEventListener('click', handleConfirm);
            cancelBtn.removeEventListener('click', handleCancel);
            input.removeEventListener('keydown', handleKeydown);
          };

          confirmBtn.addEventListener('click', handleConfirm);
          cancelBtn.addEventListener('click', handleCancel);
          input.addEventListener('keydown', handleKeydown);

          return; // Stop navigation until password is verified
        }
      }

      // Toggle nav state
      navBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      // Select view
      views.forEach(v => {
          v.classList.remove('active');
          v.style.display = ''; // Limpiar display inline
      });
      const targetView = document.getElementById(targetId);
      targetView.classList.add('active');
      targetView.style.display = ''; // Asegurar visibilidad

      // Trigger update on view change
      if (targetId === 'view-registry') {
        populateRegistryDropdowns();
        renderRecentEntries();
      } else if (targetId === 'view-inventory') {
        const activeFilter = document.getElementById('filter-group')?.value || 'general';
        renderInventory(activeFilter);
      } else if (targetId === 'view-settings') {
        // Settings view logic if needed
      }
    });
  });
}

// --- BASE DE DATOS MAESTRO ---
function setupMasterForm() {
  const form = document.getElementById('form-master');
  const editIdInput = document.getElementById('master-edit-id');
  const submitBtn = form.querySelector('button[type="submit"]');

  form.addEventListener('submit', (e) => {
    e.preventDefault();

    // Auto captialize properties
    const zona = document.getElementById('master-zona').value.trim().toUpperCase();
    const bloque = document.getElementById('master-bloque').value.trim().toUpperCase();
    const variedad = document.getElementById('master-variedad').value.trim().toUpperCase();
    const tallosMalla = parseInt(document.getElementById('master-tallos').value, 10);
    const editId = editIdInput ? editIdInput.value : '';

    if (!zona || !bloque || !variedad || isNaN(tallosMalla)) return;

    const masterData = DB.get(KEYS.MASTER);

    // Check if combo already exists (but ignore if we are editing the same record)
    const exists = masterData.find(m => m.zona === zona && m.bloque === bloque && m.variedad === variedad);
    if (exists && exists.id !== editId) {
      alert("Esta combinación de Zona, Bloque y Variedad ya existe.");
      return;
    }

    if (editId) {
      // Edit mode
      const index = masterData.findIndex(m => m.id === editId);
      if (index !== -1) {
        masterData[index].zona = zona;
        masterData[index].bloque = bloque;
        masterData[index].variedad = variedad;
        masterData[index].tallosMalla = tallosMalla;
      }
      submitBtn.innerHTML = '<i class="ph ph-floppy-disk"></i> GUARDAR MAESTRO';
      submitBtn.classList.remove('is-edit');
      if (editIdInput) editIdInput.value = '';
    } else {
      // Create mode
      masterData.push({
        id: DB.addId(),
        zona,
        bloque,
        variedad,
        tallosMalla
      });
    }

    DB.set(KEYS.MASTER, masterData);
    form.reset();
    refreshAllViews();
  });

  // Master Search Logic
  const modal = document.getElementById('masterSearchModal');
  const btnOpen = document.getElementById('btn-master-search');
  const btnClose = document.getElementById('close-master-search');
  const searchInput = document.getElementById('input-master-search');
  const resultsDiv = document.getElementById('master-search-results');

  btnOpen.addEventListener('click', () => {
    modal.classList.add('active');
    searchInput.value = '';
    renderMasterSearch('');
    setTimeout(() => searchInput.focus(), 100);
  });

  btnClose.addEventListener('click', () => modal.classList.remove('active'));

  searchInput.addEventListener('input', (e) => {
    renderMasterSearch(e.target.value.toLowerCase());
  });

  function renderMasterSearch(query) {
    const data = DB.get(KEYS.MASTER);
    resultsDiv.innerHTML = '';

    const filtered = data.filter(m =>
      m.variedad.toLowerCase().includes(query) ||
      m.bloque.toLowerCase().includes(query) ||
      m.zona.toLowerCase().includes(query)
    );

    if (filtered.length === 0) {
      resultsDiv.innerHTML = '<p style="color:var(--text-muted); text-align:center; padding:10px;">No se encontraron variedades.</p>';
      return;
    }

    filtered.forEach(m => {
      const el = document.createElement('div');
      el.className = 'list-item clickable';
      el.style.cursor = 'pointer';
      el.innerHTML = `
        <div class="item-info">
          <span class="item-title" style="color: var(--accent-cyan);">${m.variedad}</span>
          <span class="item-meta">Zona: ${m.zona} | Bloque: ${m.bloque} | ${m.tallosMalla} t/m</span>
        </div>
      `;
      el.addEventListener('click', () => {
        modal.classList.remove('active');
        selectVarietyInRegistry(m.id, m.bloque);
      });
      resultsDiv.appendChild(el);
    });
  }
}

function selectVarietyInRegistry(masterId, bloque) {
  const navItems = document.querySelectorAll('.nav-item');
  const registryBtn = Array.from(navItems).find(b => b.getAttribute('data-target') === 'view-registry');

  // Jump to registry view
  if (registryBtn) registryBtn.click();

  const bloqSelect = document.getElementById('reg-bloque');
  const varSelect = document.getElementById('reg-variedad');

  bloqSelect.value = bloque;
  bloqSelect.dispatchEvent(new Event('change'));

  setTimeout(() => {
    varSelect.value = masterId;
    varSelect.dispatchEvent(new Event('change'));
    window.scrollTo(0, 0);
  }, 50);
}

function renderMasterList() {
  const list = document.getElementById('master-list');
  const data = DB.get(KEYS.MASTER);

  list.innerHTML = '';
  if (data.length === 0) {
    list.innerHTML = `<p style="color:var(--text-muted); font-size:0.9rem;" data-i18n="no_master_records">${getTranslation('no_master_records')}</p>`;
    return;
  }

  data.forEach(item => {
    list.innerHTML += `
      <div class="list-item">
        <div class="item-info">
          <span class="item-title">${item.variedad}</span>
          <span class="item-meta">${getTranslation('zone_label')}: ${item.zona} • ${getTranslation('block_label')}: ${item.bloque} • ${item.tallosMalla} ${getTranslation('mesh_label')}</span>
        </div>
        <div class="item-actions">
          <button class="action-icon edit" onclick="editMaster('${item.id}')"><i class="ph ph-pencil-simple"></i></button>
          <button class="action-icon delete" onclick="deleteMaster('${item.id}')"><i class="ph ph-trash"></i></button>
        </div>
      </div>
    `;
  });
}

window.deleteMaster = function (id) {
  if (!confirm(getTranslation('confirm_delete_master'))) return;
  const masterData = DB.get(KEYS.MASTER);
  DB.set(KEYS.MASTER, masterData.filter(m => m.id !== id));
  refreshAllViews();
}

window.editMaster = function (id) {
  const masterData = DB.get(KEYS.MASTER);
  const master = masterData.find(m => m.id === id);
  if (!master) return;

  // Create hidden input if it doesn't exist
  let editIdInput = document.getElementById('master-edit-id');
  if (!editIdInput) {
    editIdInput = document.createElement('input');
    editIdInput.type = 'hidden';
    editIdInput.id = 'master-edit-id';
    document.getElementById('form-master').prepend(editIdInput);
  }

  document.getElementById('master-zona').value = master.zona;
  document.getElementById('master-bloque').value = master.bloque;
  document.getElementById('master-variedad').value = master.variedad;
  document.getElementById('master-tallos').value = master.tallosMalla;

  editIdInput.value = master.id;

  const submitBtn = document.getElementById('form-master').querySelector('button[type="submit"]');
  submitBtn.innerHTML = `<i class="ph ph-pencil-simple"></i> ${getTranslation('update_master')}`;
  submitBtn.classList.add('is-edit');

  document.getElementById('view-master').scrollTo(0, 0);
}


// --- REGISTRO DIARIO ---
function setupRegistryForm() {
  const bloqSelect = document.getElementById('reg-bloque');
  const varSelect = document.getElementById('reg-variedad');
  const mallasInput = document.getElementById('reg-mallas');
  const totalDisplay = document.getElementById('reg-total-calc');
  const tallosRead = document.getElementById('reg-tallos-read');
  const form = document.getElementById('form-registry');
  const submitBtn = document.getElementById('reg-submit-btn');
  const editIdInput = document.getElementById('reg-edit-id');

  // When block changes, update varieties dropdown
  bloqSelect.addEventListener('change', () => {
    const masterData = DB.get(KEYS.MASTER);
    const selectedBloque = bloqSelect.value;

    // Get unique varieties for this block
    const matchingMaster = masterData.filter(m => m.bloque === selectedBloque);
    const selectVarText = getTranslation('select_variedad');

    varSelect.innerHTML = `<option value="" disabled selected>${selectVarText}</option>`;
    matchingMaster.forEach(m => {
      varSelect.innerHTML += `<option value="${m.id}">${m.variedad} (Zona: ${m.zona})</option>`;
    });

    varSelect.disabled = false;
    tallosRead.value = '';
    mallasInput.value = '';
    totalDisplay.textContent = '0';
  });

  // When variety changes, auto-fill standard stems
  varSelect.addEventListener('change', () => {
    const masterData = DB.get(KEYS.MASTER);
    const selectedId = varSelect.value;
    const masterRecord = masterData.find(m => m.id === selectedId);

    if (masterRecord) {
      tallosRead.value = masterRecord.tallosMalla;
      calcTotal();
    }
  });

  // Auto calculate when meshes change
  mallasInput.addEventListener('input', calcTotal);

  function calcTotal() {
    const mallas = parseInt(mallasInput.value, 10) || 0;
    const tallos = parseInt(tallosRead.value, 10) || 0;
    totalDisplay.textContent = mallas * tallos;
  }

  // Submit Form
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const masterId = varSelect.value;
    const mallas = parseInt(mallasInput.value, 10);
    const tallos = parseInt(tallosRead.value, 10);
    const editId = editIdInput.value;

    if (!masterId || !mallas) return;

    const entries = DB.get(KEYS.ENTRIES);

    if (editId) {
      // Edit mode
      const index = entries.findIndex(e => e.id === editId);
      if (index !== -1) {
        entries[index].masterId = masterId;
        entries[index].mallas = mallas;
        entries[index].totalTallos = mallas * tallos;
      }
      // Reset UI
      submitBtn.innerHTML = '<i class="ph ph-floppy-disk"></i> GUARDAR REGISTRO';
      submitBtn.classList.remove('is-edit');
      editIdInput.value = '';
    } else {
      // Create mode
      entries.push({
        id: DB.addId(),
        masterId,
        mallas,
        totalTallos: mallas * tallos,
        date: new Date().toISOString()
      });
    }

    DB.set(KEYS.ENTRIES, entries);

    // Reset form
    bloqSelect.value = '';
    varSelect.innerHTML = '<option value="" disabled selected>Seleccionar Variedad</option>';
    varSelect.disabled = true;
    tallosRead.value = '';
    mallasInput.value = '';
    totalDisplay.textContent = '0';

    refreshAllViews();
    
    // Ocultar teclado en móviles
    if (document.activeElement) {
      document.activeElement.blur();
    }
  });
}

function populateRegistryDropdowns() {
  const bloqSelect = document.getElementById('reg-bloque');
  const masterData = DB.get(KEYS.MASTER);

  // Get unique blocks
  const uniqueBlocks = [...new Set(masterData.map(m => m.bloque))];

  const currentVal = bloqSelect.value;
  bloqSelect.innerHTML = '<option value="" disabled selected>Seleccionar Bloque</option>';

  uniqueBlocks.forEach(b => {
    bloqSelect.innerHTML += `<option value="${b}">${b}</option>`;
  });

  // restore if still exists
  if (uniqueBlocks.includes(currentVal)) {
    bloqSelect.value = currentVal;
  }
}

function renderRecentEntries() {
  const list = document.getElementById('recent-list');
  const card = document.getElementById('recent-records-card');
  const entries = DB.get(KEYS.ENTRIES);
  const masterData = DB.get(KEYS.MASTER);

  if (entries.length === 0) {
    card.style.display = 'none';
    return;
  }

  card.style.display = 'block';
  list.innerHTML = '';

  // Get last 5 entries, newest first
  const recent = [...entries].reverse().slice(0, 5);

  recent.forEach(entry => {
    const master = masterData.find(m => m.id === entry.masterId);
    if (!master) return;

    const dateStr = new Date(entry.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    list.innerHTML += `
      <div class="list-item">
        <div class="item-info">
          <span class="item-title">${master.variedad} </span>
          <span class="item-meta">Blq: ${master.bloque} • ${entry.mallas} mallas • ${entry.totalTallos} tallos (${dateStr})</span>
        </div>
        <div class="item-actions">
          <button class="action-icon edit" onclick="editRegistry('${entry.id}')"><i class="ph ph-pencil-simple"></i></button>
          <button class="action-icon delete" onclick="deleteRegistry('${entry.id}')"><i class="ph ph-trash"></i></button>
        </div>
      </div>
    `;
  });
}

function updateRegistryTotal() {
    const totalEl = document.getElementById('reg-daily-total');
    if(!totalEl) return;
    
    const entries = DB.get(KEYS.ENTRIES);
    const now = new Date();
    // Start of the day (00:00:00)
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    
    const dailyTotal = entries.reduce((acc, e) => {
        const entryDate = new Date(e.date).getTime();
        // Compare if entry time is greater or equal to today's start
        if (entryDate >= startOfToday) {
            return acc + (e.totalTallos || 0);
        }
        return acc;
    }, 0);
    
    totalEl.textContent = dailyTotal.toLocaleString();
}

window.deleteRegistry = function (id) {
  if (!confirm("¿Eliminar este registro de inventario diario?")) return;
  const entries = DB.get(KEYS.ENTRIES);
  DB.set(KEYS.ENTRIES, entries.filter(e => e.id !== id));

  refreshAllViews();
}

window.editRegistry = function (id) {
  const entries = DB.get(KEYS.ENTRIES);
  const entry = entries.find(e => e.id === id);
  if (!entry) return;

  const masterData = DB.get(KEYS.MASTER);
  const master = masterData.find(m => m.id === entry.masterId);
  if (!master) return;

  // Populate form
  const bloqSelect = document.getElementById('reg-bloque');
  const varSelect = document.getElementById('reg-variedad');
  const submitBtn = document.getElementById('reg-submit-btn');
  const editIdInput = document.getElementById('reg-edit-id');

  bloqSelect.value = master.bloque;
  bloqSelect.dispatchEvent(new Event('change')); // Trigger variety load

  // Set variety after dropdown populates
  setTimeout(() => {
    varSelect.value = master.id;
    varSelect.dispatchEvent(new Event('change')); // Trigger tallos read

    document.getElementById('reg-mallas').value = entry.mallas;
    document.getElementById('reg-mallas').dispatchEvent(new Event('input')); // Calculate

    // Update button
    submitBtn.innerHTML = '<i class="ph ph-pencil-simple"></i> ACTUALIZAR REGISTRO';
    submitBtn.classList.add('is-edit');
    editIdInput.value = entry.id;

    window.scrollTo(0, 0);
  }, 50);
}


// --- INVENTARIO (REPORTE) ---
function setupInventoryFilters() {
  const groupSelect = document.getElementById('filter-group');
  if (groupSelect) {
    groupSelect.addEventListener('change', () => {
      renderInventory(groupSelect.value);
    });
  }

  // Export to Excel Button
  const exportBtn = document.getElementById('btn-export-excel');
  if (exportBtn) {
    exportBtn.addEventListener('click', exportToExcel);
  }

  // Refresh Button
  const refreshBtn = document.getElementById('btn-refresh-inventory');
  if (refreshBtn) {
    refreshBtn.addEventListener('click', () => {
      const activeFilter = document.getElementById('filter-group')?.value || 'general';
      renderInventory(activeFilter);
      
      // Visual feedback
      refreshBtn.style.transform = 'rotate(360deg)';
      refreshBtn.style.transition = 'transform 0.5s ease';
      setTimeout(() => {
        refreshBtn.style.transform = 'rotate(0deg)';
        refreshBtn.style.transition = 'none';
      }, 500);
    });
  }
}

function setupTimeFilters() {
  const tabs = document.querySelectorAll('.filter-date');
  tabs.forEach(tab => {
    tab.addEventListener('click', (e) => {
      tabs.forEach(t => t.classList.remove('active'));
      e.target.classList.add('active');
      const activeFilter = document.querySelector('.filter-tab.active').getAttribute('data-filter');
      renderInventory(activeFilter);
    });
  });
}

function setupBackupRestore() {
  const btnExport = document.getElementById('btn-export-json');
  const inputImport = document.getElementById('import-json');

  btnExport.addEventListener('click', () => {
    const data = {
      master: DB.get(KEYS.MASTER),
      entries: DB.get(KEYS.ENTRIES),
      version: '1.0',
      exportDate: new Date().toISOString()
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `RoseApp_Backup_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
  });

  inputImport.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target.result);
        if (data.master && data.entries) {
          if (confirm("¿Restaurar datos? Se sobrescribirá la información actual.")) {
            DB.set(KEYS.MASTER, data.master);
            DB.set(KEYS.ENTRIES, data.entries);
            alert("Datos restaurados correctamente.");
            refreshAllViews();
          }
        } else {
          alert("El archivo no tiene el formato correcto.");
        }
      } catch (err) {
        alert("Error al leer el archivo.");
      }
    };
    reader.readAsText(file);
  });
}

function exportToExcel() {
  const entries = DB.get(KEYS.ENTRIES);
  const masterData = DB.get(KEYS.MASTER);

  if (entries.length === 0) {
    alert("No hay datos para exportar.");
    return;
  }

  // Create an HTML table string with basic styling for Excel
  let tableHtml = `
    <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
    <head>
      <meta charset="utf-8">
      <!--[if gte mso 9]>
      <xml>
        <x:ExcelWorkbook>
          <x:ExcelWorksheets>
            <x:ExcelWorksheet>
              <x:Name>Inventario de Rosas</x:Name>
              <x:WorksheetOptions>
                <x:DisplayGridlines/>
              </x:WorksheetOptions>
            </x:ExcelWorksheet>
          </x:ExcelWorksheets>
        </x:ExcelWorkbook>
      </xml>
      <![endif]-->
      <style>
        table { border-collapse: collapse; width: 100%; font-family: sans-serif; }
        th { background-color: #1d7c42; color: #ffffff; font-weight: bold; border: 1px solid #000; padding: 8px; text-align: center; }
        td { border: 1px solid #ccc; padding: 6px; text-align: center; }
        .title-row { font-size: 1.2rem; font-weight: bold; color: #1d7c42; text-align: center; }
      </style>
    </head>
    <body>
      <table>
        <tr><td colspan="7" class="title-row">REPORTE DE INVENTARIO DE ROSAS - ${new Date().toLocaleDateString()}</td></tr>
        <tr><td></td></tr>
        <tr>
          <th>FECHA</th>
          <th>ZONA</th>
          <th>BLOQUE</th>
          <th>VARIEDAD</th>
          <th>MALLAS</th>
          <th>TALLOS POR MALLA</th>
          <th>TOTAL TALLOS</th>
        </tr>
  `;

  // Sort entries by date (descending) for the report
  const sortedEntries = [...entries].sort((a, b) => new Date(b.date) - new Date(a.date));

  sortedEntries.forEach(e => {
    const m = masterData.find(x => x.id === e.masterId);
    const date = new Date(e.date).toLocaleDateString();

    tableHtml += `
      <tr>
        <td>${date}</td>
        <td>${m ? m.zona : 'N/A'}</td>
        <td>${m ? m.bloque : 'N/A'}</td>
        <td>${m ? m.variedad : 'N/A'}</td>
        <td>${e.mallas}</td>
        <td>${m ? m.tallosMalla : 0}</td>
        <td>${e.totalTallos}</td>
      </tr>
    `;
  });

  tableHtml += `
      </table>
    </body>
    </html>
  `;

  // Create Blob and trigger download
  const blob = new Blob([tableHtml], { type: 'application/vnd.ms-excel' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", `Inventario_Rosas_${new Date().toISOString().slice(0, 10)}.xls`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

function renderInventory(filterMode) {
  const list = document.getElementById('inventory-list');
  const entries = DB.get(KEYS.ENTRIES);
  const masterData = DB.get(KEYS.MASTER);

  if (entries.length === 0) {
    list.innerHTML = `<div class="surface-card"><p style="color:var(--text-muted); text-align:center;" data-i18n="no_inventory">${getTranslation('no_inventory')}</p></div>`;
    return;
  }

  // Join data and parse Dates
  const joinedData = entries.map(e => {
    const m = masterData.find(x => x.id === e.masterId);
    let dateObj = new Date(e.date);
    if (isNaN(dateObj.getTime())) dateObj = new Date();

    return {
      ...e,
      dateObj: dateObj,
      dateStr: dateObj.toLocaleDateString(),
      zona: m ? m.zona : 'Desc',
      bloque: m ? m.bloque : 'Desc',
      variedad: m ? m.variedad : 'Desc',
    };
  });

  // Apply Time Filter
  const timeFilter = document.querySelector('.filter-date.active')?.getAttribute('data-date') || 'all';
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

  const filteredData = joinedData.filter(d => {
    if (timeFilter === 'all') return true;
    const ts = d.dateObj.getTime();

    if (timeFilter === 'today') {
      return ts >= startOfToday;
    }
    if (timeFilter === 'week') {
      const sevenDaysAgo = startOfToday - (7 * 24 * 60 * 60 * 1000);
      return ts >= sevenDaysAgo;
    }
    if (timeFilter === 'month') {
      const thirtyDaysAgo = startOfToday - (30 * 24 * 60 * 60 * 1000);
      return ts >= thirtyDaysAgo;
    }
    return true;
  });

  // Aggregate por Fecha + Filtro
  let aggregated = {};

  filteredData.forEach(d => {
    let groupKey = '';
    let title = '';
    let metaZona = '';
    let metaBloque = '';

    if (filterMode === 'general') {
      groupKey = d.dateStr + '_' + d.masterId;
      title = d.variedad;
      metaZona = d.zona;
      metaBloque = d.bloque;
    } else if (filterMode === 'zona') {
      groupKey = d.dateStr + '_' + d.zona;
      title = `ZONA ${d.zona}`;
    } else if (filterMode === 'bloque') {
      groupKey = d.dateStr + '_' + d.bloque;
      title = `BLOQUE ${d.bloque}`;
      metaZona = `Zona: ${d.zona}`;
    } else if (filterMode === 'variedad') {
      groupKey = d.dateStr + '_' + d.variedad;
      title = d.variedad;
    } else if (filterMode === 'totales') {
      groupKey = 'TOTAL_' + d.variedad;
      title = d.variedad;
    }

    if (!aggregated[groupKey]) {
      const isTotalMode = filterMode === 'totales';
      aggregated[groupKey] = {
        dateStr: isTotalMode ? getTranslation('total_acc') : d.dateStr,
        dateTimestamp: isTotalMode ? 2000000000000 : new Date(d.dateObj.getFullYear(), d.dateObj.getMonth(), d.dateObj.getDate()).getTime(),
        title: title,
        zona: metaZona,
        bloque: metaBloque,
        mallas: 0,
        tallos: 0,
        sortKey: title,
        entryIds: []
      };
    }
    aggregated[groupKey].mallas += d.mallas;
    aggregated[groupKey].tallos += d.totalTallos;
    aggregated[groupKey].entryIds.push(d.id);
  });

  // Convert to array and sort by Date (descending) then by title
  const results = Object.values(aggregated).sort((a, b) => {
    if (b.dateTimestamp !== a.dateTimestamp) {
      return b.dateTimestamp - a.dateTimestamp;
    }
    return a.sortKey.localeCompare(b.sortKey);
  });

  const stemsLabel = getTranslation('inv_tallos_reg');
  const meshLabel = getTranslation('mesh_label');

  list.innerHTML = '';
  let currentDate = null;

  results.forEach(res => {

    if (currentDate !== res.dateStr) {
      list.innerHTML += `<div class="date-divider"><i class="ph ph-calendar-blank"></i> ${res.dateStr}</div>`;
      currentDate = res.dateStr;
    }

    // Build meta html
    let metaHtml = '';
    if (res.zona || res.bloque) {
      metaHtml += `<div class="inv-meta-grid">`;
      if (res.zona) metaHtml += `<div class="meta-block"><span class="meta-label" data-i18n="master_zona">${getTranslation('master_zona')}</span><span class="meta-val">${res.zona}</span></div>`;
      if (res.bloque) metaHtml += `<div class="meta-block"><span class="meta-label" data-i18n="master_bloque">${getTranslation('master_bloque')}</span><span class="meta-val">${res.bloque}</span></div>`;
      metaHtml += `</div>`;
    }

    const idsJson = JSON.stringify(res.entryIds).replace(/"/g, '&quot;');

    list.innerHTML += `
      <div class="inv-card">
        <button onclick="deleteInventoryGroup('${idsJson}')" class="btn-delete-floating">
            <i class="ph ph-trash"></i>
        </button>
        <div class="inv-details">
          <span class="inv-title-bar">${filterMode === 'general' ? getTranslation('master_variedad') : getTranslation('inv_group_' + filterMode)}</span>
          <span class="inv-main-val">${res.title}</span>
          ${metaHtml}
        </div>
        <div class="inv-totals">
          <span class="inv-tot-label" data-i18n="inv_tallos_reg">${stemsLabel}</span>
          <span class="inv-tot-num">${res.tallos.toLocaleString()}</span>
          <span class="inv-mallas-num">${res.mallas.toLocaleString()} ${meshLabel}</span>
        </div>
      </div>
    `;
  });
}

window.deleteInventoryGroup = function (idsJson) {
  if (!confirm(getTranslation('confirm_delete_group'))) return;
  const idsToDelete = JSON.parse(idsJson);
  const entries = DB.get(KEYS.ENTRIES);

  // Remove matched entries
  const newEntries = entries.filter(e => !idsToDelete.includes(e.id));
  DB.set(KEYS.ENTRIES, newEntries);

  refreshAllViews();
}

function setupSettings() {
  const themeSelect = document.getElementById('settings-theme');
  const langSelect = document.getElementById('settings-lang');
  let settings = DB.get(KEYS.SETTINGS);
  
  if (Array.isArray(settings)) settings = {};

  if (themeSelect) {
    if (settings.theme) themeSelect.value = settings.theme;
    themeSelect.addEventListener('change', () => {
      const newTheme = themeSelect.value;
      document.body.setAttribute('data-theme', newTheme);
      settings.theme = newTheme;
      DB.set(KEYS.SETTINGS, settings);
    });
  }

  if (langSelect) {
    if (settings.lang) langSelect.value = settings.lang;
    langSelect.addEventListener('change', () => {
      const newLang = langSelect.value;
      translateApp(newLang);
      settings.lang = newLang;
      DB.set(KEYS.SETTINGS, settings);
    });
  }

  const updateBtn = document.getElementById('btn-update-now');
  if (updateBtn) {
    updateBtn.addEventListener('click', () => {
      if (confirm("La aplicación se reiniciará para aplicar la actualización. ¿Continuar?")) {
        // Limpiar cachés y recargar
        if ('caches' in window) {
          caches.keys().then(keys => {
            Promise.all(keys.map(k => caches.delete(k))).then(() => {
              window.location.reload(true);
            });
          });
        } else {
          window.location.reload(true);
        }
      }
    });
  }
}

async function checkUpdates() {
  const noUpdateEl = document.getElementById('no-update');
  const availableEl = document.getElementById('update-available');
  
  if (!noUpdateEl || !availableEl) return;

  try {
    // Añadimos un timestamp para evitar caché del navegador al consultar la versión
    const response = await fetch(`version.json?t=${Date.now()}`);
    if (!response.ok) return;
    
    const data = await response.json();
    
    if (data.version && data.version !== APP_VERSION) {
      noUpdateEl.style.display = 'none';
      availableEl.style.display = 'block';
      console.log(`Nueva versión detectada: ${data.version}`);
    } else {
      noUpdateEl.style.display = 'block';
      availableEl.style.display = 'none';
    }
  } catch (e) {
    console.warn("No se pudo verificar actualizaciones:", e);
  }
}

function translateApp(lang) {
  const elements = document.querySelectorAll('[data-i18n]');
  elements.forEach(el => {
    const key = el.getAttribute('data-i18n');
    if (translations[lang] && translations[lang][key]) {
      if (el.tagName === 'INPUT' && el.type === 'placeholder') {
        el.placeholder = translations[lang][key];
      } else {
        el.textContent = translations[lang][key];
      }
    }
  });
}
