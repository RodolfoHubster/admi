// CLAVE: Aquí definimos dónde se guarda la información (Local Storage del navegador)
const DB_KEY = 'perfume_inventory_v1';
// Clave para guardar el historial de dinero
const SALES_KEY = 'perfume_sales_v1';

const PAYOUTS_KEY = 'perfume_payouts_v1';
const ADMIN_PIN = "ee260f08526f9930ff7d9450916b76a7ce3d2f4b924dfdb84dd0fa77dfa1d8aa";
const EXPENSES_KEY = 'perfume_expenses_v1';
// VARIABLES DE ESTADO PARA FILTROS Y ORDEN
let ordenActual = { campo: 'nombre', dir: 'asc' }; // asc (A-Z) o desc (Z-A)
let indiceEdicion = null;