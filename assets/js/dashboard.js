// =========================================================
// DASHBOARD AVANZADO CON GRÁFICAS
// =========================================================

let chartVentas = null;
let chartInventario = null;

document.addEventListener('DOMContentLoaded', () => {
    cargarDashboard();
});

function cargarDashboard() {
    // Mostrar fecha actual
    document.getElementById('fecha-actual').innerText = new Date().toLocaleDateString('es-MX', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
    
    calcularKPIsDashboard();
    generarGraficaVentas();
    generarGraficaInventario();
    cargarTopRentables();
    cargarTopVendidos();
}

// =========================================================
// CALCULAR KPIS
// =========================================================

function calcularKPIsDashboard() {
    const productos = JSON.parse(localStorage.getItem(DB_KEY)) || [];
    const ventas = JSON.parse(localStorage.getItem(SALES_KEY)) || [];
    const gastos = JSON.parse(localStorage.getItem(EXPENSES_KEY)) || [];
    
    // --- 1. DINERO REAL ---
    
    // Calcular cuánto has cobrado realmente
    let dineroCobrado = 0;
    let dineroPorCobrar = 0;
    let clientesDeudores = new Set();
    
    ventas.forEach(venta => {
        if (venta.esCredito) {
            const saldoPendiente = parseFloat(venta.saldoPendiente || 0);
            const cobrado = venta.precioFinal - saldoPendiente;
            const porcentajeCobrado = cobrado / venta.precioFinal;
            dineroCobrado += venta.utilidad * porcentajeCobrado;
            
            if (saldoPendiente > 0) {
                dineroPorCobrar += saldoPendiente;
                clientesDeudores.add(venta.cliente);
            }
        } else {
            dineroCobrado += venta.utilidad;
        }
    });
    
    // Calcular MIS gastos
    const misGastos = gastos.reduce((sum, g) => {
        if (g.quienPago === 'mio') return sum + g.monto;
        if (g.quienPago === 'mitad') return sum + (g.monto * 0.5);
        if (g.quienPago === 'personalizado') {
            const pctMio = 100 - (g.porcentajeSocio || 0);
            return sum + (g.monto * (pctMio / 100));
        }
        return sum;
    }, 0);
    
    // Ganancia neta REAL
    const gananciaNeta = dineroCobrado - misGastos;
    
    document.getElementById('ganancia-neta-real').innerText = formatMoney(gananciaNeta);
    document.getElementById('badge-cobrado').innerText = `Cobrado: ${formatMoney(dineroCobrado)}`;
    document.getElementById('badge-gastos-desc').innerText = `Gastos: ${formatMoney(misGastos)}`;
    
    document.getElementById('dinero-por-cobrar').innerText = formatMoney(dineroPorCobrar);
    document.getElementById('clientes-deudores').innerText = `${clientesDeudores.size} cliente${clientesDeudores.size !== 1 ? 's' : ''}`;
    
    // --- 2. INVENTARIO ---
    
    const capitalInvertido = productos.reduce((sum, p) => sum + (p.costo || 0), 0);
    const valorPotencial = productos.reduce((sum, p) => sum + (p.precioVenta || 0), 0);
    const gananciaProyectada = valorPotencial - capitalInvertido;
    const botellas = productos.length;
    
    const enCamino = productos.filter(p => p.ubicacion === 'en_camino');
    const valorEnCamino = enCamino.reduce((sum, p) => sum + (p.precioVenta || 0), 0);
    
    document.getElementById('capital-invertido').innerText = formatMoney(capitalInvertido);
    document.getElementById('valor-potencial').innerText = formatMoney(valorPotencial);
    document.getElementById('ganancia-proyectada').innerText = formatMoney(gananciaProyectada);
    document.getElementById('botellas-stock').innerText = botellas;
    
    document.getElementById('valor-en-camino').innerText = formatMoney(valorEnCamino);
    document.getElementById('paquetes-camino').innerText = enCamino.length;
    
    // Progress bars
    const maxCapital = Math.max(capitalInvertido, valorPotencial, 1);
    document.getElementById('progress-capital').style.width = `${(capitalInvertido / maxCapital) * 100}%`;
    document.getElementById('progress-camino').style.width = `${enCamino.length > 0 ? 100 : 0}%`;
}

// =========================================================
// GRÁFICA: VENTAS POR MES
// =========================================================

function generarGraficaVentas() {
    const ventas = JSON.parse(localStorage.getItem(SALES_KEY)) || [];
    
    // Obtener últimos 6 meses
    const meses = [];
    const ahora = new Date();
    
    for (let i = 5; i >= 0; i--) {
        const fecha = new Date(ahora.getFullYear(), ahora.getMonth() - i, 1);
        meses.push({
            label: fecha.toLocaleDateString('es-MX', { month: 'short', year: '2-digit' }),
            mes: fecha.getMonth(),
            año: fecha.getFullYear(),
            ventas: 0,
            ganancia: 0
        });
    }
    
    // Contar ventas por mes
    ventas.forEach(v => {
        const fecha = new Date(v.fecha);
        const mesVenta = meses.find(m => m.mes === fecha.getMonth() && m.año === fecha.getFullYear());
        if (mesVenta) {
            mesVenta.ventas += v.precioFinal;
            mesVenta.ganancia += v.utilidad;
        }
    });
    
    const ctx = document.getElementById('chartVentasMes');
    
    if (chartVentas) chartVentas.destroy();
    
    chartVentas = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: meses.map(m => m.label),
            datasets: [
                {
                    label: 'Ventas Totales',
                    data: meses.map(m => m.ventas),
                    backgroundColor: 'rgba(59, 130, 246, 0.7)',
                    borderColor: 'rgb(59, 130, 246)',
                    borderWidth: 2,
                    borderRadius: 6
                },
                {
                    label: 'Ganancia',
                    data: meses.map(m => m.ganancia),
                    backgroundColor: 'rgba(34, 197, 94, 0.7)',
                    borderColor: 'rgb(34, 197, 94)',
                    borderWidth: 2,
                    borderRadius: 6
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: {
                    display: true,
                    position: 'top'
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return context.dataset.label + ': $' + context.parsed.y.toFixed(2);
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: function(value) {
                            return '$' + value.toLocaleString();
                        }
                    }
                }
            }
        }
    });
}

