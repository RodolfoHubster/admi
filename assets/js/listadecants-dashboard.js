/**
 * ========================================================
 * LISTADECANTS DASHBOARD - UI/UX + Badges Dinámicos
 * Componentes visuales para estado de stock y estadísticas
 * ========================================================
 */

const BADGE_CONFIG = {
  bestseller: { emoji: '⭐', label: 'Bestseller', bgColor: '#ffc107', textColor: '#000', minVentas: 20 },
  casiAgotado: { emoji: '🔥', label: 'Casi Agotado', bgColor: '#ff6b6b', textColor: '#fff', maxTallas: 2 },
  nuevo: { emoji: '\u2728', label: 'Nuevo', bgColor: '#00d4ff', textColor: '#000', diasNew: 7 },
  enOferta: { emoji: '🎁', label: 'En Oferta', bgColor: '#ff00ff', textColor: '#fff' },
  agotado: { emoji: '⛔', label: 'Agotado', bgColor: '#6c757d', textColor: '#fff' },
};

const STOCK_LEVELS = {
  critico: { min: 0, max: 2, emoji: '🔴', label: 'Crítico', color: '#dc3545' },
  bajo: { min: 3, max: 5, emoji: '🟡', label: 'Bajo', color: '#ffc107' },
  optimo: { min: 6, max: 999, emoji: '🟢', label: 'Óptimo', color: '#28a745' },
};

// =========================================================
// 1. GENERADOR DE BADGES DINÁMICOS
// =========================================================

function generateBadges(tarjetaData, vendidos = 0) {
  const badges = [];
  const ahora = new Date();
  
  // Badge: Agotado
  if (tarjetaData.archivado && tarjetaData.archivoMotivo === 'agotado') {
    badges.push(BADGE_CONFIG.agotado);
    return badges; // Si está agotado, no mostrar más
  }
  
  // Badge: Bestseller
  if (vendidos >= BADGE_CONFIG.bestseller.minVentas) {
    badges.push(BADGE_CONFIG.bestseller);
  }
  
  // Badge: Casi Agotado
  const stockStatus = getDecantStockStatus(tarjetaData);
  if (stockStatus.active > 0 && stockStatus.active <= BADGE_CONFIG.casiAgotado.maxTallas) {
    badges.push(BADGE_CONFIG.casiAgotado);
  }
  
  // Badge: Nuevo
  if (tarjetaData.createdAt) {
    const fechaCreacion = tarjetaData.createdAt.toDate ? tarjetaData.createdAt.toDate() : new Date(tarjetaData.createdAt);
    const diasAntiguedad = Math.floor((ahora - fechaCreacion) / (1000 * 60 * 60 * 24));
    if (diasAntiguedad <= BADGE_CONFIG.nuevo.diasNew) {
      badges.push(BADGE_CONFIG.nuevo);
    }
  }
  
  // Badge: En Oferta (si existe campo oferta)
  if (tarjetaData.enOferta) {
    badges.push(BADGE_CONFIG.enOferta);
  }
  
  return badges;
}

function renderBadges(badges) {
  if (badges.length === 0) return '';
  return `<div class="badges-container" style="display:flex; gap:6px; flex-wrap:wrap; margin-bottom:8px;">
    ${badges.map(b => `
      <span class="badge-dinamico" style="
        display:inline-flex; align-items:center; gap:4px;
        background:${b.bgColor}; color:${b.textColor};
        padding:4px 10px; border-radius:16px;
        font-size:11px; font-weight:700; white-space:nowrap;
      ">
        ${b.emoji} ${b.label}
      </span>
    `).join('')}
  </div>`;
}

// =========================================================
// 2. BARRA DE PROGRESO DE STOCK
// =========================================================

function renderStockProgressBar(tarjetaData) {
  const status = getDecantStockStatus(tarjetaData);
  const level = status.active <= 2 ? STOCK_LEVELS.critico :
                status.active <= 5 ? STOCK_LEVELS.bajo :
                STOCK_LEVELS.optimo;
  
  return `
    <div class="stock-progress" style="margin:10px 0;">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
        <small style="color:#adb5bd; font-size:11px; font-weight:700;">
          ${level.emoji} ${level.label.toUpperCase()} – ${status.active}/${status.total} tallas
        </small>
        <small style="color:#8d9bb5; font-size:10px;">${Math.round(status.percentage)}%</small>
      </div>
      <div style="
        width:100%; height:8px; border-radius:4px;
        background:#2a2a3e; overflow:hidden;
      ">
        <div style="
          width:${status.percentage}%; height:100%;
          background:${level.color}; transition:width 0.3s ease;
          border-radius:4px;
        "></div>
      </div>
    </div>
  `;
}

// =========================================================
// 3. DASHBOARD DE ESTADÍSTICAS
// =========================================================

