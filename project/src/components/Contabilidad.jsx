import React, { useState, useEffect } from 'react';
import { dbOficial, dbInterna } from '../supabaseClient';

export default function Contabilidad({ volverAlMenu }) {
  const [tabActiva, setTabActiva] = useState('tesoreria');
  const [mostrarCompensacion, setMostrarCompensacion] = useState(false);
  const [mostrarGasto, setMostrarGasto] = useState(false);
  const [procesando, setProcesando] = useState(false);

  // Estados financieros simulados (Acá luego conectaremos los SUM de Supabase)
  const [cajaOficial, setCajaOficial] = useState(4150000);
  const [cajaInterna, setCajaInterna] = useState(4500000);
  const [ivaVentas, setIvaVentas] = useState(1450000);
  const [ivaCompras, setIvaCompras] = useState(1120000);

  const colorBordo = '#6B1116';
  const colorGris = '#54565b';

  const formatoMoneda = (valor) => "$ " + Math.round(parseFloat(valor) || 0).toLocaleString('es-AR');

  const ejecutarCompensacion = () => {
    setProcesando(true);
    // Simulación de delay de red
    setTimeout(() => {
      alert('Transferencia asentada exitosamente.\nLos montos se descontaron del origen y se sumaron al destino en el acto.');
      setProcesando(false);
      setMostrarCompensacion(false);
    }, 800);
  };

  const guardarGasto = () => {
    setProcesando(true);
    setTimeout(() => {
      alert('Gasto cargado y descontado de la caja correspondiente.');
      setProcesando(false);
      setMostrarGasto(false);
    }, 800);
  };

  return (
    <div className="bg-light min-vh-100 d-flex flex-column" style={{ overflowX: 'hidden' }}>
      
      {/* NAVEGACIÓN SUPERIOR RESTRINGIDA */}
      <nav className="navbar navbar-dark shadow-sm px-3" style={{ backgroundColor: '#212529', borderBottom: `4px solid ${colorBordo}` }}>
        <div className="container-fluid p-0">
          <div className="d-flex align-items-center">
            <button className="btn btn-sm btn-outline-light me-3 fw-bold" onClick={volverAlMenu} tabIndex="-1">
              ⬅ Volver al Menú
            </button>
            <span className="navbar-brand fw-bold m-0 tracking-wide">Módulo Gerencial y Finanzas</span>
            <span className="badge bg-danger ms-3 fw-bold" style={{ letterSpacing: '1px' }}>🔒 ACCESO RESTRINGIDO</span>
          </div>
          <div className="d-flex text-white align-items-center">
            <span className="me-3 fs-6">👤 Admin: Fer / Guille</span>
          </div>
        </div>
      </nav>

      <div className="container-fluid mt-4 flex-grow-1 px-4 mb-5 pb-5">
        <div className="row h-100">
          
          {/* PANEL LATERAL */}
          <div className="col-md-3">
            <div className="nav flex-column nav-pills" role="tablist">
              <button 
                className={`nav-link d-flex justify-content-between align-items-center shadow-sm mb-2 fw-bold ${tabActiva === 'tesoreria' ? 'active' : 'bg-white text-secondary border'}`}
                onClick={() => setTabActiva('tesoreria')}
                style={tabActiva === 'tesoreria' ? { backgroundColor: '#212529', color: 'white', borderColor: '#212529' } : {}}
              >
                <span>💵 Cajas y Tesorería</span>
              </button>
              <button 
                className={`nav-link d-flex justify-content-between align-items-center shadow-sm mb-2 fw-bold ${tabActiva === 'impuestos' ? 'active' : 'bg-white text-secondary border'}`}
                onClick={() => setTabActiva('impuestos')}
                style={tabActiva === 'impuestos' ? { backgroundColor: '#212529', color: 'white', borderColor: '#212529' } : {}}
              >
                <span>📈 Termómetro Fiscal (IVA)</span>
              </button>
              <button 
                className={`nav-link d-flex justify-content-between align-items-center shadow-sm mb-2 fw-bold ${tabActiva === 'gastos' ? 'active' : 'bg-white text-secondary border'}`}
                onClick={() => setTabActiva('gastos')}
                style={tabActiva === 'gastos' ? { backgroundColor: '#212529', color: 'white', borderColor: '#212529' } : {}}
              >
                <span>🧾 Egresos y Gastos Fijos</span>
              </button>
            </div>

            <div className="card border-0 shadow-sm mt-4 bg-white">
              <div className="card-body text-center">
                <h6 className="fw-bold text-muted mb-3 border-bottom pb-2">Cierres Mensuales</h6>
                <button className="btn btn-outline-primary w-100 mb-2 fw-bold" onClick={() => alert('Generando archivos TXT para el liquidador de AFIP...')}>
                  📤 Exportar IVA Ventas/Compras
                </button>
                <button className="btn btn-outline-dark w-100 fw-bold" onClick={() => alert('Generando reporte en Excel...')}>
                  📊 Balance de Ganancias
                </button>
              </div>
            </div>
          </div>

          {/* PANEL CENTRAL */}
          <div className="col-md-9">
            <div className="tab-content h-100">
              
              {/* VISTA 1: CAJAS Y TESORERÍA */}
              {tabActiva === 'tesoreria' && (
                <div>
                  <div className="d-flex justify-content-between align-items-center mb-4">
                    <h4 className="fw-bold text-dark mb-0">Estado de Cajas en Vivo</h4>
                    <h5 className="fw-bold text-muted mb-0">Total General: <span className="text-dark">{formatoMoneda(cajaOficial + cajaInterna)}</span></h5>
                  </div>

                  <div className="row position-relative mb-4">
                    
                    {/* Caja Oficial */}
                    <div className="col-md-6 mb-3">
                      <div className="card shadow-sm h-100" style={{ borderRadius: '12px', border: '2px solid #198754' }}>
                        <div className="card-header p-3" style={{ backgroundColor: '#d1e7dd', color: '#0f5132', borderBottom: '2px solid #198754' }}>
                          <h5 className="fw-bold mb-0">🏛️ Caja Oficial (Blanco)</h5>
                        </div>
                        <div className="card-body bg-white rounded-bottom">
                          <div className="d-flex justify-content-between mb-2">
                            <span className="fw-bold text-muted">Efectivo Mostrador:</span>
                            <span className="fw-bold fs-5 font-monospace text-dark">$ 150.000</span>
                          </div>
                          <div className="d-flex justify-content-between mb-2">
                            <span className="fw-bold text-muted">Banco Pampa:</span>
                            <span className="fw-bold fs-5 font-monospace text-dark">$ 3.200.000</span>
                          </div>
                          <div className="d-flex justify-content-between mb-3 border-bottom pb-3">
                            <span className="fw-bold text-muted">MercadoPago Local:</span>
                            <span className="fw-bold fs-5 font-monospace text-dark">$ 800.000</span>
                          </div>
                          <div className="text-end mt-3">
                            <span className="text-muted small d-block fw-bold">Subtotal Oficial</span>
                            <h2 className="fw-bold text-success mb-0 font-monospace">{formatoMoneda(cajaOficial)}</h2>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Caja Interna */}
                    <div className="col-md-6 mb-3">
                      <div className="card shadow-sm h-100" style={{ borderRadius: '12px', border: '2px solid #ffc107' }}>
                        <div className="card-header p-3" style={{ backgroundColor: '#fff3cd', color: '#664d03', borderBottom: '2px solid #ffc107' }}>
                          <h5 className="fw-bold mb-0">🗄️ Caja Interna (Bóveda)</h5>
                        </div>
                        <div className="card-body bg-white rounded-bottom">
                          <div className="d-flex justify-content-between mb-2">
                            <span className="fw-bold text-muted">Efectivo Mostrador X:</span>
                            <span className="fw-bold fs-5 font-monospace text-dark">$ 850.000</span>
                          </div>
                          <div className="d-flex justify-content-between mb-2">
                            <span className="fw-bold text-muted">Fondo Dólares (Convertido):</span>
                            <span className="fw-bold fs-5 font-monospace text-dark">$ 3.650.000</span>
                          </div>
                          <div className="d-flex justify-content-between mb-3 border-bottom pb-3">
                            <span className="fw-bold text-muted">Cheques Terceros en Cartera:</span>
                            <span className="fw-bold fs-5 font-monospace text-dark">$ 0</span>
                          </div>
                          <div className="text-end mt-3">
                            <span className="text-muted small d-block fw-bold">Subtotal Interno</span>
                            <h2 className="fw-bold text-dark mb-0 font-monospace">{formatoMoneda(cajaInterna)}</h2>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Botón Puente de Cajas */}
                    <button 
                      className="btn btn-dark d-flex align-items-center justify-content-center shadow" 
                      title="Hacer Transferencia / Compensación entre cajas" 
                      onClick={() => setMostrarCompensacion(true)}
                      style={{ fontSize: '1.5rem', width: '60px', height: '60px', borderRadius: '50%', border: '3px solid white', zIndex: 10, position: 'absolute', left: '50%', top: '30%', transform: 'translate(-50%, -50%)' }}
                    >
                      ⇄
                    </button>
                  </div>

                  <h6 className="fw-bold text-muted mb-3">Últimos Movimientos Consolidados</h6>
                  <div className="overflow-auto border rounded bg-white shadow-sm" style={{ maxHeight: '40vh' }}>
                    <table className="table table-hover mb-0 align-middle">
                      <thead className="table-light sticky-top">
                        <tr>
                          <th width="15%" className="ps-3">Hora</th>
                          <th width="20%">Caja Afectada</th>
                          <th width="35%">Concepto / Detalle</th>
                          <th width="15%" className="text-success text-end">Ingreso</th>
                          <th width="15%" className="text-danger text-end pe-3">Egreso</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr className="border-bottom">
                          <td className="text-muted font-monospace ps-3">10:45 hs</td>
                          <td><span className="badge bg-success">Oficial - Banco</span></td>
                          <td className="fw-semibold text-secondary">Cobro Fra. A-0001 (Los Amigos)</td>
                          <td className="text-end fw-bold text-success font-monospace">$ 150.000</td>
                          <td className="text-end pe-3"></td>
                        </tr>
                        <tr className="table-warning border-bottom">
                          <td className="text-muted font-monospace ps-3">09:30 hs</td>
                          <td><span className="badge bg-dark">Interna - Efectivo</span></td>
                          <td className="fw-semibold text-dark">Seña por Encargue (Óptica Amarok)</td>
                          <td className="text-end fw-bold text-success font-monospace">$ 20.000</td>
                          <td className="text-end pe-3"></td>
                        </tr>
                        <tr>
                          <td className="text-muted font-monospace ps-3">08:15 hs</td>
                          <td><span className="badge bg-dark">Interna - Efectivo</span></td>
                          <td className="fw-semibold text-secondary">Pago Gasto Fijo: Panadería</td>
                          <td className="text-end"></td>
                          <td className="text-end fw-bold text-danger font-monospace pe-3">$ 4.500</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* VISTA 2: TERMÓMETRO FISCAL */}
              {tabActiva === 'impuestos' && (
                <div>
                  <div className="d-flex justify-content-between align-items-center mb-4">
                    <h4 className="fw-bold text-dark mb-0">Posición de IVA Actual (Mes en curso)</h4>
                    <span className="badge bg-secondary fs-6">Actualizado en tiempo real</span>
                  </div>

                  <div className="p-4 mb-4 shadow-sm" style={{ background: 'linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%)', borderRadius: '12px', borderLeft: '8px solid #0d6efd' }}>
                    <div className="row align-items-center">
                      <div className="col-md-4 border-end text-center">
                        <span className="fw-bold text-muted d-block mb-2 text-uppercase">IVA VENTAS (Débito Fiscal)</span>
                        <h3 className="text-danger mb-1 font-monospace fw-bold">{formatoMoneda(ivaVentas)}</h3>
                        <small className="text-muted">Cobrado a clientes</small>
                      </div>
                      <div className="col-md-4 border-end text-center">
                        <span className="fw-bold text-muted d-block mb-2 text-uppercase">IVA COMPRAS (Crédito Fiscal)</span>
                        <h3 className="text-success mb-1 font-monospace fw-bold">{formatoMoneda(ivaCompras)}</h3>
                        <small className="text-muted">Pagado a proveedores</small>
                      </div>
                      <div className="col-md-4 text-center">
                        <span className="fw-bold text-dark d-block mb-2 text-uppercase">SALDO TÉCNICO A PAGAR</span>
                        <h2 className="text-primary fw-bolder mb-1 font-monospace">{formatoMoneda(ivaVentas - ivaCompras)}</h2>
                      </div>
                    </div>
                  </div>

                  <div className="alert alert-warning border-warning shadow-sm">
                    <h6 className="fw-bold mb-2">⚠️ Alerta Fiscal Preventiva (IA)</h6>
                    <p className="mb-0 small text-dark">El saldo a pagar viene escalando. Sugerencia operativa: Si vas a confirmar el borrador de pedido a <strong>Warnes Repuestos</strong> hoy, exigí Factura A para generar crédito fiscal y achicar la brecha antes del cierre de mes.</p>
                  </div>
                </div>
              )}

              {/* VISTA 3: GASTOS FIJOS */}
              {tabActiva === 'gastos' && (
                <div>
                  <div className="d-flex justify-content-between align-items-center mb-4">
                    <h4 className="fw-bold text-dark mb-0">Registro de Gastos y Egresos</h4>
                    <button className="btn btn-primary fw-bold shadow-sm" onClick={() => setMostrarGasto(true)}>+ Cargar Nuevo Gasto</button>
                  </div>

                  <div className="row mb-4">
                    <div className="col-md-4">
                      <div className="card border-0 shadow-sm bg-white p-3 text-center" style={{ borderBottom: '4px solid #0d6efd' }}>
                        <span className="fw-bold text-muted small text-uppercase">Total Operativos (Mes)</span>
                        <h3 className="fw-bold text-dark mt-2 mb-0 font-monospace">$ 845.000</h3>
                      </div>
                    </div>
                  </div>

                  <div className="overflow-auto border rounded bg-white shadow-sm" style={{ maxHeight: '55vh' }}>
                    <table className="table table-hover mb-0 align-middle">
                      <thead className="table-light sticky-top">
                        <tr className="text-secondary">
                          <th width="15%" className="ps-3 py-3">Fecha</th>
                          <th width="20%" className="py-3">Categoría</th>
                          <th width="35%" className="py-3">Detalle / Comprobante</th>
                          <th width="15%" className="py-3">Caja Origen</th>
                          <th width="15%" className="text-end pe-3 py-3">Monto</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr className="border-bottom">
                          <td className="ps-3 font-monospace text-muted small">Hoy, 08:15</td>
                          <td><span className="badge bg-secondary">Comida / Viáticos</span></td>
                          <td className="fw-semibold text-dark">Panadería (Facturas desayuno)</td>
                          <td className="fw-bold text-muted small">Interna - Efvo</td>
                          <td className="text-end fw-bold text-danger font-monospace pe-3">$ 4.500</td>
                        </tr>
                        <tr className="border-bottom">
                          <td className="ps-3 font-monospace text-muted small">Ayer, 16:30</td>
                          <td><span className="badge bg-info text-dark">Logística / Fletes</span></td>
                          <td className="fw-semibold text-dark">Pago Vía Cargo a Macachín</td>
                          <td className="fw-bold text-muted small">Interna - Efvo</td>
                          <td className="text-end fw-bold text-danger font-monospace pe-3">$ 12.000</td>
                        </tr>
                        <tr>
                          <td className="ps-3 font-monospace text-muted small">10/08/2026</td>
                          <td><span className="badge bg-warning text-dark">Servicios Fijos</span></td>
                          <td className="fw-semibold text-dark">Factura Luz - CPE (Vto)</td>
                          <td className="fw-bold text-success small">Oficial - Banco</td>
                          <td className="text-end fw-bold text-danger font-monospace pe-3">$ 145.000</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

            </div>
          </div>
        </div>
      </div>

      {/* MODAL COMPENSACIÓN ENTRE CAJAS */}
      {mostrarCompensacion && (
        <div className="position-fixed top-0 start-0 w-100 h-100 bg-dark bg-opacity-75 d-flex justify-content-center align-items-center" style={{ zIndex: 2000 }}>
          <div className="card shadow-lg border-0" style={{ width: '500px', borderRadius: '12px' }}>
            <div className="card-header bg-dark text-white d-flex justify-content-between align-items-center">
              <h5 className="modal-title fw-bold m-0">⇄ Puente de Fondos</h5>
              <button className="btn-close btn-close-white" onClick={() => setMostrarCompensacion(false)}></button>
            </div>
            <div className="card-body p-4 bg-light">
              <p className="text-muted small mb-4">Utilizá esta función para asentar movimientos de dinero entre las cajas de la empresa (Ej: Retirar efectivo en negro para depositarlo en el banco blanco y cubrir un cheque).</p>
              
              <div className="row g-3 mb-3">
                <div className="col-6">
                  <label className="form-label fw-bold small text-secondary">Origen (Sale Plata)</label>
                  <select className="form-select fw-bold border-danger text-danger shadow-sm">
                    <option>Caja Interna (Efectivo Mostrador)</option>
                    <option>Caja Interna (Fondo Dólares)</option>
                    <option>Caja Oficial (Banco)</option>
                  </select>
                </div>
                <div className="col-6">
                  <label className="form-label fw-bold small text-secondary">Destino (Entra Plata)</label>
                  <select className="form-select fw-bold border-success text-success shadow-sm">
                    <option>Caja Oficial (Banco Pampa)</option>
                    <option>Caja Oficial (Efectivo Mostrador)</option>
                    <option>Caja Interna (Efectivo)</option>
                  </select>
                </div>
              </div>

              <div className="mb-3">
                <label className="form-label fw-bold small text-secondary">Monto a Transferir:</label>
                <div className="input-group input-group-lg shadow-sm">
                  <span className="input-group-text bg-white fw-bold">$</span>
                  <input type="number" className="form-control fw-bold font-monospace border-start-0" placeholder="0" />
                </div>
              </div>
              
              <div className="mb-2">
                <label className="form-label fw-bold small text-secondary">Detalle / Motivo interno:</label>
                <input type="text" className="form-control shadow-sm" placeholder="Ej: Depósito por cajero para cubrir cheque..." />
              </div>
            </div>
            <div className="card-footer bg-white d-flex justify-content-end gap-2 p-3">
              <button type="button" className="btn btn-outline-secondary fw-bold" onClick={() => setMostrarCompensacion(false)} disabled={procesando}>Cancelar</button>
              <button type="button" className="btn btn-dark fw-bold px-4" onClick={ejecutarCompensacion} disabled={procesando}>
                {procesando ? 'Procesando...' : 'Registrar Transferencia'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL NUEVO GASTO */}
      {mostrarGasto && (
        <div className="position-fixed top-0 start-0 w-100 h-100 bg-dark bg-opacity-75 d-flex justify-content-center align-items-center" style={{ zIndex: 2000 }}>
          <div className="card shadow-lg border-0" style={{ width: '550px', borderRadius: '12px' }}>
            <div className="card-header bg-primary text-white d-flex justify-content-between align-items-center">
              <h5 className="modal-title fw-bold m-0">🧾 Registrar Salida de Dinero</h5>
              <button className="btn-close btn-close-white" onClick={() => setMostrarGasto(false)}></button>
            </div>
            <div className="card-body p-4 bg-light">
              <div className="row g-3 mb-3">
                <div className="col-8">
                  <label className="form-label fw-bold small text-secondary">Categoría del Gasto</label>
                  <select className="form-select fw-bold shadow-sm">
                    <option>Servicios Fijos (Luz, Gas, Internet)</option>
                    <option>Logística / Fletes</option>
                    <option>Comida / Viáticos diarios</option>
                    <option>Sueldos / Adelantos</option>
                    <option>Impuestos / AFIP / Rentas</option>
                  </select>
                </div>
                <div className="col-4">
                  <label className="form-label fw-bold small text-secondary">Monto Total</label>
                  <div className="input-group shadow-sm">
                    <span className="input-group-text bg-white border-end-0 fw-bold text-danger">$</span>
                    <input type="number" className="form-control text-danger fw-bold font-monospace border-start-0 px-1" placeholder="0" />
                  </div>
                </div>
              </div>
              
              <div className="mb-3">
                <label className="form-label fw-bold small text-secondary">Detalle exacto</label>
                <input type="text" className="form-control shadow-sm" placeholder="Ej: Factura de Camuzzi, Flete a Gral Acha..." />
              </div>

              <div className="mb-2">
                <label className="form-label fw-bold small text-secondary">¿De qué caja se pagó?</label>
                <select className="form-select fw-bold border-dark shadow-sm">
                  <option>Caja Interna (Efectivo Mostrador)</option>
                  <option>Caja Oficial (Transferencia Banco)</option>
                  <option>MercadoPago Local</option>
                </select>
              </div>
            </div>
            <div className="card-footer bg-white d-flex justify-content-end gap-2 p-3">
              <button type="button" className="btn btn-outline-secondary fw-bold" onClick={() => setMostrarGasto(false)} disabled={procesando}>Cancelar</button>
              <button type="button" className="btn btn-primary fw-bold px-4" onClick={guardarGasto} disabled={procesando}>
                {procesando ? 'Procesando...' : 'Cargar y Descontar de Caja'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}