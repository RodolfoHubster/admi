// --- LÓGICA DE VENTAS Y TICKETS ---

function iniciarVenta(index) {
    const productos = JSON.parse(localStorage.getItem(DB_KEY)) || [];
    const prod = productos[index];

    document.getElementById('venta-nombre-producto').innerText = prod.nombre;
    document.getElementById('venta-precio-lista').value = `$${prod.precioVenta}`;
    document.getElementById('venta-precio-final').value = prod.precioVenta;
    document.getElementById('venta-index-producto').value = index;
    if(document.getElementById('venta-gastos')) document.getElementById('venta-gastos').value = 0;

    const modalVenta = new bootstrap.Modal(document.getElementById('modalVenta'));
    modalVenta.show();
}

function confirmarVentaFinal() {
    const index = document.getElementById('venta-index-producto').value;
    const precioFinal = parseFloat(document.getElementById('venta-precio-final').value);
    const gastosExtra = parseFloat(document.getElementById('venta-gastos').value) || 0;
    const esCredito = document.getElementById('checkCredito').checked;
    const nombreCliente = document.getElementById('venta-cliente').value;
    const anticipo = parseFloat(document.getElementById('venta-anticipo').value) || 0;

    if (!precioFinal || precioFinal <= 0) return alert("El precio no puede ser cero.");
    if (esCredito && !nombreCliente) return alert("Si es fiado, DEBES poner el nombre del cliente.");

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

    productos.splice(index, 1);
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