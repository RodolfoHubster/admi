// =========================================================
// IMG-PREVIEW.JS
// Tooltip de imagen a tamaño completo, position:fixed
// Funciona en tablas, modales, cualquier contexto
// Escucha clases: .js-preview-trigger con data-large-src
// =========================================================

(function () {
    // Crear el tooltip una sola vez al cargar la página
    const tooltip = document.createElement('div');
    tooltip.id = 'img-preview-tooltip';
    const tooltipImg = document.createElement('img');
    tooltip.appendChild(tooltipImg);
    document.body.appendChild(tooltip);

    const OFFSET_X = 20; // distancia del cursor en X
    const OFFSET_Y = 20; // distancia del cursor en Y

    // Posicionar el tooltip sin que se salga de la pantalla
    function posicionarTooltip(e) {
        const W = window.innerWidth;
        const H = window.innerHeight;
        const TW = tooltip.offsetWidth  || 220;
        const TH = tooltip.offsetHeight || 220;

        let x = e.clientX + OFFSET_X;
        let y = e.clientY + OFFSET_Y;

        // Si se sale por la derecha, aparece a la izquierda del cursor
        if (x + TW > W - 10) x = e.clientX - TW - OFFSET_X;
        // Si se sale por abajo, sube
        if (y + TH > H - 10) y = e.clientY - TH - OFFSET_Y;

        tooltip.style.left = x + 'px';
        tooltip.style.top  = y + 'px';
    }

    // Delegación de eventos en document (funciona con filas dinámicas)
    document.addEventListener('mouseover', function (e) {
        const trigger = e.target.closest('.js-preview-trigger');
        if (!trigger) return;

        const src = trigger.dataset.largeSrc || trigger.src || '';
        if (!src) return;

        tooltipImg.src = src;
        tooltip.classList.add('visible');
        posicionarTooltip(e);
    });

    document.addEventListener('mousemove', function (e) {
        if (!tooltip.classList.contains('visible')) return;
        const trigger = e.target.closest('.js-preview-trigger');
        if (!trigger) {
            tooltip.classList.remove('visible');
            return;
        }
        posicionarTooltip(e);
    });

    document.addEventListener('mouseout', function (e) {
        const trigger = e.target.closest('.js-preview-trigger');
        if (trigger) tooltip.classList.remove('visible');
    });
})();
