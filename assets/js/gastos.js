// =========================================================
// SISTEMA DE GASTOS OPERATIVOS
// =========================================================

let listaGastos = [];
let filtroPeriodoActual = 'todos';

// =========================================================
// FUNCIONES PRINCIPALES
// =========================================================

function cargarGastos() {
    listaGastos = JSON.parse(localStorage.getItem(EXPENSES_KEY)) || [];
    renderGastos();
    calcularKPIsGastos();
    renderResumenCategorias();
}

function abrirModalNuevoGasto() {
    document.getElementById('form-nuevo-gasto').reset();
    document.getElementById('div-porcentaje-gasto').style.display = 'none';
    new bootstrap.Modal(document.getElementById('modalNuevoGasto')).show();
}

function togglePorcentajeGasto() {
    const sel = document.getElementById('inputQuienPago');
    const div = document.getElementById('div-porcentaje-gasto');
    div.style.display = (sel.value === 'personalizado') ? 'block' : 'none';
}

function guardarGasto() {
    const monto = parseFloat(document.getElementById('inputMontoGasto').value);
    const categoria = document.getElementById('inputCategoriaGasto').value;
    const concepto = document.getElementById('inputConceptoGasto').value.trim();
    const quienPago = document.getElementById('inputQuienPago').value;
    const porcentajeSocio = parseFloat(document.getElementById('inputPorcentajeGasto').value) || 0;

    if (!monto || monto <= 0) return alert('⚠️ Ingresa un monto válido');
    if (!categoria) return alert('⚠️ Selecciona una categoría');

    const nuevoGasto = {
        id: Date.now(),
        monto: monto,
        categoria: categoria,
        concepto: concepto || getCategoriaLabel(categoria),
        quienPago: quienPago,
        porcentajeSocio: porcentajeSocio,
        fecha: new Date().toISOString(),
        fechaLegible: new Date().toLocaleString('es-MX')
    };

    listaGastos.push(nuevoGasto);
    localStorage.setItem(EXPENSES_KEY, JSON.stringify(listaGastos));

    bootstrap.Modal.getInstance(document.getElementById('modalNuevoGasto')).hide();
    cargarGastos();
    alert('✅ Gasto registrado correctamente');
}

