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

  useEffect(() => {
    const cargarProveedores = async () => {
      const { data } = await dbOficial.from('proveedores_distribuidores').select('*').order('nombre');
      if (data) setProveedores(data);
    };
    cargarProveedores();
  }, [mostrarImportador]); 

  useEffect(() => {
    const buscarLocal = async () => {
      let query = dbOficial.from('articulos').select(`*, proveedores_distribuidores (nombre)`).gt('precio_final', 0).order('descripcion');
      if (busquedaLocal.trim()) {
        const t = `%${busquedaLocal.trim()}%`;
        query = query.or(`codigo_proveedor.ilike.${t},descripcion.ilike.${t},codigo_auxiliar.ilike.${t},codigo_original.ilike.${t},marca.ilike.${t}`);
      }
      const { data, error } = await query.limit(50);
      if (!error && data) setStockLocal(data);
    };
    const timeoutId = setTimeout(() => buscarLocal(), 300);
    return () => clearTimeout(timeoutId);
  }, [busquedaLocal]);

  useEffect(() => {
    const buscarCatalogo = async () => {
      if (!busquedaCatalogo.trim() && distribuidorFiltro === 'TODAS') { setCatalogo([]); return; }
      let query = dbOficial.from('articulos').select(`*, proveedores_distribuidores (nombre)`);
      if (distribuidorFiltro !== 'TODAS') query = query.eq('proveedor_id', distribuidorFiltro);
      if (busquedaCatalogo.trim()) {
        const t = `%${busquedaCatalogo.trim()}%`;
        query = query.or(`codigo_proveedor.ilike.${t},descripcion.ilike.${t},codigo_original.ilike.${t},marca.ilike.${t}`);
      }
      const { data, error } = await query.limit(50);
      if (!error && data) setCatalogo(data);
    };
    const timeoutId = setTimeout(() => buscarCatalogo(), 300);
    return () => clearTimeout(timeoutId);
  }, [busquedaCatalogo, distribuidorFiltro]);

  const iniciarEdicionEnLinea = (id, campo, valorActual) => {
    setCeldaEditando({ id, campo });
    setValorCeldaTemporal(valorActual ? valorActual.toString() : '');
  };

  const guardarEdicionEnLinea = async (id, campo) => {
    let valorFinal = valorCeldaTemporal;
    if (campo === 'stock_local') valorFinal = parseFloat(valorCeldaTemporal) || 0;
    if (campo === 'precio_lista' || campo === 'margen_ganancia') valorFinal = parseFloat(valorCeldaTemporal) || 0;
    if (['codigo_auxiliar', 'marca', 'codigo_original'].includes(campo)) valorFinal = valorCeldaTemporal.toUpperCase();

    const itemActual = stockLocal.find(x => x.id === id);
    let payload = { [campo]: valorFinal };
    
    if (campo === 'precio_lista') {
      const costoReal = valorFinal * (1 - ((itemActual.descuento_proveedor || 0) / 100));
      payload.precio_final = costoReal * (1 + (itemActual.margen_ganancia / 100));
    }
    else if (campo === 'margen_ganancia') {
      const costoReal = itemActual.precio_lista * (1 - ((itemActual.descuento_proveedor || 0) / 100));
      payload.precio_final = costoReal * (1 + (valorFinal / 100));
    }

    const { error } = await dbOficial.from('articulos').update(payload).eq('id', id);
    if (!error) setStockLocal(prev => prev.map(item => item.id === id ? { ...item, ...payload } : item));
    else alert("Error al guardar el cambio.");
    
    setCeldaEditando(null);
  };

  const manejarTecladoEdicion = (e, id, campo) => {
    if (e.key === 'Enter') { e.preventDefault(); guardarEdicionEnLinea(id, campo); } 
    else if (e.key === 'Escape') setCeldaEditando(null);
  };

  const guardarAltaManualDirecta = async () => {
    if (!altaManualForm.codigo_proveedor || !altaManualForm.descripcion || !altaManualForm.proveedor_id) { 
        return alert("Código, Proveedor y Descripción son obligatorios."); 
    }
    const pLista = parseFloat(altaManualForm.precio_lista) || 0;
    const mGanancia = parseFloat(altaManualForm.margen_ganancia) || 40;
    const pFinal = pLista * (1 + (mGanancia / 100));

    const manualArt = {
      proveedor_id: altaManualForm.proveedor_id, codigo_proveedor: altaManualForm.codigo_proveedor.toUpperCase(),
      descripcion: altaManualForm.descripcion.toUpperCase(), marca: altaManualForm.marca ? altaManualForm.marca.toUpperCase() : null,
      codigo_auxiliar: altaManualForm.codigo_auxiliar ? altaManualForm.codigo_auxiliar.toUpperCase() : null,
      precio_lista: pLista, margen_ganancia: mGanancia, precio_final: pFinal,
      stock_local: parseFloat(altaManualForm.stock_local) || 0, fraccionamiento: false, descuento_proveedor: 0
    };

    const { error } = await dbOficial.from('articulos').insert([manualArt]);
    if (!error) { setAltaManualForm(null); alert("Artículo guardado."); } 
    else alert("Error. Es probable que este código ya exista para este proveedor.");
  };

  // === MOTOR DE LECTURA DE ARCHIVOS ===
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
      } catch (err) {
        alert("Error leyendo el DBF. Asegúrese de que no esté corrupto.");
      }
    } else if (extension === 'xlsx' || extension === 'xls') {
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const data = new Uint8Array(event.target.result);
          const workbook = XLSX.read(data, { type: 'array' });
          const firstSheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheetName];
          // extrae crudo matriz [[]]
          const json = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: "" });
          if (json && json.length > 0) {
            setDatosCrudosExtraidos(json);
            setPreviewFilas(json.slice(0, 5));
            setOmitirPrimeraFila(true); // Los excel casi siempre traen titulo
          }
        } catch (error) {
          alert("Error leyendo el archivo Excel.");
          console.error(error);
        }
      };
      reader.readAsArrayBuffer(file);
    } else {
      alert("Formato no soportado. Solo CSV, TXT, DBF, XLS o XLSX.");
      setArchivoCsv(null);
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

    let upserts = [];
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
        proveedor_id: provSeleccionadoCsv,
        codigo_proveedor: rawCod.toString().toUpperCase().trim(),
        descripcion: rawDesc.toString().toUpperCase().trim(),
        precio_lista: pListaBruto,
        descuento_proveedor: descuentoProvCsv,
        margen_ganancia: margenPorDefectoCsv,
        precio_final: pFinalMostrador,
        marca: marcaDetectada
      };

      if (molde.col_cod_original !== -1 && fila[molde.col_cod_original]) articuloInfo.codigo_original = fila[molde.col_cod_original].toString().toUpperCase().trim();
      if (molde.col_stock !== -1 && fila[molde.col_stock]) articuloInfo.stock_proveedor = fila[molde.col_stock].toString().trim();

      upserts.push(articuloInfo);
    }

    if (upserts.length === 0) {
      setProcesandoCsv(false);
      return alert("El archivo está vacío o el mapeo falló.");
    }

    const tamanoLote = 1000;
    let erroresEnLote = 0;
    
    for (let i = 0; i < upserts.length; i += tamanoLote) {
      const lote = upserts.slice(i, i + tamanoLote);
      const { error } = await dbOficial.from('articulos').upsert(lote, { onConflict: 'proveedor_id, codigo_proveedor' });
      if (error) { console.error("Error en lote:", error); erroresEnLote++; }
    }

    setProcesandoCsv(false);
    if (erroresEnLote > 0) alert("Proceso terminado con algunos errores. Revisar consola.");
    else alert(`✅ Molde guardado. ${upserts.length} artículos actualizados con precio, costo y marca.`);
    
    setMostrarImportador(false);
    setArchivoCsv(null); setPreviewFilas([]); setDatosCrudosExtraidos([]);
  };

  const aplicarAumentoGlobal = async () => {
    if (!provAumento || porcentajeAumento <= 0) return alert("Seleccione proveedor y porcentaje.");
    if (!window.confirm(`¿Aumentar ${porcentajeAumento}% a TODOS los artículos del proveedor?`)) return;

    const factor = 1 + (porcentajeAumento / 100);
    const { data: arts } = await dbOficial.from('articulos').select('id, precio_lista, descuento_proveedor, margen_ganancia').eq('proveedor_id', provAumento);
    
    if (arts) {
      alert("Procesando en lote... demorará unos segundos.");
      for (const a of arts) {
        const nuevoPrecioL = a.precio_lista * factor;
        const costoReal = nuevoPrecioL * (1 - ((a.descuento_proveedor || 0) / 100));
        const nuevoFinal = costoReal * (1 + (a.margen_ganancia / 100));
        await dbOficial.from('articulos').update({ precio_lista: nuevoPrecioL, precio_final: nuevoFinal }).eq('id', a.id);
      }
      alert("✅ Aumento masivo aplicado.");
      setMostrarAumentoGlobal(false);
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
          <button className="btn btn-sm btn-dark fw-bold" onClick={() => setAltaManualForm({ proveedor_id: '', codigo_proveedor: '', desc: '', marca: '', codigo_auxiliar: '', precio_lista: '', margen_ganancia: 40, stock_local: 0 })}>
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
                        <strong className="font-monospace text-primary fs-6">{item.codigo_proveedor}</strong>
                        {item.marca && <span className="badge bg-dark" style={{fontSize: '0.65rem'}}>{item.marca}</span>}
                        <span className="badge bg-secondary" style={{fontSize: '0.6rem'}}>{item.proveedores_distribuidores?.nombre}</span>
                      </div>
                      <p className="m-0 mt-1 small fw-bold text-dark">{item.descripcion}</p>
                      <small className="text-muted d-block mt-1" style={{fontSize: '0.75rem'}}>Cód Orig: {item.codigo_original || '-'} | Cód Aux: {item.codigo_auxiliar || '-'}</small>
                    </div>
                    <div className="text-end ps-2 border-start">
                      <span className="d-block small text-muted">Costo L.</span>
                      <span className="d-block fw-bold text-danger mb-1 font-monospace">{formatoMoneda(item.precio_lista)}</span>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* COLUMNA DERECHA: INVENTARIO VALORIZADO */}
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
                  <th className="text-end">Lista</th>
                  <th className="text-center">MRG%</th>
                  <th className="text-end text-success">Público Final</th>
                  <th className="text-center" title="Físico">Stock</th>
                </tr>
              </thead>
              <tbody>
                {stockLocal.map((item, idx) => (
                  <tr key={idx}>
                    <td className="font-monospace fw-bold text-primary ps-2">
                      <div className="text-truncate" style={{maxWidth: '80px'}} title={item.codigo_proveedor}>{item.codigo_proveedor}</div>
                      <div className="small text-muted" style={{fontSize: '10px'}}>{item.proveedores_distribuidores?.nombre?.substring(0,8)}</div>
                    </td>
                    
                    <td className="fw-semibold text-dark text-truncate" style={{maxWidth: '160px'}} title={item.descripcion}>{item.descripcion}</td>

                    <td onDoubleClick={() => iniciarEdicionEnLinea(item.id, 'marca', item.marca)} style={{ cursor: 'text' }}>
                      {celdaEditando?.id === item.id && celdaEditando?.campo === 'marca' ? (
                          <input className="form-control form-control-sm text-uppercase border-primary shadow-sm" autoFocus value={valorCeldaTemporal} onChange={e => setValorCeldaTemporal(e.target.value)} onKeyDown={(e) => manejarTecladoEdicion(e, item.id, 'marca')} onBlur={() => guardarEdicionEnLinea(item.id, 'marca')} />
                      ) : <span className="badge bg-light text-dark border">{item.marca || '-'}</span>}
                    </td>

                    <td onDoubleClick={() => iniciarEdicionEnLinea(item.id, 'codigo_auxiliar', item.codigo_auxiliar)} style={{ cursor: 'text', backgroundColor: '#fffdf0' }}>
                      {celdaEditando?.id === item.id && celdaEditando?.campo === 'codigo_auxiliar' ? (
                          <input className="form-control form-control-sm font-monospace text-uppercase border-warning shadow-sm" autoFocus value={valorCeldaTemporal} onChange={e => setValorCeldaTemporal(e.target.value)} onKeyDown={(e) => manejarTecladoEdicion(e, item.id, 'codigo_auxiliar')} onBlur={() => guardarEdicionEnLinea(item.id, 'codigo_auxiliar')} />
                      ) : <span className="font-monospace fw-bold text-warning-emphasis">{item.codigo_auxiliar || '+ Vincular'}</span>}
                    </td>

                    <td className="text-end" onDoubleClick={() => iniciarEdicionEnLinea(item.id, 'precio_lista', item.precio_lista)} style={{ cursor: 'text' }}>
                      {celdaEditando?.id === item.id && celdaEditando?.campo === 'precio_lista' ? (
                          <input type="number" className="form-control form-control-sm text-end fw-bold text-danger border-danger shadow-sm" autoFocus value={valorCeldaTemporal} onChange={e => setValorCeldaTemporal(e.target.value)} onKeyDown={(e) => manejarTecladoEdicion(e, item.id, 'precio_lista')} onBlur={() => guardarEdicionEnLinea(item.id, 'precio_lista')} />
                      ) : <span className="text-danger fw-bold font-monospace">{formatoMoneda(item.precio_lista)}</span>}
                    </td>

                    <td className="text-center" onDoubleClick={() => iniciarEdicionEnLinea(item.id, 'margen_ganancia', item.margen_ganancia)} style={{ cursor: 'text' }}>
                      {celdaEditando?.id === item.id && celdaEditando?.campo === 'margen_ganancia' ? (
                          <input type="number" className="form-control form-control-sm text-center fw-bold border-primary shadow-sm" autoFocus value={valorCeldaTemporal} onChange={e => setValorCeldaTemporal(e.target.value)} onKeyDown={(e) => manejarTecladoEdicion(e, item.id, 'margen_ganancia')} onBlur={() => guardarEdicionEnLinea(item.id, 'margen_ganancia')} />
                      ) : <span className="text-muted">{item.margen_ganancia}%</span>}
                    </td>

                    <td className="text-end bg-success bg-opacity-10 fw-bold font-monospace text-success">{formatoMoneda(item.precio_final)}</td>

                    <td className="text-center" onDoubleClick={() => iniciarEdicionEnLinea(item.id, 'stock_local', item.stock_local)} style={{ cursor: 'text' }}>
                      {celdaEditando?.id === item.id && celdaEditando?.campo === 'stock_local' ? (
                          <input type="number" className="form-control form-control-sm text-center font-monospace fw-bold border-primary shadow-sm mx-auto" style={{maxWidth:'60px'}} autoFocus value={valorCeldaTemporal} onChange={e => setValorCeldaTemporal(e.target.value)} onKeyDown={(e) => manejarTecladoEdicion(e, item.id, 'stock_local')} onBlur={() => guardarEdicionEnLinea(item.id, 'stock_local')} />
                      ) : <span className={`badge ${item.stock_local > 0 ? 'bg-primary' : 'bg-secondary'}`}>{item.stock_local}</span>}
                    </td>
                  </tr>
                ))}
                {stockLocal.length === 0 && <tr><td colSpan="8" className="text-center py-5 text-muted">Aún no hay artículos cargados.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* MODAL ALTA MANUAL */}
      {altaManualForm && (
        <div className="position-fixed top-0 start-0 w-100 h-100 bg-dark bg-opacity-75 d-flex justify-content-center align-items-center" style={{ zIndex: 2000 }}>
          <div className="card shadow-lg p-4 border-0" style={{ width: '600px', borderRadius: '12px' }}>
            <h5 className="fw-bold text-dark border-bottom pb-2 mb-4">➕ Alta Manual Individual</h5>
            <div className="row g-3">
              <div className="col-12">
                <label className="small fw-bold text-secondary">Proveedor Dueño de la Fila</label>
                <select className="form-select fw-bold" value={altaManualForm.proveedor_id} onChange={e => setAltaManualForm({...altaManualForm, proveedor_id: e.target.value})}>
                  <option value="">Seleccione...</option>
                  {proveedores.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                </select>
              </div>
              <div className="col-6"><label className="small fw-bold text-secondary">Cód de Lista</label><input type="text" className="form-control font-monospace text-primary fw-bold" value={altaManualForm.codigo_proveedor} onChange={e => setAltaManualForm({...altaManualForm, codigo_proveedor: e.target.value.toUpperCase()})} /></div>
              <div className="col-6"><label className="small fw-bold text-secondary">Marca de Pieza</label><input type="text" className="form-control text-uppercase" placeholder="Ej: Dolz, Dayco..." value={altaManualForm.marca} onChange={e => setAltaManualForm({...altaManualForm, marca: e.target.value.toUpperCase()})} /></div>
              <div className="col-6"><label className="small fw-bold text-secondary">Cód Maestro (Bálsamo)</label><input type="text" className="form-control font-monospace text-uppercase" value={altaManualForm.codigo_auxiliar} onChange={e => setAltaManualForm({...altaManualForm, codigo_auxiliar: e.target.value.toUpperCase()})} /></div>
              <div className="col-6"><label className="small fw-bold text-secondary">Cód Original (OEM)</label><input type="text" className="form-control font-monospace text-uppercase" value={altaManualForm.codigo_original} onChange={e => setAltaManualForm({...altaManualForm, codigo_original: e.target.value.toUpperCase()})} /></div>
              <div className="col-12"><label className="small fw-bold text-secondary">Descripción completa</label><input type="text" className="form-control text-uppercase" value={altaManualForm.descripcion} onChange={e => setAltaManualForm({...altaManualForm, descripcion: e.target.value})} /></div>
              <div className="col-4"><label className="small fw-bold text-danger">Costo Lista ($)</label><input type="number" className="form-control fw-bold text-danger" value={altaManualForm.precio_lista} onChange={e => setAltaManualForm({...altaManualForm, precio_lista: e.target.value})} /></div>
              <div className="col-4"><label className="small fw-bold text-primary">Ganancia (%)</label><input type="number" className="form-control fw-bold" value={altaManualForm.margen_ganancia} onChange={e => setAltaManualForm({...altaManualForm, margen_ganancia: e.target.value})} /></div>
              <div className="col-4"><label className="small fw-bold text-success">Stock Físico</label><input type="number" className="form-control text-center fw-bold" value={altaManualForm.stock_local} onChange={e => setAltaManualForm({...altaManualForm, stock_local: e.target.value})} /></div>
            </div>
            <div className="d-flex gap-2 mt-4 pt-3 border-top">
              <button className="btn btn-outline-secondary fw-bold w-50" onClick={() => setAltaManualForm(null)}>Cancelar</button>
              <button className="btn btn-dark fw-bold w-50" onClick={guardarAltaManualDirecta}>Crear e Impactar BD</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL AUMENTO MASIVO POR PORCENTAJE */}
      {mostrarAumentoGlobal && (
        <div className="position-fixed top-0 start-0 w-100 h-100 bg-dark bg-opacity-75 d-flex justify-content-center align-items-center" style={{ zIndex: 2000 }}>
          <div className="card shadow-lg p-4 border-0 border-top border-warning border-5" style={{ width: '450px', borderRadius: '12px' }}>
            <h5 className="fw-bold text-dark mb-1">📈 Aumento Global por Proveedor</h5>
            <p className="small text-muted mb-4">Aplica un porcentaje matemático al costo de la lista, recalculando el precio final al mostrador.</p>
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

      {/* MODAL IMPORTADOR TIPO "MINI-EXCEL" */}
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

            {/* GRILLA PREVIEW */}
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