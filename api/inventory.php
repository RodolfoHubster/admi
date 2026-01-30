<?php
// api/inventory.php
header('Content-Type: application/json'); // ¡Importante! Avisa que devolvemos JSON
require 'db.php';

// Detectar el método HTTP
$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    // CONSULTA: Traer productos + Info del lote
    // Unimos la tabla abstracta con la tabla física
    $sql = "SELECT 
                ib.id, 
                p.name, 
                p.brand, 
                ib.sku_unique, 
                ib.current_ml, 
                ib.initial_ml,
                ib.status 
            FROM inventory_batches ib
            JOIN products p ON ib.product_id = p.id
            ORDER BY ib.id DESC";
            
    try {
        $stmt = $pdo->query($sql);
        $inventory = $stmt->fetchAll();
        
        // Devolvemos el array PHP convertido a JSON string
        echo json_encode($inventory);
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(["error" => "Error en consulta"]);
    }
}

// Aquí agregarías el bloque 'POST' para guardar nuevos productos luego
?>