function renderGastos() {
    const tbody = document.getElementById('gastos-table-body');
    if (!tbody) return;

    // Aplicar filtros
    const categoriaFiltro = document.getElementById('filtroCategoriaGasto').value;
    
    let gastosFiltrados = listaGastos.filter(g => {
        // Filtro de categoría
        if (categoriaFiltro !== 'todos' && g.categoria !== categoriaFiltro) return false;

        // Filtro de periodo
        if (filtroPeriodoActual !== 'todos') {
            const fechaGasto = new Date(g.fecha);
            const ahora = new Date();
            
            if (filtroPeriodoActual === 'mes') {
                if (fechaGasto.getMonth() !== ahora.getMonth() || 
                    fechaGasto.getFullYear() !== ahora.getFullYear()) return false;
            } else if (filtroPeriodoActual === 'semana') {
                const hace7dias = new Date();
                hace7dias.setDate(hace7dias.getDate() - 7);
                if (fechaGasto < hace7dias) return false;
            }
        }

        return true;
    });

    // Ordenar por fecha (más reciente primero)
    gastosFiltrados.sort((a, b) => b.id - a.id);

    // Actualizar contador
    document.getElementById('contador-gastos').innerText = `${gastosFiltrados.length} gasto${gastosFiltrados.length !== 1 ? 's' : ''}`;

    // Renderizar
    tbody.innerHTML = '';
    
    if (gastosFiltrados.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6" class="text-center text-muted p-4">
                    📅 No hay gastos en este periodo/categoría
                </td>
            </tr>
        `;
        return;
    }

    gastosFiltrados.forEach(gasto => {
        const row = `
            <tr>
                <td><small>${gasto.fechaLegible}</small></td>
                <td>${getCategoriaIcon(gasto.categoria)} <span class="badge bg-secondary">${getCategoriaLabel(gasto.categoria)}</span></td>
                <td>${gasto.concepto}</td>
                <td class="fw-bold text-danger">-$${gasto.monto.toFixed(2)}</td>
                <td>${getBadgeQuienPago(gasto)}</td>
                <td>
                    <button class="btn btn-sm btn-outline-danger" onclick="eliminarGasto(${gasto.id})" title="Eliminar">
                        🗑️
                    </button>
                </td>
            </tr>
        `;
        tbody.innerHTML += row;
    });
}

function calcularKPIsGastos() {
    // Total histórico
    const totalGastos = listaGastos.reduce((sum, g) => sum + g.monto, 0);

    // Gastos del mes actual
    const ahora = new Date();
    const gastosMes = listaGastos.filter(g => {
        const fecha = new Date(g.fecha);
        return fecha.getMonth() === ahora.getMonth() && fecha.getFullYear() === ahora.getFullYear();
    }).reduce((sum, g) => sum + g.monto, 0);

    // Promedio últimos 3 meses
    const hace3meses = new Date();
    hace3meses.setMonth(hace3meses.getMonth() - 3);
    const gastosUltimos3Meses = listaGastos.filter(g => new Date(g.fecha) >= hace3meses);
    const promedioMensual = gastosUltimos3Meses.length > 0 ? 
        gastosUltimos3Meses.reduce((sum, g) => sum + g.monto, 0) / 3 : 0;

    // Ganancia neta (ventas - gastos)
    const ventas = JSON.parse(localStorage.getItem(SALES_KEY)) || [];
    let gananciaVentas = 0;
    
    ventas.forEach(venta => {
        if (venta.esCredito) {
            const cobrado = venta.precioFinal - (venta.saldoPendiente || 0);
            const porcentajeCobrado = cobrado / venta.precioFinal;
            gananciaVentas += venta.utilidad * porcentajeCobrado;
        } else {
            gananciaVentas += venta.utilidad;
        }
    });

    // Solo restar MIS gastos (no los del socio)
    const misGastos = listaGastos.reduce((sum, g) => {
        let miParte = 0;
        if (g.quienPago === 'mio') miParte = g.monto;
        else if (g.quienPago === 'mitad') miParte = g.monto * 0.5;
        else if (g.quienPago === 'personalizado') {
            const pctMio = 100 - (g.porcentajeSocio || 0);
            miParte = g.monto * (pctMio / 100);
        }
        return sum + miParte;
    }, 0);

    const gananciaNeta = gananciaVentas - misGastos;

    // Actualizar UI
    document.getElementById('total-gastos').innerText = formatMoney(totalGastos);
    document.getElementById('gastos-mes').innerText = formatMoney(gastosMes);
    document.getElementById('gastos-promedio').innerText = formatMoney(promedioMensual);
    document.getElementById('ganancia-neta-real').innerText = formatMoney(gananciaNeta);
}

function renderResumenCategorias() {
    const contenedor = document.getElementById('resumen-categorias');
    if (!contenedor) return;

    // Agrupar gastos por categoría
    const grupos = {};
    listaGastos.forEach(g => {
        if (!grupos[g.categoria]) grupos[g.categoria] = 0;
        grupos[g.categoria] += g.monto;
    });

    // Ordenar por monto (mayor a menor)
    const categoriasOrdenadas = Object.entries(grupos).sort((a, b) => b[1] - a[1]);

    contenedor.innerHTML = '';
    
    if (categoriasOrdenadas.length === 0) {
        contenedor.innerHTML = '<div class="col-12 text-center text-muted">No hay gastos registrados</div>';
        return;
    }

    categoriasOrdenadas.forEach(([categoria, monto]) => {
        const porcentaje = ((monto / listaGastos.reduce((sum, g) => sum + g.monto, 0)) * 100).toFixed(1);
        
        contenedor.innerHTML += `
            <div class="col-md-4">
                <div class="card bg-light">
                    <div class="card-body">
                        <div class="d-flex justify-content-between align-items-center mb-2">
                            <span>${getCategoriaIcon(categoria)} ${getCategoriaLabel(categoria)}</span>
                            <span class="badge bg-danger">${porcentaje}%</span>
                        </div>
                        <h4 class="fw-bold text-danger mb-0">$${monto.toFixed(2)}</h4>
                    </div>
                </div>
            </div>
        `;
    });
}

function eliminarGasto(id) {
    if (!solicitarPin()) return;
    
    if (confirm('¿Eliminar este gasto?')) {
        listaGastos = listaGastos.filter(g => g.id !== id);
        localStorage.setItem(EXPENSES_KEY, JSON.stringify(listaGastos));
        cargarGastos();
    }
}

function setFiltroPeriodoGasto(periodo, btn) {
    filtroPeriodoActual = periodo;
    
    const grupo = btn.parentElement.querySelectorAll('.btn');
    grupo.forEach(b => {
        b.classList.remove('active', 'btn-primary');
        b.classList.add('btn-outline-secondary');
    });
    
    btn.classList.remove('btn-outline-secondary');
    btn.classList.add('active', 'btn-primary');
    
    renderGastos();
}

// =========================================================
// FUNCIONES AUXILIARES
// =========================================================

function getCategoriaLabel(cat) {
    const labels = {
        'envio': 'Envío/Paquetería',
        'gasolina': 'Gasolina',
        'publicidad': 'Publicidad',
        'comisiones': 'Comisiones',
        'operacion': 'Operación',
        'otro': 'Otro'
    };
    return labels[cat] || cat;
}

function getCategoriaIcon(cat) {
    const icons = {
        'envio': '📦',
        'gasolina': '⛽',
        'publicidad': '📣',
        'comisiones': '💳',
        'operacion': '🔧',
        'otro': '❓'
    };
    return icons[cat] || '💸';
}

function getBadgeQuienPago(gasto) {
    if (gasto.quienPago === 'mio') return '<span class="badge bg-primary">Yo</span>';
    if (gasto.quienPago === 'socio') return '<span class="badge bg-info text-dark">Socio</span>';
    if (gasto.quienPago === 'mitad') return '<span class="badge bg-warning text-dark">50/50</span>';
    if (gasto.quienPago === 'personalizado') {
        const pctMio = 100 - (gasto.porcentajeSocio || 0);
        return `<span class="badge bg-secondary">${pctMio}% Yo / ${gasto.porcentajeSocio}% Socio</span>`;
    }
    return '-';
}

function formatMoney(amount) {
    return '$' + amount.toLocaleString('es-MX', {minimumFractionDigits: 2, maximumFractionDigits: 2});
}
