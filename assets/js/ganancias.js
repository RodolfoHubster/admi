// =========================================================
// GANANCIAS.JS — Centro de Análisis de Ganancias
// =========================================================

let chartGanancias = null;
let periodoActual  = 'semana';
let fechaDesde     = null;
let fechaHasta     = null;
let perfumesSeleccionados = new Set();
let todasVentas    = [];
let todosGastos    = [];

document.addEventListener('DOMContentLoaded', async () => {
    await initApp();
    todasVentas  = JSON.parse(localStorage.getItem(SALES_KEY))    || [];
    todosGastos  = JSON.parse(localStorage.getItem(EXPENSES_KEY)) || [];
    inicializarFiltros();
    aplicarPeriodo('semana');
    construirChips();
});

// =========================================================
// FILTROS DE PERÍODO
// =========================================================

function inicializarFiltros() {
    document.querySelectorAll('.periodo-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.periodo-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            fechaDesde = null;
            fechaHasta = null;
            aplicarPeriodo(btn.dataset.periodo);
        });
    });
}

function aplicarPeriodo(periodo) {
    periodoActual = periodo;
    const ahora   = new Date();
    let desde;

    if (periodo === 'semana') {
        desde = new Date(ahora);
        const dia = desde.getDay(); // 0=domingo
        const diff = dia === 0 ? 6 : dia - 1;
        desde.setDate(desde.getDate() - diff);
        desde.setHours(0, 0, 0, 0);
    } else if (periodo === 'mes') {
        desde = new Date(ahora.getFullYear(), ahora.getMonth(), 1);
    } else if (periodo === '3meses') {
        desde = new Date(ahora.getFullYear(), ahora.getMonth() - 2, 1);
    } else if (periodo === '6meses') {
        desde = new Date(ahora.getFullYear(), ahora.getMonth() - 5, 1);
    } else if (periodo === 'año') {
        desde = new Date(ahora.getFullYear(), 0, 1);
    } else {
        desde = new Date(0);
    }

    fechaDesde = desde.getTime();
    fechaHasta = ahora.getTime();
    calcularYRenderizar();
}

function aplicarRangoPersonalizado() {
    const d = document.getElementById('fecha-desde').value;
    const h = document.getElementById('fecha-hasta').value;
    if (!d || !h) return showToast('Selecciona ambas fechas', 'warning');
    document.querySelectorAll('.periodo-btn').forEach(b => b.classList.remove('active'));
    fechaDesde = new Date(d + 'T00:00:00').getTime();
    fechaHasta = new Date(h + 'T23:59:59').getTime();
    periodoActual = 'custom';
    calcularYRenderizar();
}

// =========================================================
// CÁLCULO PRINCIPAL
// =========================================================

function ventasEnPeriodo() {
    return todasVentas.filter(v => {
        const ts = typeof v.id === 'number' ? v.id : new Date(v.fecha || 0).getTime();
        return ts >= fechaDesde && ts <= fechaHasta;
    });
}

function gastosEnPeriodo() {
    return todosGastos.filter(g => {
        const ts = g.timestamp || new Date(g.fecha || 0).getTime();
        return ts >= fechaDesde && ts <= fechaHasta;
    });
}

function calcularYRenderizar() {
    const ventas  = ventasEnPeriodo();
    const gastos  = gastosEnPeriodo();

    let ingresos  = 0, costos = 0, bruta = 0, porCobrar = 0;
    const deudores = new Set();

    ventas.forEach(v => {
        const precio    = parseFloat(v.precioFinal || 0);
        const ganancia  = parseFloat(v.utilidad   || 0);
        const costo     = precio - ganancia;
        ingresos += precio;
        costos   += costo;
        bruta    += ganancia;
        if (v.esCredito && parseFloat(v.saldoPendiente || 0) > 0) {
            porCobrar += parseFloat(v.saldoPendiente);
            deudores.add(v.cliente);
        }
    });

    const gastosOperativos = gastos.reduce((s, g) => {
        if (g.quienPago === 'mio')     return s + parseFloat(g.monto || 0);
        if (g.quienPago === 'mitad')   return s + parseFloat(g.monto || 0) * 0.5;
        if (g.quienPago === 'personalizado') {
            const pct = 100 - (g.porcentajeSocio || 0);
            return s + parseFloat(g.monto || 0) * (pct / 100);
        }
        return s;
    }, 0);

    const neta         = bruta - gastosOperativos;
    const margenBruto  = ingresos > 0 ? ((bruta / ingresos) * 100).toFixed(1) : 0;
    const margenNeto   = ingresos > 0 ? ((neta  / ingresos) * 100).toFixed(1) : 0;

    // KPIs
    setText('kpi-ingresos',       fmt(ingresos));
    setText('kpi-ingresos-ventas', `${ventas.length} venta${ventas.length !== 1 ? 's' : ''}`);
    setText('kpi-costos',          fmt(costos));
    setText('kpi-bruta',           fmt(bruta));
    setText('kpi-margen-bruto',    `Margen bruto: ${margenBruto}%`);
    setText('kpi-gastos',          fmt(gastosOperativos));
    setText('kpi-gastos-count',    `${gastos.length} gasto${gastos.length !== 1 ? 's' : ''}`);
    setText('kpi-neta',            fmt(neta));
    setText('kpi-margen-neto',     `Margen neto: ${margenNeto}%`);
    setText('kpi-cobrar',          fmt(porCobrar));
    setText('kpi-cobrar-clientes', `${deudores.size} cliente${deudores.size !== 1 ? 's' : ''}`);

    renderGrafica(ventas);
    renderTablaSemanas(ventas);
    renderHistorial(ventas);
    if (perfumesSeleccionados.size > 0) renderAnalisisPerfume();
}

