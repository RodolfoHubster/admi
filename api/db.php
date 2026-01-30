<?php
// api/db.php
$host = 'localhost';
$db   = 'perfume_db';
$user = 'root'; // Cambia esto por tu usuario real
$pass = '';     // Cambia esto por tu pass real
$charset = 'utf8mb4';

$dsn = "mysql:host=$host;dbname=$db;charset=$charset";
$options = [
    PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    PDO::ATTR_EMULATE_PREPARES   => false,
];

try {
    $pdo = new PDO($dsn, $user, $pass, $options);
} catch (\PDOException $e) {
    // En producción, no muestres el error real al público
    echo json_encode(["error" => "Error de conexión: " . $e->getMessage()]);
    exit;
}
?>