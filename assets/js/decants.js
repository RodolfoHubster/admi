// =========================================================
// DECANTS.JS — Fitoscents Admin
// Gestión completa de frascos / decants con Firebase sync
// =========================================================

// ── Constantes ────────────────────────────────────────────
const DECANTS_LOCAL_KEY = 'fitoscents_decants_v1';
const TAMANOS_DEFAULT   = [2, 5, 10];

let decantEditIndex = null;       // null = nuevo, número = edición
let tamanoCounter   = 0;          // contador de IDs para los rows de tamaños
let tipoCambioActual = 17.5;      // fallback

// ── Init ──────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
    await initApp?.();            // esperar Firebase (si existe)
    await cargarTipoCambio();
    await cargarDecants();
    inicializarTamanos();
    cargarListaInventarioEnModal();
});

// ── Firebase helpers ──────────────────────────────────────
function getDecants() {
    const raw = localStorage.getItem(DECANTS_LOCAL_KEY);
    return raw ? JSON.parse(raw) : [];
}

function saveDecants(arr) {
    localStorage.setItem(DECANTS_LOCAL_KEY, JSON.stringify(arr));
    // Sync Firebase en segundo plano
    if (typeof window.setDataCloud === 'function') {
        window.setDataCloud('decants', arr)
            .catch(err => console.warn('Firebase sync decants:', err));
    }
}

async function cargarDecants() {
    let decants = [];

    // Intentar traer de Firebase primero
    if (typeof window.getDataCloud === 'function') {
        try {
            const nube = await window.getDataCloud('decants');
            if (Array.isArray(nube) && nube.length > 0) {
                decants = nube;
                localStorage.setItem(DECANTS_LOCAL_KEY, JSON.stringify(decants));
            } else {
                decants = getDecants();
            }
        } catch {
            decants = getDecants();
        }
    } else {
        decants = getDecants();
    }

    renderDecants();
    calcularKPIsDecants();
}

async function sincronizarDecants() {
    const decants = getDecants();
    if (typeof window.setDataCloud === 'function') {
        await window.setDataCloud('decants', decants);
        alert(`☁️ ${decants.length} decants sincronizados con Firebase.`);
    } else {
        alert('⚠️ Firebase no disponible aún, intenta en un momento.');
    }
}

// ── Tipo de Cambio ────────────────────────────────────────
async function cargarTipoCambio() {
    const input = document.getElementById('dec-tipo-cambio');
    const src   = document.getElementById('tc-source');
    try {
        const r = await fetch('https://open.er-api.com/v6/latest/USD');
        const d = await r.json();
        if (d && d.rates && d.rates.MXN) {
            tipoCambioActual = d.rates.MXN;
            if (input) input.value = tipoCambioActual.toFixed(2);
            if (src) src.textContent = `Tipo de cambio del día (${new Date().toLocaleDateString('es-MX')})`;
        }
    } catch {
        if (input) input.value = tipoCambioActual.toFixed(2);
        if (src) src.textContent = 'Tipo de cambio aproximado (sin conexión)';
    }
}

// ── Render Grid ───────────────────────────────────────────
function renderDecants() {
    const grid     = document.getElementById('grid-decants');
    const empty    = document.getElementById('empty-decants');
    const contador = document.getElementById('contador-decants');
    if (!grid) return;

    const busq   = (document.getElementById('buscador-decant')?.value || '').toLowerCase();
    const estado = document.getElementById('filtro-estado-decant')?.value || 'todos';

    let decants = getDecants();

    decants = decants.filter(d => {
        const textoOk = d.nombre.toLowerCase().includes(busq) || (d.marca || '').toLowerCase().includes(busq);
        const mlOk    = estado === 'todos'
            ? true
            : estado === 'activo' ? d.mlActuales > 0
            : d.mlActuales <= 0;
        return textoOk && mlOk;
    });

    if (contador) contador.textContent = decants.length;

    if (decants.length === 0) {
        grid.innerHTML = '';
        if (empty) empty.style.display = 'block';
        return;
    }
    if (empty) empty.style.display = 'none';

    grid.innerHTML = decants.map((d, i) => renderTarjetaDecant(d, i)).join('');
    calcularKPIsDecants();
}

