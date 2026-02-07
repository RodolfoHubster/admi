// =========================================================
// 1. VARIABLES GLOBALES
// =========================================================
let listadoVentas = [];
let listadoPagos = [];
let filtroFechaActual = 'todos';

// =========================================================
// 2. FUNCIONES DE VENTA (CREAR)
// =========================================================

function iniciarVenta(index) {
    const productos = JSON.parse(localStorage.getItem(DB_KEY)) || [];
    const prod = productos[index];

    // Llenar Modal
    document.getElementById('venta-nombre-producto').innerText = prod.nombre;
    document.getElementById('venta-precio-lista').value = `$${prod.precioVenta}`;
    document.getElementById('venta-precio-final').value = prod.precioVenta;
    document.getElementById('venta-index-producto').value = index;
    if(document.getElementById('venta-gastos')) document.getElementById('venta-gastos').value = 0;

    // Cliente Automático
    const inputCliente = document.getElementById('venta-cliente'); 
    const checkCredito = document.getElementById('checkCredito');

    if (prod.cliente && prod.cliente.trim() !== '' && prod.cliente !== 'Mostrador') {
        inputCliente.value = prod.cliente; 
        inputCliente.dataset.duenoOriginal = prod.cliente; 
    } else {
        inputCliente.value = ''; 
        inputCliente.dataset.duenoOriginal = '';
        if(checkCredito.checked) {
            checkCredito.checked = false;
            toggleCredito();
        }
    }

    new bootstrap.Modal(document.getElementById('modalVenta')).show();
}

function confirmarVentaFinal() {
    const index = document.getElementById('venta-index-producto').value;
    const precioFinal = parseFloat(document.getElementById('venta-precio-final').value);
    const gastosExtra = parseFloat(document.getElementById('venta-gastos').value) || 0;
    const esCredito = document.getElementById('checkCredito').checked;
    const anticipo = parseFloat(document.getElementById('venta-anticipo').value) || 0;
    const nombreCliente = document.getElementById('venta-cliente').value.trim().toUpperCase();
    
    if (!precioFinal || precioFinal <= 0) return alert("El precio no puede ser cero.");

    const productos = JSON.parse(localStorage.getItem(DB_KEY)) || [];
    const producto = productos[index];
    const costo = producto.costo;
    const utilidadTotal = precioFinal - costo - gastosExtra; 

    // --- LÓGICA MATEMÁTICA DE CREACIÓN ---
    let gananciaMia = 0;
    let gananciaSocio = 0;
    let pctSocio = 0; 

    if (producto.inversion === 'mio') {
        gananciaMia = utilidadTotal;
    } else if (producto.inversion === 'socio') {
        gananciaSocio = utilidadTotal;
    } else if (producto.inversion === 'mitad') { 
        // Lógica 50/50 (Total * .50)
        gananciaSocio = utilidadTotal * 0.50;
        gananciaMia = utilidadTotal * 0.50;
    } else if (producto.inversion === 'personalizado') {
        // Lógica Personalizada (Total * .Porcentaje)
        pctSocio = producto.porcentajeSocio || 0;
        const decimal = pctSocio / 100; // Ejemplo: 30 / 100 = 0.30
        gananciaSocio = utilidadTotal * decimal;
        gananciaMia = utilidadTotal - gananciaSocio;
    } else {
        gananciaMia = utilidadTotal;
    }

    const nuevaVenta = {
        id: Date.now(),
        producto: producto.nombre, marca: producto.marca, imagen: producto.imagen, sku: producto.sku,
        costoOriginal: costo, precioFinal: precioFinal, gastosExtra: gastosExtra, utilidad: utilidadTotal,
        reparto: { yo: gananciaMia, socio: gananciaSocio },
        reglasReparto: {
            tipo: producto.inversion,
            pctSocio: pctSocio
        },
        fecha: new Date().toLocaleString(),
        esCredito: esCredito, cliente: esCredito ? nombreCliente : (producto.cliente || 'Mostrador'),
        saldoPendiente: esCredito ? (precioFinal - anticipo) : 0,
        historialAbonos: []
    };

    if (esCredito && anticipo > 0) {
        nuevaVenta.historialAbonos.push({ fecha: new Date().toLocaleString(), monto: anticipo, nota: "Anticipo Inicial" });
    }

    // Guardar
    const historial = JSON.parse(localStorage.getItem(SALES_KEY)) || [];
    historial.push(nuevaVenta);
    localStorage.setItem(SALES_KEY, JSON.stringify(historial));

    // Actualizar Stock
    if (producto.cantidad && producto.cantidad > 1) {
        producto.cantidad -= 1;
        productos[index] = producto;
    } else {
        productos.splice(index, 1);
    }
    localStorage.setItem(DB_KEY, JSON.stringify(productos));

    // UI
    bootstrap.Modal.getInstance(document.getElementById('modalVenta')).hide();
    document.getElementById('checkCredito').checked = false;
    toggleCredito(); 
    generarTicket([{ producto: producto.nombre, precio: precioFinal }], precioFinal, esCredito ? nombreCliente : (producto.cliente || 'Mostrador'), esCredito, anticipo);
}

