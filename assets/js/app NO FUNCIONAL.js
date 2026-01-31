// assets/js/app.js

// 1. Cargar inventario al iniciar
document.addEventListener('DOMContentLoaded', () => {
    cargarInventario();
});

// CLAVE: Aquí definimos dónde se guarda la información (Local Storage del navegador)
const DB_KEY = 'perfume_inventory_v1';
// VARIABLES DE ESTADO PARA FILTROS Y ORDEN
let ordenActual = { campo: 'nombre', dir: 'asc' }; // asc (A-Z) o desc (Z-A)
let indiceEdicion = null;

// 1. PASO 1: ABRIR EL MODAL DE VENTA
function iniciarVenta(index) {
    const productos = JSON.parse(localStorage.getItem(DB_KEY)) || [];
    const prod = productos[index];

    // Llenar el modal con los datos actuales
    document.getElementById('venta-nombre-producto').innerText = prod.nombre;
    document.getElementById('venta-precio-lista').value = `$${prod.precioVenta}`;
    document.getElementById('venta-precio-final').value = prod.precioVenta; // Pre-llenar con el precio original
    document.getElementById('venta-index-producto').value = index;

    // AGREGAR ESTA LÍNEA:
    if(document.getElementById('venta-gastos')) {
        document.getElementById('venta-gastos').value = 0;
    }

    const inputCliente = document.getElementById('venta-cliente');
    
    // 1. Detectamos si hay un cliente real (que no sea Mostrador)
    const clienteReal = (prod.cliente && prod.cliente.trim() !== '' && prod.cliente !== 'Mostrador') ? prod.cliente : '';

    // 2. ¡TRUCO! Guardamos ese nombre en un atributo invisible del input para recordarlo siempre
    inputCliente.dataset.duenoOriginal = clienteReal;

    // 3. Pre-llenamos el valor visualmente
    inputCliente.value = clienteReal;
    // -----------------------

    // Mostrar el Modal
    const modalVenta = new bootstrap.Modal(document.getElementById('modalVenta'));
    modalVenta.show();
}

// 2. PASO 2: GUARDAR LA VENTA REAL
function confirmarVentaFinal() {
    const index = document.getElementById('venta-index-producto').value;
    const precioFinal = parseFloat(document.getElementById('venta-precio-final').value);
    
    // 1. CAPTURAR GASTOS EXTRA
    const gastosExtra = parseFloat(document.getElementById('venta-gastos').value) || 0;

    // --- DATOS DE CRÉDITO ---
    const esCredito = document.getElementById('checkCredito').checked;
    const nombreCliente = document.getElementById('venta-cliente').value;
    const anticipo = parseFloat(document.getElementById('venta-anticipo').value) || 0;

    if (!precioFinal || precioFinal <= 0) return alert("El precio no puede ser cero.");
    if (esCredito && !nombreCliente) return alert("Si es fiado, DEBES poner el nombre del cliente.");

    const productos = JSON.parse(localStorage.getItem(DB_KEY)) || [];
    const producto = productos[index];

    // 2. CÁLCULO DE UTILIDAD REAL (Aquí está el cambio)
    const costo = producto.costo;
    // Fórmula: Precio Venta - Costo Producto - Gastos Extra = Ganancia Neta
    const utilidadTotal = precioFinal - costo - gastosExtra; 
    
    const saldoPendiente = esCredito ? (precioFinal - anticipo) : 0;

    // Reparto de Utilidades
    let gananciaMia = 0;
    let gananciaSocio = 0;

    if (producto.inversion === 'mio') { 
        gananciaMia = utilidadTotal; 
    } else if (producto.inversion === 'socio') { 
        gananciaSocio = utilidadTotal; 
    } else if (producto.inversion === 'mitad') { 
        gananciaMia = utilidadTotal / 2; 
        gananciaSocio = utilidadTotal / 2; 
    } else if (producto.inversion === 'personalizado') {
        const factor = (producto.porcentajeSocio || 0) / 100;
        gananciaSocio = utilidadTotal * factor;
        gananciaMia = utilidadTotal - gananciaSocio;
    } else {
        gananciaMia = utilidadTotal; 
    }

    // Objeto de Venta
    const nuevaVenta = {
        id: Date.now(),
        producto: producto.nombre,
        marca: producto.marca,   // Guardamos la marca original
        imagen: producto.imagen, // Guardamos la foto original
        sku: producto.sku,
        costoOriginal: costo,
        precioFinal: precioFinal,
        
        // Guardamos el gasto para saber por qué bajó la ganancia
        gastosExtra: gastosExtra, 
        
        utilidad: utilidadTotal,
        reparto: { yo: gananciaMia, socio: gananciaSocio },
        fecha: new Date().toLocaleString(),
        esCredito: esCredito,
        cliente: esCredito ? nombreCliente : (producto.cliente || 'Mostrador'),
        saldoPendiente: saldoPendiente,
        historialAbonos: []
    };

    if (esCredito && anticipo > 0) {
        nuevaVenta.historialAbonos.push({
            fecha: new Date().toLocaleString(),
            monto: anticipo,
            nota: "Anticipo Inicial"
        });
    }

    // Guardar en localStorage
    const historial = JSON.parse(localStorage.getItem(SALES_KEY)) || [];
    historial.push(nuevaVenta);
    localStorage.setItem(SALES_KEY, JSON.stringify(historial));

    productos.splice(index, 1);
    localStorage.setItem(DB_KEY, JSON.stringify(productos));

    // CERRAR MODAL VENTA
    const modalEl = document.getElementById('modalVenta');
    const modal = bootstrap.Modal.getInstance(modalEl);
    modal.hide();
    
    // LIMPIAR FORMULARIO
    document.getElementById('checkCredito').checked = false;
    document.getElementById('venta-gastos').value = 0;
    toggleCredito(); 

    // --- EN LUGAR DE ALERT, MOSTRAMOS EL TICKET ---
    // Preparamos los datos para el ticket
    const itemsTicket = [{ producto: producto.nombre, precio: precioFinal }];
    
    generarTicket(itemsTicket, precioFinal, esCredito ? nombreCliente : (producto.cliente || 'Mostrador'), esCredito, anticipo);
    
    // alert("Venta exitosa"); // <--- BORRA O COMENTA ESTA LÍNEA
}

