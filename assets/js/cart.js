// --- LÓGICA DEL CARRITO (POS) ---

let carrito = [];

function agregarAlCarrito(index) {
    const productos = JSON.parse(localStorage.getItem(DB_KEY)) || [];
    const prod = productos[index];
    const existe = carrito.find(item => item.id === prod.id);
    if (existe) return alert("⚠️ Ya está en el carrito.");
    
    carrito.push({ ...prod, originalIndex: index });
    actualizarBarraCarrito();
}

function actualizarBarraCarrito() {
    const barra = document.getElementById('barra-carrito');
    const countEl = document.getElementById('cart-count');
    const totalEl = document.getElementById('cart-total');

    if (carrito.length > 0) {
        barra.style.display = 'block';
        countEl.innerText = carrito.length;
        const total = carrito.reduce((sum, item) => sum + parseFloat(item.precioVenta), 0);
        totalEl.innerText = formatMoney(total);
    } else {
        barra.style.display = 'none';
    }
}

function renderizarContenidoCarrito() {
    const lista = document.getElementById('lista-carrito');
    const totalEl = document.getElementById('modal-cart-total');
    lista.innerHTML = '';
    let total = 0;

    carrito.forEach((prod, idx) => {
        total += parseFloat(prod.precioVenta);
        lista.innerHTML += `
            <li class="list-group-item d-flex justify-content-between align-items-center">
                <div class="d-flex align-items-center">
                    <button class="btn btn-sm btn-outline-danger me-3" onclick="quitarDelCarrito(${idx})">×</button>
                    <div><div class="fw-bold">${prod.nombre}</div><small class="text-muted">${prod.marca}</small></div>
                </div>
                <span class="fw-bold">$${prod.precioVenta}</span>
            </li>
        `;
    });
    totalEl.innerText = formatMoney(total);
}

function abrirModalCarrito() {
    renderizarContenidoCarrito();
    const modalEl = document.getElementById('modalCarrito');
    const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
    modal.show();
}

function quitarDelCarrito(carritoIndex) {
    carrito.splice(carritoIndex, 1);
    if (carrito.length === 0) {
        const modalEl = document.getElementById('modalCarrito');
        const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
        modal.hide();
    } else {
        renderizarContenidoCarrito();
    }
    actualizarBarraCarrito();
}

function vaciarCarrito() {
    if(confirm("¿Vaciar el carrito?")) {
        carrito = [];
        actualizarBarraCarrito();
        const modalEl = document.getElementById('modalCarrito');
        const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
        modal.hide();
    }
}

function procesarVentaMasiva() {
    if (carrito.length === 0) return;
    const esCredito = document.getElementById('checkCreditoCarrito').checked;
    const cliente = document.getElementById('inputClienteCarrito').value;

    if (esCredito && !cliente) return alert("⚠️ Falta el nombre del cliente.");
    if (!confirm(`¿Confirmar venta de ${carrito.length} perfumes?`)) return;

    const historialVentas = JSON.parse(localStorage.getItem(SALES_KEY)) || [];
    let productosDB = JSON.parse(localStorage.getItem(DB_KEY)) || [];
    const idsEnCarrito = carrito.map(c => c.id);

    carrito.forEach(item => {
        const costo = item.costo;
        const precio = item.precioVenta;
        const utilidad = precio - costo;
        const productoRealIndex = productosDB.findIndex(p => p.id === item.id);
        let gananciaMia = 0, gananciaSocio = 0;

        if (productoRealIndex !== -1) {
            const prodReal = productosDB[productoRealIndex];
            
            // Si tiene cantidad mayor a 1, restamos
            if (prodReal.cantidad && prodReal.cantidad > 1) {
                prodReal.cantidad -= 1;
                productosDB[productoRealIndex] = prodReal; // Actualizamos en memoria temporal
            } else {
                // Si es 1 o no tiene campo, lo marcamos para borrar
                // (Usamos un truco: le ponemos un flag para filtrar después)
                prodReal._borrar = true;
            }
        }
        // ---------------------------------

        if (item.inversion === 'mio') gananciaMia = utilidad;
        else if (item.inversion === 'socio') gananciaSocio = utilidad;
        else if (item.inversion === 'mitad') { gananciaMia = utilidad/2; gananciaSocio = utilidad/2; }
        else if (item.inversion === 'personalizado') {
            const factor = (item.porcentajeSocio || 0) / 100;
            gananciaSocio = utilidad * factor;
            gananciaMia = utilidad - gananciaSocio;
        }

        const nuevaVenta = {
            id: Date.now() + Math.random(), 
            producto: item.nombre, marca: item.marca, imagen: item.imagen, sku: item.sku,
            costoOriginal: costo, precioFinal: precio, utilidad: utilidad,
            reparto: { yo: gananciaMia, socio: gananciaSocio },
            fecha: new Date().toLocaleString(),
            esCredito: esCredito, cliente: cliente || (item.cliente || 'Mostrador'),
            saldoPendiente: esCredito ? precio : 0, historialAbonos: []
        };
        historialVentas.push(nuevaVenta);
    });

    productosDB = productosDB.filter(p => !p._borrar);
    localStorage.setItem(SALES_KEY, JSON.stringify(historialVentas));
    localStorage.setItem(DB_KEY, JSON.stringify(productosDB));

    const itemsParaTicket = carrito.map(c => ({ producto: c.nombre, precio: c.precioVenta }));
    const totalTicket = carrito.reduce((sum, i) => sum + parseFloat(i.precioVenta), 0);
    
    carrito = []; 
    actualizarBarraCarrito();
    const modalEl = document.getElementById('modalCarrito');
    const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
    modal.hide();

    generarTicket(itemsParaTicket, totalTicket, cliente, esCredito, 0);
}