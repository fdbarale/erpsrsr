import React, { useState } from 'react';

export default function GestionStock({ baseDatos, setBaseDatos, volverAlMenu }) {
  const [busquedaLocal, setBusquedaLocal] = useState('');
  const [busquedaCatalogo, setBusquedaCatalogo] = useState('');
  const [distribuidorFiltro, setDistribuidorFiltro] = useState('TODAS');
  const [celdaEditando, setCeldaEditando] = useState(null);
  const [valorCeldaTemporal, setValorCeldaTemporal] = useState('');

  const [itemParaInternalizar, setItemParaInternalizar] = useState(null);
  const [altaManualForm, setAltaManualForm] = useState(null);
  const [mostrarBulkArea, setMostrarBulkArea] = useState(false);
  const [csvInputText, setCsvInputText] = useState('');

  const distribuidoresLista = ['TODAS', 'Bálsamo', 'VMG', 'SKF', 'Arteb'];
  const formatoMoneda = (valor) => "$ " + parseFloat(valor || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 });

  // Como la BD ahora trae TODO, separamos visualmente:
  // "Local" = lo que tiene stock > 0, o stock mínimo configurado
  const stockLocal = baseDatos.filter(item => item.stock > 0 || item.stock_min > 0 || item.codigo_aux);

  const stockLocalFiltrado = stockLocal.filter(item => 
    item.cod.toLowerCase().includes(busquedaLocal.toLowerCase()) || 
    item.desc.toLowerCase().includes(busquedaLocal.toLowerCase()) ||
    (item.codigo_aux && item.codigo_aux.toLowerCase().includes(busquedaLocal.toLowerCase())) ||
    (item.nro_original && item.nro_original.toLowerCase().includes(busquedaLocal.toLowerCase()))
  );

  const catalogoFiltrado = baseDatos.filter(item => {
    if (distribuidorFiltro !== 'TODAS' && item.distribuidor !== distribuidorFiltro) return false;
    const term = busquedaCatalogo.toLowerCase();
    return item.cod.toLowerCase().includes(term) || item.desc.toLowerCase().includes(term) || (item.nro_original && item.nro_original.toLowerCase().includes(term));
  });

  const iniciarEdicionEnLinea = (cod, campo, valorActual) => {
    setCeldaEditando({ cod, campo });
    setValorCeldaTemporal(valorActual.toString());
  };

  const guardarEdicionEnLinea = (cod, campo) => {
    setBaseDatos(prev => prev.map(item => {
      if (item.cod === cod) {
        let valorFinal = valorCeldaTemporal;
        if (['stock', 'stock_min', 'stock_max'].includes(campo)) valorFinal = parseInt(valorCeldaTemporal) || 0;
        if (campo === 'precio_costo') valorFinal = parseFloat(valorCeldaTemporal) || 0;
        return { ...item, [campo]: valorFinal };
      }
      return item;
    }));
    setCeldaEditando(null);
  };

  const abrirFormularioInternalizar = (item) => {
    setItemParaInternalizar({
      ...item,
      codigo_aux: '', ubicacion: '', stock_min: 2, stock_max: 10, stock_ingreso: 0
    });
  };

  const confirmarInternalizacion = () => {
    setBaseDatos(prev => prev.map(item => {
      if (item.cod === itemParaInternalizar.cod) {
        return {
          ...item,
          codigo_aux: itemParaInternalizar.codigo_aux.toUpperCase(),
          stock: parseInt(itemParaInternalizar.stock_ingreso) || 0,
          stock_min: parseInt(itemParaInternalizar.stock_min) || 0,
          stock_max: parseInt(itemParaInternalizar.stock_max) || 0
        }
      }
      return item;
    }));
    setItemParaInternalizar(null);
  };

  const guardarAltaManualDirecta = () => {
    if (!altaManualForm.cod || !altaManualForm.desc) { alert("Código y Descripción son obligatorios."); return; }
    const manualArt = {
      ...altaManualForm,
      precio_costo: parseFloat(altaManualForm.precio_costo) || 0,
      stock: parseInt(altaManualForm.stock) || 0,
      stock_min: parseInt(altaManualForm.stock_min) || 0,
      stock_max: parseInt(altaManualForm.stock_max) || 0,
      codigo_aux: altaManualForm.codigo_aux.toUpperCase(),
      nro_original: altaManualForm.nro_original.toUpperCase()
    };
    setBaseDatos([...baseDatos, manualArt]);
    setAltaManualForm(null);
  };

  return (
    <div className="bg-white min-vh-100 d-flex flex-column p-3">
      <div className="d-flex justify-content-between align-items-center border-bottom pb-2 mb-3">
        <div>
          <h4 className="fw-bold text-dark m-0">⚙️ Gestión de Stock e Inventario</h4>
          <p className="text-muted small m-0">Administración de productos locales y catálogos externos</p>
        </div>
        <div className="d-flex gap-2">
          <button className="btn btn-sm btn-dark fw-bold" onClick={() => setAltaManualForm({ cod: '', nro_original: '', desc: '', codigo_aux: '', marca: '', ubicacion: '', precio_costo: '', stock: '', stock_min: '', stock_max: '', distribuidor: 'MANUAL' })}>
            + Agregar Artículo Manual
          </button>
          <button className="btn btn-sm btn-success fw-bold" onClick={() => setMostrarBulkArea(true)}>📊 Carga Masiva Excel</button>
          <button className="btn btn-sm btn-outline-secondary fw-bold" onClick={volverAlMenu}>Volver al Menú</button>
        </div>
      </div>

      <div className="row flex-grow-1">
        <div className="col-4 border-end pe-3">
          <h6 className="fw-bold text-secondary text-uppercase small mb-3">🔍 Catálogos de Distribuidoras</h6>
          <div className="row g-1 mb-2">
            <div className="col-7"><input type="text" className="form-control form-control-sm" placeholder="Buscar en listas externas..." value={busquedaCatalogo} onChange={e => setBusquedaCatalogo(e.target.value)} /></div>
            <div className="col-5">
              <select className="form-select form-select-sm" value={distribuidorFiltro} onChange={e => setDistribuidorFiltro(e.target.value)}>
                {distribuidoresLista.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
          </div>
          <div className="overflow-auto border rounded bg-white" style={{maxHeight:'70vh'}}>
            <ul className="list-group list-group-flush">
              {catalogoFiltrado.map((item, idx) => (
                <li key={idx} className="list-group-item p-2">
                  <div className="d-flex justify-content-between">
                    <div>
                      <strong className="font-monospace text-primary">{item.cod}</strong>
                      <p className="m-0 small fw-bold">{item.desc}</p>
                      <small className="text-muted">Orig: {item.nro_original} | Marca: {item.marca}</small>
                    </div>
                    <button className="btn btn-sm btn-outline-success py-0" onClick={() => abrirFormularioInternalizar(item)}>+ Add</button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="col-8 ps-3">
          <div className="d-flex justify-content-between align-items-center mb-2">
            <h6 className="fw-bold text-dark m-0 text-uppercase small">📦 Stock en Local <span className="text-muted fw-normal">(Doble clic para editar)</span></h6>
            <input type="text" className="form-control form-control-sm w-50" placeholder="Filtrar local (Código, Aux, Orig, Desc)..." value={busquedaLocal} onChange={e => setBusquedaLocal(e.target.value)} />
          </div>
          <div className="overflow-auto border rounded bg-white shadow-sm" style={{maxHeight:'70vh'}}>
            <table className="table table-sm table-hover mb-0" style={{fontSize:'0.8rem'}}>
              <thead className="table-dark sticky-top">
                <tr>
                  <th>Código</th><th>Nro Original</th><th>Descripción</th><th>Auxiliar</th>
                  <th className="text-end">Costo</th><th className="text-center">Stock</th><th className="text-center">Mín</th><th className="text-center">Máx</th>
                </tr>
              </thead>
              <tbody>
                {stockLocalFiltrado.map((item, idx) => (
                  <tr key={idx}>
                    <td className="font-monospace fw-bold">{item.cod}</td>
                    <td className="font-monospace text-muted">{item.nro_original}</td>
                    <td onDoubleClick={() => iniciarEdicionEnLinea(item.cod, 'desc', item.desc)}>
                      {celdaEditando?.cod === item.cod && celdaEditando?.campo === 'desc' ? <input className="form-control form-control-sm py-0" value={valorCeldaTemporal} onChange={e => setValorCeldaTemporal(e.target.value)} onBlur={() => guardarEdicionEnLinea(item.cod, 'desc')} autoFocus /> : item.desc}
                    </td>
                    <td onDoubleClick={() => iniciarEdicionEnLinea(item.cod, 'codigo_aux', item.codigo_aux || '')}>
                      {celdaEditando?.cod === item.cod && celdaEditando?.campo === 'codigo_aux' ? <input className="form-control form-control-sm py-0" value={valorCeldaTemporal} onChange={e => setValorCeldaTemporal(e.target.value)} onBlur={() => guardarEdicionEnLinea(item.cod, 'codigo_aux')} autoFocus /> : item.codigo_aux}
                    </td>
                    <td className="text-end" onDoubleClick={() => iniciarEdicionEnLinea(item.cod, 'precio_costo', item.precio_costo)}>
                      {celdaEditando?.cod === item.cod && celdaEditando?.campo === 'precio_costo' ? <input className="form-control form-control-sm py-0 text-end" type="number" value={valorCeldaTemporal} onChange={e => setValorCeldaTemporal(e.target.value)} onBlur={() => guardarEdicionEnLinea(item.cod, 'precio_costo')} autoFocus /> : formatoMoneda(item.precio_costo)}
                    </td>
                    <td className="text-center" onDoubleClick={() => iniciarEdicionEnLinea(item.cod, 'stock', item.stock)}>
                      {celdaEditando?.cod === item.cod && celdaEditando?.campo === 'stock' ? <input className="form-control form-control-sm py-0 text-center" type="number" value={valorCeldaTemporal} onChange={e => setValorCeldaTemporal(e.target.value)} onBlur={() => guardarEdicionEnLinea(item.cod, 'stock')} autoFocus /> : <span className={`badge ${item.stock <= item.stock_min ? 'bg-danger' : 'bg-success'}`}>{item.stock}</span>}
                    </td>
                    <td className="text-center" onDoubleClick={() => iniciarEdicionEnLinea(item.cod, 'stock_min', item.stock_min)}>
                      {celdaEditando?.cod === item.cod && celdaEditando?.campo === 'stock_min' ? <input className="form-control form-control-sm py-0 text-center" type="number" value={valorCeldaTemporal} onChange={e => setValorCeldaTemporal(e.target.value)} onBlur={() => guardarEdicionEnLinea(item.cod, 'stock_min')} autoFocus /> : item.stock_min}
                    </td>
                    <td className="text-center" onDoubleClick={() => iniciarEdicionEnLinea(item.cod, 'stock_max', item.stock_max)}>
                      {celdaEditando?.cod === item.cod && celdaEditando?.campo === 'stock_max' ? <input className="form-control form-control-sm py-0 text-center" type="number" value={valorCeldaTemporal} onChange={e => setValorCeldaTemporal(e.target.value)} onBlur={() => guardarEdicionEnLinea(item.cod, 'stock_max')} autoFocus /> : item.stock_max}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* MODAL ALTA MANUAL */}
      {altaManualForm && (
        <div className="position-fixed top-0 start-0 w-100 h-100 bg-dark bg-opacity-75 d-flex justify-content-center align-items-center" style={{ zIndex: 3000 }}>
          <div className="card shadow-lg p-4" style={{width:'600px', borderRadius:'15px'}}>
            <h5 className="fw-bold text-dark border-bottom pb-2 mb-4">🆕 Alta Manual de Artículo Nuevo</h5>
            <div className="row g-3">
              <div className="col-12"><label className="small fw-bold text-secondary">Descripción completa del repuesto</label><input type="text" className="form-control" value={altaManualForm.desc} onChange={e => setAltaManualForm({...altaManualForm, desc: e.target.value})} /></div>
              <div className="col-6"><label className="small fw-bold text-secondary">Código Proveedor</label><input type="text" className="form-control font-monospace" value={altaManualForm.cod} onChange={e => setAltaManualForm({...altaManualForm, cod: e.target.value.toUpperCase()})} /></div>
              <div className="col-6"><label className="small fw-bold text-secondary">Nro Original (OEM)</label><input type="text" className="form-control font-monospace" value={altaManualForm.nro_original} onChange={e => setAltaManualForm({...altaManualForm, nro_original: e.target.value.toUpperCase()})} /></div>
              <div className="col-6"><label className="small fw-bold text-secondary">Marca</label><input type="text" className="form-control" value={altaManualForm.marca} onChange={e => setAltaManualForm({...altaManualForm, marca: e.target.value})} /></div>
              <div className="col-6"><label className="small fw-bold text-secondary">Código Auxiliar</label><input type="text" className="form-control font-monospace" value={altaManualForm.codigo_aux} onChange={e => setAltaManualForm({...altaManualForm, codigo_aux: e.target.value.toUpperCase()})} /></div>
              <div className="col-6"><label className="small fw-bold text-secondary">Precio Costo ($)</label><input type="number" className="form-control text-success fw-bold" value={altaManualForm.precio_costo} onChange={e => setAltaManualForm({...altaManualForm, precio_costo: e.target.value})} /></div>
              <div className="col-6"><label className="small fw-bold text-secondary">Ubicación Fija</label><input type="text" className="form-control" value={altaManualForm.ubicacion} onChange={e => setAltaManualForm({...altaManualForm, ubicacion: e.target.value})} /></div>
              <div className="col-4"><label className="small fw-bold text-secondary">Stock Actual</label><input type="number" className="form-control text-center" value={altaManualForm.stock} onChange={e => setAltaManualForm({...altaManualForm, stock: e.target.value})} /></div>
              <div className="col-4"><label className="small fw-bold text-secondary">Stock Mínimo</label><input type="number" className="form-control text-center border-danger" value={altaManualForm.stock_min} onChange={e => setAltaManualForm({...altaManualForm, stock_min: e.target.value})} /></div>
              <div className="col-4"><label className="small fw-bold text-secondary">Stock Máximo</label><input type="number" className="form-control text-center border-primary" value={altaManualForm.stock_max} onChange={e => setAltaManualForm({...altaManualForm, stock_max: e.target.value})} /></div>
            </div>
            <div className="d-flex gap-2 mt-4">
              <button className="btn btn-outline-secondary w-50" onClick={() => setAltaManualForm(null)}>Cancelar</button>
              <button className="btn btn-dark w-50 fw-bold" onClick={guardarAltaManualDirecta}>Guardar en local</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL INTERNALIZAR */}
      {itemParaInternalizar && (
        <div className="position-fixed top-0 start-0 w-100 h-100 bg-dark bg-opacity-75 d-flex justify-content-center align-items-center" style={{ zIndex: 3000 }}>
          <div className="card shadow-lg p-4" style={{width:'550px', borderRadius:'15px'}}>
            <h6 className="fw-bold text-dark border-bottom pb-2 mb-3">📋 Internalizar Artículo de Distribuidor</h6>
            <div className="row g-2 mb-3">
              <div className="col-12"><small className="text-muted">Extrayendo de: <strong>{itemParaInternalizar.distribuidor}</strong></small></div>
              <div className="col-12"><input className="form-control form-control-sm bg-light" value={itemParaInternalizar.desc} disabled /></div>
              <div className="col-6"><label className="small text-muted">Cód Proveedor</label><input className="form-control form-control-sm font-monospace" value={itemParaInternalizar.cod} disabled /></div>
              <div className="col-6"><label className="small text-muted">Nro Original</label><input className="form-control form-control-sm font-monospace" value={itemParaInternalizar.nro_original} disabled /></div>
            </div>
            <div className="row g-3 mb-4">
              <div className="col-6"><label className="small fw-bold text-primary">Cód Auxiliar:</label><input className="form-control border-primary" value={itemParaInternalizar.codigo_aux} onChange={e => setItemParaInternalizar({...itemParaInternalizar, codigo_aux: e.target.value})} /></div>
              <div className="col-6"><label className="small fw-bold text-primary">Ubicación:</label><input className="form-control border-primary" value={itemParaInternalizar.ubicacion} onChange={e => setItemParaInternalizar({...itemParaInternalizar, ubicacion: e.target.value})} /></div>
              <div className="col-4"><label className="small fw-bold">Entran hoy:</label><input type="number" className="form-control text-center border-success" value={itemParaInternalizar.stock_ingreso} onChange={e => setItemParaInternalizar({...itemParaInternalizar, stock_ingreso: e.target.value})} /></div>
              <div className="col-4"><label className="small fw-bold">Mín:</label><input type="number" className="form-control text-center" value={itemParaInternalizar.stock_min} onChange={e => setItemParaInternalizar({...itemParaInternalizar, stock_min: e.target.value})} /></div>
              <div className="col-4"><label className="small fw-bold">Máx:</label><input type="number" className="form-control text-center" value={itemParaInternalizar.stock_max} onChange={e => setItemParaInternalizar({...itemParaInternalizar, stock_max: e.target.value})} /></div>
            </div>
            <div className="d-flex gap-2">
              <button className="btn btn-light border flex-grow-1" onClick={() => setItemParaInternalizar(null)}>Cancelar</button>
              <button className="btn btn-success flex-grow-1 fw-bold" onClick={confirmarInternalizacion}>Confirmar Ingreso</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL BULK CSV */}
      {mostrarBulkArea && (
        <div className="position-fixed top-0 start-0 w-100 h-100 bg-dark bg-opacity-75 d-flex justify-content-center align-items-center" style={{ zIndex: 3000 }}>
          <div className="card shadow-lg p-3" style={{width:'650px'}}>
            <h6 className="fw-bold">📊 Consola de Carga por Excel</h6>
            <p className="small text-muted">Estructura: COD_PROVEEDOR ; COD_AUXILIAR ; CANTIDAD</p>
            <textarea className="form-control font-monospace mb-3 bg-dark text-white" rows="8" placeholder="SKF-VKBA3546;RUL-CORSA;15" value={csvInputText} onChange={e => setCsvInputText(e.target.value)} />
            <div className="d-flex gap-2">
              <button className="btn btn-sm btn-outline-secondary" onClick={() => setMostrarBulkArea(false)}>Cerrar</button>
              <button className="btn btn-sm btn-success flex-grow-1 fw-bold" onClick={() => { setMostrarBulkArea(false); alert("Procesado."); }}>🚀 Procesar Lote</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}