// 3. ABRIR MODAL PARA EDITAR
function editarProducto(index) {
    const productos = JSON.parse(localStorage.getItem(DB_KEY)) || [];
    const prod = productos[index];

    // Marcar que estamos editando este índice
    indiceEdicion = index;

    // Llenar el formulario con los datos existentes
    document.getElementById('inputNombre').value = prod.nombre;
    document.getElementById('inputMarca').value = prod.marca;
    document.getElementById('inputSku').value = prod.sku;
    document.getElementById('inputCosto').value = prod.costo;
    document.getElementById('inputPrecio').value = prod.precioVenta;
    document.getElementById('inputInversion').value = prod.inversion; 
    
    document.getElementById('inputDestino').value = prod.destino || 'stock'; 
    document.getElementById('inputCliente').value = prod.cliente || '';

    // --- CARGAR UBICACIÓN ---
    document.getElementById('inputUbicacion').value = prod.ubicacion || 'en_inventario';
    // ------------------------

    // --- CORRECCIÓN: CARGAR LA URL DE LA IMAGEN ---
    document.getElementById('inputImagen').value = prod.imagen || ''; 

    // Cambiar textos del modal
    document.querySelector('#modalNuevoPerfume .modal-title').innerText = "Editar Perfume";
    const btnGuardar = document.querySelector('#modalNuevoPerfume .modal-footer .btn-primary');
    btnGuardar.innerText = "Guardar Cambios";
    btnGuardar.onclick = guardarCambiosEdicion; 

    // Abrir el modal
    const modal = new bootstrap.Modal(document.getElementById('modalNuevoPerfume'));
    modal.show();
}

// 4. GUARDAR LOS CAMBIOS EDITADOS
function guardarCambiosEdicion() {
    if (indiceEdicion === null) return;

    const productos = JSON.parse(localStorage.getItem(DB_KEY)) || [];
    
    // Actualizamos los campos
    productos[indiceEdicion].nombre = document.getElementById('inputNombre').value;
    productos[indiceEdicion].marca = document.getElementById('inputMarca').value;
    productos[indiceEdicion].sku = document.getElementById('inputSku').value;
    productos[indiceEdicion].costo = parseFloat(document.getElementById('inputCosto').value);
    productos[indiceEdicion].precioVenta = parseFloat(document.getElementById('inputPrecio').value);
    productos[indiceEdicion].inversion = document.getElementById('inputInversion').value;

    productos[indiceEdicion].destino = document.getElementById('inputDestino').value;
    productos[indiceEdicion].cliente = document.getElementById('inputCliente').value;

    // --- GUARDAR UBICACIÓN EDITADA ---
    productos[indiceEdicion].ubicacion = document.getElementById('inputUbicacion').value;
    // ---------------------------------

    // --- CORRECCIÓN: GUARDAR LA URL DE LA IMAGEN ---
    // Si lo dejan vacío, ponemos el icono por defecto para que no se rompa el diseño
    const imgUrl = document.getElementById('inputImagen').value;
    productos[indiceEdicion].imagen = imgUrl || 'https://cdn-icons-png.flaticon.com/512/2636/2636280.png';

    localStorage.setItem(DB_KEY, JSON.stringify(productos));

    // Resetear UI
    const modalEl = document.getElementById('modalNuevoPerfume');
    const modal = bootstrap.Modal.getInstance(modalEl);
    modal.hide();
    
    restaurarModalNuevo();
    cargarInventario();
    
    // Mensaje opcional
    // alert("✅ Perfume actualizado con foto.");
}

// Función auxiliar para dejar el modal limpio otra vez
function restaurarModalNuevo() {
    document.getElementById('form-nuevo-perfume').reset();
    indiceEdicion = null;
    document.querySelector('#modalNuevoPerfume .modal-title').innerText = "Registrar Perfume";
    const btnGuardar = document.querySelector('#modalNuevoPerfume .modal-footer .btn-primary');
    btnGuardar.innerText = "Guardar Perfume";
    btnGuardar.onclick = guardarProducto; // Volver a la función original
}

// assets/js/app.js - Versión Estética Limpia

// assets/js/app.js

function cambiarOrden(campo) {
    // Si ya estamos ordenando por este campo, invertimos la dirección
    if (ordenActual.campo === campo) {
        ordenActual.dir = (ordenActual.dir === 'asc') ? 'desc' : 'asc';
    } else {
        // Si es campo nuevo, empezamos ascendente (o descendente si es precio/ganancia para ver lo mejor arriba)
        ordenActual.campo = campo;
        ordenActual.dir = (campo === 'precio' || campo === 'ganancia') ? 'desc' : 'asc';
    }
    cargarInventario(); // Recargar tabla con el nuevo orden
}

