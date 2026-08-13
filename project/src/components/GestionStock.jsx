import React, { useState, useEffect } from 'react';
import { dbOficial } from '../supabaseClient'; 

export default function GestionStock({ volverAlMenu }) {
  // === ESTADOS DE BÚSQUEDA ===
  const [busquedaLocal, setBusquedaLocal] = useState('');
  const [busquedaCatalogo, setBusquedaCatalogo] = useState('');
  const [distribuidorFiltro, setDistribuidorFiltro] = useState('TODAS');

  // === ESTADOS DE DATOS ===
  const [stockLocal, setStockLocal] = useState([]);
  const [catalogo, setCatalogo] = useState([]);

  // === ESTADOS DE INTERFAZ ===
  const [celdaEditando, setCeldaEditando] = useState(null);
  const [valorCeldaTemporal, setValorCeldaTemporal] = useState('');
  const [itemParaInternalizar, setItemParaInternalizar] = useState(null);
  const [altaManualForm, setAltaManualForm] = useState(null);
  const [mostrarBulkArea, setMostrarBulkArea] = useState(false);
  
  const distribuidoresLista = ['TODAS', 'Bálsamo', 'VMG', 'SKF', 'Arteb'];
  const formatoMoneda = (valor) => "$ " + parseFloat(valor || 0).toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

  // === EFECTO: BÚSQUEDA STOCK LOCAL (Optimizado al servidor) ===
  useEffect(() => {
    const buscarLocal = async () => {
      let query = dbOficial.from('articulos').select('*').or('stock.gt.0,stock_min.gt.0,codigo_aux.not.is.null');
      
      if (busquedaLocal.trim()) {
        const termino = `%${busquedaLocal.trim()}%`;
        query = query.or(`cod.ilike.${termino},desc.ilike.${termino},codigo_aux.ilike.${termino},nro_original.ilike.${termino}`);
      }
      
      const { data, error } = await query.limit(50); // Límite estricto para no colapsar la RAM
      if (!error && data) setStockLocal(data);
    };

    const timeoutId = setTimeout(() => buscarLocal(), 300);
    return () => clearTimeout(timeoutId);
  }, [busquedaLocal]);

  // === EFECTO: BÚSQUEDA CATÁLOGO EXTERNO ===
  useEffect(() => {
    const buscarCatalogo = async () => {
      if (!busquedaCatalogo.trim() && distribuidorFiltro === 'TODAS') {
        setCatalogo([]); // No cargar cientos de miles de registros por defecto
        return;
      }

      let query = dbOficial.from('articulos').select('*');
      
      if (distribuidorFiltro !== 'TODAS') {
        query = query.eq('distribuidor', distribuidorFiltro);
      }
      
      if (busquedaCatalogo.trim()) {
        const termino = `%${busquedaCatalogo.trim()}%`;
        query = query.or(`cod.ilike.${termino},desc.ilike.${termino},nro_original.ilike.${termino}`);
      }
      
      const { data, error } = await query.limit(50);
      if (!error && data) setCatalogo(data);
    };

    const timeoutId = setTimeout(() => buscarCatalogo(), 300);
    return () => clearTimeout(timeoutId);
  }, [busquedaCatalogo, distribuidorFiltro]);

  // === EDICIÓN EN LÍNEA A LA BASE DE DATOS ===
  const iniciarEdicionEnLinea = (cod, campo, valorActual) => {
    setCeldaEditando({ cod, campo });
    setValorCeldaTemporal(valorActual ? valorActual.toString() : '');
  };

  const guardarEdicionEnLinea = async (cod, campo) => {
    let valorFinal = valorCeldaTemporal;
    if (['stock', 'stock_min', 'stock_max'].includes(campo)) valorFinal = parseInt(valorCeldaTemporal) || 0;
    if (campo === 'precio_costo' || campo === 'precio') valorFinal = parseFloat(valorCeldaTemporal) || 0;
    if (campo === 'codigo_aux') valorFinal = valorCeldaTemporal.toUpperCase();

    // Impacto directo en Supabase
    const { error } = await dbOficial.from('articulos').update({ [campo]: valorFinal }).eq('cod', cod);
    
    if (!error) {
      setStockLocal(prev => prev.map(item => item.cod === cod ? { ...item, [campo]: valorFinal } : item));
    } else {
      alert("Error al guardar el cambio. Verifique su conexión.");
      console.error(error);
    }
    setCeldaEditando(null);
  };

  const manejarTecladoEdicion = (e, cod, campo) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      guardarEdicionEnLinea(cod, campo);
    } else if (e.key === 'Escape') {
      setCeldaEditando(null);
    }
  };

  // === INTERNALIZACIÓN Y ALTAS ===
  const abrirFormularioInternalizar = (item) => {
    setItemParaInternalizar({
        ...item, 
        codigo_aux: item.codigo_aux || '', 
        ubicacion: item.ubicacion || '', 
        stock_min: 2, 
        stock_max: 10, 
        stock_ingreso: 0 
    });
  };

  const confirmarInternalizacion = async () => {
    const payload = {
      codigo_aux: itemParaInternalizar.codigo_aux.toUpperCase(),
      stock: parseInt(itemParaInternalizar.stock_ingreso) || 0,
      stock_min: parseInt(itemParaInternalizar.stock_min) || 0,
      stock_max: parseInt(itemParaInternalizar.stock_max) || 0,
      ubicacion: itemParaInternalizar.ubicacion
    };

    const { error } = await dbOficial.from('articulos').update(payload).eq('cod', itemParaInternalizar.cod);
    
    if (!error) {
      alert("Artículo internalizado con éxito.");
      setStockLocal(prev => [{ ...itemParaInternalizar, ...payload }, ...prev]);
      setItemParaInternalizar(null);
    } else {
      alert("Error crítico. No se pudo internalizar el artículo.");
      console.error(error);
    }
  };

  const guardarAltaManualDirecta = async () => {
    if (!altaManualForm.cod || !altaManualForm.desc) { 
        alert("Código y Descripción son obligatorios."); 
        return; 
    }
    
    const manualArt = {
      ...altaManualForm,
      precio_costo: parseFloat(altaManualForm.precio_costo) || 0,
      precio: parseFloat(altaManualForm.precio) || 0,
      stock: parseInt(altaManualForm.stock) || 0,
      stock_min: parseInt(altaManualForm.stock_min) || 0,
      stock_max: parseInt(altaManualForm.stock_max) || 0,
      codigo_aux: altaManualForm.codigo_aux ? altaManualForm.codigo_aux.toUpperCase() : null,
      nro_original: altaManualForm.nro_original ? altaManualForm.nro_original.toUpperCase() : null,
      distribuidor: 'LOCAL'
    };

    const { error } = await dbOficial.from('articulos').insert([manualArt]);
    
    if (!error) {
      setStockLocal(prev => [manualArt, ...prev]);
      setAltaManualForm(null);
      alert("Artículo manual guardado.");
    } else {
      alert("Error al crear el artículo. Verifique que el código no exista ya en la base.");
      console.error(error);
    }
  };

  return (
    <div className="bg-white min-vh-100 d-flex flex-column p-3">
      <div className="d-flex justify-content-between align-items-center border-bottom pb-2 mb-3">
        <div>
          <h4 className="fw-bold text-dark m-0">📦 Gestión de Stock e Inventario</h4>
          <p className="text-muted small m-0">Administración de productos locales y catálogos externos</p>
        </div>
        <div className="d-flex gap-2">
          <button className="btn btn-sm btn-dark fw-bold" onClick={() => setAltaManualForm({ cod: '', nro_original: '', desc: '', marca: '', codigo_aux: '', precio_costo: '', precio: '', ubicacion: '', stock: '', stock_min: '', stock_max: '' })}>
            + Agregar Artículo Manual
          </button>
          <button className="btn btn-sm btn-success fw-bold" onClick={() => setMostrarBulkArea(true)}>
            📥 Carga Masiva (CSV)
          </button>
          <button className="btn btn-sm btn-outline-secondary fw-bold" onClick={volverAlMenu}>Volver al Menú</button>
        </div>
      </div>

      <div className="row flex-grow-1">
        {/* COLUMNA IZQUIERDA: CATÁLOGOS */}
        <div className="col-4 border-end pe-3">
          <h6 className="fw-bold text-secondary text-uppercase small mb-3">📑 Catálogos de Distribuidoras</h6>
          <div className="row g-1 mb-2">
            <div className="col-7">
                <input type="text" className="form-control form-control-sm" placeholder="Buscar en fábrica..." value={busquedaCatalogo} onChange={e => setBusquedaCatalogo(e.target.value)} />
            </div>
            <div className="col-5">
              <select className="form-select form-select-sm fw-bold" value={distribuidorFiltro} onChange={e => setDistribuidorFiltro(e.target.value)}>
                {distribuidoresLista.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
          </div>
          
          <div className="overflow-auto border rounded bg-white shadow-sm" style={{ maxHeight: '70vh' }}>
            <ul className="list-group list-group-flush">
              {catalogo.length === 0 && <li className="list-group-item text-center text-muted small py-4">Utilice el buscador para consultar las listas de fábrica.</li>}
              {catalogo.map((item, idx) => (
                <li key={idx} className="list-group-item p-2 border-bottom">
                  <div className="d-flex justify-content-between align-items-start">
                    <div>
                      <strong className="font-monospace text-primary">{item.cod}</strong>
                      <p className="m-0 small fw-bold text-dark">{item.desc}</p>
                      <small className="text-muted d-block" style={{fontSize: '0.75rem'}}>Orig: {item.nro_original || '-'} | Marca: {item.marca || '-'}</small>
                      <span className="badge bg-light text-dark border mt-1">{item.distribuidor}</span>
                    </div>
                    <div className="text-end">
                      <span className="d-block fw-bold text-success mb-1">{formatoMoneda(item.precio)}</span>
                      <button className="btn btn-sm btn-outline-success py-0 px-2 fw-bold" onClick={() => abrirFormularioInternalizar(item)}>➕ Internalizar</button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* COLUMNA DERECHA: STOCK LOCAL */}
        <div className="col-8 ps-3">
          <div className="d-flex justify-content-between align-items-center mb-2">
            <h6 className="fw-bold text-dark m-0 text-uppercase small">🏪 Stock en Local <span className="text-muted text-lowercase">(Doble clic para editar en línea)</span></h6>
            <input type="text" className="form-control form-control-sm w-50 shadow-sm" placeholder="🔍 Filtrar local (Código, Descripción, Auxiliar)..." value={busquedaLocal} onChange={e => setBusquedaLocal(e.target.value)} />
          </div>
          
          <div className="overflow-auto border rounded bg-white shadow-sm" style={{ maxHeight: '70vh' }}>
            <table className="table table-sm table-hover mb-0 align-middle" style={{ fontSize: '0.8rem' }}>
              <thead className="table-dark sticky-top">
                <tr>
                  <th className="ps-2">Código</th>
                  <th>Descripción</th>
                  <th>Cód Auxiliar</th>
                  <th className="text-end">Costo</th>
                  <th className="text-end">Público</th>
                  <th className="text-center">Stock</th>
                  <th className="text-center" title="Stock Mínimo">Mín</th>
                </tr>
              </thead>
              <tbody>
                {stockLocal.map((item, idx) => (
                  <tr key={idx}>
                    <td className="font-monospace fw-bold text-primary ps-2">{item.cod}</td>
                    
                    <td onDoubleClick={() => iniciarEdicionEnLinea(item.cod, 'desc', item.desc)} style={{ cursor: 'text' }}>
                      {celdaEditando?.cod === item.cod && celdaEditando?.campo === 'desc' ? (
                          <input className="form-control form-control-sm fw-bold border-primary shadow-sm" autoFocus value={valorCeldaTemporal} onChange={e => setValorCeldaTemporal(e.target.value)} onKeyDown={(e) => manejarTecladoEdicion(e, item.cod, 'desc')} onBlur={() => guardarEdicionEnLinea(item.cod, 'desc')} />
                      ) : <span className="fw-semibold text-dark">{item.desc}</span>}
                    </td>

                    <td onDoubleClick={() => iniciarEdicionEnLinea(item.cod, 'codigo_aux', item.codigo_aux)} style={{ cursor: 'text' }}>
                      {celdaEditando?.cod === item.cod && celdaEditando?.campo === 'codigo_aux' ? (
                          <input className="form-control form-control-sm font-monospace text-uppercase border-primary shadow-sm" autoFocus value={valorCeldaTemporal} onChange={e => setValorCeldaTemporal(e.target.value)} onKeyDown={(e) => manejarTecladoEdicion(e, item.cod, 'codigo_aux')} onBlur={() => guardarEdicionEnLinea(item.cod, 'codigo_aux')} />
                      ) : <span className="font-monospace text-secondary">{item.codigo_aux || '-'}</span>}
                    </td>

                    <td className="text-end" onDoubleClick={() => iniciarEdicionEnLinea(item.cod, 'precio_costo', item.precio_costo)} style={{ cursor: 'text' }}>
                      {celdaEditando?.cod === item.cod && celdaEditando?.campo === 'precio_costo' ? (
                          <input type="number" className="form-control form-control-sm text-end fw-bold text-danger border-primary shadow-sm" autoFocus value={valorCeldaTemporal} onChange={e => setValorCeldaTemporal(e.target.value)} onKeyDown={(e) => manejarTecladoEdicion(e, item.cod, 'precio_costo')} onBlur={() => guardarEdicionEnLinea(item.cod, 'precio_costo')} />
                      ) : <span className="text-danger fw-bold">{formatoMoneda(item.precio_costo)}</span>}
                    </td>

                    <td className="text-end" onDoubleClick={() => iniciarEdicionEnLinea(item.cod, 'precio', item.precio)} style={{ cursor: 'text' }}>
                      {celdaEditando?.cod === item.cod && celdaEditando?.campo === 'precio' ? (
                          <input type="number" className="form-control form-control-sm text-end fw-bold text-success border-primary shadow-sm" autoFocus value={valorCeldaTemporal} onChange={e => setValorCeldaTemporal(e.target.value)} onKeyDown={(e) => manejarTecladoEdicion(e, item.cod, 'precio')} onBlur={() => guardarEdicionEnLinea(item.cod, 'precio')} />
                      ) : <span className="text-success fw-bold">{formatoMoneda(item.precio)}</span>}
                    </td>

                    <td className="text-center" onDoubleClick={() => iniciarEdicionEnLinea(item.cod, 'stock', item.stock)} style={{ cursor: 'text' }}>
                      {celdaEditando?.cod === item.cod && celdaEditando?.campo === 'stock' ? (
                          <input type="number" className="form-control form-control-sm text-center font-monospace fw-bold border-primary shadow-sm mx-auto" style={{maxWidth:'60px'}} autoFocus value={valorCeldaTemporal} onChange={e => setValorCeldaTemporal(e.target.value)} onKeyDown={(e) => manejarTecladoEdicion(e, item.cod, 'stock')} onBlur={() => guardarEdicionEnLinea(item.cod, 'stock')} />
                      ) : <span className={`badge ${item.stock > 0 ? 'bg-success' : 'bg-danger'}`}>{item.stock}</span>}
                    </td>

                    <td className="text-center" onDoubleClick={() => iniciarEdicionEnLinea(item.cod, 'stock_min', item.stock_min)} style={{ cursor: 'text' }}>
                      {celdaEditando?.cod === item.cod && celdaEditando?.campo === 'stock_min' ? (
                          <input type="number" className="form-control form-control-sm text-center font-monospace fw-bold border-primary shadow-sm mx-auto" style={{maxWidth:'60px'}} autoFocus value={valorCeldaTemporal} onChange={e => setValorCeldaTemporal(e.target.value)} onKeyDown={(e) => manejarTecladoEdicion(e, item.cod, 'stock_min')} onBlur={() => guardarEdicionEnLinea(item.cod, 'stock_min')} />
                      ) : <span className="text-muted font-monospace">{item.stock_min}</span>}
                    </td>
                  </tr>
                ))}
                {stockLocal.length === 0 && <tr><td colSpan="7" className="text-center py-4 text-muted">No se encontraron artículos en el local.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* MODAL ALTA MANUAL */}
      {altaManualForm && (
        <div className="position-fixed top-0 start-0 w-100 h-100 bg-dark bg-opacity-75 d-flex justify-content-center align-items-center" style={{ zIndex: 2000 }}>
          <div className="card shadow-lg p-4 border-0" style={{ width: '600px', borderRadius: '12px' }}>
            <h5 className="fw-bold text-dark border-bottom pb-2 mb-4">➕ Alta Manual de Artículo Nuevo</h5>
            <div className="row g-3">
              <div className="col-6"><label className="small fw-bold text-secondary">Código Interno</label><input type="text" className="form-control font-monospace text-primary fw-bold" value={altaManualForm.cod} onChange={e => setAltaManualForm({...altaManualForm, cod: e.target.value})} /></div>
              <div className="col-6"><label className="small fw-bold text-secondary">Código Auxiliar (Equivalencia)</label><input type="text" className="form-control font-monospace text-uppercase" value={altaManualForm.codigo_aux} onChange={e => setAltaManualForm({...altaManualForm, codigo_aux: e.target.value})} /></div>
              <div className="col-12"><label className="small fw-bold text-secondary">Descripción completa</label><input type="text" className="form-control" value={altaManualForm.desc} onChange={e => setAltaManualForm({...altaManualForm, desc: e.target.value})} /></div>
              <div className="col-6"><label className="small fw-bold text-secondary">Marca</label><input type="text" className="form-control" value={altaManualForm.marca} onChange={e => setAltaManualForm({...altaManualForm, marca: e.target.value})} /></div>
              <div className="col-6"><label className="small fw-bold text-secondary">Nro Original (OEM)</label><input type="text" className="form-control font-monospace" value={altaManualForm.nro_original} onChange={e => setAltaManualForm({...altaManualForm, nro_original: e.target.value})} /></div>
              <div className="col-6"><label className="small fw-bold text-danger">Precio Costo ($)</label><input type="number" className="form-control fw-bold text-danger" value={altaManualForm.precio_costo} onChange={e => setAltaManualForm({...altaManualForm, precio_costo: e.target.value})} /></div>
              <div className="col-6"><label className="small fw-bold text-success">Precio Público ($)</label><input type="number" className="form-control fw-bold text-success" value={altaManualForm.precio} onChange={e => setAltaManualForm({...altaManualForm, precio: e.target.value})} /></div>
              <div className="col-4"><label className="small fw-bold text-secondary">Stock Inicial</label><input type="number" className="form-control text-center fw-bold" value={altaManualForm.stock} onChange={e => setAltaManualForm({...altaManualForm, stock: e.target.value})} /></div>
              <div className="col-4"><label className="small fw-bold text-secondary">Stock Mínimo</label><input type="number" className="form-control text-center" value={altaManualForm.stock_min} onChange={e => setAltaManualForm({...altaManualForm, stock_min: e.target.value})} /></div>
              <div className="col-4"><label className="small fw-bold text-secondary">Ubicación Fija</label><input type="text" className="form-control text-center" value={altaManualForm.ubicacion} onChange={e => setAltaManualForm({...altaManualForm, ubicacion: e.target.value})} /></div>
            </div>
            <div className="d-flex gap-2 mt-4 pt-3 border-top">
              <button className="btn btn-outline-secondary fw-bold w-50" onClick={() => setAltaManualForm(null)}>Cancelar</button>
              <button className="btn btn-dark fw-bold w-50" onClick={guardarAltaManualDirecta}>Guardar en BD</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL INTERNALIZAR */}
      {itemParaInternalizar && (
        <div className="position-fixed top-0 start-0 w-100 h-100 bg-dark bg-opacity-75 d-flex justify-content-center align-items-center" style={{ zIndex: 2000 }}>
          <div className="card shadow-lg p-4 border-0" style={{ width: '550px', borderRadius: '12px' }}>
            <h5 className="fw-bold text-dark border-bottom pb-2 mb-3">🔄 Internalizar Artículo de Distribuidor</h5>
            <div className="row g-2 mb-3">
              <div className="col-12"><small className="text-muted d-block mb-1">Extrayendo datos de: <strong className="text-dark">{itemParaInternalizar.distribuidor}</strong></small></div>
              <div className="col-12"><input type="text" className="form-control bg-light fw-bold" disabled value={itemParaInternalizar.desc} /></div>
              <div className="col-6"><label className="small fw-bold text-muted">Cód. Origen</label><input type="text" className="form-control font-monospace bg-light" disabled value={itemParaInternalizar.cod} /></div>
              <div className="col-6"><label className="small fw-bold text-muted">Precio Sug.</label><input type="text" className="form-control fw-bold text-success bg-light" disabled value={formatoMoneda(itemParaInternalizar.precio)} /></div>
            </div>
            <div className="row g-3 mb-4 border-top pt-3">
              <div className="col-6"><label className="small fw-bold text-primary">Asignar Cód Auxiliar:</label><input type="text" className="form-control font-monospace text-uppercase border-primary" value={itemParaInternalizar.codigo_aux} onChange={e => setItemParaInternalizar({...itemParaInternalizar, codigo_aux: e.target.value})} autoFocus /></div>
              <div className="col-6"><label className="small fw-bold text-secondary">Ubicación en estante:</label><input type="text" className="form-control" value={itemParaInternalizar.ubicacion} onChange={e => setItemParaInternalizar({...itemParaInternalizar, ubicacion: e.target.value})} /></div>
              <div className="col-4"><label className="small fw-bold text-success">Stock Ingresando:</label><input type="number" className="form-control text-center fw-bold text-success" value={itemParaInternalizar.stock_ingreso} onChange={e => setItemParaInternalizar({...itemParaInternalizar, stock_ingreso: e.target.value})} /></div>
              <div className="col-4"><label className="small fw-bold text-secondary">Alerta Mínimo:</label><input type="number" className="form-control text-center" value={itemParaInternalizar.stock_min} onChange={e => setItemParaInternalizar({...itemParaInternalizar, stock_min: e.target.value})} /></div>
              <div className="col-4"><label className="small fw-bold text-secondary">Tope Máximo:</label><input type="number" className="form-control text-center" value={itemParaInternalizar.stock_max} onChange={e => setItemParaInternalizar({...itemParaInternalizar, stock_max: e.target.value})} /></div>
            </div>
            <div className="d-flex gap-2">
              <button className="btn btn-outline-secondary fw-bold w-50" onClick={() => setItemParaInternalizar(null)}>Cancelar</button>
              <button className="btn btn-success fw-bold w-50" onClick={confirmarInternalizacion}>Confirmar</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL BULK CSV (Mockup) */}
      {mostrarBulkArea && (
        <div className="position-fixed top-0 start-0 w-100 h-100 bg-dark bg-opacity-75 d-flex justify-content-center align-items-center" style={{ zIndex: 2000 }}>
          <div className="card shadow-lg p-4 border-0" style={{ width: '650px', borderRadius: '12px' }}>
            <h5 className="fw-bold text-dark mb-1">📥 Consola de Carga Masiva (CSV)</h5>
            <p className="small text-muted border-bottom pb-2 mb-3">Estructura requerida: <code>CODIGO;DESCRIPCION;COSTO;PRECIO;MARCA</code></p>
            <textarea className="form-control font-monospace mb-3 bg-dark text-light p-3" rows="8" placeholder="BOM-001;Bomba de Agua;15000;25000;VMG..." style={{ fontSize: '0.85rem' }}></textarea>
            <div className="d-flex gap-2">
              <button className="btn btn-outline-secondary fw-bold w-25" onClick={() => setMostrarBulkArea(false)}>Cerrar</button>
              <button className="btn btn-primary fw-bold flex-grow-1" onClick={() => { alert('Función de carga masiva en desarrollo (Requiere Cloud Functions).'); setMostrarBulkArea(false); }}>Procesar Lote</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}