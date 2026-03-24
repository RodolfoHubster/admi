// =========================================================
// SISTEMA DE GASTOS OPERATIVOS
// =========================================================

let listaGastos = [];
let filtroPeriodoActual = 'todos';

function cargarGastos() {
    listaGastos = JSON.parse(localStorage.getItem(EXPENSES_KEY)) || [];
    renderGastos();
    calcularKPIsGastos();
    renderResumenCategorias();
    renderGananciasPorMes();
    buscarGananciasPerfume();
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

    if (!monto || monto <= 0) return showToast('Ingresa un monto válido', 'warning');
    if (!categoria) return showToast('Selecciona una categoría', 'warning');

    const nuevoGasto = {
        id: Date.now(),
        monto,
        categoria,
        concepto: concepto || getCategoriaLabel(categoria),
        quienPago,
        porcentajeSocio,
        fecha: new Date().toISOString(),
        fechaLegible: new Date().toLocaleString('es-MX')
    };

    listaGastos.push(nuevoGasto);
    localStorage.setItem(EXPENSES_KEY, JSON.stringify(listaGastos));
    if (typeof setDataCloud === 'function') {
        setDataCloud('gastos', listaGastos).catch(() => {});
    }

    bootstrap.Modal.getInstance(document.getElementById('modalNuevoGasto')).hide();
    cargarGastos();
    showToast('Gasto registrado correctamente', 'success');
}

