// =========================================================
// GENERADOR DE MENSAJES PARA CLIENTES
// =========================================================

const WHATSAPP_NUMERO = '526648162623'; // 👈 CAMBIA ESTO

let timeoutActualizacion = null; // 👈 AGREGAR ESTO

document.addEventListener('DOMContentLoaded', () => {
    cargarClientes();
    actualizarMensajes();
});

// =========================================================
// CARGAR CLIENTES
// =========================================================

function cargarClientes() {
    const ventas = JSON.parse(localStorage.getItem(SALES_KEY)) || [];
    const clientes = new Set();
    
    ventas.forEach(v => {
        if (v.cliente && v.cliente.trim() !== '') {
            clientes.add(v.cliente);
        }
    });
    
    const select = document.getElementById('select-cliente-mensaje');
    select.innerHTML = '<option value="">-- Sin personalizar --</option>';
    
    Array.from(clientes).sort().forEach(cliente => {
        select.innerHTML += `<option value="${cliente}">${cliente}</option>`;
    });
    cargarPerfumesParaConsulta();
}

// =========================================================
// CARGAR PERFUMES PARA CONSULTA
// =========================================================

function cargarPerfumesParaConsulta() {
    const productos = JSON.parse(localStorage.getItem(DB_KEY)) || [];
    const select = document.getElementById('select-perfume-consulta');
    
    select.innerHTML = '<option value="">-- Selecciona un perfume --</option>';
    
    // Agrupar por nombre para evitar duplicados
    const perfumesUnicos = {};
    productos.forEach(p => {
        if (!perfumesUnicos[p.nombre]) {
            perfumesUnicos[p.nombre] = {
                nombre: p.nombre,
                marca: p.marca || '',
                precio: p.precioVenta
            };
        }
    });
    
    // Ordenar alfabéticamente por marca
    const perfumesOrdenados = Object.values(perfumesUnicos).sort((a, b) => 
        a.marca.localeCompare(b.marca)
    );
    
    // Agregar opciones
    perfumesOrdenados.forEach(p => {
        const textoOpcion = p.marca ? `${p.marca} - ${p.nombre} ($${p.precio})` : `${p.nombre} ($${p.precio})`;
        select.innerHTML += `<option value='${JSON.stringify(p)}'>${textoOpcion}</option>`;
    });
    
    // Opción "Otro"
    select.innerHTML += '<option value="otro">✏️ Otro (personalizar)</option>';
}


function cambiarPerfumeConsulta() {
    const select = document.getElementById('select-perfume-consulta');
    const camposPersonalizados = document.getElementById('campos-personalizados-consulta');
    const inputMarca = document.getElementById('marca-consulta-manual');
    const inputNombre = document.getElementById('perfume-consulta-manual');
    const inputPrecio = document.getElementById('precio-consulta-manual');
    
    if (select.value === 'otro') {
        // Mostrar campos personalizados
        camposPersonalizados.style.display = 'block';
        inputMarca.value = '';
        inputNombre.value = '';
        inputPrecio.value = '';
    } else if (select.value !== '') {
        // Perfume seleccionado del inventario
        camposPersonalizados.style.display = 'none';
        const perfume = JSON.parse(select.value);
        inputMarca.value = perfume.marca || '';
        inputNombre.value = perfume.nombre;
        inputPrecio.value = perfume.precio;
    } else {
        // No seleccionado
        camposPersonalizados.style.display = 'none';
        inputMarca.value = '';
        inputNombre.value = '';
        inputPrecio.value = '';
    }
    
    actualizarMensajes();
}



function actualizarNombreCliente() {
    const select = document.getElementById('select-cliente-mensaje');
    const input = document.getElementById('input-nombre-manual');
    
    if (select.value) {
        input.value = select.value;
    }
    
    actualizarMensajes();
}

// =========================================================
// ACTUALIZAR MENSAJES
// =========================================================