function renderTarjetaDecant(d, idx) {
    const pct      = d.mlTotal > 0 ? Math.round((d.mlActuales / d.mlTotal) * 100) : 0;
    const barClass = pct < 25 ? 'warning' : '';
    const imgUrl   = d.imagen || 'https://cdn-icons-png.flaticon.com/512/2636/2636280.png';
    const origen   = d.origen === 'inventario' ? `<span class="source-tag">📦 Del Inventario</span>` : `<span class="source-tag" style="background:rgba(34,197,94,0.1);color:#4ade80;border-color:rgba(34,197,94,0.2);">✍️ Manual</span>`;

    const tamanosBadges = (d.tamanos || []).map(t =>
        `<span class="badge size-badge me-1 mb-1" style="background:rgba(255,215,0,0.13);color:var(--gold-flat);border:1px solid rgba(255,215,0,0.25);" 
             onclick="abrirVentaDecant(${idx})" title="Vender ${t.ml}ml">
            ${t.ml}ml — $${t.precio}
         </span>`
    ).join('');

    const alertaBajoMl = d.mlActuales <= 5 && d.mlActuales > 0
        ? `<div class="alert alert-warning py-1 px-2 mt-2 mb-0 small">⚠️ Quedan pocos ml</div>` : '';
    const alertaAgotado = d.mlActuales <= 0
        ? `<div class="alert alert-danger py-1 px-2 mt-2 mb-0 small fw-bold">🔴 Agotado</div>` : '';

    const pctBadge = d.porcentaje
        ? `<span class="badge bg-info text-dark ms-1" style="font-size:.7rem;">${d.porcentaje}%</span>` : '';

    return `
    <div class="col-md-6 col-lg-4">
        <div class="card decant-card h-100 p-3">
            <div class="d-flex align-items-center gap-3 mb-3">
                <img src="${imgUrl}" alt="${d.nombre}" style="width:56px;height:56px;object-fit:cover;border-radius:10px;border:1px solid rgba(255,215,0,0.2);">
                <div class="flex-fill overflow-hidden">
                    <div class="fw-bold text-truncate" title="${d.nombre}">${d.nombre} ${pctBadge}</div>
                    <div class="text-muted small">${d.marca || ''}</div>
                    ${origen}
                </div>
            </div>

            <!-- ML BAR -->
            <div class="d-flex justify-content-between align-items-center mb-1">
                <small class="text-muted">ML disponibles</small>
                <small class="fw-bold" style="color:${pct < 25 ? '#dc3545' : '#28a745'}">${d.mlActuales} / ${d.mlTotal} ml</small>
            </div>
            <div class="ml-progress mb-2">
                <div class="ml-progress-bar ${barClass}" style="width:${pct}%"></div>
            </div>
            ${alertaBajoMl}${alertaAgotado}

            <!-- TAMAÑOS -->
            <div class="mt-2 mb-1">
                <small class="text-muted d-block mb-1">Tamaños / Precios (toca para vender):</small>
                ${tamanosBadges || '<small class="text-muted fst-italic">Sin tamaños configurados</small>'}
            </div>

            ${d.notas ? `<div class="text-muted small mt-1 fst-italic">📝 ${d.notas}</div>` : ''}

            <!-- ACCIONES -->
            <div class="d-flex gap-2 mt-3">
                <button class="btn btn-sm btn-gold flex-fill" onclick="abrirVentaDecant(${idx})">
                    <i class="bi bi-cash-coin"></i> Vender
                </button>
                <button class="btn btn-sm btn-outline-info" onclick="abrirAjusteML(${idx})" title="Ajustar ML">
                    <i class="bi bi-droplet-half"></i>
                </button>
                <button class="btn btn-sm btn-outline-warning" onclick="editarDecant(${idx})" title="Editar">
                    <i class="bi bi-pencil"></i>
                </button>
                <button class="btn btn-sm btn-outline-danger" onclick="eliminarDecant(${idx})" title="Eliminar">
                    <i class="bi bi-trash"></i>
                </button>
            </div>
        </div>
    </div>`;
}

