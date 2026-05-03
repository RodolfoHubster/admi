// =========================================================
// DECANTS.JS — Gestión de frascos Fitoscents
// Colección Firebase: 'decants_fuentes' y 'decants_ventas'
// =========================================================

const DECANTS_FUENTES_KEY  = 'decants_fuentes';
const DECANTS_VENTAS_KEY   = 'decants_ventas';
const TALLAS_DEFAULT       = [2, 3, 5, 8, 10, 15, 20, 30];

let _fuentes  = [];
let _ventasD  = [];
let _tallasFila = [];

// Paginación — Fuentes
let _paginaFuentes = 1;
let _tamFuentes    = 15;

// Paginación — Historial ventas decants
let _paginaVentasD = 1;
let _tamVentasD    = 15;

// Drag & Drop — tallas
let _dndSrcIdx = null;

// =========================================================
// INIT
// =========================================================
document.addEventListener('DOMContentLoaded', async () => {
    if (typeof initApp === 'function') await initApp();
    await initDecants();
    await cargarDatosDecants();
    verificarPrecarga();
    renderTallasDefault();
    document.getElementById('venta-cantidad')?.addEventListener('input', validarMLDisponibles);
    document.getElementById('venta-fuente-id')?.addEventListener('change', validarMLDisponibles);
});

async function initDecants() {
    if (typeof waitForFirebase === 'function') await waitForFirebase();
}

async function cargarDatosDecants() {
    _fuentes = await getDecantsData(DECANTS_FUENTES_KEY) || [];
    _ventasD = await getDecantsData(DECANTS_VENTAS_KEY)  || [];
    cargarFuentes();
    cargarHistorialVentas();
    actualizarKPIs();
    llenarSelectFuentes();
}

// =========================================================
// LECTURA/ESCRITURA FIREBASE + FALLBACK LOCAL
// =========================================================
async function getDecantsData(key) {
    if (typeof getData === 'function') return await getData(key);
    if (typeof getDataCloud === 'function') return await getDataCloud(key);
    const localKey = resolveDecantsStorageKey(key);
    const raw = localStorage.getItem(localKey);
    return raw ? JSON.parse(raw) : [];
}

async function saveDecantsData(key, data) {
    if (typeof setData === 'function') {
        setData(key, data);
        return;
    }
    if (typeof setDataCloud === 'function') {
        await setDataCloud(key, data);
        return;
    }
    const localKey = resolveDecantsStorageKey(key);
    localStorage.setItem(localKey, JSON.stringify(data));
}

function resolveDecantsStorageKey(key) {
    return (typeof STORAGE_KEYS !== 'undefined' && STORAGE_KEYS[key]) ? STORAGE_KEYS[key] : key;
}

function crearTallasSugeridasDesdeBotella(preCarga, mlTotal) {
    const precioBotella = parseFloat(preCarga?.precioVentaBotella ?? preCarga?.precioVenta) || 0;
    const precioPorMl = (mlTotal > 0 && precioBotella > 0) ? (precioBotella / mlTotal) : 0;
    const precio5 = precioPorMl > 0 ? Math.round(precioPorMl * 5) : 0;
    const precio10 = precioPorMl > 0 ? Math.round(precioPorMl * 10) : 0;
    return [{ ml: 5, precio: precio5 }, { ml: 10, precio: precio10 }];
}

// =========================================================
// PRECARGA DESDE INVENTARIO (botón 🧪) — SIN prompt()
// =========================================================
function verificarPrecarga() {
    const raw = localStorage.getItem('decant_precarga_tmp');
    if (!raw) return;
    localStorage.removeItem('decant_precarga_tmp');
    const p = JSON.parse(raw);

    // Crear modal dinámico si no existe
    let modal = document.getElementById('__modal-precarga-ml');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = '__modal-precarga-ml';
        modal.className = 'modal fade';
        modal.tabIndex = -1;
        modal.innerHTML = `
        <div class="modal-dialog modal-sm modal-dialog-centered">
            <div class="modal-content bg-dark text-white border border-warning">
                <div class="modal-header border-secondary pb-2">
                    <h6 class="modal-title fw-bold">🧪 Nueva Botella Fuente</h6>
                    <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
                </div>
                <div class="modal-body py-3">
                    <p class="small mb-3" id="__precarga-nombre-label"></p>
                    <label class="form-label small fw-bold">¿Cuántos ml tiene la botella?</label>
                    <input type="number" id="__precarga-ml-input" class="form-control bg-dark text-white border-secondary"
                        placeholder="Ej: 100" min="1" value="100">
                </div>
                <div class="modal-footer border-secondary pt-2 gap-2">
                    <button class="btn btn-secondary btn-sm" data-bs-dismiss="modal" id="__precarga-cancelar">Cancelar — editar manualmente</button>
                    <button class="btn btn-warning btn-sm fw-bold" id="__precarga-confirmar">Guardar 🔥</button>
                </div>
            </div>
        </div>`;
        document.body.appendChild(modal);
    }

