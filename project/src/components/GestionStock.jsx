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
  
  const [mostrarImportador, setMostrarImportador] = useState(false);
  const [mostrarAumentoGlobal, setMostrarAumentoGlobal] = useState(false);
  const [provAumento, setProvAumento] = useState('');
  const [porcentajeAumento, setPorcentajeAumento] = useState(0);

  // === ESTADOS DEL IMPORTADOR ===
  const [archivoCsv, setArchivoCsv] = useState(null);
  const [provSeleccionadoCsv, setProvSeleccionadoCsv] = useState('');
  const [margenPorDefectoCsv, setMargenPorDefectoCsv] = useState(40);
  const [descuentoProvCsv, setDescuentoProvCsv] = useState(0); 
  const [marcaPorDefecto, setMarcaPorDefecto] = useState(''); 
  const [separadorManual, setSeparadorManual] = useState('ESPACIOS'); 
  const [procesandoCsv, setProcesandoCsv] = useState(false);

  const [previewFilas, setPreviewFilas] = useState([]); 
  const [datosCrudosExtraidos, setDatosCrudosExtraidos] = useState([]); 
  const [omitirPrimeraFila, setOmitirPrimeraFila] = useState(false);
  const [molde, setMolde] = useState({ 
    col_cod: -1, col_desc: -1, col_costo: -1, 
    col_marca: -1, col_cod_original: -1, col_stock: -1, 
    regla_limpieza: 'ESTANDAR' 
  });

  const formatoMoneda = (valor) => "$ " + parseFloat(valor || 0).toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

  // Carga Configuración de Proveedores (El Molde JSON se guarda acá)
  useEffect(() => {
    const cargarProveedores = async () => {
      const { data } = await dbOficial.from('proveedores_distribuidores').select('*').order('nombre');
      if (data) setProveedores(data);
    };
    cargarProveedores();
  }, [mostrarImportador]); 

  // === BÚSQUEDA STOCK LOCAL (Usa tus columnas reales) ===
  useEffect(() => {
    const buscarLocal = async () => {
      let query = dbOficial.from('articulos').select('*').or('stock.gt.0,codigo_aux.not.is.null').order('desc');
      if (busquedaLocal.trim()) {
        const t = `%${busquedaLocal.trim()}%`;
        query = query.or(`cod.ilike.${t},desc.ilike.${t},codigo_aux.ilike.${t},nro_original.ilike.${t},marca.ilike.${t}`);
      }
      const { data, error } = await query.limit(50);
      if (!error && data) setStockLocal(data);
      else if (error) console.error("Error Stock Local:", error);
    };
    const timeoutId = setTimeout(() => buscarLocal(), 300);
    return () => clearTimeout(timeoutId);
  }, [busquedaLocal]);

  // === BÚSQUEDA CATÁLOGO (Usa tus columnas reales) ===
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
        query = query.or(`cod.ilike.${t},desc.ilike.${t},nro_original.ilike.${t},marca.ilike.${t}`);
      }
      const { data, error } = await query.limit(50);
      if (!error && data) setCatalogo(data);
      else if (error) console.error("Error Catálogo:", error);
    };
    const timeoutId = setTimeout(() => buscarCatalogo(), 300);
    return () => clearTimeout(timeoutId);
  }, [busquedaCatalogo, distribuidorFiltro, proveedores]);


  // === INTERNALIZACIÓN ===
  const abrirFormularioInternalizar = (item) => {
    setItemParaInternalizar({ ...item, codigo_aux: item.codigo_aux || '', stock_ingreso: 0 });
  };

  const confirmarInternalizacion = async () => {
    const payload = {
      codigo_aux: itemParaInternalizar.codigo_aux ? itemParaInternalizar.codigo_aux.toUpperCase() : null,
      stock: parseInt(itemParaInternalizar.stock_ingreso) || 0
    };

    const { error } = await dbOficial.from('articulos').update(payload).eq('cod', itemParaInternalizar.cod);
    if (!error) {
      alert("✅ Artículo internalizado en el local con éxito.");
      setStockLocal(prev => [{ ...itemParaInternalizar, ...payload }, ...prev]);
      setItemParaInternalizar(null);
    } else {
      alert("Error al internalizar el artículo.");
    }
  };

  // === EDICIÓN EN LÍNEA ===
  const iniciarEdicionEnLinea = (cod, campo, valorActual) => {
    setCeldaEditando({ cod, campo });
    setValorCeldaTemporal(valorActual ? valorActual.toString() : '');
  };

  const guardarEdicionEnLinea = async (cod, campo) => {
    let valorFinal = valorCeldaTemporal;
    if (['stock', 'precio_costo', 'precio'].includes(campo)) valorFinal = parseFloat(valorCeldaTemporal) || 0;
    if (['codigo_aux', 'marca', 'nro_original'].includes(campo)) valorFinal = valorCeldaTemporal.toUpperCase();

    let payload = { [campo]: valorFinal };
    
    if (campo === 'precio_costo') {
      payload.precio = valorFinal * 1.40; 
    }

    const { error } = await dbOficial.from('articulos').update(payload).eq('cod', cod);
    if (!error) setStockLocal(prev => prev.map(item => item.cod === cod ? { ...item, ...payload } : item));
    else alert("Error al guardar el cambio.");
    
    setCeldaEditando(null);
  };

  const manejarTecladoEdicion = (e, cod, campo) => {
    if (e.key === 'Enter') { e.preventDefault(); guardarEdicionEnLinea(cod, campo); } 
    else if (e.key === 'Escape') setCeldaEditando(null);
  };

  // === ALTA MANUAL ===
  const guardarAltaManualDirecta = async () => {
    if (!altaManualForm.cod || !altaManualForm.desc || !altaManualForm.distribuidor) { 
        return alert("Código, Proveedor y Descripción son obligatorios."); 
    }
    const pCosto = parseFloat(altaManualForm.precio_costo) || 0;
    const mGanancia = parseFloat(altaManualForm.margen_ganancia) || 40;
    const pFinal = pCosto * (1 + (mGanancia / 100));

    const manualArt = {
      distribuidor: altaManualForm.distribuidor, 
      cod: altaManualForm.cod.toUpperCase(),
      desc: altaManualForm.desc.toUpperCase(), 
      marca: altaManualForm.marca ? altaManualForm.marca.toUpperCase() : null,
      codigo_aux: altaManualForm.codigo_aux ? altaManualForm.codigo_aux.toUpperCase() : null,
      nro_original: altaManualForm.nro_original ? altaManualForm.nro_original.toUpperCase() : null,
      precio_costo: pCosto, 
      precio: pFinal,
      stock: parseFloat(altaManualForm.stock) || 0
    };

    const { error } = await dbOficial.from('articulos').insert([manualArt]);
    if (!error) { setAltaManualForm(null); alert("Artículo guardado."); } 
    else alert("Error. Es probable que el código ya exista.");
  };

  // === MOTOR DE LECTURA DE ARCHIVOS (CSV, TXT, DBF, EXCEL) ===
  useEffect(() => {
    if (provSeleccionadoCsv) {
      const prov = proveedores.find(p => p.id.toString() === provSeleccionadoCsv);
      if (prov && prov.config_columnas) setMolde(prov.config_columnas);
      else setMolde({ col_cod: -1, col_desc: -1, col_costo: -1, col_marca: -1, col_cod_original: -1, col_stock: -1, regla_limpieza: 'ESTANDAR' });
    }
  }, [provSeleccionadoCsv, proveedores]);

  useEffect(() => {
    if (archivoCsv) procesarArchivo(archivoCsv, separadorManual);
  }, [archivoCsv, separadorManual]);

  const procesarArchivo = async (file, delimiterChar) => {
    const extension = file.name.split('.').pop().toLowerCase();

    if (extension === 'csv' || extension === 'txt') {
      if (delimiterChar === 'ESPACIOS') {
        const reader = new FileReader();
        reader.onload = (event) => {
          const text = event.target.result;
          const cleanedText = text.replace(/[ \t]{2,}/g, '|');
          Papa.parse(cleanedText, {
            delimiter: '|', header: false, skipEmptyLines: true,
            complete: (results) => {
              if (results.data && results.data.length > 0) {
                setDatosCrudosExtraidos(results.data);
                setPreviewFilas(results.data.slice(0, 5));
              }
            }
          });
        };
        reader.readAsText(file);
      } else {
        Papa.parse(file, {
          delimiter: delimiterChar === 'TAB' ? '\t' : delimiterChar,
          header: false, skipEmptyLines: true,
          complete: (results) => {
            if (results.data && results.data.length > 0) {
              setDatosCrudosExtraidos(results.data);
              setPreviewFilas(results.data.slice(0, 5));
            }
          }
        });
      }
    } else if (extension === 'dbf') {
      try {
        const buffer = await file.arrayBuffer();
        const parser = new DBFParser(buffer);
        const campos = parser.fields.map(f => f.name);
        const records = parser.records.map(r => campos.map(c => r[c])); 
        const dataCompleta = [campos, ...records];
        setDatosCrudosExtraidos(dataCompleta);
        setPreviewFilas(dataCompleta.slice(0, 5));
        setOmitirPrimeraFila(true); 
      } catch (err) { alert("Error leyendo el DBF. Asegúrese de que no esté corrupto."); }
    } else if (extension === 'xlsx' || extension === 'xls') {
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const data = new Uint8Array(event.target.result);
          const workbook = XLSX.read(data, { type: 'array' });
          const firstSheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheetName];
          const json = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: "" });
          if (json && json.length > 0) {
            setDatosCrudosExtraidos(json);
            setPreviewFilas(json.slice(0, 5));
            setOmitirPrimeraFila(true); 
          }
        } catch (error) { alert("Error leyendo Excel."); }
      };
      reader.readAsArrayBuffer(file);
    } else {
      alert("Formato no soportado."); setArchivoCsv(null);
    }
  };

  const asignarColumnaAMolde = (indexColumna, campoMolde) => {
    let nuevoMolde = { ...molde };
    for (let key in nuevoMolde) {
      if (nuevoMolde[key] === indexColumna && key.startsWith('col_')) nuevoMolde[key] = -1;
    }
    nuevoMolde[campoMolde] = indexColumna;
    setMolde(nuevoMolde);
  };

  const obtenerCampoAsignado = (indexColumna) => {
    for (let key in molde) {
      if (molde[key] === indexColumna && key.startsWith('col_')) return key;
    }
    return "";
  };

  const limpiarNumeroFiltro = (valorOriginal, regla) => {
    if (!valorOriginal) return 0;
    let str = valorOriginal.toString().trim();
    if (regla === 'ARGENTINO') {
      str = str.replace(/[^0-9,-]/g, '');
      str = str.replace(/,/g, '.');
      return parseFloat(str) || 0;
    }
    if (regla === 'COMA_DECIMAL') {
      str = str.replace(/,/g, '.');
      return parseFloat(str) || 0;
    }
    return parseFloat(str) || 0;
  };

  const extraerMarcaDeCosto = (valorOriginal) => {
    if (!valorOriginal) return null;
    const str = valorOriginal.toString().trim();
    const match = str.match(/[a-zA-Z]+/g);
    return match ? match.join(' ').toUpperCase().trim() : null;
  };

  const ejecutarBarridoMasivo = async () => {
    if (molde.col_cod === -1 || molde.col_desc === -1 || molde.col_costo === -1) {
      return alert("Falta asignar columnas obligatorias: Código, Descripción y Costo.");
    }
    if (datosCrudosExtraidos.length === 0) return alert("No hay datos cargados para procesar.");
    
    setProcesandoCsv(true);
    
    await dbOficial.from('proveedores_distribuidores').update({ config_columnas: molde }).eq('id', provSeleccionadoCsv);
    const provNombre = proveedores.find(p => p.id.toString() === provSeleccionadoCsv)?.nombre || 'GENERAL';

    let mapUnicos = new Map();
    const inicio = omitirPrimeraFila ? 1 : 0; 

    for (let i = inicio; i < datosCrudosExtraidos.length; i++) {
      const fila = datosCrudosExtraidos[i];
      const rawCosto = fila[molde.col_costo];
      const rawCod = fila[molde.col_cod];
      const rawDesc = fila[molde.col_desc];

      if (!rawCod || !rawDesc) continue;

      const pListaBruto = limpiarNumeroFiltro(rawCosto, molde.regla_limpieza);
      const costoRealConDescuento = pListaBruto * (1 - (descuentoProvCsv / 100));
      const pFinalMostrador = costoRealConDescuento * (1 + (margenPorDefectoCsv / 100));

      let marcaDetectada = null;
      if (molde.col_marca !== -1 && fila[molde.col_marca]) marcaDetectada = fila[molde.col_marca].toString().toUpperCase().trim();
      else marcaDetectada = extraerMarcaDeCosto(rawCosto) || (marcaPorDefecto ? marcaPorDefecto.toUpperCase().trim() : null);

      let articuloInfo = {
        distribuidor: provNombre,
        cod: rawCod.toString().toUpperCase().trim(),
        desc: rawDesc.toString().toUpperCase().trim(),
        precio_costo: costoRealConDescuento,
        precio: pFinalMostrador,
        marca: marcaDetectada
      };

      if (molde.col_cod_original !== -1 && fila[molde.col_cod_original]) articuloInfo.nro_original = fila[molde.col_cod_original].toString().toUpperCase().trim();
      if (molde.col_stock !== -1 && fila[molde.col_stock]) articuloInfo.stock = parseInt(fila[molde.col_stock]) || 0;

      mapUnicos.set(articuloInfo.cod, articuloInfo);
    }

    const upsertsLimpio = Array.from(mapUnicos.values());

    if (upsertsLimpio.length === 0) {
      setProcesandoCsv(false);
      return alert("El archivo está vacío o falló la extracción.");
    }

    const tamanoLote = 1000;
    let erroresEnLote = 0;
    
    for (let i = 0; i < upsertsLimpio.length; i += tamanoLote) {
      const lote = upsertsLimpio.slice(i, i + tamanoLote);
      const { error } = await dbOficial.from('articulos').upsert(lote, { onConflict: 'cod' }); 
      if (error) { console.error("Error en lote:", error); erroresEnLote++; }
    }

    setProcesandoCsv(false);
    if (erroresEnLote > 0) alert("Proceso terminado con algunos errores de base de datos.");
    else alert(`✅ ¡Éxito! ${upsertsLimpio.length} artículos únicos procesados y cargados.`);
    
    setMostrarImportador(false);
    setArchivoCsv(null); setPreviewFilas([]); setDatosCrudosExtraidos([]);
  };

  const aplicarAumentoGlobal = async () => {
    if (!provAumento || porcentajeAumento <= 0) return alert("Seleccione proveedor y porcentaje.");
    if (!window.confirm(`¿Aumentar ${porcentajeAumento}% a TODOS los artículos del proveedor?`)) return;

    const provNombre = proveedores.find(p => p.id.toString() === provAumento)?.nombre;
    const factor = 1 + (porcentajeAumento / 100);
    const { data: arts } = await dbOficial.from('articulos').select('cod, precio_costo, precio').eq('distribuidor', provNombre);
    
    if (arts && arts.length > 0) {
      alert(`Calculando impacto en ${arts.length} artículos... aguarde.`);
      for (const a of arts) {
        const nuevoCosto = a.precio_costo * factor;
        const nuevoFinal = a.precio * factor;
        await dbOficial.from('articulos').update({ precio_costo: nuevoCosto, precio: nuevoFinal }).eq('cod', a.cod);
      }
      alert("✅ Aumento masivo aplicado en base de datos.");
      setMostrarAumentoGlobal(false);
    } else {
      alert("No se encontraron artículos cargados para ese proveedor.");
    }
  };

  return (
    <div className="bg-white min-vh-100 d-flex flex-column p-3">
      <div className="d-flex justify-content-between align-items-center border-bottom pb-2 mb-3">
        <div>
          <h4 className="fw-bold text-dark m-0">📦 Gestión de Stock y Catálogos</h4>
          <p className="text-muted small m-0">Actualizador masivo, equivalencias (Bálsamo), marcas e inventario</p>
        </div>
        <div className="d-flex gap-2">
          <button className="btn btn-sm btn-dark fw-bold" onClick={() => setAltaManualForm({ distribuidor: '', cod: '', desc: '', marca: '', codigo_aux: '', precio_costo: '', margen_ganancia: 40, stock: 0 })}>
            + Alta Manual Fila
          </button>
          <button className="btn btn-sm text-white fw-bold shadow-sm" style={{ backgroundColor: '#fd7e14' }} onClick={() => setMostrarAumentoGlobal(true)}>
            📈 Aumento Masivo (%)
          </button>
          <button className="btn btn-sm btn-success fw-bold shadow-sm" onClick={() => { setMostrarImportador(true); setArchivoCsv(null); setPreviewFilas([]); }}>
            📥 Importar Lista (Excel/CSV/DBF)
          </button>
          <button className="btn btn-sm btn-outline-secondary fw-bold" onClick={volverAlMenu}>Volver al Menú</button>
        </div>
      </div>

      <div className="row flex-grow-1">
        {/* COLUMNA IZQUIERDA: CATÁLOGOS EXTERNOS */}
        <div className="col-5 border-end pe-3 d-flex flex-column">
          <h6 className="fw-bold text-secondary text-uppercase small mb-3">📑 Búsqueda en Listas de Fábrica</h6>
          <div className="row g-2 mb-2">
            <div className="col-7">
                <input type="text" className="form-control form-control-sm font-monospace fw-bold" placeholder="🔍 Cód. Proveedor, Marca u Original..." value={busquedaCatalogo} onChange={e => setBusquedaCatalogo(e.target.value.toUpperCase())} />
            </div>
            <div className="col-5">
              <select className="form-select form-select-sm fw-bold" value={distribuidorFiltro} onChange={e => setDistribuidorFiltro(e.target.value)}>
                <option value="TODAS">TODOS LOS PROV.</option>
                {proveedores.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
              </select>
            </div>
          </div>
          
          <div className="overflow-auto border rounded bg-white shadow-sm flex-grow-1" style={{ maxHeight: '70vh' }}>
            <ul className="list-group list-group-flush">
              {catalogo.length === 0 && <li className="list-group-item text-center text-muted small py-5">Utilice el buscador superior para consultar repuestos.</li>}
              {catalogo.map((item, idx) => (
                <li key={idx} className="list-group-item p-3 border-bottom">
                  <div className="d-flex justify-content-between align-items-start">
                    <div>
                      <div className="d-flex align-items-center gap-2">
                        <strong className="font-monospace text-primary fs-6">{item.cod}</strong>
                        {item.marca && <span className="badge bg-dark" style={{fontSize: '0.65rem'}}>{item.marca}</span>}
                        <span className="badge bg-secondary" style={{fontSize: '0.6rem'}}>{item.distribuidor}</span>
                      </div>
                      <p className="m-0 mt-1 small fw-bold text-dark">{item.desc}</p>
                      <small className="text-muted d-block mt-1" style={{fontSize: '0.75rem'}}>Cód Orig: {item.nro_original || '-'} | Cód Aux: {item.codigo_aux || '-'}</small>
                    </div>
                    <div className="text-end ps-2 border-start">
                      <span className="d-block small text-muted">Costo Final</span>
                      <span className="d-block fw-bold text-danger mb-2 font-monospace">{formatoMoneda(item.precio_costo)}</span>
                      <button className="btn btn-sm btn-outline-success py-0 px-2 fw-bold" onClick={() => abrirFormularioInternalizar(item)}>➕ Internalizar</button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* COLUMNA DERECHA: INVENTARIO LOCAL */}
        <div className="col-7 ps-3 d-flex flex-column">
          <div className="d-flex justify-content-between align-items-center mb-2">
            <h6 className="fw-bold text-dark m-0 text-uppercase small">🏪 Mi Inventario Listo P/ Venta</h6>
            <input type="text" className="form-control form-control-sm w-50 shadow-sm border-primary" placeholder="🔍 Buscar local (Cód Aux, Desc, Marca)..." value={busquedaLocal} onChange={e => setBusquedaLocal(e.target.value.toUpperCase())} />
          </div>
          
          <div className="overflow-auto border rounded bg-white shadow-sm flex-grow-1" style={{ maxHeight: '70vh' }}>
            <table className="table table-sm table-hover mb-0 align-middle" style={{ fontSize: '0.8rem' }}>
              <thead className="table-dark sticky-top">
                <tr>
                  <th className="ps-2">Cód. Prov</th>
                  <th>Descripción</th>
                  <th>Marca</th>
                  <th><span className="text-warning">Cód. Maestro</span></th>
                  <th className="text-end">Costo</th>
                  <th className="text-end text-success">Público Final</th>
                  <th className="text-center" title="Físico">Stock</th>
                </tr>
              </thead>
              <tbody>
                {stockLocal.map((item, idx) => (
                  <tr key={idx}>
                    <td className="font-monospace fw-bold text-primary ps-2">
                      <div className="text-truncate" style={{maxWidth: '80px'}} title={item.cod}>{item.cod}</div>
                      <div className="small text-muted" style={{fontSize: '10px'}}>{item.distribuidor?.substring(0,8)}</div>
                    </td>
                    
                    <td className="fw-semibold text-dark text-truncate" style={{maxWidth: '160px'}} title={item.desc}>{item.desc}</td>

                    <td onDoubleClick={() => iniciarEdicionEnLinea(item.cod, 'marca', item.marca)} style={{ cursor: 'text' }}>
                      {celdaEditando?.cod === item.cod && celdaEditando?.campo === 'marca' ? (
                          <input className="form-control form-control-sm text-uppercase border-primary shadow-sm" autoFocus value={valorCeldaTemporal} onChange={e => setValorCeldaTemporal(e.target.value)} onKeyDown={(e) => manejarTecladoEdicion(e, item.cod, 'marca')} onBlur={() => guardarEdicionEnLinea(item.cod, 'marca')} />
                      ) : <span className="badge bg-light text-dark border">{item.marca || '-'}</span>}
                    </td>

                    <td onDoubleClick={() => iniciarEdicionEnLinea(item.cod, 'codigo_aux', item.codigo_aux)} style={{ cursor: 'text', backgroundColor: '#fffdf0' }}>
                      {celdaEditando?.cod === item.cod && celdaEditando?.campo === 'codigo_aux' ? (
                          <input className="form-control form-control-sm font-monospace text-uppercase border-warning shadow-sm" autoFocus value={valorCeldaTemporal} onChange={e => setValorCeldaTemporal(e.target.value)} onKeyDown={(e) => manejarTecladoEdicion(e, item.cod, 'codigo_aux')} onBlur={() => guardarEdicionEnLinea(item.cod, 'codigo_aux')} />
                      ) : <span className="font-monospace fw-bold text-warning-emphasis">{item.codigo_aux || '+ Vincular'}</span>}
                    </td>

                    <td className="text-end" onDoubleClick={() => iniciarEdicionEnLinea(item.cod, 'precio_costo', item.precio_costo)} style={{ cursor: 'text' }}>
                      {celdaEditando?.cod === item.cod && celdaEditando?.campo === 'precio_costo' ? (
                          <input type="number" className="form-control form-control-sm text-end fw-bold text-danger border-danger shadow-sm" autoFocus value={valorCeldaTemporal} onChange={e => setValorCeldaTemporal(e.target.value)} onKeyDown={(e) => manejarTecladoEdicion(e, item.cod, 'precio_costo')} onBlur={() => guardarEdicionEnLinea(item.cod, 'precio_costo')} />
                      ) : <span className="text-danger fw-bold font-monospace">{formatoMoneda(item.precio_costo)}</span>}
                    </td>

                    <td className="text-end bg-success bg-opacity-10" onDoubleClick={() => iniciarEdicionEnLinea(item.cod, 'precio', item.precio)} style={{ cursor: 'text' }}>
                      {celdaEditando?.cod === item.cod && celdaEditando?.campo === 'precio' ? (
                          <input type="number" className="form-control form-control-sm text-end fw-bold text-success border-success shadow-sm" autoFocus value={valorCeldaTemporal} onChange={e => setValorCeldaTemporal(e.target.value)} onKeyDown={(e) => manejarTecladoEdicion(e, item.cod, 'precio')} onBlur={() => guardarEdicionEnLinea(item.cod, 'precio')} />
                      ) : <span className="text-success fw-bold font-monospace">{formatoMoneda(item.precio)}</span>}
                    </td>

                    <td className="text-center" onDoubleClick={() => iniciarEdicionEnLinea(item.cod, 'stock', item.stock)} style={{ cursor: 'text' }}>
                      {celdaEditando?.cod === item.cod && celdaEditando?.campo === 'stock' ? (
                          <input type="number" className="form-control form-control-sm text-center font-monospace fw-bold border-primary shadow-sm mx-auto" style={{maxWidth:'60px'}} autoFocus value={valorCeldaTemporal} onChange={e => setValorCeldaTemporal(e.target.value)} onKeyDown={(e) => manejarTecladoEdicion(e, item.cod, 'stock')} onBlur={() => guardarEdicionEnLinea(item.cod, 'stock')} />
                      ) : <span className={`badge ${item.stock > 0 ? 'bg-primary' : 'bg-secondary'}`}>{item.stock}</span>}
                    </td>
                  </tr>
                ))}
                {stockLocal.length === 0 && <tr><td colSpan="8" className="text-center py-5 text-muted">Aún no hay artículos cargados.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* MODALES DE ACCION */}
      
      {itemParaInternalizar && (
        <div className="position-fixed top-0 start-0 w-100 h-100 bg-dark bg-opacity-75 d-flex justify-content-center align-items-center" style={{ zIndex: 2000 }}>
          <div className="card shadow-lg p-4 border-0" style={{ width: '550px', borderRadius: '12px' }}>
            <h5 className="fw-bold text-dark border-bottom pb-2 mb-3">🔄 Internalizar Artículo al Mostrador</h5>
            <div className="row g-2 mb-3">
              <div className="col-12"><small className="text-muted d-block mb-1">Catálogo origen: <strong className="text-dark">{itemParaInternalizar.distribuidor}</strong></small></div>
              <div className="col-12"><input type="text" className="form-control bg-light fw-bold" disabled value={itemParaInternalizar.desc} /></div>
              <div className="col-6"><label className="small fw-bold text-muted">Cód. Origen</label><input type="text" className="form-control font-monospace bg-light" disabled value={itemParaInternalizar.cod} /></div>
              <div className="col-6"><label className="small fw-bold text-muted">Costo Real</label><input type="text" className="form-control fw-bold text-danger bg-light" disabled value={formatoMoneda(itemParaInternalizar.precio_costo)} /></div>
            </div>
            <div className="row g-3 mb-4 border-top pt-3">
              <div className="col-6"><label className="small fw-bold text-warning-emphasis">Vincular Cód Maestro (Aux):</label><input type="text" className="form-control font-monospace text-uppercase border-warning" placeholder="Ej: de Bálsamo" value={itemParaInternalizar.codigo_aux} onChange={e => setItemParaInternalizar({...itemParaInternalizar, codigo_aux: e.target.value})} autoFocus /></div>
              <div className="col-6"><label className="small fw-bold text-success">Stock Físico (Opcional):</label><input type="number" className="form-control text-center fw-bold text-success border-success" value={itemParaInternalizar.stock_ingreso} onChange={e => setItemParaInternalizar({...itemParaInternalizar, stock_ingreso: e.target.value})} /></div>
            </div>
            <div className="d-flex gap-2">
              <button className="btn btn-outline-secondary fw-bold w-50" onClick={() => setItemParaInternalizar(null)}>Cancelar</button>
              <button className="btn btn-success fw-bold w-50" onClick={confirmarInternalizacion}>Mover al Local</button>
            </div>
          </div>
        </div>
      )}

      {altaManualForm && (
        <div className="position-fixed top-0 start-0 w-100 h-100 bg-dark bg-opacity-75 d-flex justify-content-center align-items-center" style={{ zIndex: 2000 }}>
          <div className="card shadow-lg p-4 border-0" style={{ width: '600px', borderRadius: '12px' }}>
            <h5 className="fw-bold text-dark border-bottom pb-2 mb-4">➕ Alta Manual Individual</h5>
            <div className="row g-3">
              <div className="col-12">
                <label className="small fw-bold text-secondary">Proveedor Dueño de la Fila</label>
                <select className="form-select fw-bold" value={altaManualForm.distribuidor} onChange={e => setAltaManualForm({...altaManualForm, distribuidor: e.target.value})}>
                  <option value="">Seleccione...</option>
                  {proveedores.map(p => <option key={p.id} value={p.nombre}>{p.nombre}</option>)}
                </select>
              </div>
              <div className="col-6"><label className="small fw-bold text-secondary">Cód de Lista</label><input type="text" className="form-control font-monospace text-primary fw-bold" value={altaManualForm.cod} onChange={e => setAltaManualForm({...altaManualForm, cod: e.target.value.toUpperCase()})} /></div>
              <div className="col-6"><label className="small fw-bold text-secondary">Marca de Pieza</label><input type="text" className="form-control text-uppercase" placeholder="Ej: Dolz, Dayco..." value={altaManualForm.marca} onChange={e => setAltaManualForm({...altaManualForm, marca: e.target.value.toUpperCase()})} /></div>
              <div className="col-6"><label className="small fw-bold text-secondary">Cód Maestro (Bálsamo)</label><input type="text" className="form-control font-monospace text-uppercase" value={altaManualForm.codigo_aux} onChange={e => setAltaManualForm({...altaManualForm, codigo_aux: e.target.value.toUpperCase()})} /></div>
              <div className="col-6"><label className="small fw-bold text-secondary">Cód Original (OEM)</label><input type="text" className="form-control font-monospace text-uppercase" value={altaManualForm.nro_original} onChange={e => setAltaManualForm({...altaManualForm, nro_original: e.target.value.toUpperCase()})} /></div>
              <div className="col-12"><label className="small fw-bold text-secondary">Descripción completa</label><input type="text" className="form-control text-uppercase" value={altaManualForm.desc} onChange={e => setAltaManualForm({...altaManualForm, desc: e.target.value})} /></div>
              <div className="col-4"><label className="small fw-bold text-danger">Costo Lista ($)</label><input type="number" className="form-control fw-bold text-danger" value={altaManualForm.precio_costo} onChange={e => setAltaManualForm({...altaManualForm, precio_costo: e.target.value})} /></div>
              <div className="col-4"><label className="small fw-bold text-primary">Ganancia (%)</label><input type="number" className="form-control fw-bold" value={altaManualForm.margen_ganancia} onChange={e => setAltaManualForm({...altaManualForm, margen_ganancia: e.target.value})} /></div>
              <div className="col-4"><label className="small fw-bold text-success">Stock Físico</label><input type="number" className="form-control text-center fw-bold" value={altaManualForm.stock} onChange={e => setAltaManualForm({...altaManualForm, stock: e.target.value})} /></div>
            </div>
            <div className="d-flex gap-2 mt-4 pt-3 border-top">
              <button className="btn btn-outline-secondary fw-bold w-50" onClick={() => setAltaManualForm(null)}>Cancelar</button>
              <button className="btn btn-dark fw-bold w-50" onClick={guardarAltaManualDirecta}>Crear e Impactar BD</button>
            </div>
          </div>
        </div>
      )}

      {mostrarAumentoGlobal && (
        <div className="position-fixed top-0 start-0 w-100 h-100 bg-dark bg-opacity-75 d-flex justify-content-center align-items-center" style={{ zIndex: 2000 }}>
          <div className="card shadow-lg p-4 border-0 border-top border-warning border-5" style={{ width: '450px', borderRadius: '12px' }}>
            <h5 className="fw-bold text-dark mb-1">📈 Aumento Global por Proveedor</h5>
            <p className="small text-muted mb-4">Aplica un porcentaje matemático al costo y precio final.</p>
            <select className="form-select fw-bold mb-3" value={provAumento} onChange={e => setProvAumento(e.target.value)}>
              <option value="">-- Elija un proveedor --</option>
              {proveedores.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
            </select>
            <label className="small fw-bold text-secondary mb-1">Porcentaje de Aumento (%)</label>
            <input type="number" className="form-control form-control-lg text-center font-monospace fw-bold mb-4" placeholder="Ej: 10" value={porcentajeAumento} onChange={e => setPorcentajeAumento(parseFloat(e.target.value) || 0)} />
            <div className="d-flex gap-2">
              <button className="btn btn-light border fw-bold w-50" onClick={() => setMostrarAumentoGlobal(false)}>Cancelar</button>
              <button className="btn text-white fw-bold w-50" style={{ backgroundColor: '#fd7e14' }} onClick={aplicarAumentoGlobal}>Ejecutar Aumento</button>
            </div>
          </div>
        </div>
      )}

      {mostrarImportador && (
        <div className="position-fixed top-0 start-0 w-100 h-100 bg-dark bg-opacity-75 d-flex justify-content-center align-items-center" style={{ zIndex: 2000 }}>
          <div className="card shadow-lg p-0 border-0 border-top border-success border-5 d-flex flex-column" style={{ width: '95vw', height: '90vh', maxWidth: '1450px', borderRadius: '12px' }}>
            
            <div className="p-3 border-bottom bg-light">
              <div className="d-flex justify-content-between align-items-center mb-2">
                <h5 className="fw-bold text-dark m-0">📥 Importador Inteligente Universal</h5>
                <button className="btn-close" onClick={() => { setMostrarImportador(false); setArchivoCsv(null); setPreviewFilas([]); setDatosCrudosExtraidos([]); }}></button>
              </div>
              <div className="row g-2 align-items-end">
                <div className="col-3">
                  <label className="small fw-bold text-secondary mb-1">1. Proveedor Origen</label>
                  <select className="form-select fw-bold border-primary shadow-sm" value={provSeleccionadoCsv} onChange={e => setProvSeleccionadoCsv(e.target.value)}>
                    <option value="">-- Seleccione proveedor --</option>
                    {proveedores.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                  </select>
                </div>
                <div className="col-2">
                  <label className="small fw-bold text-danger mb-1" title="Se resta al precio de lista para llegar al costo">Desc. Prov. (%)</label>
                  <input type="number" className="form-control fw-bold text-center text-danger shadow-sm" placeholder="Ej: 15" value={descuentoProvCsv} onChange={e => setDescuentoProvCsv(parseFloat(e.target.value)||0)} />
                </div>
                <div className="col-2">
                  <label className="small fw-bold text-secondary mb-1">Margen Base (%)</label>
                  <input type="number" className="form-control fw-bold text-center shadow-sm" placeholder="Ej: 40" value={margenPorDefectoCsv} onChange={e => setMargenPorDefectoCsv(parseFloat(e.target.value)||0)} />
                </div>
                <div className="col-2">
                  <label className="small fw-bold text-secondary mb-1">Marca Fija (Opcional)</label>
                  <input type="text" className="form-control shadow-sm text-uppercase" placeholder="Ej: BALSAMO" value={marcaPorDefecto} onChange={e => setMarcaPorDefecto(e.target.value)} />
                </div>
                <div className="col-3">
                  <label className="small fw-bold text-secondary mb-1">Separador de Archivo</label>
                  <select className="form-select shadow-sm fw-bold text-primary" value={separadorManual} onChange={e => setSeparadorManual(e.target.value)}>
                    <option value="ESPACIOS">Múltiples Espacios (TXT Viejo)</option>
                    <option value="">Automático</option>
                    <option value="TAB">Tabulación (Txt estándar)</option>
                    <option value=";">Punto y coma (;)</option>
                    <option value=",">Coma (,)</option>
                    <option value="|">Barra (|)</option>
                  </select>
                </div>
              </div>
              <div className="mt-2">
                <input type="file" className="form-control shadow-sm" accept=".csv, .txt, .dbf, .xls, .xlsx" disabled={!provSeleccionadoCsv} onChange={(e) => { setArchivoCsv(e.target.files[0]); }} />
              </div>
            </div>

            <div className="p-3 flex-grow-1 overflow-auto bg-white">
              {previewFilas.length > 0 ? (
                <>
                  <div className="d-flex justify-content-between align-items-center mb-2">
                    <div className="d-flex gap-3 align-items-center">
                      <span className="small fw-bold text-danger">3. Asigne las columnas (Cód, Desc y Costo son obligatorios):</span>
                      <select className="form-select form-select-sm w-auto fw-bold text-primary shadow-sm" value={molde.regla_limpieza} onChange={e => setMolde({...molde, regla_limpieza: e.target.value})}>
                        <option value="ESTANDAR">Limpieza Costo: ESTANDAR (1200.50)</option>
                        <option value="COMA_DECIMAL">Limpieza Costo: COMA DECIMAL (,)</option>
                        <option value="ARGENTINO">Limpieza Costo: ARGENTINO ($ 1.200,50)</option>
                      </select>
                    </div>
                    <div className="form-check form-switch">
                      <input className="form-check-input" type="checkbox" id="checkOmitir" checked={omitirPrimeraFila} onChange={e => setOmitirPrimeraFila(e.target.checked)} />
                      <label className="form-check-label small fw-bold text-muted" htmlFor="checkOmitir">Omitir primera fila (Son Títulos)</label>
                    </div>
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
                                <option value="col_cod">🔑 Cód. Proveedor</option>
                                <option value="col_desc">📝 Descripción</option>
                                <option value="col_costo">💲 Precio Lista</option>
                                <option value="col_marca">🏷️ Marca / Aplicación</option>
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
                        <tr key={rowIndex} className={omitirPrimeraFila && rowIndex === 0 ? 'opacity-50 text-decoration-line-through bg-light' : ''}>
                          {fila.map((celda, colIndex) => {
                            const esCosto = obtenerCampoAsignado(colIndex) === 'col_costo';
                            return (
                              <td key={colIndex} className="text-truncate" style={{maxWidth: '300px'}} title={celda}>
                                {esCosto && (!omitirPrimeraFila || rowIndex > 0) ? (
                                  <div>
                                    <span className="text-success fw-bold">{limpiarNumeroFiltro(celda, molde.regla_limpieza)}</span>
                                    {extraerMarcaDeCosto(celda) && <span className="badge bg-dark ms-2" style={{fontSize:'9px'}}>{extraerMarcaDeCosto(celda)}</span>}
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
                  <div>Seleccione un proveedor y suba el archivo para ver la cuadrícula.</div>
                </div>
              )}
            </div>

            <div className="p-3 border-top bg-light d-flex justify-content-end gap-2">
              <button className="btn btn-outline-secondary fw-bold px-4" onClick={() => { setMostrarImportador(false); setArchivoCsv(null); setPreviewFilas([]); setDatosCrudosExtraidos([]); }} disabled={procesandoCsv}>Cancelar</button>
              <button className="btn btn-success fw-bold px-5 shadow" onClick={ejecutarBarridoMasivo} disabled={procesandoCsv || previewFilas.length === 0}>
                {procesandoCsv ? 'Procesando archivo masivo...' : '💾 Guardar Molde y Procesar Datos'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}