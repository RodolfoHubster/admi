// =========================================================
// 1. VARIABLES GLOBALES
// =========================================================
let listadoVentas = [];
let listadoPagos = [];
let filtroFechaActual = 'todos';
let filtroEstadoActual = 'todos';

// =========================================================
// 2. FUNCIONES DE VENTA (CREAR)
// =========================================================

function iniciarVenta(index) {
    if (typeof requirePermission === 'function' && !requirePermission('sell')) return;
    const productos = (typeof getData === 'function')
        ? (getData('perfumes') || [])
        : (JSON.parse(localStorage.getItem(DB_KEY)) || []);
    const prod = productos[index];
    document.getElementById('venta-nombre-producto').innerText = prod.nombre;
    document.getElementById('venta-precio-lista').value = `$${prod.precioVenta}`;
    document.getElementById('venta-precio-final').value = prod.precioVenta;
    document.getElementById('venta-index-producto').value = index;
    if(document.getElementById('venta-gastos')) document.getElementById('venta-gastos').value = 0;
    const inputCliente = document.getElementById('venta-cliente');
    const checkCredito = document.getElementById('checkCredito');
    if (prod.cliente && prod.cliente.trim() !== '' && prod.cliente !== 'Mostrador') {
        inputCliente.value = prod.cliente;
        inputCliente.dataset.duenoOriginal = prod.cliente;
    } else {
        inputCliente.value = '';
        inputCliente.dataset.duenoOriginal = '';
        if(checkCredito.checked) { checkCredito.checked = false; toggleCredito(); }
    }
    new bootstrap.Modal(document.getElementById('modalVenta')).show();
}

function confirmarVentaFinal() {
    if (typeof requirePermission === 'function' && !requirePermission('sell')) return;
    const index = document.getElementById('venta-index-producto').value;
    const precioFinal = parseFloat(document.getElementById('venta-precio-final').value);
    const gastosExtra = parseFloat(document.getElementById('venta-gastos').value) || 0;
    const esCredito = document.getElementById('checkCredito').checked;
    const anticipo = parseFloat(document.getElementById('venta-anticipo').value) || 0;
    const nombreCliente = document.getElementById('venta-cliente').value.trim().toUpperCase();

    if (!precioFinal || precioFinal <= 0) return showToast('El precio no puede ser cero.', 'warning');
    if (anticipo < 0) return showToast('El anticipo no puede ser negativo.', 'warning');
    if (esCredito && anticipo > precioFinal) return showToast('El anticipo no puede ser mayor al total de la venta.', 'warning');

    const productos = (typeof getData === 'function')
        ? (getData('perfumes') || [])
        : (JSON.parse(localStorage.getItem(DB_KEY)) || []);
    const producto = productos[index];
    const costo = producto.costo;
    const utilidadTotal = precioFinal - costo - gastosExtra;

    let gananciaMia = 0, gananciaSocio = 0, pctSocio = 0;
    if (producto.inversion === 'mio') {
        gananciaMia = utilidadTotal;
    } else if (producto.inversion === 'socio') {
        gananciaSocio = utilidadTotal;
    } else if (producto.inversion === 'mitad') {
        gananciaSocio = utilidadTotal * 0.50;
        gananciaMia   = utilidadTotal * 0.50;
    } else if (producto.inversion === 'personalizado') {
        pctSocio = producto.porcentajeSocio || 0;
        gananciaSocio = utilidadTotal * (pctSocio / 100);
        gananciaMia   = utilidadTotal - gananciaSocio;
    } else {
        gananciaMia = utilidadTotal;
    }

    const nuevaVenta = {
        id: Date.now(),
        producto: producto.nombre, marca: producto.marca, imagen: producto.imagen, sku: producto.sku,
        costoOriginal: costo, precioFinal, gastosExtra, utilidad: utilidadTotal,
        reparto: { yo: gananciaMia, socio: gananciaSocio },
        reglasReparto: { tipo: producto.inversion, pctSocio },
        fecha: new Date().toLocaleString(),
        esCredito,
        cliente: esCredito ? nombreCliente : (producto.cliente || 'Mostrador'),
        saldoPendiente: esCredito ? (precioFinal - anticipo) : 0,
        historialAbonos: []
    };
    if (esCredito && anticipo > 0) {
        nuevaVenta.historialAbonos.push({ fecha: new Date().toLocaleString(), monto: anticipo, nota: 'Anticipo Inicial' });
    }

    const historial = (typeof getData === 'function')
        ? (getData('ventas') || [])
        : (JSON.parse(localStorage.getItem(SALES_KEY)) || []);
    historial.push(nuevaVenta);
    setData('ventas', historial);
    if (typeof auditLog === 'function') {
        auditLog('sales.create', {
            ventaId: nuevaVenta.id,
            producto: nuevaVenta.producto,
            cliente: nuevaVenta.cliente,
            total: nuevaVenta.precioFinal,
            credito: nuevaVenta.esCredito
        });
    }

    if (producto.cantidad && producto.cantidad > 1) {
        producto.cantidad -= 1;
        productos[index] = producto;
    } else {
        productos.splice(index, 1);
    }
    setData('perfumes', productos);

    bootstrap.Modal.getInstance(document.getElementById('modalVenta')).hide();
    document.getElementById('checkCredito').checked = false;
    toggleCredito();
    generarTicket([{ producto: producto.nombre, precio: precioFinal }], precioFinal,
        esCredito ? nombreCliente : (producto.cliente || 'Mostrador'), esCredito, anticipo);
}