document.getElementById('__precarga-nombre-label').innerHTML =
        `<strong>${p.nombre}</strong> <span class="text-muted">${p.marca || 'Sin marca'}</span><br>
        <span class="text-warning">💰 Costo compra: $${p.precioCompra ?? p.costo ?? 0}</span>
        ${p.precioVentaBotella || p.precioVenta ? `· <span class="text-info">🏷️ Precio venta botella: $${p.precioVentaBotella || p.precioVenta || 0}</span>` : ''}`;
    document.getElementById('__precarga-ml-input').value = 100;

    const bsModal = new bootstrap.Modal(modal);
    bsModal.show();

    // Cancelar → abrir modal completo con datos precargados
    document.getElementById('__precarga-cancelar').onclick = () => {
        bsModal.hide();
        resetFormFuente();
        document.getElementById('fuente-nombre').value = p.nombre  || '';
        document.getElementById('fuente-marca').value  = p.marca   || '';
        document.getElementById('fuente-imagen').value = p.imagen  || '';
        document.getElementById('fuente-costo').value  = p.costo   || '';
        setTimeout(() => new bootstrap.Modal(document.getElementById('modalNuevaFuente')).show(), 400);
    };

    // Confirmar → guardar directo en Firebase
    document.getElementById('__precarga-confirmar').onclick = async () => {
        const mlTotal = parseFloat(document.getElementById('__precarga-ml-input').value) || 100;
        bsModal.hide();

        const nuevaFuente = {
            id:        'fuente_' + Date.now(),
            nombre:    p.nombre  || '',
            marca:     p.marca   || '',
            mlTotal,
            mlUsados:  0,
            costo:     parseFloat(p.precioCompra ?? p.costo) || 0,
            imagen:    p.imagen  || 'https://cdn-icons-png.flaticon.com/512/2636/2636280.png',
            tallas:    crearTallasSugeridasDesdeBotella(p, mlTotal),
            notas:     'Agregado desde inventario',
            createdAt: new Date().toISOString()
        };

        _fuentes.push(nuevaFuente);
        try {
            await saveDecantsData(DECANTS_FUENTES_KEY, _fuentes);
            cargarFuentes();
            actualizarKPIs();
            llenarSelectFuentes();
            mostrarToast(`🔥 "${p.nombre}" guardado en Firebase (${mlTotal}ml)`, 'success');
        } catch (e) {
            console.error('Error Firebase:', e);
            mostrarToast('❌ Error al conectar con la base de datos.', 'danger');
        }
    };
}

// =========================================================
// TABLA FUENTES
// =========================================================
function filtrarFuentes()  { _paginaFuentes = 1; cargarFuentes(); }
function filtrarVentasD()  { _paginaVentasD = 1; cargarHistorialVentas(); }