window.renderStockDashboard = async function(containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;
  
  const stats = await calcularEstadisticasStock();
  if (!stats) return;
  
  const total = stats.criticos + stats.bajos + stats.optimos;
  const alertCount = stats.criticos > 0 ? stats.criticos : 0;
  
  const html = `
    <div class="stock-dashboard" style="
      background:linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
      border:1px solid rgba(212,175,55,0.2); border-radius:16px;
      padding:20px; margin-bottom:20px;
    ">
      <h4 style="margin:0 0 16px; color:#d4af37; font-size:14px; font-weight:700; text-transform:uppercase; letter-spacing:0.05em;">
        📈 Estado de Stock
      </h4>
      
      <div style="display:grid; grid-template-columns:repeat(auto-fit,minmax(150px,1fr)); gap:12px; margin-bottom:16px;">
        <div style="background:#0f0f1f; border:1px solid #333; border-radius:12px; padding:12px; text-align:center;">
          <div style="font-size:24px; margin-bottom:4px;">🟢</div>
          <small style="color:#adb5bd; font-size:11px; display:block; margin-bottom:4px; text-transform:uppercase;">Mótima</small>
          <div style="color:#28a745; font-size:20px; font-weight:700;">${stats.optimos}</div>
        </div>
        
        <div style="background:#0f0f1f; border:1px solid #333; border-radius:12px; padding:12px; text-align:center;">
          <div style="font-size:24px; margin-bottom:4px;🟡</div>
          <small style="color:#adb5bd; font-size:11px; display:block; margin-bottom:4px; text-transform:uppercase;">Bajo</small>
          <div style="color:#ffc107; font-size:20px; font-weight:700;">${stats.bajos}</div>
        </div>
        
        <div style="background:#0f0f1f; border:1px solid #333; border-radius:12px; padding:12px; text-align:center;">
          <div style="font-size:24px; margin-bottom:4px;🔴</div>
          <small style="color:#adb5bd; font-size:11px; display:block; margin-bottom:4px; text-transform:uppercase;">Crítico</small>
          <div style="color:#dc3545; font-size:20px; font-weight:700;">${stats.criticos}</div>
        </div>
        
        <div style="background:#0f0f1f; border:1px solid #333; border-radius:12px; padding:12px; text-align:center;">
          <div style="font-size:24px; margin-bottom:4px;" title="Agotados">26d4</div>
          <small style="color:#adb5bd; font-size:11px; display:block; margin-bottom:4px; text-transform:uppercase;">Agotados</small>
          <div style="color:#6c757d; font-size:20px; font-weight:700;">${stats.totalAgotados}</div>
        </div>
      </div>
      
      ${alertCount > 0 ? `
        <div style="
          background:rgba(220,53,69,0.15); border-left:3px solid #dc3545;
          padding:12px; border-radius:8px; margin-top:12px;
        ">
          <p style="margin:0; color:#ff6b6b; font-size:12px; font-weight:700;">
            ⚠️ ${alertCount} decant${alertCount > 1 ? 's' : ''} en estado crítico (0-2 tallas)
          </p>
        </div>
      ` : ''}
    </div>
  `;
  
  container.innerHTML = html;
};

// =========================================================
// 4. INTEGRAR BADGES EN TARJETAS EXISTENTES
// =========================================================

window.enriquecerTarjeta = function(tarjetaHTML, tarjetaData, vendidos = 0) {
  const badges = generateBadges(tarjetaData, vendidos);
  const badgesHTML = renderBadges(badges);
  const progressHTML = renderStockProgressBar(tarjetaData);
  
  // Inyectar badges y progreso en la tarjeta
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = tarjetaHTML;
  
  const cardContent = tempDiv.querySelector('.card-content');
  if (cardContent) {
    const badgesDiv = document.createElement('div');
    badgesDiv.innerHTML = badgesHTML;
    cardContent.insertBefore(badgesDiv, cardContent.firstChild);
    
    const progressDiv = document.createElement('div');
    progressDiv.innerHTML = progressHTML;
    cardContent.appendChild(progressDiv);
  }
  
  return tempDiv.innerHTML;
};

// =========================================================
// 5. NOTIFICACIONES INTELIGENTES
// =========================================================

window.mostrarAlertasStock = async function() {
  if (typeof db === 'undefined') return;
  
  try {
    const snap = await getDocs(query(
      collection(db, 'listadecants'),
      where('archivado', '==', false)
    ));
    
    const criticos = [];
    
    snap.forEach(docSnap => {
      const data = docSnap.data();
      const status = getDecantStockStatus(data);
      
      if (status.active > 0 && status.active <= 2) {
        criticos.push({
          id: docSnap.id,
          nombre: data.nombre,
          marca: data.marca,
          tallasActivas: status.active,
          tallasTotal: status.total
        });
      }
    });
    
    if (criticos.length > 0) {
      mostrarToast(
        `🔴 ${criticos.length} decant${criticos.length > 1 ? 's' : ''} en stock crítico`,
        'warning'
      );
    }
  } catch (error) {
    console.warn('Error mostrando alertas:', error);
  }
};

// Inicializar al cargar
if (typeof window !== 'undefined') {
  window.addEventListener('load', () => {
    mostrarAlertasStock();
    const dashboardContainer = document.getElementById('stock-dashboard');
    if (dashboardContainer) renderStockDashboard('stock-dashboard');
  });
}