// =========================================================
// GRÁFICA POR DÍA/SEMANA
// =========================================================

function renderGrafica(ventas) {
    const diferenciaDias = (fechaHasta - fechaDesde) / (1000 * 60 * 60 * 24);
    const agrupado = {};

    if (diferenciaDias <= 31) {
        // Por día
        ventas.forEach(v => {
            const ts   = typeof v.id === 'number' ? v.id : new Date(v.fecha || 0).getTime();
            const key  = new Date(ts).toLocaleDateString('es-MX', { day:'2-digit', month:'short' });
            if (!agrupado[key]) agrupado[key] = { ingresos: 0, ganancia: 0 };
            agrupado[key].ingresos  += parseFloat(v.precioFinal || 0);
            agrupado[key].ganancia  += parseFloat(v.utilidad    || 0);
        });
    } else {
        // Por mes
        ventas.forEach(v => {
            const ts   = typeof v.id === 'number' ? v.id : new Date(v.fecha || 0).getTime();
            const d    = new Date(ts);
            const key  = d.toLocaleDateString('es-MX', { month:'short', year:'2-digit' });
            if (!agrupado[key]) agrupado[key] = { ingresos: 0, ganancia: 0 };
            agrupado[key].ingresos  += parseFloat(v.precioFinal || 0);
            agrupado[key].ganancia  += parseFloat(v.utilidad    || 0);
        });
    }

    const labels    = Object.keys(agrupado);
    const ingresos  = labels.map(k => agrupado[k].ingresos);
    const ganancias = labels.map(k => agrupado[k].ganancia);

    const ctx = document.getElementById('chartGanancias');
    if (chartGanancias) chartGanancias.destroy();

    chartGanancias = new Chart(ctx, {
        type: 'bar',
        data: {
            labels,
            datasets: [
                { label: 'Ingresos',  data: ingresos,  backgroundColor: 'rgba(13,202,240,0.6)',  borderColor: '#0dcaf0', borderWidth: 2, borderRadius: 5 },
                { label: 'Ganancia', data: ganancias, backgroundColor: 'rgba(255,215,0,0.6)',   borderColor: '#FFD700', borderWidth: 2, borderRadius: 5 }
            ]
        },
        options: {
            responsive: true,
            plugins: {
                legend: { labels: { color: '#aaa' } },
                tooltip: { callbacks: { label: c => c.dataset.label + ': $' + c.parsed.y.toFixed(0) } }
            },
            scales: {
                x: { ticks: { color: '#888' }, grid: { color: '#222' } },
                y: { ticks: { color: '#888', callback: v => '$' + v.toLocaleString() }, grid: { color: '#222' }, beginAtZero: true }
            }
        }
    });
}

// =========================================================
// TABLA RESUMEN POR SEMANA
// =========================================================

