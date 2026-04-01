// =========================================================
// DECANTS.JS — Gestión de frascos Fitoscents
// Colección Firebase: 'decants_fuentes' y 'decants_ventas'
// =========================================================

const DECANTS_FUENTES_KEY  = 'decants_fuentes';
const DECANTS_VENTAS_KEY   = 'decants_ventas';
const TALLAS_DEFAULT       = [2, 3, 5, 8, 10, 15, 20, 30];

// ── Estado local de la pantalla ──────────────────────────
let _fuentes  = [];
let _ventasD  = [];
let _tallasFila = [];  // filas del form de tallas

// =========================================================
// INIT
// =========================================================
document.addEventListener('DOMContentLoaded', async () => {
    await initApp();
    await cargarDatosDecants();
    verificarPrecarga();
    renderTallasDefault();
});

async function initApp() {
    if (typeof waitForFirebase === 'function') await waitForFirebase();
}

async function cargarDatosDecants() {
    _fuentes = await getData(DECANTS_FUENTES_KEY) || [];
    _ventasD = await getData(DECANTS_VENTAS_KEY)  || [];
    cargarFuentes();
    cargarHistorialVentas();
    actualizarKPIs();
    llenarSelectFuentes();
}

// =========================================================
// FUNCIONES DE LECTURA/ESCRITURA FIREBASE + FALLBACK LOCAL
// =========================================================
async function getData(key) {
    if (typeof getDataCloud === 'function') {
        return await getDataCloud(key);
    }
    const raw = localStorage.getItem('fitoscents_' + key);
    return raw ? JSON.parse(raw) : [];
}

async function saveData(key, data) {
    // 🔥 FIX: Forzamos el uso de la función maestra setData de tu storage.js
    if (typeof setData === 'function') {
        setData(key, data);
    } else if (typeof setDataCloud === 'function') {
        await setDataCloud(key, data);
    }
    // Respaldo local por seguridad
    localStorage.setItem('fitoscents_' + key, JSON.stringify(data));
}

// =========================================================
// PRECARGA DIRECTA A FIREBASE (botón 🧪)
// =========================================================
async function verificarPrecarga() {
    const raw = localStorage.getItem('decant_precarga_tmp');
    if (!raw) return;
    
    localStorage.removeItem('decant_precarga_tmp');
    const p = JSON.parse(raw);

    // 1. Preguntamos los ml totales
    const mlInput = prompt(`🧪 Pasando a Decants: "${p.nombre}"\n\n¿De cuántos mililitros (ml) es la botella original?`, "100");
    
    // 2. Si cancelas, abrimos el modal manual como respaldo
    if (mlInput === null) {
        resetFormFuente();
        document.getElementById('fuente-nombre').value  = p.nombre  || '';
        document.getElementById('fuente-marca').value   = p.marca   || '';
        document.getElementById('fuente-imagen').value  = p.imagen  || '';
        document.getElementById('fuente-costo').value   = p.costo   || '';
        setTimeout(() => new bootstrap.Modal(document.getElementById('modalNuevaFuente')).show(), 300);
        return;
    }

    // 3. Construimos el objeto para Firebase
    const mlTotal = parseFloat(mlInput) || 100;
    const nuevaFuente = {
        id:       'fuente_' + Date.now(),
        nombre:   p.nombre || '',
        marca:    p.marca || '',
        mlTotal:  mlTotal,
        mlUsados: 0,
        costo:    parseFloat(p.costo) || 0,
        imagen:   p.imagen || 'https://cdn-icons-png.flaticon.com/512/2636/2636280.png',
        tallas:   [ {ml: 5, precio: ''}, {ml: 10, precio: ''} ],
        notas:    'Agregado directo desde el inventario',
        createdAt: new Date().toISOString()
    };

    _fuentes.push(nuevaFuente);
    
    // 4. Subimos a Firebase y actualizamos la interfaz
    try {
        await saveData(DECANTS_FUENTES_KEY, _fuentes);
        cargarFuentes();
        actualizarKPIs();
        llenarSelectFuentes();
        mostrarToast(`🔥 "${p.nombre}" guardado exitosamente en Firebase`, 'success');
    } catch (error) {
        console.error("Error al guardar en Firebase:", error);
        alert("❌ Error al conectar con la base de datos.");
    }
}

