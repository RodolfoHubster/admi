// =========================================================
// ASISTENTE IA (Gemini)
// =========================================================

const ASISTENTE_CHAT_KEY = 'fitoscents_asistente_chat_v1';
const ASISTENTE_CLIENTE_KEY = 'fitoscents_asistente_cliente_v1';
const MAX_CHAT_HISTORY = 60;
const MAX_CONVERSATION_CONTEXT = 12;
const MAX_INVENTORY_ITEMS_SENT = 80;
const ASISTENTE_ENDPOINT_PLACEHOLDER_HOST = 'your-backend-service.example.com';
const ASISTENTE_API_CONFIG = getAsistenteApiConfig();
const ASISTENTE_API_ENDPOINT = resolveAsistenteApiEndpoint();

const chatContainer = document.getElementById('chat-container');
const inputMensaje = document.getElementById('input-mensaje');
const inputImagen = document.getElementById('input-imagen');
const inputCliente = document.getElementById('cliente-asistente');
const checkVentas = document.getElementById('modo-ventas');
const btnEnviar = document.getElementById('btn-enviar');
const btnLimpiar = document.getElementById('btn-limpiar-chat');
const btnWhatsapp = document.getElementById('btn-whatsapp');
const estado = document.getElementById('estado-asistente');

let chatHistory = [];

document.addEventListener('DOMContentLoaded', initAsistente);

function initAsistente() {
    chatHistory = loadChat();
    inputCliente.value = localStorage.getItem(ASISTENTE_CLIENTE_KEY) || '';

    inputCliente.addEventListener('input', () => {
        localStorage.setItem(ASISTENTE_CLIENTE_KEY, inputCliente.value.trim());
    });

    btnEnviar.addEventListener('click', enviarMensaje);
    btnLimpiar.addEventListener('click', limpiarChat);
    btnWhatsapp.addEventListener('click', generarWhatsapp);

    inputMensaje.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
            enviarMensaje();
        }
    });

    if (chatHistory.length === 0) {
        chatHistory.push({
            role: 'assistant',
            text: '¡Hola! Soy tu asistente de perfumes. Te puedo ayudar con recomendaciones, objeciones de venta y textos para WhatsApp.',
            timestamp: new Date().toISOString()
        });
        saveChat();
    }

    renderChat();
    verifyApisHealth();
}

