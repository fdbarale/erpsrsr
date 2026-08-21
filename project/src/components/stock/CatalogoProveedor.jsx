import React, { useState, useEffect } from 'react';
import { buscarArticulosLocal, actualizarArticuloLocal, obtenerDistribuidoresLocal } from '../../utils/dbLocal';
import { dbOficial } from '../../supabaseClient';

export default function CatalogoProveedor() {
  const [textoBusqueda, setTextoBusqueda] = useState('');
  const [distriSeleccionada, setDistriSeleccionada] = useState('');
  const [listaDistribuidores, setListaDistribuidores] = useState([]);
  
  const [resultados, setResultados] = useState([]);
  const [buscando, setBuscando] = useState(false);
  const [modalItem, setModalItem] = useState(null);

  const formatoMoneda = (valor) => "$ " + Number(valor || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 });

  // Dispara la carga de los primeros 100 artículos apenas entrás a la pestaña
  useEffect(() => {
    obtenerDistribuidoresLocal().then(setListaDistribuidores);
    buscarArticulosLocal('', 'TODOS', '').then(setResultados);
  }, []);

  const ejecutarBusqueda = async (e) => {
    e.preventDefault();
    setBuscando(true);
    const res = await buscarArticulosLocal(textoBusqueda, 'TODOS', distriSeleccionada);
    setResultados(res);
    setBuscando(false);
  };

  const procesarInternalizacion = async (e) => {
    e.preventDefault();
    try {
      const datosActualizados = {
        desc: modalItem.desc,
        codigo_aux: modalItem.codigo_aux,
        stock: Number(modalItem.stock),
        en_estanteria: true
      };

      const { error } = await dbOficial.from('articulos').update(datosActualizados).eq('cod', modalItem.cod);
      if (error) throw error;

      await actualizarArticuloLocal(modalItem.cod, datosActualizados);
      
      setResultados(prev => prev.filter(r => r.cod !== modalItem.cod));
      setModalItem(null);
      alert(`✅ ${modalItem.cod} bajado a la estantería con éxito.`);
    } catch (err) {
      alert(`❌ Error al internalizar: ${err.message}`);
    }
  };

  return (
    <div className="d-flex flex-column h-100 position-relative">
      
      {modalItem && (
        <div className="position-fixed top-0 start-0 w-100 h-100 bg-dark bg-opacity-75 d-flex justify-content-center align-items-center" style={{ zIndex: 1050 }}>
          <div className="card shadow-lg" style={{ width: '500px', borderRadius: '12px' }}>
            <div className="card-header bg-success text-white fw-bold d-flex justify-content-between">
              <span>➕ Internalizar a Mi Estantería</span>
              <button className="btn-close btn-close-white" onClick={() => setModalItem(null)}></button>
            </div>
            <div className="card-body bg-light">
              <form onSubmit={procesarInternalizacion}>
                <div className="mb-3">
                  <label className="form-label small fw-bold text-muted">Código Original (Intocable)</label>
                  <input type="text" className="form-control font-monospace bg-white" value={modalItem.cod} disabled />
                </div>
                <div className="mb-3">
                  <label className="form-label small fw-bold text-muted">Descripción (Editable)</label>
                  <input type="text" className="form-control" value={modalItem.desc} onChange={e => setModalItem({...modalItem, desc: e.target.value})} required autoFocus />
                </div>
                <div className="row mb-3">
                  <div className="col-6">
                    <label className="form-label small fw-bold text-muted">Mi Stock Físico</label>
                    <input type="number" className="form-control font-monospace" value={modalItem.stock || 0} onChange={e => setModalItem({...modalItem, stock: e.target.value})} required />
                  </div>
                  <div className="col-6">
                    <label className="form-label small fw-bold text-info">Código Aux. (Primos)</label>
                    <input type="text" className="form-control font-monospace" value={modalItem.codigo_aux || ''} onChange={e => setModalItem({...modalItem, codigo_aux: e.target.value})} placeholder="Ej: VMG-123" />
                  </div>
                </div>
                <div className="d-flex justify-content-end gap-2 mt-4">
                  <button type="button" className="btn btn-outline-secondary fw-bold" onClick={() => setModalItem(null)}>Cancelar</button>
                  <button type="submit" className="btn btn-success fw-bold px-4">Guardar en Estantería</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      <div className="alert alert-secondary border-secondary mb-3 small py-2">
        <strong>Filtros:</strong> Podés elegir una distribuidora específica y darle a Enter para ver sus repuestos, o combinarlo con texto.
      </div>
      
      <form onSubmit={ejecutarBusqueda} className="row g-2 mb-3">
        <div className="col-md-3">
          <select className="form-select font-monospace" value={distriSeleccionada} onChange={e => setDistriSeleccionada(e.target.value)}>
            <option value="">-- TODAS LAS DISTRIBUIDORAS --</option>
            {listaDistribuidores.map(d => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
        </div>
        <div className="col-md-7">
          <input 
            type="text" 
            className="form-control font-monospace shadow-sm" 
            placeholder="🔎 Buscar (Ej: amort ren 12) ..."
            value={textoBusqueda}
            onChange={(e) => setTextoBusqueda(e.target.value)}
          />
        </div>
        <div className="col-md-2">
          <button type="submit" className="btn btn-primary w-100 fw-bold" disabled={buscando}>
            {buscando ? 'Buscando...' : 'Buscar'}
          </button>
        </div>
      </form>

      <div className="table-responsive flex-grow-1 border rounded">
        <table className="table table-hover align-middle mb-0" style={{ fontSize: '0.9rem' }}>
          <thead className="table-light sticky-top">
            <tr>
              <th>Código</th>
              <th>Descripción</th>
              <th className="text-center">Stock Dist.</th>
              <th className="text-end">Costo</th>
              <th className="text-end">P. Público</th>
              <th className="text-center" width="100">Acción</th>
            </tr>
          </thead>
          <tbody>
            {resultados.length === 0 && !buscando && <tr><td colSpan="6" className="text-center text-muted py-4">Sin resultados.</td></tr>}
            {resultados.map((item, idx) => {
              const tieneStockProv = (item.stock > 0 || String(item.stock).toUpperCase() === 'SI' || item.disp === 'SI');
              return (
                <tr key={idx} className={item.en_estanteria === true || item.en_estanteria === 'true' ? 'table-success' : ''}>
                  <td className="font-monospace fw-bold">{item.cod}</td>
                  <td>
                    {item.desc}
                    <div className="small text-muted">{item.distribuidor || item.marca}</div>
                  </td>
                  <td className="text-center fw-bold">
                    {tieneStockProv ? <span className="text-success">Sí</span> : <span className="text-danger">No</span>}
                  </td>
                  <td className="text-end font-monospace">{formatoMoneda(item.precio_costo)}</td>
                  <td className="text-end font-monospace text-primary fw-bold">{formatoMoneda(item.precio)}</td>
                  <td className="text-center">
                    {item.en_estanteria === true || item.en_estanteria === 'true' ? (
                      <span className="badge bg-success text-wrap">En local</span>
                    ) : (
                      <button className="btn btn-sm btn-success fw-bold w-100" onClick={() => setModalItem(item)}>➕ Ingresar</button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}