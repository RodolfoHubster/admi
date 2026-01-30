// --- INVENTARIO (VERSIÓN DARK LUXURY) ---

function cargarInventario() {
    const tableBody = document.getElementById('inventory-table-body');
    const emptyMsg = document.getElementById('empty-msg');
    const contadorLabel = document.getElementById('contador-visible');
    
    if (!tableBody) return;

    const productos = JSON.parse(localStorage.getItem(DB_KEY)) || [];
    tableBody.innerHTML = '';

    // 1. FILTRAR
    const filtroProp = document.getElementById('filtroPropiedad') ? document.getElementById('filtroPropiedad').value : 'todos';
    const filtroDest = document.getElementById('filtroDestino') ? document.getElementById('filtroDestino').value : 'todos';
    const busqueda = document.getElementById('buscador') ? document.getElementById('buscador').value.toLowerCase() : '';

    let filtrados = productos.filter(p => {
        const textoMatch = p.nombre.toLowerCase().includes(busqueda) || 
                           p.marca.toLowerCase().includes(busqueda) || 
                           p.sku.toLowerCase().includes(busqueda);
        
        let propMatch = (filtroProp === 'todos') ? true : (p.inversion === filtroProp);
        
        let destMatch = true;
        if (filtroDest === 'stock') destMatch = (p.destino === 'stock' && p.ubicacion !== 'en_camino');
        else if (filtroDest === 'pedido') destMatch = (p.destino === 'pedido');
        else if (filtroDest === 'en_camino') destMatch = (p.ubicacion === 'en_camino');

        return textoMatch && propMatch && destMatch;
    });

    if (contadorLabel) contadorLabel.innerText = filtrados.length;
    if (emptyMsg) emptyMsg.style.display = (filtrados.length === 0) ? 'block' : 'none';

    // 2. AGRUPAR
    const grupos = {};
    filtrados.forEach((prod) => {
        const realIndex = productos.findIndex(p => p.id === prod.id); 
        prod.originalIndex = realIndex; 
        const nombreLimpio = prod.nombre.trim(); 
        if (!grupos[nombreLimpio]) grupos[nombreLimpio] = [];
        grupos[nombreLimpio].push(prod);
    });

    // 3. ORDENAR
    let listaGrupos = Object.keys(grupos).map(nombre => {
        return {
            nombre: nombre, items: grupos[nombre], principal: grupos[nombre][0],
            totalStock: grupos[nombre].length,
            precioRef: grupos[nombre][0].precioVenta,
            gananciaRef: grupos[nombre][0].precioVenta - grupos[nombre][0].costo
        };
    });

    listaGrupos.sort((a, b) => {
        let valA, valB;
        if (ordenActual.campo === 'nombre') { valA = a.nombre.toLowerCase(); valB = b.nombre.toLowerCase(); } 
        else if (ordenActual.campo === 'precio') { valA = a.precioRef; valB = b.precioRef; } 
        else if (ordenActual.campo === 'ganancia') { valA = a.gananciaRef; valB = b.gananciaRef; }

        if (valA < valB) return ordenActual.dir === 'asc' ? -1 : 1;
        if (valA > valB) return ordenActual.dir === 'asc' ? 1 : -1;
        return 0;
    });

    // 4. RENDERIZAR
    listaGrupos.forEach(grupo => {
        const items = grupo.items; 
        const principal = grupo.principal;   

        if (items.length === 1) {
            tableBody.innerHTML += renderFila(items[0], items[0].originalIndex);
        } else {
            // GRUPO (LOTE)
            const accordionId = `grupo-${grupo.nombre.replace(/[^a-zA-Z0-9]/g, '-')}-${Date.now()}`; 
            const imgUrl = principal.imagen || 'https://cdn-icons-png.flaticon.com/512/2636/2636280.png';
            const ganancia = principal.precioVenta - principal.costo;

            const filaPadre = `
                <tr class="align-middle fw-bold table-group-header">
                    <td><span class="badge bg-dark">LOTE (${grupo.totalStock})</span></td>
                    <td>
                        <div class="d-flex align-items-center">
                            <img src="${imgUrl}" class="img-thumb-mini js-preview-trigger" data-large-src="${imgUrl}">
                            <div>${principal.nombre}<div class="small text-muted fw-normal">${principal.marca}</div></div>
                        </div>
                    </td>
                    <td class="text-muted fw-normal fst-italic">Varios</td>
                    <td class="text-muted fw-normal fst-italic">Varios</td>
                    <td class="text-muted fw-normal fst-italic">Varios</td>
                    <td>$${principal.precioVenta}</td>
                    <td class="text-success">+$${ganancia}</td>
                    <td class="text-center">${grupo.totalStock} Unid.</td>
                    <td>
                        <button class="btn btn-sm btn-outline-dark w-100" type="button" data-bs-toggle="collapse" data-bs-target="#${accordionId}">Ver ${grupo.totalStock} 🔽</button>
                    </td>
                </tr>
                <tr>
                    <td colspan="9" class="p-0 border-0">
                        <div class="collapse" id="${accordionId}">
                            <table class="table table-sm mb-0 align-middle bg-transparent" style="table-layout: fixed; width: 100%;">
                                <tbody class="border-start border-4 border-warning">
                                    ${items.map(item => renderFilaHija(item, item.originalIndex)).join('')}
                                </tbody>
                            </table>
                        </div>
                    </td>
                </tr>
            `;
            tableBody.innerHTML += filaPadre;
        }
    });
}