function renderGastos() {
    const tbody = document.getElementById('gastos-table-body');
    if (!tbody) return;

    const categoriaFiltro = document.getElementById('filtroCategoriaGasto').value;

    let gastosFiltrados = listaGastos.filter(g => {
        if (categoriaFiltro !== 'todos' && g.categoria !== categoriaFiltro) return false;
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

    gastosFiltrados.sort((a, b) => b.id - a.id);
    document.getElementById('contador-gastos').innerText =
        `${gastosFiltrados.length} gasto${gastosFiltrados.length !== 1 ? 's' : ''}`;

    tbody.innerHTML = '';
    if (gastosFiltrados.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="text-center text-muted p-4">📅 No hay gastos en este periodo/categoría</td></tr>`;
        return;
    }

    gastosFiltrados.forEach(gasto => {
        tbody.innerHTML += `
            <tr>
                <td><small>${gasto.fechaLegible}</small></td>
                <td>${getCategoriaIcon(gasto.categoria)} <span class="badge bg-secondary">${getCategoriaLabel(gasto.categoria)}</span></td>
                <td>${gasto.concepto}</td>
                <td class="fw-bold text-danger">-$${gasto.monto.toFixed(2)}</td>
                <td>${getBadgeQuienPago(gasto)}</td>
                <td>
                    <button class="btn btn-sm btn-outline-danger" onclick="eliminarGasto(${gasto.id})" title="Eliminar">🗑️</button>
                </td>
            </tr>`;
    });
}

function calcularKPIsGastos() {
    const totalGastos = listaGastos.reduce((sum, g) => sum + g.monto, 0);
    const ahora = new Date();
    const gastosMes = listaGastos
        .filter(g => {
            const f = new Date(g.fecha);
            return f.getMonth() === ahora.getMonth() && f.getFullYear() === ahora.getFullYear();
        })
        .reduce((sum, g) => sum + g.monto, 0);

    const hace3meses = new Date();
    hace3meses.setMonth(hace3meses.getMonth() - 3);
    const gastosUltimos3 = listaGastos
        .filter(g => new Date(g.fecha) >= hace3meses)
        .reduce((sum, g) => sum + g.monto, 0);
    const promedioMensual = gastosUltimos3 / 3;

    const ventas = JSON.parse(localStorage.getItem(SALES_KEY)) || [];
    let gananciaVentas = 0;
    ventas.forEach(v => {
        if (v.esCredito) {
            const cobrado = v.precioFinal - (v.saldoPendiente || 0);
            gananciaVentas += v.utilidad * (cobrado / v.precioFinal);
        } else {
            gananciaVentas += v.utilidad;
        }
    });

    const misGastos = _calcMisGastos(listaGastos);

    document.getElementById('total-gastos').innerText = formatMoney(totalGastos);
    document.getElementById('gastos-mes').innerText = formatMoney(gastosMes);
    document.getElementById('gastos-promedio').innerText = formatMoney(promedioMensual);
    document.getElementById('ganancia-neta-real').innerText = formatMoney(gananciaVentas - misGastos);
}

function renderResumenCategorias() {
    const contenedor = document.getElementById('resumen-categorias');
    if (!contenedor) return;

    const totalGeneral = listaGastos.reduce((sum, g) => sum + g.monto, 0);
    const grupos = {};
    listaGastos.forEach(g => {
        grupos[g.categoria] = (grupos[g.categoria] || 0) + g.monto;
    });

    const categoriasOrdenadas = Object.entries(grupos).sort((a, b) => b[1] - a[1]);

    contenedor.innerHTML = '';
    if (categoriasOrdenadas.length === 0) {
        contenedor.innerHTML = '<div class="col-12 text-center text-muted">No hay gastos registrados</div>';
        return;
    }

    categoriasOrdenadas.forEach(([categoria, monto]) => {
        const porcentaje = totalGeneral > 0 ? ((monto / totalGeneral) * 100).toFixed(1) : '0.0';
        contenedor.innerHTML += `
            <div class="col-md-4">
                <div class="card bg-dark">
                    <div class="card-body">
                        <div class="d-flex justify-content-between align-items-center mb-2">
                            <span class="text-white">${getCategoriaIcon(categoria)} ${getCategoriaLabel(categoria)}</span>
                            <span class="badge bg-danger">${porcentaje}%</span>
                        </div>
                        <h4 class="fw-bold text-danger mb-0">$${monto.toFixed(2)}</h4>
                    </div>
                </div>
            </div>`;
    });
}

// =========================================================
// GANANCIAS POR MES
// =========================================================
function renderGananciasPorMes() {
    const tbody = document.getElementById('tabla-ganancias-mes');
    if (!tbody) return;

    const ventas = JSON.parse(localStorage.getItem(SALES_KEY)) || [];
    const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio',
                   'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
    const ahora = new Date();

    // Agrupar ventas por año-mes
    const mapaVentas = {};
    ventas.forEach(v => {
        const fecha = new Date(v.id);
        const key = `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}`;
        if (!mapaVentas[key]) mapaVentas[key] = { bruto: 0, ganancia: 0 };
        mapaVentas[key].bruto += parseFloat(v.precioFinal || 0);
        let miGanancia = parseFloat(v.reparto?.yo || 0);
        if (v.esCredito && v.precioFinal > 0) {
            const cobrado = v.precioFinal - (v.saldoPendiente || 0);
            miGanancia = miGanancia * (cobrado / v.precioFinal);
        }
        mapaVentas[key].ganancia += miGanancia;
    });

    // Agrupar MIS gastos por año-mes
    const mapaGastos = {};
    listaGastos.forEach(g => {
        const fecha = new Date(g.fecha);
        const key = `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}`;
        if (!mapaGastos[key]) mapaGastos[key] = 0;
        mapaGastos[key] += _calcMiParteGasto(g);
    });

    const todasKeys = [...new Set([...Object.keys(mapaVentas), ...Object.keys(mapaGastos)])];
    todasKeys.sort((a, b) => b.localeCompare(a));

    if (todasKeys.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" class="text-center text-muted p-4">No hay datos aún</td></tr>`;
        return;
    }

    tbody.innerHTML = '';
    todasKeys.forEach(key => {
        const [anio, mes] = key.split('-');
        const mesLabel = `${MESES[parseInt(mes) - 1]} ${anio}`;
        const esMesActual = parseInt(anio) === ahora.getFullYear() && parseInt(mes) - 1 === ahora.getMonth();

        const bruto    = mapaVentas[key]?.bruto    || 0;
        const ganancia = mapaVentas[key]?.ganancia || 0;
        const gastos   = mapaGastos[key]           || 0;
        const neta     = ganancia - gastos;
        const colorNeta = neta >= 0 ? 'text-success' : 'text-danger';

        tbody.innerHTML += `
            <tr ${esMesActual ? 'class="table-active"' : ''}>
                <td>
                    <strong>${mesLabel}</strong>
                    ${esMesActual ? '<span class="badge bg-warning text-dark ms-2">Actual</span>' : ''}
                </td>
                <td class="text-end">$${bruto.toFixed(2)}</td>
                <td class="text-end text-success fw-bold">+$${ganancia.toFixed(2)}</td>
                <td class="text-end text-danger">-$${gastos.toFixed(2)}</td>
                <td class="text-end fw-bold ${colorNeta}">$${neta.toFixed(2)}</td>
            </tr>`;
    });
}

