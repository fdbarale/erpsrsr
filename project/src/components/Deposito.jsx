import React, { useState, useEffect } from 'react';

export default function Deposito({
  baseDatos,
  setBaseDatos,
  despachos,
  setDespachos,
  volverAlMenu,
}) {
  const [tabActiva, setTabActiva] = useState('RECEPCION');
  const [inputsRecepcion, setInputsRecepcion] = useState({});
  const [modalEnvio, setModalEnvio] = useState(null);

  const colorBordo = '#6B1116';
  const colorGris = '#54565b';

  const itemsARecibir = baseDatos.filter((item) => item.cant_en_camino > 0);

  useEffect(() => {
    const valoresIniciales = {};
    itemsARecibir.forEach((item) => {
      if (inputsRecepcion[item.cod] === undefined) {
        valoresIniciales[item.cod] = item.cant_en_camino;
      }
    });
    if (Object.keys(valoresIniciales).length > 0) {
      setInputsRecepcion((prev) => ({ ...prev, ...valoresIniciales }));
    }
  }, [itemsARecibir]);

  const manejarInputRecepcion = (cod, valor) => {
    setInputsRecepcion((prev) => ({ ...prev, [cod]: parseInt(valor) || 0 }));
  };

  const obtenerEstadoCheck = (esperado, ingresado) => {
    if (ingresado === esperado)
      return {
        clase: 'border-success bg-success bg-opacity-10 text-success',
        badge: 'bg-success',
        texto: 'OK',
      };
    if (ingresado < esperado)
      return {
        clase: 'border-danger bg-danger bg-opacity-10 text-danger',
        badge: 'bg-danger',
        texto: `Faltan ${esperado - ingresado}`,
      };
    return {
      clase: 'border-warning bg-warning bg-opacity-10 text-dark',
      badge: 'bg-warning text-dark',
      texto: `Sobran ${ingresado - esperado}`,
    };
  };

  const finalizarRecepcion = () => {
    if (itemsARecibir.length === 0) return;
    setBaseDatos((prevBase) =>
      prevBase.map((item) => {
        if (item.cant_en_camino > 0) {
          const cantidadIngresada =
            inputsRecepcion[item.cod] ?? item.cant_en_camino;
          return {
            ...item,
            stock: item.stock + cantidadIngresada,
            cant_en_camino: Math.max(
              0,
              item.cant_en_camino - cantidadIngresada
            ),
          };
        }
        return item;
      })
    );
    setInputsRecepcion({});
    alert('Recepción Finalizada. Stock actualizado en mostrador.');
  };

  const abrirModalEnvio = (despacho) => setModalEnvio(despacho);

  const procesarEnvio = () => {
    setDespachos((prev) => prev.filter((d) => d.id !== modalEnvio.id));
    setModalEnvio(null);
    alert('¡Bulto cerrado y listado de envíos actualizado!');
  };

  return (
    <div
      className="bg-light min-vh-100 d-flex flex-column"
      style={{ overflowX: 'hidden' }}
    >
      <nav
        className="navbar navbar-dark shadow-sm px-3"
        style={{
          backgroundColor: colorBordo,
          borderBottom: `4px solid ${colorGris}`,
        }}
      >
        <div className="container-fluid p-0">
          <div className="d-flex align-items-center">
            <button
              className="btn btn-sm btn-outline-light me-3 fw-bold"
              onClick={volverAlMenu}
            >
              🏠 Volver al Menú
            </button>
            <span className="navbar-brand fw-bold m-0">
              Depósito y Logística
            </span>
          </div>
          <div className="d-flex text-white align-items-center">
            {itemsARecibir.length > 0 && (
              <span className="badge bg-warning text-dark fw-bold fs-6 me-3">
                🚚 Proveedores pendientes
              </span>
            )}
            <span className="me-3">👤 Equipo Depósito</span>
          </div>
        </div>
      </nav>

      <div className="container-fluid mt-4 flex-grow-1">
        <div className="row h-100">
          <div className="col-md-3">
            <div className="nav flex-column nav-pills" role="tablist">
              <button
                className={`nav-link d-flex justify-content-between align-items-center shadow-sm mb-2 fw-bold text-start border ${
                  tabActiva === 'RECEPCION' ? 'active' : 'bg-white text-dark'
                }`}
                style={
                  tabActiva === 'RECEPCION'
                    ? { backgroundColor: colorBordo }
                    : {}
                }
                onClick={() => setTabActiva('RECEPCION')}
              >
                <span>📥 Recepción Proveedores</span>
                {itemsARecibir.length > 0 && (
                  <span className="badge bg-danger rounded-pill">
                    {itemsARecibir.length}
                  </span>
                )}
              </button>
              <button
                className={`nav-link d-flex justify-content-between align-items-center shadow-sm mb-2 fw-bold text-start border ${
                  tabActiva === 'DESPACHOS' ? 'active' : 'bg-white text-dark'
                }`}
                style={
                  tabActiva === 'DESPACHOS'
                    ? { backgroundColor: colorBordo }
                    : {}
                }
                onClick={() => setTabActiva('DESPACHOS')}
              >
                <span>📦 Armado y Envíos</span>
                {despachos?.length > 0 && (
                  <span className="badge bg-primary rounded-pill">
                    {despachos.length}
                  </span>
                )}
              </button>
              <button
                className={`nav-link d-flex justify-content-between align-items-center shadow-sm mb-2 fw-bold text-start border ${
                  tabActiva === 'ENCARGUES' ? 'active' : 'bg-white text-dark'
                }`}
                style={
                  tabActiva === 'ENCARGUES'
                    ? { backgroundColor: colorBordo }
                    : {}
                }
                onClick={() => setTabActiva('ENCARGUES')}
              >
                <span>🛒 Estantería Encargues</span>
              </button>
            </div>
            <div className="card border-0 shadow-sm mt-4 bg-white">
              <div className="card-body text-center">
                <h6 className="fw-bold text-muted mb-3">
                  Herramientas Rápidas
                </h6>
                <button
                  className="btn btn-outline-dark w-100 mb-2 fw-bold"
                  onClick={() => alert('Integración con Zebra pendiente')}
                >
                  🖨️ Imprimir Etiqueta
                </button>
                <button
                  className="btn btn-outline-dark w-100 fw-bold"
                  onClick={() => alert('Buscador de estanterías en desarrollo')}
                >
                  🔍 Consultar Ubicación
                </button>
              </div>
            </div>
          </div>

          <div className="col-md-9">
            {tabActiva === 'RECEPCION' && (
              <div className="card border-0 shadow-sm h-100">
                <div className="card-header bg-white p-4 border-bottom d-flex justify-content-between align-items-center">
                  <div>
                    <h4 className="fw-bold mb-1">
                      Control de Mercadería Entrante
                    </h4>
                    <span className="text-muted small">
                      Validación física de bultos
                    </span>
                  </div>
                  <div>
                    <button
                      className="btn btn-success fw-bold px-4"
                      onClick={finalizarRecepcion}
                      disabled={itemsARecibir.length === 0}
                    >
                      ✅ Finalizar Control y Stockear
                    </button>
                  </div>
                </div>
                <div
                  className="card-body p-0 overflow-auto"
                  style={{ maxHeight: '60vh' }}
                >
                  <table className="table table-hover mb-0 align-middle">
                    <thead
                      style={{ backgroundColor: colorGris, color: 'white' }}
                    >
                      <tr>
                        <th width="15%" className="ps-3 py-3">
                          Cód. / Dist.
                        </th>
                        <th width="40%" className="py-3">
                          Descripción del repuesto
                        </th>
                        <th width="15%" className="text-center py-3">
                          Pedida
                        </th>
                        <th width="15%" className="text-center py-3">
                          Físico
                        </th>
                        <th width="15%" className="text-center pe-3 py-3">
                          Estado
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {itemsARecibir.map((item) => {
                        const ingresado =
                          inputsRecepcion[item.cod] ?? item.cant_en_camino;
                        const estado = obtenerEstadoCheck(
                          item.cant_en_camino,
                          ingresado
                        );
                        return (
                          <tr key={item.cod} className="border-bottom">
                            <td className="ps-3 py-3">
                              <strong className="d-block font-monospace">
                                {item.cod}
                              </strong>
                              <span className="badge bg-dark bg-opacity-10 text-dark border">
                                {item.distribuidor}
                              </span>
                            </td>
                            <td className="py-3 fw-bold text-secondary">
                              {item.desc}
                            </td>
                            <td className="text-center fs-5 fw-bold text-dark">
                              {item.cant_en_camino}
                            </td>
                            <td className="text-center">
                              <input
                                type="number"
                                className={`form-control fw-bold fs-5 text-center mx-auto shadow-sm border-2 ${estado.clase}`}
                                style={{ width: '80px' }}
                                value={ingresado}
                                onChange={(e) =>
                                  manejarInputRecepcion(
                                    item.cod,
                                    e.target.value
                                  )
                                }
                              />
                            </td>
                            <td className="text-center pe-3">
                              <span className={`badge ${estado.badge}`}>
                                {estado.texto}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                      {itemsARecibir.length === 0 && (
                        <tr>
                          <td
                            colSpan="5"
                            className="text-center py-5 text-muted"
                          >
                            No hay mercadería en tránsito en este momento.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {tabActiva === 'DESPACHOS' && (
              <div>
                <h4 className="fw-bold mb-4 text-dark">
                  Cola de Armado: Envíos a Pueblos
                </h4>
                <div className="row g-3">
                  {despachos?.map((despacho, index) => (
                    <div className="col-md-6" key={despacho.id}>
                      <div
                        className="card shadow-sm h-100 p-3 bg-white"
                        style={{
                          borderLeft: `5px solid ${
                            index % 2 === 0 ? '#0d6efd' : '#fd7e14'
                          }`,
                        }}
                      >
                        <div className="d-flex justify-content-between align-items-start mb-2">
                          <h6 className="fw-bold text-dark mb-0">
                            {despacho.nombre}
                          </h6>
                        </div>
                        <p className="text-muted small mb-3">
                          <strong>Detalle:</strong>
                          <br />
                          {despacho.detalle}
                        </p>
                        <button
                          className="btn btn-dark fw-bold w-100 mt-auto"
                          onClick={() => abrirModalEnvio(despacho)}
                        >
                          📦 Armar y Generar Rótulo
                        </button>
                      </div>
                    </div>
                  ))}
                  {(!despachos || despachos.length === 0) && (
                    <div className="col-12 text-muted">
                      No hay despachos generados en espera.
                    </div>
                  )}
                </div>
              </div>
            )}

            {tabActiva === 'ENCARGUES' && (
              <div className="text-center py-5">
                <h1 className="display-1 text-muted opacity-50">🛒</h1>
                <h4 className="fw-bold mt-3 text-muted">
                  Canastos de Encargues
                </h4>
                <p className="text-muted">
                  Área de reservas. Módulo dependiente de vinculación con señas
                  contables.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* MODAL DE DESPACHO */}
      {modalEnvio && (
        <div
          className="modal d-block"
          style={{ backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 1050 }}
        >
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content border-0 shadow-lg">
              <div className="modal-header bg-dark text-white">
                <h6 className="modal-title fw-bold">📦 Armar Encomienda</h6>
              </div>
              <div className="modal-body p-4 bg-light">
                <h6 className="fw-bold text-dark mb-1">
                  Cliente / Destino: {modalEnvio.nombre}
                </h6>
                <p className="text-muted small mb-4">{modalEnvio.detalle}</p>
                <div className="mb-3">
                  <label className="form-label fw-bold small text-secondary">
                    Bultos (Cajas):
                  </label>
                  <input
                    type="number"
                    className="form-control fw-bold font-monospace"
                    defaultValue="1"
                  />
                </div>
                <div className="form-check mb-2 mt-4">
                  <input
                    className="form-check-input border-dark"
                    type="checkbox"
                    id="checkRotulo"
                    defaultChecked
                  />
                  <label className="form-check-label fw-bold small">
                    🖨️ Rótulo (Ticketera)
                  </label>
                </div>
                <div className="form-check">
                  <input
                    className="form-check-input border-dark"
                    type="checkbox"
                    id="checkRemito"
                    defaultChecked
                  />
                  <label className="form-check-label fw-bold small">
                    📄 Remito (A4)
                  </label>
                </div>
              </div>
              <div className="modal-footer bg-white">
                <button
                  type="button"
                  className="btn btn-outline-secondary fw-bold"
                  onClick={() => setModalEnvio(null)}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  className="btn btn-success fw-bold px-4"
                  onClick={procesarEnvio}
                >
                  Confirmar y Despachar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