function renderFila(prod, index) {
    const imgSegura = prod.imagen || 'https://cdn-icons-png.flaticon.com/512/2636/2636280.png';
    const ganancia = prod.precioVenta - prod.costo;
    const cantidad = prod.cantidad || 1;
    
    // CLASE BASE POR DEFECTO: VACÍA (Para que tome el color del CSS oscuro)
    let claseFila = ''; 
    let badgeUbicacion = '<span class="badge bg-success bg-opacity-10 text-success border border-success">✅ En Mano</span>';
    let botonRecibir = '';

    if (prod.ubicacion === 'en_camino') {
        claseFila = 'table-warning'; // Esta clase sí la queremos para resaltar
        badgeUbicacion = '<span class="badge bg-warning text-dark border border-dark animation-blink">🚚 En Camino</span>';
        botonRecibir = `<button class="btn btn-sm btn-outline-dark ms-1" onclick="marcarComoRecibido(${index})" title="Recibir">📥</button>`;
    }

    return `
        <tr class="${claseFila}">
            <td><span class="badge bg-secondary">${prod.sku}</span></td>
            <td>
                <div class="d-flex align-items-center">
                    <img src="${imgSegura}" class="img-thumb-mini js-preview-trigger" data-large-src="${imgSegura}">
                    <div><strong>${prod.nombre}</strong><br><small class="text-muted">${prod.marca}</small></div>
                </div>
            </td>
            <td>${getBadgeInversion(prod.inversion)}</td>
            <td>${getBadgeDestino(prod)}</td>
            <td>${badgeUbicacion}${botonRecibir}</td>
            <td>$${prod.precioVenta}</td>
            <td class="fw-bold text-success">+$${ganancia}</td>
            <td class="text-center fw-bold fs-5">${cantidad}</td>
            <td>${getBotonesAccion(index)}</td>
        </tr>
    `;
}

