// =========================================================
// SISTEMA DE ALERTAS INTELIGENTES
// =========================================================

let alertasActivas = [];
let filtroAlertaActual = 'todas';

// =========================================================
// GENERADOR DE ALERTAS
// =========================================================

function generarAlertas() {
    alertasActivas = [];
    
    const productos = JSON.parse(localStorage.getItem(DB_KEY)) || [];
    const ventas = JSON.parse(localStorage.getItem(SALES_KEY)) || [];
    const gastos = JSON.parse(localStorage.getItem(EXPENSES_KEY)) || [];
    
    // 1. ALERTAS DE INVENTARIO
    generarAlertasInventario(productos, ventas);
    
    // 2. ALERTAS DE CLIENTES
    generarAlertasClientes(ventas);
    
    // 3. ALERTAS DE PAQUETERÍA
    generarAlertasPaqueteria(productos);
    
    // 4. ALERTAS FINANCIERAS
    generarAlertasFinancieras(ventas, gastos);
    
    // 5. ALERTAS DE STOCK CRÍTICO
    generarAlertasStockBajo(productos, ventas);
    
    // Renderizar
    renderAlertas();
    actualizarContadores();
}

// =========================================================
// 1. ALERTAS DE INVENTARIO
// =========================================================

function generarAlertasInventario(productos, ventas) {
    const ahora = new Date();
    
    productos.forEach(prod => {
        const fechaRegistro = new Date(prod.fechaRegistro);
        const diasEnStock = Math.floor((ahora - fechaRegistro) / (1000 * 60 * 60 * 24));
        
        // Capital muerto (más de 60 días sin vender)
        if (diasEnStock >= 60) {
            alertasActivas.push({
                id: `stock-${prod.id}`,
                tipo: 'importante',
                categoria: 'inventario',
                titulo: '⏰ Capital Muerto Detectado',
                mensaje: `"${prod.nombre}" lleva ${diasEnStock} días en inventario sin venderse. Capital inmovilizado: $${prod.costo}`,
                accion: {
                    texto: 'Ver Producto',
                    link: 'products.html'
                },
                fecha: ahora.toISOString(),
                datos: { productoId: prod.id }
            });
        }
        
        // Perfume de alto valor sin asegurar
        if (prod.precioVenta > 2000 && !prod.asegurado) {
            alertasActivas.push({
                id: `valor-alto-${prod.id}`,
                tipo: 'info',
                categoria: 'inventario',
                titulo: '💎 Perfume de Alto Valor',
                mensaje: `"${prod.nombre}" vale $${prod.precioVenta}. Considera asegurarlo o guardarlo en lugar seguro.`,
                accion: {
                    texto: 'Ver Detalles',
                    link: 'products.html'
                },
                fecha: ahora.toISOString(),
                datos: { productoId: prod.id }
            });
        }
    });
}

// =========================================================
// 2. ALERTAS DE CLIENTES
// =========================================================

function generarAlertasClientes(ventas) {
    const ahora = new Date();
    
    // Agrupar deudas por cliente
    const deudasPorCliente = {};
    
    ventas.forEach(venta => {
        if (venta.esCredito && venta.saldoPendiente > 0 && venta.cliente) {
            if (!deudasPorCliente[venta.cliente]) {
                deudasPorCliente[venta.cliente] = {
                    total: 0,
                    ventas: [],
                    fechaMasAntigua: new Date(venta.fecha)
                };
            }
            deudasPorCliente[venta.cliente].total += venta.saldoPendiente;
            deudasPorCliente[venta.cliente].ventas.push(venta);
            
            const fechaVenta = new Date(venta.fecha);
            if (fechaVenta < deudasPorCliente[venta.cliente].fechaMasAntigua) {
                deudasPorCliente[venta.cliente].fechaMasAntigua = fechaVenta;
            }
        }
    });
    
    // Generar alertas
    Object.keys(deudasPorCliente).forEach(cliente => {
        const info = deudasPorCliente[cliente];
        const diasDeuda = Math.floor((ahora - info.fechaMasAntigua) / (1000 * 60 * 60 * 24));
        
        // Deuda crítica (más de $1000 o más de 15 días)
        if (info.total > 1000 || diasDeuda > 15) {
            alertasActivas.push({
                id: `deuda-${cliente}`,
                tipo: 'critica',
                categoria: 'clientes',
                titulo: '🚨 Deuda Crítica',
                mensaje: `${cliente} debe $${info.total.toFixed(2)} desde hace ${diasDeuda} días. Total de ${info.ventas.length} venta(s) pendiente(s).`,
                accion: {
                    texto: 'Cobrar Ahora',
                    link: 'clientes.html'
                },
                fecha: ahora.toISOString(),
                datos: { cliente, totalDeuda: info.total, dias: diasDeuda }
            });
        }
        // Deuda importante (más de $500)
        else if (info.total > 500) {
            alertasActivas.push({
                id: `deuda-${cliente}`,
                tipo: 'importante',
                categoria: 'clientes',
                titulo: '⚠️ Deuda Significativa',
                mensaje: `${cliente} debe $${info.total.toFixed(2)}. Considera recordarle el pago.`,
                accion: {
                    texto: 'Ver Cliente',
                    link: 'clientes.html'
                },
                fecha: ahora.toISOString(),
                datos: { cliente, totalDeuda: info.total }
            });
        }
    });
}

