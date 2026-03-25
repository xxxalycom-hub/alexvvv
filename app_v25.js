/* Rose Inventory App | V25.2.46 | Royal Norte */
// Utility: Database & Sync Wrapper
const DB = {
  get: (key) => JSON.parse(localStorage.getItem(key)) || [],
  set: (key, data) => {
    localStorage.setItem(key, JSON.stringify(data));
  },
  addId: () => '_' + Math.random().toString(36).substr(2, 9)
};

// Custom toast replace
function showToast(message, duration = 3000) {
  const toast = document.getElementById('app-toast');
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add('visible', 'active');
  setTimeout(() => toast.classList.remove('visible', 'active'), duration);
}

// Custom modal replace for confirm()
// Custom modal replace for confirm()
// Custom modal replace for confirm()
async function showConfirm(message) {
  try {
    if (typeof Swal !== 'undefined') {
      const result = await Swal.fire({
        title: '¿ESTÁS SEGURO?',
        text: message,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#f59e0b', // Naranja Industrial
        cancelButtonColor: '#303645',  // Gris Oscuro
        confirmButtonText: '<i class="ph ph-check"></i> SÍ, ELIMINAR',
        cancelButtonText: 'CANCELAR',
        background: '#1c212c',
        color: '#ffffff',
        iconColor: '#f59e0b',
        backdrop: `rgba(0,0,0,0.6)`,
        customClass: {
          popup: 'Industrial-card',
          confirmButton: 'btn-primary',
          cancelButton: 'btn-secondary'
        }
      });
      return result.isConfirmed;
    } else {
      console.warn("SweetAlert2 no cargado, usando confirm nativo.");
      return confirm(message);
    }
  } catch (e) {
    console.error("Error en showConfirm:", e);
    return confirm(message);
  }
}

// --- CLOUD SYNC (Real-Time) ---
let syncUnsubscribes = [];

function startRealTimeSync() {
  if (!db || !auth || !auth.currentUser || !window.currentUserProfile) return;
  const sede = window.currentUserProfile.sede;
  const debugLog = document.getElementById('login-debug');

  // Cleanup existing listeners
  syncUnsubscribes.forEach(unsub => unsub());
  syncUnsubscribes = [];

  if (debugLog) debugLog.textContent += " > Iniciando tiempo real...";

  const collections = [
    { name: 'master', key: KEYS.MASTER },
    { name: 'entries', key: KEYS.ENTRIES }
  ];

  collections.forEach(coll => {
    let query = db.collection(coll.name);
    
    // Filtrar siempre por sede para asegurar la pureza de los datos
    if (sede && sede !== 'ALL') {
      query = query.where('sede', '==', sede);
    }

    const unsub = query.onSnapshot(snapshot => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      // Sincronización local
      DB.set(coll.key, data);
      refreshAllViews();
      
      console.log(`[Sync] ${coll.name} actualizado: ${data.length} registros.`);
    }, err => {
      console.error(`[Sync] Error en ${coll.name}:`, err);
      showToast(`Error de Sync (${coll.name}): ` + err.message, "error");
      if (debugLog) debugLog.textContent += ` > Error ${coll.name}.`;
    });

    syncUnsubscribes.push(unsub);
  });

  if (debugLog) debugLog.textContent += " > Online.";
}

async function saveToCloud(collection, data) {
  if (!db || !window.currentUserProfile) return;
  try {
    const docId = data.id || DB.addId();
    const cleanData = { ...data };
    delete cleanData.id;
    if (!cleanData.sede) cleanData.sede = window.currentUserProfile.sede;
    await db.collection(collection).doc(docId).set(cleanData, { merge: true });
    console.log(`[Cloud] Guardado en ${collection}: ${docId}`);
  } catch (err) {
    console.error(`Cloud save failed (${collection}):`, err);
    showToast(`Error al guardar en nube: ` + err.message, "error");
  }
}

async function deleteFromCloud(collection, docId) {
  if (!db) return;
  try {
    await db.collection(collection).doc(docId).delete();
    console.log(`[Cloud] Eliminado de ${collection}: ${docId}`);
  } catch (err) {
    console.error(`Cloud delete failed (${collection}):`, err);
    showToast(`Error al eliminar en nube: ` + err.message, "error");
  }
}


// Keys
const KEYS = {
  MASTER: 'rose_master_v1', // {id, zona, bloque, variedad, tallosMalla}
  ENTRIES: 'rose_entries_v1', // {id, masterId, mallas, totalTallos, date}
  SETTINGS: 'rose_settings_v1', // {theme, lang}
  FIREBASE_CONFIG: 'rose_fb_config',
  LAST_SEDE: 'rose_last_sede'
};

const APP_VERSION = "25.2.44";

// Fallback user if profile loading completely fails
window.currentUserProfile = { 
  role: 'admin', 
  sede: 'ROYAL NORTE', 
  email: 'admin@roseapp.com',
  access: { master: true, registry: true, reports: true, settings: true },
  permissions: 'delete'
};


//// --- FIREBASE CONFIG (REAL DATA) ---
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

// Initialize Firebase
function initFirebase() {
    if (typeof firebase === 'undefined') {
      console.warn("Firebase scripts not loaded. Local mode.");
      updateCloudBadge(false);
      return;
    }

    try {
      if (!firebase.apps.length) {
        firebase.initializeApp(firebaseConfig);
      }
      db = firebase.firestore();
      auth = firebase.auth();
      
      // Secondary app for admin tasks (if needed)
      if (!firebase.apps.find(a => a.name === 'Secondary')) {
        firebase.initializeApp(firebaseConfig, "Secondary");
      }
      
      updateCloudBadge(true); // Forzar online desde el inicio si Firebase carga
      
      // Escuchar cambios de autenticación
      auth.onAuthStateChanged(user => {
      const bottomNav = document.querySelector('.bottom-nav');

      if (user) {
        console.log("Sesión activa:", user.email);
        
        // CARGAR PERFIL DEL USUARIO
        db.collection('profiles').doc(user.uid).get().then(doc => {
          let profileData = doc.exists ? doc.data() : null;
          
          if (!profileData) {
            profileData = window.currentUserProfile;
            db.collection('profiles').doc(user.uid).set(profileData);
          }
          
          window.currentUserProfile = profileData;
          applyPermissionsToUI(profileData);
          updateCloudBadge(true); // <--- ACTIVAR ONLINE AQUÍ
          
          if (bottomNav) bottomNav.style.display = 'flex';
          
          if (bottomNav) bottomNav.style.display = 'flex';
          
          refreshAllViews(); 
          startRealTimeSync();
          populateSettingsSedeCloud();
          checkUpdates(); // <--- CARGAR INFO DE VERSIÓN Y BUILD
          
          // Por defecto al entrar
          switchView('view-master');
          
        }).catch(err => {
          console.error("Error cargando perfil:", err);
          showToast("Error Firebase: No se pudo cargar perfil (" + err.message + ")", "error");
        });
        
        console.log("Sin sesión. Iniciando auto-login...");
        
        // Fallback: Iniciar sincronización incluso sin login si las reglas son abiertas
        window.currentUserProfile = { 
          role: 'admin', 
          sede: 'ROYAL NORTE', 
          email: 'anonymous@roseapp.com',
          access: { master: true, registry: true, reports: true, settings: true },
          permissions: 'delete'
        };
        startRealTimeSync();
        refreshAllViews();

        auth.signInWithEmailAndPassword('admin@roseapp.com', 'admin')
          .catch(err => {
            console.error("Auto-login failed:", err);
            // Intentar crear si no existe (puede fallar si está deshabilitado en consola)
            if (err.code === 'auth/user-not-found' || err.code === 'auth/invalid-credential' || err.code === 'auth/invalid-login-credentials') {
               auth.createUserWithEmailAndPassword('admin@roseapp.com', 'admin').catch(e => {
                 console.error("No se pudo crear usuario admin:", e.message);
               });
            }
          });
      }
    });

  } catch (e) {
    console.error("Firebase init failed:", e);
    showToast("Error Firebase: " + e.message, "error");
    updateCloudBadge(false);
  }
}

  function updateCloudBadge(isOnline) {
    const badge = document.getElementById('cloud-status');
    const icon = document.getElementById('cloud-badge-icon');
    const text = document.getElementById('cloud-badge-text');
    if (!badge || !icon || !text) return;
    
    if (isOnline) {
      badge.classList.remove('offline');
      badge.classList.add('online');
      icon.classList.remove('ph-cloud-slash');
      icon.classList.add('ph-cloud-check');
      text.textContent = 'En línea';
    } else {
      badge.classList.remove('online');
      badge.classList.add('offline');
      icon.classList.remove('ph-cloud-check');
      icon.classList.add('ph-cloud-slash');
      text.textContent = 'Sin conexión';
    }
  }