function renderFilaHija(prod, index) {
    const ganancia = prod.precioVenta - prod.costo;
    const imgSegura = prod.imagen || 'https://cdn-icons-png.flaticon.com/512/2636/2636280.png';

    // AQUÍ ESTABA EL ERROR: QUITAMOS 'bg-white'
    let claseFila = ''; 
    let badgeUbicacion = '<span class="badge border border-success text-success bg-light">En Mano</span>';
    let botonRecibir = '';

    if (prod.ubicacion === 'en_camino') {
        claseFila = 'table-warning';
        badgeUbicacion = '<span class="badge bg-warning text-dark border border-dark">🚚 En Camino</span>';
        botonRecibir = `<button class="btn btn-dark btn-sm ms-1 px-2 py-0" onclick="marcarComoRecibido(${index})" title="Recibir" style="font-size: 10px;">📥</button>`;
    }

    return `
        <tr class="${claseFila}" style="border-bottom: 1px solid #444;">
            <td style="width: 10%; padding-left: 20px; vertical-align: middle;"><small class="text-muted me-1">↳</small><span class="badge bg-light text-dark border border-secondary text-truncate" style="max-width: 100%;">${prod.sku}</span></td>
            <td style="width: 20%; vertical-align: middle;"><div class="d-flex align-items-center"><img src="${imgSegura}" class="img-thumb-mini rounded-circle border js-preview-trigger" data-large-src="${imgSegura}" style="width: 28px; height: 28px; min-width: 28px; object-fit: cover;"><div class="ms-2 text-truncate"><span class="fw-bold text-dark small">${prod.nombre}</span></div></div></td>
            <td style="width: 10%; vertical-align: middle;" class="badge-multiline">${getBadgeInversion(prod.inversion)}</td>
            <td style="width: 10%; vertical-align: middle;" class="badge-multiline">${getBadgeDestino(prod)}</td>
            <td style="width: 12%; vertical-align: middle;"><div class="d-flex align-items-center justify-content-center">${badgeUbicacion}${botonRecibir}</div></td>
            <td style="width: 8%; vertical-align: middle;" class="text-muted small fw-bold">$${prod.precioVenta}</td>
            <td style="width: 8%; vertical-align: middle;" class="text-success fw-bold small">+$${ganancia}</td>
            <td style="width: 7%; vertical-align: middle;" class="text-center small text-muted">1</td>
            <td style="width: 15%; vertical-align: middle;">${getBotonesAccion(index)}</td>
        </tr>
    `;
}

function cambiarOrden(campo) {
    if (ordenActual.campo === campo) ordenActual.dir = (ordenActual.dir === 'asc') ? 'desc' : 'asc';
    else {
        ordenActual.campo = campo;
        ordenActual.dir = (campo === 'precio' || campo === 'ganancia') ? 'desc' : 'asc';
    }
    cargarInventario();
}

function filtrarTabla() { cargarInventario(); }

function guardarProducto() {
    const nombre = document.getElementById('inputNombre').value;
    const marca = document.getElementById('inputMarca').value;
    let sku = document.getElementById('inputSku').value;
    const costo = document.getElementById('inputCosto').value;
    const precio = document.getElementById('inputPrecio').value;
    // --- NUEVO: CAPTURAR CANTIDAD ---
    const cantidadInput = document.getElementById('inputCantidad').value;
    const cantidad = cantidadInput ? parseInt(cantidadInput) : 1;
    // --------------------------------
    const imagenUrl = document.getElementById('inputImagen').value;
    const inversion = document.getElementById('inputInversion').value;
    
    // Validaciones básicas
    if (!nombre || !costo || !precio) return alert("Llena los campos obligatorios.");
    if (!sku) sku = 'SKU-' + Math.floor(Math.random() * 10000);

    const destino = document.getElementById('inputDestino') ? document.getElementById('inputDestino').value : 'stock'; 
    const cliente = document.getElementById('inputCliente') ? document.getElementById('inputCliente').value : '';
    const ubicacion = document.getElementById('inputUbicacion') ? document.getElementById('inputUbicacion').value : 'en_inventario';

    const nuevoPerfume = {
        id: Date.now(),
        nombre, marca, sku, costo: parseFloat(costo), precioVenta: parseFloat(precio),
        inversion, destino, cliente, ubicacion,
        imagen: imagenUrl || 'https://cdn-icons-png.flaticon.com/512/2636/2636280.png',
        cantidad: cantidad,
        fechaRegistro: new Date().toISOString()
    };

    const productos = JSON.parse(localStorage.getItem(DB_KEY)) || [];
    productos.push(nuevoPerfume);
    localStorage.setItem(DB_KEY, JSON.stringify(productos));

    const modalEl = document.getElementById('modalNuevoPerfume');
    if(modalEl) {
        const modal = bootstrap.Modal.getInstance(modalEl);
        modal.hide();
        document.getElementById('form-nuevo-perfume').reset();
    }
    cargarInventario();
}