// ── KPIs ──────────────────────────────────────────────────
function calcularKPIsDecants() {
    const decants = getDecants();
    let mlTotales = 0, gananciaEst = 0, frascosPosibles = 0;

    decants.forEach(d => {
        mlTotales += d.mlActuales || 0;
        frascosPosibles += d.mlActuales > 0 ? Math.floor((d.mlActuales || 0) / 5) : 0;
        const p5 = (d.tamanos || []).find(t => t.ml == 5);
        if (p5 && d.mlActuales) {
            const frascos5 = Math.floor(d.mlActuales / 5);
            gananciaEst += frascos5 * p5.precio;
        }
    });

    setText('kpi-total-decants', decants.length);
    setText('kpi-ml-totales', `${mlTotales} ml`);
    setText('kpi-ganancia-decants', `$${gananciaEst.toFixed(0)}`);
    setText('kpi-frascos-posibles', frascosPosibles);
}

function setText(id, val) {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
}

// ── Modal Helpers ─────────────────────────────────────────
function inicializarTamanos() {
    const cont = document.getElementById('contenedor-tamanos');
    if (!cont) return;
    cont.innerHTML = '';
    tamanoCounter = 0;
    TAMANOS_DEFAULT.forEach(ml => agregarTamano(ml));
}

function agregarTamano(mlDefault = '') {
    const id  = `tam-${tamanoCounter++}`;
    const row = document.createElement('div');
    row.className = 'col-md-6 col-lg-4';
    row.id        = `row-${id}`;
    row.innerHTML = `
        <div class="d-flex gap-2 align-items-center border rounded p-2 bg-dark bg-opacity-25">
            <div class="input-group input-group-sm" style="max-width:90px;">
                <input type="number" class="form-control" id="ml-${id}" placeholder="ml" value="${mlDefault}" min="1">
                <span class="input-group-text">ml</span>
            </div>
            <div class="input-group input-group-sm">
                <span class="input-group-text">$</span>
                <input type="number" class="form-control" id="precio-${id}" placeholder="Precio" step="0.50" min="0">
            </div>
            <button type="button" class="btn btn-sm btn-outline-danger" onclick="document.getElementById('row-${id}').remove()">
                <i class="bi bi-x"></i>
            </button>
        </div>`;
    document.getElementById('contenedor-tamanos').appendChild(row);
}

function leerTamanos() {
    const cont = document.getElementById('contenedor-tamanos');
    if (!cont) return [];
    const rows = cont.querySelectorAll('[id^="row-tam-"]');
    const result = [];
    rows.forEach(row => {
        const sfx    = row.id.replace('row-', '');
        const mlEl   = document.getElementById(`ml-${sfx}`);
        const precEl = document.getElementById(`precio-${sfx}`);
        if (!mlEl || !precEl) return;
        const ml    = parseFloat(mlEl.value);
        const prec  = parseFloat(precEl.value);
        if (ml > 0 && prec >= 0) result.push({ ml, precio: prec });
    });
    return result;
}

function toggleOrigenInventario() {
    const origen = document.getElementById('dec-origen')?.value;
    const bloque = document.getElementById('bloque-inventario-src');
    if (!bloque) return;
    bloque.style.display = origen === 'inventario' ? 'block' : 'none';
}

function cargarListaInventarioEnModal() {
    const sel = document.getElementById('dec-inventario-id');
    if (!sel) return;
    const productos = JSON.parse(localStorage.getItem('perfume_inventory_v1') || 'null')
                   || JSON.parse(localStorage.getItem('fitoscents_inventory') || '[]');
    sel.innerHTML = '<option value="">-- Selecciona --</option>';
    (Array.isArray(productos) ? productos : []).forEach(p => {
        const opt = document.createElement('option');
        opt.value = p.id || p.sku;
        opt.textContent = `${p.nombre} (${p.marca || ''}) — $${p.costo}`;
        opt.dataset.costo  = p.costo || 0;
        opt.dataset.nombre = p.nombre;
        opt.dataset.marca  = p.marca || '';
        opt.dataset.imagen = p.imagen || '';
        sel.appendChild(opt);
    });
}