function cargarFuentes() {
    const tbody    = document.getElementById('tabla-fuentes');
    const busqueda = (document.getElementById('buscador-fuentes')?.value || '').toLowerCase();
    const filtroStock = document.getElementById('filtro-stock-fuentes')?.value || 'todos';
    const lista = _fuentes.filter(f => {
        const texto = (f.nombre + ' ' + (f.marca || '')).toLowerCase();
        if (!texto.includes(busqueda)) return false;
        const mlTotal = f.mlTotal || 0;
        const mlDisp = mlTotal - (f.mlUsados || 0);
        const esBajo = mlDisp > 0 && mlTotal > 0 && mlDisp <= (mlTotal * 0.2);
        if (filtroStock === 'agotado') return mlDisp <= 0;
        if (filtroStock === 'bajo') return esBajo;
        if (filtroStock === 'disponible') return mlDisp > 0 && !esBajo;
        // 'todos' muestra solo los NO agotados; los agotados aparecen en la sección inferior
        return mlDisp > 0;
    });

    const totalFuentes = lista.length;
    const showAll      = _tamFuentes <= 0;
    const totalPages   = showAll ? 1 : Math.ceil(totalFuentes / _tamFuentes);
    _paginaFuentes     = Math.max(1, Math.min(_paginaFuentes, totalPages || 1));
    const inicio       = showAll ? 0 : (_paginaFuentes - 1) * _tamFuentes;
    const fin          = showAll ? totalFuentes : Math.min(inicio + _tamFuentes, totalFuentes);
    const pagina       = lista.slice(inicio, fin);

    if (!lista.length) {
        tbody.innerHTML = `<tr><td colspan="7" class="text-center text-muted py-4">
            Sin fuentes. Usa "Nueva Fuente" para agregar una botella.
        </td></tr>`;
    } else {
        tbody.innerHTML = pagina.map(f => {
            const mlDisp = (f.mlTotal || 0) - (f.mlUsados || 0);
            const pct    = f.mlTotal ? Math.round(((f.mlUsados||0) / f.mlTotal) * 100) : 0;
            const badgeCls = mlDisp <= 0 ? 'badge-ml-low' : mlDisp < (f.mlTotal * 0.2) ? 'badge-ml-mid' : 'badge-ml-avail';
            const img    = f.imagen || 'https://cdn-icons-png.flaticon.com/512/2636/2636280.png';
            const tallasHTML = (f.tallas || []).map(t =>
                `<span class="badge bg-secondary ml-badge me-1">${t.ml}ml $${t.precio}</span>`
            ).join('');
            const contVentas = _ventasD.filter(v => v.fuenteId === f.id).length;

            return `
            <tr class="fuente-row">
                <td><img src="${img}" class="img-decant-thumb"></td>
                <td>
                    <strong>${f.nombre}</strong><br>
                    <small class="text-muted">${f.marca || ''}</small>
                </td>
                <td>${tallasHTML || '<span class="text-muted small">Sin tallas</span>'}</td>
                <td>
                    <div class="progress progress-ml mb-1">
                        <div class="progress-bar bg-warning" style="width:${pct}%"></div>
                    </div>
                    <small class="text-muted">${f.mlUsados || 0} / ${f.mlTotal || 0} ml usados</small>
                </td>
                <td><span class="badge ml-badge ${badgeCls}">${mlDisp} ml</span></td>
                <td><span class="badge bg-info bg-opacity-25 text-info border border-info">${contVentas} 💧</span></td>
                <td class="text-center">
                    <div class="d-flex gap-1 justify-content-center flex-wrap">
                        <button class="btn btn-sm btn-outline-success" onclick="abrirVentaRapida('${f.id}')" title="Vender decant">
                            <i class="bi bi-cash-coin"></i>
                        </button>
                        <button class="btn btn-sm btn-outline-info" onclick="abrirVentaBotella('${f.id}')" title="Vender botella con remanente">
                            🍾
                        </button>
                        <button class="btn btn-sm btn-outline-warning" onclick="editarFuente('${f.id}')" title="Editar">
                            <i class="bi bi-pencil"></i>
                        </button>
                        <button class="btn btn-sm btn-outline-secondary" onclick="abrirAjusteML('${f.id}')" title="Ajustar ml">
                            🔧
                        </button>
                        <button class="btn btn-sm btn-outline-danger" onclick="eliminarFuente('${f.id}')" title="Eliminar">
                            <i class="bi bi-trash"></i>
                        </button>
                    </div>
                </td>
            </tr>`;
        }).join('');
    }

    if (typeof renderPaginacion === 'function') {
        renderPaginacion('paginacion-fuentes', totalFuentes, _paginaFuentes, _tamFuentes, 'cambiarPaginaFuentes', 'cambiarTamFuentes');
    }

    cargarFuentesAgotadas();
}

function cambiarPaginaFuentes(page) { _paginaFuentes = page; cargarFuentes(); }
function cambiarTamFuentes(size)    { _tamFuentes = size; _paginaFuentes = 1; cargarFuentes(); }

// =========================================================
// SECCIÓN AGOTADOS
// =========================================================
function cargarFuentesAgotadas() {
    const seccion = document.getElementById('seccion-agotados');
    const tbody   = document.getElementById('tabla-agotados');
    const badge   = document.getElementById('badge-count-agotados');
    if (!seccion || !tbody) return;

    const agotados = _fuentes.filter(f => ((f.mlTotal || 0) - (f.mlUsados || 0)) <= 0);

    if (!agotados.length) {
        seccion.style.display = 'none';
        return;
    }

    seccion.style.display = '';
    if (badge) badge.textContent = agotados.length;

    tbody.innerHTML = agotados.map(f => {
        const img        = f.imagen || 'https://cdn-icons-png.flaticon.com/512/2636/2636280.png';
        const contVentas = _ventasD.filter(v => v.fuenteId === f.id).length;
        return `
        <tr>
            <td><img src="${img}" class="img-decant-thumb"></td>
            <td>
                <strong>${f.nombre}</strong><br>
                <small class="text-muted">${f.marca || ''}</small>
            </td>
            <td><small class="text-muted">${f.mlTotal || 0} ml · Costo: $${f.costo || 0}</small></td>
            <td><span class="badge bg-info bg-opacity-25 text-info border border-info">${contVentas} 💧</span></td>
            <td class="text-center">
                <div class="d-flex gap-1 justify-content-center flex-wrap">
                    <button class="btn btn-sm btn-success fw-bold" onclick="abrirRestock('${f.id}')" title="Reabastecer">
                        🔄 Restock
                    </button>
                    <button class="btn btn-sm btn-outline-danger" onclick="eliminarFuente('${f.id}')" title="Eliminar">
                        <i class="bi bi-trash"></i>
                    </button>
                </div>
            </td>
        </tr>`;
    }).join('');
}

function abrirRestock(id) {
    const f = _fuentes.find(x => x.id === id);
    if (!f) return;
    document.getElementById('restock-id').value           = id;
    document.getElementById('restock-nombre').textContent = f.nombre;
    document.getElementById('restock-ml').value           = '';
    document.getElementById('restock-costo').value        = '';
    new bootstrap.Modal(document.getElementById('modalRestock')).show();
}