async function enviarMensaje() {
    const texto = inputMensaje.value.trim();
    const archivo = inputImagen.files?.[0] || null;

    if (!texto && !archivo) {
        if (typeof showToast === 'function') showToast('Escribe un mensaje o adjunta una imagen.', 'warning');
        return;
    }

    let imagePayload = null;
    if (archivo) {
        if (!['image/jpeg', 'image/png'].includes(archivo.type)) {
            if (typeof showToast === 'function') showToast('Solo se permiten imágenes JPG o PNG.', 'warning');
            return;
        }
        if (archivo.size > 4 * 1024 * 1024) {
            if (typeof showToast === 'function') showToast('La imagen excede 4MB.', 'warning');
            return;
        }
        imagePayload = await fileToPayload(archivo);
    }

    const userMessage = {
        role: 'user',
        text: texto || '[Imagen adjunta]',
        imageName: archivo ? archivo.name : null,
        timestamp: new Date().toISOString()
    };
    chatHistory.push(userMessage);
    saveChat();
    renderChat();

    setLoading(true);

    try {
        const payload = {
            message: texto,
            image: imagePayload,
            clientName: inputCliente.value.trim(),
            salesMode: checkVentas.checked,
            conversation: chatHistory.slice(-MAX_CONVERSATION_CONTEXT).map(m => ({ role: m.role, text: m.text })),
            inventoryContext: buildInventoryContext(),
            pricingHints: buildPricingHints()
        };

        if (!ASISTENTE_API_ENDPOINT) {
            throw new Error('Configura ASISTENTE_API_ENDPOINT con la URL pública de tu backend.');
        }

        const res = await fetch(ASISTENTE_API_ENDPOINT, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        const data = await safeParseJson(res);
        if (!res.ok || !data.reply) {
            throw new Error(buildHttpErrorMessage(res.status, data?.error || 'No se pudo obtener respuesta del asistente.'));
        }

        chatHistory.push({
            role: 'assistant',
            text: data.reply,
            timestamp: new Date().toISOString()
        });
        saveChat();
        renderChat();
    } catch (error) {
        chatHistory.push({
            role: 'assistant',
            text: `No pude responder en este momento. ${error.message || ''}`.trim(),
            timestamp: new Date().toISOString()
        });
        saveChat();
        renderChat();
    } finally {
        setLoading(false);
        inputMensaje.value = '';
        inputImagen.value = '';
        inputMensaje.focus();
    }
}

function limpiarChat() {
    if (!confirm('¿Seguro que quieres borrar el historial del asistente?')) return;
    chatHistory = [];
    localStorage.removeItem(ASISTENTE_CHAT_KEY);
    chatHistory.push({
        role: 'assistant',
        text: 'Historial reiniciado. ¿Qué consulta de perfumes quieres resolver ahora?',
        timestamp: new Date().toISOString()
    });
    saveChat();
    renderChat();
}

function generarWhatsapp() {
    const lastAssistant = [...chatHistory].reverse().find(m => m.role === 'assistant' && m.text);
    if (!lastAssistant) return alert('No hay respuesta del asistente para convertir.');

    const cliente = sanitizeForMessage(inputCliente.value.trim());
    const mensaje = cliente
        ? `Hola ${cliente}!\n\n${lastAssistant.text}`
        : lastAssistant.text;
    const url = `https://wa.me/?text=${encodeURIComponent(mensaje)}`;
    window.open(url, '_blank');
}

function buildInventoryContext() {
    try {
        const raw = localStorage.getItem('perfume_inventory_v1');
        const data = raw ? JSON.parse(raw) : [];
        if (!Array.isArray(data)) return { total: 0, items: [] };

        const inStockCount = data.filter(p => p.ubicacion !== 'en_camino').length;
        const items = data.slice(0, MAX_INVENTORY_ITEMS_SENT).map((p) => ({
            nombre: p.nombre || p.name || '',
            marca: p.marca || p.brand || '',
            precioVenta: Number(p.precioVenta || p.precio || 0),
            costo: Number(p.costo || 0),
            disponibleMl: Number(p.mlActuales || p.current_ml || p.ml || 0),
            estado: p.estado || p.status || '',
            ubicacion: p.ubicacion || '',
            cliente: p.cliente || ''
        }));

        return {
            total: data.length,
            enStock: inStockCount,
            items
        };
    } catch (error) {
        console.warn('No se pudo preparar contexto de inventario', error);
        return { total: 0, items: [] };
    }
}

function buildPricingHints() {
    try {
        const raw = localStorage.getItem('perfume_inventory_v1');
        const data = raw ? JSON.parse(raw) : [];
        if (!Array.isArray(data) || !data.length) return { margenObjetivo: 0.35, ejemplos: [] };
        const ejemplos = data.slice(0, 20).map(p => {
            const costo = Number(p.costo || 0);
            const precio = Number(p.precioVenta || 0);
            const margen = costo > 0 ? (precio - costo) / costo : 0;
            return {
                nombre: p.nombre,
                costo,
                precioActual: precio,
                margenActual: Number.isFinite(margen) ? Number(margen.toFixed(3)) : 0,
                precioObjetivo35: costo > 0 ? Number((costo * 1.35).toFixed(2)) : 0
            };
        });
        return { margenObjetivo: 0.35, ejemplos };
    } catch (e) {
        return { margenObjetivo: 0.35, ejemplos: [] };
    }
}

function fileToPayload(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            const dataUrl = String(reader.result || '');
            const base64 = dataUrl.includes(',') ? dataUrl.split(',')[1] : dataUrl;
            resolve({
                mimeType: file.type,
                data: base64,
                name: file.name
            });
        };
        reader.onerror = () => reject(new Error('No se pudo leer la imagen.'));
        reader.readAsDataURL(file);
    });
}

function loadChat() {
    try {
        const raw = localStorage.getItem(ASISTENTE_CHAT_KEY);
        const data = raw ? JSON.parse(raw) : [];
        return Array.isArray(data) ? data : [];
    } catch (error) {
        return [];
    }
}

function saveChat() {
    localStorage.setItem(ASISTENTE_CHAT_KEY, JSON.stringify(chatHistory.slice(-MAX_CHAT_HISTORY)));
}

function renderChat() {
    chatContainer.innerHTML = '';

    chatHistory.forEach((msg) => {
        const bubble = document.createElement('div');
        bubble.className = `mb-3 p-3 rounded ${msg.role === 'assistant' ? 'bg-dark text-light' : 'bg-primary text-white'}`;
        bubble.style.whiteSpace = 'pre-wrap';
        bubble.style.wordBreak = 'break-word';

        const role = msg.role === 'assistant' ? 'Asistente' : 'Tú';
        const stamp = formatTime(msg.timestamp);

        bubble.innerHTML = `
            <div class="d-flex justify-content-between align-items-center mb-1">
                <strong>${escapeHtml(role)}</strong>
                <small class="${msg.role === 'assistant' ? 'text-secondary' : 'text-light'}">${escapeHtml(stamp)}</small>
            </div>
            <div>${escapeHtml(msg.text || '')}</div>
            ${msg.imageName ? `<small class="${msg.role === 'assistant' ? 'text-secondary' : 'text-light'}">📷 ${escapeHtml(msg.imageName)}</small>` : ''}
        `;

        chatContainer.appendChild(bubble);
    });

    chatContainer.scrollTop = chatContainer.scrollHeight;
}