function precargarDeInventario() {
    const sel = document.getElementById('dec-inventario-id');
    const opt = sel?.selectedOptions[0];
    if (!opt || !opt.value) return;
    setVal('dec-nombre', opt.dataset.nombre);
    setVal('dec-marca',  opt.dataset.marca);
    setVal('dec-imagen', opt.dataset.imagen);
    // El costo viene en MXN — convertir a USD aproximado
    const costoMXN = parseFloat(opt.dataset.costo) || 0;
    const tc = parseFloat(document.getElementById('dec-tipo-cambio')?.value) || tipoCambioActual;
    setVal('dec-costo-usd', (costoMXN / tc).toFixed(2));
    calcularPreciosDecant();
}

function setVal(id, val) {
    const el = document.getElementById(id);
    if (el) el.value = val;
}

// ── Calculadora automática ────────────────────────────────
function calcularPreciosDecant() {
    const costoUSD    = parseFloat(document.getElementById('dec-costo-usd')?.value) || 0;
    const tc          = parseFloat(document.getElementById('dec-tipo-cambio')?.value) || tipoCambioActual;
    const mlTotal     = parseFloat(document.getElementById('dec-ml-total')?.value) || 0;
    const precMercado = parseFloat(document.getElementById('dec-precio-mercado')?.value) || 0;
    const bloque      = document.getElementById('bloque-calculo-decant');

    if (costoUSD <= 0 || mlTotal <= 0) {
        if (bloque) bloque.style.display = 'none';
        return;
    }
    if (bloque) bloque.style.display = 'block';

    const costoMXN  = costoUSD * tc;
    const basePrice = precMercado > 0 ? precMercado : costoMXN;
    const precPorMl = basePrice / mlTotal;
    const prec2ml   = Math.ceil(precPorMl * 2);
    const prec5ml   = Math.ceil(precPorMl * 5);

    setText('calc-costo-mxn',    `$${costoMXN.toFixed(0)}`);
    setText('calc-precio-por-ml', `$${precPorMl.toFixed(1)}/ml`);
    setText('calc-precio-2ml',   `$${prec2ml}`);
    setText('calc-precio-5ml',   `$${prec5ml}`);

    // Auto-rellenar precios en los tamaños si están vacíos
    const cont = document.getElementById('contenedor-tamanos');
    if (!cont) return;
    cont.querySelectorAll('[id^="row-tam-"]').forEach(row => {
        const sfx    = row.id.replace('row-', '');
        const mlEl   = document.getElementById(`ml-${sfx}`);
        const precEl = document.getElementById(`precio-${sfx}`);
        if (!mlEl || !precEl || precEl.value) return;
        const ml = parseFloat(mlEl.value);
        if (ml > 0) precEl.value = Math.ceil(precPorMl * ml);
    });
}

// ── Guardar / Editar ──────────────────────────────────────
function guardarDecant() {
    const nombre     = document.getElementById('dec-nombre')?.value.trim();
    const marca      = document.getElementById('dec-marca')?.value.trim();
    const imagen     = document.getElementById('dec-imagen')?.value.trim();
    const mlTotal    = parseFloat(document.getElementById('dec-ml-total')?.value);
    const mlActuales = parseFloat(document.getElementById('dec-ml-actuales')?.value);
    const costoUSD   = parseFloat(document.getElementById('dec-costo-usd')?.value) || 0;
    const precMerc   = parseFloat(document.getElementById('dec-precio-mercado')?.value) || 0;
    const tc         = parseFloat(document.getElementById('dec-tipo-cambio')?.value) || tipoCambioActual;
    const notas      = document.getElementById('dec-notas')?.value.trim();
    const porcent    = parseFloat(document.getElementById('dec-porcentaje')?.value) || null;
    const origen     = document.getElementById('dec-origen')?.value || 'manual';
    const invId      = document.getElementById('dec-inventario-id')?.value || null;
    const tamanos    = leerTamanos();

    if (!nombre || !mlTotal || isNaN(mlActuales)) {
        alert('⚠️ Completa nombre, ml total y ml actuales.');
        return;
    }

    const decants = getDecants();

    const obj = {
        id:           decantEditIndex !== null ? decants[decantEditIndex].id : Date.now(),
        nombre, marca, imagen,
        mlTotal, mlActuales,
        costoUSD, precMercado: precMerc, tipoCambio: tc,
        tamanos, notas, porcentaje: porcent,
        origen, inventarioId: invId,
        fechaRegistro: decantEditIndex !== null ? decants[decantEditIndex].fechaRegistro : new Date().toISOString(),
        fechaActualizacion: new Date().toISOString()
    };

    if (decantEditIndex !== null) {
        decants[decantEditIndex] = obj;
        decantEditIndex = null;
    } else {
        decants.push(obj);
    }

    saveDecants(decants);
    bootstrap.Modal.getInstance(document.getElementById('modalNuevoDecant'))?.hide();
    document.getElementById('form-decant')?.reset();
    inicializarTamanos();
    setText('titulo-modal-decant', '🧪 Registrar Decant');
    document.getElementById('btn-guardar-decant').textContent = '💾 Guardar Decant';
    renderDecants();
    calcularKPIsDecants();
}