// =========================================================
// 3. FUNCIONES DE EDICIÓN (AQUÍ ESTÁ LA CORRECCIÓN)
// =========================================================

function toggleEditPersonalizado() {
    const sel = document.getElementById('edit-inversion');
    const div = document.getElementById('div-edit-pct');
    if(sel && div) {
        div.style.display = (sel.value === 'personalizado') ? 'block' : 'none';
    }
}

function abrirEdicion(id) {
    const venta = listadoVentas.find(v => v.id === id);
    if (!venta) return;

    // Llenar datos básicos
    document.getElementById('edit-id-venta').value = venta.id;
    document.getElementById('edit-producto').value = venta.producto;
    document.getElementById('edit-precio').value = venta.precioFinal;
    document.getElementById('edit-utilidad').value = venta.utilidad;
    document.getElementById('edit-cliente').value = venta.cliente || '';

    // --- RECUPERAR DATOS GUARDADOS ---
    let tipoDetectado = 'mio';
    let pctDetectado = 0;

    // 1. Intentamos leer la regla guardada (LA FORMA SEGURA)
    if (venta.reglasReparto && venta.reglasReparto.tipo) {
        tipoDetectado = venta.reglasReparto.tipo;
        pctDetectado = venta.reglasReparto.pctSocio || 0;
    } 
    // 2. Si es una venta vieja sin reglas, adivinamos
    else {
        if (venta.reparto.socio > 0 && venta.reparto.yo > 0) {
            const pctMatematico = (venta.reparto.socio / venta.utilidad) * 100;
            // Si está cerca del 50%, es mitad
            if (Math.abs(pctMatematico - 50) < 1) tipoDetectado = 'mitad';
            else {
                tipoDetectado = 'personalizado';
                pctDetectado = Math.round(pctMatematico);
            }
        } else if (venta.reparto.socio > 0) tipoDetectado = 'socio';
        else tipoDetectado = 'mio';
    }

    const selInv = document.getElementById('edit-inversion');
    const inpPct = document.getElementById('edit-porcentaje');
    
    // Asignar valores al HTML
    if(selInv) selInv.value = tipoDetectado;
    if(inpPct) inpPct.value = pctDetectado; // AQUÍ SE PONE EL 30 QUE SE BORRABA
    
    toggleEditPersonalizado(); 
    new bootstrap.Modal(document.getElementById('modalEditarVenta')).show();
}

