import { openDB } from 'idb';
import { dbOficial } from '../supabaseClient';

const DB_NAME = 'RSR_ERP_DB';
const STORE_NAME = 'articulos';

// 1. Inicializa la base de datos en el navegador
export const initDB = async () => {
  return openDB(DB_NAME, 1, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        // La clave principal (PK) local es el código del artículo
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'cod' });
        // Índices para búsquedas ultrarrápidas
        store.createIndex('distribuidor', 'distribuidor', { unique: false });
        store.createIndex('codigo_aux', 'codigo_aux', { unique: false });
      }
    },
  });
};

// 2. Sincronización cruda: Baja todo de Supabase y lo mete en el disco local
export const syncCatalogo = async (forzar = false) => {
  const db = await initDB();
  const count = await db.count(STORE_NAME);
  
  // Si ya hay datos y no forzamos, salimos.
  if (count > 0 && !forzar) {
    console.log(`Catálogo local listo. Repuestos en caché: ${count}`);
    return;
  }

  console.log("Descargando catálogo completo a IndexedDB...");
  
  // El único select(*) permitido. Ocurre en background.
  const { data, error } = await dbOficial.from('articulos').select('*');
  if (error) {
    console.error("Fallo masivo al bajar catálogo:", error);
    return;
  }

  // Guardado transaccional masivo
  const tx = db.transaction(STORE_NAME, 'readwrite');
  await Promise.all(data.map(item => tx.store.put(item)));
  await tx.done;
  console.log("Catálogo sincronizado localmente. Repuestos bajados:", data.length);
};

// 3. Buscador Destructivo Todo-Terreno (El que no se congela)
export const buscarArticulosLocal = async (texto, modoFiltro) => {
  if (!texto.trim()) return [];
  
  const db = await initDB();
  const tx = db.transaction(STORE_NAME, 'readonly');
  const todos = await tx.store.getAll(); 
  
  // Sanitización cruda para matchear códigos exactos ignorando barras o espacios
  const textoSanitizado = texto.toLowerCase().replace(/[^a-z0-9]/g, '');
  
  // Separación de términos para búsqueda desordenada ("bomba agua log")
  const terminos = texto.toLowerCase().trim().split(/\s+/);
  
  const filtrados = todos.filter(item => {
    // Reglas de exclusión (Filtro F3 rotativo)
    if (modoFiltro === 'LOCAL' && !item.codigo_aux && item.stock <= 0) return false;
    if (modoFiltro !== 'LOCAL' && modoFiltro !== 'TODOS' && item.distribuidor !== modoFiltro) return false;

    // Extracción de datos del artículo
    const desc = (item.desc || '').toLowerCase();
    const cod = (item.cod || '').toLowerCase();
    const aux = (item.codigo_aux || '').toLowerCase();
    const marca = (item.marca || '').toLowerCase();
    
    // Sanitización del código original y maestro de la base de datos
    const originalSanitizado = (item.nro_original || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    const codSanitizado = cod.replace(/[^a-z0-9]/g, '');
    const auxSanitizado = aux.replace(/[^a-z0-9]/g, '');

    // Condición A: Búsqueda multi-término desordenada. 
    // TODAS las palabras tipeadas deben existir en la descripción, código, marca o auxiliar.
    const matchPalabras = terminos.every(termino => 
      desc.includes(termino) || 
      cod.includes(termino) || 
      aux.includes(termino) || 
      marca.includes(termino)
    );

    // Condición B: Búsqueda directa por código sanitizado.
    // Si el operador tipea "123456", matchea con el original "123/456" de VW.
    const matchCodigoSanitizado = textoSanitizado.length > 2 && (
      originalSanitizado.includes(textoSanitizado) ||
      codSanitizado.includes(textoSanitizado) ||
      auxSanitizado.includes(textoSanitizado)
    );

    return matchPalabras || matchCodigoSanitizado;
  });

  // Limitamos a 50 para no reventar el renderizado de React
  return filtrados.slice(0, 50); 
};

// 4. Obtener la lista de distribuidores para el filtro F3
export const obtenerDistribuidoresLocal = async () => {
  const db = await initDB();
  const todos = await db.getAll(STORE_NAME);
  // Extrae los distribuidores únicos, saca los nulos y los ordena alfabéticamente
  return [...new Set(todos.map(i => i.distribuidor))].filter(Boolean).sort();
};

// 5. Buscar todos los repuestos que comparten el mismo código maestro (Equivalencias Bálsamo)
export const buscarEquivalenciasLocal = async (codigo_aux) => {
  if (!codigo_aux) return [];
  const db = await initDB();
  // Usamos el índice que creamos en initDB para que sea instantáneo
  return await db.getAllFromIndex(STORE_NAME, 'codigo_aux', codigo_aux);
};

// 6. Obtener un artículo puntual por su código exacto
export const obtenerArticuloLocal = async (cod) => {
  if (!cod) return null;
  const db = await initDB();
  return await db.get(STORE_NAME, cod);
};

// 7. Actualizar un campo en el disco local para no perder sincronía con Supabase
export const actualizarArticuloLocal = async (cod, nuevosDatos) => {
  const db = await initDB();
  const item = await db.get(STORE_NAME, cod);
  if (!item) return;
  const itemActualizado = { ...item, ...nuevosDatos };
  await db.put(STORE_NAME, itemActualizado);
};