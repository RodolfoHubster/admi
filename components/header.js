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
                        <a href="catalogo.html" class="nav-link" data-page="catalogo">
                            📸 Catálogo
                        </a>
                        <a href="ventas.html" class="nav-link" data-page="ventas">
                            💰 Ventas
                        </a>
                        <a href="gastos.html" class="nav-link" data-page="gastos">
                            💸 Gastos
                        </a>
                        <a href="mensajes.html" class="nav-link" data-page="mensajes">
                            💬 Mensajes
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
                    <!-- Botones flotantes (al final del nav, antes de </nav>) -->
<div style="position: fixed; bottom: 20px; right: 20px; z-index: 9999; display: flex; gap: 10px;">
    <button onclick="exportarTodo()" class="btn btn-warning" style="border-radius: 50%; width: 50px; height: 50px;" title="Exportar">
        ⬇️
    </button>
    <label for="import-file" class="btn btn-info" style="border-radius: 50%; width: 50px; height: 50px; cursor: pointer; margin: 0;" title="Importar">
        ⬆️
    </label>
    <input type="file" id="import-file" accept=".json" style="display: none;" onchange="handleImportHeader(this)">
</div>

                        
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

// =========================================================
// FUNCIÓN DE IMPORTAR (agregar al final del archivo)
// =========================================================

async function handleImportHeader(input) {
    const file = input.files[0];
    if (!file) return;
    
    if (!confirm('⚠️ Esto reemplazará TODOS los datos actuales. ¿Continuar?')) {
        input.value = '';
        return;
    }
    
    try {
        const result = await importarTodo(file);
        alert(`✅ Importación exitosa!\n\n📦 ${result.categorias} categorías\n🔢 ${result.items} items`);
        location.reload();
    } catch (error) {
        alert('❌ Error: ' + error.message);
    }
    
    input.value = '';
}