function guardarEdicionVenta() {
    const id = parseFloat(document.getElementById('edit-id-venta').value);
    const nuevoPrecio = parseFloat(document.getElementById('edit-precio').value);
    const nuevoCliente = document.getElementById('edit-cliente').value.trim().toUpperCase();
    
    const selectInversion = document.getElementById('edit-inversion');
    const inputPorcentaje = document.getElementById('edit-porcentaje');

    if (!selectInversion) return alert("⚠️ ERROR: No encuentro los campos en el HTML. Verifica ventas.html");

    const nuevoTipo = selectInversion.value;
    // Leemos el porcentaje (Ej: 30)
    const nuevoPct = parseFloat(inputPorcentaje.value) || 0;

    const index = listadoVentas.findIndex(v => v.id === id);
    if (index === -1) return;

    // Recálculo de Utilidad Total
    const costo = listadoVentas[index].costoOriginal;
    const gastos = listadoVentas[index].gastosExtra || 0;
    const nuevaUtilidad = nuevoPrecio - costo - gastos;

    // --- AQUÍ ESTÁ LA MATEMÁTICA QUE PEDISTE ---
    let nuevaGananciaSocio = 0;
    let nuevaGananciaYo = 0;

    if (nuevoTipo === 'mio') {
        nuevaGananciaYo = nuevaUtilidad;
    } else if (nuevoTipo === 'socio') {
        nuevaGananciaSocio = nuevaUtilidad;
    } else if (nuevoTipo === 'mitad') {
        // Implementación 50/50: Total * 0.50
        nuevaGananciaSocio = nuevaUtilidad * 0.50;
        nuevaGananciaYo = nuevaUtilidad * 0.50;
    } else if (nuevoTipo === 'personalizado') {
        // Implementación: Total * .(Porcentaje)
        // Si nuevoPct es 30, decimal es 0.30
        const decimal = nuevoPct / 100; 
        nuevaGananciaSocio = nuevaUtilidad * decimal;
        
        // El resto es para mí
        nuevaGananciaYo = nuevaUtilidad - nuevaGananciaSocio;
    }

    // Guardar Dinero
    listadoVentas[index].precioFinal = nuevoPrecio;
    listadoVentas[index].utilidad = nuevaUtilidad;
    listadoVentas[index].cliente = nuevoCliente;
    listadoVentas[index].reparto.socio = nuevaGananciaSocio;
    listadoVentas[index].reparto.yo = nuevaGananciaYo;
    
    // GUARDAR LA REGLA (IMPORTANTE PARA QUE NO SE BORRE EL %)
    listadoVentas[index].reglasReparto = { 
        tipo: nuevoTipo, 
        pctSocio: nuevoPct 
    };

    localStorage.setItem(SALES_KEY, JSON.stringify(listadoVentas));
    
    bootstrap.Modal.getInstance(document.getElementById('modalEditarVenta')).hide();
    
    setTimeout(() => {
        cargarDatosVentas();
    }, 100);
}

// =========================================================
// 4. FUNCIONES AUXILIARES
// =========================================================

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
        if (dueno) {
            inputCliente.value = dueno;
            inputCliente.classList.add('bg-warning', 'bg-opacity-10'); 
        }
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
        texto.innerText = `Resta por cobrar: $${restante.toFixed(2)}`;
        texto.className = restante > 0 ? "form-text text-danger fw-bold mt-1" : "form-text text-success fw-bold mt-1";
        if(restante <= 0 && document.getElementById('checkCredito').checked) texto.innerText = "¡Liquidado! (Cobro total)";
    }
}