function guardarRestock() {
    const id    = document.getElementById('restock-id').value;
    const ml    = parseFloat(document.getElementById('restock-ml').value) || 0;
    const costo = parseFloat(document.getElementById('restock-costo').value) || 0;
    if (!ml) { mostrarToast('⚠️ Ingresa los ml de la nueva botella.', 'warning'); return; }
    const idx = _fuentes.findIndex(f => f.id === id);
    if (idx === -1) return;
    _fuentes[idx].mlTotal  = ml;
    _fuentes[idx].mlUsados = 0;
    if (costo > 0) _fuentes[idx].costo = costo;
    _fuentes[idx].updatedAt = new Date().toISOString();
    saveDecantsData(DECANTS_FUENTES_KEY, _fuentes).then(() => {
        bootstrap.Modal.getInstance(document.getElementById('modalRestock'))?.hide();
        cargarFuentes();
        actualizarKPIs();
        llenarSelectFuentes();
        mostrarToast(`🔄 Restock de "${_fuentes[idx].nombre}" registrado (${ml}ml)`, 'success');
    });
}


function cargarHistorialVentas() {
    const tbody = document.getElementById('tabla-ventas-decants');
    const badge = document.getElementById('badge-total-ventas');
    const busqueda = (document.getElementById('buscador-ventas-decants')?.value || '').trim().toLowerCase();
    const filtroPeriodo = document.getElementById('filtro-ventas-decants')?.value || 'todos';
    const ahora = new Date();
    const inicioHoy = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate());

    if (!_ventasD.length) {
        if (badge) badge.textContent = '0 ventas';
        tbody.innerHTML = `<tr><td colspan="7" class="text-center text-muted py-3">Sin ventas registradas</td></tr>`;
        if (typeof renderPaginacion === 'function') renderPaginacion('paginacion-ventas-decants', 0, 1, _tamVentasD, 'cambiarPaginaVentasD', 'cambiarTamVentasD');
        return;
    }

    const filtradas = _ventasD.filter(v => {
        const fechaVenta = new Date(v.fecha);
        if (filtroPeriodo === 'hoy' && fechaVenta < inicioHoy) return false;
        if (filtroPeriodo === '7dias' && fechaVenta < new Date(ahora.getTime() - 7 * 24 * 60 * 60 * 1000)) return false;
        if (filtroPeriodo === '30dias' && fechaVenta < new Date(ahora.getTime() - 30 * 24 * 60 * 60 * 1000)) return false;
        if (!busqueda) return true;
        const fuente = _fuentes.find(f => f.id === v.fuenteId);
        const nombre = fuente ? fuente.nombre : (v.nombrePerfume || '');
        const texto = `${nombre} ${v.cliente || ''} ${v.marca || ''} ${v.ml || ''}`.toLowerCase();
        return texto.includes(busqueda);
    });
    const ordenadas = [...filtradas].sort((a, b) => new Date(b.fecha) - new Date(a.fecha));

    const totalVentasD = ordenadas.length;
    if (badge) badge.textContent = `${totalVentasD}/${_ventasD.length} ventas`;

    const showAll    = _tamVentasD <= 0;
    const totalPages = showAll ? 1 : Math.ceil(totalVentasD / _tamVentasD);
    _paginaVentasD   = Math.max(1, Math.min(_paginaVentasD, totalPages || 1));
    const inicio     = showAll ? 0 : (_paginaVentasD - 1) * _tamVentasD;
    const fin        = showAll ? totalVentasD : Math.min(inicio + _tamVentasD, totalVentasD);
    const pagina     = ordenadas.slice(inicio, fin);

    if (!pagina.length) {
        tbody.innerHTML = `<tr><td colspan="7" class="text-center text-muted py-3">No hay ventas que coincidan con el filtro</td></tr>`;
    } else {
        tbody.innerHTML = pagina.map(v => {
        const fuente   = _fuentes.find(f => f.id === v.fuenteId);
        const nombre   = fuente ? fuente.nombre : (v.nombrePerfume || '-');
        const ganancia = (v.precio || 0) - (v.costoAprox || 0);
        const fecha    = new Date(v.fecha).toLocaleDateString('es-MX', { day:'2-digit', month:'short', year:'2-digit' });
        return `
        <tr>
            <td><small class="text-muted">${fecha}</small></td>
            <td><strong>${nombre}</strong></td>
            <td><span class="badge bg-secondary ml-badge">${v.ml}ml</span></td>
            <td class="fw-bold">$${v.precio}</td>
            <td class="text-muted small">$${(v.costoAprox||0).toFixed(0)}</td>
            <td class="text-success fw-bold">+$${ganancia.toFixed(0)}</td>
            <td><small>${v.cliente || '-'}</small></td>
        </tr>`;
    }).join('');
    }

    if (typeof renderPaginacion === 'function') {
        renderPaginacion('paginacion-ventas-decants', totalVentasD, _paginaVentasD, _tamVentasD, 'cambiarPaginaVentasD', 'cambiarTamVentasD');
    }
}

function cambiarPaginaVentasD(page) { _paginaVentasD = page; cargarHistorialVentas(); }
function cambiarTamVentasD(size)    { _tamVentasD = size; _paginaVentasD = 1; cargarHistorialVentas(); }