// =========================================================
// 3. EDICIÓN DE VENTAS
// =========================================================

function toggleEditPersonalizado() {
    const sel = document.getElementById('edit-inversion');
    const div = document.getElementById('div-edit-pct');
    if(sel && div) div.style.display = (sel.value === 'personalizado') ? 'block' : 'none';
}

function abrirEdicion(id) {
    const venta = listadoVentas.find(v => v.id === id);
    if (!venta) return;
    document.getElementById('edit-id-venta').value   = venta.id;
    document.getElementById('edit-producto').value   = venta.producto;
    document.getElementById('edit-precio').value     = venta.precioFinal;
    document.getElementById('edit-utilidad').value   = venta.utilidad;
    document.getElementById('edit-cliente').value    = venta.cliente || '';

    let tipoDetectado = 'mio', pctDetectado = 0;
    if (venta.reglasReparto && venta.reglasReparto.tipo) {
        tipoDetectado = venta.reglasReparto.tipo;
        pctDetectado  = venta.reglasReparto.pctSocio || 0;
    } else {
        if (venta.reparto.socio > 0 && venta.reparto.yo > 0) {
            const pctMatematico = (venta.reparto.socio / venta.utilidad) * 100;
            tipoDetectado = Math.abs(pctMatematico - 50) < 1 ? 'mitad' : 'personalizado';
            if (tipoDetectado === 'personalizado') pctDetectado = Math.round(pctMatematico);
        } else if (venta.reparto.socio > 0) tipoDetectado = 'socio';
    }

    const selInv = document.getElementById('edit-inversion');
    const inpPct = document.getElementById('edit-porcentaje');
    if(selInv) selInv.value = tipoDetectado;
    if(inpPct) inpPct.value = pctDetectado;
    toggleEditPersonalizado();
    new bootstrap.Modal(document.getElementById('modalEditarVenta')).show();
}