function eliminarProducto(index) {
    if (!solicitarPin()) return alert("❌ PIN Incorrecto.");
    const productos = JSON.parse(localStorage.getItem(DB_KEY)) || [];
    productos.splice(index, 1); 
    localStorage.setItem(DB_KEY, JSON.stringify(productos)); 
    cargarInventario(); 
}

function editarProducto(index) {
    const productos = JSON.parse(localStorage.getItem(DB_KEY)) || [];
    const prod = productos[index];
    indiceEdicion = index;

    document.getElementById('inputNombre').value = prod.nombre;
    document.getElementById('inputMarca').value = prod.marca;
    document.getElementById('inputSku').value = prod.sku;
    document.getElementById('inputCosto').value = prod.costo;
    document.getElementById('inputPrecio').value = prod.precioVenta;
    document.getElementById('inputInversion').value = prod.inversion; 
    document.getElementById('inputDestino').value = prod.destino || 'stock'; 
    document.getElementById('inputCliente').value = prod.cliente || '';
    document.getElementById('inputUbicacion').value = prod.ubicacion || 'en_inventario';
    document.getElementById('inputImagen').value = prod.imagen || ''; 
    document.getElementById('inputCantidad').value = prod.cantidad || 1;

    document.querySelector('#modalNuevoPerfume .modal-title').innerText = "Editar Perfume";
    const btnGuardar = document.querySelector('#modalNuevoPerfume .modal-footer .btn-primary');
    btnGuardar.innerText = "Guardar Cambios";
    btnGuardar.onclick = guardarCambiosEdicion; 

    const modal = new bootstrap.Modal(document.getElementById('modalNuevoPerfume'));
    modal.show();
}

function guardarCambiosEdicion() {
    if (indiceEdicion === null) return;
    const productos = JSON.parse(localStorage.getItem(DB_KEY)) || [];
    const p = productos[indiceEdicion];
    productos[indiceEdicion].cantidad = parseInt(document.getElementById('inputCantidad').value) || 1;
    
    p.nombre = document.getElementById('inputNombre').value;
    p.marca = document.getElementById('inputMarca').value;
    p.sku = document.getElementById('inputSku').value;
    p.costo = parseFloat(document.getElementById('inputCosto').value);
    p.precioVenta = parseFloat(document.getElementById('inputPrecio').value);
    p.inversion = document.getElementById('inputInversion').value;
    p.destino = document.getElementById('inputDestino').value;
    p.cliente = document.getElementById('inputCliente').value;
    p.ubicacion = document.getElementById('inputUbicacion').value;
    p.imagen = document.getElementById('inputImagen').value || 'https://cdn-icons-png.flaticon.com/512/2636/2636280.png';

    localStorage.setItem(DB_KEY, JSON.stringify(productos));

    const modalEl = document.getElementById('modalNuevoPerfume');
    const modal = bootstrap.Modal.getInstance(modalEl);
    modal.hide();
    
    restaurarModalNuevo();
    cargarInventario();
}

function restaurarModalNuevo() {
    document.getElementById('form-nuevo-perfume').reset();
    indiceEdicion = null;
    document.querySelector('#modalNuevoPerfume .modal-title').innerText = "Registrar Perfume";
    const btnGuardar = document.querySelector('#modalNuevoPerfume .modal-footer .btn-primary');
    btnGuardar.innerText = "Guardar Perfume";
    btnGuardar.onclick = guardarProducto;
}

function marcarComoRecibido(index) {
    if(confirm("📦 ¿Confirmas que este perfume YA LLEGÓ?")) {
        const productos = JSON.parse(localStorage.getItem(DB_KEY)) || [];
        productos[index].ubicacion = 'en_inventario';
        localStorage.setItem(DB_KEY, JSON.stringify(productos));
        cargarInventario();
    }
}

function togglePersonalizado() {
    const tipo = document.getElementById('inputInversion').value;
    const div = document.getElementById('divPersonalizado');
    if (tipo === 'personalizado') div.style.display = 'block';
    else div.style.display = 'none';
}