// ================= PERMISOS Y SEGURIDAD =================
function applyPermissionsToUI(profile) {
  // Backwards compatibility for old profiles
  if (!profile.access) {
    profile.access = { master: true, registry: true, reports: true, settings: true };
  }
  if (!profile.permissions) {
    profile.permissions = profile.role === 'admin' ? 'delete' : 'edit';
  }

  const btnManageUsers = document.getElementById('btn-manage-users');
  if (btnManageUsers) {
    btnManageUsers.parentElement.style.display = profile.role === 'admin' ? 'block' : 'none';
  }

  // Permisos Nav Bottom (Ventanas)
  const navBtns = document.querySelectorAll('.bottom-nav .nav-item');
  navBtns.forEach(btn => {
    const target = btn.dataset.target;
    if (target === 'view-master' && !profile.access.master) btn.style.display = 'none';
    else if (target === 'view-registry' && !profile.access.registry) btn.style.display = 'none';
    else if (target === 'view-inventory' && !profile.access.reports) btn.style.display = 'none';
    else if (target === 'view-settings' && !profile.access.settings) btn.style.display = 'none';
    else btn.style.display = 'flex';
  });

  // Si no tiene permiso de editar, ocultar botones de guardar
  const saveBtnMaster = document.getElementById('btn-master-save');
  const saveBtnReg = document.getElementById('btn-reg-save');
  const toggleViews = document.querySelectorAll('.master-toggle');
  
  if (profile.permissions === 'view_only') {
    if (saveBtnMaster) saveBtnMaster.style.display = 'none';
    if (saveBtnReg) saveBtnReg.style.display = 'none';
    toggleViews.forEach(el => el.style.display = 'none'); // Ocultar form si visualiza
  } else {
    if (saveBtnMaster) saveBtnMaster.style.display = 'block';
    if (saveBtnReg) saveBtnReg.style.display = 'flex';
    toggleViews.forEach(el => el.style.display = 'flex');
  }

  // Los botones de eliminar ("basurero") se validarán al renderizar listas
}


// ================= USER MANAGEMENT LOGIC (v15.0.0) =================


async function uploadLocalDataToCloud() {
  if (!auth || !auth.currentUser || !db) {
    showToast("No hay conexión con la nube", "error");
    return;
  }

  showToast("Iniciando subida a la nube...", "info");
  
  try {
    // 1. Subir Maestro (Variedades)
    const localMaster = JSON.parse(localStorage.getItem(KEYS.MASTER) || "[]");
    if (localMaster.length > 0) {
      const batch = db.batch();
      localMaster.forEach(item => {
        const docRef = db.collection('master').doc(item.id || String(Date.now() + Math.random()));
        batch.set(docRef, item);
      });
      await batch.commit();
      console.log("[Cloud] Maestro subido exitosamente");
    }

    // 2. Subir Registros (Entries)
    const localEntries = JSON.parse(localStorage.getItem(KEYS.ENTRIES) || "[]");
    if (localEntries.length > 0) {
      const batch = db.batch();
      localEntries.forEach(item => {
        const docRef = db.collection('entries').doc(item.id || String(Date.now() + Math.random()));
        batch.set(docRef, item);
      });
      await batch.commit();
      console.log("[Cloud] Registros subidos exitosamente");
    }

    showToast("¡SUBIDA COMPLETADA CON ÉXITO!", "success");
    // Recargar sedes tras la subida
    populateSettingsSedeCloud();
    
  } catch (err) {
    console.error("Error al subir datos a la nube:", err);
    showToast("Error al subir: " + err.message, "error");
  }
}


function handleLogout() {
  if (confirm("¿Cerrar sesión en RoseApp?")) {
    auth.signOut();
  }
}

async function handleForceUpdate() {
  if (confirm("¿Forzar actualización borrando datos locales de la APP? (No borrará datos en la nube)")) {
    try {
      if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        for (let registration of registrations) {
          await registration.unregister();
        }
      }
      if ('caches' in window) {
        const keys = await caches.keys();
        for (let key of keys) {
          await caches.delete(key);
        }
      }
      localStorage.clear();
      window.location.href = window.location.href.split('?')[0] + '?t=' + Date.now();
    } catch (e) {
      console.error("Error forzando actualización:", e);
      window.location.href = window.location.href.split('?')[0] + '?t=' + Date.now();
    }
  }
}

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
    db_export_btn: "EXPORTAR BACKUP (JSON)",
    db_import_btn: "IMPORTAR REGISTROS",
    db_export_success: "Base de datos exportada con éxito",
    db_import_success: "Importación completada con éxito",
    update_master: "ACTUALIZAR MAESTRO",
    zone_label: "Zona",
    block_label: "Bloque",
    login_title: "Acceso Seguro",
    login_subtitle: "Ingresa para sincronizar con la nube",
    login_email: "CORREO ELECTRÓNICO",
    login_pass: "CONTRASEÑA",
    login_btn: "ENTRAR AL SISTEMA",
    master_sede: "SEDE / POSCOSECHA",
    reg_sede: "SEDE / POSCOSECHA",
    inv_sede_filter: "FILTRAR POR SEDE:",
    select_sede: "Seleccionar Sede",
    sede_label: "Sede"
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
    login_btn: "LOG IN",
    master_sede: "SITE / POST-HARVEST",
    reg_sede: "SITE / POST-HARVEST",
    inv_sede_filter: "FILTER BY SITE:",
    select_sede: "Select Site",
    sede_label: "Site"
  }
};