function guardarEdicionVenta() {
    if (typeof requirePermission === 'function' && !requirePermission('edit')) return;
    const id = parseFloat(document.getElementById('edit-id-venta').value);
    const nuevoPrecio  = parseFloat(document.getElementById('edit-precio').value);
    const nuevoCliente = document.getElementById('edit-cliente').value.trim().toUpperCase();
    const selectInversion = document.getElementById('edit-inversion');
    const inputPorcentaje = document.getElementById('edit-porcentaje');
    if (!selectInversion) return showToast('ERROR: No encuentro los campos en el HTML.', 'error');

    const nuevoTipo = selectInversion.value;
    const nuevoPct  = parseFloat(inputPorcentaje.value) || 0;
    const index = listadoVentas.findIndex(v => v.id === id);
    if (index === -1) return;

    const costo = listadoVentas[index].costoOriginal;
    const gastos = listadoVentas[index].gastosExtra || 0;
    const nuevaUtilidad = nuevoPrecio - costo - gastos;

    let nuevaGananciaSocio = 0, nuevaGananciaYo = 0;
    if (nuevoTipo === 'mio')        { nuevaGananciaYo = nuevaUtilidad; }
    else if (nuevoTipo === 'socio') { nuevaGananciaSocio = nuevaUtilidad; }
    else if (nuevoTipo === 'mitad') { nuevaGananciaSocio = nuevaUtilidad * 0.5; nuevaGananciaYo = nuevaUtilidad * 0.5; }
    else if (nuevoTipo === 'personalizado') {
        nuevaGananciaSocio = nuevaUtilidad * (nuevoPct / 100);
        nuevaGananciaYo    = nuevaUtilidad - nuevaGananciaSocio;
    }

    listadoVentas[index].precioFinal     = nuevoPrecio;
    listadoVentas[index].utilidad        = nuevaUtilidad;
    listadoVentas[index].cliente         = nuevoCliente;
    listadoVentas[index].reparto.socio   = nuevaGananciaSocio;
    listadoVentas[index].reparto.yo      = nuevaGananciaYo;
    listadoVentas[index].reglasReparto   = { tipo: nuevoTipo, pctSocio: nuevoPct };

    setData('ventas', listadoVentas);
    if (typeof auditLog === 'function') {
        auditLog('sales.update', { id, precio: nuevoPrecio, cliente: nuevoCliente, tipo: nuevoTipo });
    }
    bootstrap.Modal.getInstance(document.getElementById('modalEditarVenta')).hide();
    setTimeout(() => cargarDatosVentas(), 100);
}

// =========================================================
// 4. FUNCIONES AUXILIARES
// =========================================================

function generarTicket(items, total, cliente, esCredito, anticipo) {
    document.getElementById('ticket-fecha').innerText   = new Date().toLocaleString();
    document.getElementById('ticket-cliente').innerText = cliente || 'Mostrador';
    const estadoEl    = document.getElementById('ticket-estado');
    const infoCredito = document.getElementById('ticket-credito-info');
    if (esCredito) {
        estadoEl.innerText = 'PENDIENTE / CREDITO';
        estadoEl.style.color = 'red';
        infoCredito.style.display = 'block';
        document.getElementById('ticket-acuenta').innerText = formatMoney(anticipo);
        document.getElementById('ticket-resta').innerText   = formatMoney(total - anticipo);
    } else {
        estadoEl.innerText = 'PAGADO';
        estadoEl.style.color = 'black';
        infoCredito.style.display = 'none';
    }
    const lista = document.getElementById('ticket-items');
    lista.innerHTML = '';
    items.forEach(item => {
        lista.innerHTML += `<div class="ticket-item"><span>1 x ${item.producto}</span><span>$${item.precio}</span></div>`;
    });
    document.getElementById('ticket-total-monto').innerText = formatMoney(total);
    new bootstrap.Modal(document.getElementById('modalTicket')).show();
}

function cerrarTicket() {
    bootstrap.Modal.getInstance(document.getElementById('modalTicket')).hide();
    if(typeof cargarInventario === 'function') cargarInventario();
}

function toggleCredito() {
    const check = document.getElementById('checkCredito');
    const bloque = document.getElementById('bloque-credito');
    const inputCliente = document.getElementById('venta-cliente');
    if (check && check.checked) {
        bloque.style.display = 'block';
        const dueno = inputCliente.dataset.duenoOriginal;
        if (dueno) { inputCliente.value = dueno; inputCliente.classList.add('bg-warning', 'bg-opacity-10'); }
    } else {
        bloque.style.display = 'none';
        if (!inputCliente.dataset.duenoOriginal) inputCliente.value = '';
        document.getElementById('venta-anticipo').value = 0;
        calcularRestante();
    }
}

