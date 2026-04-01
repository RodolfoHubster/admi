// =========================================================
// SISTEMA CENTRALIZADO DE ALMACENAMIENTO
// localStorage (principal) + Firebase (respaldo automático)
// =========================================================

const STORAGE_KEYS = {
    perfumes:    'perfume_inventory_v1',
    ventas:      'perfume_sales_v1',
    gastos:      'perfume_expenses_v1',
    plantillas:  'perfume_templates_v1',
    pagos:       'perfume_payouts_v1',
    sugerencias: 'sugerencias_db',
    clientes:    'clientes_db',
    mensajes:    'mensajes_db',
    config:      'config_db',
    decants_fuentes: 'fitoscents_decants_fuentes_v1',
    decants_ventas:  'fitoscents_decants_ventas_v1'  
};

// =========================================================
// LEER
// =========================================================
function getData(key) {
    try {
        const data = localStorage.getItem(STORAGE_KEYS[key]);
        if (!data) return key === 'config' ? {} : [];
        return JSON.parse(data);
    } catch (error) {
        console.error(`❌ Error al cargar ${key}:`, error);
        return key === 'config' ? {} : [];
    }
}

// =========================================================
// GUARDAR — localStorage primero, Firebase en segundo plano
// =========================================================
function setData(key, data) {
    try {
        localStorage.setItem(STORAGE_KEYS[key], JSON.stringify(data));
        if (typeof setDataCloud === 'function') {
            setDataCloud(key, data)
                .then(() => console.log(`☁️ ${key} sincronizado con Firebase`))
                .catch(err => console.warn(`⚠️ Firebase offline, solo guardado local:`, err));
        }
        return true;
    } catch (error) {
        console.error(`❌ Error al guardar ${key}:`, error);
        showToast(`Error al guardar ${key}. Verifica el espacio disponible.`, 'error');
        return false;
    }
}

// =========================================================
// RESTAURAR DESDE FIREBASE
// =========================================================
async function restaurarDesdeFirebase() {
    if (typeof getDataCloud !== 'function') {
        return showToast('Firebase no está conectado.', 'error');
    }
    const claves = ['perfumes', 'ventas', 'pagos', 'gastos', 'plantillas', 'decants_fuentes', 'decants_ventas'];
        let total = 0;
    const log = [];
    for (const key of claves) {
        try {
            const data = await getDataCloud(key);
            if (Array.isArray(data) && data.length > 0) {
                localStorage.setItem(STORAGE_KEYS[key], JSON.stringify(data));
                total += data.length;
                log.push(`✅ ${key}: ${data.length} items`);
            } else {
                log.push(`⚪ ${key}: vacío`);
            }
        } catch(e) {
            log.push(`❌ ${key}: error`);
        }
    }
    showToast(`Restauración completa! ${total} registros. Recarga la página.`, 'success');
    console.log('Restauración:', log.join(' | '));
}
window.restaurarDesdeFirebase = restaurarDesdeFirebase;

