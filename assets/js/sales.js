// --- LÓGICA DE VENTAS Y TICKETS ---

function iniciarVenta(index) {
    const productos = JSON.parse(localStorage.getItem(DB_KEY)) || [];
    const prod = productos[index];
    

    document.getElementById('venta-nombre-producto').innerText = prod.nombre;
    document.getElementById('venta-precio-lista').value = `$${prod.precioVenta}`;
    document.getElementById('venta-precio-final').value = prod.precioVenta;
    document.getElementById('venta-index-producto').value = index;
    if(document.getElementById('venta-gastos')) document.getElementById('venta-gastos').value = 0;

    // =======================================================
    // 🧠 LÓGICA DE AUTO-CLIENTE (CORREGIDA)
    // =======================================================
    // Usamos el ID real que vi en tu código: 'venta-cliente'
    const inputCliente = document.getElementById('venta-cliente'); 
    const checkCredito = document.getElementById('checkCredito');

    if (prod.cliente && prod.cliente.trim() !== '' && prod.cliente !== 'Mostrador') {
        // CASO 1: YA TIENE DUEÑO (Ej. Pedido de Juan)
        inputCliente.value = prod.cliente; // Pone "Juan" solo
        
        // (Opcional) Si quieres que se marque como "Crédito" solo, descomenta estas 2 líneas:
        // checkCredito.checked = true;
        // toggleCredito(); 
    } else {
        // CASO 2: ES STOCK LIBRE
        inputCliente.value = ''; // Lo deja vacío para que tú escribas
        
        // Aseguramos que empiece limpio
        if(checkCredito.checked) {
            checkCredito.checked = false;
            toggleCredito();
        }
    }
    // =======================================================

    const modalVenta = new bootstrap.Modal(document.getElementById('modalVenta'));
    modalVenta.show();
}

function confirmarVentaFinal() {
    const index = document.getElementById('venta-index-producto').value;
    const precioFinal = parseFloat(document.getElementById('venta-precio-final').value);
    const gastosExtra = parseFloat(document.getElementById('venta-gastos').value) || 0;
    const esCredito = document.getElementById('checkCredito').checked;
    const anticipo = parseFloat(document.getElementById('venta-anticipo').value) || 0;
    const nombreCliente = document.getElementById('venta-cliente').value.trim().toUpperCase();
    if (!precioFinal || precioFinal <= 0) return alert("El precio no puede ser cero.");
//    if (esCredito && !nombreCliente) return alert("Si es fiado, DEBES poner el nombre del cliente.");

    const productos = JSON.parse(localStorage.getItem(DB_KEY)) || [];
    const producto = productos[index];
    const costo = producto.costo;
    const utilidadTotal = precioFinal - costo - gastosExtra; 

    
    let gananciaMia = 0;
    let gananciaSocio = 0;

    
    if (producto.inversion === 'mio') gananciaMia = utilidadTotal; 
    else if (producto.inversion === 'socio') gananciaSocio = utilidadTotal; 
    else if (producto.inversion === 'mitad') { gananciaMia = utilidadTotal / 2; gananciaSocio = utilidadTotal / 2; }
    else if (producto.inversion === 'personalizado') {
        const factor = (producto.porcentajeSocio || 0) / 100;
        gananciaSocio = utilidadTotal * factor;
        gananciaMia = utilidadTotal - gananciaSocio;
    } else gananciaMia = utilidadTotal; 

    const nuevaVenta = {
        id: Date.now(),
        producto: producto.nombre, marca: producto.marca, imagen: producto.imagen, sku: producto.sku,
        costoOriginal: costo, precioFinal: precioFinal, gastosExtra: gastosExtra, utilidad: utilidadTotal,
        reparto: { yo: gananciaMia, socio: gananciaSocio },
        fecha: new Date().toLocaleString(),
        esCredito: esCredito, cliente: esCredito ? nombreCliente : (producto.cliente || 'Mostrador'),
        saldoPendiente: esCredito ? (precioFinal - anticipo) : 0,
        historialAbonos: []
    };

    if (esCredito && anticipo > 0) {
        nuevaVenta.historialAbonos.push({ fecha: new Date().toLocaleString(), monto: anticipo, nota: "Anticipo Inicial" });
    }

    const historial = JSON.parse(localStorage.getItem(SALES_KEY)) || [];
    historial.push(nuevaVenta);
    localStorage.setItem(SALES_KEY, JSON.stringify(historial));

    if (producto.cantidad && producto.cantidad > 1) {
        // Si hay más de 1, restamos y actualizamos
        producto.cantidad -= 1;
        productos[index] = producto;
        // Opcional: Avisar visualmente
        // alert("Stock actualizado. Quedan: " + producto.cantidad);
    } else {
        // Si es el último (o no tiene cantidad definida), lo borramos del inventario
        productos.splice(index, 1);
    }
    // ----------------------------------

    localStorage.setItem(DB_KEY, JSON.stringify(productos));

    const modalEl = document.getElementById('modalVenta');
    const modal = bootstrap.Modal.getInstance(modalEl);
    modal.hide();
    
    document.getElementById('checkCredito').checked = false;
    toggleCredito(); 
    
    generarTicket([{ producto: producto.nombre, precio: precioFinal }], precioFinal, esCredito ? nombreCliente : (producto.cliente || 'Mostrador'), esCredito, anticipo);
}

