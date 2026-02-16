// =========================================================
// SISTEMA CENTRALIZADO DE ALMACENAMIENTO
// =========================================================

const STORAGE_KEYS = {
    perfumes: 'perfumes_db',
    ventas: 'ventas_db',
    gastos: 'gastos_db',
    sugerencias: 'sugerencias_db',
    clientes: 'clientes_db',
    mensajes: 'mensajes_db',
    config: 'config_db'
};

// =========================================================
// FUNCIONES BÁSICAS
// =========================================================

function getData(key) {
    try {
        const data = localStorage.getItem(STORAGE_KEYS[key]);
        return data ? JSON.parse(data) : [];
    } catch (error) {
        console.error(`❌ Error al cargar ${key}:`, error);
        return [];
    }
}

function setData(key, data) {
    try {
        localStorage.setItem(STORAGE_KEYS[key], JSON.stringify(data));
        console.log(`✅ ${key} guardado correctamente`);
        return true;
    } catch (error) {
        console.error(`❌ Error al guardar ${key}:`, error);
        alert(`Error al guardar ${key}. Verifica el espacio disponible.`);
        return false;
    }
}

// =========================================================
// EXPORTAR TODO
// =========================================================

function exportarTodo() {
    const backup = {
        version: '1.0',
        fecha: new Date().toISOString(),
        datos: {}
    };
    
    // Recopilar TODOS los datos
    let totalItems = 0;
    Object.keys(STORAGE_KEYS).forEach(key => {
        const data = getData(key);
        backup.datos[key] = data;
        totalItems += Array.isArray(data) ? data.length : 0;
    });
    
    // Crear archivo JSON
    const json = JSON.stringify(backup, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    // Descargar archivo
    const link = document.createElement('a');
    link.href = url;
    link.download = `fitoscents_backup_${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    
    // Limpiar
    URL.revokeObjectURL(url);
    
    console.log('✅ Backup completo exportado');
    alert(`✅ Backup exportado!\n\n📦 Total de items: ${totalItems}`);
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
                
                // Validar estructura
                if (!backup.datos) {
                    throw new Error('Formato de archivo inválido');
                }
                
                // Restaurar TODOS los datos
                let importados = 0;
                let totalItems = 0;
                
                Object.keys(backup.datos).forEach(key => {
                    if (STORAGE_KEYS[key]) {
                        setData(key, backup.datos[key]);
                        importados++;
                        totalItems += Array.isArray(backup.datos[key]) ? backup.datos[key].length : 0;
                    }
                });
                
                console.log(`✅ ${importados} categorías importadas (${totalItems} items)`);
                resolve({ 
                    success: true, 
                    categorias: importados,
                    items: totalItems 
                });
                
            } catch (error) {
                console.error('❌ Error al importar:', error);
                reject(error);
            }
        };
        
        reader.onerror = () => reject(new Error('Error al leer el archivo'));
        reader.readAsText(file);
    });
}
