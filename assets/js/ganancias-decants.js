// =========================================================
// GANANCIAS-DECANTS.JS
// Analiza ventas de decants (DECANTS_VENTAS_KEY) y las muestra
// en la pestaña 💧 Decants de ganancias.html
// =========================================================

const DECANTS_VENTAS_KEY_G = 'decants_ventas';

let _decantVentas  = [];   // todas las ventas cargadas
let _chartDecants  = null; // instancia Chart.js

// ── Helpers de formato (igual que ganancias.js) ──
function _fmt(n) {
    return '$' + (n || 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// ── Obtener timestamp de una venta de decant ──
function _tsDecant(v) {
    if (v.fecha) {
        const d = new Date(v.fecha);
        if (!isNaN(d.getTime())) return d.getTime();
    }
    return 0;
}

// ── Cargar datos de Firebase / localStorage ──
async function _cargarDecantVentas() {
    try {
        if (typeof getDataCloud === 'function') {
            _decantVentas = await getDataCloud(DECANTS_VENTAS_KEY_G) || [];
        } else {
            const raw = localStorage.getItem('fitoscents_' + DECANTS_VENTAS_KEY_G);
            _decantVentas = raw ? JSON.parse(raw) : [];
        }
    } catch(e) {
        console.warn('ganancias-decants: no se pudieron cargar ventas', e);
        _decantVentas = [];
    }
}

// ── Ventas dentro del período activo ──
function _decantEnPeriodo() {
    // Reutiliza fechaDesde / fechaHasta de ganancias.js (variables globales)
    const desde = (typeof fechaDesde !== 'undefined') ? fechaDesde : 0;
    const hasta = (typeof fechaHasta !== 'undefined') ? fechaHasta : Date.now();
    return _decantVentas.filter(v => {
        const ts = _tsDecant(v);
        return ts >= desde && ts <= hasta;
    });
}

// ── Render principal (llamado al cambiar a la pestaña o al cambiar período) ──
window.renderDecants = function() {
    const ventas = _decantEnPeriodo();

    // ── KPIs ──
    let ingresos = 0, costos = 0, ml = 0;
    const perfumesSet = new Set();
    ventas.forEach(v => {
        ingresos += parseFloat(v.precio     || 0);
        costos   += parseFloat(v.costoAprox || 0);
        ml       += parseFloat(v.ml         || 0);
        if (v.nombrePerfume) perfumesSet.add(v.nombrePerfume);
    });
    const bruta   = ingresos - costos;
    const margen  = ingresos > 0 ? ((bruta / ingresos) * 100).toFixed(1) : 0;
    const promedio = ventas.length > 0 ? (ingresos / ventas.length) : 0;
    const mlProm   = ventas.length > 0 ? (ml / ventas.length) : 0;

    document.getElementById('d-kpi-ingresos').textContent = _fmt(ingresos);
    document.getElementById('d-kpi-ventas').textContent   = ventas.length + ' venta' + (ventas.length !== 1 ? 's' : '');
    document.getElementById('d-kpi-costos').textContent   = _fmt(costos);
    document.getElementById('d-kpi-bruta').textContent    = _fmt(bruta);
    document.getElementById('d-kpi-margen').textContent   = 'Margen: ' + margen + '%';
    document.getElementById('d-kpi-ml').textContent       = ml.toFixed(1) + ' ml';
    document.getElementById('d-kpi-fuentes').textContent  = perfumesSet.size + ' perfume' + (perfumesSet.size !== 1 ? 's' : '') + ' distintos';
    document.getElementById('d-kpi-promedio').textContent = _fmt(promedio);
    document.getElementById('d-kpi-ml-prom').textContent  = mlProm.toFixed(1) + ' ml';

    // ── Gráfica ──
    _renderChartDecants(ventas);

    // ── Top perfumes ──
    _renderTopDecants(ventas);

    // ── Historial ──
    _renderHistorialDecants(ventas);
};

// ── Gráfica ingresos vs ganancia por día/semana ──
function _renderChartDecants(ventas) {
    const diferenciaDias = ((typeof fechaHasta !== 'undefined' ? fechaHasta : Date.now())
        - (typeof fechaDesde !== 'undefined' ? fechaDesde : 0)) / (1000 * 60 * 60 * 24);

    const agrupado = {};
    ventas.forEach(v => {
        const ts   = _tsDecant(v);
        let key;
        if (diferenciaDias <= 31) {
            key = new Date(ts).toLocaleDateString('es-MX', { day: '2-digit', month: 'short' });
        } else {
            const d = new Date(ts);
            key = d.toLocaleDateString('es-MX', { month: 'short', year: '2-digit' });
        }
        if (!agrupado[key]) agrupado[key] = { ingresos: 0, ganancia: 0 };
        agrupado[key].ingresos  += parseFloat(v.precio     || 0);
        agrupado[key].ganancia  += parseFloat(v.precio     || 0) - parseFloat(v.costoAprox || 0);
    });

    const labels    = Object.keys(agrupado);
    const ingresos  = labels.map(k => agrupado[k].ingresos);
    const ganancias = labels.map(k => agrupado[k].ganancia);

    const ctx = document.getElementById('chartDecants');
    if (_chartDecants) _chartDecants.destroy();

    if (labels.length === 0) {
        ctx.getContext('2d').clearRect(0, 0, ctx.width, ctx.height);
        return;
    }

    _chartDecants = new Chart(ctx, {
        type: 'bar',
        data: {
            labels,
            datasets: [
                { label: 'Ingresos',  data: ingresos,  backgroundColor: 'rgba(167,139,250,0.6)', borderColor: '#a78bfa', borderWidth: 2, borderRadius: 5 },
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

// ── Top perfumes por ganancia ──
function _renderTopDecants(ventas) {
    const porPerfume = {};
    ventas.forEach(v => {
        const nombre = v.nombrePerfume || '—';
        if (!porPerfume[nombre]) porPerfume[nombre] = { count: 0, ingresos: 0, ganancia: 0 };
        porPerfume[nombre].count++;
        porPerfume[nombre].ingresos  += parseFloat(v.precio     || 0);
        porPerfume[nombre].ganancia  += parseFloat(v.precio     || 0) - parseFloat(v.costoAprox || 0);
    });

    const lista = Object.entries(porPerfume)
        .sort((a, b) => b[1].ganancia - a[1].ganancia)
        .slice(0, 10);

    const tbody = document.getElementById('d-tabla-top');
    if (lista.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="text-center text-muted py-3">Sin ventas en este período</td></tr>';
        return;
    }

    tbody.innerHTML = lista.map(([nombre, d]) => {
        const margen = d.ingresos > 0 ? ((d.ganancia / d.ingresos) * 100).toFixed(1) : 0;
        return `
        <tr class="detalle-row">
            <td style="font-size:0.85rem">💧 ${nombre}</td>
            <td class="text-end"><span class="badge bg-secondary">${d.count}</span></td>
            <td class="text-end"><span class="badge badge-venta">$${d.ingresos.toFixed(0)}</span></td>
            <td class="text-end"><span class="badge badge-ganancia">+$${d.ganancia.toFixed(0)}</span></td>
            <td class="text-end" style="color:${margen >= 30 ? '#28a745' : margen >= 15 ? '#ffc107' : '#dc3545'}">${margen}%</td>
        </tr>`;
    }).join('');
}

// ── Historial completo ──
function _renderHistorialDecants(ventas) {
    const badge = document.getElementById('d-total-badge');
    if (badge) badge.textContent = ventas.length + ' venta' + (ventas.length !== 1 ? 's' : '');

    const tbody = document.getElementById('d-tabla-historial');
    if (ventas.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" class="text-center text-muted py-4">Sin ventas de decants en este período</td></tr>';
        return;
    }

    const sorted = [...ventas].sort((a, b) => _tsDecant(b) - _tsDecant(a));

    tbody.innerHTML = sorted.map(v => {
        const precio   = parseFloat(v.precio     || 0);
        const costo    = parseFloat(v.costoAprox || 0);
        const ganancia = precio - costo;
        const margen   = precio > 0 ? ((ganancia / precio) * 100).toFixed(1) : 0;
        const ml       = parseFloat(v.ml || 0);
        const fecha    = new Date(_tsDecant(v)).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: '2-digit', hour: '2-digit', minute: '2-digit' });
        return `
        <tr class="decant-row">
            <td style="font-size:0.78rem;white-space:nowrap">${fecha}</td>
            <td style="font-size:0.85rem">💧 ${v.nombrePerfume || '—'}</td>
            <td style="font-size:0.82rem;color:#aaa">${v.cliente || '—'}</td>
            <td class="text-end"><span class="badge badge-decant">${ml}ml</span></td>
            <td class="text-end"><span class="badge badge-venta">$${precio.toFixed(0)}</span></td>
            <td class="text-end"><span class="badge badge-costo">$${costo.toFixed(2)}</span></td>
            <td class="text-end"><span class="badge badge-ganancia">+$${ganancia.toFixed(0)}</span></td>
            <td class="text-end" style="color:${margen >= 30 ? '#28a745' : margen >= 15 ? '#ffc107' : '#dc3545'}">${margen}%</td>
        </tr>`;
    }).join('');
}

// ── Inicialización: cargar datos al arrancar la página ──
document.addEventListener('DOMContentLoaded', async () => {
    // Esperar a que firebase esté listo (si existe la función)
    if (typeof waitForFirebase === 'function') await waitForFirebase();
    await _cargarDecantVentas();
    // Si ya estamos en la pestaña decants al cargar, renderizar inmediatamente
    if (window._tabActiva === 'decants') window.renderDecants();
});

// ── Re-renderizar cuando cambia el período (ganancias.js llama calcularYRenderizar)
// Nos enganchamos sobreescribiendo la función original ──
(function() {
    const _orig = window.calcularYRenderizar;
    if (typeof _orig === 'function') {
        window.calcularYRenderizar = function() {
            _orig();
            if (window._tabActiva === 'decants') window.renderDecants();
        };
    } else {
        // Si calcularYRenderizar no existe todavía, intentar después
        window.addEventListener('load', () => {
            const _o2 = window.calcularYRenderizar;
            if (typeof _o2 === 'function') {
                window.calcularYRenderizar = function() {
                    _o2();
                    if (window._tabActiva === 'decants') window.renderDecants();
                };
            }
        });
    }
})();
