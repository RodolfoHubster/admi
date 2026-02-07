// --- INVENTARIO (VERSIÓN DARK LUXURY) ---

function cargarInventario() {
    const tableBody = document.getElementById('inventory-table-body');
    const emptyMsg = document.getElementById('empty-msg');
    const contadorLabel = document.getElementById('contador-visible');
    
    if (!tableBody) return;

    const productos = JSON.parse(localStorage.getItem(DB_KEY)) || [];
    
    // ===== NUEVO: CALCULAR TOTALES PARA BADGES =====
    let totalUnidades = 0;
    let totalEnCamino = 0;
    
    productos.forEach(prod => {
        const cant = prod.cantidad || 1;
        totalUnidades += cant;
        
        if(prod.ubicacion === 'en_camino') {
            totalEnCamino += cant;
        }
    });
    
    // Actualizar badges
    const badgePerfumes = document.querySelector('.badge.bg-primary');
    const badgeUnidades = document.querySelector('.badge.bg-secondary');
    const badgeEnCamino = document.querySelector('.badge.bg-warning');
    const badgeEnCaminoBoton = document.getElementById('badge-en-camino');
    
    if(badgePerfumes) badgePerfumes.innerText = `${productos.length} perfumes`;
    if(badgeUnidades) badgeUnidades.innerText = `${totalUnidades} unidades`;
    if(badgeEnCamino) badgeEnCamino.innerText = `${totalEnCamino} en camino`;
    if(badgeEnCaminoBoton) badgeEnCaminoBoton.innerText = totalEnCamino;
    // ===============================================
    
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

            // --- CÁLCULO DE DEUDA SOCIO PARA TODO EL LOTE ---
            let deudaSocioTotal = 0;
            items.forEach(item => {
                let din = 0;
                if (item.inversion === 'mitad') din = item.costo / 2;
                else if (item.inversion === 'socio') din = item.costo;
                else if (item.inversion === 'personalizado') {
                    const pct = item.porcentajeSocio || 0;
                    din = item.costo * (pct / 100);
                }
                deudaSocioTotal += din;
            });
            // -----------------------------------------------

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
                    
                    <td class="text-center">
                         ${deudaSocioTotal > 0 ? `<span class="badge bg-warning text-dark border border-dark">$${deudaSocioTotal.toFixed(0)}</span>` : '-'}
                    </td>
                    <td>
                        <button class="btn btn-sm btn-outline-dark w-100" type="button" data-bs-toggle="collapse" data-bs-target="#${accordionId}">Ver ${grupo.totalStock} 🔽</button>
                    </td>
                </tr>
                <tr>
                    <td colspan="10" class="p-0 border-0"> <div class="collapse" id="${accordionId}">
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
    
    // CÁLCULO DINERO SOCIO
    let dineroSocio = 0;
    if (prod.inversion === 'mitad') dineroSocio = prod.costo / 2;
    else if (prod.inversion === 'socio') dineroSocio = prod.costo;
    else if (prod.inversion === 'personalizado') {
        const pct = prod.porcentajeSocio || 0;
        dineroSocio = prod.costo * (pct / 100);
    }
    
    let claseFila = ''; 
    let badgeUbicacion = '';
    let botonRecibir = '';

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
                ${dineroSocio > 0 ? `<span class="badge bg-warning text-dark border border-dark">$${dineroSocio.toFixed(0)}</span>` : '<span class="text-muted">-</span>'}
            </td>
            <td>${getBotonesAccion(index)}</td>
        </tr>
    `;
}

function renderFilaHija(prod, index) {
    const ganancia = prod.precioVenta - prod.costo;
    const imgSegura = prod.imagen || 'https://cdn-icons-png.flaticon.com/512/2636/2636280.png';

    // CÁLCULO DINERO SOCIO
    let dineroSocio = 0;
    if (prod.inversion === 'mitad') dineroSocio = prod.costo / 2;
    else if (prod.inversion === 'socio') dineroSocio = prod.costo;
    else if (prod.inversion === 'personalizado') {
        const pct = prod.porcentajeSocio || 0;
        dineroSocio = prod.costo * (pct / 100);
    }

    let claseFila = ''; 
    let badgeUbicacion = '';
    let botonRecibir = '';

    if (prod.ubicacion === 'en_camino') {
        claseFila = 'table-warning';
        badgeUbicacion = '<span class="badge bg-warning text-dark border border-dark animation-blink">🚚 En Camino</span>';
        botonRecibir = `<button class="btn btn-sm btn-outline-dark ms-1" onclick="marcarComoRecibido(${index})" title="Recibir">📥</button>`;
    } else {
        badgeUbicacion = '<span class="badge bg-success bg-opacity-10 text-success border border-success">✅ En Mano</span>';
    }

    // OJO CON LOS ANCHOS (%) - HE AJUSTADO PARA QUE QUEPAN TODOS
    return `
        <tr class="${claseFila}" style="border-bottom: 1px solid #444;">
            <td style="width: 10%; padding-left: 20px; vertical-align: middle;"><small class="text-muted me-1">↳</small><span class="badge bg-light text-dark border border-secondary text-truncate" style="max-width: 100%;">${prod.sku}</span></td>
            <td style="width: 20%; vertical-align: middle;"><div class="d-flex align-items-center"><img src="${imgSegura}" class="img-thumb-mini rounded-circle border js-preview-trigger" data-large-src="${imgSegura}" style="width: 28px; height: 28px; min-width: 28px; object-fit: cover;"><div class="ms-2 text-truncate"><span class="fw-bold text-dark small">${prod.nombre}</span></div></div></td>
            <td style="width: 9%; vertical-align: middle;" class="badge-multiline">${getBadgeInversion(prod.inversion)}</td>
            <td style="width: 9%; vertical-align: middle;" class="badge-multiline">${getBadgeDestino(prod)}</td>
            <td style="width: 11%; vertical-align: middle;"><div class="d-flex align-items-center justify-content-center">${badgeUbicacion}${botonRecibir}</div></td>
            <td style="width: 8%; vertical-align: middle;" class="text-muted small fw-bold">$${prod.precioVenta}</td>
            <td style="width: 8%; vertical-align: middle;" class="text-success fw-bold small">+$${ganancia}</td>
            <td style="width: 5%; vertical-align: middle;" class="text-center small text-muted">1</td>
            
            <td style="width: 8%; vertical-align: middle;" class="text-center">
                 ${dineroSocio > 0 ? `<span class="badge bg-warning text-dark border border-dark text-truncate">$${dineroSocio.toFixed(0)}</span>` : '-'}
            </td>
            <td style="width: 12%; vertical-align: middle;">${getBotonesAccion(index)}</td>
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
    // 1. CAPTURAR DATOS DEL FORMULARIO
    const nombre = document.getElementById('inputNombre').value.trim();
    const marca = document.getElementById('inputMarca').value.trim();
    let sku = document.getElementById('inputSku').value.trim();
    const costo = document.getElementById('inputCosto').value;
    const precio = document.getElementById('inputPrecio').value;
    const imagenUrl = document.getElementById('inputImagen').value.trim();
    
    // Capturar inversión
    const elInversion = document.getElementById('selectInversion') || document.getElementById('inputInversion');
    const inversion = elInversion ? elInversion.value : 'mio';

    // Capturar cantidad
    const cantidadInput = document.getElementById('inputCantidad');
    const cantidadTotal = cantidadInput ? parseInt(cantidadInput.value) : 1;
    
    // Capturar porcentaje socio
    const inputPct = document.getElementById('inputPorcentaje') || document.getElementById('inputPorcentajeSocio');
    const porcentajeSocio = (inversion === 'personalizado' && inputPct) ? parseFloat(inputPct.value) : 0;
    
    // Capturar destino
    const destinoElement = document.getElementById('inputDestino'); 
    const destino = destinoElement ? destinoElement.value : 'stock';
    
    // Capturar cliente
    const clienteElement = document.getElementById('inputCliente');
    const clienteRaw = clienteElement ? clienteElement.value : '';
    const cliente = clienteRaw.trim().toUpperCase();
    
    // Capturar ubicación
    const ubicacionElement = document.getElementById('inputUbicacion');
    const ubicacion = ubicacionElement ? ubicacionElement.value : 'en_inventario';

    // 2. VALIDACIONES
    if (!nombre || !costo || !precio) {
        alert("Por favor, llena los campos obligatorios (Nombre, Costo, Precio).");
        return;
    }
    
    // Si no hay SKU, generamos uno aleatorio
    if (!sku) sku = 'SKU-' + Math.floor(Math.random() * 10000);

    // 3. CARGAR BASE DE DATOS ACTUAL
    const productos = JSON.parse(localStorage.getItem(DB_KEY)) || [];

    // 4. CREAR PRODUCTOS (BUCLE DE REPETICIÓN)
    for (let i = 0; i < cantidadTotal; i++) {
        const nuevoPerfume = {
            id: Date.now() + i, 
            nombre: nombre,
            marca: marca,
            sku: sku,
            costo: parseFloat(costo),
            precioVenta: parseFloat(precio),
            inversion: inversion,
            porcentajeSocio: porcentajeSocio,
            destino: destino,
            cliente: cliente,
            ubicacion: ubicacion,
            imagen: imagenUrl || 'https://cdn-icons-png.flaticon.com/512/2636/2636280.png',
            cantidad: 1,
            fechaRegistro: new Date().toISOString()
        };
        
        productos.push(nuevoPerfume);
    }

    // 5. GUARDAR EN LOCALSTORAGE
    localStorage.setItem(DB_KEY, JSON.stringify(productos));

    // 6. CERRAR MODAL Y LIMPIAR
    const modalEl = document.getElementById('modalNuevoPerfume');
    if(modalEl) {
        const modal = bootstrap.Modal.getInstance(modalEl);
        if(modal) modal.hide();
        document.getElementById('form-nuevo-perfume').reset();
    }

    // 7. REFRESCAR LA TABLA
    if (typeof cargarInventario === 'function') {
        cargarInventario();
    }

    // ===== GUARDAR COMO PLANTILLA SI ESTÁ MARCADO =====
const checkPlantilla = document.getElementById('checkGuardarPlantilla');
if(checkPlantilla && checkPlantilla.checked) {
    guardarComoPlantilla();
    checkPlantilla.checked = false;
}
// ==================================================
    
    alert(`✅ Se registraron correctamente ${cantidadTotal} unidades.`);
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

function calcularKPIsInventario() {
    const productos = JSON.parse(localStorage.getItem(DB_KEY)) || [];
    
    let totalCosto = 0;
    let totalVenta = 0;
    let totalGanancia = 0;
    let deudaSocio = 0;
    
    productos.forEach(prod => {
        const costo = parseFloat(prod.costo) || 0;
        const venta = parseFloat(prod.precioVenta) || 0;
        const cantidad = prod.cantidad || 1;
        
        totalCosto += costo;
        totalVenta += venta;
        totalGanancia += (venta - costo);
        
        // Calcular deuda al socio
        if (prod.inversion === 'mitad') {
            deudaSocio += costo * 0.5;
        } else if (prod.inversion === 'socio') {
            deudaSocio += costo;
        } else if (prod.inversion === 'personalizado') {
            const pct = prod.porcentajeSocio || 0;
            deudaSocio += costo * (pct / 100);
        }
    });
    
    // Actualizar en pantalla
    if(document.getElementById('total-costo-inventario')) {
        document.getElementById('total-costo-inventario').innerText = '$' + totalCosto.toFixed(0);
    }
    if(document.getElementById('total-precio-inventario')) {
        document.getElementById('total-precio-inventario').innerText = '$' + totalVenta.toFixed(0);
    }
    if(document.getElementById('total-ganancia-potencial')) {
        document.getElementById('total-ganancia-potencial').innerText = '+$' + totalGanancia.toFixed(0);
    }
    if(document.getElementById('total-deuda-socio-inventario')) {
        document.getElementById('total-deuda-socio-inventario').innerText = '$' + deudaSocio.toFixed(0);
    }
}

// Llamar al cargar inventario
document.addEventListener('DOMContentLoaded', () => {
    if(typeof cargarInventario === 'function') {
        cargarInventario();
        calcularKPIsInventario();
    }
});


function filtrarEnCaminoRapido() {
    const filtroDestino = document.getElementById('filtroDestino');
    if(filtroDestino) {
        filtroDestino.value = 'en_camino';
        cargarInventario();
    }
}

// ========================================
// SISTEMA DE PLANTILLAS DE PERFUMES
// ========================================

const TEMPLATES_KEY = 'perfume_templates_v1';

// Cargar lista de plantillas en el selector
function cargarListaPlantillas() {
    const select = document.getElementById('selectPlantilla');
    if(!select) return;
    
    const plantillas = JSON.parse(localStorage.getItem(TEMPLATES_KEY)) || [];
    
    // Limpiar opciones (excepto la primera)
    select.innerHTML = '<option value="">-- Nuevo perfume desde cero --</option>';
    
    // Agregar cada plantilla
    plantillas.forEach((template, index) => {
        const option = document.createElement('option');
        option.value = index;
        option.textContent = `${template.nombre} (${template.marca})`;
        select.appendChild(option);
    });
}

// Cargar datos de plantilla seleccionada
function cargarPlantilla() {
    const select = document.getElementById('selectPlantilla');
    const index = select.value;
    
    if(index === '') {
        // Limpiar formulario
        document.getElementById('form-nuevo-perfume').reset();
        document.getElementById('inputCantidad').value = 1;
        return;
    }
    
    const plantillas = JSON.parse(localStorage.getItem(TEMPLATES_KEY)) || [];
    const template = plantillas[index];
    
    if(!template) return;
    
    // Autocompletar campos
    document.getElementById('inputNombre').value = template.nombre;
    document.getElementById('inputMarca').value = template.marca;
    document.getElementById('inputSku').value = template.sku || '';
    document.getElementById('inputImagen').value = template.imagen || '';
    document.getElementById('inputInversion').value = template.inversion || 'mio';
    document.getElementById('inputDestino').value = template.destino || 'stock';
    
    if(template.inversion === 'personalizado' && template.porcentajeSocio) {
        document.getElementById('inputPorcentajeSocio').value = template.porcentajeSocio;
        togglePersonalizado();
    }
    
    // IMPORTANTE: NO autocompletar precio/costo (para que los modifiques)
    document.getElementById('inputCosto').value = '';
    document.getElementById('inputPrecio').value = '';
    document.getElementById('inputCosto').focus(); // Focus en el costo
    
    alert(`✅ Plantilla "${template.nombre}" cargada. Ahora ingresa precio/costo actuales.`);
}

// Guardar perfume como plantilla
function guardarComoPlantilla() {
    const nombre = document.getElementById('inputNombre').value.trim();
    const marca = document.getElementById('inputMarca').value.trim();
    const sku = document.getElementById('inputSku').value.trim();
    const imagen = document.getElementById('inputImagen').value.trim();
    const inversion = document.getElementById('inputInversion').value;
    const destino = document.getElementById('inputDestino').value;
    
    const inputPct = document.getElementById('inputPorcentajeSocio');
    const porcentajeSocio = (inversion === 'personalizado' && inputPct) ? parseFloat(inputPct.value) : 0;
    
    if(!nombre || !marca) {
        alert('❌ Necesitas al menos nombre y marca para guardar plantilla');
        return false;
    }
    
    const plantillas = JSON.parse(localStorage.getItem(TEMPLATES_KEY)) || [];
    
    // Verificar si ya existe
    const existe = plantillas.findIndex(t => 
        t.nombre.toLowerCase() === nombre.toLowerCase() && 
        t.marca.toLowerCase() === marca.toLowerCase()
    );
    
    const nuevaPlantilla = {
        id: Date.now(),
        nombre: nombre,
        marca: marca,
        sku: sku,
        imagen: imagen,
        inversion: inversion,
        porcentajeSocio: porcentajeSocio,
        destino: destino,
        fechaCreacion: new Date().toISOString()
    };
    
    if(existe !== -1) {
        // Actualizar existente
        if(confirm('⚠️ Ya existe una plantilla con este nombre. ¿Actualizar?')) {
            plantillas[existe] = nuevaPlantilla;
        } else {
            return false;
        }
    } else {
        // Agregar nueva
        plantillas.push(nuevaPlantilla);
    }
    
    localStorage.setItem(TEMPLATES_KEY, JSON.stringify(plantillas));
    alert(`💾 Plantilla "${nombre}" guardada correctamente`);
    cargarListaPlantillas();
    return true;
}

// Gestionar plantillas (ver/eliminar)
function gestionarPlantillas() {
    const plantillas = JSON.parse(localStorage.getItem(TEMPLATES_KEY)) || [];
    
    if(plantillas.length === 0) {
        alert('📋 No tienes plantillas guardadas todavía.\n\nMarca la casilla "Guardar como plantilla" al registrar un perfume.');
        return;
    }
    
    let mensaje = '📋 PLANTILLAS GUARDADAS:\n\n';
    plantillas.forEach((t, i) => {
        mensaje += `${i+1}. ${t.nombre} - ${t.marca}\n`;
    });
    mensaje += '\n¿Qué deseas hacer?\n\n';
    mensaje += '[OK] = Cerrar\n';
    mensaje += '[Cancelar] = Borrar todas las plantillas';
    
    if(!confirm(mensaje)) {
        if(confirm('⚠️ ¿ELIMINAR TODAS LAS PLANTILLAS? Esta acción no se puede deshacer.')) {
            localStorage.removeItem(TEMPLATES_KEY);
            cargarListaPlantillas();
            alert('🗑️ Todas las plantillas han sido eliminadas');
        }
    }
}

// Llamar al abrir el modal
document.addEventListener('DOMContentLoaded', () => {
    cargarListaPlantillas();
});
