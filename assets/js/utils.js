// --- UTILIDADES Y AYUDAS ---

function solicitarPin() {
    const intento = prompt("🔐 SEGURIDAD: Ingrese el PIN de Administrador:");
    return intento === ADMIN_PIN;
}

function formatMoney(amount) {
    return '$' + parseFloat(amount).toLocaleString('es-MX', {minimumFractionDigits: 2});
}

// --- GENERADORES DE BADGES (Etiquetas visuales) ---

function getBadgeInversion(tipo) {
    if (tipo === 'mio') return '<span class="badge bg-primary">Solo Mío</span>';
    if (tipo === 'socio') return '<span class="badge bg-warning text-dark">Solo Socio</span>';
    if (tipo === 'mitad') return '<span class="badge bg-warning text-dark">50 / 50</span>';
    return '<span class="badge bg-secondary">Otro</span>';
}

function getBadgeDestino(prod) {
    if (prod.destino === 'pedido') {
        return `<span class="badge border border-danger text-danger">👤 ${prod.cliente || 'Pedido'}</span>`;
    }
    return '<span class="badge border border-secondary text-secondary bg-light">🏠 Stock</span>';
}

function getBotonesAccion(index) {
    return `
        <div class="d-flex gap-1 justify-content-start">
            <button class="btn btn-outline-primary btn-sm py-0 px-2" onclick="agregarAlCarrito(${index})" title="Carrito">🛒</button>
            <button class="btn btn-primary btn-sm py-0 px-2" onclick="editarProducto(${index})" title="Editar">✏️</button>
            <button class="btn btn-success btn-sm py-0 px-2" onclick="iniciarVenta(${index})" title="Vender">$</button>
            <button class="btn btn-danger btn-sm py-0 px-2" onclick="eliminarProducto(${index})" title="Borrar">🗑️</button>
        </div>
    `;
}

// Calcula cuánto se le debe al socio POR UNA PIEZA,
// dado costo, precioVenta, tipo de inversión y porcentaje
function calcularDeudaSocioPorPieza(costo, precioVenta, tipoInversion, porcentajeSocio) {
    costo = parseFloat(costo) || 0;
    precioVenta = parseFloat(precioVenta) || 0;
    porcentajeSocio = parseFloat(porcentajeSocio) || 0;

    const utilidadTotal = precioVenta - costo; // ganancia total de esa pieza

    // 1) Inversión del socio
    let inversionSocio = 0;
    if (tipoInversion === 'mitad') {
        inversionSocio = costo * 0.5;
    } else if (tipoInversion === 'socio') {
        inversionSocio = costo;
    } else if (tipoInversion === 'personalizado') {
        inversionSocio = costo * (porcentajeSocio / 100);
    }

    // 2) Ganancia del socio
    let gananciaSocio = 0;
    if (tipoInversion === 'mitad') {
        gananciaSocio = utilidadTotal * 0.5;
    } else if (tipoInversion === 'socio') {
        gananciaSocio = utilidadTotal; // toda la ganancia
    } else if (tipoInversion === 'personalizado') {
        gananciaSocio = utilidadTotal * (porcentajeSocio / 100);
    }

    // 3) Total que le deberías entregar si se vende
    const totalPagarSocio = inversionSocio + gananciaSocio;

    return {
        inversionSocio,
        gananciaSocio,
        totalPagarSocio
    };
}