function calcularRestante() {
    const precio = parseFloat(document.getElementById('venta-precio-final').value) || 0;
    const anticipo = parseFloat(document.getElementById('venta-anticipo').value) || 0;
    const restante = precio - anticipo;
    const texto = document.getElementById('texto-restante');
    if (texto) {
        texto.innerText   = restante > 0 ? `Resta por cobrar: $${restante.toFixed(2)}` : '¡Liquidado! (Cobro total)';
        texto.className   = restante > 0 ? 'form-text text-danger fw-bold mt-1' : 'form-text text-success fw-bold mt-1';
    }
}

function cargarDatosVentas() {
    if(!document.getElementById('sales-table-body')) return;
    listadoVentas = (typeof getData === 'function')
        ? (getData('ventas') || [])
        : (JSON.parse(localStorage.getItem(SALES_KEY)) || []);
    listadoPagos  = (typeof getData === 'function')
        ? (getData('pagos') || [])
        : (JSON.parse(localStorage.getItem(PAYOUTS_KEY)) || []);
    renderVentas();
    renderPagos();
    calcularTotales();
}

function renderVentas() {
    const tbody = document.getElementById('sales-table-body');
    if(!tbody) return;
    tbody.innerHTML = '';

    const ventasFiltradas = listadoVentas.filter(v => {
        if (filtroFechaActual !== 'todos') {
            const fechaVenta = new Date(v.id).setHours(0,0,0,0);
            const hoy = new Date().setHours(0,0,0,0);
            if (filtroFechaActual === 'hoy' && fechaVenta !== hoy) return false;
            if (filtroFechaActual === 'semana') {
                const hace7 = new Date(); hace7.setDate(hace7.getDate() - 7);
                if (new Date(v.id) < hace7) return false;
            }
            if (filtroFechaActual === 'mes') {
                const d = new Date(v.id), now = new Date();
                if (d.getMonth() !== now.getMonth() || d.getFullYear() !== now.getFullYear()) return false;
            }
        }
        if (filtroEstadoActual === 'pendiente'  && !(parseFloat(v.saldoPendiente || 0) > 0)) return false;
        if (filtroEstadoActual === 'liquidado'  && !(v.esCredito && parseFloat(v.saldoPendiente || 0) <= 0)) return false;
        if (filtroEstadoActual === 'contado'    && v.esCredito) return false;
        const texto = (document.getElementById('filtro-texto-ventas')?.value || '').toLowerCase();
        if (texto) {
            if (!(v.producto || '').toLowerCase().includes(texto) &&
                !(v.cliente  || '').toLowerCase().includes(texto)) return false;
        }
        return true;
    });

    const ventasDisplay = ventasFiltradas.sort((a, b) => b.id - a.id);
    if (ventasDisplay.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" class="text-center text-muted p-4">📅 No hay ventas en este periodo.</td></tr>`;
        return;
    }

    ventasDisplay.forEach(venta => {
        const canEdit = typeof fitoCan === 'function' ? fitoCan('edit') : true;
        const canDelete = typeof fitoCan === 'function' ? fitoCan('delete') : true;
        const canCharge = typeof fitoCan === 'function' ? fitoCan('charge') : true;
        let inversionSocio = 0;
        let tipo = 'mio', pct = 0;
        if (venta.reglasReparto) {
            tipo = venta.reglasReparto.tipo;
            pct  = venta.reglasReparto.pctSocio;
        } else if (venta.reparto.socio > 0 && venta.reparto.yo > 0) tipo = 'mitad';
        else if (venta.reparto.socio > 0) tipo = 'socio';

        const costo = venta.costoOriginal || 0;
        if (tipo === 'mitad')         inversionSocio = costo * 0.50;
        else if (tipo === 'socio')    inversionSocio = costo;
        else if (tipo === 'personalizado') inversionSocio = costo * (pct / 100);

        const totalPagarSocio = inversionSocio + (venta.reparto.socio || 0);

        const clienteNombre = venta.cliente ?
            `<span class="fw-bold text-gold">${venta.cliente}</span>` :
            `<span class="text-muted fst-italic">Mostrador / Stock</span>`;

        let badgeEstado = '', botonAbonar = '';
        const pendiente = parseFloat(venta.saldoPendiente || 0);
        if (pendiente > 0) {
            badgeEstado = `<div class="mt-1"><span class="badge bg-danger shadow-sm">DEBE: $${pendiente.toFixed(2)}</span></div>`;
            botonAbonar = `<button class="btn btn-sm btn-success fw-bold" onclick="abrirModalAbono(${venta.id})" title="Registrar Abono" ${canCharge ? '' : 'disabled'}>💲</button>`;
        } else if (venta.esCredito) {
            badgeEstado = `<div class="mt-1"><span class="badge bg-success text-dark border border-success">✅ LIQUIDADO</span></div>`;
        }

        const row = `
            <tr>
                <td><small>${venta.fecha}</small></td>
                <td>${clienteNombre}</td>
                <td>
                    <strong>${venta.producto}</strong><br>
                    <small class="text-muted">Venta: ${formatMoney(venta.precioFinal)}</small>
                    ${badgeEstado}
                </td>
                <td class="text-success fw-bold">+$${venta.utilidad.toFixed(2)}</td>
                <td>
                    <div class="d-flex flex-column" style="font-size:0.85rem;">
                        <span class="text-primary">Yo: $${parseFloat(venta.reparto.yo).toFixed(0)}</span>
                        <span class="text-warning text-dark">Soc: $${parseFloat(venta.reparto.socio).toFixed(0)}</span>
                    </div>
                </td>
                <td class="bg-warning bg-opacity-10 border-start border-warning text-center">
                    ${totalPagarSocio > 0 ? `
                        ${venta.pagadoAlSocio ?
                            `<span class="badge bg-success text-white">✅ PAGADO</span>
                             <br><small class="text-muted">$${totalPagarSocio.toFixed(0)}</small>` :
                             `<strong class="text-dark fs-6">$${totalPagarSocio.toFixed(2)}</strong>
                              <br><small class="text-muted" style="font-size:10px;">(Inv: $${inversionSocio.toFixed(0)} + Gan: $${parseFloat(venta.reparto.socio).toFixed(0)})</small>
                              <br><button class="btn btn-sm btn-success mt-1" onclick="marcarPagadoSocio(${venta.id})" title="Marcar como pagado" ${canCharge ? '' : 'disabled'}>💰 Pagar</button>`
                        }` : '<span class="text-muted">-</span>'}
                </td>
                <td>
                    <div class="d-flex gap-1">
                        ${botonAbonar}
                        <button class="btn btn-sm btn-info text-white" onclick="verDetalle(${venta.id})" title="Ver Ficha">ℹ️</button>
                        <button class="btn btn-sm btn-warning" onclick="abrirEdicion(${venta.id})" title="Editar" ${canEdit ? '' : 'disabled'}>✏️</button>
                        <button class="btn btn-sm btn-danger" onclick="deshacerVenta(${venta.id})" title="Devolver Stock" ${canDelete ? '' : 'disabled'}>↩️</button>
                    </div>
                </td>
            </tr>`;
        tbody.innerHTML += row;
        const counter = document.getElementById('contador-ventas');
        if (counter) counter.innerText = ventasDisplay.length;
    });
}