// =========================================================
// KPIs
// =========================================================
function actualizarKPIs() {
    const activas  = _fuentes.filter(f => ((f.mlTotal||0) - (f.mlUsados||0)) > 0);
    const mlTotal  = activas.reduce((s, f) => s + ((f.mlTotal||0) - (f.mlUsados||0)), 0);
    const ganancia = _ventasD.reduce((s, v)  => s + ((v.precio||0)  - (v.costoAprox||0)), 0);
    document.getElementById('kpi-fuentes').textContent  = activas.length;
    document.getElementById('kpi-ml-total').textContent = mlTotal + ' ml';
    document.getElementById('kpi-vendidos').textContent = _ventasD.length;
    document.getElementById('kpi-ganancia').textContent = '$' + ganancia.toFixed(0);
}

// =========================================================
// FORMULARIO TALLAS
// =========================================================
function renderTallasDefault() {
    _tallasFila = TALLAS_DEFAULT.map((ml, i) => ({ id: i, ml, precio: '', activa: [2,5,10].includes(ml) }));
    renderFilasTallas();
}

function renderFilasTallas() {
    const cont = document.getElementById('tallas-container');
    if (!cont) return;
    cont.innerHTML = _tallasFila.map((t, i) => `
        <div class="row g-2 align-items-center mb-1 talla-dnd-row"
             draggable="true"
             data-idx="${i}"
             ondragstart="_tallaDragStart(event,${i})"
             ondragover="_tallaDragOver(event)"
             ondrop="_tallaDrop(event,${i})"
             ondragend="_tallaDragEnd(event)"
             style="cursor:default;transition:opacity .15s">
            <div class="col-auto d-flex align-items-center ps-2" style="cursor:grab" title="Arrastrar para reordenar">
                <i class="bi bi-grip-vertical text-secondary"></i>
            </div>
            <div class="col">
                <input type="number" class="form-control form-control-sm" value="${t.ml}" placeholder="ml"
                    onchange="_tallasFila[${i}].ml = +this.value">
            </div>
            <div class="col">
                <input type="number" class="form-control form-control-sm" value="${t.precio}" placeholder="$"
                    onchange="_tallasFila[${i}].precio = +this.value">
            </div>
            <div class="col-auto text-center">
                <div class="form-check form-switch d-inline-block">
                    <input class="form-check-input" type="checkbox" ${t.activa ? 'checked' : ''}
                        onchange="_tallasFila[${i}].activa = this.checked">
                </div>
            </div>
            <div class="col-auto">
                <button type="button" class="btn btn-sm btn-outline-danger" onclick="quitarFilaTalla(${i})">
                    <i class="bi bi-x"></i>
                </button>
            </div>
        </div>`).join('');
}

function _tallaDragStart(e, idx) {
    _dndSrcIdx = idx;
    e.dataTransfer.effectAllowed = 'move';
    e.currentTarget.style.opacity = '0.4';
}

function _tallaDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    return false;
}

function _tallaDrop(e, targetIdx) {
    e.stopPropagation();
    if (_dndSrcIdx === null || _dndSrcIdx === targetIdx) return false;
    const moved = _tallasFila.splice(_dndSrcIdx, 1)[0];
    _tallasFila.splice(targetIdx, 0, moved);
    _dndSrcIdx = null;
    renderFilasTallas();
    return false;
}

function _tallaDragEnd(e) {
    _dndSrcIdx = null;
    document.querySelectorAll('.talla-dnd-row').forEach(r => (r.style.opacity = ''));
}

function agregarFilaTalla() {
    _tallasFila.push({ id: Date.now(), ml: '', precio: '', activa: true });
    renderFilasTallas();
}

function quitarFilaTalla(i) {
    _tallasFila.splice(i, 1);
    renderFilasTallas();
}

// =========================================================
// GUARDAR / EDITAR FUENTE
// =========================================================
function guardarFuente() {
    const nombre  = document.getElementById('fuente-nombre').value.trim();
    const mlTotal = parseFloat(document.getElementById('fuente-ml-total').value) || 0;
    if (!nombre || !mlTotal) { alert('⚠️ Nombre y ml totales son obligatorios.'); return; }

    const tallas = _tallasFila
        .filter(t => t.activa && t.ml > 0)
        .map(t => ({ ml: +t.ml, precio: +t.precio }));

    const editId = document.getElementById('fuente-edit-id').value;
    const ahora  = new Date().toISOString();

    if (editId) {
        const idx = _fuentes.findIndex(f => f.id === editId);
        if (idx !== -1) {
            _fuentes[idx] = {
                ..._fuentes[idx], nombre,
                marca:    document.getElementById('fuente-marca').value.trim(),
                mlTotal,
                mlUsados: parseFloat(document.getElementById('fuente-ml-usados').value) || _fuentes[idx].mlUsados || 0,
                costo:    parseFloat(document.getElementById('fuente-costo').value) || 0,
                imagen:   document.getElementById('fuente-imagen').value.trim(),
                tallas,
                notas:    document.getElementById('fuente-notas').value.trim(),
                updatedAt: ahora
            };
        }
    } else {
        _fuentes.push({
            id:       'fuente_' + Date.now(), nombre,
            marca:    document.getElementById('fuente-marca').value.trim(),
            mlTotal,
            mlUsados: parseFloat(document.getElementById('fuente-ml-usados').value) || 0,
            costo:    parseFloat(document.getElementById('fuente-costo').value) || 0,
            imagen:   document.getElementById('fuente-imagen').value.trim(),
            tallas,
            notas:    document.getElementById('fuente-notas').value.trim(),
            createdAt: ahora
        });
    }

    saveDecantsData(DECANTS_FUENTES_KEY, _fuentes).then(() => {
        bootstrap.Modal.getInstance(document.getElementById('modalNuevaFuente'))?.hide();
        resetFormFuente();
        cargarFuentes();
        actualizarKPIs();
        llenarSelectFuentes();
        mostrarToast('✅ Fuente guardada en Firebase', 'success');
    });
}

