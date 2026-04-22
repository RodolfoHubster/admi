// =========================================================
// AUTH.JS — Protección con sesión y roles
// =========================================================
(function () {
    const SESSION_KEY = 'fito_session';
    const LEGACY_KEY = 'fito_auth';
    const SESSION_VERSION_KEY = 'fito_session_version';
    const CURRENT_VERSION = localStorage.getItem(SESSION_VERSION_KEY) || '1';
    // Política de sesión: por defecto 12h. Puede ajustarse con localStorage.fito_session_timeout_ms.
    const configuredTimeout = Number(localStorage.getItem('fito_session_timeout_ms'));
    const MAX_SESSION_MS = Number.isFinite(configuredTimeout) && configuredTimeout > 0
        ? configuredTimeout
        : 12 * 60 * 60 * 1000;
    const ROLE_ORDER = { readonly: 1, vendedor: 2, admin: 3 };
    const ROLE_PERMISSIONS = {
        readonly: ['read'],
        vendedor: ['read', 'sell', 'charge'],
        admin: ['read', 'sell', 'charge', 'edit', 'delete', 'manage_users', 'import_export']
    };

    function createRedirectUrl() {
        const actual = encodeURIComponent(location.pathname.split('/').pop() + location.search);
        return `login.html?redirect=${actual}`;
    }

    function parseSession() {
        try {
            const raw = sessionStorage.getItem(SESSION_KEY);
            if (!raw) return null;
            const parsed = JSON.parse(raw);
            if (!parsed || parsed.auth !== 'ok') return null;
            if (parsed.loginAt && (Date.now() - Number(parsed.loginAt)) > MAX_SESSION_MS) return null;
            if ((parsed.sessionVersion || '1') !== (localStorage.getItem(SESSION_VERSION_KEY) || '1')) return null;
            return parsed;
        } catch (e) {
            return null;
        }
    }

    function migrateLegacySession() {
        if (sessionStorage.getItem(LEGACY_KEY) !== 'ok') return null;
        const legacy = {
            auth: 'ok',
            role: 'admin',
            username: 'Administrador',
            loginAt: Date.now(),
            sessionVersion: CURRENT_VERSION
        };
        sessionStorage.setItem(SESSION_KEY, JSON.stringify(legacy));
        sessionStorage.removeItem(LEGACY_KEY);
        return legacy;
    }

    function hasRoleAtLeast(requiredRole) {
        const session = window.getFitoSession ? window.getFitoSession() : null;
        const userRole = session?.role || 'readonly';
        const required = requiredRole || 'readonly';
        return (ROLE_ORDER[userRole] || 0) >= (ROLE_ORDER[required] || 0);
    }

    function can(permission) {
        const session = window.getFitoSession ? window.getFitoSession() : null;
        const role = session?.role || 'readonly';
        const list = ROLE_PERMISSIONS[role] || [];
        return list.includes(permission);
    }

    function logoutGlobal(reason = 'logout') {
        const nextVersion = String(Date.now());
        localStorage.setItem(SESSION_VERSION_KEY, nextVersion);
        sessionStorage.removeItem(SESSION_KEY);
        sessionStorage.removeItem(LEGACY_KEY);
        const base = location.pathname.split('/').pop() === 'login.html' ? 'login.html' : createRedirectUrl();
        if (reason === 'expired') {
            const separator = base.includes('?') ? '&' : '?';
            location.replace(`${base}${separator}reason=expired`);
            return;
        }
        location.replace(base);
    }

    window.getFitoSession = function getFitoSession() {
        return parseSession();
    };
    window.fitoCan = can;
    window.fitoHasRoleAtLeast = hasRoleAtLeast;
    window.fitoLogoutGlobal = logoutGlobal;
    window.fitoRoleOrder = ROLE_ORDER;

    let session = parseSession() || migrateLegacySession();

    if (!session) {
        location.replace(createRedirectUrl());
        return;
    }

    window.addEventListener('storage', (event) => {
        if (event.key === SESSION_VERSION_KEY) {
            const current = localStorage.getItem(SESSION_VERSION_KEY) || '1';
            const active = parseSession();
            if (active && active.sessionVersion !== current) {
                logoutGlobal('expired');
            }
        }
    });
})();