async function deshacerVenta(id) {
    if (typeof requirePermission === 'function' && !requirePermission('delete')) return;
    const venta = listadoVentas.find(v => v.id === id);
    if (!venta) return;

    let generadoSocioTotal = listadoVentas.reduce((acc, v) => {
        const inv = _calcInversionSocio(v);
        return acc + inv + parseFloat(v.reparto.socio || 0);
    }, 0);
    let pagadoSocioTotal = listadoPagos.reduce((acc, p) => acc + parseFloat(p.monto || 0), 0);
    let deudaGlobalActual = generadoSocioTotal - pagadoSocioTotal;

    const totalEstaVenta = _calcInversionSocio(venta) + (venta.reparto.socio || 0);
    if (totalEstaVenta > 0 && totalEstaVenta > deudaGlobalActual) {
        showToast(`No se puede deshacer. Ya le pagaste al socio esta venta. Elimina primero el pago.`, 'error', 5000);
        return;
    }
    const autorizado = await solicitarPin();
    if (!autorizado) return;

    showConfirm(`¿Devolver "${venta.producto}" al Inventario?`, () => {
        const inventario = (typeof getData === 'function')
            ? (getData('perfumes') || [])
            : (JSON.parse(localStorage.getItem(DB_KEY)) || []);
        inventario.push({
            id: Date.now(), nombre: venta.producto, marca: venta.marca || 'Recuperado',
            sku: venta.sku, costo: venta.costoOriginal, precioVenta: venta.precioFinal,
            inversion: venta.reglasReparto?.tipo || 'mitad',
            porcentajeSocio: venta.reglasReparto?.pctSocio || 0,
            destino: (venta.cliente && venta.cliente !== 'Mostrador') ? 'pedido' : 'stock',
            cliente: (venta.cliente && venta.cliente !== 'Mostrador') ? venta.cliente : '',
            ubicacion: 'en_inventario',
            imagen: venta.imagen || 'https://cdn-icons-png.flaticon.com/512/2636/2636280.png',
            cantidad: 1, fechaRegistro: new Date().toISOString()
        });
        setData('perfumes', inventario);
        listadoVentas = listadoVentas.filter(v => v.id !== id);
        setData('ventas', listadoVentas);
        if (typeof auditLog === 'function') {
            auditLog('sales.undo', { id: venta.id, producto: venta.producto, cliente: venta.cliente });
        }
        cargarDatosVentas();
        showToast('Venta deshecha. Producto devuelto al inventario.', 'success');
    });
}

