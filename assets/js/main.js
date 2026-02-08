// main.js - Inicializador

document.addEventListener('DOMContentLoaded', () => {
    // 1. Cargar Inventario si estamos en la tabla
    if (typeof cargarInventario === 'function') {
        cargarInventario();
    }

    // 2. Event Listeners para el Modal de Venta (Cálculo dinámico)
    const inputPrecioFinal = document.getElementById('venta-precio-final');
    const inputAnticipo = document.getElementById('venta-anticipo');

    if (inputPrecioFinal) inputPrecioFinal.addEventListener('input', calcularRestante);
    if (inputAnticipo) inputAnticipo.addEventListener('input', calcularRestante);

    // 3. Tooltip de Imagen (Hover)
    initImagePreview();
});

// Función para inicializar el preview de imagen
function initImagePreview() {
    const tablaInventario = document.getElementById('inventory-table-body');
    const popup = document.getElementById('image-preview-popup');
    
    if (!tablaInventario || !popup) return;

    const popupImg = popup.querySelector('img');

    tablaInventario.addEventListener('mouseover', function(e) {
        if (e.target.classList.contains('js-preview-trigger')) {
            const largeSrc = e.target.getAttribute('data-large-src');
            if (largeSrc) {
                popupImg.src = largeSrc;
                popup.style.display = 'block';
            }
        }
    });

    tablaInventario.addEventListener('mousemove', function(e) {
        if (popup.style.display === 'block') {
            const offset = 20; 
            const popupHeight = 280; 
            const windowHeight = window.innerHeight; 
            let topPosition = e.clientY + offset; 

            if (topPosition + popupHeight > windowHeight) {
                topPosition = e.clientY - popupHeight - offset;
            }
            popup.style.top = topPosition + 'px';
            popup.style.left = (e.clientX + offset) + 'px';
        }
    });

    tablaInventario.addEventListener('mouseout', function(e) {
        if (e.target.classList.contains('js-preview-trigger')) {
            popup.style.display = 'none';
        }
    });
}

// Actualizar badge de alertas en todas las páginas
function actualizarBadgeAlertas() {
    const badge = document.getElementById('nav-alertas-badge');
    if (!badge) return;
    
    // Generar alertas (copia lógica simplificada)
    const productos = JSON.parse(localStorage.getItem(DB_KEY)) || [];
    const ventas = JSON.parse(localStorage.getItem(SALES_KEY)) || [];
    
    let totalAlertas = 0;
    
    // Contar alertas críticas básicas
    const ahora = new Date();
    
    // Paquetes retrasados
    totalAlertas += productos.filter(p => {
        if (p.ubicacion === 'en_camino') {
            const dias = Math.floor((ahora - new Date(p.fechaRegistro)) / (1000 * 60 * 60 * 24));
            return dias >= 7;
        }
        return false;
    }).length;
    
    // Deudas críticas
    const deudasCriticas = ventas.filter(v => {
        if (v.esCredito && v.saldoPendiente > 1000) return true;
        if (v.esCredito && v.saldoPendiente > 0) {
            const dias = Math.floor((ahora - new Date(v.fecha)) / (1000 * 60 * 60 * 24));
            return dias > 15;
        }
        return false;
    });
    totalAlertas += deudasCriticas.length;
    
    // Mostrar badge si hay alertas
    if (totalAlertas > 0) {
        badge.innerText = totalAlertas > 9 ? '9+' : totalAlertas;
        badge.style.display = 'inline-block';
    } else {
        badge.style.display = 'none';
    }
}

// Ejecutar al cargar cualquier página
document.addEventListener('DOMContentLoaded', actualizarBadgeAlertas);
