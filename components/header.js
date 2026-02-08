// =========================================================
// COMPONENTE DE NAVEGACIÓN GLOBAL
// =========================================================

function cargarHeader() {
    const headerHTML = `
        <nav class="navbar navbar-expand-lg navbar-dark bg-dark mb-4 shadow">
            <div class="container">
                <a class="navbar-brand fw-bold" href="index.html">👑 Fitoscents</a>
                
                <button class="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#navbarNav">
                    <span class="navbar-toggler-icon"></span>
                </button>
        
                <div class="collapse navbar-collapse justify-content-end" id="navbarNav">
                    <div class="navbar-nav gap-2">
                        <a href="index.html" class="nav-link" data-page="index">
                            Inicio
                        </a>
                        <a href="products.html" class="nav-link" data-page="products">
                            📦 Inventario
                        </a>
                        <a href="ventas.html" class="nav-link" data-page="ventas">
                            💰 Ventas
                        </a>
                        <a href="gastos.html" class="nav-link" data-page="gastos">
                            💸 Gastos
                        </a>
                        <a href="alertas.html" class="nav-link position-relative" data-page="alertas">
                            🔔 Alertas
                            <span class="position-absolute top-0 start-100 translate-middle badge rounded-pill bg-danger" 
                                  id="nav-alertas-badge" style="display: none; font-size: 0.65rem;">
                                0
                            </span>
                        </a>
                        <a href="clientes.html" class="nav-link" data-page="clientes">
                            👥 Clientes
                        </a>
                    </div>
                </div>
            </div>
        </nav>
    `;
    
    // Insertar el header al inicio del body
    document.body.insertAdjacentHTML('afterbegin', headerHTML);
    
    // Marcar página activa
    marcarPaginaActiva();
    
    // Actualizar badge de alertas
    if (typeof actualizarBadgeAlertas === 'function') {
        actualizarBadgeAlertas();
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
    const links = document.querySelectorAll('.nav-link[data-page]');
    links.forEach(link => {
        if (link.dataset.page === paginaActual) {
            link.classList.add('active');
        } else {
            link.classList.remove('active');
        }
    });
}

// Auto-ejecutar cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', () => {
    cargarHeader();
});