function cargarDatosVentas() {
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

    // Filtros de Fecha (Igual que antes)
    const ventasFiltradas = listadoVentas.filter(v => {
        if (filtroFechaActual === 'todos') return true;
        const fechaVenta = new Date(v.id).setHours(0,0,0,0);
        const hoy = new Date().setHours(0,0,0,0);
        if (filtroFechaActual === 'hoy') return fechaVenta === hoy;
        if (filtroFechaActual === 'semana') {
            const hace7 = new Date(); hace7.setDate(hace7.getDate() - 7);
            return new Date(v.id) >= hace7;
        }
        if (filtroFechaActual === 'mes') {
            const d = new Date(v.id);
            const now = new Date();
            return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
        }
        return true;
    });

    const ventasDisplay = ventasFiltradas.sort((a, b) => b.id - a.id);

    if (ventasDisplay.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" class="text-center text-muted p-4">📅 No hay ventas en este periodo.</td></tr>`;
        return;
    }

    ventasDisplay.forEach(venta => {
        // --- 🧠 CÁLCULO DE RECUPERACIÓN DE INVERSIÓN ---
        let inversionSocio = 0;
        let tipo = 'mio';
        let pct = 0;

        // 1. Detectamos el trato
        if (venta.reglasReparto) {
            tipo = venta.reglasReparto.tipo;
            pct = venta.reglasReparto.pctSocio;
        } else if (venta.reparto.socio > 0 && venta.reparto.yo > 0) {
            tipo = 'mitad'; // Adivinanza para ventas viejas
        } else if (venta.reparto.socio > 0) tipo = 'socio';

        // 2. Calculamos cuánto puso él originalmente
        const costo = venta.costoOriginal || 0;
        
        if (tipo === 'mitad') inversionSocio = costo * 0.50;
        else if (tipo === 'socio') inversionSocio = costo;
        else if (tipo === 'personalizado') inversionSocio = costo * (pct / 100);
        else inversionSocio = 0;

        // 3. Total Final: Su Inversión + Su Ganancia
        const totalPagarSocio = inversionSocio + (venta.reparto.socio || 0);
        // -------------------------------------------------------

        const clienteNombre = venta.cliente ? 
            `<span class="fw-bold text-gold">${venta.cliente}</span>` : 
            `<span class="text-muted fst-italic">Mostrador / Stock</span>`;

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
                    <div class="d-flex flex-column" style="font-size: 0.85rem;">
                        <span class="text-primary">Yo: $${parseFloat(venta.reparto.yo).toFixed(0)}</span>
                        <span class="text-warning text-dark">Soc: $${parseFloat(venta.reparto.socio).toFixed(0)}</span>
                    </div>
                </td>
                <td class="bg-warning bg-opacity-10 border-start border-warning">
                    <strong class="text-dark fs-6">$${totalPagarSocio.toFixed(2)}</strong>
                    <br><small class="text-muted" style="font-size:10px;">(Inv: $${inversionSocio.toFixed(0)} + Gan: $${parseFloat(venta.reparto.socio).toFixed(0)})</small>
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

function deshacerVenta(id) {
    const venta = listadoVentas.find(v => v.id === id);
    if (!venta) return;

    let generadoSocioTotal = listadoVentas.reduce((acc, v) => acc + parseFloat(v.reparto.socio || 0), 0);
    let pagadoSocioTotal = listadoPagos.reduce((acc, p) => acc + parseFloat(p.monto || 0), 0);
    let deudaGlobalActual = generadoSocioTotal - pagadoSocioTotal;

    if (venta.reparto.socio > 0 && venta.reparto.socio > deudaGlobalActual) {
        alert(`⛔ NO SE PUEDE DESHACER.\n\nEsta venta generó $${venta.reparto.socio} para el socio, pero tú deuda actual es solo de $${deudaGlobalActual}.\n\nSignifica que YA LE PAGASTE. Elimina primero el pago.`);
        return;
    }

    if(!solicitarPin()) return;

    if(confirm(`⚠️ ¿Devolver "${venta.producto}" al Inventario?`)) {
        const inventario = JSON.parse(localStorage.getItem(DB_KEY)) || [];
        
        const productoRecuperado = {
            id: Date.now(),
            nombre: venta.producto,
            marca: venta.marca || "Recuperado",
            sku: venta.sku,
            costo: venta.costoOriginal,
            precioVenta: venta.precioFinal,
            inversion: (venta.reglasReparto ? venta.reglasReparto.tipo : 'mitad'), 
            porcentajeSocio: (venta.reglasReparto ? venta.reglasReparto.pctSocio : 0),
            destino: (venta.cliente && venta.cliente !== 'Mostrador') ? 'pedido' : 'stock',
            cliente: (venta.cliente && venta.cliente !== 'Mostrador') ? venta.cliente : '',
            ubicacion: 'en_inventario',
            imagen: venta.imagen || 'https://cdn-icons-png.flaticon.com/512/2636/2636280.png',
            cantidad: 1,
            fechaRegistro: new Date().toISOString()
        };

        inventario.push(productoRecuperado);
        localStorage.setItem(DB_KEY, JSON.stringify(inventario));

        listadoVentas = listadoVentas.filter(v => v.id !== id);
        localStorage.setItem(SALES_KEY, JSON.stringify(listadoVentas));

        cargarDatosVentas();
        alert("✅ Venta deshecha. Producto devuelto.");
    }
}

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
    const monto = parseFloat(document.getElementById('inputMontoPago').value);
    const nota = document.getElementById('inputNotaPago').value;
    if (!monto || monto <= 0) return alert("Ingresa un monto válido");

    listadoPagos.push({ id: Date.now(), monto: monto, nota: nota });
    localStorage.setItem(PAYOUTS_KEY, JSON.stringify(listadoPagos));

    bootstrap.Modal.getInstance(document.getElementById('modalPagarSocio')).hide();
    document.getElementById('inputMontoPago').value = '';
    cargarDatosVentas();
}

function eliminarPago(id) {
    if(!solicitarPin()) return;
    listadoPagos = listadoPagos.filter(p => p.id !== id);
    localStorage.setItem(PAYOUTS_KEY, JSON.stringify(listadoPagos));
    cargarDatosVentas();
}

function calcularTotales() {
    // 1. Calcular ganancia REAL (solo lo cobrado)
    let miGananciaReal = 0;
    let miGananciaTotal = 0;  // Para mostrar el total devengado
    let totalPorCobrar = 0;
    
    listadoVentas.forEach(venta => {
        const miParteCompleta = parseFloat(venta.reparto.yo || 0);
        miGananciaTotal += miParteCompleta;  // Total sin importar si cobró
        
        if (venta.esCredito) {
            // Calcular cuánto ha cobrado del precio total
            const precioTotal = parseFloat(venta.precioFinal);
            const saldoPendiente = parseFloat(venta.saldoPendiente || 0);
            const cobrado = precioTotal - saldoPendiente;
            
            // Calcular ganancia proporcional a lo cobrado
            const porcentajeCobrado = cobrado / precioTotal;
            const gananciaCobrada = miParteCompleta * porcentajeCobrado;
            
            miGananciaReal += gananciaCobrada;
            totalPorCobrar += saldoPendiente;
        } else {
            // Venta de contado = 100% cobrada
            miGananciaReal += miParteCompleta;
        }
    });

    // 2. Cálculos del socio
    let generadoSocio = listadoVentas.reduce((acc, v) => acc + parseFloat(v.reparto.socio || 0), 0);
    let pagadoSocio = listadoPagos.reduce((acc, p) => acc + parseFloat(p.monto || 0), 0);
    let deudaActual = generadoSocio - pagadoSocio;

    // 3. Actualizar en pantalla
    if(document.getElementById('total-mi-ganancia')) {
        document.getElementById('total-mi-ganancia').innerText = formatMoney(miGananciaReal);
    }
    if(document.getElementById('saldo-pendiente-socio')) {
        document.getElementById('saldo-pendiente-socio').innerText = formatMoney(deudaActual);
    }
    if(document.getElementById('modal-deuda-actual')) {
        document.getElementById('modal-deuda-actual').innerText = formatMoney(deudaActual);
    }
    if(document.getElementById('detalle-pagos')) {
        document.getElementById('detalle-pagos').innerText = `Generado: ${formatMoney(generadoSocio)} | Pagado: ${formatMoney(pagadoSocio)}`;
    }
    
    // 4. Nuevos KPIs (si existen en el HTML)
    if(document.getElementById('total-ventas-bruto')) {
        const totalVentas = listadoVentas.reduce((sum, v) => sum + parseFloat(v.precioFinal), 0);
        document.getElementById('total-ventas-bruto').innerText = formatMoney(totalVentas);
    }
    if(document.getElementById('total-por-cobrar')) {
        document.getElementById('total-por-cobrar').innerText = formatMoney(totalPorCobrar);
    }
    if(document.getElementById('ganancia-devengada')) {
        document.getElementById('ganancia-devengada').innerText = formatMoney(miGananciaTotal);
    }
}


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
    
    listadoVentas[index].historialAbonos.push({ fecha: new Date().toLocaleString(), monto: monto, nota: nota });

    localStorage.setItem(SALES_KEY, JSON.stringify(listadoVentas));
    bootstrap.Modal.getInstance(document.getElementById('modalAbono')).hide();
    renderVentas();
}