function _calcInversionSocio(venta) {
    const tipo = venta.reglasReparto?.tipo || 'mio';
    const pct  = venta.reglasReparto?.pctSocio || 0;
    const costo = venta.costoOriginal || 0;
    if (tipo === 'mitad')         return costo * 0.5;
    if (tipo === 'socio')         return costo;
    if (tipo === 'personalizado') return costo * (pct / 100);
    return 0;
}

function verDetalle(id) {
    const venta = listadoVentas.find(v => v.id === id);
    if(!venta) return;
    document.getElementById('det-producto').innerText = venta.producto;
    document.getElementById('det-sku').innerText      = venta.sku || 'Sin SKU';
    document.getElementById('det-fecha').innerText    = venta.fecha;
    document.getElementById('det-cliente').innerText  = venta.cliente || 'Venta de Stock';
    document.getElementById('det-costo').innerText    = formatMoney(venta.costoOriginal);
    document.getElementById('det-precio').innerText   = formatMoney(venta.precioFinal);
    document.getElementById('det-utilidad').innerText = formatMoney(venta.utilidad);
    document.getElementById('det-yo').innerText       = formatMoney(venta.reparto.yo);
    document.getElementById('det-socio').innerText    = formatMoney(venta.reparto.socio);
    new bootstrap.Modal(document.getElementById('modalDetalleVenta')).show();
}

function renderPagos() {
    const tbody = document.getElementById('pagos-table-body');
    const msg   = document.getElementById('no-pagos-msg');
    if(!tbody) return;
    tbody.innerHTML = '';
    if (listadoPagos.length === 0) { if(msg) msg.style.display = 'block'; return; }
    if(msg) msg.style.display = 'none';
    [...listadoPagos].sort((a, b) => b.id - a.id).forEach(pago => {
        tbody.innerHTML += `
            <tr>
                <td>${new Date(pago.id).toLocaleDateString()}</td>
                <td class="fw-bold text-danger">-$${pago.monto}</td>
                <td>${pago.nota || '-'}</td>
                <td><button class="btn btn-sm btn-outline-danger" onclick="eliminarPago(${pago.id})">❌</button></td>
            </tr>`;
    });
}

function guardarPago() {
    if (typeof requirePermission === 'function' && !requirePermission('charge')) return;
    const monto = parseFloat(document.getElementById('inputMontoPago').value);
    const nota  = document.getElementById('inputNotaPago').value;
    if (!monto || monto <= 0) return showToast('Ingresa un monto válido', 'warning');
    const pago = { id: Date.now(), monto, nota };
    listadoPagos.push(pago);
    setData('pagos', listadoPagos);
    if (typeof auditLog === 'function') {
        auditLog('payouts.create', pago);
    }
    bootstrap.Modal.getInstance(document.getElementById('modalPagarSocio')).hide();
    document.getElementById('inputMontoPago').value = '';
    cargarDatosVentas();
}