function generarTicket(items, total, cliente, esCredito, anticipo) {
    document.getElementById('ticket-fecha').innerText = new Date().toLocaleString();
    document.getElementById('ticket-cliente').innerText = cliente || 'Mostrador';
    
    const estadoEl = document.getElementById('ticket-estado');
    const infoCredito = document.getElementById('ticket-credito-info');
    
    if (esCredito) {
        estadoEl.innerText = "PENDIENTE / CREDITO";
        estadoEl.style.color = "red";
        infoCredito.style.display = 'block';
        document.getElementById('ticket-acuenta').innerText = formatMoney(anticipo);
        document.getElementById('ticket-resta').innerText = formatMoney(total - anticipo);
    } else {
        estadoEl.innerText = "PAGADO";
        estadoEl.style.color = "black";
        infoCredito.style.display = 'none';
    }

    const lista = document.getElementById('ticket-items');
    lista.innerHTML = ''; 
    items.forEach(item => {
        lista.innerHTML += `<div class="ticket-item"><span>1 x ${item.producto}</span><span>$${item.precio}</span></div>`;
    });

    document.getElementById('ticket-total-monto').innerText = formatMoney(total);
    const modal = new bootstrap.Modal(document.getElementById('modalTicket'));
    modal.show();
}

function cerrarTicket() {
    const modalEl = document.getElementById('modalTicket');
    const modal = bootstrap.Modal.getInstance(modalEl);
    modal.hide();
    if(typeof cargarInventario === 'function') cargarInventario();
}

function toggleCredito() {
    const check = document.getElementById('checkCredito');
    const bloque = document.getElementById('bloque-credito');
    if (check && check.checked) bloque.style.display = 'block';
    else {
        bloque.style.display = 'none';
        document.getElementById('venta-cliente').value = '';
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
        texto.innerText = `Resta por cobrar: $${restante.toFixed(2)}`;
        if (restante > 0) texto.className = "form-text text-danger fw-bold mt-1";
        else {
            texto.className = "form-text text-success fw-bold mt-1";
            if(document.getElementById('checkCredito').checked) texto.innerText = "¡Liquidado! (Cobro total)";
        }
    }
}

// ============================================================
// 📊 GESTIÓN DE HISTORIAL DE VENTAS (MIGRADO DE VENTAS.HTML)
// ============================================================

let listadoVentas = [];
let listadoPagos = [];
let filtroFechaActual = 'todos';

// Se llama automáticamente al cargar la página 'ventas.html'
function cargarDatosVentas() {
    // Verificamos si estamos en la pantalla de tabla de ventas
    if(!document.getElementById('sales-table-body')) return;

    listadoVentas = JSON.parse(localStorage.getItem(SALES_KEY)) || [];
    listadoPagos = JSON.parse(localStorage.getItem(PAYOUTS_KEY)) || [];
    renderVentas();
    renderPagos();
    calcularTotales();
}