// ===================================================
// 5. INICIALIZAR DASHBOARD AL CARGAR
// ===================================================

window.initListaDecantsDashboard = function() {
  try {
    // Obtener todas las tarjetas de lista decants
    const tarjetas = document.querySelectorAll('.tarjeta-decant');
    
    // Enriquecer cada tarjeta con badges, progress bars, etc
    tarjetas.forEach(tarjeta => {
      enriquecerTarjeta(tarjeta);
    });
    
    // Renderizar dashboard de stock si existe el contenedor
    const dashboardContainer = document.getElementById('stock-dashboard');
    if (dashboardContainer) {
      renderStockDashboard(dashboardContainer);
    }
    
    // Inicializar monitor de sincronización si existe
    if (window.initDecantsSyncMonitor) {
      window.initDecantsSyncMonitor();
    }
    
    console.log('✅ Dashboard de Lista Decants inicializado correctamente');
  } catch (error) {
    console.error('❌ Error inicializando dashboard:', error);
  }
};

// ===================================================
// 6. FUNCIONES ADICIONALES DE UX
// ===================================================

// Función para filtrar tarjetas por status
window.filtrarPorStatus = function(status) {
  const tarjetas = document.querySelectorAll('.tarjeta-decant');
  tarjetas.forEach(tarjeta => {
    const badgeStatus = tarjeta.getAttribute('data-status');
    if (status === 'todos' || badgeStatus === status) {
      tarjeta.style.display = 'block';
    } else {
      tarjeta.style.display = 'none';
    }
  });
};

// Función para búsqueda rápida en tarjetas
window.buscarDecant = function(query) {
  const tarjetas = document.querySelectorAll('.tarjeta-decant');
  const queryLower = query.toLowerCase();
  
  tarjetas.forEach(tarjeta => {
    const nombre = tarjeta.getAttribute('data-nombre')?.toLowerCase() || '';
    const marca = tarjeta.getAttribute('data-marca')?.toLowerCase() || '';
    
    if (nombre.includes(queryLower) || marca.includes(queryLower)) {
      tarjeta.style.display = 'block';
    } else {
      tarjeta.style.display = 'none';
    }
  });
};

// Función para acciones en lote
window.accionesEnLote = function(accion) {
  const checkboxes = document.querySelectorAll('.tarjeta-checkbox:checked');
  const tarjetas = Array.from(checkboxes).map(cb => cb.closest('.tarjeta-decant'));
  
  if (tarjetas.length === 0) {
    alert('Selecciona al menos una tarjeta');
    return;
  }
  
  switch(accion) {
    case 'archivar':
      tarjetas.forEach(t => {
        t.style.display = 'none';
        const archivoSection = document.querySelector('.seccion-archivado');
        if (archivoSection) {
          archivoSection.appendChild(t.cloneNode(true));
        }
      });
      break;
    case 'restaurar':
      tarjetas.forEach(t => {
        t.style.display = 'block';
        const disponiblesSection = document.querySelector('.seccion-disponibles');
        if (disponiblesSection) {
          disponiblesSection.appendChild(t);
        }
      });
      break;
    case 'eliminar':
      if (confirm(`¿Eliminar ${tarjetas.length} tarjeta(s)?`)) {
        tarjetas.forEach(t => t.remove());
      }
      break;
  }
};

// Función para exportar datos a CSV
window.exportarACSV = function() {
  const tarjetas = document.querySelectorAll('.tarjeta-decant');
  let csv = 'Nombre,Marca,Stock,Status,Tallas Activas\n';
  
  tarjetas.forEach(tarjeta => {
    const nombre = tarjeta.getAttribute('data-nombre') || '';
    const marca = tarjeta.getAttribute('data-marca') || '';
    const stock = tarjeta.getAttribute('data-stock') || '0';
    const status = tarjeta.getAttribute('data-status') || 'desconocido';
    const tallas = tarjeta.getAttribute('data-tallas-activas') || '0';
    
    csv += `"${nombre}","${marca}",${stock},"${status}",${tallas}\n`;
  });
  
  // Descargar CSV
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `lista-decants-${new Date().toISOString().split('T')[0]}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.URL.revokeObjectURL(url);
};

// Función para calcular estadísticas
window.calcularEstadisticasUI = function() {
  const tarjetas = document.querySelectorAll('.tarjeta-decant');
  const disponibles = document.querySelectorAll('.tarjeta-decant[data-status="disponible"]').length;
  const casiBajo = document.querySelectorAll('.tarjeta-decant[data-status="casi-agotado"]').length;
  const agotados = document.querySelectorAll('.tarjeta-decant[data-status="agotado"]').length;
  const totales = tarjetas.length;
  
  return {
    totales,
    disponibles,
    casiBajo,
    agotados,
    porcentajeDisponibles: ((disponibles / totales) * 100).toFixed(1)
  };
};

// Auto-inicializar cuando el DOM esté listo
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', window.initListaDecantsDashboard);
} else {
  window.initListaDecantsDashboard();
}
