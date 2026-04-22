// --- RESPALDOS Y DATOS ---

function descargarRespaldo() {
    if (typeof requirePermission === 'function' && !requirePermission('import_export')) return;
    const productos = localStorage.getItem(DB_KEY);
    if (!productos || productos === '[]') return showToast("No hay datos.", 'warning');
    
    const blob = new Blob([productos], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `respaldo_perfumes_${new Date().toISOString().slice(0,10)}.json`; 
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    showToast("Archivo descargado.", 'success');
    if (typeof auditLog === 'function') auditLog('backup.inventory_export', { total: JSON.parse(productos).length });
}

function cargarRespaldo(input) {
    if (typeof requirePermission === 'function' && !requirePermission('import_export')) return;
    const archivo = input.files[0];
    if (!archivo) return;
    const lector = new FileReader();
    lector.onload = function(e) {
        try {
            const datos = JSON.parse(e.target.result);
            if (datos.inventory && Array.isArray(datos.inventory)) {
                if(confirm("⚠️ ¿Restaurar RESPALDO COMPLETO (Inventario + Ventas)?")) {
                    localStorage.setItem(DB_KEY, JSON.stringify(datos.inventory));
                    localStorage.setItem(SALES_KEY, JSON.stringify(datos.sales || []));
                    localStorage.setItem(PAYOUTS_KEY, JSON.stringify(datos.payouts || []));
                    if (typeof auditLog === 'function') auditLog('backup.restore_full', { inventario: datos.inventory.length, ventas: (datos.sales || []).length });
                    showToast("Sistema restaurado.", 'success'); location.reload();
                }
            } else if (Array.isArray(datos)) {
                 if(confirm("⚠️ ¿Importar solo INVENTARIO?")) {
                    localStorage.setItem(DB_KEY, JSON.stringify(datos));
                    if (typeof auditLog === 'function') auditLog('backup.restore_inventory', { inventario: datos.length });
                    cargarInventario(); showToast("Inventario importado.", 'success');
                 }
            } else throw new Error("Formato desconocido");
        } catch (error) { showToast("Archivo inválido.", 'error'); }
    };
    lector.readAsText(archivo);
    input.value = ''; 
}

function exportarExcel() {
    if (typeof requirePermission === 'function' && !requirePermission('import_export')) return;
    const productos = JSON.parse(localStorage.getItem(DB_KEY)) || [];
    if (productos.length === 0) return showToast("Nada que exportar.", 'warning');
    
    let csvContent = "data:text/csv;charset=utf-8,SKU,Producto,Marca,Costo,Precio Venta,Inversion,Destino,ImagenURL\n";
    productos.forEach(p => {
        const nombreLimpio = p.nombre.replace(/,/g, " "); 
        csvContent += `${p.sku},${nombreLimpio},${p.marca},${p.costo},${p.precioVenta},${p.inversion},${p.destino},${p.imagen || ''}\n`;
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Inventario_Excel_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link); link.click(); document.body.removeChild(link);
    if (typeof auditLog === 'function') auditLog('backup.inventory_csv', { total: productos.length });
}
