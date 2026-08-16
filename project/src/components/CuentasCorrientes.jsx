import React, { useState, useEffect } from 'react';
import { dbOficial, dbParda } from '../supabaseClient'; 

export default function CuentasCorrientes({ onLevantarComprobante, volverAlMenu }) {
  const [busqueda, setBusqueda] = useState('');
  const [clienteSeleccionado, setClienteSeleccionado] = useState(null);
  const [clientesCtaCte, setClientesCtaCte] = useState([]);

  // === MODO VISTA: OFICIAL -> PARDO -> DUAL ===
  const [modoVista, setModoVista] = useState('OFICIAL');

  const colorBordo = '#6B1116';
  const colorGris = '#54565b';
  const colorPardo = '#212529'; 

  // === EFECTO DE ARRANQUE ===
  useEffect(() => {
    const cargarCuentas = async () => {
      const { data: clientesDB } = await dbOficial.from('clientes').select('*');
      const { data: movimientosDB } = await dbOficial.from('movimientos_cc').select('*');

      if (clientesDB && movimientosDB) {
        const clientesArmados = clientesDB.map(cliente => ({
          ...cliente,
          historial: movimientosDB.filter(mov => mov.cliente_id === cliente.id)
        }));
        setClientesCtaCte(clientesArmados);
      }
    };
    cargarCuentas();
  }, []);

  const [pagoEfectivo, setPagoEfectivo] = useState('');
  const [pagoTransferencia, setPagoTransferencia] = useState('');
  const [pagoMercadoPago, setPagoMercadoPago] = useState('');
  const [pagoBilletera, setPagoBilletera] = useState('');

  const [listaCheques, setListaCheques] = useState([]);
  const [datosChequeAux, setDatosChequeAux] = useState({ banco: '', nro: '', vencimiento: '', firmante: '', monto: '' });
  
  const [esPagoTercero, setEsPagoTercero] = useState(false);
  const [montoComision, setMontoComision] = useState('');

  const formatoVista = (valor) => "$ " + Math.round(parseFloat(valor) || 0).toLocaleString('es-AR');

  // === ACTIVADOR SECRETO ===
  const toggleModoVista = (e) => {
    if (e.ctrlKey) {
      if (modoVista === 'OFICIAL') setModoVista('PARDO');
      else if (modoVista === 'PARDO') setModoVista('DUAL');
      else setModoVista('OFICIAL');
    }
  };

  const clientesFiltrados = clientesCtaCte.filter(c => 
    c.nombre.toLowerCase().includes(busqueda.toLowerCase()) || (c.cuit && c.cuit.includes(busqueda))
  );

  // Filtramos el historial del cliente según el modo en el que estamos
  const historialVisible = clienteSeleccionado?.historial.filter(h => {
    if (modoVista === 'OFICIAL') return h.fiscal;
    if (modoVista === 'PARDO') return !h.fiscal;
    return true; // DUAL
  }) || [];

  const toggleTilde = (comprobanteId) => {
    const historialAct = clienteSeleccionado.historial.map(h => 
      h.id === comprobanteId ? { ...h, tildado: !h.tildado } : h
    );
    setClienteSeleccionado({ ...clienteSeleccionado, historial: historialAct });
  };

  const sumaTildada = historialVisible
    .filter(h => h.tildado)
    .reduce((acc, h) => acc + Number(h.monto), 0) || 0;

  const totalCheques = listaCheques.reduce((acc, chq) => acc + chq.monto, 0);

  const agregarCheque = () => {
    const montoNum = Math.round(parseFloat(datosChequeAux.monto));
    if (!datosChequeAux.banco || !datosChequeAux.nro || !montoNum || montoNum <= 0) {
      alert("Por favor, complete Banco, Número y Monto para registrar el cheque en caja.");
      return;
    }
    setListaCheques([...listaCheques, { ...datosChequeAux, id: Date.now(), monto: montoNum }]);
    setDatosChequeAux({ banco: '', nro: '', vencimiento: '', firmante: '', monto: '' });
  };

  const eliminarCheque = (id) => setListaCheques(listaCheques.filter(chq => chq.id !== id));

  const procesarLevantarAFacturar = () => {
    const comprobantesTildados = historialVisible.filter(h => h.tildado && !h.fiscal);
    if (comprobantesTildados.length === 0) { alert("Tilde primero los remitos internos (X) que desea levantar para facturar."); return; }

    let articulosAcumulados = [];
    comprobantesTildados.forEach(comp => { if (comp.articulos && comp.articulos.length > 0) articulosAcumulados = [...articulosAcumulados, ...comp.articulos]; });

    if (articulosAcumulados.length === 0) { alert("Los comprobantes seleccionados no tienen repuestos detallados cargados."); return; }

    const comision = Math.round(parseFloat(montoComision)) || 0;
    let nuevaBilletera = clienteSeleccionado.saldo_billetera_negro + comision;

    let historialLimpio = clienteSeleccionado.historial.filter(h => !h.tildado);
    let deudasMataInterno = comprobantesTildados.reduce((acc, h) => acc + Number(h.monto), 0);
    let nuevoSaldoInterno = Math.max(0, clienteSeleccionado.saldo_interno - deudasMataInterno);

    setClientesCtaCte(prev => prev.map(c => {
      if (c.id === clienteSeleccionado.id) return { ...c, saldo_interno: nuevoSaldoInterno, saldo_billetera_negro: nuevaBilletera, historial: historialLimpio };
      return c;
    }));

    onLevantarComprobante(articulosAcumulados);
  };

  const ejecutarCobroCombinado = async () => {
    const efe = Math.round(parseFloat(pagoEfectivo)) || 0;
    const trans = Math.round(parseFloat(pagoTransferencia)) || 0;
    const mp = Math.round(parseFloat(pagoMercadoPago)) || 0;
    const bill = Math.round(parseFloat(pagoBilletera)) || 0;
    const comision = Math.round(parseFloat(montoComision)) || 0;

    const totalIngresado = efe + trans + mp + bill + totalCheques;

    if (totalIngresado <= 0) { alert("Ingrese un importe en al menos uno de los medios de pago simultáneos."); return; }
    if (bill > clienteSeleccionado.saldo_billetera_negro) { alert("Saldo insuficiente en Billetera Virtual para aplicar ese cobro."); return; }
    if (sumaTildada <= 0) { alert("Tilde en la tabla superior qué facturas se están pagando con este dinero."); return; }

    let remanenteSobrante = 0;
    if (totalIngresado > sumaTildada) remanenteSobrante = totalIngresado - sumaTildada;

    let nuevaBilletera = clienteSeleccionado.saldo_billetera_negro - bill + remanenteSobrante + comision;

    // Solo cobramos las que están visibles y tildadas
    let deudasMataFiscal = historialVisible.filter(h => h.tildado && h.fiscal).reduce((acc, h) => acc + Number(h.monto), 0);
    let deudasMataInterno = historialVisible.filter(h => h.tildado && !h.fiscal).reduce((acc, h) => acc + Number(h.monto), 0);

    let nuevoSaldoFiscal = Math.max(0, clienteSeleccionado.saldo_fiscal - deudasMataFiscal);
    let nuevoSaldoInterno = Math.max(0, clienteSeleccionado.saldo_interno - deudasMataInterno);
    
    // Dejamos en el historial las que no se tildaron (incluyendo las ocultas que no estaban visibles)
    let nuevoHistorial = clienteSeleccionado.historial.filter(h => !(historialVisible.includes(h) && h.tildado));

    try {
      // 1. Pegamos en la base Oficial
      const { error: errorOficial } = await dbOficial
        .from('clientes')
        .update({ 
          saldo_fiscal: nuevoSaldoFiscal, 
          saldo_billetera_negro: nuevaBilletera 
        })
        .eq('id', clienteSeleccionado.id);

      if (errorOficial) throw new Error("Fallo en Base Oficial: " + errorOficial.message);

      // 2. Pegamos en la base Parda (Corregido de dbInterna a dbParda)
      const { error: errorInterna } = await dbParda
        .from('clientes')
        .update({ 
          saldo_interno: nuevoSaldoInterno 
        })
        .eq('id', clienteSeleccionado.id);

      if (errorInterna) throw new Error("Fallo en Base Parda: " + errorInterna.message);

      // 3. Actualizamos vista
      setClientesCtaCte(prev => prev.map(c => {
        if (c.id === clienteSeleccionado.id) return { ...c, saldo_fiscal: nuevoSaldoFiscal, saldo_interno: nuevoSaldoInterno, saldo_billetera_negro: nuevaBilletera, historial: nuevoHistorial };
        return c;
      }));

      setClienteSeleccionado({ 
        ...clienteSeleccionado, 
        saldo_fiscal: nuevoSaldoFiscal, 
        saldo_interno: nuevoSaldoInterno, 
        saldo_billetera_negro: nuevaBilletera, 
        historial: nuevoHistorial 
      });

      setPagoEfectivo(''); setPagoTransferencia(''); setPagoMercadoPago(''); setPagoBilletera(''); setMontoComision(''); setListaCheques([]);
      
      alert(`¡Cobro Combinado Procesado!\n* Deuda liquidada en bases de datos.\n* Comisión e importes remanentes asentados en la billetera.`);

    } catch (error) {
      alert("Error crítico al guardar en la nube:\n" + error.message);
    }
  };

  // Lógica visual para la barra de navegación
  const obtenerFondoNav = () => {
    if (modoVista === 'OFICIAL') return colorBordo;
    if (modoVista === 'PARDO') return colorPardo;
    if (modoVista === 'DUAL') return `linear-gradient(90deg, ${colorBordo} 50%, ${colorPardo} 50%)`;
  };

  const obtenerTituloNav = () => {
    if (modoVista === 'OFICIAL') return 'Cuentas Corrientes (Oficial)';
    if (modoVista === 'PARDO') return 'Libreta Interna (Sombra)';
    if (modoVista === 'DUAL') return 'Cuentas Corrientes Consolidadas';
  };

  return (
    <div className="bg-light min-vh-100 d-flex flex-column" style={{ overflowX: 'hidden' }}>
      
      {/* NAV DINÁMICO RSR */}
      <nav className="navbar navbar-dark shadow-sm px-3 transition-colors" style={{ background: obtenerFondoNav(), borderBottom: `4px solid ${modoVista !== 'OFICIAL' ? '#000' : colorGris}`, transition: 'background 0.3s ease' }}>
        <div className="container-fluid p-0">
          <div className="d-flex align-items-center">
            <button className="btn btn-sm btn-outline-light me-3 fw-bold" onClick={volverAlMenu} tabIndex="-1">
              ⬅ Volver al Menú
            </button>
            <span 
              className="navbar-brand fw-bold m-0 tracking-wide cursor-pointer user-select-none" 
              onClick={toggleModoVista}
              style={{ cursor: 'pointer' }}
              title="Cambiar Vista"
            >
              {obtenerTituloNav()}
            </span>
          </div>
          <div className="d-flex text-white align-items-center">
            <span className="me-3 fs-6">👤 Equipo RSR</span>
          </div>
        </div>
      </nav>

      <div className="container-fluid px-4 mt-3 flex-grow-1 d-flex flex-column mb-5 pb-5">
        
        {/* ENCABEZADO Y CONTROLES */}
        <div className="d-flex justify-content-between align-items-center border-bottom pb-2 mb-3 bg-white p-3 rounded shadow-sm">
          <div>
            <h5 className="fw-bold text-dark m-0">Liquidación y Billetera Modular</h5>
            <p className="text-muted small m-0">Cobro simultáneo multi-canal y pasarela de remitos a facturación oficial</p>
          </div>
          <div className="d-flex gap-3 align-items-center">
            <button className="btn btn-dark fw-bold shadow-sm" onClick={() => alert('Recordá habilitar el AltaClienteModal.jsx para usar esto.')}>
              + Nuevo Cliente
            </button>
          </div>
        </div>

        <div className="row flex-grow-1">
          {/* LISTADO DE CLIENTES */}
          <div className="col-lg-3 border-end pe-3">
            <input type="text" className="form-control mb-3 shadow-sm" placeholder="🔍 Buscar CUIT o Nombre..." value={busqueda} onChange={e => setBusqueda(e.target.value)} />
            <div className="list-group border rounded overflow-auto shadow-sm bg-white" style={{maxHeight:'70vh'}}>
              {clientesFiltrados.map(c => (
                <button key={c.id} onClick={() => setClienteSeleccionado(c)} className={`list-group-item list-group-item-action p-3 text-start ${clienteSeleccionado?.id === c.id ? 'active' : ''}`}>
                  <div className={`fw-bold ${clienteSeleccionado?.id === c.id ? 'text-white' : 'text-dark'}`}>{c.nombre}</div>
                  <div className="d-flex flex-column mt-2">
                    {(modoVista === 'OFICIAL' || modoVista === 'DUAL') && (
                      <span className={`small ${clienteSeleccionado?.id === c.id ? 'text-light' : 'text-muted'}`}>
                        Deuda Oficial: {formatoVista(c.saldo_fiscal)}
                      </span>
                    )}
                    {(modoVista === 'PARDO' || modoVista === 'DUAL') && (
                      <>
                        <span className={`small fw-bold ${clienteSeleccionado?.id === c.id ? 'text-white' : 'text-danger'}`}>
                          Deuda (X): {formatoVista(c.saldo_interno)}
                        </span>
                        <span className={`small fw-bold ${clienteSeleccionado?.id === c.id ? 'text-white' : 'text-success'}`}>
                          Billetera: {formatoVista(c.saldo_billetera_negro)}
                        </span>
                      </>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* AREA CENTRAL DE COBRO */}
          <div className="col-lg-9 ps-3 d-flex flex-column">
            {clienteSeleccionado ? (
              <div className="d-flex flex-column h-100">
                
                {/* TARJETAS DE SALDOS DINÁMICAS */}
                <div className="row g-2 mb-3">
                  {(modoVista === 'OFICIAL' || modoVista === 'DUAL') && (
                    <div className={modoVista === 'DUAL' ? 'col-4' : 'col-6'}>
                      <div className="card bg-dark text-white p-3 border-0 text-center rounded-3 shadow-sm">
                        <h3 className="m-0 font-monospace">{formatoVista(clienteSeleccionado.saldo_fiscal)}</h3>
                        <span className="small text-uppercase opacity-75 fw-bold" style={{fontSize:'11px'}}>Deuda Fiscal Oficial</span>
                      </div>
                    </div>
                  )}
                  {(modoVista === 'PARDO' || modoVista === 'DUAL') && (
                    <div className={modoVista === 'DUAL' ? 'col-4' : 'col-6'}>
                      <div className="card bg-secondary text-white p-3 border-0 text-center rounded-3 shadow-sm">
                        <h3 className="m-0 font-monospace">{formatoVista(clienteSeleccionado.saldo_interno)}</h3>
                        <span className="small text-uppercase opacity-75 fw-bold" style={{fontSize:'11px'}}>Deuda Interna Oculta (X)</span>
                      </div>
                    </div>
                  )}
                  {(modoVista === 'PARDO' || modoVista === 'DUAL') && (
                    <div className={modoVista === 'DUAL' ? 'col-4' : 'col-12'}>
                      <div className="card bg-success bg-opacity-10 text-success p-3 border border-success border-opacity-25 text-center rounded-3 shadow-sm">
                        <h3 className="m-0 font-monospace text-success">{formatoVista(clienteSeleccionado.saldo_billetera_negro)}</h3>
                        <span className="small text-uppercase text-success fw-bold" style={{fontSize:'11px'}}>Billetera Virtual (A favor)</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* TABLA DE DEUDAS FILTRADA */}
                <div className="flex-grow-1 border rounded bg-white overflow-auto shadow-sm mb-3" style={{maxHeight:'30vh', minHeight:'20vh'}}>
                  <table className="table table-hover mb-0 align-middle">
                    <thead className="table-dark sticky-top">
                      <tr>
                        <th width="40" className="text-center">✔</th>
                        <th>Fecha</th>
                        <th>Comprobante</th>
                        <th>Detalle Artículos</th>
                        <th className="text-end pe-4">Monto</th>
                      </tr>
                    </thead>
                    <tbody>
                      {historialVisible.map((h) => (
                        <tr key={h.id} onClick={() => toggleTilde(h.id)} style={{cursor:'pointer', backgroundColor: h.tildado ? '#d1e7dd' : ''}}>
                          <td className="text-center"><input type="checkbox" checked={h.tildado} onChange={() => {}} style={{cursor:'pointer', transform: 'scale(1.2)'}} /></td>
                          <td className="text-muted font-monospace">{h.fecha}</td>
                          <td className={`fw-bold font-monospace ${h.fiscal ? 'text-primary' : 'text-secondary'}`}>{h.nro}</td>
                          <td className="text-secondary">{h.articulos && h.articulos.length > 0 ? h.articulos.map(a => `${a.cantidad}x ${a.desc}`).join(', ') : 'Ficha de deuda'}</td>
                          <td className="text-end fw-bold font-monospace pe-4 text-dark">{formatoVista(h.monto)}</td>
                        </tr>
                      ))}
                      {historialVisible.length === 0 && (
                        <tr><td colSpan="5" className="text-center text-muted py-4">No se registran deudas pendientes para esta vista.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {/* PANEL DE PAGOS (Abajo) */}
                <div className="card border shadow-sm p-4 bg-white mt-auto rounded-3">
                  <h6 className="fw-bold text-dark border-bottom pb-2 mb-3">💵 Ingreso de Dinero y Distribución</h6>
                  
                  <div className="row g-3 mb-3">
                    <div className="col-md-3">
                      <label className="small fw-bold text-muted mb-1">💵 Efectivo Contado</label>
                      <input type="number" className="form-control font-monospace text-success fw-bold" value={pagoEfectivo} onChange={e => setPagoEfectivo(e.target.value)} placeholder="$ 0" />
                    </div>
                    <div className="col-md-3">
                      <label className="small fw-bold text-muted mb-1">🏦 Transferencia / Depósito</label>
                      <input type="number" className="form-control font-monospace fw-bold text-secondary" value={pagoTransferencia} onChange={e => setPagoTransferencia(e.target.value)} placeholder="$ 0" />
                    </div>
                    <div className="col-md-3">
                      <label className="small fw-bold text-muted mb-1">🔵 Mercado Pago</label>
                      <input type="number" className="form-control font-monospace text-primary fw-bold" value={pagoMercadoPago} onChange={e => setPagoMercadoPago(e.target.value)} placeholder="$ 0" />
                    </div>
                    <div className="col-md-3">
                      <label className="small fw-bold text-muted mb-1">🎒 Usar Billetera Virtual</label>
                      <input type="number" className="form-control font-monospace text-dark fw-bold border-success" value={pagoBilletera} onChange={e => setPagoBilletera(e.target.value)} disabled={modoVista === 'OFICIAL'} placeholder={modoVista === 'OFICIAL' ? "Inhabilitado en Blanco" : `Máx: ${clienteSeleccionado.saldo_billetera_negro}`} />
                    </div>
                  </div>

                  <div className="border rounded p-3 mb-4 bg-light shadow-sm">
                    <label className="fw-bold text-dark mb-2">🛒 Carga de Cheques Recibidos <span className="badge bg-dark ms-1">{listaCheques.length}</span> - Total Cartera: <span className="text-success">{formatoVista(totalCheques)}</span></label>
                    <div className="row g-2 align-items-end mb-2">
                      <div className="col-md-2"><input type="text" className="form-control form-control-sm" placeholder="Banco Emisor" value={datosChequeAux.banco} onChange={e => setDatosChequeAux({...datosChequeAux, banco: e.target.value})} /></div>
                      <div className="col-md-2"><input type="text" className="form-control form-control-sm" placeholder="Nro Cheque" value={datosChequeAux.nro} onChange={e => setDatosChequeAux({...datosChequeAux, nro: e.target.value})} /></div>
                      <div className="col-md-2"><input type="date" className="form-control form-control-sm" value={datosChequeAux.vencimiento} onChange={e => setDatosChequeAux({...datosChequeAux, vencimiento: e.target.value})} /></div>
                      <div className="col-md-3"><input type="text" className="form-control form-control-sm" placeholder="Firmante / CUIT" value={datosChequeAux.firmante} onChange={e => setDatosChequeAux({...datosChequeAux, firmante: e.target.value})} /></div>
                      <div className="col-md-2"><input type="number" className="form-control form-control-sm font-monospace fw-bold border-primary" placeholder="Monto $" value={datosChequeAux.monto} onChange={e => setDatosChequeAux({...datosChequeAux, monto: e.target.value})} /></div>
                      <div className="col-md-1"><button className="btn btn-sm btn-dark w-100 fw-bold" onClick={agregarCheque}>+</button></div>
                    </div>
                    {listaCheques.length > 0 && (
                      <div className="overflow-auto bg-white border rounded mt-2" style={{maxHeight:'80px'}}>
                        <table className="table table-sm table-bordered mb-0" style={{fontSize: '11px'}}>
                          <tbody>
                            {listaCheques.map(chq => (
                              <tr key={chq.id}>
                                <td className="ps-2">🏦 <strong>{chq.banco}</strong> - Nro: #{chq.nro}</td>
                                <td>📅 Vto: {chq.vencimiento || '-'}</td>
                                <td>👤 Firma: {chq.firmante}</td>
                                <td className="text-end fw-bold font-monospace text-dark pe-2">{formatoVista(chq.monto)}</td>
                                <td width="30" className="text-center"><button className="btn btn-sm text-danger py-0 px-1 border-0" onClick={() => eliminarCheque(chq.id)}>✖</button></td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>

                  {modoVista !== 'OFICIAL' && (
                    <div className="row g-2 align-items-center mb-3">
                      <div className="col-auto">
                        <div className="form-check form-switch">
                          <input className="form-check-input" type="checkbox" id="thirdp" checked={esPagoTercero} onChange={e => setEsPagoTercero(e.target.checked)} style={{cursor:'pointer', transform: 'scale(1.2)'}} />
                          <label className="form-check-label small fw-bold text-dark ms-2" htmlFor="thirdp" style={{cursor:'pointer'}}>Asentar Comisión a favor del tallerista (Billetera Oculta)</label>
                        </div>
                      </div>
                      {esPagoTercero && (
                        <div className="col-3 ms-3">
                          <input type="number" className="form-control form-control-sm border-danger fw-bold font-monospace text-danger shadow-sm" value={montoComision} onChange={e => setMontoComision(e.target.value)} placeholder="Importe Comisión $" />
                        </div>
                      )}
                    </div>
                  )}

                  <div className="border-top pt-3 d-flex justify-content-between align-items-center">
                    <div>
                      <span className="text-muted d-block fw-bold">Total Deudas Tildadas:</span>
                      <strong className="text-danger fs-3 font-monospace">{formatoVista(sumaTildada)}</strong>
                    </div>
                    <div className="d-flex gap-3">
                      <button 
                        className="btn btn-outline-dark fw-bold px-4 py-2 shadow-sm" 
                        onClick={procesarLevantarAFacturar}
                        disabled={modoVista === 'OFICIAL'}
                      >
                        🚀 LEVANTAR PARA FACTURAR
                      </button>
                      <button className="btn text-white fw-bold px-5 py-2 shadow" style={{backgroundColor: modoVista === 'OFICIAL' ? colorBordo : colorPardo}} onClick={ejecutarCobroCombinado}>
                        LIQUIDAR COBRO
                      </button>
                    </div>
                  </div>

                </div>
              </div>
            ) : (
              <div className="h-100 d-flex flex-column align-items-center justify-content-center text-muted bg-white rounded-3 border shadow-sm">
                <span className="display-1 opacity-25 mb-3">👥</span>
                <h4 className="fw-bold text-dark">Área de Trabajo Cerrada</h4>
                <p className="small">Abra una cuenta de cliente desde el panel izquierdo para operar la pasarela.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}