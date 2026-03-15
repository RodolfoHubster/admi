// =========================================================
// CATÁLOGO VISUAL PARA WHATSAPP
// =========================================================

let productosDisponibles = [];
let productoSeleccionado = null;

const WHATSAPP_NUMERO = '526648162623';

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

    let filtrados = productosDisponibles.filter(p => {
        const matchBusqueda = p.nombre.toLowerCase().includes(busqueda) ||
                              p.marca.toLowerCase().includes(busqueda);
        if (!matchBusqueda) return false;
        if (disponibilidad === 'disponibles') {
            return p.destino === 'stock' && p.ubicacion !== 'en_camino';
        } else if (disponibilidad === 'pedidos') {
            return p.destino === 'pedido';
        }
        return true;
    });

    filtrados.sort((a, b) => {
        if (orden === 'precio-desc') return b.precioVenta - a.precioVenta;
        if (orden === 'precio-asc')  return a.precioVenta - b.precioVenta;
        if (orden === 'nombre')      return a.nombre.localeCompare(b.nombre);
        if (orden === 'reciente')    return new Date(b.fechaRegistro) - new Date(a.fechaRegistro);
        return 0;
    });

    renderCatalogo(filtrados);
}

// =========================================================
// AGRUPAR DUPLICADOS
// Junta productos con mismo nombre + marca en una sola tarjeta
// y muestra la cantidad total disponible.
// =========================================================

function agruparProductos(productos) {
    const mapa = new Map();
    productos.forEach(p => {
        const clave = `${p.nombre.trim().toLowerCase()}||${p.marca.trim().toLowerCase()}`;
        if (mapa.has(clave)) {
            const existente = mapa.get(clave);
            existente._cantidad = (existente._cantidad || 1) + 1;
            // Sumar stock si tiene campo cantidad
            existente._totalUnidades = (existente._totalUnidades || (existente.cantidad || 1)) + (p.cantidad || 1);
        } else {
            const copia = Object.assign({}, p);
            copia._cantidad = 1;
            copia._totalUnidades = p.cantidad || 1;
            mapa.set(clave, copia);
        }
    });
    return Array.from(mapa.values());
}

// =========================================================
// RENDERIZAR
// =========================================================

function renderCatalogo(productos) {
    const grid  = document.getElementById('catalogo-grid');
    const vacio = document.getElementById('catalogo-vacio');

    // Agrupar antes de renderizar
    const agrupados = agruparProductos(productos);

    document.getElementById('total-productos').innerText = agrupados.length;

    if (agrupados.length === 0) {
        grid.innerHTML = '';
        vacio.style.display = 'block';
        return;
    }

    vacio.style.display = 'none';
    grid.innerHTML = '';

    agrupados.forEach(prod => {
        const imagenUrl = prod.imagen || 'https://cdn-icons-png.flaticon.com/512/2636/2636280.png';
        const cantidad  = prod._cantidad || 1;

        // Badge disponibilidad
        let badge = '';
        if (prod.destino === 'pedido') {
            badge = '<div class="badge-pedido">📋 Pedido</div>';
        } else if (prod.ubicacion === 'en_camino') {
            badge = '<div class="badge-pedido">🚚 En Camino</div>';
        } else {
            badge = '<div class="badge-disponible">✓ Disponible</div>';
        }

        // Badge de cantidad (solo si hay más de 1)
        const badgeCantidad = cantidad > 1
            ? `<div style="
                position:absolute; bottom:8px; right:8px;
                background:#FFD700; color:#000;
                font-size:11px; font-weight:700;
                border-radius:20px; padding:2px 8px;
                box-shadow:0 2px 6px rgba(0,0,0,0.4);
                z-index:2;
               ">x${cantidad} disponibles</div>`
            : '';

        // Serializar sin _cantidad/_totalUnidades para el modal
        const prodLimpio = Object.assign({}, prod);
        delete prodLimpio._cantidad;
        delete prodLimpio._totalUnidades;
        prodLimpio._cantidadCatalogo = cantidad; // pasa la cantidad al modal

        const card = `
            <div class="col-6 col-md-4 col-lg-3">
                <div class="product-card" onclick='verDetalleProducto(${JSON.stringify(prodLimpio).replace(/'/g, "&apos;")})'>
                    <div style="position:relative;">
                        ${badge}
                        <img src="${imagenUrl}"
                             class="product-image"
                             alt="${prod.nombre}"
                             onerror="this.src='https://cdn-icons-png.flaticon.com/512/2636/2636280.png'">
                        ${badgeCantidad}
                    </div>
                    <div class="product-info">
                        <div class="product-name">${prod.nombre}</div>
                        <div class="product-brand">${prod.marca}</div>
                        <div class="product-price">$${prod.precioVenta.toFixed(0)}</div>
                    </div>
                </div>
            </div>`;

        grid.innerHTML += card;
    });
}

// =========================================================
// DETALLE DE PRODUCTO
// =========================================================

function verDetalleProducto(producto) {
    productoSeleccionado = producto;

    document.getElementById('modal-nombre').innerText = producto.nombre;
    document.getElementById('modal-marca').innerText  = producto.marca;
    document.getElementById('modal-precio').innerText = `$${producto.precioVenta.toFixed(0)}`;
    document.getElementById('modal-sku').innerText    = producto.sku;

    const imagenUrl = producto.imagen || 'https://cdn-icons-png.flaticon.com/512/2636/2636280.png';
    document.getElementById('modal-imagen').src = imagenUrl;

    // Mostrar cantidad si hay más de 1
    const elCantidad = document.getElementById('modal-cantidad');
    if (elCantidad) {
        const cant = producto._cantidadCatalogo || 1;
        elCantidad.style.display = cant > 1 ? 'block' : 'none';
        elCantidad.innerText = `📦 ${cant} unidades disponibles`;
    }

    new bootstrap.Modal(document.getElementById('modalDetalleProducto')).show();
}

function consultarProducto() {
    if (!productoSeleccionado) return;
    const cant = productoSeleccionado._cantidadCatalogo || 1;
    const cantTexto = cant > 1 ? ` (${cant} disponibles)` : '';
    const mensaje = `Hola! Me interesa este perfume:\n\n` +
                    `${productoSeleccionado.nombre}${cantTexto}\n` +
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

    // Agrupar para el mensaje de WhatsApp
    const agrupados = agruparProductos(productos);

    let listaPerfumes = '';
    agrupados.forEach((p, i) => {
        const cant = p._cantidad || 1;
        const cantTexto = cant > 1 ? ` (x${cant})` : '';
        listaPerfumes += `${i + 1}. ${p.nombre}${cantTexto} - $${p.precioVenta}\n`;
    });

    const mensaje = `*CATALOGO FITOSCENTS*\n\n` +
                    `${agrupados.length} perfumes disponibles\n` +
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