// =========================================================
// 3. ALERTAS DE PAQUETERÍA
// =========================================================

function generarAlertasPaqueteria(productos) {
    const ahora = new Date();
    
    productos.forEach(prod => {
        if (prod.ubicacion === 'en_camino') {
            const fechaRegistro = new Date(prod.fechaRegistro);
            const diasEnCamino = Math.floor((ahora - fechaRegistro) / (1000 * 60 * 60 * 24));
            
            if (diasEnCamino >= 7) {
                alertasActivas.push({
                    id: `paquete-${prod.id}`,
                    tipo: 'critica',
                    categoria: 'paqueteria',
                    titulo: '📦 Paquete Retrasado',
                    mensaje: `"${prod.nombre}" lleva ${diasEnCamino} días "en camino". Verifica el estado del envío.`,
                    accion: {
                        texto: 'Ver Paquetes',
                        link: 'products.html'
                    },
                    fecha: ahora.toISOString(),
                    datos: { productoId: prod.id, dias: diasEnCamino }
                });
            } else if (diasEnCamino >= 4) {
                alertasActivas.push({
                    id: `paquete-${prod.id}`,
                    tipo: 'importante',
                    categoria: 'paqueteria',
                    titulo: '🚚 Paquete en Tránsito',
                    mensaje: `"${prod.nombre}" está en camino desde hace ${diasEnCamino} días. Mantente atento.`,
                    accion: {
                        texto: 'Ver Detalles',
                        link: 'products.html'
                    },
                    fecha: ahora.toISOString(),
                    datos: { productoId: prod.id, dias: diasEnCamino }
                });
            }
        }
    });
}

// =========================================================
// 4. ALERTAS FINANCIERAS
// =========================================================

function generarAlertasFinancieras(ventas, gastos) {
    const ahora = new Date();
    const mesActual = ahora.getMonth();
    const añoActual = ahora.getFullYear();
    
    // Calcular gastos del mes
    const gastosMes = gastos.filter(g => {
        const fecha = new Date(g.fecha);
        return fecha.getMonth() === mesActual && fecha.getFullYear() === añoActual;
    }).reduce((sum, g) => sum + g.monto, 0);
    
    // Calcular ventas del mes
    const ventasMes = ventas.filter(v => {
        const fecha = new Date(v.fecha);
        return fecha.getMonth() === mesActual && fecha.getFullYear() === añoActual;
    }).reduce((sum, v) => sum + v.precioFinal, 0);
    
    // Alerta: Gastos superan el 30% de las ventas
    if (ventasMes > 0 && gastosMes > (ventasMes * 0.3)) {
        const porcentaje = ((gastosMes / ventasMes) * 100).toFixed(1);
        alertasActivas.push({
            id: 'gastos-altos',
            tipo: 'importante',
            categoria: 'financiero',
            titulo: '💸 Gastos Elevados',
            mensaje: `Tus gastos este mes ($${gastosMes.toFixed(2)}) representan el ${porcentaje}% de tus ventas. Considera optimizar gastos.`,
            accion: {
                texto: 'Ver Gastos',
                link: 'gastos.html'
            },
            fecha: ahora.toISOString(),
            datos: { gastos: gastosMes, ventas: ventasMes }
        });
    }
    
    // Alerta: No hay ventas en los últimos 3 días
    const hace3dias = new Date();
    hace3dias.setDate(hace3dias.getDate() - 3);
    const ventasRecientes = ventas.filter(v => new Date(v.fecha) >= hace3dias);
    
    if (ventasRecientes.length === 0 && ventas.length > 0) {
        alertasActivas.push({
            id: 'sin-ventas',
            tipo: 'importante',
            categoria: 'financiero',
            titulo: '📉 Sin Ventas Recientes',
            mensaje: 'No has registrado ventas en los últimos 3 días. ¿Necesitas promocionar más?',
            accion: {
                texto: 'Ver Inventario',
                link: 'products.html'
            },
            fecha: ahora.toISOString(),
            datos: {}
        });
    }
}

// =========================================================
// 5. ALERTAS DE STOCK BAJO
// =========================================================

