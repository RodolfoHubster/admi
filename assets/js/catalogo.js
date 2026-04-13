// =========================================================
// CATÁLOGO VISUAL FITOSCENTS
// =========================================================

let productosDisponibles = [];
let productoSeleccionado = null;

const WHATSAPP_NUMERO = '526648162623';

document.addEventListener('DOMContentLoaded', () => {
    cargarCatalogo();

    // Al imprimir: forzar solo disponibles (sin pedidos ni en camino)
    window.addEventListener('beforeprint', () => {
        // Guardar estado actual de checkboxes
        window._printCheckState = {
            disponible: document.getElementById('chk-disponible').checked,
            camino:     document.getElementById('chk-camino').checked,
            pedido:     document.getElementById('chk-pedido').checked,
        };
        // Forzar solo disponibles para el PDF del cliente
        setChecks(true, false, false);
        filtrarCatalogo();
    });

    // Al cerrar dialogo: restaurar checkboxes originales
    window.addEventListener('afterprint', () => {
        if (window._printCheckState) {
            const s = window._printCheckState;
            setChecks(s.disponible, s.camino, s.pedido);
            filtrarCatalogo();
            delete window._printCheckState;
        }
    });
});

// Helper: pone los 3 checkboxes y actualiza clases visuales
function setChecks(disponible, camino, pedido) {
    const vals = { disponible, camino, pedido };
    for (const tipo of ['disponible', 'camino', 'pedido']) {
        const chk = document.getElementById('chk-' + tipo);
        const lbl = document.getElementById('lbl-' + tipo);
        if (chk && lbl) {
            chk.checked = vals[tipo];
            lbl.classList.toggle('activo', vals[tipo]);
        }
    }
}

// =========================================================
// CARGAR PRODUCTOS
// =========================================================

async function cargarCatalogo() {
    if (typeof window.getDataCloud !== 'function') {
        setTimeout(cargarCatalogo, 50);
        return;
    }
    try {
        const productos = await window.getDataCloud('perfumes') || [];
        productosDisponibles = productos;
        filtrarCatalogo();
    } catch (error) {
        console.error('Error al cargar el catálogo desde la nube:', error);
    }
}

// =========================================================
// FILTRAR — usa checkboxes
// =========================================================

function filtrarCatalogo() {
    const busqueda    = document.getElementById('buscar-catalogo').value.toLowerCase();
    const orden       = document.getElementById('filtro-orden').value;
    const verDisp     = document.getElementById('chk-disponible')?.checked ?? true;
    const verCamino   = document.getElementById('chk-camino')?.checked ?? false;
    const verPedido   = document.getElementById('chk-pedido')?.checked ?? false;

    let filtrados = productosDisponibles.filter(p => {
        // Busqueda por nombre/marca
        const matchBusqueda = p.nombre.toLowerCase().includes(busqueda) ||
                              p.marca.toLowerCase().includes(busqueda);
        if (!matchBusqueda) return false;

        // Clasificar el producto
        const esCamino    = p.ubicacion === 'en_camino';
        const esPedido    = p.destino === 'pedido' && !esCamino;
        const esDisponible = !esCamino && !esPedido;

        // Incluir si su categoría está marcada
        if (esDisponible && verDisp)  return true;
        if (esCamino    && verCamino) return true;
        if (esPedido    && verPedido) return true;
        return false;
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
// =========================================================

function agruparProductos(productos) {
    const mapa = new Map();
    productos.forEach(p => {
        const clave = `${p.nombre.trim().toLowerCase()}||${p.marca.trim().toLowerCase()}`;
        if (mapa.has(clave)) {
            const existente = mapa.get(clave);
            existente._cantidad = (existente._cantidad || 1) + 1;
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

        // Badge según estado
        let badge = '';
        if (prod.ubicacion === 'en_camino') {
            badge = '<div class="badge-camino">🚚 En Camino</div>';
        } else if (prod.destino === 'pedido') {
            badge = '<div class="badge-pedido">📋 Pedido</div>';
        } else {
            badge = '<div class="badge-disponible">✓ Disponible</div>';
        }

        const badgeCantidad = cantidad > 1
            ? `<div style="position:absolute;bottom:8px;right:8px;background:#FFD700;color:#000;font-size:11px;font-weight:700;border-radius:20px;padding:2px 8px;box-shadow:0 2px 6px rgba(0,0,0,0.4);z-index:2;">x${cantidad} disponibles</div>`
            : '';

        const prodLimpio = Object.assign({}, prod);
        delete prodLimpio._cantidad;
        delete prodLimpio._totalUnidades;
        prodLimpio._cantidadCatalogo = cantidad;

        const card = `
            <div class="col-6 col-md-4 col-lg-3">
                <div class="product-card" onclick='verDetalleProducto(${JSON.stringify(prodLimpio).replace(/'/g, "&apos;")})'>
                    <div style="position:relative;">
                        ${badge}
                        <img src="${imagenUrl}" class="product-image" alt="${prod.nombre}"
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
// DETALLE
// =========================================================

function verDetalleProducto(producto) {
    productoSeleccionado = producto;
    document.getElementById('modal-nombre').innerText = producto.nombre;
    document.getElementById('modal-marca').innerText  = producto.marca;
    document.getElementById('modal-precio').innerText = `$${producto.precioVenta.toFixed(0)}`;
    document.getElementById('modal-sku').innerText    = producto.sku;
    document.getElementById('modal-imagen').src = producto.imagen || 'https://cdn-icons-png.flaticon.com/512/2636/2636280.png';
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
    const mensaje = `Hola! Me interesa este perfume:\n\n${productoSeleccionado.nombre}${cantTexto}\n${productoSeleccionado.marca}\n$${productoSeleccionado.precioVenta}\n\nEsta disponible?`;
    window.open(`https://wa.me/${WHATSAPP_NUMERO}?text=${encodeURIComponent(mensaje)}`, '_blank');
}

// =========================================================
// COMPARTIR
// =========================================================

function compartirCatalogo() {
    const productos = productosDisponibles.filter(p =>
        p.destino === 'stock' && p.ubicacion !== 'en_camino'
    );
    if (productos.length === 0) { alert('No hay productos disponibles para compartir'); return; }
    const agrupados = agruparProductos(productos);
    let listaPerfumes = '';
    agrupados.forEach((p, i) => {
        const cant = p._cantidad || 1;
        listaPerfumes += `${i + 1}. ${p.nombre}${cant > 1 ? ` (x${cant})` : ''} - $${p.precioVenta}\n`;
    });
    const mensaje = `*CATALOGO FITOSCENTS*\n\n${agrupados.length} perfumes disponibles\n100% Originales\nEntregas en diferentes partes de Tijuana\n\n*Disponibles:*\n${listaPerfumes}\nCual te interesa?`;
    window.open(`https://wa.me/?text=${encodeURIComponent(mensaje)}`, '_blank');
}

// =========================================================
// UTILIDADES
// =========================================================

function limpiarFiltros() {
    document.getElementById('buscar-catalogo').value = '';
    document.getElementById('filtro-orden').value = 'precio-desc';
    // Restaurar solo Disponibles marcado
    setChecks(true, false, false);
    filtrarCatalogo();
}
