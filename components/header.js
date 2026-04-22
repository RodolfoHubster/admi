// =========================================================
// COMPONENTE DE NAVEGACIÓN GLOBAL
// =========================================================

function cargarHeader() {
    const headerHTML = `
        <nav class="navbar navbar-expand-lg navbar-dark bg-dark mb-4 shadow app-navbar">
            <div class="container">
                <a class="navbar-brand fw-bold" href="index.html">👑 Fitoscents</a>
                
                <button class="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#navbarNav">
                    <span class="navbar-toggler-icon"></span>
                </button>
        
                <div class="collapse navbar-collapse justify-content-between gap-3" id="navbarNav">
                    <div class="navbar-nav gap-lg-1 flex-wrap">
                        <a href="index.html" class="nav-link" data-page="index">
                            Inicio
                        </a>
                        <a href="products.html" class="nav-link" data-page="products">
                            📦 Inventario
                        </a>
                        <a href="catalogo.html" class="nav-link" data-page="catalogo">
                            📸 Catálogo
                        </a>
                        <a href="ventas.html" class="nav-link" data-page="ventas">
                            💰 Ventas
                        </a>
                        <a href="alertas.html" class="nav-link position-relative" data-page="alertas">
                            🔔 Alertas
                            <span class="position-absolute top-0 start-100 translate-middle badge rounded-pill bg-danger" 
                                  id="nav-alertas-badge" style="display: none; font-size: 0.65rem;">
                                0
                            </span>
                        </a>
                        <div class="nav-item dropdown">
                            <a class="nav-link dropdown-toggle" href="#" role="button" data-bs-toggle="dropdown" aria-expanded="false" id="nav-mas-toggle">
                                Más
                            </a>
                            <ul class="dropdown-menu dropdown-menu-dark border-0 shadow">
                                <li><a href="decants.html" class="dropdown-item" data-page="decants">🧪 Decants</a></li>
                                <li><a href="listadecants.html" class="dropdown-item" data-page="listadecants">🃏 Lista Decants</a></li>
                                <li><a href="ganancias.html" class="dropdown-item" data-page="ganancias">📊 Ganancias</a></li>
                                <li><a href="gastos.html" class="dropdown-item" data-page="gastos">💸 Gastos</a></li>
                                <li><a href="mensajes.html" class="dropdown-item" data-page="mensajes">💬 Mensajes</a></li>
                                <li><a href="clientes.html" class="dropdown-item" data-page="clientes">👥 Clientes</a></li>
                                <li><a href="asistente.html" class="dropdown-item" data-page="asistente">🤖 Asistente IA</a></li>
                            </ul>
                        </div>
                    </div>
                    <div class="d-flex align-items-center gap-2 ms-lg-auto header-utility">
                        <span class="badge text-uppercase" id="nav-role-badge"></span>
                        <button class="btn btn-sm btn-outline-light" id="btn-logout-global" type="button">
                            <i class="bi bi-box-arrow-right"></i> Salir
                        </button>
                    </div>
                </div>
            </div>
        </nav>
        <div id="sync-status-banner" class="container mb-2">
            <div class="small text-muted">
                <span class="me-2">🔄 Sync:</span>
                <span id="sync-status-value">Verificando...</span>
            </div>
        </div>
        <div id="mobile-quick-actions" style="position:fixed;right:12px;bottom:14px;z-index:1050;display:flex;flex-direction:column;gap:8px;">
            <a href="products.html" id="qa-inventario" class="btn btn-sm btn-dark shadow rounded-pill">+ Inventario</a>
            <a href="ventas.html" id="qa-venta" class="btn btn-sm btn-success shadow rounded-pill">+ Venta/Abono</a>
            <a href="gastos.html" id="qa-gasto" class="btn btn-sm btn-warning shadow rounded-pill">+ Gasto</a>
        </div>
        
        <!-- Botones flotantes de importar/exportar 
        <div style="position: fixed; bottom: 20px; right: 20px; z-index: 9999; display: flex; gap: 10px;">
            <button onclick="handleExportClick()" class="btn btn-warning" style="border-radius: 50%; width: 50px; height: 50px;" title="Exportar datos">
                ⬇️
            </button>
            <label for="import-file" class="btn btn-info" style="border-radius: 50%; width: 50px; height: 50px; cursor: pointer; margin: 0; display: flex; align-items: center; justify-content: center;" title="Importar datos">
                ⬆️
            </label>
            <input type="file" id="import-file" accept=".json" style="display: none;" onchange="handleImportHeader(this)">
        </div>-->
    `;
    
    // Insertar el header al inicio del body
    document.body.insertAdjacentHTML('afterbegin', headerHTML);
    
    // Marcar página activa
    marcarPaginaActiva();
    pintarInfoSesionHeader();
    inicializarBotonSalir();
    actualizarEstadoSync();
    
    // Actualizar badge de alertas
    if (typeof actualizarBadgeAlertas === 'function') {
        actualizarBadgeAlertas();
    }
}