function renderVentas() {
    const tbody = document.getElementById('sales-table-body');
    if(!tbody) return;
    tbody.innerHTML = '';

    // 1. FILTRADO
    const ventasFiltradas = listadoVentas.filter(v => {
        if (filtroFechaActual === 'todos') return true;
        
        const fechaVenta = new Date(v.id); 
        const hoy = new Date();
        const fechaVentaDia = new Date(fechaVenta).setHours(0,0,0,0);
        const hoyDia = new Date().setHours(0,0,0,0);

        if (filtroFechaActual === 'hoy') return fechaVentaDia === hoyDia;
        if (filtroFechaActual === 'semana') {
            const hace7dias = new Date();
            hace7dias.setDate(hace7dias.getDate() - 7);
            return fechaVenta >= hace7dias;
        }
        if (filtroFechaActual === 'mes') {
            return fechaVenta.getMonth() === hoy.getMonth() && fechaVenta.getFullYear() === hoy.getFullYear();
        }
        return true;
    });

    // 2. ORDENAR (Más reciente primero)
    const ventasDisplay = ventasFiltradas.sort((a, b) => b.id - a.id);

    if (ventasDisplay.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="text-center text-muted p-4">📅 No hay ventas en este periodo.</td></tr>`;
        return;
    }

    ventasDisplay.forEach(venta => {
        // Renderizado del Cliente
        const clienteNombre = venta.cliente ? 
            `<span class="fw-bold text-gold">${venta.cliente}</span>` : 
            `<span class="text-muted fst-italic">Mostrador / Stock</span>`;

        // Lógica de Estado (Deuda)
        let badgeEstado = ''; 
        let botonAbonar = '';
        const pendiente = parseFloat(venta.saldoPendiente || 0);

        if (pendiente > 0) {
            badgeEstado = `<div class="mt-1"><span class="badge bg-danger shadow-sm">DEBE: $${pendiente.toFixed(2)}</span></div>`;
            botonAbonar = `<button class="btn btn-sm btn-success fw-bold" onclick="abrirModalAbono(${venta.id})" title="Registrar Abono">💲</button>`;
        } else if (venta.esCredito) {
            badgeEstado = `<div class="mt-1"><span class="badge bg-success text-dark border border-success">✅ LIQUIDADO</span></div>`;
        }

        const row = `
            <tr>
                <td><small>${venta.fecha}</small></td>
                <td>${clienteNombre}</td>
                <td>
                    <strong>${venta.producto}</strong><br>
                    <small class="text-muted">Venta: $${formatMoney(venta.precioFinal)}</small>
                    ${badgeEstado}
                </td>
                <td class="text-success fw-bold">+$${venta.utilidad.toFixed(2)}</td>
                <td>
                    <span class="badge bg-primary">Yo: $${parseFloat(venta.reparto.yo).toFixed(0)}</span>
                    <span class="badge bg-warning text-dark">Socio: $${parseFloat(venta.reparto.socio).toFixed(0)}</span>
                </td>
                <td>
                    <div class="d-flex gap-1">
                        ${botonAbonar} 
                        <button class="btn btn-sm btn-info text-white" onclick="verDetalle(${venta.id})" title="Ver Ficha">ℹ️</button>
                        <button class="btn btn-sm btn-warning" onclick="abrirEdicion(${venta.id})" title="Editar">✏️</button>
                        <button class="btn btn-sm btn-danger" onclick="deshacerVenta(${venta.id})" title="Devolver Stock">↩️</button>
                    </div>
                </td>
            </tr>
        `;
        tbody.innerHTML += row;
    });
}

// --- EDICIÓN DE VENTAS ---
function abrirEdicion(id) {
    const venta = listadoVentas.find(v => v.id === id);
    if (!venta) return;

    document.getElementById('edit-id-venta').value = venta.id;
    document.getElementById('edit-producto').value = venta.producto;
    document.getElementById('edit-precio').value = venta.precioFinal;
    document.getElementById('edit-utilidad').value = venta.utilidad;
    document.getElementById('edit-cliente').value = venta.cliente || '';

    new bootstrap.Modal(document.getElementById('modalEditarVenta')).show();
}

function guardarEdicionVenta() {
    const id = parseFloat(document.getElementById('edit-id-venta').value);
    const nuevoPrecio = parseFloat(document.getElementById('edit-precio').value);
    const nuevoCliente = document.getElementById('edit-cliente').value.trim().toUpperCase(); // Normalizamos aquí también

    const index = listadoVentas.findIndex(v => v.id === id);
    if (index === -1) return;

    // Recalcular
    const costo = listadoVentas[index].costoOriginal;
    const gastos = listadoVentas[index].gastosExtra || 0;
    const nuevaUtilidad = nuevoPrecio - costo - gastos;

    listadoVentas[index].precioFinal = nuevoPrecio;
    listadoVentas[index].utilidad = nuevaUtilidad;
    listadoVentas[index].cliente = nuevoCliente;

    // Recalcular Reparto (Simplificado 50/50 si ambos tenían ganancia)
    if (listadoVentas[index].reparto.socio > 0 && listadoVentas[index].reparto.yo > 0) {
        listadoVentas[index].reparto.socio = nuevaUtilidad / 2;
        listadoVentas[index].reparto.yo = nuevaUtilidad / 2;
    } else if (listadoVentas[index].reparto.socio > 0) {
        listadoVentas[index].reparto.socio = nuevaUtilidad;
    } else {
        listadoVentas[index].reparto.yo = nuevaUtilidad;
    }

    localStorage.setItem(SALES_KEY, JSON.stringify(listadoVentas));
    
    bootstrap.Modal.getInstance(document.getElementById('modalEditarVenta')).hide();
    cargarDatosVentas();
}

// --- DESHACER VENTA (Devolución) ---
function deshacerVenta(id) {
    const venta = listadoVentas.find(v => v.id === id);
    if (!venta) return;

    // 1. Seguridad Financiera
    let generadoSocioTotal = listadoVentas.reduce((acc, v) => acc + parseFloat(v.reparto.socio || 0), 0);
    let pagadoSocioTotal = listadoPagos.reduce((acc, p) => acc + parseFloat(p.monto || 0), 0);
    let deudaGlobalActual = generadoSocioTotal - pagadoSocioTotal;

    if (venta.reparto.socio > 0 && venta.reparto.socio > deudaGlobalActual) {
        alert(`⛔ NO SE PUEDE DESHACER.\n\nEsta venta generó $${venta.reparto.socio} para el socio, pero tú deuda actual es solo de $${deudaGlobalActual}.\n\nSignifica que YA LE PAGASTE. Elimina primero el pago.`);
        return;
    }

    if(!solicitarPin()) return;

    if(confirm(`⚠️ ¿Devolver "${venta.producto}" al Inventario?\nSe borrará la venta y el dinero.`)) {
        // A. Recuperar al Inventario
        const inventario = JSON.parse(localStorage.getItem(DB_KEY)) || [];
        
        const productoRecuperado = {
            id: Date.now(),
            nombre: venta.producto,
            marca: venta.marca || "Recuperado",
            sku: venta.sku,
            costo: venta.costoOriginal,
            precioVenta: venta.precioFinal,
            inversion: (venta.reparto.socio > 0 && venta.reparto.yo > 0) ? 'mitad' : (venta.reparto.socio > 0 ? 'socio' : 'mio'),
            destino: (venta.cliente && venta.cliente !== 'Mostrador') ? 'pedido' : 'stock',
            cliente: (venta.cliente && venta.cliente !== 'Mostrador') ? venta.cliente : '',
            ubicacion: 'en_inventario',
            imagen: venta.imagen || 'https://cdn-icons-png.flaticon.com/512/2636/2636280.png',
            cantidad: 1,
            fechaRegistro: new Date().toISOString()
        };

        inventario.push(productoRecuperado);
        localStorage.setItem(DB_KEY, JSON.stringify(inventario));

        // B. Borrar Venta
        listadoVentas = listadoVentas.filter(v => v.id !== id);
        localStorage.setItem(SALES_KEY, JSON.stringify(listadoVentas));

        cargarDatosVentas();
        alert("✅ Venta deshecha. Producto devuelto.");
    }
}

// --- VISUALIZAR DETALLE ---
function verDetalle(id) {
    const venta = listadoVentas.find(v => v.id === id);
    if(!venta) return;
    document.getElementById('det-producto').innerText = venta.producto;
    document.getElementById('det-sku').innerText = venta.sku || 'Sin SKU';
    document.getElementById('det-fecha').innerText = venta.fecha;
    document.getElementById('det-cliente').innerText = venta.cliente || 'Venta de Stock';
    document.getElementById('det-costo').innerText = formatMoney(venta.costoOriginal);
    document.getElementById('det-precio').innerText = formatMoney(venta.precioFinal);
    document.getElementById('det-utilidad').innerText = formatMoney(venta.utilidad);
    document.getElementById('det-yo').innerText = formatMoney(venta.reparto.yo);
    document.getElementById('det-socio').innerText = formatMoney(venta.reparto.socio);
    
    new bootstrap.Modal(document.getElementById('modalDetalleVenta')).show();
}

// --- PAGOS AL SOCIO ---
function renderPagos() {
    const tbody = document.getElementById('pagos-table-body');
    const msg = document.getElementById('no-pagos-msg');
    if(!tbody) return;
    
    tbody.innerHTML = '';
    if (listadoPagos.length === 0) {
        if(msg) msg.style.display = 'block';
        return;
    }
    if(msg) msg.style.display = 'none';

    const pagosDisplay = [...listadoPagos].sort((a, b) => b.id - a.id);
    pagosDisplay.forEach(pago => {
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
    const monto = parseFloat(document.getElementById('inputMontoPago').value);
    const nota = document.getElementById('inputNotaPago').value;
    if (!monto || monto <= 0) return alert("Ingresa un monto válido");

    const nuevoPago = { id: Date.now(), monto: monto, nota: nota };
    listadoPagos.push(nuevoPago);
    localStorage.setItem(PAYOUTS_KEY, JSON.stringify(listadoPagos));

    bootstrap.Modal.getInstance(document.getElementById('modalPagarSocio')).hide();
    document.getElementById('inputMontoPago').value = '';
    cargarDatosVentas();
    alert("✅ Pago registrado.");
}

function eliminarPago(id) {
    if(!solicitarPin()) return;
    listadoPagos = listadoPagos.filter(p => p.id !== id);
    localStorage.setItem(PAYOUTS_KEY, JSON.stringify(listadoPagos));
    cargarDatosVentas();
}

function calcularTotales() {
    let generadoSocio = listadoVentas.reduce((acc, v) => acc + parseFloat(v.reparto.socio || 0), 0);
    let pagadoSocio = listadoPagos.reduce((acc, p) => acc + parseFloat(p.monto || 0), 0);
    let deudaActual = generadoSocio - pagadoSocio;
    let miGanancia = listadoVentas.reduce((acc, v) => acc + parseFloat(v.reparto.yo || 0), 0);

    if(document.getElementById('total-mi-ganancia')) 
        document.getElementById('total-mi-ganancia').innerText = formatMoney(miGanancia);
    
    if(document.getElementById('saldo-pendiente-socio'))
        document.getElementById('saldo-pendiente-socio').innerText = formatMoney(deudaActual);
    
    if(document.getElementById('modal-deuda-actual'))
        document.getElementById('modal-deuda-actual').innerText = formatMoney(deudaActual);
    
    if(document.getElementById('detalle-pagos'))
        document.getElementById('detalle-pagos').innerText = `Generado: ${formatMoney(generadoSocio)} | Pagado: ${formatMoney(pagadoSocio)}`;
}

// --- FILTROS DE FECHA ---
function setFiltroFecha(tipo, btn) {
    filtroFechaActual = tipo;
    const grupo = btn.parentElement.querySelectorAll('.btn');
    grupo.forEach(b => {
        b.classList.remove('active', 'btn-primary', 'text-dark', 'fw-bold');
        b.classList.add('btn-outline-secondary');
    });
    btn.classList.remove('btn-outline-secondary');
    btn.classList.add('active', 'btn-primary', 'text-dark', 'fw-bold');
    renderVentas();
}

// --- ABONOS ---
function abrirModalAbono(idVenta) {
    const venta = listadoVentas.find(v => v.id === idVenta);
    if(!venta) return;
    document.getElementById('abono-id-venta').value = idVenta;
    document.getElementById('abono-deuda-actual').innerText = '$' + venta.saldoPendiente.toFixed(2);
    document.getElementById('inputMontoAbono').value = '';
    new bootstrap.Modal(document.getElementById('modalAbono')).show();
}

function guardarAbono() {
    const idVenta = parseInt(document.getElementById('abono-id-venta').value);
    const monto = parseFloat(document.getElementById('inputMontoAbono').value);
    const nota = document.getElementById('inputNotaAbono').value.trim() || 'Abono parcial';

    if (!monto || monto <= 0) return alert("❌ Ingresa un monto válido.");

    const index = listadoVentas.findIndex(v => v.id === idVenta);
    if (index === -1) return;

    if (monto > listadoVentas[index].saldoPendiente) return alert("❌ No puedes abonar más de lo que debe.");

    listadoVentas[index].saldoPendiente -= monto;
    if (!listadoVentas[index].historialAbonos) listadoVentas[index].historialAbonos = [];
    
    listadoVentas[index].historialAbonos.push({
        fecha: new Date().toLocaleString(),
        monto: monto,
        nota: nota
    });

    localStorage.setItem(SALES_KEY, JSON.stringify(listadoVentas));
    alert(`✅ Abono de $${monto} registrado.`);
    bootstrap.Modal.getInstance(document.getElementById('modalAbono')).hide();
    renderVentas();
}