function cargarInventario() {
    const tableBody = document.getElementById('inventory-table-body');
    const emptyMsg = document.getElementById('empty-msg');
    const contadorLabel = document.getElementById('contador-visible');
    const productos = JSON.parse(localStorage.getItem(DB_KEY)) || [];
    
    tableBody.innerHTML = '';

    // --- PASO 1: FILTRAR ---
    // Leemos los valores de los selects (HTML)
    const filtroProp = document.getElementById('filtroPropiedad') ? document.getElementById('filtroPropiedad').value : 'todos';
    const filtroDest = document.getElementById('filtroDestino') ? document.getElementById('filtroDestino').value : 'todos';
    const busqueda = document.getElementById('buscador') ? document.getElementById('buscador').value.toLowerCase() : '';

    let filtrados = productos.filter(p => {
        // 1. Filtro Texto (Buscador)
        const textoMatch = p.nombre.toLowerCase().includes(busqueda) || 
                           p.marca.toLowerCase().includes(busqueda) || 
                           p.sku.toLowerCase().includes(busqueda);
        
        // 2. Filtro Propiedad
        let propMatch = true;
        if (filtroProp !== 'todos') propMatch = (p.inversion === filtroProp);
        
        // 3. Filtro Destino
        let destMatch = true;
        if (filtroDest === 'todos') {
            destMatch = true;
        } else if (filtroDest === 'stock') {
            // Es stock si NO es pedido y YA llegó
            destMatch = (p.destino === 'stock' && p.ubicacion !== 'en_camino');
        } else if (filtroDest === 'pedido') {
            destMatch = (p.destino === 'pedido');
        } else if (filtroDest === 'en_camino') {
            // NUEVO FILTRO
            destMatch = (p.ubicacion === 'en_camino');
        }

        return textoMatch && propMatch && destMatch;
    });

    // Actualizar contador visual
    if (contadorLabel) contadorLabel.innerText = filtrados.length;

    if (filtrados.length === 0) {
        if (emptyMsg) emptyMsg.style.display = 'block';
        return;
    }
    if (emptyMsg) emptyMsg.style.display = 'none';

    // --- PASO 2: AGRUPAR ---
    const grupos = {};
    filtrados.forEach((prod, index) => {
        // Necesitamos encontrar el índice real en la DB original para los botones de editar/borrar
        // Buscamos el objeto original en el array "productos" para obtener su índice real
        const realIndex = productos.findIndex(p => p.id === prod.id); 
        prod.originalIndex = realIndex; 
        
        const nombreLimpio = prod.nombre.trim(); 
        if (!grupos[nombreLimpio]) grupos[nombreLimpio] = [];
        grupos[nombreLimpio].push(prod);
    });

    // --- PASO 3: CONVERTIR A LISTA PARA ORDENAR ---
    let listaGrupos = Object.keys(grupos).map(nombre => {
        return {
            nombre: nombre,
            items: grupos[nombre],
            principal: grupos[nombre][0], // Usamos el primero como representante
            totalStock: grupos[nombre].length,
            // Calculamos datos para ordenar
            precioRef: grupos[nombre][0].precioVenta,
            gananciaRef: grupos[nombre][0].precioVenta - grupos[nombre][0].costo
        };
    });

    // --- PASO 4: ORDENAR ---
    listaGrupos.sort((a, b) => {
        let valA, valB;

        if (ordenActual.campo === 'nombre') {
            valA = a.nombre.toLowerCase();
            valB = b.nombre.toLowerCase();
        } else if (ordenActual.campo === 'precio') {
            valA = a.precioRef;
            valB = b.precioRef;
        } else if (ordenActual.campo === 'ganancia') {
            valA = a.gananciaRef;
            valB = b.gananciaRef;
        }

        if (valA < valB) return ordenActual.dir === 'asc' ? -1 : 1;
        if (valA > valB) return ordenActual.dir === 'asc' ? 1 : -1;
        return 0;
    });

    // --- PASO 5: DIBUJAR (RENDER) ---
    listaGrupos.forEach(grupo => {
        const items = grupo.items; 
        const principal = grupo.principal;   

        // CASO A: SOLO UNO
        if (items.length === 1) {
            tableBody.innerHTML += renderFila(items[0], items[0].originalIndex);
        } 
        // CASO B: GRUPO
        else {
            const accordionId = `grupo-${grupo.nombre.replace(/[^a-zA-Z0-9]/g, '-')}-${Date.now()}`; 
            const imgUrl = principal.imagen || 'https://cdn-icons-png.flaticon.com/512/2636/2636280.png';
            const ganancia = principal.precioVenta - principal.costo;

            const filaPadre = `
                <tr class="align-middle fw-bold table-group-header">
                    <td><span class="badge bg-dark">LOTE (${grupo.totalStock})</span></td>
                    <td>
                        <div class="d-flex align-items-center">
                            <img src="${imgUrl}" class="img-thumb-mini js-preview-trigger" data-large-src="${imgUrl}">
                            <div>
                                ${principal.nombre}
                                <div class="small text-muted fw-normal">${principal.marca}</div>
                            </div>
                        </div>
                    </td>
                    <td class="text-muted fw-normal fst-italic">Varios</td>
                    <td class="text-muted fw-normal fst-italic">Varios</td>
                    <td class="text-muted fw-normal fst-italic">Varios</td> <td>$${principal.precioVenta}</td>
                    <td class="text-success">+$${ganancia}</td>
                    <td class="text-center">${grupo.totalStock} Unid.</td>
                    <td>
                        <button class="btn btn-sm btn-outline-dark w-100" type="button" 
                                data-bs-toggle="collapse" data-bs-target="#${accordionId}">
                            Ver ${grupo.totalStock} 🔽
                        </button>
                    </td>
                </tr>
                
                <tr>
                    <td colspan="9" class="p-0 border-0">
                        <div class="collapse" id="${accordionId}">
                            <table class="table table-sm mb-0 align-middle bg-white" style="table-layout: fixed; width: 100%;">
                                <tbody class="border-start border-4 border-warning"> ${items.map(item => renderFilaHija(item, item.originalIndex)).join('')}
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

    // LÓGICA DEL BADGE DE UBICACIÓN
    let badgeUbicacion = '<span class="badge bg-success bg-opacity-10 text-success border border-success">✅ En Mano</span>';
    let botonRecibir = ''; // Botón extra si está en camino

    if (prod.ubicacion === 'en_camino') {
        badgeUbicacion = '<span class="badge bg-warning text-dark border border-dark animation-blink">🚚 En Camino</span>';
        // Agregamos un botón pequeño para "Recibir" rápido
        botonRecibir = `
            <button class="btn btn-sm btn-outline-dark ms-1" onclick="marcarComoRecibido(${index})" title="¡Ya llegó! Marcar como Recibido">
                📥
            </button>
        `;
    }

    return `
        <tr ${prod.ubicacion === 'en_camino' ? 'class="table-warning"' : ''}>
            <td><span class="badge bg-secondary">${prod.sku}</span></td>
            <td>
                <div class="d-flex align-items-center">
                    <img src="${imgSegura}" class="img-thumb-mini js-preview-trigger" data-large-src="${imgSegura}">
                    <div>
                        <strong>${prod.nombre}</strong><br>
                        <small class="text-muted">${prod.marca}</small>
                    </div>
                </div>
            </td>
            <td>${getBadgeInversion(prod.inversion)}</td>
            <td>${getBadgeDestino(prod)}</td>
            
            <td>
                ${badgeUbicacion}
                ${botonRecibir}
            </td>

            <td>$${prod.precioVenta}</td>
            <td class="fw-bold text-success">+$${ganancia}</td>
            <td>1 Unid.</td>
            <td>${getBotonesAccion(index)}</td>
        </tr>
    `;
}

// RENDER FILA HIJA (Diseño limpio, alineado)
function renderFilaHija(prod, index) {
    const ganancia = prod.precioVenta - prod.costo;
    const imgSegura = prod.imagen || 'https://cdn-icons-png.flaticon.com/512/2636/2636280.png';

    // 1. CONFIGURACIÓN VISUAL SEGÚN ESTADO
    let claseFila = 'bg-white'; // Fondo normal blanco
    let badgeUbicacion = '<span class="badge border border-success text-success bg-light">En Mano</span>';
    let botonRecibir = '';

    // Si viene en camino: Fila Amarilla + Badge Amarillo + Botón
    if (prod.ubicacion === 'en_camino') {
        claseFila = 'table-warning'; // Amarillo Bootstrap
        badgeUbicacion = '<span class="badge bg-warning text-dark border border-dark">🚚 En Camino</span>';
        
        // Botón pequeño para recibir
        botonRecibir = `
            <button class="btn btn-dark btn-sm ms-1 px-2 py-0" onclick="marcarComoRecibido(${index})" title="Marcar como Recibido" style="font-size: 10px;">
                📥
            </button>`;
    }

    // 2. RENDERIZADO (Usando tus colores originales)
    // Nota: Agregamos la clase 'badge-multiline' a las celdas de badges para que el CSS permita 2 líneas.
    return `
        <tr class="${claseFila}" style="border-bottom: 1px solid #eee;">
            
            <td style="width: 10%; padding-left: 20px; vertical-align: middle;">
                <small class="text-muted me-1">↳</small> 
                <span class="badge bg-light text-dark border border-secondary text-truncate" style="max-width: 100%;">${prod.sku}</span>
            </td>
            
            <td style="width: 20%; vertical-align: middle;">
                <div class="d-flex align-items-center">
                    <img src="${imgSegura}" class="img-thumb-mini rounded-circle border js-preview-trigger" data-large-src="${imgSegura}" style="width: 28px; height: 28px; min-width: 28px; object-fit: cover;">
                    <div class="ms-2 text-truncate">
                        <span class="fw-bold text-dark small">${prod.nombre}</span>
                    </div>
                </div>
            </td>

            <td style="width: 10%; vertical-align: middle;" class="badge-multiline">
                ${getBadgeInversion(prod.inversion)}
            </td>
            
            <td style="width: 10%; vertical-align: middle;" class="badge-multiline">
                ${getBadgeDestino(prod)}
            </td>
            
            <td style="width: 12%; vertical-align: middle;">
                <div class="d-flex align-items-center justify-content-center">
                    ${badgeUbicacion}
                    ${botonRecibir}
                </div>
            </td>

            <td style="width: 8%; vertical-align: middle;" class="text-muted small fw-bold">$${prod.precioVenta}</td>
            <td style="width: 8%; vertical-align: middle;" class="text-success fw-bold small">+$${ganancia}</td>
            <td style="width: 7%; vertical-align: middle;" class="text-center small text-muted">1</td>
            
            <td style="width: 15%; vertical-align: middle;">
                <div class="d-flex gap-1 justify-content-start">
                    <button class="btn btn-outline-primary btn-sm py-0 px-2" onclick="agregarAlCarrito(${index})" title="Carrito">🛒</button>
                    <button class="btn btn-primary btn-sm py-0 px-2" onclick="editarProducto(${index})" title="Editar">✏️</button>
                    <button class="btn btn-success btn-sm py-0 px-2" onclick="iniciarVenta(${index})" title="Vender">$</button>
                    <button class="btn btn-danger btn-sm py-0 px-2" onclick="eliminarProducto(${index})" title="Borrar">🗑️</button>
                </div>
            </td>
        </tr>
    `;
}
// --- TUS HELPERS ORIGINALES (Sin cambios) ---
function getBadgeInversion(tipo) {
    if (tipo === 'mio') return '<span class="badge bg-primary">Solo Mío</span>';
    if (tipo === 'socio') return '<span class="badge bg-warning text-dark">Solo Socio</span>'; // Corregí color a amarillo/negro
    if (tipo === 'mitad') return '<span class="badge bg-warning text-dark">50 / 50</span>';
    return '<span class="badge bg-secondary">Otro</span>';
}

function getBadgeDestino(prod) {
    if (prod.destino === 'pedido') {
        return `<span class="badge border border-danger text-danger">👤 ${prod.cliente || 'Pedido'}</span>`;
    }
    return '<span class="badge border border-secondary text-secondary bg-light">🏠 Stock</span>';
}

function getBotonesAccion(index) {
    return `
        <div class="btn-group">
            <button class="btn btn-sm btn-outline-primary fw-bold" onclick="agregarAlCarrito(${index})" title="Agregar al Carrito">
                🛒+
            </button>
            
            <button class="btn btn-sm btn-primary" onclick="editarProducto(${index})" title="Editar">✏️</button>
            <button class="btn btn-sm btn-success" onclick="iniciarVenta(${index})" title="Venta Directa">💲</button>
            <button class="btn btn-sm btn-danger" onclick="eliminarProducto(${index})" title="Borrar">🗑️</button>
        </div>
    `;
}

// FUNCIÓN AUXILIAR PARA DIBUJAR UNA FILA (Para no repetir código)
// function renderFila(prod, index, esHijo) {
//     // Etiquetas de colores para Inversión
//     let badgeInv = '';
//     if (prod.inversion === 'mio') badgeInv = '<span class="badge bg-primary">Solo Mío</span>';
//     else if (prod.inversion === 'socio') badgeInv = '<span class="badge bg-info text-dark">Solo Socio</span>';
//     else if (prod.inversion === 'mitad') badgeInv = '<span class="badge bg-warning text-dark">50 / 50</span>';
//     else badgeInv = '<span class="badge bg-secondary">Otro %</span>';

//     // Etiquetas de Destino (Cliente vs Stock)
//     let badgeDestino = '';
//     if (prod.destino === 'pedido') {
//         badgeDestino = `<span class="badge border border-danger text-danger">👤 Pedido: ${prod.cliente || '?'}</span>`;
//     } else {
//         badgeDestino = '<span class="badge border border-secondary text-secondary">🏠 Stock</span>';
//     }

//     // Estilo visual si es fila hija (dentro del grupo)
//     const estiloFila = esHijo ? 'style="background-color: #f8f9fa;"' : '';
//     const icono = esHijo ? '↳' : '';

//     return `
//         <tr ${estiloFila}>
//             <td class="text-muted small">${esHijo ? '' : prod.sku}</td>
//             <td>
//                 ${icono} <strong>${prod.nombre}</strong>
//                 <div class="small text-muted">${prod.marca}</div>
//             </td>
//             <td>${badgeInv}</td>
//             <td>${badgeDestino}</td>
//             <td>$${prod.precioVenta}</td>
//             <td>1</td> <td>
//                 <div class="btn-group">
//                     <button class="btn btn-sm btn-primary" onclick="editarProducto(${index})">✏️</button>
//                     <button class="btn btn-sm btn-success" onclick="iniciarVenta(${index})">💲</button>
//                     <button class="btn btn-sm btn-danger" onclick="eliminarProducto(${index})">🗑️</button>
//                 </div>
//             </td>
//         </tr>
//     `;
// }

function guardarProducto() {
    // 1. CAPTURAR TODOS LOS DATOS DEL HTML
    const nombre = document.getElementById('inputNombre').value;
    const marca = document.getElementById('inputMarca').value;
    let sku = document.getElementById('inputSku').value;
    const costo = document.getElementById('inputCosto').value;
    const precio = document.getElementById('inputPrecio').value;
    const imagenUrl = document.getElementById('inputImagen').value || 'https://cdn-icons-png.flaticon.com/512/2636/2636280.png'; // Icono default
    
    // Captura de Inversión y Porcentaje
    const inversion = document.getElementById('inputInversion').value;
    let porcentajeSocioCustom = 0;
    if (inversion === 'personalizado') {
        porcentajeSocioCustom = parseFloat(document.getElementById('inputPorcentajeSocio').value) || 0;
    }

    const esParaDecant = document.getElementById('checkDecants').checked;

    // --- AQUÍ ESTABA EL PROBLEMA DEL "STOCK" ---
    // Debemos leer explícitamente el destino y el cliente
    const destinoElement = document.getElementById('inputDestino'); 
    const clienteElement = document.getElementById('inputCliente');

    // --- NUEVO: CAPTURAR UBICACIÓN ---
    const ubicacion = document.getElementById('inputUbicacion').value;
    // ---------------------------------
    
    // (Uso el operador || 'stock' por seguridad si el campo no existiera)
    const destino = destinoElement ? destinoElement.value : 'stock'; 
    const cliente = clienteElement ? clienteElement.value : '';

    // VALIDACIÓN BÁSICA
    if (!nombre || !costo || !precio) {
        alert("Por favor llena los campos obligatorios (Nombre, Costo, Precio)");
        return;
    }

    if (!sku) {
        sku = 'SKU-' + Math.floor(Math.random() * 10000);
    }

    // 2. CREAR EL OBJETO PERFUME
    const nuevoPerfume = {
        id: Date.now(),
        nombre: nombre,
        marca: marca,
        sku: sku,
        costo: parseFloat(costo),
        precioVenta: parseFloat(precio),
        esParaDecant: esParaDecant,
        inversion: inversion,

        destino: destino, 
        cliente: cliente,
        ubicacion: ubicacion,
        imagen: imagenUrl,

        fechaRegistro: new Date().toISOString()
    };

    // 3. GUARDAR EN MEMORIA (LocalStorage)
    const productos = JSON.parse(localStorage.getItem(DB_KEY)) || [];
    productos.push(nuevoPerfume);
    localStorage.setItem(DB_KEY, JSON.stringify(productos));

    // 4. LIMPIEZA Y CIERRE (Corrección del error aria-hidden)
    
    // Truco: Quitamos el foco del botón antes de ocultar el modal
    if (document.activeElement) {
        document.activeElement.blur();
    }

    const modalEl = document.getElementById('modalNuevoPerfume');
    const modal = bootstrap.Modal.getInstance(modalEl);
    modal.hide();

    // Limpiar formulario para el siguiente
    document.getElementById('form-nuevo-perfume').reset();
    
    // Ocultar campo personalizado por si acaso quedó abierto
    const divPers = document.getElementById('divPersonalizado');
    if(divPers) divPers.style.display = 'none';
    
    // Recargar tabla visualmente
    cargarInventario();
    
    // Mensaje de éxito sutil (opcional, puedes quitar el alert si te molesta)
    // alert("¡Perfume guardado correctamente!");
}

function eliminarProducto(index) {
    // REEMPLAZAMOS EL CONFIRM SIMPLE POR EL PIN
    if (!solicitarPin()) return; 

    const productos = JSON.parse(localStorage.getItem(DB_KEY)) || [];
    productos.splice(index, 1); 
    localStorage.setItem(DB_KEY, JSON.stringify(productos)); 
    cargarInventario(); 
}

// --- FUNCIONES DE RESPALDO (BACKUP) ---

// 1. DESCARGAR: Crea un archivo .json con tus datos actuales
function descargarRespaldo() {
    const productos = localStorage.getItem(DB_KEY);
    
    if (!productos || productos === '[]') {
        alert("No hay datos para respaldar todavía.");
        return;
    }

    // Crear un "blob" (un archivo virtual en memoria)
    const blob = new Blob([productos], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    
    // Crear un enlace temporal para forzar la descarga
    const a = document.createElement('a');
    a.href = url;
    // El nombre del archivo tendrá la fecha de hoy
    const fecha = new Date().toISOString().slice(0,10);
    a.download = `respaldo_perfumes_${fecha}.json`; 
    
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    
    alert("✅ Archivo descargado. Guárdalo en una carpeta segura.");
}

// 2. SUBIR: Lee un archivo .json y restaura los datos
function cargarRespaldo(input) {
    const archivo = input.files[0];
    if (!archivo) return;

    const lector = new FileReader();
    lector.onload = function(e) {
        try {
            const datos = JSON.parse(e.target.result);

            // CASO 1: Respaldo Nuevo (Objeto con inventory, sales, etc.)
            if (datos.inventory && Array.isArray(datos.inventory)) {
                if(confirm(`⚠️ ESTO ES UN RESPALDO COMPLETO.\n\nSe restaurarán:\n- ${datos.inventory.length} Perfumes\n- ${datos.sales.length || 0} Ventas\n- Historial de Pagos\n\n¿Deseas reemplazar todo lo actual?`)) {
                    localStorage.setItem(DB_KEY, JSON.stringify(datos.inventory));
                    localStorage.setItem(SALES_KEY, JSON.stringify(datos.sales || []));
                    localStorage.setItem('perfume_payouts_v1', JSON.stringify(datos.payouts || []));
                    
                    alert("✅ Sistema restaurado al 100%.");
                    location.reload(); // Recargar para ver cambios
                }
            } 
            // CASO 2: Respaldo Antiguo (Solo array de perfumes)
            else if (Array.isArray(datos)) {
                 if(confirm(`⚠️ Este archivo parece ser solo de INVENTARIO (${datos.length} productos).\nSi lo cargas, NO recuperarás ventas ni deudas.\n¿Continuar?`)) {
                    localStorage.setItem(DB_KEY, JSON.stringify(datos));
                    cargarInventario();
                    alert("✅ Inventario importado.");
                 }
            } else {
                throw new Error("Formato desconocido");
            }
        } catch (error) {
            alert("❌ Error: Archivo inválido.");
            console.error(error);
        }
    };
    lector.readAsText(archivo);
    input.value = ''; 
}

// --- LÓGICA DE VENTAS ---

// Clave para guardar el historial de dinero
const SALES_KEY = 'perfume_sales_v1';

function venderProducto(index) {
    const productos = JSON.parse(localStorage.getItem(DB_KEY)) || [];
    const producto = productos[index];

    // Confirmación simple (luego podemos hacer un modal más bonito)
    const confirmo = confirm(`¿Confirmar venta de "${producto.nombre}" por $${producto.precioVenta}?`);
    if (!confirmo) return;

    // 1. Calcular Finanzas
    const precioFinal = producto.precioVenta; 
    const costo = producto.costo;
    const utilidad = precioFinal - costo;
    
    // 2. Reparto de Utilidades (Lógica de Socio)
    let gananciaMia = 0;
    let gananciaSocio = 0;

    if (producto.inversion === 'mio') {
        gananciaMia = utilidad;
    } else if (producto.inversion === 'socio') {
        gananciaSocio = utilidad;
    } else if (producto.inversion === 'mitad') {
        gananciaMia = utilidad / 2;
        gananciaSocio = utilidad / 2;
    }

    // 3. Crear Registro de Venta
    const nuevaVenta = {
        id: Date.now(),
        producto: producto.nombre,
        sku: producto.sku,
        precioCobrado: precioFinal,
        costoOriginal: costo,
        utilidadNeta: utilidad,
        reparto: {
            yo: gananciaMia,
            socio: gananciaSocio
        },
        fechaVenta: new Date().toISOString(),
        tipo: 'Botella Cerrada' // Hardcodeado por ahora
    };

    // 4. Guardar en Historial de Ventas
    const historialVentas = JSON.parse(localStorage.getItem(SALES_KEY)) || [];
    historialVentas.push(nuevaVenta);
    localStorage.setItem(SALES_KEY, JSON.stringify(historialVentas));

    // 5. Eliminar del Inventario (Asumiendo stock 1 por ahora)
    // Nota: Si quieres manejar stock > 1, aquí solo restaríamos cantidad.
    // Como vendes botellas únicas por ahora, lo borramos.
    productos.splice(index, 1);
    localStorage.setItem(DB_KEY, JSON.stringify(productos));

    // 6. Refrescar pantalla
    cargarInventario();
    alert(`¡Venta registrada! Ganancia: $${utilidad} (Tú: $${gananciaMia} | Socio: $${gananciaSocio})`);
}

function togglePersonalizado() {
    const tipo = document.getElementById('inputInversion').value;
    const div = document.getElementById('divPersonalizado');
    if (tipo === 'personalizado') {
        div.style.display = 'block';
    } else {
        div.style.display = 'none';
    }
}
const modales = document.querySelectorAll('.modal');

modales.forEach(modal => {
    modal.addEventListener('hide.bs.modal', function () {
        if (document.activeElement) {
            document.activeElement.blur(); // Le quita la selección al botón que pulsaste (la X)
        }
    });
});

function toggleCredito() {
    const check = document.getElementById('checkCredito');
    const bloque = document.getElementById('bloque-credito');
    const inputCliente = document.getElementById('venta-cliente');
    
    // Si el switch está encendido, mostramos el bloque. Si no, lo ocultamos.
    if (check && check.checked) {
        bloque.style.display = 'block';

        // --- LÓGICA INTELIGENTE ---
        // Recuperamos el dueño que guardamos en iniciarVenta
        const dueno = inputCliente.dataset.duenoOriginal;
        
        if (dueno && dueno !== '') {
            // Si el perfume YA tiene dueño, lo escribimos automáticamente
            inputCliente.value = dueno;
            // Opcional: Agregamos una clase visual para indicar que es automático
            inputCliente.classList.add('bg-warning', 'bg-opacity-10'); 
        } else {
            // Si es STOCK (no tiene dueño), lo dejamos vacío para escribir
            // (Solo limpiamos si el campo estaba vacío o tenía basura, para no borrar lo que escribas)
            if (!inputCliente.value) inputCliente.value = '';
            inputCliente.classList.remove('bg-warning', 'bg-opacity-10');
        }

    } else {
        // Si el switch se apaga
        bloque.style.display = 'none';
        
        // Limpiamos campos visuales, pero el dataset.duenoOriginal sigue guardado en memoria por si vuelves a activar
        inputCliente.value = ''; 
        document.getElementById('venta-anticipo').value = 0;
        calcularRestante(); 
    }
}

// 2. Calcular en vivo cuánto falta por pagar
// (Agregamos los "escuchadores" para que calculen mientras escribes)
const inputPrecioFinal = document.getElementById('venta-precio-final');
const inputAnticipo = document.getElementById('venta-anticipo');

if (inputPrecioFinal) inputPrecioFinal.addEventListener('input', calcularRestante);
if (inputAnticipo) inputAnticipo.addEventListener('input', calcularRestante);

function calcularRestante() {
    const precio = parseFloat(document.getElementById('venta-precio-final').value) || 0;
    const anticipo = parseFloat(document.getElementById('venta-anticipo').value) || 0;
    
    const restante = precio - anticipo;
    const texto = document.getElementById('texto-restante');
    
    if (texto) {
        texto.innerText = `Resta por cobrar: $${restante.toFixed(2)}`;
        
        // Lógica visual: Rojo si debe, Verde si liquidó
        if (restante > 0) {
            texto.className = "form-text text-danger fw-bold mt-1";
        } else {
            texto.className = "form-text text-success fw-bold mt-1";
            if(document.getElementById('checkCredito').checked) {
                texto.innerText = "¡Liquidado! (Cobro total)";
            }
        }
    }
}

function filtrarTabla() {
    const busqueda = document.getElementById('buscador').value.toLowerCase();
    const filas = document.querySelectorAll('#inventory-table-body tr'); // Busca en las filas

    filas.forEach(fila => {
        // Ignorar filas de detalles ocultos (los acordeones hijos)
        if (fila.closest('.collapse')) return;

        const texto = fila.innerText.toLowerCase();
        if (texto.includes(busqueda)) {
            fila.style.display = '';
        } else {
            fila.style.display = 'none';
        }
    });
}

// --- FUNCIÓN EXPORTAR A EXCEL (CSV) ---
function exportarExcel() {
    const productos = JSON.parse(localStorage.getItem(DB_KEY)) || [];
    
    if (productos.length === 0) return alert("Nada que exportar.");

    // 1. Crear encabezados
    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "SKU,Producto,Marca,Costo,Precio Venta,Inversion,Destino\n"; // Encabezados

    // 2. Recorrer datos y convertir a texto separado por comas
    productos.forEach(p => {
        // Limpiamos comas dentro de los nombres para no romper el CSV
        const nombreLimpio = p.nombre.replace(/,/g, " "); 
        const fila = `${p.sku},${nombreLimpio},${p.marca},${p.costo},${p.precioVenta},${p.inversion},${p.destino}`;
        csvContent += fila + "\n";
    });

    // 3. Descargar
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    const fecha = new Date().toISOString().slice(0,10);
    link.setAttribute("download", `Inventario_Excel_${fecha}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// --- LÓGICA DE PREVISUALIZACIÓN DE IMAGEN (HOVER) ---

// Usamos "delegación de eventos" porque las filas de la tabla se crean dinámicamente.
// Esto significa que escuchamos en toda la tabla por si el mouse toca una imagen.

const tablaInventario = document.getElementById('inventory-table-body');
const popup = document.getElementById('image-preview-popup');
const popupImg = popup.querySelector('img');

// 1. CUANDO EL MOUSE ENTRA A UNA MINIATURA
tablaInventario.addEventListener('mouseover', function(e) {
    // Verificamos si lo que tocamos es una miniatura con la clase activadora
    if (e.target.classList.contains('js-preview-trigger')) {
        const largeSrc = e.target.getAttribute('data-large-src');
        
        if (largeSrc) {
            popupImg.src = largeSrc; // Cargamos la foto grande en el popup
            popup.style.display = 'block'; // Mostramos el popup
        }
    }
});

// 2. CUANDO EL MOUSE SE MUEVE (LÓGICA INTELIGENTE)
tablaInventario.addEventListener('mousemove', function(e) {
    if (popup.style.display === 'block') {
        const offset = 20; // Separación del mouse
        const popupHeight = 280; // Altura estimada de la imagen (250px + bordes)
        const windowHeight = window.innerHeight; // Altura de tu pantalla visible

        let topPosition = e.clientY + offset; // Por defecto: Abajo del mouse

        // CÁLCULO INTELIGENTE:
        // Si la posición de abajo + la altura de la foto se salen de la pantalla...
        if (topPosition + popupHeight > windowHeight) {
            // ...entonces la ponemos ARRIBA del mouse
            topPosition = e.clientY - popupHeight - offset;
        }

        popup.style.top = topPosition + 'px';
        popup.style.left = (e.clientX + offset) + 'px';
    }
});

// 3. CUANDO EL MOUSE SALE DE LA MINIATURA
tablaInventario.addEventListener('mouseout', function(e) {
    if (e.target.classList.contains('js-preview-trigger')) {
        popup.style.display = 'none'; // Ocultamos el popup
    }
});

const ADMIN_PIN = "0525"; // <--- CAMBIA ESTO POR TU CLAVE SECRETA

function solicitarPin() {
    const intento = prompt("🔐 SEGURIDAD: Ingrese el PIN de Administrador para confirmar:");
    if (intento === ADMIN_PIN) {
        return true; // Acceso concedido
    } else {
        alert("❌ PIN Incorrecto. No se borró nada.");
        return false; // Acceso denegado
    }
}

// ==========================================
// 🛒 LÓGICA DEL CARRITO DE COMPRAS (POS)
// ==========================================

let carrito = []; // Aquí guardaremos los productos temporales

// 1. Agregar producto al array
function agregarAlCarrito(index) {
    const productos = JSON.parse(localStorage.getItem(DB_KEY)) || [];
    const prod = productos[index];

    // Verificar si ya está en el carrito (por ID o SKU)
    const existe = carrito.find(item => item.id === prod.id);
    if (existe) {
        alert("⚠️ Este producto único ya está en el carrito.");
        return;
    }

    // Agregamos al carrito temporal (guardamos el índice original para borrarlo después)
    carrito.push({
        ...prod,
        originalIndex: index
    });

    actualizarBarraCarrito();
}

// 2. Actualizar la barra visual inferior
function actualizarBarraCarrito() {
    const barra = document.getElementById('barra-carrito');
    const countEl = document.getElementById('cart-count');
    const totalEl = document.getElementById('cart-total');

    if (carrito.length > 0) {
        barra.style.display = 'block'; // Mostrar barra
        countEl.innerText = carrito.length;
        
        // Sumar total
        const total = carrito.reduce((sum, item) => sum + parseFloat(item.precioVenta), 0);
        totalEl.innerText = '$' + total.toLocaleString('es-MX', {minimumFractionDigits: 2});
    } else {
        barra.style.display = 'none'; // Ocultar si está vacío
    }
}

// 3. Abrir el Modal con la lista
// --- CÓDIGO CORREGIDO PARA EL CARRITO ---

// A. Función auxiliar SOLAMENTE para dibujar el HTML (No abre ventanas)
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
                    <div>
                        <div class="fw-bold">${prod.nombre}</div>
                        <small class="text-muted">${prod.marca}</small>
                    </div>
                </div>
                <span class="fw-bold">$${prod.precioVenta}</span>
            </li>
        `;
    });

    totalEl.innerText = '$' + total.toLocaleString('es-MX', {minimumFractionDigits: 2});
}

// 3. Abrir el Modal (Solo se llama al dar clic en el botón "Ver / Cobrar")
function abrirModalCarrito() {
    // Primero dibujamos los datos
    renderizarContenidoCarrito();

    // Luego mostramos la ventana de forma segura
    const modalEl = document.getElementById('modalCarrito');
    const modal = bootstrap.Modal.getOrCreateInstance(modalEl); // <--- ESTA ES LA CLAVE: Usa la instancia existente
    modal.show();
}

// 4. Quitar un item específico (CORREGIDO)
function quitarDelCarrito(carritoIndex) {
    carrito.splice(carritoIndex, 1);
    
    // Si quitamos el último, cerramos el modal limpiamente
    if (carrito.length === 0) {
        const modalEl = document.getElementById('modalCarrito');
        const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
        modal.hide();
    } else {
        // Si quedan productos, SOLO redibujamos la lista (No abrimos modal nuevo)
        renderizarContenidoCarrito();
    }
    
    // Actualizamos la barra negra de abajo
    actualizarBarraCarrito();
}

// 5. Vaciar todo (CORREGIDO)
function vaciarCarrito() {
    if(confirm("¿Vaciar el carrito?")) {
        carrito = [];
        actualizarBarraCarrito();
        
        const modalEl = document.getElementById('modalCarrito');
        const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
        modal.hide();
    }
}

// 6. PROCESAR VENTA MASIVA (CORREGIDO)
function procesarVentaMasiva() {
    if (carrito.length === 0) return;

    const esCredito = document.getElementById('checkCreditoCarrito').checked;
    const cliente = document.getElementById('inputClienteCarrito').value;

    if (esCredito && !cliente) {
        return alert("⚠️ Para venta a crédito, debes poner el nombre del cliente.");
    }

    if (!confirm(`¿Confirmar venta de ${carrito.length} perfumes?`)) return;

    // --- PROCESAR CADA ITEM ---
    const historialVentas = JSON.parse(localStorage.getItem(SALES_KEY)) || [];
    let productosDB = JSON.parse(localStorage.getItem(DB_KEY)) || [];

    // Preparamos IDs para borrar
    const idsEnCarrito = carrito.map(c => c.id);

    carrito.forEach(item => {
        // Calcular utilidad
        const costo = item.costo;
        const precio = item.precioVenta;
        const utilidad = precio - costo;

        // Reparto
        let gananciaMia = 0;
        let gananciaSocio = 0;

        if (item.inversion === 'mio') { gananciaMia = utilidad; }
        else if (item.inversion === 'socio') { gananciaSocio = utilidad; }
        else if (item.inversion === 'mitad') { gananciaMia = utilidad/2; gananciaSocio = utilidad/2; }
        else if (item.inversion === 'personalizado') {
            const factor = (item.porcentajeSocio || 0) / 100;
            gananciaSocio = utilidad * factor;
            gananciaMia = utilidad - gananciaSocio;
        }

        // Crear objeto venta
        const nuevaVenta = {
            id: Date.now() + Math.random(), 
            producto: item.nombre,
            marca: item.marca,
            imagen: item.imagen,
            sku: item.sku,
            costoOriginal: costo,
            precioFinal: precio,
            utilidad: utilidad,
            reparto: { yo: gananciaMia, socio: gananciaSocio },
            fecha: new Date().toLocaleString(),
            esCredito: esCredito,
            cliente: cliente || (item.cliente || 'Mostrador'),
            saldoPendiente: esCredito ? precio : 0,
            historialAbonos: []
        };
        historialVentas.push(nuevaVenta);
    });

    // --- BORRAR DEL INVENTARIO ---
    productosDB = productosDB.filter(p => !idsEnCarrito.includes(p.id));

    // GUARDAR TODO
    localStorage.setItem(SALES_KEY, JSON.stringify(historialVentas));
    localStorage.setItem(DB_KEY, JSON.stringify(productosDB));

    const itemsParaTicket = carrito.map(c => ({ producto: c.nombre, precio: c.precioVenta }));
    const totalTicket = carrito.reduce((sum, i) => sum + parseFloat(i.precioVenta), 0);
    
    carrito = []; // Ahora sí vaciamos
    actualizarBarraCarrito();
    
    // CERRAR MODAL CARRITO
    const modalEl = document.getElementById('modalCarrito');
    const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
    modal.hide();

    // --- LANZAR TICKET ---
    // Asumimos anticipo 0 en masivo si es crédito, o podrías calcularlo, pero simplifiquemos:
    const anticipo = 0; 
    
    generarTicket(itemsParaTicket, totalTicket, cliente, esCredito, anticipo);

    // alert("Venta Masiva Exitosa"); // <--- BORRA ESTA LÍNEA
}

// --- GENERADOR DE TICKETS ---
function generarTicket(items, total, cliente, esCredito, anticipo) {
    // 1. Llenar Encabezado
    document.getElementById('ticket-fecha').innerText = new Date().toLocaleString();
    document.getElementById('ticket-cliente').innerText = cliente || 'Mostrador';
    
    // 2. Estado del pago
    const estadoEl = document.getElementById('ticket-estado');
    const infoCredito = document.getElementById('ticket-credito-info');
    
    if (esCredito) {
        estadoEl.innerText = "PENDIENTE / CREDITO";
        estadoEl.style.color = "red";
        
        infoCredito.style.display = 'block';
        document.getElementById('ticket-acuenta').innerText = '$' + anticipo.toFixed(2);
        document.getElementById('ticket-resta').innerText = '$' + (total - anticipo).toFixed(2);
    } else {
        estadoEl.innerText = "PAGADO";
        estadoEl.style.color = "black";
        infoCredito.style.display = 'none';
    }

    // 3. Llenar Items
    const lista = document.getElementById('ticket-items');
    lista.innerHTML = ''; // Limpiar anterior
    
    items.forEach(item => {
        lista.innerHTML += `
            <div class="ticket-item">
                <span>1 x ${item.producto}</span>
                <span>$${item.precio}</span>
            </div>
        `;
    });

    // 4. Total
    document.getElementById('ticket-total-monto').innerText = '$' + total.toFixed(2);

    // 5. Mostrar Modal
    const modal = new bootstrap.Modal(document.getElementById('modalTicket'));
    modal.show();
}

function cerrarTicket() {
    const modalEl = document.getElementById('modalTicket');
    const modal = bootstrap.Modal.getInstance(modalEl);
    modal.hide();
    
    // Al cerrar el ticket, recargamos la página o el inventario para ver los cambios
    cargarInventario();
}

// Función rápida para cambiar de "En Camino" a "En Inventario"
function marcarComoRecibido(index) {
    const productos = JSON.parse(localStorage.getItem(DB_KEY)) || [];
    
    // Si es un índice de búsqueda/filtro, lo buscamos en el array original (esto ya lo manejamos con originalIndex en cargarInventario, asegúrate de pasar el índice correcto)
    // Para simplificar, asumimos que recibes el índice correcto.
    
    if(confirm("📦 ¿Confirmas que este perfume YA LLEGÓ a tus manos?")) {
        productos[index].ubicacion = 'en_inventario';
        localStorage.setItem(DB_KEY, JSON.stringify(productos));
        cargarInventario();
        // Efecto de celebración
        alert("🎉 ¡Excelente! Stock actualizado a disponible.");
    }
}