function pintarInfoSesionHeader() {
    const badge = document.getElementById('nav-role-badge');
    if (!badge) return;
    const sesion = typeof getFitoSession === 'function' ? getFitoSession() : null;
    if (!sesion) {
        badge.textContent = 'Sin sesión';
        return;
    }
    badge.textContent = `Rol: ${sesion.role || 'readonly'}`;
    const quick = document.getElementById('mobile-quick-actions');
    if (quick) {
        const qaInv = document.getElementById('qa-inventario');
        const qaVenta = document.getElementById('qa-venta');
        const qaGasto = document.getElementById('qa-gasto');
        if (qaInv) qaInv.style.display = (typeof fitoCan === 'function' && fitoCan('edit')) ? 'inline-block' : 'none';
        if (qaVenta) qaVenta.style.display = (typeof fitoCan === 'function' && fitoCan('sell')) ? 'inline-block' : 'none';
        if (qaGasto) qaGasto.style.display = (typeof fitoCan === 'function' && fitoCan('edit')) ? 'inline-block' : 'none';
        const visibleActions = [qaInv, qaVenta, qaGasto].filter(el => el && el.style.display !== 'none').length;
        if (visibleActions === 0) quick.style.display = 'none';
    }
}

function inicializarBotonSalir() {
    const btn = document.getElementById('btn-logout-global');
    if (!btn) return;
    btn.onclick = () => {
        if (typeof fitoLogoutGlobal === 'function') {
            fitoLogoutGlobal('logout');
            return;
        }
        sessionStorage.removeItem('fito_auth');
        location.replace('login.html');
    };
}

function actualizarEstadoSync() {
    const el = document.getElementById('sync-status-value');
    if (!el) return;
    const online = navigator.onLine;
    el.textContent = online ? 'Online' : 'Offline (solo local)';
    el.style.color = online ? '#4ade80' : '#fbbf24';
    window.addEventListener('online', () => {
        el.textContent = 'Online';
        el.style.color = '#4ade80';
    });
    window.addEventListener('offline', () => {
        el.textContent = 'Offline (solo local)';
        el.style.color = '#fbbf24';
    });
    const quick = document.getElementById('mobile-quick-actions');
    if (quick) {
        const isMobile = window.matchMedia('(max-width: 768px)').matches;
        quick.style.display = isMobile ? 'flex' : 'none';
    }
}

function marcarPaginaActiva() {
    // Obtener nombre del archivo actual
    const rutaActual = window.location.pathname;
    const archivoActual = rutaActual.substring(rutaActual.lastIndexOf('/') + 1);
    
    // Extraer nombre sin extensión
    let paginaActual = archivoActual.replace('.html', '');
    
    // Si estamos en la raíz o index
    if (paginaActual === '' || paginaActual === 'index') {
        paginaActual = 'index';
    }
    
    // Buscar el link correspondiente y marcarlo como activo
    const links = document.querySelectorAll('[data-page]');
    let activeInsideDropdown = false;
    links.forEach(link => {
        if (link.dataset.page === paginaActual) {
            link.classList.add('active');
            if (link.classList.contains('dropdown-item')) {
                activeInsideDropdown = true;
            }
        } else {
            link.classList.remove('active');
        }
    });

    const toggleMas = document.getElementById('nav-mas-toggle');
    if (toggleMas) {
        toggleMas.classList.toggle('active', activeInsideDropdown);
    }
}

// Auto-ejecutar cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', () => {
    cargarHeader();
});

// =========================================================
// FUNCIONES DE IMPORTAR/EXPORTAR
// =========================================================

function handleExportClick() {
    // Verificar que storage.js esté cargado
    if (typeof exportarTodo !== 'function') {
        alert('❌ Error: El sistema de almacenamiento no está cargado.\nAsegúrate de que storage.js esté incluido en la página.');
        console.error('storage.js no está cargado');
        return;
    }
    
    try {
        exportarTodo();
    } catch (error) {
        console.error('❌ Error al exportar:', error);
        alert('❌ Error al exportar los datos: ' + error.message);
    }
}

async function handleImportHeader(input) {
    const file = input.files[0];
    if (!file) return;
    
    // Validar que sea un archivo JSON
    if (!file.name.endsWith('.json')) {
        alert('❌ Error: Solo se permiten archivos .json');
        input.value = '';
        return;
    }
    
    // Verificar que storage.js esté cargado
    if (typeof importarTodo !== 'function') {
        alert('❌ Error: El sistema de almacenamiento no está cargado.\nAsegúrate de que storage.js esté incluido en la página.');
        console.error('storage.js no está cargado');
        input.value = '';
        return;
    }
    
    if (!confirm('⚠️ Esto reemplazará TODOS los datos actuales. ¿Continuar?')) {
        input.value = '';
        return;
    }
    
    try {
        const result = await importarTodo(file);
        
        if (result.success) {
            alert(`✅ Importación exitosa!\n\n📦 ${result.categorias} categorías\n🔢 ${result.items} items`);
            
            // Recargar la página después de un pequeño delay
            setTimeout(() => {
                location.reload();
            }, 500);
        } else {
            throw new Error('La importación no fue exitosa');
        }
    } catch (error) {
        console.error('❌ Error al importar:', error);
        alert('❌ Error al importar: ' + error.message);
    } finally {
        // Limpiar el input
        input.value = '';
    }
}
