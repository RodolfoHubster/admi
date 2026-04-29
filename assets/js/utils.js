// --- UTILIDADES Y AYUDAS ---

async function solicitarPin() {
    const intento = prompt("🔐 SEGURIDAD: Ingrese el PIN de Administrador:");
    if (!intento) return false;
    const encoder = new TextEncoder();
    const data = encoder.encode(intento);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    return hashHex === ADMIN_PIN;
}

function requirePermission(permission, message = 'No tienes permisos para esta acción.') {
    if (typeof fitoCan !== 'function') return true;
    const ok = fitoCan(permission);
    if (!ok) {
        if (typeof showToast === 'function') showToast(message, 'warning');
        else alert(message);
    }
    return ok;
}

function formatMoney(amount) {
    return '$' + parseFloat(amount).toLocaleString('es-MX', {minimumFractionDigits: 2});
}

// =========================================================
// TOAST — Reemplaza todos los alert() del proyecto
// Uso: showToast('Mensaje', 'success' | 'error' | 'warning' | 'info')
// =========================================================
function showToast(mensaje, tipo = 'info', duracion = 3500) {
    // Crear contenedor si no existe
    let contenedor = document.getElementById('__toast-container');
    if (!contenedor) {
        contenedor = document.createElement('div');
        contenedor.id = '__toast-container';
        contenedor.style.cssText = `
            position: fixed;
            bottom: 24px;
            right: 16px;
            z-index: 99999;
            display: flex;
            flex-direction: column;
            gap: 10px;
            max-width: 340px;
        `;
        document.body.appendChild(contenedor);
    }

    const colores = {
        success: { bg: '#1a3d2b', border: '#28a745', icon: '✅', text: '#69F0AE' },
        error:   { bg: '#3d1a1a', border: '#dc3545', icon: '❌', text: '#ff6b6b' },
        warning: { bg: '#3d2e00', border: '#ffc107', icon: '⚠️', text: '#FFD700' },
        info:    { bg: '#1a2a3d', border: '#0dcaf0', icon: 'ℹ️', text: '#74d7f7' }
    };
    const c = colores[tipo] || colores.info;

    const toast = document.createElement('div');
    toast.style.cssText = `
        background: ${c.bg};
        border: 1px solid ${c.border};
        border-left: 4px solid ${c.border};
        color: ${c.text};
        padding: 12px 16px;
        border-radius: 10px;
        font-size: 0.88rem;
        font-family: 'Poppins', sans-serif;
        box-shadow: 0 4px 20px rgba(0,0,0,0.5);
        display: flex;
        align-items: flex-start;
        gap: 10px;
        opacity: 0;
        transform: translateX(30px);
        transition: opacity 0.3s ease, transform 0.3s ease;
        max-width: 340px;
        word-break: break-word;
    `;
    toast.innerHTML = `<span style="font-size:1.1rem;">${c.icon}</span><span>${mensaje}</span>`;
    contenedor.appendChild(toast);

    // Animación entrada
    requestAnimationFrame(() => {
        toast.style.opacity = '1';
        toast.style.transform = 'translateX(0)';
    });

    // Auto-quitar
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(30px)';
        setTimeout(() => toast.remove(), 350);
    }, duracion);
}

// =========================================================
// CONFIRM BONITO — Reemplaza confirm() nativo
// Uso: showConfirm('¿Seguro?', () => { acción si acepta })
// =========================================================
function showConfirm(mensaje, onAceptar, titulo = '¿Confirmar acción?') {
    // Quitar confirm previo si existe
    const prev = document.getElementById('__confirm-modal');
    if (prev) prev.remove();

    const modal = document.createElement('div');
    modal.id = '__confirm-modal';
    modal.style.cssText = `
        position: fixed; inset: 0;
        background: rgba(0,0,0,0.75);
        z-index: 99998;
        display: flex;
        align-items: flex-end;
        justify-content: center;
        padding-bottom: 20px;
    `;
    modal.innerHTML = `
        <div style="
            background: #1a1a1a;
            border: 1px solid #FFD700;
            border-radius: 20px 20px 16px 16px;
            padding: 24px 20px 16px;
            max-width: 380px;
            width: 95%;
            box-shadow: 0 -4px 30px rgba(0,0,0,0.6);
            font-family: 'Poppins', sans-serif;
        ">
            <h6 style="color:#FFD700; font-weight:700; margin-bottom:10px;">${titulo}</h6>
            <p style="color:#ccc; font-size:0.9rem; margin-bottom:20px;">${mensaje}</p>
            <div style="display:flex; gap:10px;">
                <button id="__confirm-cancel" style="
                    flex:1; padding:12px; border-radius:10px;
                    background:#2d2d2d; border:1px solid #444;
                    color:#aaa; font-weight:600; cursor:pointer;
                    font-family:'Poppins',sans-serif;
                ">Cancelar</button>
                <button id="__confirm-ok" style="
                    flex:1; padding:12px; border-radius:10px;
                    background:#FFD700; border:none;
                    color:#000; font-weight:700; cursor:pointer;
                    font-family:'Poppins',sans-serif;
                ">Confirmar</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);

    document.getElementById('__confirm-cancel').onclick = () => modal.remove();
    document.getElementById('__confirm-ok').onclick = () => {
        modal.remove();
        onAceptar();
    };
    // Cerrar tocando el fondo
    modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
}

// --- GENERADORES DE BADGES ---

function getBadgeInversion(tipo) {
    if (tipo === 'mio') return '<span class="badge bg-primary">Solo Mío</span>';
    if (tipo === 'socio') return '<span class="badge bg-warning text-dark">Solo Socio</span>';
    if (tipo === 'mitad') return '<span class="badge bg-warning text-dark">50 / 50</span>';
    return '<span class="badge bg-secondary">Otro</span>';
}

function getBadgeDestino(prod) {
    if (prod.destino === 'pedido') {
        const nombre = prod.cliente || 'Pedido';
        return `<span class="badge border border-danger text-danger" title="${nombre}" style="max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;display:inline-block;">👤 ${nombre}</span>`;
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

function calcularDeudaSocioPorPieza(costo, precioVenta, tipoInversion, porcentajeSocio) {
    costo = parseFloat(costo) || 0;
    precioVenta = parseFloat(precioVenta) || 0;
    porcentajeSocio = parseFloat(porcentajeSocio) || 0;
    const utilidadTotal = precioVenta - costo;
    let inversionSocio = 0;
    if (tipoInversion === 'mitad')        inversionSocio = costo * 0.5;
    else if (tipoInversion === 'socio')   inversionSocio = costo;
    else if (tipoInversion === 'personalizado') inversionSocio = costo * (porcentajeSocio / 100);
    let gananciaSocio = 0;
    if (tipoInversion === 'mitad')        gananciaSocio = utilidadTotal * 0.5;
    else if (tipoInversion === 'socio')   gananciaSocio = utilidadTotal;
    else if (tipoInversion === 'personalizado') gananciaSocio = utilidadTotal * (porcentajeSocio / 100);
    return { inversionSocio, gananciaSocio, totalPagarSocio: inversionSocio + gananciaSocio };
}

window.requirePermission = requirePermission;