function resetFormFuente() {
    document.getElementById('fuente-edit-id').value   = '';
    document.getElementById('fuente-nombre').value    = '';
    document.getElementById('fuente-marca').value     = '';
    document.getElementById('fuente-ml-total').value  = '';
    document.getElementById('fuente-ml-usados').value = '0';
    document.getElementById('fuente-costo').value     = '';
    document.getElementById('fuente-imagen').value    = '';
    document.getElementById('fuente-notas').value     = '';
    document.getElementById('titulo-modal-fuente').textContent = '🧴 Nueva Botella Fuente';
    renderTallasDefault();
}

function editarFuente(id) {
    const f = _fuentes.find(x => x.id === id);
    if (!f) return;
    document.getElementById('fuente-edit-id').value   = f.id;
    document.getElementById('fuente-nombre').value    = f.nombre;
    document.getElementById('fuente-marca').value     = f.marca || '';
    document.getElementById('fuente-ml-total').value  = f.mlTotal || '';
    document.getElementById('fuente-ml-usados').value = f.mlUsados || 0;
    document.getElementById('fuente-costo').value     = f.costo || '';
    document.getElementById('fuente-imagen').value    = f.imagen || '';
    document.getElementById('fuente-notas').value     = f.notas || '';
    document.getElementById('titulo-modal-fuente').textContent = '✏️ Editar Fuente';
    _tallasFila = (f.tallas || []).map((t, i) => ({ id: i, ml: t.ml, precio: t.precio, activa: true }));
    if (!_tallasFila.length) renderTallasDefault();
    else renderFilasTallas();
    new bootstrap.Modal(document.getElementById('modalNuevaFuente')).show();
}

function eliminarFuente(id) {
    const f = _fuentes.find(x => x.id === id);
    if (!f) return;
    // Modal de confirmación Bootstrap en vez de confirm()
    _confirmarAccion(
        `🗑️ ¿Eliminar "${f.nombre}"?`,
        'Se eliminarán también sus ventas de decants. Esta acción no se puede deshacer.',
        'Eliminar',
        'btn-danger',
        () => {
            _fuentes = _fuentes.filter(x => x.id !== id);
            _ventasD = _ventasD.filter(v => v.fuenteId !== id);
            Promise.all([
                saveDecantsData(DECANTS_FUENTES_KEY, _fuentes),
                saveDecantsData(DECANTS_VENTAS_KEY,  _ventasD)
            ]).then(() => {
                cargarFuentes();
                cargarHistorialVentas();
                actualizarKPIs();
                llenarSelectFuentes();
                mostrarToast('🗑️ Fuente eliminada', 'warning');
            });
        }
    );
}

// =========================================================
// HELPER: Modal de confirmación genérico (reemplaza confirm())
// =========================================================
function _confirmarAccion(titulo, mensaje, btnLabel, btnClass, onConfirm) {
    let modal = document.getElementById('__modal-confirm-decant');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = '__modal-confirm-decant';
        modal.className = 'modal fade';
        modal.tabIndex = -1;
        modal.innerHTML = `
        <div class="modal-dialog modal-sm modal-dialog-centered">
            <div class="modal-content bg-dark text-white border border-secondary">
                <div class="modal-header border-secondary pb-2">
                    <h6 class="modal-title fw-bold" id="__confirm-titulo"></h6>
                    <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
                </div>
                <div class="modal-body py-2">
                    <p class="small mb-0" id="__confirm-mensaje"></p>
                </div>
                <div class="modal-footer border-secondary pt-2 gap-2">
                    <button class="btn btn-secondary btn-sm" data-bs-dismiss="modal">Cancelar</button>
                    <button class="btn btn-sm fw-bold" id="__confirm-btn"></button>
                </div>
            </div>
        </div>`;
        document.body.appendChild(modal);
    }
    document.getElementById('__confirm-titulo').textContent  = titulo;
    document.getElementById('__confirm-mensaje').textContent = mensaje;
    const btn = document.getElementById('__confirm-btn');
    btn.textContent = btnLabel;
    btn.className   = `btn btn-sm fw-bold ${btnClass}`;
    const bsModal = new bootstrap.Modal(modal);
    btn.onclick = () => { bsModal.hide(); onConfirm(); };
    bsModal.show();
}