async function eliminarPago(id) {
    if (typeof requirePermission === 'function' && !requirePermission('delete')) return;
    const autorizado = await solicitarPin();
    if (!autorizado) return;
    const pago = listadoPagos.find(p => p.id === id);
    listadoPagos = listadoPagos.filter(p => p.id !== id);
    setData('pagos', listadoPagos);
    if (typeof auditLog === 'function') {
        auditLog('payouts.delete', { id, monto: pago?.monto, nota: pago?.nota });
    }
    cargarDatosVentas();
}

// =========================================================
// calcularTotales
// =========================================================
function calcularTotales() {
    let miGananciaReal  = 0;
    let miGananciaTotal = 0;
    let totalPorCobrar  = 0;

    listadoVentas.forEach(venta => {
        const miParteCompleta = parseFloat(venta.reparto.yo || 0);
        miGananciaTotal += miParteCompleta;
        if (venta.esCredito) {
            const precioTotal       = parseFloat(venta.precioFinal);
            const saldoPendiente    = parseFloat(venta.saldoPendiente || 0);
            const cobrado           = precioTotal - saldoPendiente;
            const porcentajeCobrado = cobrado / precioTotal;
            miGananciaReal += miParteCompleta * porcentajeCobrado;
            totalPorCobrar += saldoPendiente;
        } else {
            miGananciaReal += miParteCompleta;
        }
    });

    let generadoSocio = listadoVentas.reduce((acc, v) => {
        return acc + _calcInversionSocio(v) + parseFloat(v.reparto.socio || 0);
    }, 0);
    let pagadoSocio = listadoPagos.reduce((acc, p) => acc + parseFloat(p.monto || 0), 0);
    let deudaActual = generadoSocio - pagadoSocio;

    const deudaMostrar = deudaActual > 0 ? deudaActual : 0;
    const estaAlDia    = deudaActual <= 0;

    if(document.getElementById('total-mi-ganancia'))
        document.getElementById('total-mi-ganancia').innerText = formatMoney(miGananciaReal);

    const elDeuda = document.getElementById('saldo-pendiente-socio');
    if(elDeuda) elDeuda.innerText = estaAlDia ? '$0.00' : formatMoney(deudaMostrar);

    const elBadge = document.getElementById('badge-socio-al-dia');
    if(elBadge) elBadge.style.display = estaAlDia ? 'inline-block' : 'none';

    if(document.getElementById('modal-deuda-actual'))
        document.getElementById('modal-deuda-actual').innerText = estaAlDia ? '$0.00' : formatMoney(deudaMostrar);
    if(document.getElementById('detalle-pagos'))
        document.getElementById('detalle-pagos').innerText =
            `Generado: ${formatMoney(generadoSocio)} | Pagado: ${formatMoney(pagadoSocio)}`;
    if(document.getElementById('total-ventas-bruto'))
        document.getElementById('total-ventas-bruto').innerText =
            formatMoney(listadoVentas.reduce((s, v) => s + parseFloat(v.precioFinal), 0));
    if(document.getElementById('total-por-cobrar'))
        document.getElementById('total-por-cobrar').innerText = formatMoney(totalPorCobrar);
    if(document.getElementById('ganancia-devengada'))
        document.getElementById('ganancia-devengada').innerText = formatMoney(miGananciaTotal);
}

function setFiltroFecha(tipo, btn) {
    filtroFechaActual = tipo;
    const grupo = btn.parentElement.querySelectorAll('.btn');
    grupo.forEach(b => {
        b.classList.remove('active','btn-primary','text-dark','fw-bold');
        b.classList.add('btn-outline-secondary');
    });
    btn.classList.remove('btn-outline-secondary');
    btn.classList.add('active','btn-primary','text-dark','fw-bold');
    renderVentas();
}

