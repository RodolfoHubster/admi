// --- INVENTARIO (VERSIÓN DARK LUXURY) ---

function validarURLImagen(url) {
    if(!url || url.trim() === '' || url.length < 10) return 'https://cdn-icons-png.flaticon.com/512/2636/2636280.png';
    try { new URL(url); return url; } catch { return 'https://cdn-icons-png.flaticon.com/512/2636/2636280.png'; }
}

const TEMPLATES_KEY = 'perfume_templates_v1';
// Regla comercial: no permitir precio > 4x costo para evitar capturas erróneas.
const MAX_PRICE_MULTIPLIER = 4;
const ordenActualRef = (typeof ordenActual !== 'undefined' && ordenActual)
    ? ordenActual
    : { campo: 'nombre', dir: 'asc' };

function resolveInventoryStorageKey() {
    if (typeof DB_KEY !== 'undefined') return DB_KEY;
    if (typeof STORAGE_KEYS !== 'undefined' && STORAGE_KEYS.perfumes) return STORAGE_KEYS.perfumes;
    return 'perfume_inventory_v1';
}

function getInventoryList() {
    if (typeof getData === 'function') {
        const data = getData('perfumes');
        if (Array.isArray(data)) return data;
    }
    return JSON.parse(localStorage.getItem(resolveInventoryStorageKey()) || '[]');
}

function setInventoryList(productos) {
    if (typeof setData === 'function') return setData('perfumes', productos);
    localStorage.setItem(resolveInventoryStorageKey(), JSON.stringify(productos));
    return true;
}