// =========================================================
// AJUSTE ML
// =========================================================
function abrirAjusteML(id) {
    const f = _fuentes.find(x => x.id === id);
    if (!f) return;
    document.getElementById('ajuste-fuente-id').value           = id;
    document.getElementById('ajuste-fuente-nombre').textContent = f.nombre;
    document.getElementById('ajuste-ml-usados').value           = f.mlUsados || 0;
    new bootstrap.Modal(document.getElementById('modalAjusteML')).show();
}

function guardarAjusteML() {
    const id       = document.getElementById('ajuste-fuente-id').value;
    const nuevoVal = parseFloat(document.getElementById('ajuste-ml-usados').value) || 0;
    const idx      = _fuentes.findIndex(f => f.id === id);
    if (idx === -1) return;
    _fuentes[idx].mlUsados = nuevoVal;
    saveDecantsData(DECANTS_FUENTES_KEY, _fuentes).then(() => {
        bootstrap.Modal.getInstance(document.getElementById('modalAjusteML'))?.hide();
        cargarFuentes();
        actualizarKPIs();
        mostrarToast('🔧 ml ajustados correctamente', 'info');
    });
}

// =========================================================
// MODAL VENDER DECANT
// =========================================================
function llenarSelectFuentes() {
    const sel = document.getElementById('venta-fuente-id');
    if (!sel) return;
    sel.innerHTML = '<option value="">-- Selecciona perfume --</option>';
    _fuentes.forEach(f => {
        const mlDisp = (f.mlTotal||0) - (f.mlUsados||0);
        const opt = document.createElement('option');
        opt.value = f.id;
        opt.textContent = `${f.nombre} (${mlDisp} ml disp.)`;
        sel.appendChild(opt);
    });
}

function abrirVentaRapida(fuenteId) {
    llenarSelectFuentes();
    const sel = document.getElementById('venta-fuente-id');
    if (sel) sel.value = fuenteId;
    onSeleccionarFuente();
    new bootstrap.Modal(document.getElementById('modalVenderDecant')).show();
}

function onSeleccionarFuente() {
    const id     = document.getElementById('venta-fuente-id').value;
    const bloque = document.getElementById('bloque-tallas-venta');
    const cont   = document.getElementById('tallas-venta-btns');
    if (!id || !bloque || !cont) { bloque && (bloque.style.display='none'); return; }
    const f = _fuentes.find(x => x.id === id);
    if (!f || !f.tallas?.length) { bloque.style.display='none'; return; }
    bloque.style.display = 'block';
    cont.innerHTML = f.tallas.map(t => `
        <button type="button" class="btn btn-outline-light btn-sm talla-btn"
            onclick="seleccionarTalla(this, ${t.ml}, ${t.precio})">
            ${t.ml}ml${t.precio ? ' — $'+t.precio : ''}
        </button>`).join('');
    document.getElementById('venta-ml').value = '';
    document.getElementById('venta-precio-sugerido').value = '';
    document.getElementById('venta-precio').value = '';
    validarMLDisponibles();
}

function seleccionarTalla(btn, ml, precio) {
    document.querySelectorAll('.talla-btn').forEach(b => b.classList.remove('active','btn-warning'));
    btn.classList.add('active','btn-warning');
    document.getElementById('venta-ml').value = ml;
    document.getElementById('venta-precio-sugerido').value = precio;
    if (precio) document.getElementById('venta-precio').value = precio;
    validarMLDisponibles();
}

function validarMLDisponibles() {
    const id     = document.getElementById('venta-fuente-id').value;
    const ml     = parseFloat(document.getElementById('venta-ml').value) || 0;
    const cant   = parseInt(document.getElementById('venta-cantidad')?.value) || 1;
    const alerta = document.getElementById('alerta-ml-insuficiente');
    if (!id || !ml) { alerta?.classList.add('d-none'); return; }
    const f    = _fuentes.find(x => x.id === id);
    const disp = f ? ((f.mlTotal||0) - (f.mlUsados||0)) : 0;
    if (ml * cant > disp) alerta?.classList.remove('d-none');
    else alerta?.classList.add('d-none');
}