function getTranslation(key) {
  const lang = DB.get(KEYS.SETTINGS).lang || 'es';
  return translations[lang][key] || key;
}

function initApp() {
  // 1. Core UI Listeners (Moved from DOMContentLoaded)
  const loginForm = document.getElementById('form-login');
  if (loginForm) loginForm.addEventListener('submit', handleLogin);

  const btnTogglePass = document.getElementById('btn-toggle-pass');
  if (btnTogglePass) {
    btnTogglePass.addEventListener('click', (e) => {
      e.preventDefault();
      const passInput = document.getElementById('login-pass');
      const icon = btnTogglePass.querySelector('i');
      if (passInput && icon) {
        const isPass = passInput.type === 'password';
        passInput.type = isPass ? 'text' : 'password';
        icon.classList.replace(isPass ? 'ph-eye' : 'ph-eye-slash', isPass ? 'ph-eye-slash' : 'ph-eye');
      }
    });
  }

  const btnLogout = document.getElementById('btnLogout');
  if (btnLogout) btnLogout.addEventListener('click', handleLogout);

  const btnForceUpdate = document.getElementById('btn-force-update');
  if (btnForceUpdate) btnForceUpdate.addEventListener('click', handleForceUpdate);

  const btnRefresh = document.getElementById('btn-login-refresh');
  if (btnRefresh) {
    btnRefresh.addEventListener('click', () => {
      if (confirm("Actualizar aplicación?")) window.location.reload(true);
    });
  }

  // 2. Setup Modules
  setupNavigation();
  setupMasterForm();
  setupRegistryForm();
  setupInventoryFilters();
  setupTimeFilters();
  setupSettings();

  // 3. Load preferences & Init
  let settings = DB.get(KEYS.SETTINGS);
  if (Array.isArray(settings)) settings = {};
  if (settings.theme) document.body.setAttribute('data-theme', settings.theme);
  if (settings.lang) translateApp(settings.lang);

  initFirebase();
  runDataMigration();
  refreshAllViews();

  // 4. Service Worker
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(() => { });
  }
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
  const entries = DB.get(KEYS.ENTRIES);
  const masterData = DB.get(KEYS.MASTER);
  const masterMap = new Map(masterData.map(m => [m.id, m]));

  renderMasterList(masterData);
  renderInventoryDropdowns(masterData);
  renderRecentEntries(entries, masterMap);
  renderInventory(entries, masterMap);
  updateTotalSummary(entries);
}