function setLoading(loading) {
    btnEnviar.disabled = loading;
    btnEnviar.innerHTML = loading
        ? '<span class="spinner-border spinner-border-sm"></span> Consultando...'
        : '<i class="bi bi-send"></i> Enviar al asistente';
    estado.textContent = loading ? 'Consultando...' : 'Listo';
}

function formatTime(isoDate) {
    if (!isoDate) return '';
    const date = new Date(isoDate);
    return isNaN(date.getTime()) ? '' : date.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
}

function escapeHtml(text) {
    return String(text)
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#39;');
}

function sanitizeForMessage(text) {
    return String(text).replace(/[\u0000-\u001F\u007F]/g, '').slice(0, 100);
}

function resolveAsistenteApiEndpoint() {
    const configuredEndpoint = ASISTENTE_API_CONFIG.endpoint;
    if (typeof configuredEndpoint === 'string' && configuredEndpoint.trim() !== '') {
        return configuredEndpoint.trim();
    }

    if (typeof window.ASISTENTE_API_ENDPOINT === 'string') {
        const endpoint = window.ASISTENTE_API_ENDPOINT.trim();
        if (!endpoint) {
            return '';
        }
        try {
            const parsed = new URL(endpoint, window.location.origin);
            if (parsed.hostname === ASISTENTE_ENDPOINT_PLACEHOLDER_HOST) {
                return '';
            }
        } catch (error) {
            return '';
        }
        return endpoint;
    }
    return '';
}

function getAsistenteApiConfig() {
    const fallback = {};
    const fromConfig = (window.APP_API_CONFIG && window.APP_API_CONFIG.assistant) || fallback;
    return {
        endpoint: typeof fromConfig.endpoint === 'string' ? fromConfig.endpoint.trim() : '',
        healthEndpoint: typeof fromConfig.healthEndpoint === 'string' ? fromConfig.healthEndpoint.trim() : ''
    };
}

async function safeParseJson(response) {
    try {
        return await response.json();
    } catch (error) {
        return {};
    }
}

function buildHttpErrorMessage(status, fallbackMessage) {
    const defaultMessage = fallbackMessage || 'Error inesperado al conectar con la API.';
    if (status === 401) return 'No autorizado (401). Verifica credenciales/API key.';
    if (status === 403) return 'Acceso denegado (403). Revisa origen permitido y permisos.';
    if (status === 429) return 'Límite de solicitudes alcanzado (429). Intenta nuevamente en unos minutos.';
    if (status >= 500) return `Error del servidor (${status}). Revisa logs del backend.`;
    return defaultMessage;
}

async function verifyApisHealth() {
    const checks = await Promise.allSettled([
        checkAssistantApiHealth(),
        checkExchangeRateApiHealth()
    ]);

    const hasFailure = checks.some((check) => check.status !== 'fulfilled');
    if (hasFailure) {
        estado.textContent = 'Listo (con alertas de API)';
    }
}

async function checkAssistantApiHealth() {
    if (!ASISTENTE_API_ENDPOINT) {
        throw new Error('Falta endpoint del asistente.');
    }
    const healthUrl = ASISTENTE_API_CONFIG.healthEndpoint || buildHealthUrl(ASISTENTE_API_ENDPOINT, 'health=1');
    const response = await fetch(healthUrl, {
        method: 'GET'
    });
    if (!response.ok) {
        throw new Error(`Health check asistente falló (${response.status}).`);
    }
}

async function checkExchangeRateApiHealth() {
    const exchangeConfig = (window.APP_API_CONFIG && window.APP_API_CONFIG.exchangeRate) || {};
    const endpoint = (typeof exchangeConfig.healthEndpoint === 'string' && exchangeConfig.healthEndpoint.trim())
        || (typeof exchangeConfig.endpoint === 'string' ? exchangeConfig.endpoint.trim() : '');
    if (!endpoint) {
        throw new Error('Falta endpoint de tipo de cambio.');
    }
    const response = await fetch(endpoint, {
        method: 'GET',
        headers: resolveAsistenteApiHeaders(exchangeConfig)
    });
    if (!response.ok) {
        throw new Error(`Health check tipo de cambio falló (${response.status}).`);
    }
}

function buildHealthUrl(endpoint, query) {
    try {
        const url = new URL(endpoint, window.location.origin);
        url.search = query;
        return url.toString();
    } catch (error) {
        return endpoint;
    }
}
