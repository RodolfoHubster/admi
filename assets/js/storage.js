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
    config:      'config_db'
};

// =========================================================
// LEER — igual que antes, desde localStorage
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
        // 1. Guardar en localStorage (instantáneo, como siempre)
        localStorage.setItem(STORAGE_KEYS[key], JSON.stringify(data));
        console.log(`✅ ${key} guardado en local`);

        // 2. Sincronizar con Firebase en segundo plano (sin bloquear)
        if (typeof setDataCloud === 'function') {
            setDataCloud(key, data)
                .then(() => console.log(`☁️ ${key} sincronizado con Firebase`))
                .catch(err => console.warn(`⚠️ Firebase offline, solo guardado local:`, err));
        }

        return true;
    } catch (error) {
        console.error(`❌ Error al guardar ${key}:`, error);
        alert(`Error al guardar ${key}. Verifica el espacio disponible.`);
        return false;
    }
}

// =========================================================
// RESTAURAR DESDE FIREBASE — por si se borra localStorage
// =========================================================
async function restaurarDesdeFirebase() {
    if (typeof getDataCloud !== 'function') {
        return alert('❌ Firebase no está conectado.');
    }

    const claves = ['perfumes', 'ventas', 'pagos', 'gastos', 'plantillas'];
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
                log.push(`⚪ ${key}: vacío en Firebase`);
            }
        } catch(e) {
            log.push(`❌ ${key}: error`);
        }
    }

    alert(`🔄 Restauración completa!\n\n${log.join('\n')}\n\nTotal: ${total} registros restaurados.\n\nRecarga la página para ver los datos.`);
}

// Exponer globalmente
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
        backup.metadata.categorias.push({
            nombre: key,
            clave_real: STORAGE_KEYS[key],
            items: count,
            tipo: Array.isArray(data) ? 'array' : 'object'
        });
    });
    
    backup.metadata.total_items = totalItems;
    const json = JSON.stringify(backup, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `fitoscents_backup_${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    URL.revokeObjectURL(url);

    const detalles = backup.metadata.categorias
        .filter(c => c.items > 0)
        .map(c => `• ${c.nombre}: ${c.items}`)
        .join('\n');
    alert(`✅ Backup exportado!\n\n📦 Total: ${totalItems}\n\n${detalles || '(Sin datos)'}`);
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

                const categoriasValidas = Object.keys(backup.datos).filter(key => STORAGE_KEYS[key]);
                if (categoriasValidas.length === 0)
                    throw new Error('No contiene datos válidos');

                let importados = 0, totalItems = 0;
                const detalles = [];

                Object.keys(backup.datos).forEach(key => {
                    if (STORAGE_KEYS[key]) {
                        const data = backup.datos[key];
                        setData(key, data); // <-- esto también sincroniza Firebase
                        importados++;
                        const count = Array.isArray(data) ? data.length : (Object.keys(data).length || 0);
                        totalItems += count;
                        detalles.push(`• ${key}: ${count} items`);
                    }
                });

                resolve({ success: true, categorias: importados, items: totalItems, detalles });
            } catch (error) {
                console.error('❌ Error al importar:', error);
                reject(error);
            }
        };
        reader.onerror = () => reject(new Error('Error al leer el archivo'));
        reader.readAsText(file);
    });
}
// =========================================================
// INIT — Al cargar la página, sincroniza Firebase → localStorage
// =========================================================
async function initApp() {
    // Esperar hasta que Firebase esté disponible (máx 3 segundos)
    let intentos = 0;
    while (typeof getDataCloud !== 'function' && intentos < 15) {
        await new Promise(r => setTimeout(r, 200));
        intentos++;
    }
    
    if (typeof getDataCloud !== 'function') {
        console.warn('⚠️ Firebase no disponible, usando localStorage');
        return;
    }

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
    console.log('🔄 Sincronizado desde Firebase');
}