function actualizarMensajes() {
    const nombreManual = document.getElementById('input-nombre-manual')?.value.trim() || '';
    const nombre = nombreManual || '[Nombre]';
    const saludo = nombreManual ? `Hola ${nombreManual}!` : 'Hola!';
    
    // 1. Perfume llegó
    const elemLlego = document.getElementById('mensaje-llego');
    if (elemLlego) {
        const mensajeLlego = `${saludo}\n\n` +
                            `Te escribo para avisarte que tu perfume ya llego!\n\n` +
                            `📦 Disponible para entrega en Tijuana\n` +
                            `⏰ Coordina conmigo tu horario\n\n` +
                            `Cuando te queda bien?`;
        elemLlego.value = mensajeLlego;
    }
    
    // 2. Recordatorio de pago
    const elemPago = document.getElementById('mensaje-pago');
    if (elemPago) {
        const montoPendiente = document.getElementById('monto-pendiente')?.value || '[monto]';
        const mensajePago = `${saludo}\n\n` +
                           `Te escribo para recordarte que tienes un saldo pendiente de $${montoPendiente}\n\n` +
                           `💳 Puedes hacer transferencia o pago en efectivo\n` +
                           `📍 Entregas en Tijuana\n\n` +
                           `Cuando podrias liquidarlo?`;
        elemPago.value = mensajePago;
    }
    
    // 3. Disponible para entrega
    const elemEntrega = document.getElementById('mensaje-entrega');
    if (elemEntrega) {
        const mensajeEntrega = `${saludo}\n\n` +
                              `Tu pedido ya esta listo para entrega en Tijuana!\n\n` +
                              `📦 Empacado y listo\n` +
                              `📍 Punto de encuentro a coordinar\n` +
                              `⏰ Horarios flexibles\n\n` +
                              `Que dia te queda bien recogerlo?`;
        elemEntrega.value = mensajeEntrega;
    }
    
    // 4. Catálogo actualizado
    const elemCatalogo = document.getElementById('mensaje-catalogo');
    if (elemCatalogo) {
        const mensajeCatalogo = `${saludo}\n\n` +
                               `Acabo de actualizar mi catalogo con nuevos perfumes originales!\n\n` +
                               `✨ Nuevas fragancias disponibles\n` +
                               `💯 100% Originales\n` +
                               `📦 Entregas en Tijuana\n\n` +
                               `Te gustaria que te pasara la lista?`;
        elemCatalogo.value = mensajeCatalogo;
    }
    
    // 5. Confirmación de pedido
    const elemConfirmacion = document.getElementById('mensaje-confirmacion');
    if (elemConfirmacion) {
        const nombrePerfume = document.getElementById('nombre-perfume')?.value || '[perfume]';
        const precioPerfume = document.getElementById('precio-perfume')?.value || '[precio]';
        const mensajeConfirmacion = `${saludo}\n\n` +
                                   `Confirmado tu pedido:\n\n` +
                                   `📦 ${nombrePerfume}\n` +
                                   `💰 $${precioPerfume}\n` +
                                   `📍 Entrega en Tijuana\n\n` +
                                   `Te aviso cuando llegue para coordinar la entrega!`;
        elemConfirmacion.value = mensajeConfirmacion;
    }
    
    // 6. Agradecimiento
    const elemGracias = document.getElementById('mensaje-gracias');
    if (elemGracias) {
        const mensajeGracias = `${saludo}\n\n` +
                      `Muchas gracias por tu compra!\n\n` +
                      `Espero que disfrutes tu perfume\n\n` +
                      `Si necesitas algo mas o tienes dudas, no dudes en escribirme!\n\n` +
                      `Saludos!`;

        elemGracias.value = mensajeGracias;
    }
    
    // 7. Cotización/Consulta
    const elemConsulta = document.getElementById('mensaje-consulta');
    if (elemConsulta) {
        const marcaConsulta = document.getElementById('marca-consulta-manual')?.value.trim() || '';
        const perfumeConsulta = document.getElementById('perfume-consulta-manual')?.value || '[perfume]';
        const precioConsulta = document.getElementById('precio-consulta-manual')?.value || '[precio]';
        const incluirEnvio = document.getElementById('incluir-envio')?.checked || false;
        
        // Construir nombre completo (Marca + Perfume)
        let nombreCompleto = '';
        if (marcaConsulta && marcaConsulta !== '') {
            nombreCompleto = `${marcaConsulta} ${perfumeConsulta}`;
        } else {
            nombreCompleto = perfumeConsulta;
        }
        
        let mensajeConsulta = `${saludo}\n\n` +
                             `El perfume ${nombreCompleto} tiene un costo de $${precioConsulta} pesos\n\n` +
                             `💯 100% Original\n` +
                             `📦 Disponible en stock`;
        
        if (incluirEnvio) {
            mensajeConsulta += `\n🚚 Entregas en Tijuana sin costo adicional\n` +
                              `📮 Envios fuera de Tijuana disponibles`;
        }
        
        mensajeConsulta += `\n\nTe interesa?`;
        
        elemConsulta.value = mensajeConsulta;
    }
}



// =========================================================
// ACTUALIZAR CON DELAY (para campos de texto)
// =========================================================

function actualizarMensajesConDelay() {
    // Cancelar el timeout anterior si existe
    if (timeoutActualizacion) {
        clearTimeout(timeoutActualizacion);
    }
    
    // Crear nuevo timeout de 800ms (menos de 1 segundo)
    timeoutActualizacion = setTimeout(() => {
        actualizarMensajes();
    }, 800);
}


// =========================================================
// COPIAR Y ENVIAR
// =========================================================

function copiarMensaje(idTextarea) {
    const textarea = document.getElementById(idTextarea);
    textarea.select();
    textarea.setSelectionRange(0, 99999); // Para móviles
    
    navigator.clipboard.writeText(textarea.value).then(() => {
        // Mostrar toast
        const toast = new bootstrap.Toast(document.getElementById('toast-copiado'));
        toast.show();
    }).catch(() => {
        // Fallback para navegadores antiguos
        document.execCommand('copy');
        const toast = new bootstrap.Toast(document.getElementById('toast-copiado'));
        toast.show();
    });
}

function enviarWhatsApp(idTextarea) {
    const mensaje = document.getElementById(idTextarea).value;
    const url = `https://wa.me/${WHATSAPP_NUMERO}?text=${encodeURIComponent(mensaje)}`;
    window.open(url, '_blank');
}