// =========================================================
// EXPORTAR TODO
// =========================================================
function exportarTodo() {
    const backup = {
        version: '1.1',
        fecha: new Date().toISOString(),
        datos: {},
        metadata: { total_items: 0, categorias: [] }
    };
    let totalItems = 0;
    Object.keys(STORAGE_KEYS).forEach(key => {
        const data = getData(key);
        backup.datos[key] = data;
        const count = Array.isArray(data) ? data.length : (Object.keys(data).length || 0);
        totalItems += count;
        backup.metadata.categorias.push({ nombre: key, items: count });
    });
    backup.metadata.total_items = totalItems;
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `fitoscents_backup_${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    URL.revokeObjectURL(url);
    showToast(`✅ Backup exportado! ${totalItems} registros.`, 'success');
}

// =========================================================
// IMPORTAR TODO
// =========================================================
function importarTodo(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = function(e) {
            try {
                const backup = JSON.parse(e.target.result);
                if (!backup.datos || typeof backup.datos !== 'object')
                    throw new Error('Formato inválido');
                let importados = 0, totalItems = 0;
                Object.keys(backup.datos).forEach(key => {
                    if (STORAGE_KEYS[key]) {
                        const data = backup.datos[key];
                        setData(key, data);
                        importados++;
                        totalItems += Array.isArray(data) ? data.length : 0;
                    }
                });
                resolve({ success: true, categorias: importados, items: totalItems });
            } catch (error) {
                reject(error);
            }
        };
        reader.onerror = () => reject(new Error('Error al leer el archivo'));
        reader.readAsText(file);
    });
}

// =========================================================
// SPINNER DE CARGA
// =========================================================
function mostrarSpinner(mensaje = 'Sincronizando...') {
    let el = document.getElementById('__app-spinner');
    if (!el) {
        el = document.createElement('div');
        el.id = '__app-spinner';
        el.innerHTML = `
            <div class="__spinner-inner">
                <div class="__spinner-ring"></div>
                <p class="__spinner-msg" id="__spinner-msg">${mensaje}</p>
            </div>`;
        document.body.appendChild(el);
    }
    document.getElementById('__spinner-msg').innerText = mensaje;
    el.style.display = 'flex';
}

function ocultarSpinner() {
    const el = document.getElementById('__app-spinner');
    if (el) el.style.display = 'none';
}

// =========================================================
// INIT — Sincroniza Firebase → localStorage
// FIX: Ya NO llama funciones de render aquí.
//      Cada página las llama por su cuenta después del await.
// =========================================================
async function initApp() {
    mostrarSpinner('Conectando con Firebase...');

    let intentos = 0;
    while (typeof getDataCloud !== 'function' && intentos < 15) {
        await new Promise(r => setTimeout(r, 200));
        intentos++;
    }

    if (typeof getDataCloud !== 'function') {
        console.warn('⚠️ Firebase no disponible, usando localStorage');
        ocultarSpinner();
        return;
    }

    mostrarSpinner('Cargando datos...');

    const claves = ['perfumes', 'ventas', 'pagos', 'gastos', 'plantillas'];
    for (const key of claves) {
        try {
            const data = await getDataCloud(key);
            if (Array.isArray(data) && data.length > 0) {
                localStorage.setItem(STORAGE_KEYS[key], JSON.stringify(data));
            }
        } catch(e) {
            console.warn(`⚠️ No se pudo sincronizar ${key}`);
        }
    }

    ocultarSpinner();
    console.log('🔄 Sincronizado desde Firebase');
}


// =========================================================
// 💱 CALCULADORA DE IMPORTACIÓN
// =========================================================
let currentExchangeRate = null;

// Inicializar calculadora cuando el DOM esté listo
function initCalculator() {
    const badge = document.getElementById('exchange-rate-badge');
    if (!badge) {
        console.warn('⚠️ Calculadora no encontrada en esta página');
        return;
    }
    
    loadExchangeRateOnPage();
    
    // Configurar event listeners
    const usdInput = document.getElementById('calc-usd-price');
    if (usdInput) {
        usdInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') calcularImportacion();
        });
    }
}

// Cargar tipo de cambio al iniciar
async function loadExchangeRateOnPage() {
    try {
        const response = await fetch('https://api.exchangerate-api.com/v4/latest/USD');
        const data = await response.json();
        currentExchangeRate = data.rates.MXN;
        
        const timestamp = new Date().toLocaleTimeString('es-MX');
        const badge = document.getElementById('exchange-rate-badge');
        if (badge) {
            badge.innerHTML = 
                `<strong>1 USD = ${currentExchangeRate.toFixed(2)} MXN</strong><br><small>${timestamp}</small>`;
        }
    } catch (error) {
        console.error('❌ Error en tipo de cambio:', error);
        const badge = document.getElementById('exchange-rate-badge');
        if (badge) {
            badge.textContent = 'Error cargando cambio';
        }
    }
}

function calcularImportacion() {
    if (!currentExchangeRate) {
        alert('Espera a que cargue el tipo de cambio');
        return;
    }

    const usdInput = document.getElementById('calc-usd-price');
    const qtyInput = document.getElementById('calc-quantity');
    const packagingCheckbox = document.getElementById('calc-packaging');

    if (!usdInput || !qtyInput) {
        console.error('❌ Inputs no encontrados');
        return;
    }

    const usdPrice = parseFloat(usdInput.value) || 0;
    const quantity = parseInt(qtyInput.value) || 1;
    const hasPackaging = packagingCheckbox ? packagingCheckbox.checked : false;

    if (usdPrice <= 0) {
        alert('Ingresa un precio válido en USD');
        return;
    }

    let totalUSD = usdPrice * quantity;
    if (hasPackaging) {
        totalUSD += 2.50;
    }

    const totalMXN = totalUSD * currentExchangeRate;
    const perUnitMXN = (usdPrice * currentExchangeRate).toFixed(2);

    // Mostrar resultados
    const resultTotalUsd = document.getElementById('result-total-usd');
    const resultTotalMxn = document.getElementById('result-total-mxn');
    const resultPerUnit = document.getElementById('result-per-unit');
    const resultRate = document.getElementById('result-rate');
    const calcResults = document.getElementById('calc-results');
    const copyBtn = document.getElementById('copy-result-btn');

    if (resultTotalUsd) resultTotalUsd.textContent = `$${totalUSD.toFixed(2)}`;
    if (resultTotalMxn) resultTotalMxn.textContent = `$${totalMXN.toFixed(2)}`;
    if (resultPerUnit) resultPerUnit.textContent = `$${perUnitMXN}`;
    if (resultRate) resultRate.textContent = `1 USD = ${currentExchangeRate.toFixed(2)} MXN`;

    if (calcResults) calcResults.style.display = 'block';
    if (copyBtn) copyBtn.style.display = 'block';

    // Guardar para copiar
    window.lastCalculationMXN = totalMXN.toFixed(2);
}

function copiarResultado() {
    const mxnValue = window.lastCalculationMXN || '0.00';
    
    navigator.clipboard.writeText(mxnValue).then(() => {
        const btn = document.getElementById('copy-result-btn');
        if (!btn) return;
        
        const originalText = btn.innerHTML;
        btn.innerHTML = '✅ ¡Copiado!';
        btn.classList.remove('btn-outline-gold');
        btn.classList.add('btn-success');
        
        setTimeout(() => {
            btn.innerHTML = originalText;
            btn.classList.add('btn-outline-gold');
            btn.classList.remove('btn-success');
        }, 2000);
    });
}

function limpiarCalculadora() {
    const usdInput = document.getElementById('calc-usd-price');
    const qtyInput = document.getElementById('calc-quantity');
    const packagingCheckbox = document.getElementById('calc-packaging');
    const calcResults = document.getElementById('calc-results');
    const copyBtn = document.getElementById('copy-result-btn');

    if (usdInput) usdInput.value = '';
    if (qtyInput) qtyInput.value = '1';
    if (packagingCheckbox) packagingCheckbox.checked = false;
    if (calcResults) calcResults.style.display = 'none';
    if (copyBtn) copyBtn.style.display = 'none';
}

// Inicializar cuando el DOM esté listo
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initCalculator);
} else {
    initCalculator();
}

// Actualizar tipo de cambio cada 30 minutos
setInterval(loadExchangeRateOnPage, 1800000);