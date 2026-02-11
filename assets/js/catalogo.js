// =========================================================
// CATÁLOGO VISUAL PARA WHATSAPP
// =========================================================

let productosDisponibles = [];
let productoSeleccionado = null;

// Número de WhatsApp (CAMBIA ESTO POR TU NÚMERO)
const WHATSAPP_NUMERO = '526648162623'; // Formato: 52 + 10 dígitos

document.addEventListener('DOMContentLoaded', () => {
    cargarCatalogo();
});

// =========================================================
// CARGAR PRODUCTOS
// =========================================================

function cargarCatalogo() {
    const productos = JSON.parse(localStorage.getItem(DB_KEY)) || [];
    productosDisponibles = productos;
    filtrarCatalogo();
}

function filtrarCatalogo() {
    const busqueda = document.getElementById('buscar-catalogo').value.toLowerCase();
    const disponibilidad = document.getElementById('filtro-disponibilidad').value;
    const orden = document.getElementById('filtro-orden').value;
    
    // 1. FILTRAR
    let filtrados = productosDisponibles.filter(p => {
        // Filtro de búsqueda
        const matchBusqueda = p.nombre.toLowerCase().includes(busqueda) || 
                              p.marca.toLowerCase().includes(busqueda);
        
        if (!matchBusqueda) return false;
        
        // Filtro de disponibilidad
        if (disponibilidad === 'disponibles') {
            return p.destino === 'stock' && p.ubicacion !== 'en_camino';
        } else if (disponibilidad === 'pedidos') {
            return p.destino === 'pedido';
        }
        
        return true; // "todos"
    });
    
    // 2. ORDENAR
    filtrados.sort((a, b) => {
        if (orden === 'precio-desc') return b.precioVenta - a.precioVenta;
        if (orden === 'precio-asc') return a.precioVenta - b.precioVenta;
        if (orden === 'nombre') return a.nombre.localeCompare(b.nombre);
        if (orden === 'reciente') return new Date(b.fechaRegistro) - new Date(a.fechaRegistro);
        return 0;
    });
    
    // 3. RENDERIZAR
    renderCatalogo(filtrados);
}

function renderCatalogo(productos) {
    const grid = document.getElementById('catalogo-grid');
    const vacio = document.getElementById('catalogo-vacio');
    
    document.getElementById('total-productos').innerText = productos.length;
    
    if (productos.length === 0) {
        grid.innerHTML = '';
        vacio.style.display = 'block';
        return;
    }
    
    vacio.style.display = 'none';
    grid.innerHTML = '';
    
    productos.forEach(prod => {
        const imagenUrl = prod.imagen || 'https://cdn-icons-png.flaticon.com/512/2636/2636280.png';
        
        // Badge de disponibilidad
        let badge = '';
        if (prod.destino === 'pedido') {
            badge = '<div class="badge-pedido">📋 Pedido</div>';
        } else if (prod.ubicacion === 'en_camino') {
            badge = '<div class="badge-pedido">🚚 En Camino</div>';
        } else {
            badge = '<div class="badge-disponible">✓ Disponible</div>';
        }
        
        const card = `
            <div class="col-6 col-md-4 col-lg-3">
                <div class="product-card" onclick='verDetalleProducto(${JSON.stringify(prod).replace(/'/g, "&apos;")})'>
                    <div style="position: relative;">
                        ${badge}
                        <img src="${imagenUrl}" 
                             class="product-image" 
                             alt="${prod.nombre}"
                             onerror="this.src='https://cdn-icons-png.flaticon.com/512/2636/2636280.png'">
                    </div>
                    <div class="product-info">
                        <div class="product-name">${prod.nombre}</div>
                        <div class="product-brand">${prod.marca}</div>
                        <div class="product-price">$${prod.precioVenta.toFixed(0)}</div>
                    </div>
                </div>
            </div>
        `;
        
        grid.innerHTML += card;
    });
}

// =========================================================
// DETALLE DE PRODUCTO
// =========================================================

function verDetalleProducto(producto) {
    productoSeleccionado = producto;
    
    document.getElementById('modal-nombre').innerText = producto.nombre;
    document.getElementById('modal-marca').innerText = producto.marca;
    document.getElementById('modal-precio').innerText = `$${producto.precioVenta.toFixed(0)}`;
    document.getElementById('modal-sku').innerText = producto.sku;
    
    const imagenUrl = producto.imagen || 'https://cdn-icons-png.flaticon.com/512/2636/2636280.png';
    document.getElementById('modal-imagen').src = imagenUrl;
    
    new bootstrap.Modal(document.getElementById('modalDetalleProducto')).show();
}

function consultarProducto() {
    if (!productoSeleccionado) return;
    
    const mensaje = `Hola! Me interesa este perfume:\n\n` +
                   `${productoSeleccionado.nombre}\n` +
                   `${productoSeleccionado.marca}\n` +
                   `$${productoSeleccionado.precioVenta}\n\n` +
                   `Esta disponible?`;
    
    const url = `https://wa.me/${WHATSAPP_NUMERO}?text=${encodeURIComponent(mensaje)}`;
    window.open(url, '_blank');
}


// =========================================================
// COMPARTIR CATÁLOGO
// =========================================================

function compartirCatalogo() {
    const productos = productosDisponibles.filter(p => 
        p.destino === 'stock' && p.ubicacion !== 'en_camino'
    );
    
    if (productos.length === 0) {
        alert('No hay productos disponibles para compartir');
        return;
    }
    
    // Crear lista COMPLETA de productos disponibles
    let listaPerfumes = '';
    productos.forEach((p, i) => {
        listaPerfumes += `${i + 1}. ${p.nombre} - $${p.precioVenta}\n`;
    });
    
    const mensaje = `*CATALOGO FITOSCENTS*\n\n` +
                   `${productos.length} perfumes disponibles\n` +
                   `100% Originales\n` +
                   `Entregas en diferentes partes de Tijuana\n\n` +
                   `*Disponibles:*\n` +
                   `${listaPerfumes}\n` +
                   `Cual te interesa?`;
    
    const url = `https://wa.me/?text=${encodeURIComponent(mensaje)}`;
    window.open(url, '_blank');
}




// =========================================================
// UTILIDADES
// =========================================================

function limpiarFiltros() {
    document.getElementById('buscar-catalogo').value = '';
    document.getElementById('filtro-disponibilidad').value = 'disponibles';
    document.getElementById('filtro-orden').value = 'precio-desc';
    filtrarCatalogo();
}
