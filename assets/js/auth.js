// =========================================================
// AUTH.JS — Protección de páginas con PIN
// Incluir este script en el <head> de cada página protegida
// ANTES que cualquier otro script
// =========================================================
(function () {
    if (sessionStorage.getItem('fito_auth') !== 'ok') {
        const actual = encodeURIComponent(location.pathname.split('/').pop() + location.search);
        location.replace('login.html?redirect=' + actual);
    }
})();
