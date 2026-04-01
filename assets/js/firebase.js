// =========================================================
// FIREBASE - INTEGRACIÓN CON FIRESTORE
// =========================================================

import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js';
import { 
    getFirestore, doc, setDoc, getDoc,
    collection, getDocs, writeBatch
} from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';

const firebaseConfig = {
    apiKey: "AIzaSyCgyk8dmNoxG0C-hDIHqyeVAh_r68i7X0A",
    authDomain: "fitoscents-admin.firebaseapp.com",
    projectId: "fitoscents-admin",
    storageBucket: "fitoscents-admin.firebasestorage.app",
    messagingSenderId: "1031164903960",
    appId: "1:1031164903960:web:1a414c4fb0a12b26c2796d"
};

const app = initializeApp(firebaseConfig);
const db  = getFirestore(app);

const COLECCIONES = {
    perfumes:    'inventario',
    ventas:      'ventas',
    pagos:       'pagos',
    gastos:      'gastos',
    plantillas:  'plantillas',
    sugerencias: 'sugerencias',
    clientes:    'clientes',
    config:      'config',
    decants_fuentes: 'decants_fuentes',
    decants_ventas:  'decants_ventas'
};

// ── LEER ────────────────────────────────────────────────
async function getDataCloud(key) {
    try {
        const colName = COLECCIONES[key];
        if (!colName) return [];

        if (key === 'config') {
            const snap = await getDoc(doc(db, colName, 'datos'));
            return snap.exists() ? snap.data() : {};
        }

        const snap = await getDocs(collection(db, colName));
        const resultado = [];
        snap.forEach(d => resultado.push({ ...d.data() }));
        return resultado;
    } catch (err) {
        console.error(`❌ Firebase leer [${key}]:`, err);
        // Fallback a localStorage si no hay red
        const LOCAL = {
            perfumes: 'perfume_inventory_v1',
            ventas:   'perfume_sales_v1',
            pagos:    'perfume_payouts_v1',
            gastos:   'perfume_expenses_v1',
            decants:  'fitoscents_decants_v1',
            decants_fuentes: 'decants_fuentes', 
            decants_ventas:  'decants_ventas' 
        };
        const raw = localStorage.getItem(LOCAL[key]);
        return raw ? JSON.parse(raw) : (key === 'config' ? {} : []);
    }
}

// ── GUARDAR ─────────────────────────────────────────────
async function setDataCloud(key, data) {
    try {
        const colName = COLECCIONES[key];
        if (!colName) return false;

        if (key === 'config') {
            await setDoc(doc(db, colName, 'datos'), data);
            return true;
        }

        const colRef   = collection(db, colName);
        const snapOld  = await getDocs(colRef);
        const batch    = writeBatch(db);

        snapOld.forEach(d => batch.delete(d.ref));

        data.forEach((item, i) => {
            const id  = item.id ? String(item.id) : String(Date.now() + i);
            batch.set(doc(db, colName, id), item);
        });

        await batch.commit();

        // Cache local también (offline)
        const LOCAL = {
            perfumes: 'perfume_inventory_v1',
            ventas:   'perfume_sales_v1',
            pagos:    'perfume_payouts_v1',
            gastos:   'perfume_expenses_v1',
            decants:  'fitoscents_decants_v1'
        };
        if (LOCAL[key]) localStorage.setItem(LOCAL[key], JSON.stringify(data));

        console.log(`☁️ ${key} sincronizado (${data.length} items)`);
        return true;
    } catch (err) {
        console.error(`❌ Firebase guardar [${key}]:`, err);
        return false;
    }
}

// ── MIGRACIÓN (usar UNA sola vez) ───────────────────────
async function migrarLocalStorageAFirebase() {
    const mapa = {
        perfumes:  'perfume_inventory_v1',
        ventas:    'perfume_sales_v1',
        pagos:     'perfume_payouts_v1',
        gastos:    'perfume_expenses_v1',
        decants:   'fitoscents_decants_v1'
    };

    let total = 0;
    const log = [];

    for (const [key, localKey] of Object.entries(mapa)) {
        const raw = localStorage.getItem(localKey);
        if (!raw) { log.push(`⚪ ${key}: vacío`); continue; }
        const data = JSON.parse(raw);
        if (!Array.isArray(data) || !data.length) { log.push(`⚪ ${key}: sin datos`); continue; }
        await setDataCloud(key, data);
        total += data.length;
        log.push(`✅ ${key}: ${data.length} items`);
    }

    alert(`🚀 Migración lista!\n\n${log.join('\n')}\n\nTotal: ${total} registros en Firebase`);
}

window.getDataCloud                = getDataCloud;
window.setDataCloud                = setDataCloud;
window.migrarLocalStorageAFirebase = migrarLocalStorageAFirebase;

console.log('🔥 Firebase conectado — Fitoscents Admin');