function renderTablaSemanas(ventas) {
    const semanas = {};

    ventas.forEach(v => {
        const ts  = typeof v.id === 'number' ? v.id : new Date(v.fecha || 0).getTime();
        const d   = new Date(ts);
        const lun = new Date(d);
        const diffLun = d.getDay() === 0 ? 6 : d.getDay() - 1;
        lun.setDate(d.getDate() - diffLun);
        lun.setHours(0,0,0,0);
        const key = lun.toLocaleDateString('es-MX', { day:'2-digit', month:'short', year:'numeric' });
        if (!semanas[key]) semanas[key] = { ingresos: 0, ganancia: 0, count: 0, ts: lun.getTime() };
        semanas[key].ingresos += parseFloat(v.precioFinal || 0);
        semanas[key].ganancia += parseFloat(v.utilidad    || 0);
        semanas[key].count++;
    });

    const tbody = document.getElementById('tabla-semanas');
    const filas = Object.entries(semanas).sort((a, b) => b[1].ts - a[1].ts);

    if (filas.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" class="text-center text-muted py-3">Sin ventas en este período</td></tr>';
        return;
    }

    tbody.innerHTML = filas.map(([sem, data]) => `
        <tr class="detalle-row">
            <td style="font-size:0.8rem">Sem. ${sem}</td>
            <td class="text-end text-info fw-bold">${fmt(data.ingresos)}</td>
            <td class="text-end fw-bold" style="color:#FFD700">${fmt(data.ganancia)}</td>
            <td class="text-end text-muted">${data.count}</td>
        </tr>`).join('');
}

// =========================================================
// HISTORIAL COMPLETO
// =========================================================

function renderHistorial(ventas) {
    const badge = document.getElementById('total-ventas-badge');
    badge.textContent = `${ventas.length} venta${ventas.length !== 1 ? 's' : ''}`;

    const tbody = document.getElementById('tabla-historial');
    if (ventas.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" class="text-center text-muted py-4">Sin ventas en este período</td></tr>';
        return;
    }

    const sorted = [...ventas].sort((a, b) => {
        const ta = typeof a.id === 'number' ? a.id : new Date(a.fecha || 0).getTime();
        const tb = typeof b.id === 'number' ? b.id : new Date(b.fecha || 0).getTime();
        return tb - ta;
    });

    tbody.innerHTML = sorted.map(v => {
        const precio   = parseFloat(v.precioFinal || 0);
        const ganancia = parseFloat(v.utilidad    || 0);
        const costo    = precio - ganancia;
        const margen   = precio > 0 ? ((ganancia / precio) * 100).toFixed(1) : 0;
        const ts       = typeof v.id === 'number' ? v.id : new Date(v.fecha || 0).getTime();
        const fecha    = new Date(ts).toLocaleDateString('es-MX', { day:'2-digit', month:'short', year:'2-digit', hour:'2-digit', minute:'2-digit' });
        const tipoBadge = v.esCredito
            ? `<span class="badge bg-warning text-dark">Crédito</span>`
            : `<span class="badge bg-success">Contado</span>`;
        return `
        <tr class="detalle-row">
            <td style="font-size:0.78rem;white-space:nowrap">${fecha}</td>
            <td style="font-size:0.85rem">${v.producto || '—'}</td>
            <td style="font-size:0.82rem;color:#aaa">${v.cliente || '—'}</td>
            <td class="text-end"><span class="badge badge-venta">$${precio.toFixed(0)}</span></td>
            <td class="text-end"><span class="badge badge-costo">$${costo.toFixed(0)}</span></td>
            <td class="text-end"><span class="badge badge-ganancia">+$${ganancia.toFixed(0)}</span></td>
            <td class="text-end" style="color:${margen >= 30 ? '#28a745' : margen >= 15 ? '#ffc107' : '#dc3545'}">${margen}%</td>
            <td>${tipoBadge}</td>
        </tr>`;
    }).join('');
}

// =========================================================
// CHIPS DE PERFUMES
// =========================================================

function construirChips() {
    const nombres = [...new Set(todasVentas.map(v => v.producto).filter(Boolean))].sort();
    const cont    = document.getElementById('chips-perfumes');
    cont.innerHTML = nombres.map(nombre =>
        `<span class="perfume-chip" data-nombre="${nombre}" onclick="toggleChip(this)">
            🧴 ${nombre}
        </span>`
    ).join('');
}

function filtrarChips() {
    const q = document.getElementById('search-perfume').value.toLowerCase();
    document.querySelectorAll('.perfume-chip').forEach(chip => {
        chip.style.display = chip.dataset.nombre.toLowerCase().includes(q) ? '' : 'none';
    });
}

function toggleChip(chip) {
    const nombre = chip.dataset.nombre;
    if (perfumesSeleccionados.has(nombre)) {
        perfumesSeleccionados.delete(nombre);
        chip.classList.remove('selected');
    } else {
        perfumesSeleccionados.add(nombre);
        chip.classList.add('selected');
    }
    renderAnalisisPerfume();
}

// =========================================================
// ANÁLISIS DETALLADO POR PERFUME
// =========================================================