function editarDecant(idx) {
    const decants = getDecants();
    const d = decants[idx];
    if (!d) return;
    decantEditIndex = idx;

    setVal('dec-nombre',          d.nombre);
    setVal('dec-marca',           d.marca || '');
    setVal('dec-imagen',          d.imagen || '');
    setVal('dec-ml-total',        d.mlTotal);
    setVal('dec-ml-actuales',     d.mlActuales);
    setVal('dec-costo-usd',       d.costoUSD || '');
    setVal('dec-precio-mercado',  d.precMercado || '');
    setVal('dec-tipo-cambio',     d.tipoCambio || tipoCambioActual);
    setVal('dec-notas',           d.notas || '');
    setVal('dec-porcentaje',      d.porcentaje || '');
    setVal('dec-origen',          d.origen || 'manual');
    toggleOrigenInventario();

    // Tamaños
    const cont = document.getElementById('contenedor-tamanos');
    if (cont) {
        cont.innerHTML = '';
        tamanoCounter = 0;
        (d.tamanos || []).forEach(t => {
            agregarTamano(t.ml);
            const sfx    = `tam-${tamanoCounter - 1}`;
            const precEl = document.getElementById(`precio-${sfx}`);
            if (precEl) precEl.value = t.precio;
        });
        if (!(d.tamanos?.length)) inicializarTamanos();
    }

    calcularPreciosDecant();
    setText('titulo-modal-decant', '✏️ Editar Decant');
    document.getElementById('btn-guardar-decant').textContent = '💾 Guardar Cambios';
    new bootstrap.Modal(document.getElementById('modalNuevoDecant')).show();
}

function eliminarDecant(idx) {
    const decants = getDecants();
    if (!confirm(`¿Eliminar "${decants[idx]?.nombre}"? Esta acción no se puede deshacer.`)) return;
    decants.splice(idx, 1);
    saveDecants(decants);
    renderDecants();
    calcularKPIsDecants();
}

// ── Ajuste de ML ──────────────────────────────────────────
function abrirAjusteML(idx) {
    const d = getDecants()[idx];
    if (!d) return;
    document.getElementById('ajuste-dec-id').value  = idx;
    document.getElementById('ajuste-dec-ml').value  = d.mlActuales;
    document.getElementById('ajuste-dec-info').textContent =
        `${d.nombre} — actualmente ${d.mlActuales}ml de ${d.mlTotal}ml`;
    new bootstrap.Modal(document.getElementById('modalAjusteML')).show();
}

function confirmarAjusteML() {
    const idx = parseInt(document.getElementById('ajuste-dec-id').value);
    const ml  = parseFloat(document.getElementById('ajuste-dec-ml').value);
    if (isNaN(idx) || isNaN(ml) || ml < 0) return alert('⚠️ Valor inválido');
    const decants = getDecants();
    if (!decants[idx]) return;
    decants[idx].mlActuales = ml;
    decants[idx].fechaActualizacion = new Date().toISOString();
    saveDecants(decants);
    bootstrap.Modal.getInstance(document.getElementById('modalAjusteML'))?.hide();
    renderDecants();
    calcularKPIsDecants();
}