// =========================================================
// GANANCIAS POR PERFUME
// =========================================================
function buscarGananciasPerfume() {
    const contenedor = document.getElementById('resultado-perfume');
    if (!contenedor) return;

    const query = (document.getElementById('inputBuscarPerfume')?.value || '').trim().toLowerCase();
    const ventas = JSON.parse(localStorage.getItem(SALES_KEY)) || [];

    const mapaProductos = {};
    ventas.forEach(v => {
        const nombre = v.producto || 'Sin nombre';
        if (!mapaProductos[nombre]) mapaProductos[nombre] = { unidades: 0, bruto: 0, ganancia: 0 };
        mapaProductos[nombre].unidades += 1;
        mapaProductos[nombre].bruto    += parseFloat(v.precioFinal || 0);
        let miGanancia = parseFloat(v.reparto?.yo || 0);
        if (v.esCredito && v.precioFinal > 0) {
            const cobrado = v.precioFinal - (v.saldoPendiente || 0);
            miGanancia = miGanancia * (cobrado / v.precioFinal);
        }
        mapaProductos[nombre].ganancia += miGanancia;
    });

    let resultados = Object.entries(mapaProductos);
    if (query) {
        resultados = resultados.filter(([nombre]) => nombre.toLowerCase().includes(query));
    }
    resultados.sort((a, b) => b[1].ganancia - a[1].ganancia);

    if (resultados.length === 0) {
        contenedor.innerHTML = `<div class="col-12 text-center text-muted py-3">
            ${query ? '🔍 No se encontró ningún perfume con ese nombre' : 'No hay ventas registradas'}
        </div>`;
        return;
    }

    contenedor.innerHTML = '';
    resultados.forEach(([nombre, datos]) => {
        contenedor.innerHTML += `
            <div class="col-md-4">
                <div class="card h-100">
                    <div class="card-body">
                        <h6 class="fw-bold mb-3">🧴 ${nombre}</h6>
                        <div class="d-flex justify-content-between mb-1">
                            <small class="text-muted">Unidades vendidas</small>
                            <span class="badge bg-secondary">${datos.unidades}</span>
                        </div>
                        <div class="d-flex justify-content-between mb-1">
                            <small class="text-muted">Ventas brutas</small>
                            <span class="text-primary fw-bold">$${datos.bruto.toFixed(2)}</span>
                        </div>
                        <div class="d-flex justify-content-between">
                            <small class="text-muted">Mi ganancia</small>
                            <span class="text-success fw-bold">+$${datos.ganancia.toFixed(2)}</span>
                        </div>
                    </div>
                </div>
            </div>`;
    });
}

// =========================================================
// HELPERS PRIVADOS
// =========================================================
function _calcMiParteGasto(g) {
    if (g.quienPago === 'mio')   return g.monto;
    if (g.quienPago === 'socio') return 0;
    if (g.quienPago === 'mitad') return g.monto * 0.5;
    if (g.quienPago === 'personalizado')
        return g.monto * ((100 - (g.porcentajeSocio || 0)) / 100);
    return g.monto;
}

function _calcMisGastos(gastos) {
    return gastos.reduce((sum, g) => sum + _calcMiParteGasto(g), 0);
}

// =========================================================
// ELIMINAR GASTO
// =========================================================
function eliminarGasto(id) {
    if (!solicitarPin()) return;
    showConfirm('¿Eliminar este gasto? Esta acción no se puede deshacer.', () => {
        listaGastos = listaGastos.filter(g => g.id !== id);
        localStorage.setItem(EXPENSES_KEY, JSON.stringify(listaGastos));
        if (typeof setDataCloud === 'function') setDataCloud('gastos', listaGastos).catch(() => {});
        cargarGastos();
        showToast('Gasto eliminado', 'warning');
    });
}

// =========================================================
// FILTRO DE PERIODO
// =========================================================
function setFiltroPeriodoGasto(periodo, btn) {
    filtroPeriodoActual = periodo;
    const grupo = btn.parentElement.querySelectorAll('.btn');
    grupo.forEach(b => {
        b.classList.remove('active', 'btn-primary', 'btn-warning');
        b.classList.add('btn-outline-secondary');
    });
    btn.classList.remove('btn-outline-secondary');
    btn.classList.add('active');
    renderGastos();
}

// =========================================================
// HELPERS DE CATEGORÍA
// =========================================================
function getCategoriaLabel(cat) {
    const labels = { envio:'Envío/Paquetería', gasolina:'Gasolina', publicidad:'Publicidad',
                     comisiones:'Comisiones', operacion:'Operación', otro:'Otro' };
    return labels[cat] || cat;
}
function getCategoriaIcon(cat) {
    const icons = { envio:'📦', gasolina:'⛽', publicidad:'📣', comisiones:'💳', operacion:'🔧', otro:'❓' };
    return icons[cat] || '💸';
}
function getBadgeQuienPago(gasto) {
    if (gasto.quienPago === 'mio')   return '<span class="badge bg-primary">Yo</span>';
    if (gasto.quienPago === 'socio') return '<span class="badge bg-info text-dark">Socio</span>';
    if (gasto.quienPago === 'mitad') return '<span class="badge bg-warning text-dark">50/50</span>';
    if (gasto.quienPago === 'personalizado') {
        const pctMio = 100 - (gasto.porcentajeSocio || 0);
        return `<span class="badge bg-secondary">${pctMio}% Yo / ${gasto.porcentajeSocio}% Socio</span>`;
    }
    return '-';
}
