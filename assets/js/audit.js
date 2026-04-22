// =========================================================
// AUDITORÍA SIMPLE DE ACCIONES SENSIBLES
// =========================================================

const AUDIT_STORAGE_KEY = 'fito_audit_log_v1';
const AUDIT_MAX_ITEMS = 1000;

function getAuditLog() {
    try {
        const raw = localStorage.getItem(AUDIT_STORAGE_KEY);
        const data = raw ? JSON.parse(raw) : [];
        return Array.isArray(data) ? data : [];
    } catch (e) {
        return [];
    }
}

function setAuditLog(items) {
    try {
        localStorage.setItem(AUDIT_STORAGE_KEY, JSON.stringify(items.slice(-AUDIT_MAX_ITEMS)));
    } catch (e) {
        console.warn('No se pudo guardar auditoría', e);
    }
}

function auditLog(event, detail = {}) {
    const session = typeof getFitoSession === 'function' ? getFitoSession() : null;
    const record = {
        id: Date.now() + Math.floor(Math.random() * 1000),
        at: new Date().toISOString(),
        event,
        user: session?.username || 'Anónimo',
        role: session?.role || 'readonly',
        detail
    };
    const log = getAuditLog();
    log.push(record);
    setAuditLog(log);
    return record;
}

window.getAuditLog = getAuditLog;
window.auditLog = auditLog;
