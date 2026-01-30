// --- RESPALDOS Y DATOS ---

function descargarRespaldo() {
    const productos = localStorage.getItem(DB_KEY);
    if (!productos || productos === '[]') return alert("No hay datos.");
    
    const blob = new Blob([productos], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `respaldo_perfumes_${new Date().toISOString().slice(0,10)}.json`; 
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    alert("✅ Archivo descargado.");
}

function cargarRespaldo(input) {
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
                    alert("✅ Sistema restaurado."); location.reload();
                }
            } else if (Array.isArray(datos)) {
                 if(confirm("⚠️ ¿Importar solo INVENTARIO?")) {
                    localStorage.setItem(DB_KEY, JSON.stringify(datos));
                    cargarInventario(); alert("✅ Inventario importado.");
                 }
            } else throw new Error("Formato desconocido");
        } catch (error) { alert("❌ Archivo inválido."); }
    };
    lector.readAsText(archivo);
    input.value = ''; 
}

function exportarExcel() {
    const productos = JSON.parse(localStorage.getItem(DB_KEY)) || [];
    if (productos.length === 0) return alert("Nada que exportar.");
    
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
}