function generarAlertasStockBajo(productos, ventas) {
    // Calcular perfumes más vendidos (últimos 30 días)
    const hace30dias = new Date();
    hace30dias.setDate(hace30dias.getDate() - 30);
    
    const ventasRecientes = ventas.filter(v => new Date(v.fecha) >= hace30dias);
    
    // Contar ventas por producto
    const conteoVentas = {};
    ventasRecientes.forEach(v => {
        const nombre = v.producto;
        conteoVentas[nombre] = (conteoVentas[nombre] || 0) + 1;
    });
    
    // Identificar productos populares (vendidos 2+ veces en 30 días)
    Object.keys(conteoVentas).forEach(nombreProducto => {
        if (conteoVentas[nombreProducto] >= 2) {
            // Verificar cuántos quedan en stock
            const enStock = productos.filter(p => p.nombre === nombreProducto).length;
            
            if (enStock === 0) {
                alertasActivas.push({
                    id: `agotado-${nombreProducto}`,
                    tipo: 'critica',
                    categoria: 'inventario',
                    titulo: '🔴 Producto Popular Agotado',
                    mensaje: `"${nombreProducto}" se vendió ${conteoVentas[nombreProducto]} veces en 30 días pero está AGOTADO. ¡Recompra urgente!`,
                    accion: {
                        texto: 'Recomprar',
                        link: 'products.html'
                    },
                    fecha: new Date().toISOString(),
                    datos: { producto: nombreProducto, ventas: conteoVentas[nombreProducto] }
                });
            } else if (enStock <= 1) {
                alertasActivas.push({
                    id: `bajo-${nombreProducto}`,
                    tipo: 'importante',
                    categoria: 'inventario',
                    titulo: '🟡 Stock Bajo de Producto Popular',
                    mensaje: `"${nombreProducto}" se vende bien (${conteoVentas[nombreProducto]} ventas/mes) pero solo quedan ${enStock} unidad(es). Considera recomprar.`,
                    accion: {
                        texto: 'Ver Stock',
                        link: 'products.html'
                    },
                    fecha: new Date().toISOString(),
                    datos: { producto: nombreProducto, stock: enStock }
                });
            }
        }
    });
}

// =========================================================
// RENDERIZADO Y UI
// =========================================================

function renderAlertas() {
    const contenedor = document.getElementById('alertas-container');
    const sinAlertas = document.getElementById('sin-alertas');
    
    if (!contenedor) return;
    
    // Filtrar alertas
    let alertasFiltradas = filtroAlertaActual === 'todas' 
        ? alertasActivas 
        : alertasActivas.filter(a => a.tipo === filtroAlertaActual);
    
    // Ordenar por prioridad y fecha
    const prioridad = { critica: 1, importante: 2, info: 3 };
    alertasFiltradas.sort((a, b) => {
        if (prioridad[a.tipo] !== prioridad[b.tipo]) {
            return prioridad[a.tipo] - prioridad[b.tipo];
        }
        return new Date(b.fecha) - new Date(a.fecha);
    });
    
    contenedor.innerHTML = '';
    
    if (alertasFiltradas.length === 0) {
        sinAlertas.style.display = 'block';
        return;
    }
    
    sinAlertas.style.display = 'none';
    
    alertasFiltradas.forEach(alerta => {
        const colorClasses = {
            critica: 'border-danger bg-danger bg-opacity-10',
            importante: 'border-warning bg-warning bg-opacity-10',
            info: 'border-info bg-info bg-opacity-10'
        };
        
        const iconos = {
            critica: 'bi-exclamation-triangle-fill text-danger',
            importante: 'bi-exclamation-circle-fill text-warning',
            info: 'bi-info-circle-fill text-info'
        };
        
        const card = `
            <div class="card ${colorClasses[alerta.tipo]} border-2 mb-3 shadow-sm">
                <div class="card-body">
                    <div class="d-flex align-items-start">
                        <i class="bi ${iconos[alerta.tipo]} fs-2 me-3"></i>
                        <div class="flex-grow-1">
                            <h5 class="card-title mb-2">${alerta.titulo}</h5>
                            <p class="card-text mb-3">${alerta.mensaje}</p>
                            <div class="d-flex justify-content-between align-items-center">
                                <small class="text-muted">
                                    <i class="bi bi-tag-fill"></i> ${capitalize(alerta.categoria)}
                                </small>
                                <a href="${alerta.accion.link}" class="btn btn-sm btn-dark">
                                    ${alerta.accion.texto} →
                                </a>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        contenedor.innerHTML += card;
    });
}

function actualizarContadores() {
    const criticas = alertasActivas.filter(a => a.tipo === 'critica').length;
    const importantes = alertasActivas.filter(a => a.tipo === 'importante').length;
    const info = alertasActivas.filter(a => a.tipo === 'info').length;
    const total = alertasActivas.length;
    
    document.getElementById('count-criticas').innerText = criticas;
    document.getElementById('count-importantes').innerText = importantes;
    document.getElementById('count-info').innerText = info;
    document.getElementById('count-todas').innerText = total;
    document.getElementById('count-resueltas').innerText = '0'; // Por ahora
    document.getElementById('total-alertas-badge').innerText = `${total} alerta${total !== 1 ? 's' : ''}`;
}

function setFiltroAlerta(tipo, btn) {
    filtroAlertaActual = tipo;
    
    const grupo = btn.parentElement.querySelectorAll('.btn');
    grupo.forEach(b => {
        b.classList.remove('active');
    });
    
    btn.classList.add('active');
    renderAlertas();
}

function capitalize(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
}