function renderInventoryDropdowns(masterDataInput) {
  const masterData = masterDataInput || DB.get(KEYS.MASTER);
  const uniqueSedes = [...new Set(masterData.map(m => String(m.sede || "").toUpperCase()))].filter(Boolean).sort();
  
  const regSede = document.getElementById('reg-sede');
  const invSede = document.getElementById('filter-sede');
  const emptySelectSede = getTranslation('select_sede');
  const allSedesText = getTranslation('inv_time_all');
  
  if (regSede) {
    const currentReg = regSede.value;
    regSede.innerHTML = `<option value="" disabled selected data-i18n="select_sede">${emptySelectSede}</option>`;
    uniqueSedes.forEach(s => {
      regSede.innerHTML += `<option value="${s.toUpperCase()}">${s.toUpperCase()}</option>`;
    });
    if (uniqueSedes.some(s => s.toUpperCase() === currentReg)) {
      regSede.value = currentReg;
    } else {
      const lastSede = localStorage.getItem(KEYS.LAST_SEDE);
      if (lastSede && uniqueSedes.includes(lastSede.toUpperCase())) {
        regSede.value = lastSede.toUpperCase();
      }
    }
    // Re-populate blocks for registry after sede dropdown is updated
    if (window._loadBlocksForSede) {
      window._loadBlocksForSede(regSede.value);
    }
  }
  
  if (invSede) {
    const currentInv = invSede.value;
    const lang = DB.get(KEYS.SETTINGS).lang || 'es';
    const translatedTodas = (translations[lang].inv_time_all === 'TODOS' || translations[lang].inv_time_all === 'ALL') 
                            ? (lang === 'en' ? 'ALL SITES' : 'TODAS LAS SEDES') 
                            : allSedesText;

    invSede.innerHTML = `<option value="TODAS">${translatedTodas}</option>`;
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
  const viewTitle = document.getElementById('view-title');

  views.forEach(v => {
    v.classList.remove('active');
    if (v.id === targetId) v.classList.add('active');
  });

  navBtns.forEach(b => {
    b.classList.remove('active');
    if (b.getAttribute('data-target') === targetId) {
      b.classList.add('active');
      // Actualizar título dinámicamente según v25.2.17 (Imagen)
      if (viewTitle) {
          const titleMap = {
              'view-master': 'BASE DE DATOS',
              'view-registry': 'REGISTRO DE INVENTARIO',
              'view-inventory': 'EXISTENCIAS ACTUALES',
              'view-settings': 'CONFIGURACIÓN'
          };
          viewTitle.textContent = titleMap[targetId] || 'ROSE INVENTORY';
      }
    }
  });

  // Ejecutar actualizaciones según la vista
  if (targetId === 'view-registry') {
    const entries = DB.get(KEYS.ENTRIES);
    const masterData = DB.get(KEYS.MASTER);
    const masterMap = new Map(masterData.map(m => [m.id, m]));
    renderInventoryDropdowns(masterData);
    renderRecentEntries(entries, masterMap);
  } else if (targetId === 'view-inventory') {
    const entries = DB.get(KEYS.ENTRIES);
    const masterData = DB.get(KEYS.MASTER);
    const masterMap = new Map(masterData.map(m => [m.id, m]));
    const activeFilter = document.getElementById('filter-group')?.value || 'general';
    renderInventory(entries, masterMap, activeFilter);
  }

  window.scrollTo(0, 0);
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
    const sede = document.getElementById('master-sede').value;
    const editId = editIdInput ? editIdInput.value : '';

    if (!zona || !bloque || !variedad || isNaN(tallosMalla) || !sede) return;

    const masterData = DB.get(KEYS.MASTER);

    // Check if combo already exists (but ignore if we are editing the same record)
    const exists = masterData.find(m => m.zona === zona && m.bloque === bloque && m.variedad === variedad && m.sede === sede);
    if (exists && exists.id !== editId) {
      alert("Esta combinación de Zona, Bloque y Variedad ya existe.");
      return;
    }

    let itemToSync = null;
    if (editId) {
      // Edit mode
      const index = masterData.findIndex(m => m.id === editId);
      if (index !== -1) {
        masterData[index].zona = zona;
        masterData[index].bloque = bloque;
        masterData[index].variedad = variedad;
        masterData[index].tallosMalla = tallosMalla;
        masterData[index].sede = sede;
        itemToSync = masterData[index];
      }
      submitBtn.innerHTML = '<i class="ph ph-floppy-disk"></i> GUARDAR MAESTRO';
      submitBtn.classList.remove('is-edit');
      if (editIdInput) editIdInput.value = '';
    } else {
      // Create mode
      const newItem = {
        id: DB.addId(),
        zona,
        bloque,
        variedad,
        tallosMalla,
        sede
      };
      masterData.push(newItem);
      itemToSync = newItem;
    }

    DB.set(KEYS.MASTER, masterData);
    if (itemToSync) saveToCloud('master', itemToSync);
    
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


  const btnToggleList = document.getElementById('btn-master-toggle-list');
  const masterList = document.getElementById('master-list');
  if (btnToggleList && masterList) {
    btnToggleList.addEventListener('click', () => {
      const isHidden = masterList.style.display === 'none';
      masterList.style.display = isHidden ? 'block' : 'none';
      if (isHidden) {
        renderMasterList();
        setTimeout(() => masterList.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
      }
    });
  }

  function renderMasterSearch(query) {
    const data = DB.get(KEYS.MASTER);
    resultsDiv.innerHTML = '';

    const filtered = data.filter(m =>
      m.variedad.toLowerCase().includes(query) ||
      m.bloque.toLowerCase().includes(query) ||
      m.zona.toLowerCase().includes(query) ||
      (m.sede && m.sede.toLowerCase().includes(query))
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
          <span class="item-meta">${m.sede || ''} | Zona: ${m.zona} | Bloque: ${m.bloque} | ${m.tallosMalla} t/m</span>
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

  const bloqInput = document.getElementById('reg-bloque');
  const varSelect = document.getElementById('reg-variedad');

  bloqInput.value = bloque;
  bloqInput.dispatchEvent(new Event('change'));

  setTimeout(() => {
    varSelect.value = masterId;
    varSelect.dispatchEvent(new Event('change'));
    window.scrollTo(0, 0);
  }, 50);
}

function renderMasterList(masterDataInput) {
  const list = document.getElementById('master-list');
  const masterData = masterDataInput || DB.get(KEYS.MASTER);

  list.innerHTML = '';
  
  // Header with Export/Import buttons
  const headerActions = document.createElement('div');
  headerActions.style.cssText = "display:flex; gap:10px; padding:12px; background:rgba(255,255,255,0.04); border:1px solid var(--border-color); margin-bottom:15px; border-radius:12px;";
  headerActions.innerHTML = `
    <button class="btn-secondary" onclick="exportDatabase()" style="flex:1; font-size:0.75rem; padding:10px; background:rgba(0,0,0,0.2); border:1px solid var(--border-color); display:flex; align-items:center; justify-content:center; gap:5px;">
      <i class="ph ph-export" style="font-size:1.1rem;"></i> ${getTranslation('db_export_btn')}
    </button>
    <button class="btn-secondary" onclick="triggerImport()" style="flex:1; font-size:0.75rem; padding:10px; background:rgba(0,0,0,0.2); border:1px solid var(--border-color); display:flex; align-items:center; justify-content:center; gap:5px;">
      <i class="ph ph-import" style="font-size:1.1rem;"></i> ${getTranslation('db_import_btn')}
    </button>
  `;
  list.appendChild(headerActions);

  if (masterData.length === 0) {
    const emptyMsg = document.createElement('p');
    emptyMsg.style.cssText = "text-align:center; color:var(--text-muted); padding:2rem;";
    emptyMsg.setAttribute('data-i18n', 'no_master_records');
    emptyMsg.textContent = getTranslation('no_master_records');
    list.appendChild(emptyMsg);
    return;
  }

  // Sort: by block (numerically), then by variety (alphabetically)
  const sorted = [...masterData].sort((a, b) => {
    const bloqA = parseInt(a.bloque, 10) || a.bloque;
    const bloqB = parseInt(b.bloque, 10) || b.bloque;
    if (bloqA < bloqB) return -1;
    if (bloqA > bloqB) return 1;
    return a.variedad.localeCompare(b.variedad);
  });

  let html = '';
  sorted.forEach(item => {
    const canDelete = window.currentUserProfile?.permissions === 'delete';
    const deleteBtnHtml = canDelete ? `<button class="action-icon delete" onclick="deleteMaster('${item.id}')"><i class="ph ph-trash"></i></button>` : '';
    
    html += `
      <div class="list-item">
        <div class="item-info">
          <span class="item-title">${item.variedad}</span>
          <span class="item-meta">${getTranslation('sede_label')}: ${item.sede || 'N/A'} • ${getTranslation('zone_label')}: ${item.zona} • ${getTranslation('block_label')}: ${item.bloque} • ${item.tallosMalla} ${getTranslation('mesh_label')}</span>
        </div>
        <div class="item-actions">
          <button class="action-icon edit" onclick="editMaster('${item.id}')"><i class="ph ph-pencil-simple"></i></button>
          ${deleteBtnHtml}
        </div>
      </div>
    `;
  });
  list.innerHTML += html;
}

window.deleteMaster = function (id) {
  showConfirm(getTranslation('confirm_delete_master')).then(ok => {
    if (!ok) return;
    const masterData = DB.get(KEYS.MASTER);
    DB.set(KEYS.MASTER, masterData.filter(m => m.id !== id));
    
    // Sincronizar borrado con la nube
    deleteFromCloud('master', id);
    
    refreshAllViews();
    showToast('Registro eliminado');
  });
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

  document.getElementById('master-sede').value = master.sede || '';
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
  const btnSearchReg = document.getElementById('btn-master-search-reg-header');
  if (btnSearchReg) {
    btnSearchReg.addEventListener('click', () => {
      document.getElementById('btn-master-search')?.click();
    });
  }

  const bloqSelect = document.getElementById('reg-bloque-select'); // V25.2.22 modificado a select
  const sedeSelect = document.getElementById('reg-sede');
  const varSelect = document.getElementById('reg-variedad');
  const mallasInput = document.getElementById('reg-mallas');
  const totalDisplay = document.getElementById('reg-total-calc');
  const tallosRead = document.getElementById('reg-tallos-read');
  const form = document.getElementById('form-registry');
  const editIdInput = document.getElementById('reg-edit-id');
  
  // Update bloqSelect based on selected sede
  function loadBlocksForSede(sede) {
    const masterData = DB.get(KEYS.MASTER);
    const selSedeUpper = (sede || "").toUpperCase();
    
    const matchingMaster = masterData.filter(m => 
      !selSedeUpper || (m.sede && m.sede.toUpperCase() === selSedeUpper)
    );
    const uniqueBlocks = [...new Set(matchingMaster.map(m => String(m.bloque || "").toUpperCase()))].filter(Boolean);
    
    uniqueBlocks.sort((a,b) => String(a).localeCompare(String(b), undefined, {numeric: true}));
    
    const currentBlock = (bloqSelect.value || "").toUpperCase();
    
    bloqSelect.innerHTML = `<option value="" disabled ${!currentBlock ? 'selected' : ''}>Seleccionar Bloque</option>`;
    uniqueBlocks.forEach(b => {
      bloqSelect.innerHTML += `<option value="${b}" ${b === currentBlock ? 'selected' : ''}>${b}</option>`;
    });
    
    bloqSelect.disabled = uniqueBlocks.length === 0;
    
    // Si el bloque sigue siendo válido, cargar sus variedades
    if (currentBlock && uniqueBlocks.map(b => String(b).toUpperCase()).includes(currentBlock)) {
      loadVarietiesForBlock(currentBlock);
    } else {
      // De lo contrario, limpiar dependencia
      varSelect.innerHTML = `<option value="" disabled selected>${getTranslation('select_variedad')}</option>`;
      varSelect.disabled = true;
      tallosRead.value = '';
      mallasInput.value = '';
      totalDisplay.textContent = '0';
    }
  }

  // Guardar sede al cambiar
  sedeSelect.addEventListener('change', () => {
      localStorage.setItem(KEYS.LAST_SEDE, sedeSelect.value);
      loadBlocksForSede(sedeSelect.value);
  });
  
  // Exponer loadBlocksForSede globalmente para rehidratar desde renderInventoryDropdowns
  window._loadBlocksForSede = loadBlocksForSede;
  
  // Botones flotantes V25.2.17
  const btnSaveFab = document.getElementById('btn-reg-save-fab');
  const btnSearchFab = document.getElementById('btn-open-search-reg');
  
  if (btnSaveFab) {
      btnSaveFab.addEventListener('click', () => {
          document.getElementById('btn-reg-save').click();
      });
  }
  
  if (btnSearchFab) {
      btnSearchFab.addEventListener('click', () => {
          document.getElementById('btn-master-search')?.click();
      });
  }

  function loadVarietiesForBlock(bloque) {
    const masterData = DB.get(KEYS.MASTER);
    const selectedSede = (sedeSelect.value || "").toUpperCase();
    const targetBloque = (bloque || "").toUpperCase();
    
    const matchingMaster = masterData.filter(m => 
      (m.bloque || "").toUpperCase() === targetBloque && 
      (!selectedSede || (m.sede || "").toUpperCase() === selectedSede)
    );
    
    const currentVar = varSelect.value;
    const selectVarText = getTranslation('select_variedad');

    varSelect.innerHTML = `<option value="" disabled ${!currentVar ? 'selected' : ''}>${selectVarText}</option>`;
    
    let isVarStillValid = false;
    matchingMaster.forEach(m => {
      const isSelected = m.variedad === currentVar ? 'selected' : '';
      if (isSelected) isVarStillValid = true;
      varSelect.innerHTML += `<option value="${m.variedad}" ${isSelected}>${m.variedad}</option>`;
    });

    varSelect.disabled = matchingMaster.length === 0;

    if (!isVarStillValid) {
      tallosRead.value = '';
      totalDisplay.textContent = '0';
    } else {
      const masterRecord = matchingMaster.find(m => m.variedad === currentVar);
      if (masterRecord) {
        tallosRead.value = masterRecord.tallosMalla;
        calcTotal();
      }
    }
  }

  // When block select changes, update varieties
  bloqSelect.addEventListener('change', () => {
    loadVarietiesForBlock(bloqSelect.value);
  });

  // When variety changes, auto-fill standard stems
  varSelect.addEventListener('change', () => {
    const masterData = DB.get(KEYS.MASTER);
    const selectedVariety = varSelect.value;
    // En v25.2.17 comparamos por nombre de variedad ya que el select ahora tiene nombres
    const masterRecord = masterData.find(m => m.variedad === selectedVariety);

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
    const sede = sedeSelect.value;
    const mallas = parseInt(mallasInput.value, 10);
    const tallos = parseInt(tallosRead.value, 10);
    const editId = editIdInput.value;

    if (!masterId || !mallas || !sede) return;

    const entries = DB.get(KEYS.ENTRIES);

    let entryToSync = null;
    if (editId) {
      // Edit mode
      const index = entries.findIndex(e => e.id === editId);
      if (index !== -1) {
        entries[index].masterId = masterId;
        entries[index].sede = sede;
        entries[index].mallas = mallas;
        entries[index].totalTallos = mallas * tallos;
        entryToSync = entries[index];
      }
      // Reset UI
      submitBtn.innerHTML = '<i class="ph ph-check-circle"></i> <span>GUARDAR</span>';
      submitBtn.classList.remove('is-edit');
      editIdInput.value = '';
    } else {
      // Create mode
      const newEntry = {
        id: DB.addId(),
        masterId: masterId,
        sede,
        mallas,
        totalTallos: mallas * tallos,
        date: new Date().toISOString(),
        timestamp: Date.now() // Add timestamp for sorting
      };
      entries.push(newEntry);
      entryToSync = newEntry;
    }

    DB.set(KEYS.ENTRIES, entries);
    if (entryToSync) saveToCloud('entries', entryToSync);

    // Reset form (NO resetear sede)
    bloqSelect.value = ''; // Changed from bloqInput to bloqSelect
    // sedeSelect.value = ''; // Se mantiene por petición del usuario
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

function renderRecentEntries(entriesInput, masterMapInput) {
  const entries = entriesInput || DB.get(KEYS.ENTRIES);
  const masterData = !masterMapInput ? DB.get(KEYS.MASTER) : null;
  const masterMap = masterMapInput || new Map(masterData.map(m => [m.id, m]));
  
  const list = document.getElementById('recentEntriesList');
  const card = document.getElementById('recentRecordsCard');
  if (!list || !card) return;

  if (entries.length === 0) {
    card.style.display = 'none';
    return;
  }

  card.style.display = 'block';
  list.innerHTML = '';

  // Wire up collapse toggle (only once)
  const toggle = document.getElementById('recentRecordsToggle');
  const body   = document.getElementById('recentRecordsBody');
  const caret  = document.getElementById('recentRecordsCaret');
  if (toggle && !toggle._toggleSet) {
    toggle._toggleSet = true;
    // Start collapsed
    body.style.display = 'none';
    caret.style.transform = 'rotate(-90deg)';

    toggle.addEventListener('click', () => {
      const isOpen = body.style.display !== 'none';
      body.style.display = isOpen ? 'none' : 'block';
      caret.style.transform = isOpen ? 'rotate(-90deg)' : 'rotate(0deg)';
    });
  }

  // Get last 5 entries, newest first
  const recent = [...entries].sort((a, b) => b.timestamp - a.timestamp).slice(0, 5);

  let html = '';
  recent.forEach(entry => {
    const master = masterMap.get(entry.masterId);
    if (!master) return;

    const dateStr = new Date(entry.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const canDelete = window.currentUserProfile?.permissions === 'delete';
    const deleteBtnHtml = canDelete ? `<button class="action-icon delete" onclick="deleteRegistry('${entry.id}')"><i class="ph ph-trash"></i></button>` : '';

    html += `
      <div class="list-item">
        <div class="item-info">
          <span class="item-title">${master.variedad} </span>
          <span class="item-meta">${master.sede || ''} | Blq: ${master.bloque} • ${entry.mallas} mallas • ${entry.totalTallos} tallos (${dateStr})</span>
        </div>
        <div class="item-actions">
          <button class="action-icon edit" onclick="editRegistry('${entry.id}')"><i class="ph ph-pencil-simple"></i></button>
          ${deleteBtnHtml}
        </div>
      </div>
    `;
  });
  list.innerHTML = html;
}

function updateTotalSummary(entriesInput) {
    const entries = entriesInput || DB.get(KEYS.ENTRIES);
    const dayTallosEl = document.getElementById('reg-daily-tallos');
    const dayMallasEl = document.getElementById('reg-daily-mallas');
    if (!dayTallosEl) return;

    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

    let dailyTallos = 0;
    let dailyMallas = 0;
    entries.forEach(e => {
        if (new Date(e.date).getTime() >= startOfToday) {
            dailyTallos += (e.totalTallos || 0);
            dailyMallas += (e.mallas || 0);
        }
    });

    dayTallosEl.textContent  = dailyTallos.toLocaleString();
    if (dayMallasEl) dayMallasEl.textContent = dailyMallas.toLocaleString();
}

window.deleteRegistry = function (id) {
  showConfirm('¿Eliminar este registro de inventario diario?').then(ok => {
    if (!ok) return;
    const entries = DB.get(KEYS.ENTRIES);
    DB.set(KEYS.ENTRIES, entries.filter(e => e.id !== id));
    refreshAllViews();
    showToast('Registro eliminado');
  });
}

window.editRegistry = function (id) {
  const entries = DB.get(KEYS.ENTRIES);
  const entry = entries.find(e => e.id === id);
  if (!entry) return;

  const masterData = DB.get(KEYS.MASTER);
  const master = masterData.find(m => m.id === entry.masterId);
  if (!master) return;

  // Populate form
  const bloqSelect = document.getElementById('reg-bloque-select'); // Changed from reg-bloque
  const varSelect = document.getElementById('reg-variedad');
  const submitBtn = document.getElementById('reg-submit-btn');
  const editIdInput = document.getElementById('reg-edit-id');

  document.getElementById('reg-sede').value = entry.sede || master.sede || '';
  document.getElementById('reg-sede').dispatchEvent(new Event('change')); // Trigger block load

  // Set block after sede dropdown is updated
  setTimeout(() => {
    bloqSelect.value = master.bloque;
    bloqSelect.dispatchEvent(new Event('change')); // Trigger variety load

    // Set variety after dropdown populates
    setTimeout(() => {
      varSelect.value = master.variedad; // Changed to master.variedad
      varSelect.dispatchEvent(new Event('change')); // Trigger tallos read

      document.getElementById('reg-mallas').value = entry.mallas;
      document.getElementById('reg-mallas').dispatchEvent(new Event('input')); // Calculate

      // Update button
      submitBtn.innerHTML = '<i class="ph ph-pencil-simple"></i> <span>ACTUALIZAR</span>';
      submitBtn.classList.add('is-edit');
      editIdInput.value = entry.id;

      window.scrollTo(0, 0);
    }, 50);
  }, 50);
}


// --- INVENTARIO (REPORTE) ---
function setupInventoryFilters() {
  const groupSelect = document.getElementById('filter-group');
  if (groupSelect) {
    groupSelect.addEventListener('change', () => {
      const entries = DB.get(KEYS.ENTRIES);
      const masterData = DB.get(KEYS.MASTER);
      const masterMap = new Map(masterData.map(m => [m.id, m]));
      renderInventory(entries, masterMap, groupSelect.value);
    });
  }

  const sedeFilter = document.getElementById('filter-sede');
  if (sedeFilter) {
    sedeFilter.addEventListener('change', () => {
      const entries = DB.get(KEYS.ENTRIES);
      const masterData = DB.get(KEYS.MASTER);
      const masterMap = new Map(masterData.map(m => [m.id, m]));
      const activeFilter = document.getElementById('filter-group')?.value || 'general';
      renderInventory(entries, masterMap, activeFilter);
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
      const entries = DB.get(KEYS.ENTRIES);
      const masterData = DB.get(KEYS.MASTER);
      const masterMap = new Map(masterData.map(m => [m.id, m]));
      const activeFilter = document.getElementById('filter-group')?.value || 'general';
      renderInventory(entries, masterMap, activeFilter);
      
      // Visual feedback
      refreshBtn.style.transform = 'rotate(360deg)';
      refreshBtn.style.transition = 'transform 0.5s ease';
      setTimeout(() => {
        refreshBtn.style.transform = 'rotate(0deg)';
        refreshBtn.style.transition = 'none';
      }, 500);
    });
  }

  // Date Range Pickers
  const dateStart = document.getElementById('filter-date-start');
  const dateEnd   = document.getElementById('filter-date-end');
  
  // Default to Today
  const now = new Date();
  const todayStr = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0');
  if (dateStart && !dateStart.value) dateStart.value = todayStr;
  if (dateEnd && !dateEnd.value) dateEnd.value = todayStr;

  const triggerRender = () => {
    const entries = DB.get(KEYS.ENTRIES);
    const masterData = DB.get(KEYS.MASTER);
    const masterMap = new Map(masterData.map(m => [m.id, m]));
    const activeFilter = document.getElementById('filter-group')?.value || 'general';
    renderInventory(entries, masterMap, activeFilter);
  };

  if (dateStart) dateStart.addEventListener('change', triggerRender);
  if (dateEnd)   dateEnd.addEventListener('change', triggerRender);

  // Clear Date Filter
  const clearDate = document.getElementById('clear-date-filter');
  if (clearDate) {
    clearDate.addEventListener('click', () => {
      if (dateStart) dateStart.value = '';
      if (dateEnd)   dateEnd.value = '';
      triggerRender();
    });
  }
}

function setupTimeFilters() {
  const tabs = document.querySelectorAll('.filter-date');
  tabs.forEach(tab => {
    tab.addEventListener('click', (e) => {
      tabs.forEach(t => t.classList.remove('active'));
      e.target.classList.add('active');
      const entries = DB.get(KEYS.ENTRIES);
      const masterData = DB.get(KEYS.MASTER);
      const masterMap = new Map(masterData.map(m => [m.id, m]));
      const activeFilter = document.querySelector('.filter-tab.active').getAttribute('data-filter');
      renderInventory(entries, masterMap, activeFilter);
    });
  });
}


function exportToExcel() {
  const entries = DB.get(KEYS.ENTRIES);
  const masterData = DB.get(KEYS.MASTER);

  if (entries.length === 0) {
    showToast('No hay datos para exportar.');
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
          <th>SEDE</th>
          <th>ZONA</th>
          <th>BLOQUE</th>
          <th>VARIEDAD</th>
          <th>MALLAS</th>
          <th>TALLOS POR MALLA</th>
          <th>TOTAL TALLOS</th>
        </tr>
  `;

  const masterMap = new Map(masterData.map(m => [m.id, m]));
  const sortedEntries = [...entries].sort((a, b) => new Date(b.date) - new Date(a.date));

  sortedEntries.forEach(e => {
    const m = masterMap.get(e.masterId);
    const date = new Date(e.date).toLocaleDateString();

    tableHtml += `
      <tr>
        <td>${date}</td>
        <td>${e.sede || (m ? m.sede : 'N/A')}</td>
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

function renderInventory(entriesInput, masterMapInput, filterMode) {
  const list = document.getElementById('inventory-list');
  const entries = entriesInput || DB.get(KEYS.ENTRIES);
  const masterData = !masterMapInput ? DB.get(KEYS.MASTER) : null;
  const masterMap = masterMapInput || new Map(masterData.map(m => [m.id, m]));
  
  if (!list) return;

  if (entries.length === 0) {
    list.innerHTML = `<div class="surface-card"><p style="color:var(--text-muted); text-align:center;" data-i18n="no_inventory">${getTranslation('no_inventory')}</p></div>`;
    return;
  }

  // Range and Sede filters
  const startDateVal = document.getElementById('filter-date-start')?.value;
  const endDateVal   = document.getElementById('filter-date-end')?.value;
  const sedeFilterVal = document.getElementById('filter-sede')?.value || 'TODAS';

  let totalMallas = 0;
  let totalTallos = 0;
  
  // Aggregate por Fecha + Filtro
  let aggregated = {};

  entries.forEach(e => {
    const m = masterMap.get(e.masterId);
    if (!m) return;

    let dateObj = new Date(e.date);
    if (isNaN(dateObj.getTime())) dateObj = new Date();
    
    // Sede filter
    const effectiveSede = (e.sede || m.sede || 'N/A').toUpperCase();
    if (sedeFilterVal !== 'TODAS' && effectiveSede !== sedeFilterVal) return;

    // Range filter
    const y = dateObj.getFullYear();
    const mm = String(dateObj.getMonth() + 1).padStart(2, '0');
    const dd = String(dateObj.getDate()).padStart(2, '0');
    const entryDateStr = `${y}-${mm}-${dd}`;
    
    if (startDateVal && entryDateStr < startDateVal) return;
    if (endDateVal && entryDateStr > endDateVal) return;

    // Passed filters, count totals
    totalMallas += (e.mallas || 0);
    totalTallos += (e.totalTallos || 0);

    const dateStr = dateObj.toLocaleDateString();
    let groupKey = '';
    let title = '';
    let metaZona = '';
    let metaBloque = '';

    if (filterMode === 'general') {
      groupKey = dateStr + '_' + (e.masterId || m.variedad).toUpperCase();
      title = (m.variedad || "").toUpperCase();
      metaZona = (m.zona || "").toUpperCase();
      metaBloque = (m.bloque || "").toUpperCase();
    } else if (filterMode === 'zona') {
      const zUpper = (m.zona || "").toUpperCase();
      groupKey = dateStr + '_' + zUpper;
      title = `ZONA ${zUpper}`;
    } else if (filterMode === 'bloque') {
      const bUpper = (m.bloque || "").toUpperCase();
      const zUpper = (m.zona || "").toUpperCase();
      groupKey = dateStr + '_' + bUpper;
      title = `BLOQUE ${bUpper}`;
      metaZona = `Zona: ${zUpper}`;
    } else if (filterMode === 'variedad') {
      const vUpper = (m.variedad || "").toUpperCase();
      groupKey = dateStr + '_' + vUpper;
      title = vUpper;
    } else if (filterMode === 'totales') {
      const vUpper = (m.variedad || "").toUpperCase();
      groupKey = 'TOTAL_' + vUpper;
      title = vUpper;
    }

    if (!aggregated[groupKey]) {
      const isTotalMode = filterMode === 'totales';
      aggregated[groupKey] = {
        dateStr: isTotalMode ? getTranslation('total_acc') : dateStr,
        dateTimestamp: isTotalMode ? 2000000000000 : new Date(dateObj.getFullYear(), dateObj.getMonth(), dateObj.getDate()).getTime(),
        title: title,
        zona: metaZona,
        bloque: metaBloque,
        mallas: 0,
        tallos: 0,
        sortKey: title,
        entryIds: []
      };
    }
    aggregated[groupKey].mallas += (e.mallas || 0);
    aggregated[groupKey].tallos += (e.totalTallos || 0);
    aggregated[groupKey].entryIds.push(e.id);
  });

  // Update counters
  const mallasEl = document.getElementById('inv-total-mallas');
  const tallosEl = document.getElementById('inv-total-tallos');
  if (mallasEl) mallasEl.textContent = totalMallas.toLocaleString();
  if (tallosEl) tallosEl.textContent = totalTallos.toLocaleString();

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

  let inventoryHtml = '';
  results.forEach(res => {

    if (currentDate !== res.dateStr) {
      inventoryHtml += `<div class="date-divider"><i class="ph ph-calendar-blank"></i> ${res.dateStr}</div>`;
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
    const canDelete = window.currentUserProfile?.permissions === 'delete';
    const deleteBtnHtml = canDelete ? `<button onclick="deleteInventoryGroup('${idsJson}')" class="btn-delete-card"><i class="ph ph-trash"></i></button>` : '';

    inventoryHtml += `
      <div class="inv-card">
        <div class="inv-details">
          <span class="inv-title-bar">${filterMode === 'general' ? getTranslation('master_variedad') : getTranslation('inv_group_' + filterMode)}</span>
          <span class="inv-main-val">${res.title}</span>
          ${metaHtml}
        </div>
        <div class="inv-right">
          <div class="inv-totals">
            <span class="inv-tot-label">${stemsLabel}</span>
            <span class="inv-tot-num">${res.tallos.toLocaleString()}</span>
            <span class="inv-mallas-num">${res.mallas.toLocaleString()} ${meshLabel}</span>
          </div>
          ${deleteBtnHtml}
        </div>
      </div>
    `;
  });
  list.innerHTML = inventoryHtml;
}

window.deleteInventoryGroup = function (idsJson) {
  showConfirm(getTranslation('confirm_delete_group')).then(ok => {
    if (!ok) return;
    const idsToDelete = JSON.parse(idsJson);
    const entries = DB.get(KEYS.ENTRIES);
    const newEntries = entries.filter(e => !idsToDelete.includes(e.id));
    DB.set(KEYS.ENTRIES, newEntries);

    // Sincronizar borrado con la nube
    idsToDelete.forEach(id => deleteFromCloud('entries', id));

    refreshAllViews();
    showToast('Registros eliminados');
  });
}

function setupSettings() {
  const themeSelect = document.getElementById('theme-select');
  const langSelect = document.getElementById('lang-select');
  const btnConnectSede = document.getElementById('btn-connect-sede');
  const btnCheckVersion = document.getElementById('btn-check-version');

  if (themeSelect) {
    themeSelect.onchange = () => {
      document.body.setAttribute('data-theme', themeSelect.value);
      let s = DB.get(KEYS.SETTINGS);
      if (Array.isArray(s)) s = {};
      s.theme = themeSelect.value;
      DB.set(KEYS.SETTINGS, s);
    };
  }

  if (langSelect) {
    langSelect.onchange = () => {
      translateApp(langSelect.value);
      let s = DB.get(KEYS.SETTINGS);
      if (Array.isArray(s)) s = {};
      s.lang = langSelect.value;
      DB.set(KEYS.SETTINGS, s);
    };
  }

  if (btnConnectSede) {
    btnConnectSede.addEventListener('click', () => {
      console.log("Botón conectar presionado");
      handleCloudSedeChange();
    });
  }

  if (btnCheckVersion) {
    btnCheckVersion.onclick = () => {
      showToast("Buscando actualizaciones...", 1500);
      checkUpdates();
    };
  }

  const btnUploadCloud = document.getElementById('btn-upload-cloud');
  if (btnUploadCloud) {
    btnUploadCloud.addEventListener('click', async () => {
      if (confirm("¿SUBIR DATOS A LA NUBE?\n\nEsto enviará tus variedades y registros locales a Firestore para que otros dispositivos puedan verlos.\n\nUsa esto SOLAMENTE si la nube está vacía.")) {
        await uploadLocalDataToCloud();
      }
    });
  }
}

async function populateSettingsSedeCloud() {
  const select = document.getElementById('settings-sede-cloud');
  if (!select) return;
  
  if (!db) {
    select.innerHTML = '<option value="">Firebase no iniciado</option>';
    return;
  }

  try {
    // Intentar obtener sedes únicas del maestro
    const snapshot = await db.collection('master').limit(500).get();
    if (snapshot.empty) {
      select.innerHTML = '<option value="">No hay sedes en la nube</option>';
      return;
    }

    const sedesSet = new Set();
    snapshot.docs.forEach(doc => {
      const s = doc.data().sede;
      if (s) sedesSet.add(String(s).toUpperCase());
    });

    const sedes = [...sedesSet].sort();
    
    if (sedes.length === 0) {
      select.innerHTML = '<option value="">Sin sedes registradas</option>';
      return;
    }

    select.innerHTML = '<option value="" disabled selected>Seleccionar Sede</option>';
    sedes.forEach(s => {
      select.innerHTML += `<option value="${s}">${s}</option>`;
    });
    
    if (window.currentUserProfile && window.currentUserProfile.sede) {
      select.value = window.currentUserProfile.sede.toUpperCase();
    }
  } catch (err) {
    console.error("Error populateSettingsSedeCloud:", err);
    select.innerHTML = '<option value="">Error de conexión</option>';
  }
}

async function handleCloudSedeChange() {
  const select = document.getElementById('settings-sede-cloud');
  if (!select || !select.value) {
    showToast("Por favor selecciona una sede", "error");
    return;
  }

  if (!db || !auth || !auth.currentUser) {
    showToast("Error de conexión con la nube", "error");
    return;
  }

  const newSede = select.value.toUpperCase();
  const userId = auth.currentUser.uid;

  try {
    showToast("Descargando base de datos...", 3000);
    
    // 1. Actualizar perfil en nube
    await db.collection('profiles').doc(userId).set({ sede: newSede }, { merge: true });
    window.currentUserProfile.sede = newSede;

    // 2. Forzar descarga inmediata (one-time) para 'master' y 'entries'
    const snapMaster = await db.collection('master').get();
    const dataMaster = snapMaster.docs.map(d => ({ id: d.id, ...d.data() }));
    DB.set(KEYS.MASTER, dataMaster);

    const snapEntries = await db.collection('entries').where('sede', '==', newSede).get();
    const dataEntries = snapEntries.docs.map(d => ({ id: d.id, ...d.data() }));
    DB.set(KEYS.ENTRIES, dataEntries);

    // 3. Reiniciar el sync en tiempo real (escuchadores)
    startRealTimeSync();
    if (window.setupRegistryForm) window.setupRegistryForm();
    
    showToast("¡CONECTADO Y SINCRONIZADO! LISTO.", 4000);
    
    setTimeout(() => {
       switchView('view-master');
    }, 1500);

  } catch (err) {
    console.error("Error handleCloudSedeChange:", err);
    showToast("Error al descargar información", "error");
  }
}

async function checkUpdates() {
  const noUpdateEl = document.getElementById('no-update');
  const availableEl = document.getElementById('update-available');
  const buildEl = document.getElementById('display-build');
  
  try {
    const response = await fetch(`version.json?t=${Date.now()}`);
    if (!response.ok) return;
    
    const data = await response.json();
    
    // Actualizar fecha de build en UI
    if (buildEl && data.build) {
      const bDate = new Date(data.build);
      buildEl.textContent = bDate.toLocaleString();
    }
    
    if (data.version && data.version !== APP_VERSION) {
      if (availableEl) availableEl.style.display = 'block';
      if (noUpdateEl) noUpdateEl.style.display = 'none';
      showToast("Nueva versión v" + data.version + " disponible!", 5000);
    } else {
      showToast("Sistema al día. ¡LISTO!", 2000);
    }
  } catch (err) {
    console.error("Error checkUpdates:", err);
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
// --- SINGLE ENTRY POINT ---
document.addEventListener('DOMContentLoaded', initApp);

// --- DB EXPORT / IMPORT ---
window.exportDatabase = function() {
  const data = {
    master: DB.get(KEYS.MASTER) || [],
    entries: DB.get(KEYS.ENTRIES) || [],
    exportDate: new Date().toISOString(),
    version: APP_VERSION
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const dateStr = new Date().toISOString().split('T')[0];
  const timeStr = new Date().toTimeString().split(' ')[0].replace(/:/g, '-');
  a.href = url;
  a.download = `RoseApp_Backup_${dateStr}_${timeStr}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 100);
  showToast(getTranslation('db_export_success'));
};

window.triggerImport = function() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json';
  input.onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const importedData = JSON.parse(event.target.result);
        if (!importedData.master || !importedData.entries) {
          throw new Error("Formato de archivo inválido.");
        }
        
        const currentMaster = DB.get(KEYS.MASTER) || [];
        const currentEntries = DB.get(KEYS.ENTRIES) || [];

        // Filter new records (ID collision check)
        const newMaster = importedData.master.filter(m => !currentMaster.some(cm => cm.id === m.id));
        const newEntries = importedData.entries.filter(en => !currentEntries.some(ce => ce.id === en.id));

        if (newMaster.length === 0 && newEntries.length === 0) {
          showToast("No hay registros nuevos para importar.");
          return;
        }

        const ok = await showConfirm(`¿Añadir ${newMaster.length} variedades y ${newEntries.length} registros nuevos a la base de datos actual?`);
        if (!ok) return;

        // --- OPTIMIZATION: UPDATE LOCAL DB IMMEDIATELY ---
        const updatedMaster = [...currentMaster, ...newMaster];
        const updatedEntries = [...currentEntries, ...newEntries];

        DB.set(KEYS.MASTER, updatedMaster);
        DB.set(KEYS.ENTRIES, updatedEntries);

        // Instant UI feedback
        refreshAllViews();
        showToast("¡Importación local completada! Sincronizando con la nube en segundo plano...", 4000);
        
        // --- BACKGROUND SYNC (Non-blocking) ---
        setTimeout(async () => {
          try {
            console.log("Background sync started...");
            const syncPromises = [];
            newMaster.forEach(item => syncPromises.push(saveToCloud('master', item)));
            // Limit entries sync concurrency if needed, but for now Promise.all is fine
            newEntries.forEach(entry => syncPromises.push(saveToCloud('entries', entry)));
            
            await Promise.all(syncPromises);
            console.log("Background sync finished.");
            showToast(getTranslation('db_import_success') + " (Nube actualizada ✓)");
          } catch (cloudErr) {
            console.error("Cloud Sync Error:", cloudErr);
            showToast("Importación local OK, pero hubo un error con la nube", "error");
          }
        }, 100);

      } catch (err) {
        showToast("Error: " + err.message, "error");
      }
    };
    reader.readAsText(file);
  };
  input.click();
};