// ── Vender Decant ─────────────────────────────────────────
function abrirVentaDecant(idx) {
    const d = getDecants()[idx];
    if (!d) return;
    if (d.mlActuales <= 0) return alert('⚠️ Este decant ya está agotado.');

    setText('venta-dec-nombre', `${d.nombre} ${d.marca ? '— ' + d.marca : ''}`);
    document.getElementById('venta-dec-id').value = idx;

    const sel = document.getElementById('venta-dec-tamanio');
    sel.innerHTML = '';
    (d.tamanos || []).forEach(t => {
        if (t.ml <= d.mlActuales) {
            const opt = document.createElement('option');
            opt.value       = t.ml;
            opt.textContent = `${t.ml}ml`;
            opt.dataset.precio = t.precio;
            sel.appendChild(opt);
        }
    });
    // Opción personalizada
    const custom = document.createElement('option');
    custom.value       = 'custom';
    custom.textContent = 'Otro tamaño (personalizado)';
    custom.dataset.precio = 0;
    sel.appendChild(custom);

    actualizarPrecioVentaDec();
    setVal('venta-dec-cliente', '');
    setVal('venta-dec-nota', '');
    new bootstrap.Modal(document.getElementById('modalVenderDecant')).show();
}

function actualizarPrecioVentaDec() {
    const sel = document.getElementById('venta-dec-tamanio');
    const opt = sel?.selectedOptions[0];
    if (!opt) return;
    setVal('venta-dec-precio', opt.dataset.precio || 0);
}

function confirmarVentaDecant() {
    const idx       = parseInt(document.getElementById('venta-dec-id').value);
    const sel       = document.getElementById('venta-dec-tamanio');
    const mlVendido = sel.value === 'custom'
        ? parseFloat(prompt('¿Cuántos ml vendes?') || '0')
        : parseFloat(sel.value);
    const precio    = parseFloat(document.getElementById('venta-dec-precio').value) || 0;
    const cliente   = document.getElementById('venta-dec-cliente').value.trim();
    const nota      = document.getElementById('venta-dec-nota').value.trim();

    if (!mlVendido || mlVendido <= 0) return alert('⚠️ Selecciona un tamaño válido.');

    const decants = getDecants();
    const d = decants[idx];
    if (!d) return;

    if (mlVendido > d.mlActuales) {
        return alert(`⚠️ Solo quedan ${d.mlActuales}ml disponibles.`);
    }

    // Descontar ML
    d.mlActuales -= mlVendido;
    d.fechaActualizacion = new Date().toISOString();

    // Registrar historial en el decant
    if (!d.historialVentas) d.historialVentas = [];
    d.historialVentas.push({
        fecha:   new Date().toISOString(),
        ml:      mlVendido,
        precio,
        cliente,
        nota
    });

    saveDecants(decants);

    // También registrar en ventas globales si la función existe
    if (typeof window.registrarVentaDecant === 'function') {
        window.registrarVentaDecant({ nombre: d.nombre, ml: mlVendido, precio, cliente, nota });
    }

    bootstrap.Modal.getInstance(document.getElementById('modalVenderDecant'))?.hide();
    renderDecants();
    calcularKPIsDecants();

    alert(`✅ Venta registrada: ${mlVendido}ml de ${d.nombre} — $${precio}\nQuedan ${d.mlActuales}ml.`);
}

// ── Función para agregar decant desde Inventario (acceso externo) ─
window.abrirDecantDesdeInventario = function(prod) {
    const modal = document.getElementById('modalNuevoDecant');
    if (!modal) {
        alert('Ve a la página de Decants para registrarlo.');
        return;
    }
    setVal('dec-nombre', prod.nombre);
    setVal('dec-marca',  prod.marca || '');
    setVal('dec-imagen', prod.imagen || '');
    setVal('dec-costo-usd', '');
    setVal('dec-origen', 'inventario');
    toggleOrigenInventario();
    cargarTipoCambio();
    inicializarTamanos();
    new bootstrap.Modal(modal).show();
};