function cargarInventario() {
    const tableBody   = document.getElementById('inventory-table-body');
    const emptyMsg    = document.getElementById('empty-msg');
    const contadorLabel = document.getElementById('contador-visible');
    if (!tableBody) return;

    const productos = getInventoryList();
    let totalUnidades = 0, totalEnCamino = 0;
    productos.forEach(prod => {
        const cant = prod.cantidad || 1;
        totalUnidades += cant;
        if(prod.ubicacion === 'en_camino') totalEnCamino += cant;
    });
    const badgeEnCaminoBoton = document.getElementById('badge-en-camino');
    if(badgeEnCaminoBoton) badgeEnCaminoBoton.innerText = totalEnCamino;
    tableBody.innerHTML = '';

    const filtroProp   = document.getElementById('filtroPropiedad') ? document.getElementById('filtroPropiedad').value : 'todos';
    const filtroDest   = document.getElementById('filtroDestino')   ? document.getElementById('filtroDestino').value   : 'todos';
    const filtroTipo   = document.getElementById('filtroTipo')      ? document.getElementById('filtroTipo').value      : 'todos';
    const filtroGenero = document.getElementById('filtroGenero')    ? document.getElementById('filtroGenero').value    : 'todos';
    const busqueda     = document.getElementById('buscador')        ? document.getElementById('buscador').value.toLowerCase() : '';

    let filtrados = productos.filter(p => {
        const textoMatch = p.nombre.toLowerCase().includes(busqueda) ||
                           p.marca.toLowerCase().includes(busqueda)  ||
                           p.sku.toLowerCase().includes(busqueda);
        let propMatch = (filtroProp === 'todos') ? true : (p.inversion === filtroProp);
        let destMatch = true;
        if (filtroDest === 'stock')     destMatch = (p.destino === 'stock' && p.ubicacion !== 'en_camino');
        else if (filtroDest === 'pedido')    destMatch = (p.destino === 'pedido');
        else if (filtroDest === 'en_camino') destMatch = (p.ubicacion === 'en_camino');
        const tipoMatch   = (filtroTipo   === 'todos') ? true : (p.tipo   === filtroTipo);
        const generoMatch = (filtroGenero === 'todos') ? true : (p.genero === filtroGenero);
        return textoMatch && propMatch && destMatch && tipoMatch && generoMatch;
    });

    if (contadorLabel) contadorLabel.innerText = filtrados.length;
    if (emptyMsg) emptyMsg.style.display = (filtrados.length === 0) ? 'block' : 'none';

    const grupos = {};
    filtrados.forEach((prod) => {
        const realIndexById = (prod.id !== undefined && prod.id !== null)
            ? productos.findIndex(p => p.id === prod.id)
            : -1;
        const realIndex = realIndexById !== -1 ? realIndexById : productos.indexOf(prod);
        prod.originalIndex = realIndex;
        const nombreLimpio = (prod.nombre || '').trim().toLowerCase();
        const marcaLimpia = (prod.marca || '').trim().toLowerCase();
        const claveGrupo = `${nombreLimpio}||${marcaLimpia}`;
        if (!grupos[claveGrupo]) grupos[claveGrupo] = [];
        grupos[claveGrupo].push(prod);
    });

    let listaGrupos = Object.keys(grupos).map(clave => ({
        nombre: grupos[clave][0].nombre, items: grupos[clave], principal: grupos[clave][0],
        totalStock: grupos[clave].length,
        precioRef:  grupos[clave][0].precioVenta,
        gananciaRef: grupos[clave][0].precioVenta - grupos[clave][0].costo
    }));

    listaGrupos.sort((a, b) => {
        let valA, valB;
        if (ordenActualRef.campo === 'nombre')   { valA = a.nombre.toLowerCase(); valB = b.nombre.toLowerCase(); }
        else if (ordenActualRef.campo === 'precio')   { valA = a.precioRef;    valB = b.precioRef; }
        else if (ordenActualRef.campo === 'ganancia') { valA = a.gananciaRef;  valB = b.gananciaRef; }
        if (valA < valB) return ordenActualRef.dir === 'asc' ? -1 : 1;
        if (valA > valB) return ordenActualRef.dir === 'asc' ?  1 : -1;
        return 0;
    });

    listaGrupos.forEach(grupo => {
        const items     = grupo.items;
        const principal = grupo.principal;
        if (items.length === 1) {
            tableBody.innerHTML += renderFila(items[0], items[0].originalIndex);
        } else {
            const accordionId = `grupo-${grupo.nombre.replace(/[^a-zA-Z0-9]/g, '-')}-${Date.now()}`;
            const imgUrl  = principal.imagen || 'https://cdn-icons-png.flaticon.com/512/2636/2636280.png';
            const ganancia = principal.precioVenta - principal.costo;
            let deudaSocioTotal = 0;
            items.forEach(item => {
                const d = calcularDeudaSocioPorPieza(item.costo, item.precioVenta, item.inversion, item.porcentajeSocio || 0);
                deudaSocioTotal += d.totalPagarSocio;
            });
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
                    <td class="text-center">${deudaSocioTotal > 0 ? `<span class="badge bg-warning text-dark border border-dark">$${deudaSocioTotal.toFixed(0)}</span>` : '-'}</td>
                    <td>
                        <button class="btn btn-sm btn-outline-dark w-100" type="button"
                            data-bs-toggle="collapse" data-bs-target="#${accordionId}">Ver ${grupo.totalStock} 🔽</button>
                    </td>
                </tr>
                <tr>
                    <td colspan="10" class="p-0 border-0">
                        <div class="collapse" id="${accordionId}">
                            <table class="table table-sm mb-0 align-middle bg-transparent" style="table-layout:fixed;width:100%">
                                <tbody class="border-start border-4 border-warning">
                                    ${items.map(item => renderFilaHija(item, item.originalIndex)).join('')}
                                </tbody>
                            </table>
                        </div>
                    </td>
                </tr>`;
            tableBody.innerHTML += filaPadre;
        }
    });
    calcularKPIsInventario();
}

function renderFila(prod, index) {
    const imgSegura = validarURLImagen(prod.imagen);
    const ganancia  = prod.precioVenta - prod.costo;
    const cantidad  = prod.cantidad || 1;
    const datosSocio = calcularDeudaSocioPorPieza(prod.costo, prod.precioVenta, prod.inversion, prod.porcentajeSocio || 0);
    const dineroSocio = datosSocio.totalPagarSocio;
    let claseFila = '', badgeUbicacion = '', botonRecibir = '';
    if (prod.ubicacion === 'en_camino') {
        claseFila = 'table-warning';
        badgeUbicacion = '<span class="badge bg-warning text-dark border border-dark animation-blink">🚚 En Camino</span>';
        botonRecibir = `<button class="btn btn-sm btn-outline-dark ms-1" onclick="marcarComoRecibido(${index})" title="Recibir">📥</button>`;
    } else {
        badgeUbicacion = '<span class="badge bg-success bg-opacity-10 text-success border border-success">✅ En Mano</span>';
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
            <td class="text-center">
                ${dineroSocio > 0
                    ? `<span class="badge bg-warning text-dark border border-dark"
                            title="Inversión: $${datosSocio.inversionSocio.toFixed(0)} + Ganancia: $${datosSocio.gananciaSocio.toFixed(0)}">
                        $${dineroSocio.toFixed(0)}</span>`
                    : '-'}
            </td>
            <td>${getBotonesAccion(index, prod.id)}</td>
        </tr>`;
}

function renderFilaHija(prod, index) {
    const ganancia   = prod.precioVenta - prod.costo;
    const imgSegura  = prod.imagen || 'https://cdn-icons-png.flaticon.com/512/2636/2636280.png';
    const datosSocio = calcularDeudaSocioPorPieza(prod.costo, prod.precioVenta, prod.inversion, prod.porcentajeSocio || 0);
    const dineroSocio = datosSocio.totalPagarSocio;
    let claseFila = '', badgeUbicacion = '', botonRecibir = '';
    if (prod.ubicacion === 'en_camino') {
        claseFila = 'table-warning';
        badgeUbicacion = '<span class="badge bg-warning text-dark border border-dark animation-blink">🚚 En Camino</span>';
        botonRecibir = `<button class="btn btn-sm btn-outline-dark ms-1" onclick="marcarComoRecibido(${index})" title="Recibir">📥</button>`;
    } else {
        badgeUbicacion = '<span class="badge bg-success bg-opacity-10 text-success border border-success">✅ En Mano</span>';
    }
    return `
        <tr class="${claseFila}" style="border-bottom:1px solid #444">
            <td style="width:10%;padding-left:20px"><small class="text-muted me-1">↳</small><span class="badge bg-light text-dark border border-secondary">${prod.sku}</span></td>
            <td style="width:20%">
                <div class="d-flex align-items-center">
                    <img src="${imgSegura}" class="img-thumb-mini rounded-circle border js-preview-trigger" data-large-src="${imgSegura}" style="width:28px;height:28px">
                    <div class="ms-2"><span class="fw-bold text-dark small">${prod.nombre}</span></div>
                </div>
            </td>
            <td style="width:9%">${getBadgeInversion(prod.inversion)}</td>
            <td style="width:9%">${getBadgeDestino(prod)}</td>
            <td style="width:11%"><div class="d-flex align-items-center justify-content-center">${badgeUbicacion}${botonRecibir}</div></td>
            <td style="width:8%" class="text-muted small fw-bold">$${prod.precioVenta}</td>
            <td style="width:8%" class="text-success fw-bold small">+$${ganancia}</td>
            <td style="width:5%" class="text-center small">1</td>
            <td style="width:8%" class="text-center">
                ${dineroSocio > 0
                    ? `<span class="badge bg-warning text-dark border border-dark"
                            title="Inversión: $${datosSocio.inversionSocio.toFixed(0)} + Ganancia: $${datosSocio.gananciaSocio.toFixed(0)}">
                        $${dineroSocio.toFixed(0)}</span>`
                    : '-'}
            </td>
            <td style="width:12%">${getBotonesAccion(index, prod.id)}</td>
        </tr>`;
}

// ========== BOTONES ACCIÓN ==========
function getBotonesAccion(index, productId = null) {
    const safeId = (productId !== undefined && productId !== null)
        ? `'${encodeURIComponent(String(productId))}'`
        : "''";
    const canEdit = typeof fitoCan === 'function' ? fitoCan('edit') : true;
    const canDelete = typeof fitoCan === 'function' ? fitoCan('delete') : true;
    const canSell = typeof fitoCan === 'function' ? fitoCan('sell') : true;
    return `
        <div class="d-flex gap-1 flex-wrap justify-content-center">
            <button class="btn btn-sm btn-gold" onclick="iniciarVenta(${index})" title="Vender" aria-label="Vender producto" ${canSell ? '' : 'disabled'}>
                <i class="bi bi-cash-coin"></i>
            </button>
            <button class="btn btn-sm btn-outline-secondary" onclick="agregarAlCarrito(${index})" title="Carrito" aria-label="Agregar al carrito">
                <i class="bi bi-cart-plus"></i>
            </button>
            <button class="btn btn-sm btn-outline-warning" onclick="editarProducto(${index})" title="Editar" aria-label="Editar producto" ${canEdit ? '' : 'disabled'}>
                <i class="bi bi-pencil"></i>
            </button>
            <button class="btn btn-sm btn-outline-primary" onclick="duplicarProducto(${index})" title="Duplicar" aria-label="Duplicar producto" ${canEdit ? '' : 'disabled'}>
                <i class="bi bi-copy"></i>
            </button>
            <button class="btn btn-sm btn-outline-info" onclick="pasarADecants(${index})" title="Pasar a Decants 🧪" aria-label="Pasar producto a decants" style="font-size:0.75rem">
                🧪
            </button>
            <button class="btn btn-sm btn-outline-danger" onclick="eliminarProducto(${index}, ${safeId})" title="Eliminar" aria-label="Eliminar producto" ${canDelete ? '' : 'disabled'}>
                <i class="bi bi-trash"></i>
            </button>
        </div>`;
}

function duplicarProducto(index) {
    if (typeof requirePermission === 'function' && !requirePermission('edit')) return;
    const productos = getInventoryList();
    const original = productos[index];
    if (!original) return;
    const nuevo = {
        ...original,
        id: Date.now(),
        sku: `${original.sku}-COPIA`,
        fechaRegistro: new Date().toISOString()
    };
    productos.push(nuevo);
    setInventoryList(productos);
    if (typeof auditLog === 'function') {
        auditLog('inventory.duplicate', { origenId: original.id, nuevoId: nuevo.id, sku: nuevo.sku });
    }
    cargarInventario();
    showToast('Producto duplicado.', 'success');
}

// ========== PASAR A DECANTS ==========
function pasarADecants(index) {
    const productos = getInventoryList();
    const prod = productos[index];
    if (!prod) { showToast('No se encontró el producto. Recarga la página.', 'error'); return; }

    localStorage.setItem('decant_precarga_tmp', JSON.stringify({
        nombre: prod.nombre, marca: prod.marca || '',
        imagen: prod.imagen || '',
        costo: parseFloat(prod.costo) || 0,
        precioCompra: parseFloat(prod.costo) || 0,
        precioVenta: parseFloat(prod.precioVenta) || 0,
        precioVentaBotella: parseFloat(prod.precioVenta) || 0,
        inversion: prod.inversion || 'mio',
        porcentajeSocio: parseFloat(prod.porcentajeSocio) || 0,
        sku: prod.sku || '', id: prod.id, origen: 'inventario'
    }));

    let modal = document.getElementById('__modal-decant-confirm');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = '__modal-decant-confirm';
        modal.className = 'modal fade';
        modal.tabIndex = -1;
        modal.innerHTML = `
        <div class="modal-dialog modal-sm modal-dialog-centered">
            <div class="modal-content bg-dark text-white border border-info">
                <div class="modal-header border-secondary pb-2">
                    <h6 class="modal-title fw-bold">🧪 Pasar a Decants</h6>
                    <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
                </div>
                <div class="modal-body py-2">
                    <p class="mb-1 small" id="__decant-confirm-msg"></p>
                    <p class="text-warning small fw-bold mb-0">⚠️ El producto será eliminado del inventario general.</p>
                </div>
                <div class="modal-footer border-secondary pt-2 gap-2">
                    <button class="btn btn-secondary btn-sm" data-bs-dismiss="modal"
                        onclick="localStorage.removeItem('decant_precarga_tmp')">Cancelar</button>
                    <button class="btn btn-info btn-sm fw-bold" id="__decant-confirm-btn">Confirmar y pasar →</button>
                </div>
            </div>
        </div>`;
        document.body.appendChild(modal);
    }

    document.getElementById('__decant-confirm-msg').textContent =
        `"${prod.nombre}" (${prod.marca || 'Sin marca'}) — $${prod.costo} costo`;

    document.getElementById('__decant-confirm-btn').onclick = async () => {
        // Eliminar el producto del inventario
        const prods = getInventoryList();
        const idxById = (prod.id !== undefined && prod.id !== null)
            ? prods.findIndex(p => p.id === prod.id)
            : -1;
        const idx = idxById !== -1 ? idxById : index;
        if (idx !== -1) {
            prods.splice(idx, 1);
            setInventoryList(prods);
                            // Guardar en todas las keys posibles de localStorage para garantizar consistencia
                const _invKey = resolveInventoryStorageKey();
                localStorage.setItem(_invKey, JSON.stringify(prods));
                localStorage.setItem('perfume_inventory_v1', JSON.stringify(prods));
                localStorage.setItem('fitoscents_perfumes', JSON.stringify(prods));
            if (typeof setDataCloud === 'function') {
                try { await setDataCloud('perfumes', prods); }
                catch (e) { console.warn('No se pudo sincronizar inventario antes de redirigir:', e); }
            }
        }
        window.location.href = 'decants.html';
    };

    new bootstrap.Modal(modal).show();
}

function cambiarOrden(campo) {
    if (ordenActualRef.campo === campo) ordenActualRef.dir = (ordenActualRef.dir === 'asc') ? 'desc' : 'asc';
    else { ordenActualRef.campo = campo; ordenActualRef.dir = (campo === 'precio' || campo === 'ganancia') ? 'desc' : 'asc'; }
    cargarInventario();
}

function filtrarTabla() { cargarInventario(); }

// ========== GUARDAR PRODUCTO (NUEVO) ==========
function guardarProducto() {
    if (typeof requirePermission === 'function' && !requirePermission('edit')) return;
    const nombre   = document.getElementById('inputNombre').value.trim();
    const marca    = document.getElementById('inputMarca').value.trim();
    let sku        = document.getElementById('inputSku').value.trim();
    const costo    = document.getElementById('inputCosto').value;
    const precio   = document.getElementById('inputPrecio').value;
    const imagenUrl = document.getElementById('inputImagen').value.trim();
    const elInversion = document.getElementById('inputInversion');
    const inversion   = elInversion ? elInversion.value : 'mio';
    const cantidadInput = document.getElementById('inputCantidad');
    const cantidadTotal = cantidadInput ? parseInt(cantidadInput.value) : 1;
    const inputPct = document.getElementById('inputPorcentajeSocio');
    const porcentajeSocio = (inversion === 'personalizado' && inputPct) ? parseFloat(inputPct.value) : 0;
    const destinoElement  = document.getElementById('inputDestino');
    const destino         = destinoElement ? destinoElement.value : 'stock';
    const clienteElement  = document.getElementById('inputCliente');
    const cliente         = clienteElement ? clienteElement.value.trim().toUpperCase() : '';
    const ubicacionElement = document.getElementById('inputUbicacion');
    const ubicacion        = ubicacionElement ? ubicacionElement.value : 'en_inventario';

    // — Nuevos campos —
    const tipoEl   = document.getElementById('inputTipo');
    const notasEl  = document.getElementById('inputNotas');
    const batchEl  = document.getElementById('inputBatch');
    const generoEl = document.getElementById('inputGenero');
    const tipo     = tipoEl   ? tipoEl.value.trim()   : '';
    const notas    = notasEl  ? notasEl.value.trim()   : '';
    const batch    = batchEl  ? batchEl.value.trim()   : '';
    const genero   = generoEl ? generoEl.value.trim()  : 'unisex';

    const costoNum = parseFloat(costo);
    const precioNum = parseFloat(precio);
    if (!nombre || !marca || !costo || !precio) { showToast('Completa nombre, marca, costo y precio.', 'warning'); return; }
    if (!Number.isFinite(costoNum) || !Number.isFinite(precioNum) || costoNum <= 0 || precioNum <= 0) {
        showToast('Costo y precio deben ser mayores a 0.', 'warning');
        return;
    }
    if (precioNum < costoNum) {
        showToast('El precio de venta no puede ser menor al costo.', 'warning');
        return;
    }
    if (precioNum > costoNum * MAX_PRICE_MULTIPLIER) {
        showToast('Precio fuera de rango. Revisa antes de guardar.', 'warning');
        return;
    }
    if (!sku) sku = 'SKU-' + Math.floor(Math.random() * 10000);

    const productos = getInventoryList();
    const skuNormalizado = sku.toLowerCase();
    const skuDuplicado = productos.some(p => String(p.sku || '').toLowerCase() === skuNormalizado);
    if (skuDuplicado) {
        showToast('SKU duplicado. Usa uno distinto.', 'warning');
        return;
    }
    for (let i = 0; i < cantidadTotal; i++) {
        productos.push({
            id: Date.now() + i, nombre, marca, sku,
            costo: costoNum, precioVenta: precioNum,
            inversion, porcentajeSocio, destino, cliente, ubicacion,
            imagen: imagenUrl || 'https://cdn-icons-png.flaticon.com/512/2636/2636280.png',
            cantidad: 1, fechaRegistro: new Date().toISOString(),
            tipo, notas, batch, genero
        });
    }

    const checkPlantilla = document.getElementById('checkGuardarPlantilla');
    if(checkPlantilla && checkPlantilla.checked) { guardarComoPlantilla(); checkPlantilla.checked = false; }

    setInventoryList(productos);
    if (typeof auditLog === 'function') {
        auditLog('inventory.create', { nombre, sku, cantidad: cantidadTotal, costo: costoNum, precio: precioNum });
    }
    const modalEl = document.getElementById('modalNuevoPerfume');
    if(modalEl) {
        const modal = bootstrap.Modal.getInstance(modalEl);
        if(modal) modal.hide();
        document.getElementById('form-nuevo-perfume').reset();
    }
    cargarInventario();
    showToast(`Se registraron ${cantidadTotal} unidad(es).`, 'success');
}

async function eliminarProducto(index, productId = '') {
    if (typeof requirePermission === 'function' && !requirePermission('delete')) return;
    const autorizado = await solicitarPin();
    if (!autorizado) return alert('❌ PIN Incorrecto.');
    const productos = getInventoryList();
    const normalizedId = (typeof productId === 'string' && productId !== '')
        ? decodeURIComponent(productId)
        : null;
    const idxById = (normalizedId !== null)
        ? productos.findIndex(p => String(p.id) === normalizedId)
        : -1;
    const idx = idxById !== -1 ? idxById : index;
    if (idx < 0 || idx >= productos.length) {
        alert('❌ No se encontró el producto a eliminar. Recarga la página.');
        return;
    }
    const eliminado = productos[idx];
    productos.splice(idx, 1);
    setInventoryList(productos);
    if (typeof auditLog === 'function') {
        auditLog('inventory.delete', { nombre: eliminado?.nombre, sku: eliminado?.sku, id: eliminado?.id });
    }
    cargarInventario();
}

// ========== EDITAR PRODUCTO ==========
function editarProducto(index) {
    if (typeof requirePermission === 'function' && !requirePermission('edit')) return;
    const productos = getInventoryList();
    const prod = productos[index];
    indiceEdicion = index;
    document.getElementById('inputNombre').value    = prod.nombre;
    document.getElementById('inputMarca').value     = prod.marca;
    document.getElementById('inputSku').value       = prod.sku;
    document.getElementById('inputCosto').value     = prod.costo;
    document.getElementById('inputPrecio').value    = prod.precioVenta;
    document.getElementById('inputInversion').value = prod.inversion;
    document.getElementById('inputDestino').value   = prod.destino || 'stock';
    document.getElementById('inputCliente').value   = prod.cliente || '';
    document.getElementById('inputUbicacion').value = prod.ubicacion || 'en_inventario';
    document.getElementById('inputImagen').value    = prod.imagen || '';
    document.getElementById('inputCantidad').value  = prod.cantidad || 1;

    // — Nuevos campos —
    const tipoEl  = document.getElementById('inputTipo');
    const notasEl = document.getElementById('inputNotas');
    const batchEl = document.getElementById('inputBatch');
    const generoEl = document.getElementById('inputGenero');
    if (tipoEl)   tipoEl.value   = prod.tipo   || 'designer';
    if (notasEl)  notasEl.value  = prod.notas  || '';
    if (batchEl)  batchEl.value  = prod.batch  || '';
    if (generoEl) generoEl.value = prod.genero || 'unisex';

    const tituloModal = document.getElementById('titulo-modal-perfume');
    const btnGuardar  = document.getElementById('btn-guardar-perfume');
    if (tituloModal) tituloModal.innerText = 'Editar Perfume';
    if (btnGuardar)  { btnGuardar.innerText = 'Guardar Cambios'; btnGuardar.onclick = guardarCambiosEdicion; }
    new bootstrap.Modal(document.getElementById('modalNuevoPerfume')).show();
}

// ========== GUARDAR CAMBIOS EDICIÓN ==========
function guardarCambiosEdicion() {
    if (typeof requirePermission === 'function' && !requirePermission('edit')) return;
    if (indiceEdicion === null) return;
    const productos = getInventoryList();
    const p = productos[indiceEdicion];
    const skuAnterior = p.sku;
    p.nombre      = document.getElementById('inputNombre').value;
    p.marca       = document.getElementById('inputMarca').value;
    p.sku         = document.getElementById('inputSku').value.trim();
    p.costo       = parseFloat(document.getElementById('inputCosto').value);
    p.precioVenta = parseFloat(document.getElementById('inputPrecio').value);
    p.inversion   = document.getElementById('inputInversion').value;
    p.destino     = document.getElementById('inputDestino').value;
    p.cliente     = document.getElementById('inputCliente').value;
    p.ubicacion   = document.getElementById('inputUbicacion').value;
    p.imagen      = document.getElementById('inputImagen').value || 'https://cdn-icons-png.flaticon.com/512/2636/2636280.png';
    p.cantidad    = parseInt(document.getElementById('inputCantidad').value) || 1;

    // — Nuevos campos —
    const tipoEl  = document.getElementById('inputTipo');
    const notasEl = document.getElementById('inputNotas');
    const batchEl = document.getElementById('inputBatch');
    const generoEl = document.getElementById('inputGenero');
    if (tipoEl)   p.tipo   = tipoEl.value.trim();
    if (notasEl)  p.notas  = notasEl.value.trim();
    if (batchEl)  p.batch  = batchEl.value.trim();
    if (generoEl) p.genero = generoEl.value.trim();

    const skuNormalizado = String(p.sku || '').toLowerCase();
    const duplicado = productos.some((item, idx) => idx !== indiceEdicion && String(item.sku || '').toLowerCase() === skuNormalizado);
    if (duplicado) {
        showToast('SKU duplicado. Elige otro SKU.', 'warning');
        p.sku = skuAnterior;
        return;
    }

    setInventoryList(productos);
    if (typeof auditLog === 'function') {
        auditLog('inventory.update', { id: p.id, nombre: p.nombre, sku: p.sku });
    }
    const modalEl = document.getElementById('modalNuevoPerfume');
    const modal   = bootstrap.Modal.getInstance(modalEl);
    if(modal) modal.hide();
    restaurarModalNuevo();
    cargarInventario();
}

function restaurarModalNuevo() {
    document.getElementById('form-nuevo-perfume').reset();
    indiceEdicion = null;
    const tituloModal = document.getElementById('titulo-modal-perfume');
    const btnGuardar  = document.getElementById('btn-guardar-perfume');
    if (tituloModal) tituloModal.innerText = 'Registrar Perfume';
    if (btnGuardar)  { btnGuardar.innerText = 'Guardar Perfume'; btnGuardar.onclick = guardarProducto; }
    cargarListaPlantillas();
}

function marcarComoRecibido(index) {
    if(confirm('📦 ¿Confirmas que este perfume YA LLEGÓ?')) {
        const productos = getInventoryList();
        productos[index].ubicacion = 'en_inventario';
        setInventoryList(productos);
        cargarInventario();
    }
}

function togglePersonalizado() {
    const tipo = document.getElementById('inputInversion').value;
    const div  = document.getElementById('divPersonalizado');
    if (tipo === 'personalizado') div.style.display = 'block';
    else div.style.display = 'none';
}

function calcularKPIsInventario() {
    const productos = getInventoryList();
    let totalCosto = 0, totalVenta = 0, totalGanancia = 0, deudaSocio = 0;
    productos.forEach(prod => {
        const costo = parseFloat(prod.costo) || 0;
        const venta = parseFloat(prod.precioVenta) || 0;
        totalCosto    += costo;
        totalVenta    += venta;
        totalGanancia += (venta - costo);
        if (prod.inversion === 'mitad') deudaSocio += costo * 0.5;
        else if (prod.inversion === 'socio') deudaSocio += costo;
        else if (prod.inversion === 'personalizado') deudaSocio += costo * ((prod.porcentajeSocio || 0) / 100);
    });
    if(document.getElementById('total-costo-inventario'))    document.getElementById('total-costo-inventario').innerText    = '$' + totalCosto.toFixed(0);
    if(document.getElementById('total-precio-inventario'))   document.getElementById('total-precio-inventario').innerText   = '$' + totalVenta.toFixed(0);
    if(document.getElementById('total-ganancia-potencial'))  document.getElementById('total-ganancia-potencial').innerText  = '+$' + totalGanancia.toFixed(0);
    if(document.getElementById('total-deuda-socio-inventario')) document.getElementById('total-deuda-socio-inventario').innerText = '$' + deudaSocio.toFixed(0);
}

function filtrarEnCaminoRapido() {
    const filtroDestino = document.getElementById('filtroDestino');
    if(filtroDestino) { filtroDestino.value = 'en_camino'; cargarInventario(); }
}

// ========== PLANTILLAS ==========
function cargarListaPlantillas() {
    const select = document.getElementById('selectPlantilla');
    if(!select) return;
    const plantillas = JSON.parse(localStorage.getItem(TEMPLATES_KEY)) || [];
    select.innerHTML = '<option value="">-- Nuevo perfume desde cero --</option>';
    plantillas.forEach((template, index) => {
        const option = document.createElement('option');
        option.value = index;
        option.textContent = `${template.nombre} (${template.marca})`;
        select.appendChild(option);
    });
}

function cargarPlantilla() {
    const select = document.getElementById('selectPlantilla');
    const index  = select.value;
    if(index === '') { document.getElementById('form-nuevo-perfume').reset(); document.getElementById('inputCantidad').value = 1; return; }
    const plantillas = JSON.parse(localStorage.getItem(TEMPLATES_KEY)) || [];
    const template   = plantillas[index];
    if(!template) return;
    document.getElementById('inputNombre').value    = template.nombre;
    document.getElementById('inputMarca').value     = template.marca;
    document.getElementById('inputSku').value       = template.sku || '';
    document.getElementById('inputImagen').value    = template.imagen || '';
    document.getElementById('inputInversion').value = template.inversion || 'mio';
    document.getElementById('inputDestino').value   = template.destino || 'stock';
    if(template.inversion === 'personalizado' && template.porcentajeSocio) {
        document.getElementById('inputPorcentajeSocio').value = template.porcentajeSocio;
        togglePersonalizado();
    }
    // — Nuevos campos desde plantilla —
    const tipoEl  = document.getElementById('inputTipo');
    const notasEl = document.getElementById('inputNotas');
    const generoEl = document.getElementById('inputGenero');
    if (tipoEl   && template.tipo)   tipoEl.value   = template.tipo;
    if (notasEl  && template.notas)  notasEl.value  = template.notas;
    if (generoEl && template.genero) generoEl.value  = template.genero;

    document.getElementById('inputCosto').value  = '';
    document.getElementById('inputPrecio').value = '';
    document.getElementById('inputCosto').focus();
    alert(`✅ Plantilla "${template.nombre}" cargada. Ahora ingresa precio/costo actuales.`);
}

function guardarComoPlantilla() {
    const nombre    = document.getElementById('inputNombre').value.trim();
    const marca     = document.getElementById('inputMarca').value.trim();
    const sku       = document.getElementById('inputSku').value.trim();
    const imagen    = document.getElementById('inputImagen').value.trim();
    const inversion = document.getElementById('inputInversion').value;
    const destino   = document.getElementById('inputDestino').value;
    const inputPct  = document.getElementById('inputPorcentajeSocio');
    const porcentajeSocio = (inversion === 'personalizado' && inputPct) ? parseFloat(inputPct.value) : 0;
    const tipoEl   = document.getElementById('inputTipo');
    const notasEl  = document.getElementById('inputNotas');
    const generoEl = document.getElementById('inputGenero');
    const tipo    = tipoEl   ? tipoEl.value.trim()   : '';
    const notas   = notasEl  ? notasEl.value.trim()  : '';
    const genero  = generoEl ? generoEl.value.trim()  : 'unisex';
    if(!nombre || !marca) { alert('❌ Necesitas al menos nombre y marca para guardar plantilla'); return false; }
    const plantillas = JSON.parse(localStorage.getItem(TEMPLATES_KEY)) || [];
    const existe = plantillas.findIndex(t =>
        t.nombre.toLowerCase() === nombre.toLowerCase() &&
        t.marca.toLowerCase()  === marca.toLowerCase()
    );
    const nuevaPlantilla = { id: Date.now(), nombre, marca, sku, imagen, inversion, porcentajeSocio, destino, tipo, notas, genero, fechaCreacion: new Date().toISOString() };
    if(existe !== -1) {
        if(confirm('⚠️ Ya existe una plantilla con este nombre. ¿Actualizar?')) plantillas[existe] = nuevaPlantilla;
        else return false;
    } else {
        plantillas.push(nuevaPlantilla);
    }
    setData('plantillas', plantillas);
    alert(`💾 Plantilla "${nombre}" guardada correctamente`);
    cargarListaPlantillas();
    return true;
}

function gestionarPlantillas() {
    const plantillas = JSON.parse(localStorage.getItem(TEMPLATES_KEY)) || [];
    if(plantillas.length === 0) {
        alert('📋 No tienes plantillas guardadas todavía.\n\nMarca la casilla "Guardar como plantilla" al registrar un perfume.');
        return;
    }
    let mensaje = '📋 PLANTILLAS GUARDADAS:\n\n';
    plantillas.forEach((t, i) => { mensaje += `${i+1}. ${t.nombre} - ${t.marca}\n`; });
    mensaje += '\n¿Qué deseas hacer?\n\n[OK] = Cerrar\n[Cancelar] = Borrar todas las plantillas';
    if(!confirm(mensaje)) {
        if(confirm('⚠️ ¿ELIMINAR TODAS LAS PLANTILLAS? Esta acción no se puede deshacer.')) {
            localStorage.removeItem(TEMPLATES_KEY);
            cargarListaPlantillas();
            alert('🗑️ Todas las plantillas han sido eliminadas');
        }
    }
}

document.addEventListener('DOMContentLoaded', async () => {
    await initApp();
    cargarInventario();
    cargarListaPlantillas();
    calcularKPIsInventario();
});
