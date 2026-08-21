import { openDB } from 'idb';
import { dbOficial } from '../supabaseClient';

const DB_NAME = 'RSR_ERP_DB';
const STORE_NAME = 'articulos';

let cacheCatalogoRAM = null;

export const initDB = async () => {
  return openDB(DB_NAME, 1, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'cod' });
        store.createIndex('distribuidor', 'distribuidor', { unique: false });
        store.createIndex('codigo_aux', 'codigo_aux', { unique: false });
      }
    },
  });
};

export const syncCatalogo = async (forzar = false) => {
  const db = await initDB();
  const count = await db.count(STORE_NAME);
  
  if (count > 0 && !forzar) {
    console.log(`Catálogo local listo. Repuestos en caché: ${count}`);
    return;
  }

  console.log("Iniciando descarga completa de todas las distribuidoras...");
  let todosLosArticulos = [];
  let desde = 0;
  const paso = 1000;
  let hayMas = true;

  while (hayMas) {
    const { data, error } = await dbOficial.from('articulos').select('*').range(desde, desde + paso - 1);
    if (error) break;
    if (data && data.length > 0) {
      todosLosArticulos = todosLosArticulos.concat(data);
      desde += paso;
      if (data.length < paso) hayMas = false;
    } else {
      hayMas = false;
    }
  }

  if (todosLosArticulos.length > 0) {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    await tx.store.clear();
    await Promise.all(todosLosArticulos.map(item => tx.store.put(item)));
    await tx.done;
    cacheCatalogoRAM = null; 
  }
};

export const precargarCatalogoEnRAM = async () => {
  if (cacheCatalogoRAM) return;
  const db = await initDB();
  const crudos = await db.getAll(STORE_NAME);
  
  cacheCatalogoRAM = crudos.map(item => ({
    ...item,
    _busquedaFull: `${item.cod || ''} ${item.desc || ''} ${item.marca || ''} ${item.codigo_aux || ''} ${item.distribuidor || ''} ${item.nro_original || ''}`.toLowerCase(),
    _codSanitizado: (item.cod || '').toLowerCase().replace(/[^a-z0-9]/g, ''),
    _originalSanitizado: (item.nro_original || '').toLowerCase().replace(/[^a-z0-9]/g, ''),
    _auxSanitizado: (item.codigo_aux || '').toLowerCase().replace(/[^a-z0-9]/g, '')
  }));
};

export const buscarArticulosLocal = async (texto, modoFiltro, filtroDistriExtra = '') => {
  if (!cacheCatalogoRAM) await precargarCatalogoEnRAM();
  
  let stringBusqueda = texto.toLowerCase().trim();
  
  // Si no tipeó nada pero tampoco eligió distribuidora, no mostramos nada
  if (!stringBusqueda && !filtroDistriExtra) return [];

  let busquedaLibre = false;
  let comodinDistri = filtroDistriExtra.toLowerCase();

  if (stringBusqueda.startsWith('*')) {
    busquedaLibre = true;
    stringBusqueda = stringBusqueda.substring(1).trim();
  }

  const lastAsterisk = stringBusqueda.lastIndexOf('*');
  if (lastAsterisk !== -1 && !filtroDistriExtra) {
    comodinDistri = stringBusqueda.substring(lastAsterisk + 1).trim();
    stringBusqueda = stringBusqueda.substring(0, lastAsterisk).trim();
  }
  
  const textoSanitizado = stringBusqueda.replace(/[^a-z0-9]/g, '');
  const terminos = stringBusqueda.split(/\s+/).filter(Boolean);
  
  const filtrados = cacheCatalogoRAM.filter(item => {
    const esDeEstanteria = item.en_estanteria === true || item.en_estanteria === 'true'; 
    if (modoFiltro === 'LOCAL' && !esDeEstanteria) return false;

    if (comodinDistri) {
      const distri = (item.distribuidor || '').toLowerCase();
      if (!distri.includes(comodinDistri)) return false;
    }

    if (terminos.length === 0) return true;

    let cumpleCondicion = false;

    if (busquedaLibre) {
      const matchPalabras = terminos.every(t => item._busquedaFull.includes(t));
      const matchCodigo = textoSanitizado.length > 2 && (
        item._originalSanitizado.includes(textoSanitizado) ||
        item._codSanitizado.includes(textoSanitizado) ||
        item._auxSanitizado.includes(textoSanitizado)
      );
      cumpleCondicion = matchPalabras || matchCodigo;
    } else {
      const primer = terminos[0];
      const descLimpia = (item.desc || '').toLowerCase().trim();
      
      const empiezaFijo = 
        item._codSanitizado.startsWith(primer) || 
        descLimpia.startsWith(primer) || 
        item._originalSanitizado.startsWith(primer) ||
        item._auxSanitizado.startsWith(primer);
        
      if (empiezaFijo) {
        const restoTerminos = terminos.slice(1);
        cumpleCondicion = restoTerminos.every(t => item._busquedaFull.includes(t));
      } else {
        if (textoSanitizado.length > 2) {
          cumpleCondicion = 
            item._codSanitizado.startsWith(textoSanitizado) ||
            item._originalSanitizado.startsWith(textoSanitizado) ||
            item._auxSanitizado.startsWith(textoSanitizado);
        }
      }
    }

    return cumpleCondicion;
  });

  return filtrados.slice(0, 50); 
};

export const obtenerDistribuidoresLocal = async () => {
  const db = await initDB();
  const todos = await db.getAll(STORE_NAME);
  return [...new Set(todos.map(i => i.distribuidor))].filter(Boolean).sort();
};

export const buscarEquivalenciasLocal = async (codigo_aux) => {
  if (!codigo_aux) return [];
  if (!cacheCatalogoRAM) await precargarCatalogoEnRAM();
  return cacheCatalogoRAM.filter(item => item.codigo_aux === codigo_aux);
};

export const obtenerArticuloLocal = async (cod) => {
  if (!cod) return null;
  if (cacheCatalogoRAM) return cacheCatalogoRAM.find(item => item.cod === cod) || null;
  const db = await initDB();
  return await db.get(STORE_NAME, cod);
};

export const actualizarArticuloLocal = async (cod, nuevosDatos) => {
  const db = await initDB();
  const item = await db.get(STORE_NAME, cod);
  if (!item) return;
  const itemActualizado = { ...item, ...nuevosDatos };
  await db.put(STORE_NAME, itemActualizado);
  
  if (cacheCatalogoRAM) {
    const index = cacheCatalogoRAM.findIndex(i => i.cod === cod);
    if (index !== -1) {
      cacheCatalogoRAM[index] = {
        ...itemActualizado,
        _busquedaFull: `${itemActualizado.cod || ''} ${itemActualizado.desc || ''} ${itemActualizado.marca || ''} ${itemActualizado.codigo_aux || ''} ${itemActualizado.distribuidor || ''} ${itemActualizado.nro_original || ''}`.toLowerCase(),
        _codSanitizado: (itemActualizado.cod || '').toLowerCase().replace(/[^a-z0-9]/g, ''),
        _originalSanitizado: (itemActualizado.nro_original || '').toLowerCase().replace(/[^a-z0-9]/g, ''),
        _auxSanitizado: (itemActualizado.codigo_aux || '').toLowerCase().replace(/[^a-z0-9]/g, '')
      };
    }
  }
};