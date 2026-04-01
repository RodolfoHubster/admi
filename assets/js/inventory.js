// --- INVENTARIO (VERSIÓN DARK LUXURY) ---

function validarURLImagen(url) {
    if(!url || url.trim() === '' || url.length < 10) return 'https://cdn-icons-png.flaticon.com/512/2636/2636280.png';
    try { new URL(url); return url; } catch { return 'https://cdn-icons-png.flaticon.com/512/2636/2636280.png'; }
}

const TEMPLATES_KEY = 'perfume_templates_v1';

function cargarInventario() {
    const tableBody   = document.getElementById('inventory-table-body');
    const emptyMsg    = document.getElementById('empty-msg');
    const contadorLabel = document.getElementById('contador-visible');
    if (!tableBody) return;

    const productos = JSON.parse(localStorage.getItem(DB_KEY)) || [];
    let totalUnidades = 0, totalEnCamino = 0;
    productos.forEach(prod => {
        const cant = prod.cantidad || 1;
        totalUnidades += cant;
        if(prod.ubicacion === 'en_camino') totalEnCamino += cant;
    });
    const badgeEnCaminoBoton = document.getElementById('badge-en-camino');
    if(badgeEnCaminoBoton) badgeEnCaminoBoton.innerText = totalEnCamino;
    tableBody.innerHTML = '';

    const filtroProp = document.getElementById('filtroPropiedad') ? document.getElementById('filtroPropiedad').value : 'todos';
    const filtroDest = document.getElementById('filtroDestino')   ? document.getElementById('filtroDestino').value   : 'todos';
    const busqueda   = document.getElementById('buscador')        ? document.getElementById('buscador').value.toLowerCase() : '';

    let filtrados = productos.filter(p => {
        const textoMatch = p.nombre.toLowerCase().includes(busqueda) ||
                           p.marca.toLowerCase().includes(busqueda)  ||
                           p.sku.toLowerCase().includes(busqueda);
        let propMatch = (filtroProp === 'todos') ? true : (p.inversion === filtroProp);
        let destMatch = true;
        if (filtroDest === 'stock')     destMatch = (p.destino === 'stock' && p.ubicacion !== 'en_camino');
        else if (filtroDest === 'pedido')    destMatch = (p.destino === 'pedido');
        else if (filtroDest === 'en_camino') destMatch = (p.ubicacion === 'en_camino');
        return textoMatch && propMatch && destMatch;
    });

    if (contadorLabel) contadorLabel.innerText = filtrados.length;
    if (emptyMsg) emptyMsg.style.display = (filtrados.length === 0) ? 'block' : 'none';

    const grupos = {};
    filtrados.forEach((prod) => {
        const realIndex = productos.findIndex(p => p.id === prod.id);
        prod.originalIndex = realIndex;
        const nombreLimpio = prod.nombre.trim();
        if (!grupos[nombreLimpio]) grupos[nombreLimpio] = [];
        grupos[nombreLimpio].push(prod);
    });

    let listaGrupos = Object.keys(grupos).map(nombre => ({
        nombre, items: grupos[nombre], principal: grupos[nombre][0],
        totalStock: grupos[nombre].length,
        precioRef:  grupos[nombre][0].precioVenta,
        gananciaRef: grupos[nombre][0].precioVenta - grupos[nombre][0].costo
    }));

    listaGrupos.sort((a, b) => {
        let valA, valB;
        if (ordenActual.campo === 'nombre')   { valA = a.nombre.toLowerCase(); valB = b.nombre.toLowerCase(); }
        else if (ordenActual.campo === 'precio')   { valA = a.precioRef;    valB = b.precioRef; }
        else if (ordenActual.campo === 'ganancia') { valA = a.gananciaRef;  valB = b.gananciaRef; }
        if (valA < valB) return ordenActual.dir === 'asc' ? -1 : 1;
        if (valA > valB) return ordenActual.dir === 'asc' ?  1 : -1;
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
            <td>${getBotonesAccion(index)}</td>
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
            <td style="width:12%">${getBotonesAccion(index)}</td>
        </tr>`;
}

// ========== BOTONES ACCIÓN ==========
function getBotonesAccion(index) {
    return `
        <div class="d-flex gap-1 flex-wrap justify-content-center">
            <button class="btn btn-sm btn-gold" onclick="abrirModalVenta(${index})" title="Vender">
                <i class="bi bi-cash-coin"></i>
            </button>
            <button class="btn btn-sm btn-outline-secondary" onclick="agregarAlCarrito(${index})" title="Carrito">
                <i class="bi bi-cart-plus"></i>
            </button>
            <button class="btn btn-sm btn-outline-warning" onclick="editarProducto(${index})" title="Editar">
                <i class="bi bi-pencil"></i>
            </button>
            <button class="btn btn-sm btn-outline-info" onclick="pasarADecants(${index})" title="Pasar a Decants 🧪" style="font-size:0.75rem">
                🧪
            </button>
            <button class="btn btn-sm btn-outline-danger" onclick="eliminarProducto(${index})" title="Eliminar">
                <i class="bi bi-trash"></i>
            </button>
        </div>`;
}

// ========== PASAR A DECANTS — modal Bootstrap, sin confirm() ni prompt() ==========
function pasarADecants(index) {
    const productos = JSON.parse(localStorage.getItem(DB_KEY)) || [];
    const prod = productos[index];
    if (!prod) { showToast('No se encontró el producto. Recarga la página.', 'error'); return; }

    localStorage.setItem('decant_precarga_tmp', JSON.stringify({
        nombre: prod.nombre, marca: prod.marca || '',
        imagen: prod.imagen || '', costo: prod.costo || 0,
        sku: prod.sku || '', id: prod.id, origen: 'inventario'
    }));

    // Modal Bootstrap dinámico
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
                    <p class="text-muted small mb-0">Se abrirá la página de Decants con los datos precargados.</p>
                </div>
                <div class="modal-footer border-secondary pt-2 gap-2">
                    <button class="btn btn-secondary btn-sm" data-bs-dismiss="modal"
                        onclick="localStorage.removeItem('decant_precarga_tmp')">Cancelar</button>
                    <button class="btn btn-info btn-sm fw-bold" id="__decant-confirm-btn">Ir a Decants →</button>
                </div>
            </div>
        </div>`;
        document.body.appendChild(modal);
    }

    document.getElementById('__decant-confirm-msg').textContent =
        `"${prod.nombre}" (${prod.marca || 'Sin marca'}) — $${prod.costo} costo`;
    document.getElementById('__decant-confirm-btn').onclick = () => { window.location.href = 'decants.html'; };
    new bootstrap.Modal(modal).show();
}

function cambiarOrden(campo) {
    if (ordenActual.campo === campo) ordenActual.dir = (ordenActual.dir === 'asc') ? 'desc' : 'asc';
    else { ordenActual.campo = campo; ordenActual.dir = (campo === 'precio' || campo === 'ganancia') ? 'desc' : 'asc'; }
    cargarInventario();
}

function filtrarTabla() { cargarInventario(); }

function guardarProducto() {
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

    if (!nombre || !costo || !precio) { alert('Por favor, llena los campos obligatorios.'); return; }
    if (!sku) sku = 'SKU-' + Math.floor(Math.random() * 10000);

    const productos = JSON.parse(localStorage.getItem(DB_KEY)) || [];
    for (let i = 0; i < cantidadTotal; i++) {
        productos.push({
            id: Date.now() + i, nombre, marca, sku,
            costo: parseFloat(costo), precioVenta: parseFloat(precio),
            inversion, porcentajeSocio, destino, cliente, ubicacion,
            imagen: imagenUrl || 'https://cdn-icons-png.flaticon.com/512/2636/2636280.png',
            cantidad: 1, fechaRegistro: new Date().toISOString()
        });
    }

    const checkPlantilla = document.getElementById('checkGuardarPlantilla');
    if(checkPlantilla && checkPlantilla.checked) { guardarComoPlantilla(); checkPlantilla.checked = false; }

    setData('perfumes', productos);
    const modalEl = document.getElementById('modalNuevoPerfume');
    if(modalEl) {
        const modal = bootstrap.Modal.getInstance(modalEl);
        if(modal) modal.hide();
        document.getElementById('form-nuevo-perfume').reset();
    }
    cargarInventario();
    alert(`✅ Se registraron correctamente ${cantidadTotal} unidades.`);
}

function eliminarProducto(index) {
    if (!solicitarPin()) return alert('❌ PIN Incorrecto.');
    const productos = JSON.parse(localStorage.getItem(DB_KEY)) || [];
    productos.splice(index, 1);
    setData('perfumes', productos);
    cargarInventario();
}

function editarProducto(index) {
    const productos = JSON.parse(localStorage.getItem(DB_KEY)) || [];
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
    const tituloModal = document.getElementById('titulo-modal-perfume');
    const btnGuardar  = document.getElementById('btn-guardar-perfume');
    if (tituloModal) tituloModal.innerText = 'Editar Perfume';
    if (btnGuardar)  { btnGuardar.innerText = 'Guardar Cambios'; btnGuardar.onclick = guardarCambiosEdicion; }
    new bootstrap.Modal(document.getElementById('modalNuevoPerfume')).show();
}

function guardarCambiosEdicion() {
    if (indiceEdicion === null) return;
    const productos = JSON.parse(localStorage.getItem(DB_KEY)) || [];
    const p = productos[indiceEdicion];
    p.nombre      = document.getElementById('inputNombre').value;
    p.marca       = document.getElementById('inputMarca').value;
    p.sku         = document.getElementById('inputSku').value;
    p.costo       = parseFloat(document.getElementById('inputCosto').value);
    p.precioVenta = parseFloat(document.getElementById('inputPrecio').value);
    p.inversion   = document.getElementById('inputInversion').value;
    p.destino     = document.getElementById('inputDestino').value;
    p.cliente     = document.getElementById('inputCliente').value;
    p.ubicacion   = document.getElementById('inputUbicacion').value;
    p.imagen      = document.getElementById('inputImagen').value || 'https://cdn-icons-png.flaticon.com/512/2636/2636280.png';
    p.cantidad    = parseInt(document.getElementById('inputCantidad').value) || 1;
    setData('perfumes', productos);
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
        const productos = JSON.parse(localStorage.getItem(DB_KEY)) || [];
        productos[index].ubicacion = 'en_inventario';
        setData('perfumes', productos);
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
    const productos = JSON.parse(localStorage.getItem(DB_KEY)) || [];
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
    if(!nombre || !marca) { alert('❌ Necesitas al menos nombre y marca para guardar plantilla'); return false; }
    const plantillas = JSON.parse(localStorage.getItem(TEMPLATES_KEY)) || [];
    const existe = plantillas.findIndex(t =>
        t.nombre.toLowerCase() === nombre.toLowerCase() &&
        t.marca.toLowerCase()  === marca.toLowerCase()
    );
    const nuevaPlantilla = { id: Date.now(), nombre, marca, sku, imagen, inversion, porcentajeSocio, destino, fechaCreacion: new Date().toISOString() };
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