// =========================================================
// TABLA FUENTES
// =========================================================
function cargarFuentes() {
    const tbody    = document.getElementById('tabla-fuentes');
    const busqueda = (document.getElementById('buscador-fuentes')?.value || '').toLowerCase();
    const lista    = _fuentes.filter(f =>
        (f.nombre + ' ' + f.marca).toLowerCase().includes(busqueda)
    );

    if (!lista.length) {
        tbody.innerHTML = `<tr><td colspan="7" class="text-center text-muted py-4">
            Sin fuentes. Usa "Nueva Fuente" para agregar una botella.
        </td></tr>`;
        return;
    }

    tbody.innerHTML = lista.map(f => {
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
            <td>
                <span class="badge ml-badge ${badgeCls}">${mlDisp} ml</span>
            </td>
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

// =========================================================
// HISTORIAL VENTAS
// =========================================================
function cargarHistorialVentas() {
    const tbody = document.getElementById('tabla-ventas-decants');
    const badge = document.getElementById('badge-total-ventas');
    if (badge) badge.textContent = _ventasD.length + ' ventas';

    if (!_ventasD.length) {
        tbody.innerHTML = `<tr><td colspan="7" class="text-center text-muted py-3">Sin ventas registradas</td></tr>`;
        return;
    }

    const ordenadas = [..._ventasD].sort((a, b) => new Date(b.fecha) - new Date(a.fecha));

    tbody.innerHTML = ordenadas.map(v => {
        const fuente  = _fuentes.find(f => f.id === v.fuenteId);
        const nombre  = fuente ? fuente.nombre : (v.nombrePerfume || '-');
        const ganancia = (v.precio || 0) - (v.costoAprox || 0);
        const fecha   = new Date(v.fecha).toLocaleDateString('es-MX', { day:'2-digit', month:'short', year:'2-digit' });
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

// =========================================================
// KPIs
// =========================================================
function actualizarKPIs() {
    const mlTotal = _fuentes.reduce((s, f) => s + ((f.mlTotal||0) - (f.mlUsados||0)), 0);
    const ganancia = _ventasD.reduce((s, v) => s + ((v.precio||0) - (v.costoAprox||0)), 0);

    document.getElementById('kpi-fuentes').textContent  = _fuentes.length;
    document.getElementById('kpi-ml-total').textContent = mlTotal + ' ml';
    document.getElementById('kpi-vendidos').textContent = _ventasD.length;
    document.getElementById('kpi-ganancia').textContent = '$' + ganancia.toFixed(0);
}

// =========================================================
// FORMULARIO TALLAS (en modal nueva fuente)
// =========================================================
function renderTallasDefault() {
    _tallasFila = TALLAS_DEFAULT.map((ml, i) => ({
        id: i, ml: ml, precio: '', activa: [2,5,10].includes(ml)
    }));
    renderFilasTallas();
}

function renderFilasTallas() {
    const cont = document.getElementById('tallas-container');
    if (!cont) return;
    cont.innerHTML = _tallasFila.map((t, i) => `
        <div class="row g-2 align-items-center mb-1" id="talla-row-${i}">
            <div class="col-3">
                <input type="number" class="form-control form-control-sm" value="${t.ml}" placeholder="ml"
                    onchange="_tallasFila[${i}].ml = +this.value">
            </div>
            <div class="col-3">
                <input type="number" class="form-control form-control-sm" value="${t.precio}" placeholder="$"
                    onchange="_tallasFila[${i}].precio = +this.value">
            </div>
            <div class="col-3 text-center">
                <div class="form-check form-switch d-inline-block">
                    <input class="form-check-input" type="checkbox" ${t.activa ? 'checked' : ''}
                        onchange="_tallasFila[${i}].activa = this.checked">
                </div>
            </div>
            <div class="col-3">
                <button type="button" class="btn btn-sm btn-outline-danger" onclick="quitarFilaTalla(${i})">
                    <i class="bi bi-x"></i>
                </button>
            </div>
        </div>`).join('');
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
    const nombre   = document.getElementById('fuente-nombre').value.trim();
    const mlTotal  = parseFloat(document.getElementById('fuente-ml-total').value) || 0;
    if (!nombre || !mlTotal) {
        alert('⚠️ Nombre y ml totales son obligatorios.');
        return;
    }

    const tallas = _tallasFila
        .filter(t => t.activa && t.ml > 0)
        .map(t => ({ ml: +t.ml, precio: +t.precio }));

    const editId = document.getElementById('fuente-edit-id').value;
    const ahora  = new Date().toISOString();

    if (editId) {
        const idx = _fuentes.findIndex(f => f.id === editId);
        if (idx !== -1) {
            _fuentes[idx] = {
                ..._fuentes[idx],
                nombre,
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
            id:       'fuente_' + Date.now(),
            nombre,
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

    saveData(DECANTS_FUENTES_KEY, _fuentes).then(() => {
        bootstrap.Modal.getInstance(document.getElementById('modalNuevaFuente'))?.hide();
        resetFormFuente();
        cargarFuentes();
        actualizarKPIs();
        llenarSelectFuentes();
        mostrarToast('✅ Fuente guardada en Firebase', 'success');
    });
}

function resetFormFuente() {
    document.getElementById('fuente-edit-id').value  = '';
    document.getElementById('fuente-nombre').value   = '';
    document.getElementById('fuente-marca').value    = '';
    document.getElementById('fuente-ml-total').value = '';
    document.getElementById('fuente-ml-usados').value= '0';
    document.getElementById('fuente-costo').value    = '';
    document.getElementById('fuente-imagen').value   = '';
    document.getElementById('fuente-notas').value    = '';
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
    if (!confirm(`🗑️ ¿Eliminar la fuente "${f.nombre}"?\nSe eliminarán también sus ventas de decants.`)) return;
    _fuentes  = _fuentes.filter(x => x.id !== id);
    _ventasD  = _ventasD.filter(v => v.fuenteId !== id);
    Promise.all([
        saveData(DECANTS_FUENTES_KEY, _fuentes),
        saveData(DECANTS_VENTAS_KEY, _ventasD)
    ]).then(() => {
        cargarFuentes();
        cargarHistorialVentas();
        actualizarKPIs();
        llenarSelectFuentes();
        mostrarToast('🗑️ Fuente eliminada', 'warning');
    });
}

// =========================================================
// AJUSTE ML
// =========================================================
function abrirAjusteML(id) {
    const f = _fuentes.find(x => x.id === id);
    if (!f) return;
    document.getElementById('ajuste-fuente-id').value       = id;
    document.getElementById('ajuste-fuente-nombre').textContent = f.nombre;
    document.getElementById('ajuste-ml-usados').value       = f.mlUsados || 0;
    new bootstrap.Modal(document.getElementById('modalAjusteML')).show();
}

function guardarAjusteML() {
    const id = document.getElementById('ajuste-fuente-id').value;
    const nuevoVal = parseFloat(document.getElementById('ajuste-ml-usados').value) || 0;
    const idx = _fuentes.findIndex(f => f.id === id);
    if (idx === -1) return;
    _fuentes[idx].mlUsados = nuevoVal;
    saveData(DECANTS_FUENTES_KEY, _fuentes).then(() => {
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
    const id = document.getElementById('venta-fuente-id').value;
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
    const id       = document.getElementById('venta-fuente-id').value;
    const ml       = parseFloat(document.getElementById('venta-ml').value) || 0;
    const cant     = parseInt(document.getElementById('venta-cantidad')?.value) || 1;
    const alerta   = document.getElementById('alerta-ml-insuficiente');
    if (!id || !ml) { alerta?.classList.add('d-none'); return; }
    const f = _fuentes.find(x => x.id === id);
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
    const f     = _fuentes[fIdx];
    const disp  = (f.mlTotal||0) - (f.mlUsados||0);
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
            ml,
            precio,
            costoAprox:    costoAprox / cantidad,
            cliente,
            fecha:         new Date().toISOString()
        });
    }

    Promise.all([
        saveData(DECANTS_FUENTES_KEY, _fuentes),
        saveData(DECANTS_VENTAS_KEY,  _ventasD)
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
        mostrarToast(`✅ ${cantidad} decant(s) de ${ml}ml vendido(s) y guardados en Firebase 🔥`, 'success');
    });
}

// =========================================================
// VENDER BOTELLA RESTANTE
// =========================================================
function abrirVentaBotella(id) {
    const f = _fuentes.find(x => x.id === id);
    if (!f) return;

    const mlDisp = (f.mlTotal || 0) - (f.mlUsados || 0);
    if (mlDisp <= 0) {
        alert("❌ Esta botella ya no tiene líquido disponible.");
        return;
    }

    // Calculamos qué fracción del costo original corresponde a los ml que sobraron
    const costoPorMl = (f.costo && f.mlTotal) ? (f.costo / f.mlTotal) : 0;
    const costoRestante = costoPorMl * mlDisp;

    document.getElementById('vb-id').value = id;
    document.getElementById('vb-nombre').textContent = f.nombre;
    document.getElementById('vb-ml').textContent = mlDisp + ' ml';
    document.getElementById('vb-costo').textContent = '$' + costoRestante.toFixed(2);
    
    document.getElementById('vb-precio').value = '';
    document.getElementById('vb-cliente').value = '';

    new bootstrap.Modal(document.getElementById('modalVenderBotella')).show();
}

function registrarVentaBotella() {
    const id = document.getElementById('vb-id').value;
    const precio = parseFloat(document.getElementById('vb-precio').value) || 0;
    const cliente = document.getElementById('vb-cliente').value.trim();

    if (!precio) return alert("⚠️ Ingresa el precio de venta final.");

    const fIdx = _fuentes.findIndex(x => x.id === id);
    if (fIdx === -1) return;

    const f = _fuentes[fIdx];
    const mlDisp = (f.mlTotal || 0) - (f.mlUsados || 0);
    const costoPorMl = (f.costo && f.mlTotal) ? (f.costo / f.mlTotal) : 0;
    const costoRestante = costoPorMl * mlDisp;

    // Registramos la venta en el historial de decants, etiquetada como botella física
    _ventasD.push({
        id: 'dv_bot_' + Date.now(),
        fuenteId: f.id,
        nombrePerfume: f.nombre + ' 🍾 (Botella Restante)',
        marca: f.marca || '',
        ml: mlDisp,
        precio: precio,
        costoAprox: costoRestante,
        cliente: cliente,
        fecha: new Date().toISOString()
    });

    // Agotamos la botella en el inventario de fuentes
    _fuentes[fIdx].mlUsados = f.mlTotal;

    Promise.all([
        saveData(DECANTS_FUENTES_KEY, _fuentes),
        saveData(DECANTS_VENTAS_KEY, _ventasD)
    ]).then(() => {
        bootstrap.Modal.getInstance(document.getElementById('modalVenderBotella'))?.hide();
        cargarFuentes();
        cargarHistorialVentas();
        actualizarKPIs();
        mostrarToast(`🍾 Botella restante liquidada exitosamente`, 'info');
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
