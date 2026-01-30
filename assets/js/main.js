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