function setFiltroEstado(tipo, btn) {
    filtroEstadoActual = tipo;
    btn.closest('.btn-group').querySelectorAll('.btn').forEach(b => {
        b.classList.remove('active','btn-warning','btn-danger','btn-success','fw-bold');
        b.classList.add('btn-outline-secondary');
    });
    btn.classList.remove('btn-outline-secondary','btn-outline-danger','btn-outline-success');
    btn.classList.add('active','fw-bold');
    renderVentas();
}

function abrirModalAbono(idVenta) {
    const venta = listadoVentas.find(v => v.id === idVenta);
    if(!venta) return;
    document.getElementById('abono-id-venta').value         = idVenta;
    document.getElementById('abono-deuda-actual').innerText = '$' + venta.saldoPendiente.toFixed(2);
    document.getElementById('inputMontoAbono').value        = '';
    new bootstrap.Modal(document.getElementById('modalAbono')).show();
}

function guardarAbono() {
    if (typeof requirePermission === 'function' && !requirePermission('charge')) return;
    const idVenta = parseInt(document.getElementById('abono-id-venta').value);
    const monto   = parseFloat(document.getElementById('inputMontoAbono').value);
    const nota    = document.getElementById('inputNotaAbono').value.trim() || 'Abono parcial';
    if (!monto || monto <= 0) return showToast('Ingresa un monto válido.', 'warning');
    const index = listadoVentas.findIndex(v => v.id === idVenta);
    if (index === -1) return;
    if (monto > listadoVentas[index].saldoPendiente) return showToast('No puedes abonar más de lo que debe.', 'warning');
    listadoVentas[index].saldoPendiente -= monto;
    if (!listadoVentas[index].historialAbonos) listadoVentas[index].historialAbonos = [];
    listadoVentas[index].historialAbonos.push({ fecha: new Date().toLocaleString(), monto, nota });
    setData('ventas', listadoVentas);
    if (typeof auditLog === 'function') {
        auditLog('sales.installment', { ventaId: idVenta, monto, nota });
    }
    bootstrap.Modal.getInstance(document.getElementById('modalAbono')).hide();
    renderVentas();
    calcularTotales(); // FIX: actualizar "por cobrar" inmediatamente tras abonar
}

function marcarPagadoSocio(idVenta) {
    const venta = listadoVentas.find(v => v.id === idVenta);
    if(!venta) return;
    const totalPagar = _calcInversionSocio(venta) + (venta.reparto.socio || 0);
    showConfirm(`¿Confirmar pago de $${totalPagar.toFixed(2)} al socio por "${venta.producto}"?`, () => {
        const index = listadoVentas.findIndex(v => v.id === idVenta);
        listadoVentas[index].pagadoAlSocio  = true;
        listadoVentas[index].fechaPagoSocio = new Date().toLocaleString();
        listadoPagos.push({
            id: Date.now(), monto: totalPagar,
            nota: `Pago por venta: ${venta.producto} (${venta.sku || 'Sin SKU'})`
        });
        setData('ventas', listadoVentas);
        setData('pagos', listadoPagos);
        cargarDatosVentas();
        showToast(`Pago de ${formatMoney(totalPagar)} registrado correctamente`, 'success');
    });
}

async function desmarcarPagadoSocio(idVenta) {
    const autorizado = await solicitarPin();
    if (!autorizado) return;
    const venta = listadoVentas.find(v => v.id === idVenta);
    if(!venta || !venta.pagadoAlSocio) return;
    showConfirm(`¿Desmarcar pago de "${venta.producto}"? Esto eliminará el registro del pago.`, () => {
        const totalPagado = _calcInversionSocio(venta) + (venta.reparto.socio || 0);
        const indexPago = listadoPagos.findIndex(p =>
            p.nota && p.nota.includes(venta.producto) && Math.abs(p.monto - totalPagado) < 0.01);
        if(indexPago !== -1) listadoPagos.splice(indexPago, 1);
        const index = listadoVentas.findIndex(v => v.id === idVenta);
        listadoVentas[index].pagadoAlSocio = false;
        delete listadoVentas[index].fechaPagoSocio;
        setData('ventas', listadoVentas);
        setData('pagos', listadoPagos);
        cargarDatosVentas();
        showToast('Pago desmarcado correctamente', 'warning');
    });
}