function registrarVentaDecant() {
    const fuenteId = document.getElementById('venta-fuente-id').value;
    const ml       = parseFloat(document.getElementById('venta-ml').value) || 0;
    const precio   = parseFloat(document.getElementById('venta-precio').value) || 0;
    const cantidad = parseInt(document.getElementById('venta-cantidad').value) || 1;
    const cliente  = document.getElementById('venta-cliente').value.trim();

    if (!fuenteId) { alert('⚠️ Selecciona una botella fuente.'); return; }
    if (!ml)       { alert('⚠️ Selecciona una talla.'); return; }
    if (!precio)   { alert('⚠️ Ingresa el precio de venta.'); return; }

    const fIdx = _fuentes.findIndex(f => f.id === fuenteId);
    if (fIdx === -1) return;
    const f    = _fuentes[fIdx];
    const disp = (f.mlTotal||0) - (f.mlUsados||0);
    const total = ml * cantidad;

    if (total > disp) {
        alert(`❌ No hay suficientes ml. Disponibles: ${disp}ml, necesitas: ${total}ml.`);
        return;
    }

    const costoPorMl = f.costo && f.mlTotal ? (f.costo / f.mlTotal) : 0;
    const costoAprox = costoPorMl * ml * cantidad;
    _fuentes[fIdx].mlUsados = (f.mlUsados||0) + total;

    for (let i = 0; i < cantidad; i++) {
        _ventasD.push({
            id:            'dv_' + Date.now() + '_' + i,
            fuenteId,
            nombrePerfume: f.nombre,
            marca:         f.marca || '',
            ml, precio,
            costoAprox:    costoAprox / cantidad,
            cliente,
            fecha:         new Date().toISOString()
        });
    }

    Promise.all([
        saveDecantsData(DECANTS_FUENTES_KEY, _fuentes),
        saveDecantsData(DECANTS_VENTAS_KEY,  _ventasD)
    ]).then(() => {
        bootstrap.Modal.getInstance(document.getElementById('modalVenderDecant'))?.hide();
        document.getElementById('venta-fuente-id').value = '';
        document.getElementById('venta-ml').value = '';
        document.getElementById('venta-precio').value = '';
        document.getElementById('venta-cantidad').value = '1';
        document.getElementById('venta-cliente').value = '';
        document.getElementById('bloque-tallas-venta').style.display = 'none';
        cargarFuentes();
        cargarHistorialVentas();
        actualizarKPIs();
        mostrarToast(`✅ ${cantidad} decant(s) de ${ml}ml vendido(s) 🔥`, 'success');
    });
}

// =========================================================
// VENDER BOTELLA RESTANTE
// =========================================================
function abrirVentaBotella(id) {
    const f = _fuentes.find(x => x.id === id);
    if (!f) return;
    const mlDisp = (f.mlTotal || 0) - (f.mlUsados || 0);
    if (mlDisp <= 0) { alert('❌ Esta botella ya no tiene líquido disponible.'); return; }
    const costoPorMl    = (f.costo && f.mlTotal) ? (f.costo / f.mlTotal) : 0;
    const costoRestante = costoPorMl * mlDisp;
    document.getElementById('vb-id').value              = id;
    document.getElementById('vb-nombre').textContent    = f.nombre;
    document.getElementById('vb-ml').textContent        = mlDisp + ' ml';
    document.getElementById('vb-costo').textContent     = '$' + costoRestante.toFixed(2);
    document.getElementById('vb-precio').value          = '';
    document.getElementById('vb-cliente').value         = '';
    new bootstrap.Modal(document.getElementById('modalVenderBotella')).show();
}

function registrarVentaBotella() {
    const id      = document.getElementById('vb-id').value;
    const precio  = parseFloat(document.getElementById('vb-precio').value) || 0;
    const cliente = document.getElementById('vb-cliente').value.trim();
    if (!precio) { alert('⚠️ Ingresa el precio de venta final.'); return; }
    const fIdx = _fuentes.findIndex(x => x.id === id);
    if (fIdx === -1) return;
    const f             = _fuentes[fIdx];
    const mlDisp        = (f.mlTotal || 0) - (f.mlUsados || 0);
    const costoPorMl    = (f.costo && f.mlTotal) ? (f.costo / f.mlTotal) : 0;
    const costoRestante = costoPorMl * mlDisp;
    _ventasD.push({
        id:            'dv_bot_' + Date.now(),
        fuenteId:      f.id,
        nombrePerfume: f.nombre + ' 🍾 (Botella Restante)',
        marca:         f.marca || '',
        ml:            mlDisp,
        precio,
        costoAprox:    costoRestante,
        cliente,
        fecha:         new Date().toISOString()
    });
    _fuentes[fIdx].mlUsados = f.mlTotal;
    Promise.all([
        saveDecantsData(DECANTS_FUENTES_KEY, _fuentes),
        saveDecantsData(DECANTS_VENTAS_KEY,  _ventasD)
    ]).then(() => {
        bootstrap.Modal.getInstance(document.getElementById('modalVenderBotella'))?.hide();
        cargarFuentes();
        cargarHistorialVentas();
        actualizarKPIs();
        mostrarToast('🍾 Botella restante liquidada exitosamente', 'info');
    });
}

// =========================================================
// TOAST
// =========================================================
function mostrarToast(msg, tipo = 'success') {
    const map = { success:'bg-success', warning:'bg-warning text-dark', info:'bg-info text-dark', danger:'bg-danger' };
    const el  = document.getElementById('toast-decant');
    if (!el) return;
    el.className = `toast align-items-center border-0 ${map[tipo] || 'bg-dark text-white'}`;
    document.getElementById('toast-body-decant').textContent = msg;
    new bootstrap.Toast(el, { delay: 3500 }).show();
}
