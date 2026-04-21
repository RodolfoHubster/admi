// --- LÓGICA DEL CARRITO (POS) ---

let carrito = [];

function agregarAlCarrito(index) {
    const productos = (typeof getData === 'function')
        ? (getData('perfumes') || [])
        : (JSON.parse(localStorage.getItem(DB_KEY)) || []);
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

function toggleCreditoCarrito() {
    const esCredito = document.getElementById('checkCreditoCarrito').checked;
    const bloque = document.getElementById('bloque-credito-carrito');
    if(bloque) bloque.style.display = esCredito ? 'block' : 'none';
}

function renderizarContenidoCarrito() {
    const lista = document.getElementById('lista-carrito');
    const totalEl = document.getElementById('modal-cart-total');
    
    if(!lista) return;

    lista.innerHTML = '';
    let total = 0;

    carrito.forEach((prod, idx) => {
        total += parseFloat(prod.precioVenta);

        // ✅ FIX 1: Imagen con fallback si no tiene
        const imgSrc = prod.imagen && prod.imagen.trim() !== ''
            ? prod.imagen
            : 'https://via.placeholder.com/48x48?text=🧴';

        // ✅ FIX 2: Badge cliente SOLO si el destino es 'pedido' (no en stock libre)
        const etiquetaCliente = (prod.destino === 'pedido' && prod.cliente && prod.cliente !== 'Mostrador')
            ? `<span class="badge bg-info text-dark ms-2" style="font-size:0.7rem;">👤 ${prod.cliente}</span>`
            : '';

        lista.innerHTML += `
            <li class="list-group-item bg-dark text-white border-secondary d-flex justify-content-between align-items-center py-2">
                <div class="d-flex align-items-center gap-3">
                    <button class="btn btn-sm btn-outline-danger" onclick="quitarDelCarrito(${idx})">×</button>
                    <img src="${imgSrc}" 
                         alt="${prod.nombre}"
                         style="width:48px; height:48px; object-fit:cover; border-radius:8px; border:1px solid #444;"
                         onerror="this.src='https://via.placeholder.com/48x48?text=🧴'">
                    <div>
                        <div class="fw-bold" style="font-size:0.9rem;">
                            ${prod.nombre}
                            ${etiquetaCliente}
                        </div>
                        <small class="text-muted">${prod.marca}</small>
                    </div>
                </div>
                <span class="fw-bold text-warning">$${parseFloat(prod.precioVenta).toFixed(2)}</span>
            </li>
        `;
    });
    
    if(totalEl) totalEl.innerText = formatMoney(total);
}


function abrirModalCarrito() {
    renderizarContenidoCarrito();

    // =======================================================
    // 🧠 LÓGICA AUTO-CLIENTE PARA EL CARRITO
    // =======================================================
    // IMPORTANTE: Verifica que el ID 'cart-cliente' sea el correcto en tu HTML.
    // Si tu input se llama diferente (ej: 'inputClienteCarrito'), cámbialo aquí abajo.
    const inputCliente = document.getElementById('cart-cliente') || document.getElementById('inputClienteCarrito');
    
    if (inputCliente) {
        // Buscamos si hay ALGÚN producto en el carrito que ya tenga dueño
        // (Priorizamos el primero que encontremos que no sea "Mostrador")
        const itemConDueno = carrito.find(p => 
            p.destino === 'pedido' && 
            p.cliente && p.cliente.trim() !== '' && 
            p.cliente !== 'Mostrador'
        );
        if (itemConDueno) {
            // ¡Bingo! Encontramos un dueño, lo ponemos en el input
            inputCliente.value = itemConDueno.cliente;
            
            // Opcional: Si quieres resaltar que se auto-completó
            inputCliente.classList.add('bg-warning', 'bg-opacity-10'); 
        } else {
            // Si todo es stock libre, dejamos limpio
            inputCliente.value = '';
            inputCliente.classList.remove('bg-warning', 'bg-opacity-10');
        }
    }
    // =======================================================

    const modal = new bootstrap.Modal(document.getElementById('modalCarrito'));
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
    if (carrito.length === 0) return alert("El carrito está vacío.");

    // 1. Capturar datos del Modal Nuevo
    const esCredito = document.getElementById('checkCreditoCarrito').checked;
    const clienteGlobal = document.getElementById('cart-cliente').value.trim().toUpperCase();
    const abonoTotal = parseFloat(document.getElementById('cart-anticipo').value) || 0;
    
    // Validación
    if (esCredito && !clienteGlobal) return alert("❌ Para fiar, necesitas escribir el nombre del Cliente.");
    if (abonoTotal < 0) return alert("❌ El abono no puede ser negativo.");

    // Calcular totales
    let totalVenta = 0;
    carrito.forEach(p => totalVenta += parseFloat(p.precioVenta));
    if (esCredito && abonoTotal > totalVenta) return alert("❌ El abono no puede ser mayor al total de la venta.");

    // Si hay abono, lo repartimos proporcionalmente entre los productos
    // (Matemática para que cuadren los centavos)
    let abonoRestante = abonoTotal;

    const productosDB = (typeof getData === 'function')
        ? (getData('perfumes') || [])
        : (JSON.parse(localStorage.getItem(DB_KEY)) || []);
    const historialVentas = (typeof getData === 'function')
        ? (getData('ventas') || [])
        : (JSON.parse(localStorage.getItem(SALES_KEY)) || []);

    carrito.forEach((item, index) => {
        // Cálculo proporcional del abono por item
        let abonoItem = 0;
        if (esCredito && totalVenta > 0) {
            // Regla de tres: Si el total es 100% y abono es X, ¿cuánto le toca a este item?
            const porcentaje = item.precioVenta / totalVenta;
            abonoItem = abonoTotal * porcentaje;
        }

        const saldoPendienteItem = esCredito ? Math.max(0, item.precioVenta - abonoItem) : 0;

        // Construir venta individual
        const nuevaVenta = {
            id: Date.now() + index, // ID único
            producto: item.nombre,
            marca: item.marca,
            sku: item.sku,
            precioFinal: parseFloat(item.precioVenta),
            costoOriginal: parseFloat(item.costo),
            utilidad: parseFloat(item.precioVenta) - parseFloat(item.costo),
            reparto: { yo: 0, socio: 0 }, // (Simplificado, aquí iría tu lógica de utilidades)
            fecha: new Date().toLocaleString(),
            
            // --- DATOS DE CRÉDITO ---
            esCredito: esCredito,
            cliente: clienteGlobal || item.cliente || 'Mostrador',
            saldoPendiente: saldoPendienteItem,
            historialAbonos: []
        };
        
        // Si hubo abono inicial > 0, lo registramos
        if (esCredito && abonoItem > 0) {
            nuevaVenta.historialAbonos.push({
                fecha: new Date().toLocaleString(),
                monto: abonoItem,
                nota: "Abono Inicial (Venta Masiva)"
            });
        }

        // Calcular utilidades (Tu lógica original)
        if (item.inversion === 'mio') {
            nuevaVenta.reparto.yo = nuevaVenta.utilidad;
        } else if (item.inversion === 'socio') {
            nuevaVenta.reparto.socio = nuevaVenta.utilidad;
        } else if (item.inversion === 'personalizado') {
            // AQUÍ AGREGAMOS LA LÓGICA QUE FALTABA
            const factor = (item.porcentajeSocio || 0) / 100;
            nuevaVenta.reparto.socio = nuevaVenta.utilidad * factor;
            nuevaVenta.reparto.yo = nuevaVenta.utilidad - nuevaVenta.reparto.socio;
        } else { 
            // Default: Mitad y Mitad
            nuevaVenta.reparto.yo = nuevaVenta.utilidad / 2; 
            nuevaVenta.reparto.socio = nuevaVenta.utilidad / 2; 
        }

        historialVentas.push(nuevaVenta);

        // Actualizar Stock (Restar o Borrar)
        const prodIndex = productosDB.findIndex(p => p.id === item.id);
        if (prodIndex !== -1) {
            if (productosDB[prodIndex].cantidad > 1) {
                productosDB[prodIndex].cantidad -= 1;
            } else {
                productosDB[prodIndex]._borrar = true; // Marcado para borrar
            }
        }
    });

    // Limpieza final
    const inventarioActualizado = productosDB.filter(p => !p._borrar);
    
    if (typeof setData === 'function') {
        setData('ventas', historialVentas);
        setData('perfumes', inventarioActualizado);
    } else {
        localStorage.setItem(SALES_KEY, JSON.stringify(historialVentas));
        localStorage.setItem(DB_KEY, JSON.stringify(inventarioActualizado));
    }

    // Resetear todo
    carrito = [];
    actualizarBarraCarrito();
    bootstrap.Modal.getInstance(document.getElementById('modalCarrito')).hide();
    
    // Recargar inventario si estamos ahí
    if (typeof cargarInventario === 'function') cargarInventario();

    alert("✅ Venta Masiva Registrada Correctamente");
}
