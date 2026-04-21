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
    
    generarAlertasInventario(productos, ventas);
    generarAlertasClientes(ventas);
    generarAlertasPaqueteria(productos);
    generarAlertasFinancieras(ventas, gastos);
    generarAlertasStockBajo(productos, ventas);
    
    renderAlertas();
    actualizarContadores();
}

// =========================================================
// 1. ALERTAS DE INVENTARIO
// =========================================================

function generarAlertasInventario(productos, ventas) {
    const ahora = new Date();
    
    productos.forEach(prod => {
        const diasEnStock = diasDesde(prod.fechaRegistro);
        
        if (prod.ubicacion === 'en_inventario' && diasEnStock >= 60) {
            alertasActivas.push({
                id: `stock-${prod.id}`,
                tipo: 'importante',
                categoria: 'inventario',
                titulo: '⏰ Capital Muerto Detectado',
                mensaje: `"${prod.nombre}" lleva ${diasEnStock} días sin venderse. Capital inmovilizado: $${prod.costo.toFixed(2)}`,
                accion: { texto: 'Ver Producto', link: 'products.html' },
                fecha: ahora.toISOString(),
                datos: { productoId: prod.id }
            });
        }
        
        if (prod.precioVenta > 2000 && !prod.asegurado) {
            alertasActivas.push({
                id: `valor-alto-${prod.id}`,
                tipo: 'info',
                categoria: 'inventario',
                titulo: '💎 Perfume de Alto Valor',
                mensaje: `"${prod.nombre}" vale $${prod.precioVenta.toFixed(2)}. Guárdalo en lugar seguro.`,
                accion: { texto: 'Ver Detalles', link: 'products.html' },
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
    const deudasPorCliente = {};
    
    ventas.forEach(venta => {
        if (venta.esCredito && venta.saldoPendiente > 0 && venta.cliente) {
            if (!deudasPorCliente[venta.cliente]) {
                deudasPorCliente[venta.cliente] = {
                    total: 0,
                    ventas: [],
                    fechaMasAntigua: new Date(getVentaTimestamp(venta) || ahora.getTime())
                };
            }
            deudasPorCliente[venta.cliente].total += venta.saldoPendiente;
            deudasPorCliente[venta.cliente].ventas.push(venta);
            
            const tsVenta = getVentaTimestamp(venta);
            if (tsVenta > 0 && tsVenta < deudasPorCliente[venta.cliente].fechaMasAntigua.getTime()) {
                deudasPorCliente[venta.cliente].fechaMasAntigua = new Date(tsVenta);
            }
        }
    });
    
    Object.keys(deudasPorCliente).forEach(cliente => {
        const info = deudasPorCliente[cliente];
        const diasDeuda = diasDesde(info.fechaMasAntigua);
        
        if (info.total > 1000 || diasDeuda > 15) {
            alertasActivas.push({
                id: `deuda-${cliente}`,
                tipo: 'critica',
                categoria: 'clientes',
                titulo: '🚨 Deuda Crítica',
                mensaje: `${cliente} debe $${info.total.toFixed(2)} desde hace ${diasDeuda} día${diasDeuda !== 1 ? 's' : ''}. Total de ${info.ventas.length} venta(s) pendiente(s).`,
                accion: { texto: 'Cobrar Ahora', link: 'clientes.html' },
                fecha: ahora.toISOString(),
                datos: { cliente, totalDeuda: info.total, dias: diasDeuda }
            });
        } else if (info.total > 500) {
            alertasActivas.push({
                id: `deuda-${cliente}`,
                tipo: 'importante',
                categoria: 'clientes',
                titulo: '⚠️ Deuda Significativa',
                mensaje: `${cliente} debe $${info.total.toFixed(2)} desde hace ${diasDeuda} día${diasDeuda !== 1 ? 's' : ''}. Considera recordarle el pago.`,
                accion: { texto: 'Ver Cliente', link: 'clientes.html' },
                fecha: ahora.toISOString(),
                datos: { cliente, totalDeuda: info.total }
            });
        }
    });
}

// =========================================================
// HELPER: PARSEAR FECHA EN CUALQUIER FORMATO
// =========================================================

function parsearFecha(fechaStr) {
    if (!fechaStr) return null;
    if (fechaStr instanceof Date) return fechaStr;
    if (typeof fechaStr === 'number' && Number.isFinite(fechaStr)) {
        const d = new Date(fechaStr);
        return Number.isNaN(d.getTime()) ? null : d;
    }
    if (typeof fechaStr !== 'string') return null;
    
    if (fechaStr.includes('T') || fechaStr.includes('-')) {
        const d = new Date(fechaStr);
        if (!Number.isNaN(d.getTime())) return d;
    }
    
    const partes = fechaStr.split(',')[0].trim().split('/');
    if (partes.length === 3) {
        const [dia, mes, año] = partes;
        const d = new Date(parseInt(año), parseInt(mes) - 1, parseInt(dia));
        if (!Number.isNaN(d.getTime())) return d;
    }
    
    return null;
}

function getVentaTimestamp(venta) {
    if (venta && typeof venta.id === 'number' && venta.id > 0) return venta.id;
    if (venta && typeof venta.id === 'string' && !Number.isNaN(Number(venta.id))) return Number(venta.id);
    const parsed = parsearFecha(venta?.fecha);
    return parsed ? parsed.getTime() : 0;
}

function diasDesde(fechaStr) {
    const fecha = parsearFecha(fechaStr);
    if (!fecha) return 0;
    const ahora = new Date();
    return Math.max(0, Math.floor((ahora - fecha) / (1000 * 60 * 60 * 24)));
}

// =========================================================
// 3. ALERTAS DE PAQUETERÍA
// =========================================================

function generarAlertasPaqueteria(productos) {
    const ahora = new Date();
    
    productos.forEach(prod => {
        if (prod.ubicacion === 'en_camino') {
            const diasEnCamino = diasDesde(prod.fechaRegistro);
            
            if (diasEnCamino >= 7) {
                alertasActivas.push({
                    id: `paquete-${prod.id}`,
                    tipo: 'critica',
                    categoria: 'paqueteria',
                    titulo: '📦 Paquete Retrasado',
                    mensaje: `"${prod.nombre}" lleva ${diasEnCamino} días en camino. Verifica el estado del envío.`,
                    accion: { texto: 'Ver Paquetes', link: 'products.html' },
                    fecha: ahora.toISOString(),
                    datos: { productoId: prod.id, dias: diasEnCamino }
                });
            } else if (diasEnCamino >= 4) {
                alertasActivas.push({
                    id: `paquete-${prod.id}`,
                    tipo: 'importante',
                    categoria: 'paqueteria',
                    titulo: '🚚 Paquete en Tránsito',
                    mensaje: `"${prod.nombre}" está en camino desde hace ${diasEnCamino} días.`,
                    accion: { texto: 'Ver Detalles', link: 'products.html' },
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
    
    const gastosMes = gastos.filter(g => {
        const f = parsearFecha(g.fecha);
        return f && f.getMonth() === mesActual && f.getFullYear() === añoActual;
    }).reduce((sum, g) => sum + g.monto, 0);
    
    const ventasMes = ventas.filter(v => {
        const ts = getVentaTimestamp(v);
        const f = ts > 0 ? new Date(ts) : null;
        return f && f.getMonth() === mesActual && f.getFullYear() === añoActual;
    }).reduce((sum, v) => sum + v.precioFinal, 0);
    
    if (ventasMes > 0 && gastosMes > (ventasMes * 0.3)) {
        const porcentaje = ((gastosMes / ventasMes) * 100).toFixed(1);
        alertasActivas.push({
            id: 'gastos-altos',
            tipo: 'importante',
            categoria: 'financiero',
            titulo: '💸 Gastos Elevados',
            mensaje: `Tus gastos este mes ($${gastosMes.toFixed(2)}) representan el ${porcentaje}% de tus ventas ($${ventasMes.toFixed(2)}).`,
            accion: { texto: 'Ver Gastos', link: 'gastos.html' },
            fecha: ahora.toISOString(),
            datos: { gastos: gastosMes, ventas: ventasMes }
        });
    }
    
    const hace3dias = new Date();
    hace3dias.setDate(hace3dias.getDate() - 3);
    const ventasRecientes = ventas.filter(v => {
        const ts = getVentaTimestamp(v);
        const f = ts > 0 ? new Date(ts) : null;
        return f && f >= hace3dias;
    });
    
    if (ventasRecientes.length === 0 && ventas.length > 0) {
        alertasActivas.push({
            id: 'sin-ventas',
            tipo: 'importante',
            categoria: 'financiero',
            titulo: '📉 Sin Ventas Recientes',
            mensaje: 'No has registrado ventas en los últimos 3 días. ¿Necesitas promocionar más?',
            accion: { texto: 'Ver Inventario', link: 'products.html' },
            fecha: ahora.toISOString(),
            datos: {}
        });
    }
}

// =========================================================
// 5. ALERTAS DE STOCK BAJO
// =========================================================

function generarAlertasStockBajo(productos, ventas) {
    const hace30dias = new Date();
    hace30dias.setDate(hace30dias.getDate() - 30);
    
    const ventasRecientes = ventas.filter(v => {
        const ts = getVentaTimestamp(v);
        return ts > 0 && ts >= hace30dias.getTime();
    });
    
    const conteoVentas = {};
    ventasRecientes.forEach(v => {
        const nombre = v.producto;
        conteoVentas[nombre] = (conteoVentas[nombre] || 0) + 1;
    });
    
    Object.keys(conteoVentas).forEach(nombreProducto => {
        if (conteoVentas[nombreProducto] >= 2) {
            const enStock = productos.filter(p => p.nombre === nombreProducto).length;
            
            if (enStock === 0) {
                alertasActivas.push({
                    id: `agotado-${nombreProducto}`,
                    tipo: 'critica',
                    categoria: 'inventario',
                    titulo: '🔴 Producto Popular Agotado',
                    mensaje: `"${nombreProducto}" se vendió ${conteoVentas[nombreProducto]} veces en 30 días pero está AGOTADO. ¡Recompra urgente!`,
                    accion: { texto: 'Recomprar', link: 'products.html' },
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
                    accion: { texto: 'Ver Stock', link: 'products.html' },
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
    
    let alertasFiltradas = filtroAlertaActual === 'todas'
        ? alertasActivas
        : alertasActivas.filter(a => a.tipo === filtroAlertaActual);
    
    const prioridad = { critica: 1, importante: 2, info: 3 };
    alertasFiltradas.sort((a, b) => {
        if (prioridad[a.tipo] !== prioridad[b.tipo]) return prioridad[a.tipo] - prioridad[b.tipo];
        return new Date(b.fecha) - new Date(a.fecha);
    });
    
    contenedor.innerHTML = '';
    
    if (alertasFiltradas.length === 0) {
        sinAlertas.style.display = 'block';
        return;
    }
    
    sinAlertas.style.display = 'none';

    // Estilos inline con rgba para respetar el tema oscuro (sin texto negro de Bootstrap)
    const estilos = {
        critica:    { border: 'rgba(248,113,113,0.5)',  bg: 'rgba(248,113,113,0.08)',  titleColor: '#f87171' },
        importante: { border: 'rgba(255,215,0,0.5)',    bg: 'rgba(255,215,0,0.07)',    titleColor: '#FFD700' },
        info:       { border: 'rgba(56,189,248,0.5)',   bg: 'rgba(56,189,248,0.07)',   titleColor: '#38bdf8' }
    };

    const iconos = {
        critica:    'bi-exclamation-triangle-fill',
        importante: 'bi-exclamation-circle-fill',
        info:       'bi-info-circle-fill'
    };
    
    alertasFiltradas.forEach(alerta => {
        const s = estilos[alerta.tipo] || estilos.info;
        const ico = iconos[alerta.tipo] || 'bi-bell-fill';
        
        const card = `
            <div class="card mb-3 shadow-sm" style="border: 1px solid ${s.border}; background: ${s.bg};">
                <div class="card-body">
                    <div class="d-flex align-items-start">
                        <i class="bi ${ico} fs-2 me-3" style="color:${s.titleColor}; flex-shrink:0;"></i>
                        <div class="flex-grow-1">
                            <h5 class="card-title mb-2" style="color:${s.titleColor};">${alerta.titulo}</h5>
                            <p class="card-text mb-3" style="color: var(--text-primary);">${alerta.mensaje}</p>
                            <div class="d-flex justify-content-between align-items-center">
                                <small class="text-muted">
                                    <i class="bi bi-tag-fill"></i> ${capitalize(alerta.categoria)}
                                </small>
                                <a href="${alerta.accion.link}" class="btn btn-sm btn-gold">
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
    const criticas   = alertasActivas.filter(a => a.tipo === 'critica').length;
    const importantes = alertasActivas.filter(a => a.tipo === 'importante').length;
    const info       = alertasActivas.filter(a => a.tipo === 'info').length;
    const total      = alertasActivas.length;
    
    document.getElementById('count-criticas').innerText   = criticas;
    document.getElementById('count-importantes').innerText = importantes;
    document.getElementById('count-info').innerText        = info;
    document.getElementById('count-todas').innerText       = total;
    document.getElementById('count-resueltas').innerText   = '0';
    document.getElementById('total-alertas-badge').innerText = `${total} alerta${total !== 1 ? 's' : ''}`;
}

function setFiltroAlerta(tipo, btn) {
    filtroAlertaActual = tipo;
    btn.parentElement.querySelectorAll('.btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    renderAlertas();
}

function capitalize(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
}
