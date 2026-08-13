import React, { useState, useEffect } from 'react';
import { dbOficial } from '../supabaseClient';
import { useOperativoStore } from '../stores/useOperativoStore';

export default function Deposito({ volverAlMenu }) {
  // === ESTADOS GLOBALES (Zustand) ===
  const { despachos, eliminarDespacho } = useOperativoStore();

  // === ESTADOS LOCALES ===
  const [tabActiva, setTabActiva] = useState('RECEPCION');
  const [itemsARecibir, setItemsARecibir] = useState([]);
  const [inputsRecepcion, setInputsRecepcion] = useState({});
  const [modalEnvio, setModalEnvio] = useState(null);
  const [procesando, setProcesando] = useState(false);

  const colorBordo = '#6B1116';
  const colorGris = '#54565b';

  // === EFECTO: BUSCAR MERCADERÍA EN TRÁNSITO ===
  const cargarMercaderiaEnCamino = async () => {
    const { data, error } = await dbOficial
      .from('articulos')
      .select('cod, desc, distribuidor, cant_en_camino, stock')
      .gt('cant_en_camino', 0);

    if (!error && data) {
      setItemsARecibir(data);
      // Inicializamos los inputs con la cantidad esperada (la que viene en el camión)
      const valoresIniciales = {};
      data.forEach((item) => {
        if (inputsRecepcion[item.cod] === undefined) {
          valoresIniciales[item.cod] = item.cant_en_camino;
        }
      });
      setInputsRecepcion((prev) => ({ ...prev, ...valoresIniciales }));
    }
  };

  useEffect(() => {
    cargarMercaderiaEnCamino();
  }, [tabActiva]);

  // === LÓGICA DE RECEPCIÓN ===
  const manejarInputRecepcion = (cod, valor) => {
    setInputsRecepcion((prev) => ({ ...prev, [cod]: parseInt(valor) || 0 }));
  };

  const obtenerEstadoCheck = (esperado, ingresado) => {
    if (ingresado === esperado) return { clase: 'border-success bg-success bg-opacity-10 text-success', badge: 'bg-success', texto: 'OK' };
    if (ingresado < esperado) return { clase: 'border-danger bg-danger bg-opacity-10 text-danger', badge: 'bg-danger', texto: `Faltan ${esperado - ingresado}` };
    return { clase: 'border-warning bg-warning bg-opacity-10 text-dark', badge: 'bg-warning text-dark', texto: `Sobran ${ingresado - esperado}` };
  };

  const finalizarRecepcion = async () => {
    if (itemsARecibir.length === 0) return;
    setProcesando(true);

    try {
      // Promesas en paralelo para actualizar todo el lote en la base oficial
      const promesasUpdate = itemsARecibir.map((item) => {
        const cantidadIngresada = inputsRecepcion[item.cod] ?? item.cant_en_camino;
        const nuevoStock = item.stock + cantidadIngresada;
        const nuevoEnCamino = Math.max(0, item.cant_en_camino - cantidadIngresada);
        
        return dbOficial.from('articulos').update({ 
            stock: nuevoStock, 
            cant_en_camino: nuevoEnCamino 
        }).eq('cod', item.cod);
      });

      await Promise.all(promesasUpdate);
      alert('Recepción Finalizada. Stock físico ingresado y actualizado en la nube.');
      setInputsRecepcion({});
      cargarMercaderiaEnCamino(); // Recargar la tabla limpia
    } catch (error) {
      alert("Error crítico al procesar la recepción.");
      console.error(error);
    } finally {
      setProcesando(false);
    }
  };

  // === LÓGICA DE DESPACHOS ===
  const procesarEnvio = () => {
    eliminarDespacho(modalEnvio.id);
    setModalEnvio(null);
    alert('¡Bulto cerrado, rotulado y quitado de la cola de envíos!');
  };

  return (
    <div className="bg-light min-vh-100 d-flex flex-column" style={{ overflowX: 'hidden' }}>
      <nav className="navbar navbar-dark shadow-sm px-3" style={{ backgroundColor: colorBordo, borderBottom: `4px solid ${colorGris}` }}>
        <div className="container-fluid p-0">
          <div className="d-flex align-items-center">
            <button className="btn btn-sm btn-outline-light me-3 fw-bold" onClick={volverAlMenu}>⬅ Volver al Menú
          </button>
            <span className="navbar-brand fw-bold m-0 tracking-wide">Depósito y Logística</span>
          </div>
          <div className="d-flex text-white align-items-center">
            {itemsARecibir.length > 0 && (
              <span className="badge bg-warning text-dark fw-bold fs-6 me-3">🚚 {itemsARecibir.length} en puerta</span>
            )}
            <span className="me-3 fs-6">👤 Equipo Depósito</span>
          </div>
        </div>
      </nav>

      <div className="container-fluid mt-4 flex-grow-1 px-4">
        <div className="row h-100">
          
          {/* PANEL LATERAL */}
          <div className="col-md-3">
            <div className="nav flex-column nav-pills" role="tablist">
              <button 
                className={`nav-link d-flex justify-content-between align-items-center shadow-sm mb-2 fw-bold ${tabActiva === 'RECEPCION' ? 'active' : 'bg-white text-dark'}`}
                onClick={() => setTabActiva('RECEPCION')}
                style={tabActiva === 'RECEPCION' ? { backgroundColor: colorBordo } : {}}
              >
                <span>📥 Recepción Proveedores</span>
                {itemsARecibir.length > 0 && <span className="badge bg-danger rounded-pill">{itemsARecibir.length}</span>}
              </button>
              <button 
                className={`nav-link d-flex justify-content-between align-items-center shadow-sm mb-2 fw-bold ${tabActiva === 'DESPACHOS' ? 'active' : 'bg-white text-dark'}`}
                onClick={() => setTabActiva('DESPACHOS')}
                style={tabActiva === 'DESPACHOS' ? { backgroundColor: colorBordo } : {}}
              >
                <span>📦 Armado y Envíos (Pueblos)</span>
                {despachos.length > 0 && <span className="badge bg-primary rounded-pill">{despachos.length}</span>}
              </button>
            </div>

            <div className="card border-0 shadow-sm mt-4 bg-white">
              <div className="card-body text-center">
                <h6 className="fw-bold text-muted mb-3">Herramientas Rápidas</h6>
                <button className="btn btn-outline-dark w-100 mb-2 fw-bold" onClick={() => alert('Conectando con impresora Zebra...')}>
                  🖨️ Imprimir Etiqueta Suelta
                </button>
                <button className="btn btn-outline-dark w-100 fw-bold" onClick={() => alert('Buscando artículo en el estante...')}>
                  🔍 Consultar Ubicación
                </button>
              </div>
            </div>
          </div>

          {/* PANEL CENTRAL */}
          <div className="col-md-9">
            
            {/* VISTA: RECEPCIÓN DE MERCADERÍA */}
            {tabActiva === 'RECEPCION' && (
              <div className="card border-0 shadow-sm h-100">
                <div className="card-header bg-white p-4 border-bottom d-flex justify-content-between align-items-center">
                  <div>
                    <h4 className="fw-bold mb-1 text-dark">Control de Mercadería Entrante</h4>
                    <span className="text-muted small">Validación física de bultos según pedidos en tránsito</span>
                  </div>
                  <div>
                    <button className="btn btn-dark fw-bold px-4 me-2" onClick={() => alert('Imprimiendo etiquetas Zebra para lote...')}>
                      🖨️ Imprimir Etiquetas
                    </button>
                    <button 
                      className="btn btn-success fw-bold px-4" 
                      onClick={finalizarRecepcion} 
                      disabled={itemsARecibir.length === 0 || procesando}
                    >
                      {procesando ? 'Procesando...' : '✅ Finalizar Control y Stockear'}
                    </button>
                  </div>
                </div>
                <div className="card-body p-0 overflow-auto" style={{ maxHeight: '65vh' }}>
                  <table className="table table-hover mb-0 align-middle">
                    <thead style={{ backgroundColor: colorGris, color: 'white' }}>
                      <tr>
                        <th width="15%" className="ps-4 py-3">Cód. / Dist.</th>
                        <th width="40%" className="py-3">Descripción del repuesto</th>
                        <th width="15%" className="text-center py-3">Esperada</th>
                        <th width="15%" className="text-center py-3">Física (Control)</th>
                        <th width="15%" className="text-center pe-4 py-3">Estado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {itemsARecibir.map((item) => {
                        const ingresado = inputsRecepcion[item.cod] ?? item.cant_en_camino;
                        const estado = obtenerEstadoCheck(item.cant_en_camino, ingresado);

                        return (
                          <tr key={item.cod} className="border-bottom">
                            <td className="ps-4 py-3">
                              <strong className="d-block font-monospace text-primary">{item.cod}</strong>
                              <span className="badge bg-light text-dark border border-secondary">{item.distribuidor}</span>
                            </td>
                            <td className="py-3 fw-semibold text-secondary">{item.desc}</td>
                            <td className="text-center fs-5 fw-bold text-dark">{item.cant_en_camino}</td>
                            <td className="text-center">
                              <input 
                                type="number" 
                                className={`form-control fw-bold fs-5 text-center mx-auto shadow-sm ${estado.clase}`} 
                                style={{ width: '80px' }} 
                                value={ingresado} 
                                onChange={(e) => manejarInputRecepcion(item.cod, e.target.value)} 
                              />
                            </td>
                            <td className="text-center pe-4">
                              <span className={`badge ${estado.badge}`}>{estado.texto}</span>
                            </td>
                          </tr>
                        );
                      })}
                      {itemsARecibir.length === 0 && (
                        <tr>
                          <td colSpan="5" className="text-center py-5 text-muted">
                            <span className="d-block fs-1 mb-2 opacity-25">📦</span>
                            No hay mercadería en tránsito pendiente de control.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* VISTA: DESPACHOS */}
            {tabActiva === 'DESPACHOS' && (
              <div>
                <h4 className="fw-bold mb-4 text-dark">Cola de Armado: Envíos y Comisionistas</h4>
                <div className="row g-3">
                  {despachos.map((despacho, index) => (
                    <div className="col-md-6" key={despacho.id}>
                      <div className="card shadow-sm h-100 p-3 bg-white" style={{ borderLeft: `5px solid #0d6efd` }}>
                        <div className="d-flex justify-content-between align-items-start mb-2">
                          <h5 className="fw-bold text-dark mb-0">{despacho.nombre}</h5>
                        </div>
                        <p className="text-muted small mb-3">
                          <strong>Detalle y Transporte:</strong><br />
                          {despacho.detalle}
                        </p>
                        <button 
                          className="btn btn-dark fw-bold w-100 mt-auto shadow-sm" 
                          onClick={() => setModalEnvio(despacho)}
                        >
                          📦 Armar y Generar Rótulo
                        </button>
                      </div>
                    </div>
                  ))}
                  {despachos.length === 0 && (
                    <div className="col-12">
                      <div className="alert alert-light border text-muted text-center py-5">
                         No hay despachos logísticos pendientes generados por el mostrador.
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

          </div>
        </div>
      </div>

      {/* MODAL DE DESPACHO */}
      {modalEnvio && (
        <div className="position-fixed top-0 start-0 w-100 h-100 bg-dark bg-opacity-75 d-flex justify-content-center align-items-center" style={{ zIndex: 2000 }}>
          <div className="card border-0 shadow-lg" style={{ width: '500px', borderRadius: '12px' }}>
            <div className="card-header bg-primary text-white d-flex justify-content-between align-items-center">
              <h5 className="modal-title fw-bold m-0">📦 Armado de Encomienda</h5>
              <button className="btn-close btn-close-white" onClick={() => setModalEnvio(null)}></button>
            </div>
            <div className="card-body p-4 bg-light">
              <h6 className="fw-bold text-dark mb-1">Cliente / Destino: {modalEnvio.nombre}</h6>
              <p className="text-muted small mb-4">{modalEnvio.detalle}</p>
              
              <div className="mb-3">
                <label className="form-label fw-bold small text-secondary">Bultos (Cajas):</label>
                <input type="number" className="form-control fw-bold font-monospace text-center w-25" defaultValue="1" />
              </div>
              
              <div className="form-check mb-3 mt-4 bg-white p-2 border rounded shadow-sm">
                <input className="form-check-input ms-2 me-3" type="checkbox" id="checkRotulo" defaultChecked style={{ transform: 'scale(1.2)' }} />
                <label className="form-check-label fw-bold" htmlFor="checkRotulo">
                  🖨️ Imprimir Rótulos de Envío (Zebra)
                </label>
              </div>
              <div className="form-check bg-white p-2 border rounded shadow-sm">
                <input className="form-check-input ms-2 me-3" type="checkbox" id="checkRemito" defaultChecked style={{ transform: 'scale(1.2)' }} />
                <label className="form-check-label fw-bold" htmlFor="checkRemito">
                  📄 Imprimir Remito de carga (A4)
                </label>
              </div>
            </div>
            <div className="card-footer bg-white d-flex justify-content-end gap-2">
              <button type="button" className="btn btn-outline-secondary fw-bold" onClick={() => setModalEnvio(null)}>Cancelar</button>
              <button type="button" className="btn btn-success fw-bold px-4" onClick={procesarEnvio}>Confirmar y Despachar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}