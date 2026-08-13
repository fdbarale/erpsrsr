import React, { useState, useEffect } from 'react';
import { dbOficial } from '../supabaseClient';

export default function Pedidos({ volverAlMenu }) {
  const [itemsPendientes, setItemsPendientes] = useState([]);
  const [tabActiva, setTabActiva] = useState('');
  const [procesando, setProcesando] = useState(false);
  const [cantidadesEdit, setCantidadesEdit] = useState({});

  const colorBordo = '#6B1116';
  const colorGris = '#54565b';

  const cargarPendientes = async () => {
    const { data, error } = await dbOficial
      .from('articulos')
      .select('*')
      .gt('cant_pendiente', 0);

    if (!error && data) {
      setItemsPendientes(data);
      
      // Agrupamos proveedores para setear la pestaña inicial
      const proveedores = [...new Set(data.map(item => item.distribuidor))];
      if (proveedores.length > 0 && !proveedores.includes(tabActiva)) {
        setTabActiva(proveedores[0]);
      }

      // Inicializamos el estado local de edición
      const initEdit = {};
      data.forEach(item => {
        initEdit[item.cod] = item.cant_pendiente;
      });
      setCantidadesEdit(initEdit);
    }
  };

  useEffect(() => {
    cargarPendientes();
  }, []);

  const agrupadosPorProveedor = itemsPendientes.reduce((acc, item) => {
    if (!acc[item.distribuidor]) acc[item.distribuidor] = [];
    acc[item.distribuidor].push(item);
    return acc;
  }, {});

  const proveedoresConPendientes = Object.keys(agrupadosPorProveedor);

  const manejarEdicionCantidad = (cod, valor) => {
    setCantidadesEdit(prev => ({ ...prev, [cod]: parseInt(valor) || 0 }));
  };

  const guardarCantidadEnNube = async (cod) => {
    const nuevaCant = cantidadesEdit[cod];
    const { error } = await dbOficial
      .from('articulos')
      .update({ cant_pendiente: nuevaCant })
      .eq('cod', cod);

    if (error) {
      alert("Error al actualizar la cantidad.");
      cargarPendientes(); // Revertimos al valor real
    }
  };

  const quitarDelBorrador = async (cod) => {
    const { error } = await dbOficial
      .from('articulos')
      .update({ cant_pendiente: 0 })
      .eq('cod', cod);

    if (!error) {
      cargarPendientes();
    }
  };

  const enviarPedido = async (proveedor) => {
    const itemsDelProveedor = agrupadosPorProveedor[proveedor];
    if (!itemsDelProveedor || itemsDelProveedor.length === 0) return;

    const confirmacion = window.confirm(`¿Estás seguro de enviar el pedido a ${proveedor}?\n\nLos ${itemsDelProveedor.length} artículos pasarán a estado "EN VIAJE" para ser recibidos por depósito.`);
    if (!confirmacion) return;

    setProcesando(true);

    try {
      const promesasUpdate = itemsDelProveedor.map(item => {
        // La cantidad a pedir pasa a estar "en camino", y el borrador se vacía
        const nuevoEnCamino = (item.cant_en_camino || 0) + (cantidadesEdit[item.cod] || item.cant_pendiente);
        return dbOficial.from('articulos').update({ 
          cant_en_camino: nuevoEnCamino,
          cant_pendiente: 0 
        }).eq('cod', item.cod);
      });

      await Promise.all(promesasUpdate);
      alert(`¡Pedido a ${proveedor} procesado con éxito!`);
      
      // Si era la última pestaña, blanqueamos
      if (proveedoresConPendientes.length === 1) {
        setTabActiva('');
      }
      
      cargarPendientes();
    } catch (error) {
      alert("Error crítico al procesar el pedido.");
      console.error(error);
    } finally {
      setProcesando(false);
    }
  };

  const generarExportacion = (formato) => {
    alert(`Generando ${formato}...\n(Esta función se enlazará a tu motor de reportes A4/Excel)`);
  };

  return (
    <div className="bg-light min-vh-100 d-flex flex-column" style={{ overflowX: 'hidden' }}>
      <nav className="navbar navbar-dark shadow-sm px-3" style={{ backgroundColor: colorBordo, borderBottom: `4px solid ${colorGris}` }}>
        <div className="container-fluid p-0">
          <div className="d-flex align-items-center">
            <button className="btn btn-sm btn-outline-light me-3 fw-bold" onClick={volverAlMenu}>
              ⬅ Volver al Menú
            </button>
            <span className="navbar-brand fw-bold m-0 tracking-wide">Gestión de Pedidos a Proveedores</span>
          </div>
          <div className="d-flex text-white align-items-center">
            <span className="badge bg-warning text-dark fw-bold fs-6 me-3">🛒 {itemsPendientes.length} Artículos en Borrador</span>
          </div>
        </div>
      </nav>

      <div className="container-fluid mt-4 flex-grow-1 px-4">
        <div className="row h-100">
          
          {/* PANEL LATERAL */}
          <div className="col-md-3">
            <div className="card border-0 shadow-sm mb-3 bg-white">
              <div class="card-body">
                <h6 className="fw-bold text-muted border-bottom pb-2">Resumen Operativo</h6>
                <ul className="list-group list-group-flush">
                  <li className="list-group-item d-flex justify-content-between align-items-center border-0 px-0">
                    <span className="small fw-bold">En Borrador (Sin pedir)</span>
                    <span className="badge bg-danger rounded-pill">{itemsPendientes.length}</span>
                  </li>
                  <li className="list-group-item d-flex justify-content-between align-items-center border-0 px-0">
                    <span className="small fw-bold text-muted">Distribuidores involucrados</span>
                    <span className="badge bg-secondary rounded-pill">{proveedoresConPendientes.length}</span>
                  </li>
                </ul>
              </div>
            </div>

            <div className="card border-0 shadow-sm bg-white">
              <div className="card-body">
                <h6 className="fw-bold text-muted border-bottom pb-2">Configuración Rápida</h6>
                <small className="text-muted d-block mb-3">Formato sugerido por proveedor para exportación.</small>
                
                <label className="fw-bold small">Warnes Repuestos:</label>
                <select className="form-select form-select-sm mb-2 fw-bold"><option>Solo Excel (.xlsx)</option><option>PDF y Email</option></select>
                
                <label className="fw-bold small">Distribuidora Sur:</label>
                <select className="form-select form-select-sm mb-2 fw-bold"><option>PDF y Email</option><option>Excel CSV</option></select>
              </div>
            </div>
          </div>

          {/* PANEL CENTRAL */}
          <div className="col-md-9">
            <div className="card border-0 shadow-sm h-100 bg-white">
              
              <div className="card-header bg-white pt-3 pb-0 border-0">
                <ul className="nav nav-tabs" role="tablist">
                  {proveedoresConPendientes.length === 0 && (
                    <li className="nav-item">
                      <button className="nav-link active fw-bold text-muted">Sin pedidos pendientes</button>
                    </li>
                  )}
                  {proveedoresConPendientes.map(prov => (
                    <li className="nav-item" key={prov}>
                      <button 
                        className={`nav-link fw-bold ${tabActiva === prov ? 'active text-bordo border-bottom border-3 border-danger' : 'text-secondary'}`}
                        onClick={() => setTabActiva(prov)}
                        style={tabActiva === prov ? { color: colorBordo, borderColor: colorBordo } : {}}
                      >
                        {prov} <span className="badge bg-danger ms-1">{agrupadosPorProveedor[prov].length}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
              
              <div className="card-body bg-light">
                {proveedoresConPendientes.length === 0 ? (
                  <div className="text-center py-5 text-muted">
                    <span className="d-block display-1 mb-3 opacity-25">📦</span>
                    <h5 className="fw-bold">Bandeja Limpia</h5>
                    <p>No hay artículos marcados para pedir. Utilizá la tecla `Insert` en el mostrador para ir armando borradores.</p>
                  </div>
                ) : (
                  <>
                    <div className="d-flex justify-content-between align-items-center mb-3 bg-white p-3 rounded shadow-sm border">
                      <h5 className="fw-bold mb-0 text-dark">Borrador actual: <span className="text-primary">{tabActiva}</span></h5>
                      
                      <div className="d-flex gap-2">
                        <button className="btn btn-outline-success btn-sm fw-bold shadow-sm" onClick={() => generarExportacion('Excel')}>
                          📊 Bajar Excel
                        </button>
                        <button className="btn btn-outline-danger btn-sm fw-bold shadow-sm" onClick={() => generarExportacion('PDF')}>
                          📄 Bajar PDF
                        </button>
                        <button 
                          className="btn btn-danger fw-bold shadow-sm px-4" 
                          onClick={() => enviarPedido(tabActiva)}
                          disabled={procesando}
                        >
                          {procesando ? 'Procesando...' : '📨 ENVIAR PEDIDO'}
                        </button>
                      </div>
                    </div>

                    <div className="overflow-auto border rounded bg-white shadow-sm" style={{ maxHeight: '55vh' }}>
                      <table className="table table-hover table-striped mb-0 align-middle">
                        <thead style={{ backgroundColor: colorGris, color: 'white' }}>
                          <tr>
                            <th width="15%" className="ps-3 py-3">Cód. Original</th>
                            <th width="15%" className="py-3">Cód. Interno</th>
                            <th width="40%" className="py-3">Descripción</th>
                            <th width="15%" className="text-center py-3">Cant. a Pedir</th>
                            <th width="15%" className="text-end pe-3 py-3">Acción</th>
                          </tr>
                        </thead>
                        <tbody>
                          {agrupadosPorProveedor[tabActiva]?.map((item) => (
                            <tr key={item.cod}>
                              <td className="align-middle fw-bold text-secondary font-monospace ps-3">{item.nro_original || '---'}</td>
                              <td className="align-middle fw-bold text-primary font-monospace">{item.cod}</td>
                              <td className="align-middle fw-semibold text-dark">
                                {item.desc}
                                {item.codigo_aux && <span className="badge bg-light text-dark border ms-2">Aux: {item.codigo_aux}</span>}
                              </td>
                              <td className="align-middle text-center">
                                <input 
                                  type="number" 
                                  className="form-control text-center fw-bold border-primary shadow-sm mx-auto" 
                                  style={{ maxWidth: '80px' }}
                                  value={cantidadesEdit[item.cod] ?? item.cant_pendiente} 
                                  onChange={(e) => manejarEdicionCantidad(item.cod, e.target.value)}
                                  onKeyDown={(e) => e.key === 'Enter' && guardarCantidadEnNube(item.cod)}
                                  onBlur={() => guardarCantidadEnNube(item.cod)}
                                />
                              </td>
                              <td className="align-middle text-end pe-3">
                                <button className="btn btn-sm btn-outline-danger fw-bold" onClick={() => quitarDelBorrador(item.cod)}>
                                  Quitar
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}