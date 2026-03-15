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

    const misGastos = listaGastos.reduce((sum, g) => {
        let miParte = 0;
        if (g.quienPago === 'mio') miParte = g.monto;
        else if (g.quienPago === 'mitad') miParte = g.monto * 0.5;
        else if (g.quienPago === 'personalizado') miParte = g.monto * ((100 - (g.porcentajeSocio || 0)) / 100);
        return sum + miParte;
    }, 0);

    document.getElementById('total-gastos').innerText = formatMoney(totalGastos);
    document.getElementById('gastos-mes').innerText = formatMoney(gastosMes);
    document.getElementById('gastos-promedio').innerText = formatMoney(promedioMensual);
    document.getElementById('ganancia-neta-real').innerText = formatMoney(gananciaVentas - misGastos);
}

function renderResumenCategorias() {
    const contenedor = document.getElementById('resumen-categorias');
    if (!contenedor) return;

    // FIX O(n²): calcular total UNA sola vez fuera del loop
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
                <div class="card bg-light">
                    <div class="card-body">
                        <div class="d-flex justify-content-between align-items-center mb-2">
                            <span>${getCategoriaIcon(categoria)} ${getCategoriaLabel(categoria)}</span>
                            <span class="badge bg-danger">${porcentaje}%</span>
                        </div>
                        <h4 class="fw-bold text-danger mb-0">$${monto.toFixed(2)}</h4>
                    </div>
                </div>
            </div>`;
    });
}

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

function getCategoriaLabel(cat) {
    const labels = { envio:'Envío/Paquetería', gasolina:'Gasolina', publicidad:'Publicidad', comisiones:'Comisiones', operacion:'Operación', otro:'Otro' };
    return labels[cat] || cat;
}
function getCategoriaIcon(cat) {
    const icons = { envio:'📦', gasolina:'⛽', publicidad:'📣', comisiones:'💳', operacion:'🔧', otro:'❓' };
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
