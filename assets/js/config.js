// CLAVE: Aquí definimos dónde se guarda la información (Local Storage del navegador)
const DB_KEY = 'perfume_inventory_v1';
// Clave para guardar el historial de dinero
const SALES_KEY = 'perfume_sales_v1';

const PAYOUTS_KEY = 'perfume_payouts_v1';
const ADMIN_PIN = "e0b08ad65f5b6f6b75d18c8642a041ca1160609af1b7dfc55ab7f2d293fd8758";
const EXPENSES_KEY = 'perfume_expenses_v1';
// VARIABLES DE ESTADO PARA FILTROS Y ORDEN
let ordenActual = { campo: 'nombre', dir: 'asc' }; // asc (A-Z) o desc (Z-A)
let indiceEdicion = null;

const APP_ENV = (typeof window !== 'undefined' && window.__APP_ENV__ && typeof window.__APP_ENV__ === 'object')
    ? window.__APP_ENV__
    : {};

function readEnv(name, fallback = '') {
    const value = APP_ENV[name];
    return typeof value === 'string' && value.trim() !== '' ? value.trim() : fallback;
}

function normalizeHeaderName(name, fallback) {
    const raw = typeof name === 'string' ? name.trim() : '';
    return raw || fallback;
}

const APP_API_CONFIG = Object.freeze({
    assistant: Object.freeze({
        endpoint: readEnv('ASISTENTE_API_ENDPOINT', ''),
        healthEndpoint: readEnv('ASISTENTE_API_HEALTH_ENDPOINT', '')
    }),
    exchangeRate: Object.freeze({
        endpoint: readEnv('EXCHANGE_API_ENDPOINT', 'https://api.exchangerate-api.com/v4/latest/USD'),
        healthEndpoint: readEnv('EXCHANGE_API_HEALTH_ENDPOINT', ''),
        apiKey: readEnv('EXCHANGE_API_KEY', ''),
        apiKeyHeader: normalizeHeaderName(readEnv('EXCHANGE_API_KEY_HEADER', 'X-API-Key'), 'X-API-Key'),
        bearerToken: readEnv('EXCHANGE_API_BEARER_TOKEN', ''),
        authHeader: normalizeHeaderName(readEnv('EXCHANGE_API_AUTH_HEADER', ''), ''),
        authScheme: readEnv('EXCHANGE_API_AUTH_SCHEME', 'Bearer')
    })
});

function buildApiAuthHeaders(config) {
    const headers = {};
    if (!config || typeof config !== 'object') return headers;

    const apiKey = typeof config.apiKey === 'string' ? config.apiKey.trim() : '';
    const apiKeyHeader = typeof config.apiKeyHeader === 'string' ? config.apiKeyHeader.trim() : '';
    if (apiKey && apiKeyHeader) {
        headers[apiKeyHeader] = apiKey;
    }

    const authHeader = typeof config.authHeader === 'string' ? config.authHeader.trim() : '';
    const authScheme = typeof config.authScheme === 'string' ? config.authScheme.trim() : 'Bearer';
    const bearerToken = typeof config.bearerToken === 'string' ? config.bearerToken.trim() : '';
    if (bearerToken && authHeader && authScheme) {
        headers[authHeader] = `${authScheme} ${bearerToken}`;
    }
    return headers;
}

window.APP_API_CONFIG = APP_API_CONFIG;
window.buildApiAuthHeaders = buildApiAuthHeaders;