function renderAnalisisPerfume() {
    const body = document.getElementById('analisis-perfume-body');

    if (perfumesSeleccionados.size === 0) {
        body.innerHTML = `<div class="empty-analysis"><i class="bi bi-search"></i><span>Selecciona un perfume arriba para ver su historial</span></div>`;
        return;
    }

    let html = '';

    perfumesSeleccionados.forEach(nombre => {
        const ventasPerfume = todasVentas.filter(v => v.producto === nombre)
            .sort((a, b) => {
                const ta = typeof a.id === 'number' ? a.id : new Date(a.fecha || 0).getTime();
                const tb = typeof b.id === 'number' ? b.id : new Date(b.fecha || 0).getTime();
                return tb - ta;
            });

        let totalIngresos = 0, totalGanancia = 0, totalCosto = 0;
        ventasPerfume.forEach(v => {
            totalIngresos  += parseFloat(v.precioFinal || 0);
            totalGanancia  += parseFloat(v.utilidad    || 0);
            totalCosto     += parseFloat(v.precioFinal || 0) - parseFloat(v.utilidad || 0);
        });
        const margenProm = totalIngresos > 0 ? ((totalGanancia / totalIngresos) * 100).toFixed(1) : 0;

        html += `
        <div class="mb-4">
            <div class="d-flex align-items-center gap-3 mb-3 flex-wrap">
                <h6 class="fw-bold mb-0" style="color:#FFD700">🧴 ${nombre}</h6>
                <span class="badge bg-secondary">${ventasPerfume.length} venta${ventasPerfume.length !== 1 ? 's' : ''}</span>
                <span class="badge badge-venta">Ingresos: ${fmt(totalIngresos)}</span>
                <span class="badge badge-costo">Costo total: ${fmt(totalCosto)}</span>
                <span class="badge badge-ganancia">Ganancia: ${fmt(totalGanancia)}</span>
                <span class="badge" style="background:rgba(255,215,0,0.15);color:#FFD700;border:1px solid #FFD700">Margen: ${margenProm}%</span>
            </div>
            <div class="table-responsive">
                <table class="table table-sm table-detalle mb-0">
                    <thead>
                        <tr>
                            <th>Fecha</th>
                            <th>Cliente</th>
                            <th class="text-end">Precio venta</th>
                            <th class="text-end">Costo</th>
                            <th class="text-end">Ganancia</th>
                            <th class="text-end">Margen</th>
                            <th>Tipo</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${ventasPerfume.length === 0
                            ? '<tr><td colspan="7" class="text-center text-muted">Sin ventas registradas</td></tr>'
                            : ventasPerfume.map(v => {
                                const precio   = parseFloat(v.precioFinal || 0);
                                const ganancia = parseFloat(v.utilidad    || 0);
                                const costo    = precio - ganancia;
                                const margen   = precio > 0 ? ((ganancia / precio) * 100).toFixed(1) : 0;
                                const ts       = typeof v.id === 'number' ? v.id : new Date(v.fecha || 0).getTime();
                                const fecha    = new Date(ts).toLocaleDateString('es-MX', { day:'2-digit', month:'short', year:'2-digit', hour:'2-digit', minute:'2-digit' });
                                return `
                                <tr class="detalle-row">
                                    <td style="font-size:0.78rem;white-space:nowrap">${fecha}</td>
                                    <td style="font-size:0.82rem;color:#aaa">${v.cliente || '—'}</td>
                                    <td class="text-end"><span class="badge badge-venta">$${precio.toFixed(0)}</span></td>
                                    <td class="text-end"><span class="badge badge-costo">$${costo.toFixed(0)}</span></td>
                                    <td class="text-end"><span class="badge badge-ganancia">+$${ganancia.toFixed(0)}</span></td>
                                    <td class="text-end" style="color:${margen >= 30 ? '#28a745' : margen >= 15 ? '#ffc107' : '#dc3545'}">${margen}%</td>
                                    <td>${v.esCredito ? '<span class="badge bg-warning text-dark">Crédito</span>' : '<span class="badge bg-success">Contado</span>'}</td>
                                </tr>`;
                            }).join('')
                        }
                    </tbody>
                </table>
            </div>
        </div>
        ${perfumesSeleccionados.size > 1 ? '<hr style="border-color:#2d2d2d">' : ''}`;
    });

    body.innerHTML = html;
}

// =========================================================
// HELPERS
// =========================================================

function fmt(n) {
    return '$' + parseFloat(n || 0).toLocaleString('es-MX', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function setText(id, val) {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
}
