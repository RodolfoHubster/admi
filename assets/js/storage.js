// =========================================================
// SISTEMA CENTRALIZADO DE ALMACENAMIENTO
// =========================================================

const STORAGE_KEYS = {
    perfumes: 'perfume_inventory_v1',      // ⬅️ CORREGIDO
    ventas: 'perfume_sales_v1',            // ⬅️ CORREGIDO
    gastos: 'perfume_expenses_v1',         // ⬅️ CORREGIDO
    plantillas: 'perfume_templates_v1',    // ⬅️ AGREGADO
    pagos: 'perfume_payouts_v1',           // ⬅️ AGREGADO
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
        if (!data) {
            // Retornar objeto vacío para config, array para otros
            return key === 'config' ? {} : [];
        }
        return JSON.parse(data);
    } catch (error) {
        console.error(`❌ Error al cargar ${key}:`, error);
        return key === 'config' ? {} : [];
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
        version: '1.1',
        fecha: new Date().toISOString(),
        datos: {},
        metadata: {
            total_items: 0,
            categorias: []
        }
    };
    
    // Recopilar TODOS los datos de las claves definidas
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
        
        console.log(`📦 ${key} (${STORAGE_KEYS[key]}): ${count} items`);
    });
    
    backup.metadata.total_items = totalItems;
    
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
    console.table(backup.metadata.categorias);
    
    const detalles = backup.metadata.categorias
        .filter(c => c.items > 0)
        .map(c => `• ${c.nombre}: ${c.items}`)
        .join('\n');
    
    alert(`✅ Backup exportado!\n\n📦 Total de items: ${totalItems}\n\nDetalles:\n${detalles || '(Sin datos)'}`);
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
                
                // Validar estructura básica
                if (!backup.datos || typeof backup.datos !== 'object') {
                    throw new Error('Formato de archivo inválido: falta estructura de datos');
                }
                
                // Validar que tenga al menos una categoría válida
                const categoriasValidas = Object.keys(backup.datos).filter(key => STORAGE_KEYS[key]);
                if (categoriasValidas.length === 0) {
                    throw new Error('El archivo no contiene datos válidos');
                }
                
                // Validar tipos de datos
                Object.keys(backup.datos).forEach(key => {
                    if (STORAGE_KEYS[key]) {
                        const data = backup.datos[key];
                        if (key === 'config') {
                            if (typeof data !== 'object' || Array.isArray(data)) {
                                throw new Error(`Datos de ${key} inválidos: debe ser un objeto`);
                            }
                        } else {
                            if (!Array.isArray(data)) {
                                throw new Error(`Datos de ${key} inválidos: debe ser un array`);
                            }
                        }
                    }
                });
                
                // Restaurar TODOS los datos
                let importados = 0;
                let totalItems = 0;
                const detalles = [];
                
                Object.keys(backup.datos).forEach(key => {
                    if (STORAGE_KEYS[key]) {
                        const data = backup.datos[key];
                        setData(key, data);
                        importados++;
                        
                        const count = Array.isArray(data) ? data.length : (Object.keys(data).length || 0);
                        totalItems += count;
                        detalles.push(`• ${key}: ${count} items`);
                        
                        console.log(`✅ ${key}: ${count} items importados`);
                    }
                });
                
                console.log(`✅ ${importados} categorías importadas (${totalItems} items)`);
                console.log('Detalles:\n' + detalles.join('\n'));
                
                resolve({ 
                    success: true, 
                    categorias: importados,
                    items: totalItems,
                    detalles: detalles
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
