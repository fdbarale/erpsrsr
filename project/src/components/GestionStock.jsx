import React, { useState, useEffect } from 'react';
import { dbOficial } from '../supabaseClient';
import Papa from 'papaparse';
import DBFParser from 'dbf';
import * as XLSX from 'xlsx';

export default function GestionStock({ volverAlMenu }) {
  const [busquedaLocal, setBusquedaLocal] = useState('');
  const [busquedaCatalogo, setBusquedaCatalogo] = useState('');
  const [distribuidorFiltro, setDistribuidorFiltro] = useState('TODAS');

  const [stockLocal, setStockLocal] = useState([]);
  const [catalogo, setCatalogo] = useState([]);
  const [proveedores, setProveedores] = useState([]);

  const [celdaEditando, setCeldaEditando] = useState(null);
  const [valorCeldaTemporal, setValorCeldaTemporal] = useState('');
  const [altaManualForm, setAltaManualForm] = useState(null);
  const [itemParaInternalizar, setItemParaInternalizar] = useState(null);
  const [itemParaEditar, setItemParaEditar] = useState(null);
  
  const [mostrarImportador, setMostrarImportador] = useState(false);
  const [mostrarAumentoGlobal, setMostrarAumentoGlobal] = useState(false);
  const [mostrarCascada, setMostrarCascada] = useState(false);
  const [mostrarMarcas, setMostrarMarcas] = useState(false);

  const [provAumento, setProvAumento] = useState('');
  const [porcentajeAumento, setPorcentajeAumento] = useState(0);

  const [d1, setD1] = useState(''); const [d2, setD2] = useState(''); const [d3, setD3] = useState('');

  // === ESTADOS GESTOR MARCAS ===
  const [provMarcasId, setProvMarcasId] = useState('');
  const [dictMarcas, setDictMarcas] = useState({});
  const [marcaSeleccionadaEdicion, setMarcaSeleccionadaEdicion] = useState('');
  const [edicionMarcaDesc, setEdicionMarcaDesc] = useState('');
  const [edicionMarcaAlias, setEdicionMarcaAlias] = useState('');

  // === ESTADOS IMPORTADOR ===
  const [archivoCsv, setArchivoCsv] = useState(null);
  const [provSeleccionadoCsv, setProvSeleccionadoCsv] = useState('');
  const [margenPorDefectoCsv, setMargenPorDefectoCsv] = useState(74);
  const [descuentoProvCsv, setDescuentoProvCsv] = useState(0); 
  const [listaIncluyeIva, setListaIncluyeIva] = useState(false); 
  const [actualizarDescripciones, setActualizarDescripciones] = useState(true);
  const [marcaPorDefecto, setMarcaPorDefecto] = useState(''); 
  const [separadorManual, setSeparadorManual] = useState('ESPACIOS'); 
  const [filasASaltear, setFilasASaltear] = useState(0);
  const [procesandoCsv, setProcesandoCsv] = useState(false);

  const [previewFilas, setPreviewFilas] = useState([]); 
  const [datosCrudosExtraidos, setDatosCrudosExtraidos] = useState([]); 
  const [omitirPrimeraFila, setOmitirPrimeraFila] = useState(false);
  const [molde, setMolde] = useState({ col_cod: -1, col_desc: -1, col_costo: -1, col_marca: -1, col_cod_original: -1, col_stock: -1, regla_limpieza: 'ESTANDAR' });

  const formatoMoneda = (valor) => "$ " + parseFloat(valor || 0).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const redondear = (num) => Math.round((Number(num) + Number.EPSILON) * 100) / 100;

  // LECTURA DE PROVEEDORES
  useEffect(() => {
    const cargarProveedores = async () => {
      const { data } = await dbOficial.from('proveedores_distribuidores').select('*').order('nombre');
      if (data) setProveedores(data);
    };
    cargarProveedores();
  }, [mostrarImportador, mostrarMarcas]); 

  // FUNCION AUXILIAR PARA OBTENER ALIAS VISUAL DE MARCA
  const getMarcaAlias = (provNombre, marcaOriginal) => {
    if (!marcaOriginal) return '-';
    const p = proveedores.find(x => x.nombre === provNombre);
    if (p && p.descuentos_marcas && p.descuentos_marcas[marcaOriginal]) {
      return p.descuentos_marcas[marcaOriginal].alias || marcaOriginal;
    }
    return marcaOriginal;
  };

  // === BÚSQUEDA LOCAL ===
  useEffect(() => {
    const buscarLocal = async () => {
      let query = dbOficial.from('articulos').select('*').or('internalizado.eq.true,stock.gt.0,codigo_aux.not.is.null').order('desc');
      if (busquedaLocal.trim()) {
        const t = `%${busquedaLocal.trim()}%`;
        query = query.or(`cod.ilike.${t},desc.ilike.${t},codigo_aux.ilike.${t},nro_original.ilike.${t},marca.ilike.${t}`);
      }
      const { data, error } = await query.limit(100);
      if (!error && data) setStockLocal(data);
    };
    const timeoutId = setTimeout(() => buscarLocal(), 300);
    return () => clearTimeout(timeoutId);
  }, [busquedaLocal]);

  // === BÚSQUEDA CATÁLOGO ===
  useEffect(() => {
    const buscarCatalogo = async () => {
      if (!busquedaCatalogo.trim() && distribuidorFiltro === 'TODAS') { setCatalogo([]); return; }
      let query = dbOficial.from('articulos').select('*');
      
      if (distribuidorFiltro !== 'TODAS') {
        const provNombre = proveedores.find(p => p.id.toString() === distribuidorFiltro)?.nombre;
        if (provNombre) query = query.eq('distribuidor', provNombre);
      }
      
      if (busquedaCatalogo.trim()) {
        const t = `%${busquedaCatalogo.trim()}%`;
        query = query.or(`cod.ilike.${t},desc.ilike.${t},nro_original.ilike.${t},marca.ilike.${t},codigo_aux.ilike.${t}`);
      }
      const { data, error } = await query.limit(60);
      if (!error && data) setCatalogo(data);
    };
    const timeoutId = setTimeout(() => buscarCatalogo(), 300);
    return () => clearTimeout(timeoutId);
  }, [busquedaCatalogo, distribuidorFiltro, proveedores]);

  // === INTERNALIZAR ===
  const abrirFormularioInternalizar = (item) => {
    const costoConIva = parseFloat(item.precio_costo) || 0;
    const costoSinIva = redondear(costoConIva / 1.21);
    const mrg = parseFloat(item.margen_ganancia) || 74;
    const pPub = parseFloat(item.precio) || redondear(costoConIva * (1 + (mrg / 100)));

    setItemParaInternalizar({
      ...item,
      desc: item.desc || '',
      codigo_aux: item.codigo_aux || '',
      unidades_por_bulto: item.unidades_por_bulto || 1,
      unidad_envase: item.unidad_envase || 1,
      stock_ingreso: 0,
      precio_lista_base: parseFloat(item.precio_lista) || 0,
      costo_original_bulto_con_iva: costoConIva,
      costo_sin_iva_unitario: costoSinIva,
      costo_con_iva_unitario: costoConIva,
      margen: mrg,
      precio_venta: pPub
    });
  };

  const recalcularInternalizacion = (bultoCant, mrgVal) => {
    const cantBulto = Math.max(1, parseFloat(bultoCant) || 1);
    const costoConIvaUnit = redondear(itemParaInternalizar.costo_original_bulto_con_iva / cantBulto);
    const costoSinIvaUnit = redondear(costoConIvaUnit / 1.21);
    const margen = parseFloat(mrgVal) || 0;
    const precioFinal = redondear(costoConIvaUnit * (1 + (margen / 100)));

    setItemParaInternalizar(prev => ({
      ...prev,
      unidades_por_bulto: cantBulto,
      costo_sin_iva_unitario: costoSinIvaUnit,
      costo_con_iva_unitario: costoConIvaUnit,
      margen: margen,
      precio_venta: precioFinal
    }));
  };

  const confirmarInternalizacion = async () => {
    const payload = {
      desc: itemParaInternalizar.desc.toUpperCase(),
      codigo_aux: itemParaInternalizar.codigo_aux ? itemParaInternalizar.codigo_aux.toUpperCase() : null,
      unidades_por_bulto: parseFloat(itemParaInternalizar.unidades_por_bulto) || 1,
      unidad_envase: parseFloat(itemParaInternalizar.unidad_envase) || 1,
      precio_costo: itemParaInternalizar.costo_con_iva_unitario,
      precio: parseFloat(itemParaInternalizar.precio_venta) || 0,
      stock: (parseFloat(itemParaInternalizar.stock) || 0) + (parseFloat(itemParaInternalizar.stock_ingreso) || 0),
      internalizado: true
    };

    const { error } = await dbOficial.from('articulos').update(payload).eq('cod', itemParaInternalizar.cod);
    if (!error) {
      setStockLocal(prev => [{ ...itemParaInternalizar, ...payload }, ...prev.filter(x => x.cod !== itemParaInternalizar.cod)]);
      setItemParaInternalizar(null);
    } else alert("Error al internalizar el artículo.");
  };

  // === EDICIÓN Y BORRADO LOCAL ===
  const borrarDelLocal = async (cod) => {
    if (!window.confirm("¿Seguro querés quitar este repuesto de tu estantería local? (Seguirá existiendo en el catálogo del proveedor)")) return;
    const { error } = await dbOficial.from('articulos').update({ internalizado: false, stock: 0 }).eq('cod', cod);
    if (!error) setStockLocal(prev => prev.filter(x => x.cod !== cod));
    else alert("Error al borrar.");
  };

  const abrirModalEdicion = (item) => {
    const costoConIva = parseFloat(item.precio_costo) || 0;
    const costoSinIva = redondear(costoConIva / 1.21);
    setItemParaEditar({
      ...item, desc: item.desc || '', codigo_aux: item.codigo_aux || '', marca: item.marca || '',
      costo_sin_iva: costoSinIva, precio_costo: costoConIva, precio: item.precio || 0,
      stock: item.stock || 0, unidad_envase: item.unidad_envase || 1, unidades_por_bulto: item.unidades_por_bulto || 1
    });
  };

  const guardarEdicionCompleta = async () => {
    const payload = {
      desc: itemParaEditar.desc.toUpperCase(),
      codigo_aux: itemParaEditar.codigo_aux ? itemParaEditar.codigo_aux.toUpperCase() : null,
      marca: itemParaEditar.marca ? itemParaEditar.marca.toUpperCase() : null,
      precio_costo: parseFloat(itemParaEditar.precio_costo) || 0,
      precio: parseFloat(itemParaEditar.precio) || 0,
      stock: parseFloat(itemParaEditar.stock) || 0,
      unidad_envase: parseFloat(itemParaEditar.unidad_envase) || 1,
      unidades_por_bulto: parseFloat(itemParaEditar.unidades_por_bulto) || 1,
      internalizado: true
    };
    const { error } = await dbOficial.from('articulos').update(payload).eq('cod', itemParaEditar.cod);
    if (!error) {
      setStockLocal(prev => prev.map(item => item.cod === itemParaEditar.cod ? { ...item, ...payload } : item));
      setItemParaEditar(null);
    } else alert("Error al guardar repuesto.");
  };

  const iniciarEdicionEnLinea = (cod, campo, valorActual) => {
    setCeldaEditando({ cod, campo });
    setValorCeldaTemporal(valorActual !== null && valorActual !== undefined ? valorActual.toString() : '');
  };

  const guardarEdicionEnLinea = async (cod, campo) => {
    let valorFinal = valorCeldaTemporal;
    if (['stock', 'precio_costo', 'precio', 'unidad_envase', 'unidades_por_bulto'].includes(campo)) valorFinal = parseFloat(valorCeldaTemporal) || 0;
    if (['codigo_aux', 'marca', 'nro_original'].includes(campo)) valorFinal = valorCeldaTemporal.toUpperCase();

    let payload = { [campo]: valorFinal, internalizado: true };
    if (campo === 'precio_costo') payload.precio = redondear(valorFinal * 1.74); 

    const { error } = await dbOficial.from('articulos').update(payload).eq('cod', cod);
    if (!error) setStockLocal(prev => prev.map(item => item.cod === cod ? { ...item, ...payload } : item));
    else alert("Error al guardar.");
    setCeldaEditando(null);
  };

  const manejarTecladoEdicion = (e, cod, campo) => {
    if (e.key === 'Enter') { e.preventDefault(); guardarEdicionEnLinea(cod, campo); } 
    else if (e.key === 'Escape') setCeldaEditando(null);
  };

  // === CASCADA ===
  const aplicarCascada = () => {
    let factor = 1.0;
    if (d1) factor *= (1 - (parseFloat(d1) / 100));
    if (d2) factor *= (1 - (parseFloat(d2) / 100));
    if (d3) factor *= (1 - (parseFloat(d3) / 100));
    setDescuentoProvCsv(redondear((1 - factor) * 100));
    setMostrarCascada(false); setD1(''); setD2(''); setD3('');
  };

  // === GESTIÓN DE MARCAS (NUEVA LÓGICA CON ALIAS) ===
  useEffect(() => {
    if (provMarcasId) {
      const p = proveedores.find(x => x.id.toString() === provMarcasId);
      // Migración invisible por si quedaron datos viejos: {"MARCA": 10} pasa a {"MARCA": {descuento: 10, alias: "MARCA"}}
      let dbMarcas = p?.descuentos_marcas || {};
      for (let k in dbMarcas) {
        if (typeof dbMarcas[k] === 'number') dbMarcas[k] = { descuento: dbMarcas[k], alias: k };
      }
      setDictMarcas(dbMarcas);
    } else setDictMarcas({});
    setMarcaSeleccionadaEdicion(''); setEdicionMarcaDesc(''); setEdicionMarcaAlias('');
  }, [provMarcasId, proveedores]);

  const seleccionarMarcaEdicion = (marcaOri) => {
    setMarcaSeleccionadaEdicion(marcaOri);
    if (marcaOri && dictMarcas[marcaOri]) {
      setEdicionMarcaDesc(dictMarcas[marcaOri].descuento || 0);
      setEdicionMarcaAlias(dictMarcas[marcaOri].alias || marcaOri);
    } else {
      setEdicionMarcaDesc(''); setEdicionMarcaAlias('');
    }
  };

  const actualizarMarcaDict = () => {
    if (!marcaSeleccionadaEdicion) return;
    setDictMarcas(prev => ({ 
      ...prev, 
      [marcaSeleccionadaEdicion]: { 
        descuento: parseFloat(edicionMarcaDesc) || 0, 
        alias: edicionMarcaAlias.trim().toUpperCase() || marcaSeleccionadaEdicion 
      } 
    }));
    setMarcaSeleccionadaEdicion(''); setEdicionMarcaDesc(''); setEdicionMarcaAlias('');
  };

  const guardarDictMarcas = async () => {
    if (!provMarcasId) return;
    const { error } = await dbOficial.from('proveedores_distribuidores').update({ descuentos_marcas: dictMarcas }).eq('id', provMarcasId);
    if (error) return alert("Error al guardar marcas.");
    
    if (window.confirm("¿Querés recalcular todos los precios de este proveedor ahora mismo aplicando estas marcas?")) {
      const p = proveedores.find(x => x.id.toString() === provMarcasId);
      const { data: arts } = await dbOficial.from('articulos').select('id, precio_lista, marca, margen_ganancia').eq('distribuidor', p.nombre);
      if (!arts || arts.length === 0) { alert("No hay artículos cargados de este proveedor."); setMostrarMarcas(false); return; }

      alert(`Recalculando ${arts.length} artículos en la base de datos...`);
      for (const a of arts) {
        const infoMarca = dictMarcas[a.marca] || { descuento: 0 };
        const descMarca = infoMarca.descuento || 0;
        // Recalculamos desde el precio de lista virgen guardado
        const costoPostMarca = a.precio_lista * (1 - (descMarca / 100));
        const costoNeto = costoPostMarca * (1 - ((p.desc_general||0) / 100));
        const costoFinal = p.iva_incluido ? costoNeto : (costoNeto * 1.21);
        const mrg = a.margen_ganancia || 74;
        const precioPub = costoFinal * (1 + (mrg / 100));

        await dbOficial.from('articulos').update({ precio_costo: redondear(costoFinal), precio: redondear(precioPub) }).eq('id', a.id);
      }
      alert("✅ Recálculo terminado.");
    }
    setMostrarMarcas(false);
  };


  // === LECTOR ARCHIVOS Y PREVIEW ===
  useEffect(() => {
    if (datosCrudosExtraidos.length > 0) {
      const skip = Math.max(0, parseInt(filasASaltear) || 0);
      setPreviewFilas(datosCrudosExtraidos.slice(skip, skip + 6));
    } else setPreviewFilas([]);
  }, [datosCrudosExtraidos, filasASaltear]);

  useEffect(() => {
    if (provSeleccionadoCsv) {
      const prov = proveedores.find(p => p.id.toString() === provSeleccionadoCsv);
      if (prov) {
        setMolde(prov.config_columnas || { col_cod: -1, col_desc: -1, col_costo: -1, col_marca: -1, col_cod_original: -1, col_stock: -1, regla_limpieza: 'ESTANDAR' });
        setDescuentoProvCsv(prov.desc_general || 0);
        setListaIncluyeIva(prov.iva_incluido || false);
        setFilasASaltear(prov.config_columnas?.filas_a_saltear || 0);
      }
    }
  }, [provSeleccionadoCsv, proveedores]);

  useEffect(() => { if (archivoCsv) procesarArchivo(archivoCsv, separadorManual); }, [archivoCsv, separadorManual]); // eslint-disable-line

  const procesarArchivo = async (file, delimiterChar) => {
    const extension = file.name.split('.').pop().toLowerCase();
    if (extension === 'csv' || extension === 'txt') {
      if (delimiterChar === 'ESPACIOS') {
        const reader = new FileReader();
        reader.onload = (event) => {
          const cleanedText = event.target.result.replace(/[ \t]{2,}/g, '|');
          Papa.parse(cleanedText, { delimiter: '|', header: false, skipEmptyLines: true, complete: (res) => { if (res.data.length > 0) setDatosCrudosExtraidos(res.data); } });
        };
        reader.readAsText(file);
      } else {
        Papa.parse(file, { delimiter: delimiterChar === 'TAB' ? '\t' : delimiterChar, header: false, skipEmptyLines: true, complete: (res) => { if (res.data.length > 0) setDatosCrudosExtraidos(res.data); } });
      }
    } else if (extension === 'dbf') {
      try {
        const parser = new DBFParser(await file.arrayBuffer());
        const campos = parser.fields.map(f => f.name);
        setDatosCrudosExtraidos([campos, ...parser.records.map(r => campos.map(c => r[c]))]); 
      } catch (err) { alert("Error leyendo DBF."); }
    } else if (extension === 'xlsx' || extension === 'xls') {
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const workbook = XLSX.read(new Uint8Array(event.target.result), { type: 'array' });
          const json = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { header: 1, defval: "" });
          if (json.length > 0) setDatosCrudosExtraidos(json);
        } catch (error) { alert("Error leyendo Excel."); }
      };
      reader.readAsArrayBuffer(file);
    } else { alert("Formato no soportado."); setArchivoCsv(null); }
  };

  const asignarColumnaAMolde = (index, campo) => {
    let n = { ...molde }; for (let key in n) if (n[key] === index && key.startsWith('col_')) n[key] = -1;
    n[campo] = index; setMolde(n);
  };
  const obtenerCampoAsignado = (index) => Object.keys(molde).find(key => molde[key] === index && key.startsWith('col_')) || "";
  const limpiarNumeroFiltro = (valorOriginal, regla) => {
    if (!valorOriginal) return 0;
    let str = valorOriginal.toString().trim();
    if (regla === 'ARGENTINO') str = str.replace(/[^0-9,-]/g, '').replace(/,/g, '.');
    else if (regla === 'COMA_DECIMAL') str = str.replace(/,/g, '.');
    return parseFloat(str) || 0;
  };
  const extraerMarcaDeCosto = (v) => { if (!v) return null; const match = v.toString().trim().match(/[a-zA-Z]+/g); return match ? match.join(' ').toUpperCase() : null; };

  // === EJECUCIÓN DEL BARRIDO MASIVO ===
  const ejecutarBarridoMasivo = async () => {
    if (molde.col_cod === -1 || molde.col_desc === -1 || molde.col_costo === -1) return alert("Falta asignar Código, Descripción y Costo.");
    if (datosCrudosExtraidos.length === 0) return alert("No hay datos cargados.");
    setProcesandoCsv(true);
    
    const prov = proveedores.find(p => p.id.toString() === provSeleccionadoCsv);
    const provNombre = prov?.nombre || 'GENERAL';
    let dictMarcasAct = prov?.descuentos_marcas || {};
    // Garantizamos formato de objeto para las marcas
    for (let k in dictMarcasAct) { if (typeof dictMarcasAct[k] === 'number') dictMarcasAct[k] = { descuento: dictMarcasAct[k], alias: k }; }

    let mapaDescripcionesExistentes = new Map();
    if (!actualizarDescripciones) {
      const { data: artsOld } = await dbOficial.from('articulos').select('cod, desc').eq('distribuidor', provNombre);
      if (artsOld) artsOld.forEach(a => { if (a.desc) mapaDescripcionesExistentes.set(a.cod, a.desc); });
    }

    let mapUnicos = new Map();
    let marcasEnArchivo = new Set();
    const inicio = Math.max(0, parseInt(filasASaltear) || 0);

    for (let i = inicio; i < datosCrudosExtraidos.length; i++) {
      const fila = datosCrudosExtraidos[i];
      const rawCosto = fila[molde.col_costo]; const rawCod = fila[molde.col_cod]; const rawDesc = fila[molde.col_desc];
      if (!rawCod || !rawDesc) continue;

      const codigoLimpio = rawCod.toString().toUpperCase().trim();
      let marcaDetectada = molde.col_marca !== -1 && fila[molde.col_marca] ? fila[molde.col_marca].toString().toUpperCase().trim() : (extraerMarcaDeCosto(rawCosto) || (marcaPorDefecto ? marcaPorDefecto.toUpperCase() : null));
      
      if (marcaDetectada) marcasEnArchivo.add(marcaDetectada);
      
      const pListaBruto = limpiarNumeroFiltro(rawCosto, molde.regla_limpieza);
      const descMarca = marcaDetectada && dictMarcasAct[marcaDetectada] ? dictMarcasAct[marcaDetectada].descuento : 0;
      
      const costoPostMarca = pListaBruto * (1 - (descMarca / 100));
      const costoNeto = costoPostMarca * (1 - (descuentoProvCsv / 100));
      const costoFisico = listaIncluyeIva ? costoNeto : (costoNeto * 1.21);
      const pFinal = costoFisico * (1 + (margenPorDefectoCsv / 100));

      let descripcionFinal = rawDesc.toString().toUpperCase().trim();
      if (!actualizarDescripciones && mapaDescripcionesExistentes.has(codigoLimpio)) descripcionFinal = mapaDescripcionesExistentes.get(codigoLimpio);

      let articuloInfo = {
        distribuidor: provNombre, 
        cod: codigoLimpio, 
        desc: descripcionFinal,
        precio_lista: redondear(pListaBruto),
        precio_costo: redondear(costoFisico), 
        precio: redondear(pFinal), 
        marca: marcaDetectada,
        stock_proveedor: null 
      };

      if (molde.col_cod_original !== -1 && fila[molde.col_cod_original]) articuloInfo.nro_original = fila[molde.col_cod_original].toString().toUpperCase().trim();
      if (molde.col_stock !== -1 && fila[molde.col_stock] !== undefined && fila[molde.col_stock] !== null) articuloInfo.stock_proveedor = fila[molde.col_stock].toString().trim();

      mapUnicos.set(articuloInfo.cod, articuloInfo);
    }

    // Auto-registrar marcas nuevas en el JSON del proveedor
    marcasEnArchivo.forEach(m => {
      if (!dictMarcasAct[m]) dictMarcasAct[m] = { descuento: 0, alias: m };
    });

    // Guardar config del proveedor + marcas descubiertas
    const configAGuardar = { ...molde, filas_a_saltear: Math.max(0, parseInt(filasASaltear) || 0) };
    await dbOficial.from('proveedores_distribuidores').update({ 
      config_columnas: configAGuardar, desc_general: descuentoProvCsv, iva_incluido: listaIncluyeIva, descuentos_marcas: dictMarcasAct 
    }).eq('id', provSeleccionadoCsv);

    const upsertsLimpio = Array.from(mapUnicos.values());
    if (upsertsLimpio.length === 0) { setProcesandoCsv(false); return alert("Falló la extracción. Verificá las columnas seleccionadas."); }

    let erroresEnLote = 0;
    for (let i = 0; i < upsertsLimpio.length; i += 1000) {
      const { error } = await dbOficial.from('articulos').upsert(upsertsLimpio.slice(i, i + 1000), { onConflict: 'cod' }); 
      if (error) { console.error("Error BD:", error); erroresEnLote++; }
    }

    setProcesandoCsv(false);
    if (erroresEnLote > 0) alert("Proceso terminado con algunos errores en BD.");
    else alert(`✅ ¡Éxito! ${upsertsLimpio.length} artículos cargados al catálogo.`);
    setMostrarImportador(false); setArchivoCsv(null); setPreviewFilas([]); setDatosCrudosExtraidos([]);
  };

  // === RENDERIZADO ===
  return (
    <div className="bg-light min-vh-100 d-flex flex-column p-3">
      {/* BARRA SUPERIOR */}
      <div className="d-flex justify-content-between align-items-center border-bottom pb-2 mb-3 bg-white p-3 rounded shadow-sm">
        <div>
          <h4 className="fw-bold text-dark m-0">📦 Gestión de Stock y Catálogos</h4>
          <p className="text-muted small m-0">Precios transparentes: Lista, Costo s/IVA, Costo c/IVA y Venta Final</p>
        </div>
        <div className="d-flex gap-2">
          <button className="btn btn-sm text-white fw-bold shadow-sm" style={{ backgroundColor: '#6f42c1' }} onClick={() => setMostrarMarcas(true)}>🏷️ Desc. por Marca</button>
          <button className="btn btn-sm btn-success fw-bold shadow-sm" onClick={() => { setMostrarImportador(true); setArchivoCsv(null); setPreviewFilas([]); }}>📥 Importar Lista</button>
          <button className="btn btn-sm btn-outline-secondary fw-bold" onClick={volverAlMenu}>Volver al Menú</button>
        </div>
      </div>

      <div className="row flex-grow-1">
        {/* COLUMNA IZQUIERDA: CATÁLOGOS */}
        <div className="col-5 pe-2 d-flex flex-column">
          <div className="bg-white p-2 rounded shadow-sm mb-2">
            <h6 className="fw-bold text-secondary text-uppercase small mb-2">📑 Catálogo Distribuidora</h6>
            <div className="row g-1">
              <div className="col-7"><input type="text" className="form-control form-control-sm font-monospace fw-bold" placeholder="🔍 Cód, Marca, Maestro u Original..." value={busquedaCatalogo} onChange={e => setBusquedaCatalogo(e.target.value.toUpperCase())} /></div>
              <div className="col-5"><select className="form-select form-select-sm fw-bold text-truncate" value={distribuidorFiltro} onChange={e => setDistribuidorFiltro(e.target.value)}><option value="TODAS">TODOS LOS PROV.</option>{proveedores.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}</select></div>
            </div>
          </div>
          
          <div className="overflow-auto border rounded bg-white shadow-sm flex-grow-1" style={{ maxHeight: '72vh' }}>
            <ul className="list-group list-group-flush">
              {catalogo.length === 0 && <li className="list-group-item text-center text-muted small py-5">Escribí en el buscador superior para explorar repuestos de distribuidoras.</li>}
              {catalogo.map((item, idx) => {
                const costoConIva = parseFloat(item.precio_costo) || 0;
                const costoSinIva = redondear(costoConIva / 1.21);
                const marcaVisual = getMarcaAlias(item.distribuidor, item.marca);
                return (
                  <li key={idx} className="list-group-item p-2 border-bottom">
                    <div className="d-flex justify-content-between align-items-start">
                      <div>
                        <div className="d-flex align-items-center gap-2">
                          <strong className="font-monospace text-primary">{item.cod}</strong>
                          {marcaVisual && <span className="badge bg-dark" style={{fontSize:'10px'}}>{marcaVisual}</span>}
                          <span className="badge bg-secondary" style={{fontSize:'9px'}}>{item.distribuidor}</span>
                          {item.stock_proveedor && (
                            <span className={`badge ${['NO', '0'].includes(item.stock_proveedor.toUpperCase()) ? 'bg-danger' : 'bg-info text-dark'}`} style={{fontSize:'9px'}} title="Disponibilidad en Distribuidora">
                              Stock Dist: {item.stock_proveedor}
                            </span>
                          )}
                        </div>
                        <p className="m-0 mt-1 small fw-bold text-dark">{item.desc}</p>
                        <small className="text-muted d-block" style={{fontSize:'10px'}}>Orig: {item.nro_original||'-'} | Maestro: {item.codigo_aux||'-'}</small>
                      </div>
                      <div className="text-end ps-2 border-start" style={{minWidth:'120px'}}>
                        {item.precio_lista > 0 && <span className="d-block text-muted" style={{fontSize:'9px'}}>Lista: <strong className="font-monospace">{formatoMoneda(item.precio_lista)}</strong></span>}
                        <span className="d-block text-secondary font-monospace" style={{fontSize:'10px'}}>s/IVA: {formatoMoneda(costoSinIva)}</span>
                        <span className="d-block text-danger fw-bold font-monospace" style={{fontSize:'11px'}}>c/IVA: {formatoMoneda(costoConIva)}</span>
                        <button className="btn btn-sm btn-outline-success py-0 px-2 fw-bold mt-1" style={{fontSize:'11px'}} onClick={() => abrirFormularioInternalizar(item)}>➕ Internalizar</button>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>

        {/* COLUMNA DERECHA: ESTANTERÍA DEL LOCAL */}
        <div className="col-7 ps-2 d-flex flex-column">
          <div className="bg-white p-2 rounded shadow-sm mb-2 d-flex justify-content-between align-items-center">
            <h6 className="fw-bold text-dark m-0 text-uppercase small">🏪 Estantería del Local</h6>
            <input type="text" className="form-control form-control-sm w-50 border-primary" placeholder="🔍 Filtrar estantería (Maestro, Desc, Cód)..." value={busquedaLocal} onChange={e => setBusquedaLocal(e.target.value.toUpperCase())} />
          </div>
          
          <div className="overflow-auto border rounded bg-white shadow-sm flex-grow-1" style={{ maxHeight: '72vh' }}>
            <table className="table table-sm table-hover mb-0 align-middle" style={{ fontSize: '11px' }}>
              <thead className="table-dark sticky-top">
                <tr>
                  <th className="ps-2">Cód</th>
                  <th>Descripción</th>
                  <th>Marca</th>
                  <th><span className="text-warning">Maestro</span></th>
                  <th className="text-end text-muted">Costo s/IVA</th>
                  <th className="text-end text-danger">Costo c/IVA</th>
                  <th className="text-end text-success">Público Final</th>
                  <th className="text-center">Stock</th>
                  <th className="text-center" style={{width:'50px'}}>Acción</th>
                </tr>
              </thead>
              <tbody>
                {stockLocal.map((item, idx) => {
                  const costoConIva = parseFloat(item.precio_costo) || 0;
                  const costoSinIva = redondear(costoConIva / 1.21);
                  const marcaVisual = getMarcaAlias(item.distribuidor, item.marca);
                  return (
                    <tr key={idx}>
                      <td className="font-monospace fw-bold text-primary ps-2">
                        <div className="text-truncate" style={{maxWidth: '75px'}} title={item.cod}>{item.cod}</div>
                        <div className="text-muted" style={{fontSize: '9px'}}>{item.distribuidor?.substring(0,8)}</div>
                      </td>
                      <td className="fw-bold text-dark text-truncate" style={{maxWidth:'130px'}} title={item.desc}>{item.desc}</td>
                      <td onDoubleClick={() => iniciarEdicionEnLinea(item.cod, 'marca', item.marca)}>{celdaEditando?.cod === item.cod && celdaEditando?.campo === 'marca' ? <input className="form-control form-control-sm text-uppercase" autoFocus value={valorCeldaTemporal} onChange={e => setValorCeldaTemporal(e.target.value)} onKeyDown={(e) => manejarTecladoEdicion(e, item.cod, 'marca')} onBlur={() => guardarEdicionEnLinea(item.cod, 'marca')} /> : <span className="badge bg-light text-dark border" title={`Original: ${item.marca}`}>{marcaVisual || '-'}</span>}</td>
                      <td onDoubleClick={() => iniciarEdicionEnLinea(item.cod, 'codigo_aux', item.codigo_aux)} className="bg-warning bg-opacity-10">{celdaEditando?.cod === item.cod && celdaEditando?.campo === 'codigo_aux' ? <input className="form-control form-control-sm font-monospace text-uppercase" autoFocus value={valorCeldaTemporal} onChange={e => setValorCeldaTemporal(e.target.value)} onKeyDown={(e) => manejarTecladoEdicion(e, item.cod, 'codigo_aux')} onBlur={() => guardarEdicionEnLinea(item.cod, 'codigo_aux')} /> : <span className="font-monospace fw-bold text-dark">{item.codigo_aux || '+'}</span>}</td>
                      
                      <td className="text-end text-muted font-monospace">{formatoMoneda(costoSinIva)}</td>
                      <td className="text-end" onDoubleClick={() => iniciarEdicionEnLinea(item.cod, 'precio_costo', item.precio_costo)}>{celdaEditando?.cod === item.cod && celdaEditando?.campo === 'precio_costo' ? <input type="number" className="form-control form-control-sm text-end text-danger" autoFocus value={valorCeldaTemporal} onChange={e => setValorCeldaTemporal(e.target.value)} onKeyDown={(e) => manejarTecladoEdicion(e, item.cod, 'precio_costo')} onBlur={() => guardarEdicionEnLinea(item.cod, 'precio_costo')} /> : <span className="text-danger fw-bold font-monospace">{formatoMoneda(costoConIva)}</span>}</td>
                      <td className="text-end bg-success bg-opacity-10" onDoubleClick={() => iniciarEdicionEnLinea(item.cod, 'precio', item.precio)}>{celdaEditando?.cod === item.cod && celdaEditando?.campo === 'precio' ? <input type="number" className="form-control form-control-sm text-end text-success" autoFocus value={valorCeldaTemporal} onChange={e => setValorCeldaTemporal(e.target.value)} onKeyDown={(e) => manejarTecladoEdicion(e, item.cod, 'precio')} onBlur={() => guardarEdicionEnLinea(item.cod, 'precio')} /> : <span className="text-success fw-bold font-monospace">{formatoMoneda(item.precio)}</span>}</td>

                      <td className="text-center" onDoubleClick={() => iniciarEdicionEnLinea(item.cod, 'stock', item.stock)}>{celdaEditando?.cod === item.cod && celdaEditando?.campo === 'stock' ? <input type="number" className="form-control form-control-sm text-center mx-auto" style={{maxWidth:'45px'}} autoFocus value={valorCeldaTemporal} onChange={e => setValorCeldaTemporal(e.target.value)} onKeyDown={(e) => manejarTecladoEdicion(e, item.cod, 'stock')} onBlur={() => guardarEdicionEnLinea(item.cod, 'stock')} /> : <span className={`badge ${item.stock > 0 ? 'bg-primary' : 'bg-secondary'}`}>{item.stock}</span>}</td>

                      <td className="text-center">
                        <button className="btn btn-sm btn-outline-dark py-0 px-1 border-0" title="Editar Repuesto" onClick={() => abrirModalEdicion(item)}>✏️</button>
                        <button className="btn btn-sm btn-outline-danger py-0 px-1 border-0" title="Quitar de Estantería" onClick={() => borrarDelLocal(item.cod)}>🗑️</button>
                      </td>
                    </tr>
                  );
                })}
                {stockLocal.length === 0 && <tr><td colSpan="9" className="text-center py-5 text-muted">Aún no hay repuestos en la estantería.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ========================================================
          MODALES DE FUNCIONALIDAD
      ======================================================== */}

      {/* 1. MODAL INTERNALIZAR */}
      {itemParaInternalizar && (
        <div className="position-fixed top-0 start-0 w-100 h-100 bg-dark bg-opacity-75 d-flex justify-content-center align-items-center" style={{ zIndex: 2000 }}>
          <div className="card shadow-lg p-4 border-0" style={{ width: '650px', borderRadius: '12px' }}>
            <h5 className="fw-bold text-dark border-bottom pb-2 mb-3">🔄 Internalizar Artículo al Local</h5>
            
            <div className="mb-2">
              <label className="small fw-bold text-secondary">Descripción</label>
              <input type="text" className="form-control fw-bold border-primary text-uppercase" value={itemParaInternalizar.desc} onChange={e => setItemParaInternalizar({...itemParaInternalizar, desc: e.target.value})} />
            </div>

            <div className="row g-2 mb-3">
              <div className="col-4"><label className="small fw-bold text-muted">Cód. Origen</label><input type="text" className="form-control font-monospace bg-light" disabled value={itemParaInternalizar.cod} /></div>
              <div className="col-4"><label className="small fw-bold text-muted">Precio Lista Fábrica</label><input type="text" className="form-control font-monospace bg-light" disabled value={formatoMoneda(itemParaInternalizar.precio_lista_base)} /></div>
              <div className="col-4"><label className="small fw-bold text-danger">Costo con IVA Bulto</label><input type="text" className="form-control fw-bold bg-light text-danger" disabled value={formatoMoneda(itemParaInternalizar.costo_original_bulto_con_iva)} /></div>
            </div>

            {/* FRACCIONAMIENTO */}
            <div className="p-3 bg-light rounded border mb-3">
              <h6 className="fw-bold text-dark small border-bottom pb-1 mb-2">📦 Fraccionamiento y Logística</h6>
              <div className="row g-2">
                <div className="col-6">
                  <label className="small fw-bold text-primary">Unidades por Bulto (Divisor)</label>
                  <input type="number" min="1" className="form-control text-center fw-bold border-primary" value={itemParaInternalizar.unidades_por_bulto} onChange={e => recalcularInternalizacion(e.target.value, itemParaInternalizar.margen)} />
                </div>
                <div className="col-6">
                  <label className="small fw-bold text-secondary">Unidad Envase (Mínimo a pedir)</label>
                  <input type="number" min="1" className="form-control text-center fw-bold" value={itemParaInternalizar.unidad_envase} onChange={e => setItemParaInternalizar({...itemParaInternalizar, unidad_envase: parseFloat(e.target.value)||1})} />
                </div>
              </div>
            </div>

            {/* DESGLOSE MATEMÁTICO */}
            <div className="row g-2 mb-3 p-2 border rounded bg-white">
              <div className="col-3">
                <label className="small fw-bold text-muted">Costo Unit. s/IVA</label>
                <input type="text" className="form-control form-control-sm font-monospace bg-light text-muted" disabled value={formatoMoneda(itemParaInternalizar.costo_sin_iva_unitario)} />
              </div>
              <div className="col-3">
                <label className="small fw-bold text-danger">Costo Unit. c/IVA</label>
                <input type="text" className="form-control form-control-sm font-monospace fw-bold text-danger bg-light" disabled value={formatoMoneda(itemParaInternalizar.costo_con_iva_unitario)} />
              </div>
              <div className="col-3">
                <label className="small fw-bold text-dark">Ganancia (%)</label>
                <input type="number" className="form-control form-control-sm text-center fw-bold" value={itemParaInternalizar.margen} onChange={e => recalcularInternalizacion(itemParaInternalizar.unidades_por_bulto, e.target.value)} />
              </div>
              <div className="col-3">
                <label className="small fw-bold text-success">Público Final ($)</label>
                <input type="number" className="form-control form-control-sm fw-bold text-success border-success" value={itemParaInternalizar.precio_venta} onChange={e => setItemParaInternalizar({...itemParaInternalizar, precio_venta: parseFloat(e.target.value)||0})} />
              </div>
            </div>

            <div className="row g-2 mb-4 border-top pt-3">
              <div className="col-8">
                <label className="small fw-bold text-warning-emphasis">Cód Maestro Bálsamo (Equivalencia)</label>
                <input type="text" className="form-control font-monospace text-uppercase border-warning" placeholder="Ej: Cód de Bálsamo" value={itemParaInternalizar.codigo_aux} onChange={e => setItemParaInternalizar({...itemParaInternalizar, codigo_aux: e.target.value})} />
              </div>
              <div className="col-4">
                <label className="small fw-bold text-success">Stock en Estante</label>
                <input type="number" className="form-control text-center fw-bold text-success border-success" value={itemParaInternalizar.stock_ingreso} onChange={e => setItemParaInternalizar({...itemParaInternalizar, stock_ingreso: e.target.value})} />
              </div>
            </div>

            <div className="d-flex gap-2">
              <button className="btn btn-light border fw-bold w-50" onClick={() => setItemParaInternalizar(null)}>Cancelar</button>
              <button className="btn btn-success fw-bold w-50 shadow" onClick={confirmarInternalizacion}>Internalizar al Local</button>
            </div>
          </div>
        </div>
      )}

      {/* 2. MODAL EDICIÓN REPUESTO */}
      {itemParaEditar && (
        <div className="position-fixed top-0 start-0 w-100 h-100 bg-dark bg-opacity-75 d-flex justify-content-center align-items-center" style={{ zIndex: 2000 }}>
          <div className="card shadow-lg p-4 border-0" style={{ width: '600px', borderRadius: '12px' }}>
            <h5 className="fw-bold text-dark border-bottom pb-2 mb-3">✏️ Modificar Repuesto en Estantería</h5>
            
            <div className="mb-2">
              <label className="small fw-bold text-secondary">Descripción</label>
              <input type="text" className="form-control fw-bold text-uppercase" value={itemParaEditar.desc} onChange={e => setItemParaEditar({...itemParaEditar, desc: e.target.value})} />
            </div>

            <div className="row g-2 mb-3">
              <div className="col-4">
                <label className="small fw-bold text-secondary">Marca</label>
                <input type="text" className="form-control text-uppercase" value={itemParaEditar.marca} onChange={e => setItemParaEditar({...itemParaEditar, marca: e.target.value})} />
              </div>
              <div className="col-4">
                <label className="small fw-bold text-danger">Costo c/IVA ($)</label>
                <input type="number" className="form-control fw-bold text-danger" value={itemParaEditar.precio_costo} onChange={e => setItemParaEditar({...itemParaEditar, precio_costo: e.target.value})} />
              </div>
              <div className="col-4">
                <label className="small fw-bold text-success">Público Final ($)</label>
                <input type="number" className="form-control fw-bold text-success border-success" value={itemParaEditar.precio} onChange={e => setItemParaEditar({...itemParaEditar, precio: e.target.value})} />
              </div>
            </div>

            <div className="row g-2 mb-3 p-2 bg-light rounded border">
              <div className="col-4">
                <label className="small fw-bold text-secondary">Stock Físico</label>
                <input type="number" className="form-control text-center fw-bold" value={itemParaEditar.stock} onChange={e => setItemParaEditar({...itemParaEditar, stock: e.target.value})} />
              </div>
              <div className="col-4">
                <label className="small fw-bold text-secondary">Unidades x Bulto</label>
                <input type="number" className="form-control text-center fw-bold" value={itemParaEditar.unidades_por_bulto} onChange={e => setItemParaEditar({...itemParaEditar, unidades_por_bulto: e.target.value})} />
              </div>
              <div className="col-4">
                <label className="small fw-bold text-secondary">Unidad de Envase</label>
                <input type="number" className="form-control text-center fw-bold" value={itemParaEditar.unidad_envase} onChange={e => setItemParaEditar({...itemParaEditar, unidad_envase: e.target.value})} />
              </div>
            </div>

            <div className="mb-4">
              <label className="small fw-bold text-warning-emphasis">Cód Maestro Bálsamo (Equivalencia)</label>
              <input type="text" className="form-control font-monospace text-uppercase border-warning fw-bold" value={itemParaEditar.codigo_aux} onChange={e => setItemParaEditar({...itemParaEditar, codigo_aux: e.target.value})} />
            </div>

            <div className="d-flex gap-2">
              <button className="btn btn-light border fw-bold w-50" onClick={() => setItemParaEditar(null)}>Cancelar</button>
              <button className="btn btn-primary fw-bold w-50 shadow" onClick={guardarEdicionCompleta}>Guardar Cambios</button>
            </div>
          </div>
        </div>
      )}

      {/* 3. CALCULADORA CASCADA */}
      {mostrarCascada && (
        <div className="position-fixed top-0 start-0 w-100 h-100 bg-dark bg-opacity-75 d-flex justify-content-center align-items-center" style={{ zIndex: 2100 }}>
          <div className="card shadow-lg p-3 border-0" style={{ width: '350px', borderRadius: '12px' }}>
            <h6 className="fw-bold text-dark border-bottom pb-2">🧮 Calculadora de Descuentos</h6>
            <p className="small text-muted mb-2">Ingresá los descuentos encadenados:</p>
            <div className="d-flex gap-2 mb-3">
              <input type="number" className="form-control text-center fw-bold" placeholder="%" value={d1} onChange={e=>setD1(e.target.value)} />
              <span className="mt-2">+</span>
              <input type="number" className="form-control text-center fw-bold" placeholder="%" value={d2} onChange={e=>setD2(e.target.value)} />
              <span className="mt-2">+</span>
              <input type="number" className="form-control text-center fw-bold" placeholder="%" value={d3} onChange={e=>setD3(e.target.value)} />
            </div>
            <div className="d-flex gap-2">
              <button className="btn btn-sm btn-light border w-50" onClick={() => setMostrarCascada(false)}>Volver</button>
              <button className="btn btn-sm btn-primary fw-bold w-50" onClick={aplicarCascada}>Aplicar Real</button>
            </div>
          </div>
        </div>
      )}

      {/* 4. GESTOR DE MARCAS */}
      {mostrarMarcas && (
        <div className="position-fixed top-0 start-0 w-100 h-100 bg-dark bg-opacity-75 d-flex justify-content-center align-items-center" style={{ zIndex: 2000 }}>
          <div className="card shadow-lg p-0 border-0 d-flex flex-column" style={{ width: '600px', maxHeight: '85vh', borderRadius: '12px' }}>
            <div className="p-3 border-bottom text-white" style={{backgroundColor: '#6f42c1', borderTopLeftRadius:'12px', borderTopRightRadius:'12px'}}>
              <h5 className="fw-bold m-0">🏷️ Descuentos Fijos por Marca</h5>
              <p className="small m-0 text-white-50">Edita el descuento o el nombre visual (Alias) para tu local.</p>
            </div>
            
            <div className="p-3 bg-light border-bottom">
              <label className="small fw-bold text-secondary mb-1">Proveedor a configurar:</label>
              <select className="form-select fw-bold border-dark" value={provMarcasId} onChange={e => setProvMarcasId(e.target.value)}>
                <option value="">-- Seleccione proveedor --</option>
                {proveedores.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
              </select>
            </div>

            <div className="p-3 flex-grow-1 overflow-auto bg-white">
              {!provMarcasId ? (
                <div className="text-center text-muted small py-4">Seleccioná un proveedor arriba.</div>
              ) : (
                <>
                  <div className="d-flex gap-2 mb-3 align-items-end border p-2 rounded bg-light">
                    <div className="flex-grow-1">
                      <label className="small text-muted fw-bold">Elegir Marca Encontrada</label>
                      <select className="form-select font-monospace" value={marcaSeleccionadaEdicion} onChange={(e) => seleccionarMarcaEdicion(e.target.value)}>
                        <option value="">-- Seleccionar --</option>
                        {Object.keys(dictMarcas).sort().map(m => <option key={m} value={m}>{m}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="small text-muted fw-bold">Nombre Corto (Alias)</label>
                      <input type="text" className="form-control text-uppercase font-monospace" placeholder="Ej: DOLZ" value={edicionMarcaAlias} onChange={e=>setEdicionMarcaAlias(e.target.value)} disabled={!marcaSeleccionadaEdicion} />
                    </div>
                    <div>
                      <label className="small text-muted fw-bold">% Desc</label>
                      <input type="number" className="form-control text-center" style={{width:'80px'}} value={edicionMarcaDesc} onChange={e=>setEdicionMarcaDesc(e.target.value)} disabled={!marcaSeleccionadaEdicion} />
                    </div>
                    <div>
                      <button className="btn btn-dark fw-bold px-3" onClick={actualizarMarcaDict} disabled={!marcaSeleccionadaEdicion}>Aplicar</button>
                    </div>
                  </div>
                  
                  <ul className="list-group list-group-flush border rounded">
                    {Object.keys(dictMarcas).length === 0 && <li className="list-group-item text-muted small text-center">No hay marcas registradas para este proveedor. Importá un Excel para que aparezcan solas.</li>}
                    {Object.entries(dictMarcas).map(([marcaOriginal, dataMarca]) => (
                      <li key={marcaOriginal} className="list-group-item d-flex justify-content-between align-items-center py-2 px-3">
                        <div>
                          <strong className="font-monospace text-dark d-block">{dataMarca.alias || marcaOriginal}</strong>
                          {dataMarca.alias && dataMarca.alias !== marcaOriginal && <small className="text-muted" style={{fontSize:'10px'}}>Original: {marcaOriginal}</small>}
                        </div>
                        <div>
                          <span className="badge bg-success fs-6 me-3">{dataMarca.descuento || 0}% OFF</span>
                        </div>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>

            <div className="p-3 border-top bg-light d-flex justify-content-end gap-2" style={{borderBottomLeftRadius:'12px', borderBottomRightRadius:'12px'}}>
              <button className="btn btn-light border fw-bold w-50" onClick={() => setMostrarMarcas(false)}>Cerrar</button>
              <button className="btn text-white fw-bold w-50 shadow-sm" style={{backgroundColor: '#6f42c1'}} onClick={guardarDictMarcas} disabled={!provMarcasId}>
                💾 Guardar e Impactar DB
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 5. IMPORTADOR EXCEL / CSV */}
      {mostrarImportador && (
        <div className="position-fixed top-0 start-0 w-100 h-100 bg-dark bg-opacity-75 d-flex justify-content-center align-items-center" style={{ zIndex: 2000 }}>
          <div className="card shadow-lg p-0 border-0 border-top border-success border-5 d-flex flex-column" style={{ width: '95vw', height: '90vh', maxWidth: '1450px', borderRadius: '12px' }}>
            
            <div className="p-3 border-bottom bg-light">
              <div className="d-flex justify-content-between align-items-center mb-3">
                <h5 className="fw-bold text-dark m-0">📥 Importador (Actualiza Costos y Precios)</h5>
                <button className="btn-close" onClick={() => { setMostrarImportador(false); setArchivoCsv(null); setPreviewFilas([]); setDatosCrudosExtraidos([]); }}></button>
              </div>

              <div className="row g-2 mb-2 p-2 border border-primary rounded bg-white shadow-sm">
                <div className="col-3">
                  <label className="small fw-bold text-secondary mb-1">1. Proveedor Origen</label>
                  <select className="form-select form-select-sm fw-bold border-primary" value={provSeleccionadoCsv} onChange={e => setProvSeleccionadoCsv(e.target.value)}>
                    <option value="">-- Seleccione proveedor --</option>
                    {proveedores.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                  </select>
                </div>
                
                <div className="col-2">
                  <label className="small fw-bold text-danger mb-1 d-flex justify-content-between">
                    Desc. Gral. (%)
                    <span className="text-primary text-decoration-underline" style={{cursor:'pointer'}} onClick={()=>setMostrarCascada(true)}>🧮 Cascada</span>
                  </label>
                  <input type="number" className="form-control form-control-sm fw-bold text-center text-danger" value={descuentoProvCsv} onChange={e => setDescuentoProvCsv(parseFloat(e.target.value)||0)} />
                </div>

                <div className="col-2 d-flex flex-column justify-content-end align-items-center pb-1">
                  <div className="form-check form-switch">
                    <input className="form-check-input border-dark" type="checkbox" id="ivaSwitch" checked={listaIncluyeIva} onChange={e => setListaIncluyeIva(e.target.checked)} />
                    <label className="form-check-label small fw-bold text-dark" htmlFor="ivaSwitch">Lista trae IVA</label>
                  </div>
                </div>

                <div className="col-2">
                  <label className="small fw-bold text-success mb-1">Tu Ganancia (%)</label>
                  <input type="number" className="form-control form-control-sm fw-bold text-center border-success text-success" value={margenPorDefectoCsv} onChange={e => setMargenPorDefectoCsv(parseFloat(e.target.value)||0)} />
                </div>

                <div className="col-3">
                  <label className="small fw-bold text-secondary mb-1">Marca Fija Todo el Archivo</label>
                  <input type="text" className="form-control form-control-sm text-uppercase" placeholder="Opcional..." value={marcaPorDefecto} onChange={e => setMarcaPorDefecto(e.target.value)} />
                </div>
              </div>

              <div className="row g-2 align-items-center">
                <div className="col-3">
                  <label className="small fw-bold text-secondary mb-1">Formato Archivo TXT</label>
                  <select className="form-select form-select-sm fw-bold text-primary" value={separadorManual} onChange={e => setSeparadorManual(e.target.value)}>
                    <option value="ESPACIOS">Múltiples Espacios (TXT Viejo)</option>
                    <option value="">Automático</option>
                    <option value="TAB">Tabulación (Txt estándar)</option>
                    <option value=";">Punto y coma (;)</option>
                  </select>
                </div>
                <div className="col-2">
                  <label className="small fw-bold text-warning-emphasis mb-1" title="Ignora las primeras filas de logos o membretes">Filas a Saltear</label>
                  <input type="number" min="0" className="form-control form-control-sm text-center fw-bold border-warning" value={filasASaltear} onChange={e => setFilasASaltear(Math.max(0, parseInt(e.target.value) || 0))} />
                </div>
                <div className="col-3 d-flex flex-column justify-content-end align-items-center pb-1">
                  <div className="form-check form-switch" title="Si lo desactivás, mantiene las descripciones que editaste a mano">
                    <input className="form-check-input border-primary" type="checkbox" id="descSwitch" checked={actualizarDescripciones} onChange={e => setActualizarDescripciones(e.target.checked)} />
                    <label className="form-check-label small fw-bold text-dark" htmlFor="descSwitch">Sobreescribir Descripción</label>
                  </div>
                </div>
                <div className="col-4">
                  <label className="small fw-bold text-secondary mb-1">2. Subir Archivo (.csv, .txt, .xlsx)</label>
                  <input type="file" className="form-control form-control-sm" accept=".csv, .txt, .dbf, .xls, .xlsx" disabled={!provSeleccionadoCsv} onChange={(e) => { setArchivoCsv(e.target.files[0]); }} />
                </div>
              </div>
            </div>

            <div className="p-3 flex-grow-1 overflow-auto bg-white">
              {previewFilas.length > 0 ? (
                <>
                  <div className="d-flex justify-content-between align-items-center mb-2">
                    <div className="d-flex gap-3 align-items-center">
                      <span className="small fw-bold text-danger">3. Asigne columnas:</span>
                      <select className="form-select form-select-sm w-auto fw-bold text-primary shadow-sm" value={molde.regla_limpieza} onChange={e => setMolde({...molde, regla_limpieza: e.target.value})}>
                        <option value="ESTANDAR">Limpiar Costo: ESTANDAR (1200.50)</option>
                        <option value="COMA_DECIMAL">Limpiar Costo: COMA DECIMAL (,)</option>
                        <option value="ARGENTINO">Limpiar Costo: ARGENTINO ($ 1.200,50)</option>
                      </select>
                    </div>
                    <span className="badge bg-warning text-dark font-monospace">
                      Mostrando muestra desde fila {parseInt(filasASaltear) + 1} del archivo
                    </span>
                  </div>
                  <table className="table table-bordered table-sm table-responsive" style={{fontSize: '11px', whiteSpace: 'nowrap'}}>
                    <thead className="table-light sticky-top">
                      <tr>
                        {previewFilas[0].map((_, colIndex) => {
                          const asignadoA = obtenerCampoAsignado(colIndex);
                          return (
                            <th key={colIndex} style={{minWidth: '150px'}} className={asignadoA ? 'bg-warning bg-opacity-25' : ''}>
                              <select className={`form-select form-select-sm fw-bold ${asignadoA ? 'text-primary border-primary' : 'text-muted'}`} value={asignadoA} onChange={e => asignarColumnaAMolde(colIndex, e.target.value)}>
                                <option value="">-- Ignorar --</option>
                                <option value="col_cod">🔑 Cód. Lista</option>
                                <option value="col_desc">📝 Descripción</option>
                                <option value="col_costo">💲 Precio Lista</option>
                                <option value="col_marca">🏷️ Marca Pieza</option>
                                <option value="col_cod_original">⚙️ Cód. Original</option>
                                <option value="col_stock">📦 Stock Prov.</option>
                              </select>
                            </th>
                          );
                        })}
                      </tr>
                    </thead>
                    <tbody className="font-monospace">
                      {previewFilas.map((fila, rowIndex) => (
                        <tr key={rowIndex}>
                          {fila.map((celda, colIndex) => {
                            const esCosto = obtenerCampoAsignado(colIndex) === 'col_costo';
                            return (
                              <td key={colIndex} className="text-truncate" style={{maxWidth: '300px'}} title={celda}>
                                {esCosto ? (
                                  <div>
                                    <span className="text-success fw-bold">{limpiarNumeroFiltro(celda, molde.regla_limpieza)}</span>
                                  </div>
                                ) : celda}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </>
              ) : (
                <div className="h-100 d-flex align-items-center justify-content-center text-muted flex-column">
                  <div>Seleccioná el proveedor arriba y subí un archivo para destriparlo.</div>
                </div>
              )}
            </div>

            <div className="p-3 border-top bg-light d-flex justify-content-end gap-2">
              <button className="btn btn-outline-secondary fw-bold px-4" onClick={() => { setMostrarImportador(false); setArchivoCsv(null); setPreviewFilas([]); setDatosCrudosExtraidos([]); }} disabled={procesandoCsv}>Cancelar</button>
              <button className="btn btn-success fw-bold px-5 shadow" onClick={ejecutarBarridoMasivo} disabled={procesandoCsv || previewFilas.length === 0}>
                {procesandoCsv ? 'Procesando archivo masivo...' : '💾 Guardar y Procesar BD'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}