// =========================================================
// GRÁFICA: DISTRIBUCIÓN INVENTARIO
// =========================================================

function generarGraficaInventario() {
    const productos = JSON.parse(localStorage.getItem(DB_KEY)) || [];
    
    const enStock = productos.filter(p => p.ubicacion !== 'en_camino' && p.destino === 'stock').length;
    const pedidos = productos.filter(p => p.destino === 'pedido').length;
    const enCamino = productos.filter(p => p.ubicacion === 'en_camino').length;
    
    const ctx = document.getElementById('chartInventario');
    
    if (chartInventario) chartInventario.destroy();
    
    chartInventario = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['En Stock', 'Pedidos', 'En Camino'],
            datasets: [{
                data: [enStock, pedidos, enCamino],
                backgroundColor: [
                    'rgba(34, 197, 94, 0.8)',
                    'rgba(59, 130, 246, 0.8)',
                    'rgba(251, 191, 36, 0.8)'
                ],
                borderWidth: 3,
                borderColor: '#fff'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: {
                    position: 'bottom'
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const label = context.label || '';
                            const value = context.parsed;
                            const total = context.dataset.data.reduce((a, b) => a + b, 0);
                            const percentage = ((value / total) * 100).toFixed(1);
                            return `${label}: ${value} (${percentage}%)`;
                        }
                    }
                }
            }
        }
    });
}

// =========================================================
// TOP PRODUCTOS RENTABLES
// =========================================================

function cargarTopRentables() {
    const ventas = JSON.parse(localStorage.getItem(SALES_KEY)) || [];
    
    // Agrupar por producto y sumar ganancias
    const ganancias = {};
    ventas.forEach(v => {
        if (!ganancias[v.producto]) {
            ganancias[v.producto] = 0;
        }
        ganancias[v.producto] += v.utilidad;
    });
    
    // Ordenar y tomar top 5
    const top = Object.entries(ganancias)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5);
    
    const tbody = document.getElementById('table-rentables');
    tbody.innerHTML = '';
    
    if (top.length === 0) {
        tbody.innerHTML = '<tr><td colspan="3" class="text-center text-muted py-3">Sin ventas aún</td></tr>';
        return;
    }
    
    top.forEach((item, index) => {
        tbody.innerHTML += `
            <tr>
                <td class="fw-bold">#${index + 1}</td>
                <td>${item[0]}</td>
                <td class="text-end text-success fw-bold">+$${item[1].toFixed(0)}</td>
            </tr>
        `;
    });
}

// =========================================================
// TOP PRODUCTOS VENDIDOS
// =========================================================

function cargarTopVendidos() {
    const ventas = JSON.parse(localStorage.getItem(SALES_KEY)) || [];
    
    // Filtrar últimos 30 días
    const hace30dias = new Date();
    hace30dias.setDate(hace30dias.getDate() - 30);
    const ventasRecientes = ventas.filter(v => new Date(v.fecha) >= hace30dias);
    
    // Contar ventas por producto
    const conteo = {};
    ventasRecientes.forEach(v => {
        conteo[v.producto] = (conteo[v.producto] || 0) + 1;
    });
    
    // Ordenar y tomar top 5
    const top = Object.entries(conteo)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5);
    
    const tbody = document.getElementById('table-vendidos');
    tbody.innerHTML = '';
    
    if (top.length === 0) {
        tbody.innerHTML = '<tr><td colspan="3" class="text-center text-muted py-3">Sin ventas en 30 días</td></tr>';
        return;
    }
    
    top.forEach((item, index) => {
        tbody.innerHTML += `
            <tr>
                <td class="fw-bold">#${index + 1}</td>
                <td>${item[0]}</td>
                <td class="text-end">
                    <span class="badge bg-info">${item[1]} veces</span>
                </td>
            </tr>
        `;
    });
}

// =========================================================
// UTILIDADES
// =========================================================

function formatMoney(amount) {
    return '$' + amount.toLocaleString('es-MX', {minimumFractionDigits: 0, maximumFractionDigits: 0});
}

// =========================================================
// FUNCIÓN DE RESPALDO GLOBAL
// =========================================================

function descargarRespaldoGlobal() {
    // Capturar TODAS las bases de datos
    const backupData = {
        inventory: JSON.parse(localStorage.getItem(DB_KEY) || '[]'),
        sales: JSON.parse(localStorage.getItem(SALES_KEY) || '[]'),
        payouts: JSON.parse(localStorage.getItem('perfume_payouts_v1') || '[]'),
        expenses: JSON.parse(localStorage.getItem(EXPENSES_KEY) || '[]'),
        templates: JSON.parse(localStorage.getItem('perfume_templates_v1') || '[]'),
        timestamp: new Date().toISOString(),
        version: '2.0'
    };

    // Crear archivo JSON
    const dataStr = JSON.stringify(backupData, null, 2);
    const blob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    
    // Descargar
    const a = document.createElement('a');
    a.href = url;
    const fecha = new Date().toISOString().slice(0, 10);
    a.download = `FITOSCENTS_RESPALDO_${fecha}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    alert('✅ Respaldo descargado correctamente');
}
