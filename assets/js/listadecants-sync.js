/**
 * MÓDULO DE SINCRONIZACIÓN - LISTA DECANTS CON DECANTS
 * 
 * Este módulo sincroniza automáticamente el estado de las tarjetas en listadecants.html
 * con los datos de stock en decants.js. Cuando un decant se agota, se archiva automáticamente.
 * 
 * Características:
 * - Sincronización en tiempo real
 * - Archivo automático de decants agotados
 * - Historial de cambios
 * - Estadísticas de stock
 */

// ===================================================
// 1. CONFIGURACIÓN
// ===================================================

const SYNC_CONFIG = {
  STORAGE_KEY_ARCHIVO: 'listadecants_archivados',
  STORAGE_KEY_HISTORIAL: 'listadecants_historial',
  STORAGE_KEY_STATS: 'listadecants_stats',
  SYNC_INTERVAL: 5000, // Sincronizar cada 5 segundos
  MAX_HISTORIAL: 100
};

// ===================================================
// 2. UTILIDADES DE ALMACENAMIENTO
// ===================================================

window.getArchivedDecants = function() {
  try {
    const data = localStorage.getItem(SYNC_CONFIG.STORAGE_KEY_ARCHIVO);
    return data ? JSON.parse(data) : {};
  } catch (error) {
    console.error('❌ Error leyendo archivados:', error);
    return {};
  }
};

window.saveArchivedDecants = function(archivos) {
  try {
    localStorage.setItem(SYNC_CONFIG.STORAGE_KEY_ARCHIVO, JSON.stringify(archivos));
  } catch (error) {
    console.error('❌ Error guardando archivados:', error);
  }
};

window.getHistorial = function() {
  try {
    const data = localStorage.getItem(SYNC_CONFIG.STORAGE_KEY_HISTORIAL);
    return data ? JSON.parse(data) : [];
  } catch (error) {
    console.error('❌ Error leyendo historial:', error);
    return [];
  }
};

window.addHistorialEntry = function(tipo, decantId, decantNombre, detalles = {}) {
  try {
    const historial = getHistorial();
    const entry = {
      timestamp: new Date().toISOString(),
      tipo, // 'archivar', 'restaurar', 'agotado'
      decantId,
      decantNombre,
      detalles
    };
    
    historial.unshift(entry);
    if (historial.length > SYNC_CONFIG.MAX_HISTORIAL) {
      historial.pop();
    }
    
    localStorage.setItem(SYNC_CONFIG.STORAGE_KEY_HISTORIAL, JSON.stringify(historial));
    return entry;
  } catch (error) {
    console.error('❌ Error agregando historial:', error);
  }
};

// ===================================================
// 3. FUNCIONES DE SINCRONIZACIÓN
// ===================================================

window.getDecantStockStatus = function(decantId) {
  /**
   * Obtiene el estado de stock de un decant desde decants.js
   * Retorna: { total: num, activas: num, archivo: bool }
   */
  try {
    if (!window.DECANTS_VENTAS) return null;
    
    const decantVentas = window.DECANTS_VENTAS[decantId];
    if (!decantVentas) return null;
    
    let tallasActivas = 0;
    let stockTotal = 0;
    
    Object.keys(decantVentas).forEach(talla => {
      const cantidadDisponible = (window.DECANTS_PRECARGA?.[decantId]?.[talla] || 0) - 
                                  (decantVentas[talla]?.total || 0);
      if (cantidadDisponible > 0) {
        tallasActivas++;
      }
      stockTotal += cantidadDisponible;
    });
    
    return {
      total: stockTotal,
      activas: tallasActivas,
      archive: stockTotal === 0 || tallasActivas === 0
    };
  } catch (error) {
    console.error(`❌ Error obteniendo stock de ${decantId}:`, error);
    return null;
  }
};

window.isDecantExhausted = function(decantId) {
  /**
   * Verifica si un decant está completamente agotado
   */
  const status = getDecantStockStatus(decantId);
  return status && status.archive;
};

window.syncDecantToListaDecants = function(decantId) {
  /**
   * Sincroniza un decant individual a su estado correcto en lista decants
   */
  try {
    const tarjeta = document.querySelector(`[data-decant-id="${decantId}"]`);
    if (!tarjeta) return;
    
    const isExhausted = isDecantExhausted(decantId);
    const archivoSection = document.querySelector('.seccion-archivado');
    const disponiblesSection = document.querySelector('.seccion-disponibles');
    
    if (isExhausted) {
      // Archivar
      tarjeta.setAttribute('data-status', 'agotado');
      if (archivoSection) {
        archivoSection.appendChild(tarjeta);
      }
      addHistorialEntry('archivar', decantId, tarjeta.getAttribute('data-nombre'), {
        razon: 'Sin stock disponible'
      });
    } else {
      // Restaurar/Disponible
      tarjeta.setAttribute('data-status', 'disponible');
      if (disponiblesSection) {
        disponiblesSection.appendChild(tarjeta);
      }
      addHistorialEntry('restaurar', decantId, tarjeta.getAttribute('data-nombre'), {
        razon: 'Restock realizado'
      });
    }
  } catch (error) {
    console.error(`❌ Error sincronizando ${decantId}:`, error);
  }
};

window.initDecantsSyncMonitor = function() {
  /**
   * Inicializa el monitor de sincronización automática
   */
  console.log('🔄 Iniciando monitor de sincronización de decants...');
  
  const tarjetas = document.querySelectorAll('[data-decant-id]');
  
  // Sincronizar todas las tarjetas
  tarjetas.forEach(tarjeta => {
    const decantId = tarjeta.getAttribute('data-decant-id');
    if (decantId) {
      syncDecantToListaDecants(decantId);
    }
  });
  
  // Configurar sincronización periódica
  setInterval(() => {
    tarjetas.forEach(tarjeta => {
      const decantId = tarjeta.getAttribute('data-decant-id');
      if (decantId) {
        syncDecantToListaDecants(decantId);
      }
    });
  }, SYNC_CONFIG.SYNC_INTERVAL);
  
  console.log('✅ Monitor de sincronización iniciado');
};

// ===================================================
// 4. FUNCIÓN PARA QUICK RESTOCK
// ===================================================

window.restockRapido = function(decantId, talla, cantidad) {
  /**
   * Agrega stock rápidamente a un decant sin modificar decants.js
   * (Este es un simulador visual - idealmente se sincronizaría con backend)
   */
  try {
    const tarjeta = document.querySelector(`[data-decant-id="${decantId}"]`);
    if (!tarjeta) return;
    
    const stockAtual = parseInt(tarjeta.getAttribute('data-stock') || '0');
    const nuevoStock = stockAtual + cantidad;
    
    tarjeta.setAttribute('data-stock', nuevoStock);
    tarjeta.setAttribute('data-status', 'disponible');
    
    // Mover a disponibles
    const disponiblesSection = document.querySelector('.seccion-disponibles');
    if (disponiblesSection) {
      disponiblesSection.appendChild(tarjeta);
    }
    
    addHistorialEntry('restock', decantId, tarjeta.getAttribute('data-nombre'), {
      talla,
      cantidad,
      nuevoStock
    });
    
    console.log(`✅ Restock rápido: ${decantId} talla ${talla} +${cantidad}`);
  } catch (error) {
    console.error('❌ Error en restock rápido:', error);
  }
};

// ===================================================
// 5. AUTO-INICIALIZAR
// ===================================================

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', window.initDecantsSyncMonitor);
} else {
  window.initDecantsSyncMonitor();
}
