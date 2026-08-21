import React, { useState, useEffect } from 'react';
import { dbOficial, dbParda } from '../../supabaseClient';

export default function CuentaCorriente({ clienteInicial, volverALista, onLevantarComprobante, modoVista, setModoVista }) {
  const [cliente, setCliente] = useState(clienteInicial);
  const [historial, setHistorial] = useState([]);

  const [pagoEfectivo, setPagoEfectivo] = useState('');
  const [pagoTransferencia, setPagoTransferencia] = useState('');
  const [pagoMercadoPago, setPagoMercadoPago] = useState('');
  const [pagoBilletera, setPagoBilletera] = useState('');

  const [listaCheques, setListaCheques] = useState([]);
  const [datosChequeAux, setDatosChequeAux] = useState({ banco: '', nro: '', vencimiento: '', firmante: '', monto: '' });
  
  const [esPagoTercero, setEsPagoTercero] = useState(false);
  const [montoComision, setMontoComision] = useState('');

  const colorBordo = '#6B1116';
  const colorPardo = '#212529';

  const formatoVista = (valor) => "$ " + Math.round(parseFloat(valor) || 0).toLocaleString('es-AR');

  const recargarMovimientosYSaldos = async () => {
    try {
      const { data: clienteData } = await dbOficial.from('clientes').select('*').eq('id', cliente.id).single();
      if (clienteData) setCliente(clienteData);

      const [resOficial, resParda] = await Promise.all([
        dbOficial.from('movimientos_cc').select('*').eq('cliente_id', cliente.id),
        dbParda.from('movimientos_cc').select('*').eq('cliente_id', cliente.id)
      ]);

      const movOficial = resOficial.data || [];
      const movParda = resParda.data || [];

      const mapa = new Map();
      [...movOficial, ...movParda].forEach(m => mapa.set(m.id || m.nro, { ...m, tildado: false }));
      
      const unificados = Array.from(mapa.values()).sort((a, b) => new Date(b.created_at || b.fecha) - new Date(a.created_at || a.fecha));
      setHistorial(unificados);
    } catch (err) {
      console.error("Error cargando ficha CC:", err);
    }
  };

  useEffect(() => {
    recargarMovimientosYSaldos();
  }, [cliente.id]);

  const toggleModoVistaLocal = (e) => {
    if (e.ctrlKey) {
      if (modoVista === 'OFICIAL') setModoVista('PARDO');
      else if (modoVista === 'PARDO') setModoVista('DUAL');
      else setModoVista('OFICIAL');
    }
  };

  const historialVisible = historial.filter(h => {
    if (modoVista === 'OFICIAL') return h.fiscal;
    if (modoVista === 'PARDO') return !h.fiscal;
    return true; 
  });

  const toggleTilde = (comprobanteId) => {
    setHistorial(prev => prev.map(h => (h.id === comprobanteId || h.nro === comprobanteId) ? { ...h, tildado: !h.tildado } : h));
  };

  const sumaTildada = historialVisible
    .filter(h => h.tildado)
    .reduce((acc, h) => acc + Number(h.monto || 0), 0);

  const totalCheques = listaCheques.reduce((acc, chq) => acc + chq.monto, 0);

  const agregarCheque = () => {
    const montoNum = Math.round(parseFloat(datosChequeAux.monto));
    if (!datosChequeAux.banco || !datosChequeAux.nro || !montoNum || montoNum <= 0) {
      alert("Completá Banco, Número y Monto del cheque.");
      return;
    }
    setListaCheques([...listaCheques, { ...datosChequeAux, id: Date.now(), monto: montoNum }]);
    setDatosChequeAux({ banco: '', nro: '', vencimiento: '', firmante: '', monto: '' });
  };

  const eliminarCheque = (id) => setListaCheques(listaCheques.filter(chq => chq.id !== id));

  const procesarLevantarAFacturar = () => {
    const comprobantesTildados = historialVisible.filter(h => h.tildado && !h.fiscal);
    if (comprobantesTildados.length === 0) {
      alert("Tildá los comprobantes internos (X) que querés levantar para facturar.");
      return;
    }

    let articulosAcumulados = [];
    comprobantesTildados.forEach(comp => {
      if (comp.articulos && comp.articulos.length > 0) {
        articulosAcumulados = [...articulosAcumulados, ...comp.articulos];
      }
    });

    if (articulosAcumulados.length === 0) {
      alert("Los comprobantes seleccionados no tienen repuestos detallados cargados.");
      return;
    }

    if (onLevantarComprobante) {
      onLevantarComprobante(articulosAcumulados);
    } else {
      alert(`Se cargaron ${articulosAcumulados.length} artículos listos para facturar.`);
    }
  };

  const ejecutarCobroCombinado = async () => {
    const efe = Math.round(parseFloat(pagoEfectivo)) || 0;
    const trans = Math.round(parseFloat(pagoTransferencia)) || 0;
    const mp = Math.round(parseFloat(pagoMercadoPago)) || 0;
    const bill = Math.round(parseFloat(pagoBilletera)) || 0;
    const comision = Math.round(parseFloat(montoComision)) || 0;

    const totalIngresado = efe + trans + mp + bill + totalCheques;

    if (totalIngresado <= 0) return alert("Ingresá un importe en al menos un medio de pago.");
    if (bill > (cliente.saldo_billetera_negro || 0)) return alert("Saldo insuficiente en Billetera Virtual.");
    if (sumaTildada <= 0) return alert("Tildá en la tabla qué comprobantes se están cancelando.");

    let remanenteSobrante = 0;
    if (totalIngresado > sumaTildada) remanenteSobrante = totalIngresado - sumaTildada;

    let nuevaBilletera = (cliente.saldo_billetera_negro || 0) - bill + remanenteSobrante + comision;

    let deudasMataFiscal = historialVisible.filter(h => h.tildado && h.fiscal).reduce((acc, h) => acc + Number(h.monto || 0), 0);
    let deudasMataInterno = historialVisible.filter(h => h.tildado && !h.fiscal).reduce((acc, h) => acc + Number(h.monto || 0), 0);

    let nuevoSaldoFiscal = Math.max(0, (cliente.saldo_fiscal || 0) - deudasMataFiscal);
    let nuevoSaldoInterno = Math.max(0, (cliente.saldo_interno || 0) - deudasMataInterno);

    const idsPagados = historialVisible.filter(h => h.tildado).map(h => h.id || h.nro);

    try {
      await dbOficial.from('clientes').update({ 
        saldo_fiscal: nuevoSaldoFiscal, 
        saldo_interno: nuevoSaldoInterno,
        saldo_billetera_negro: nuevaBilletera 
      }).eq('id', cliente.id);

      await dbParda.from('clientes').update({ 
        saldo_interno: nuevoSaldoInterno 
      }).eq('id', cliente.id);

      if (idsPagados.length > 0) {
        await Promise.all([
          dbOficial.from('movimientos_cc').delete().in('id', idsPagados),
          dbParda.from('movimientos_cc').delete().in('id', idsPagados)
        ]);
      }

      setPagoEfectivo(''); setPagoTransferencia(''); setPagoMercadoPago(''); setPagoBilletera(''); setMontoComision(''); setListaCheques([]);
      await recargarMovimientosYSaldos();
      alert("✅ Cobro liquidado y saldos actualizados.");

    } catch (error) {
      alert("❌ Error crítico: " + error.message);
    }
  };

  const obtenerFondoNav = () => {
    if (modoVista === 'OFICIAL') return colorBordo;
    if (modoVista === 'PARDO') return colorPardo;
    return `linear-gradient(90deg, ${colorBordo} 50%, ${colorPardo} 50%)`;
  };

  const totalConsolidado = Number(cliente.saldo_fiscal || 0) + Number(cliente.saldo_interno || 0);

  return (
    <div className="d-flex flex-column h-100 bg-white border rounded shadow-sm p-3 mb-4">
      
      {/* HEADER DE FICHA */}
      <div className="d-flex justify-content-between align-items-center border-bottom pb-3 mb-3">
        <div>
          <span 
            className="badge px-3 py-2 fw-bold text-uppercase cursor-pointer user-select-none" 
            style={{ background: obtenerFondoNav(), color: '#fff', cursor: 'pointer' }}
            onClick={toggleModoVistaLocal}
            title="Ctrl + Clic para alternar Oficial / Pardo / Consolidado"
          >
            Vista: {modoVista} (Ctrl + Clic)
          </span>
          <h4 className="fw-bold text-dark mt-2 mb-0">{cliente.nombre} {cliente.sobrenombre ? `(${cliente.sobrenombre})` : ''}</h4>
          <span className="text-muted small font-monospace">CUIT/DNI: {cliente.cuit || 'Sin documento'} | Condición: {cliente.condicionIva || 'Consumidor Final'}</span>
        </div>
        <button className="btn btn-outline-secondary fw-bold" onClick={volverALista}>
          ⬅ Volver al Listado
        </button>
      </div>

      {/* TARJETAS DE SALDOS SEGÚN EL MODO */}
      <div className="row g-2 mb-3">
        
        {/* MODO OFICIAL: SOLO SALDO FISCAL */}
        {modoVista === 'OFICIAL' && (
          <div className="col-12">
            <div className="card bg-dark text-white p-3 border-0 text-center rounded-3 shadow-sm">
              <h3 className="m-0 font-monospace">{formatoVista(cliente.saldo_fiscal)}</h3>
              <span className="small text-uppercase opacity-75 fw-bold" style={{ fontSize: '11px' }}>Deuda Fiscal Oficial</span>
            </div>
          </div>
        )}

        {/* MODO PARDO: DEUDA X + BILLETERA */}
        {modoVista === 'PARDO' && (
          <>
            <div className="col-6">
              <div className="card bg-secondary text-white p-3 border-0 text-center rounded-3 shadow-sm">
                <h3 className="m-0 font-monospace">{formatoVista(cliente.saldo_interno)}</h3>
                <span className="small text-uppercase opacity-75 fw-bold" style={{ fontSize: '11px' }}>Deuda Interna (X)</span>
              </div>
            </div>
            <div className="col-6">
              <div className="card bg-success bg-opacity-10 text-success p-3 border border-success border-opacity-25 text-center rounded-3 shadow-sm">
                <h3 className="m-0 font-monospace text-success">{formatoVista(cliente.saldo_billetera_negro)}</h3>
                <span className="small text-uppercase text-success fw-bold" style={{ fontSize: '11px' }}>Billetera Virtual (A favor)</span>
              </div>
            </div>
          </>
        )}

        {/* MODO DUAL / COMPILADO */}
        {modoVista === 'DUAL' && (
          <>
            <div className="col-4">
              <div className="card bg-primary text-white p-3 border-0 text-center rounded-3 shadow-sm">
                <h3 className="m-0 font-monospace">{formatoVista(totalConsolidado)}</h3>
                <span className="small text-uppercase opacity-75 fw-bold" style={{ fontSize: '11px' }}>Total Deuda Consolidada</span>
              </div>
            </div>
            <div className="col-4">
              <div className="card bg-dark text-white p-2 border-0 text-center rounded-3 shadow-sm d-flex flex-column justify-content-center">
                <div className="small font-monospace">Oficial: <strong>{formatoVista(cliente.saldo_fiscal)}</strong></div>
                <div className="small font-monospace text-warning">Interna (X): <strong>{formatoVista(cliente.saldo_interno)}</strong></div>
                <span className="small text-uppercase opacity-75 fw-bold" style={{ fontSize: '10px' }}>Desglose de Saldos</span>
              </div>
            </div>
            <div className="col-4">
              <div className="card bg-success bg-opacity-10 text-success p-3 border border-success border-opacity-25 text-center rounded-3 shadow-sm">
                <h3 className="m-0 font-monospace text-success">{formatoVista(cliente.saldo_billetera_negro)}</h3>
                <span className="small text-uppercase text-success fw-bold" style={{ fontSize: '11px' }}>Billetera Virtual (A favor)</span>
              </div>
            </div>
          </>
        )}

      </div>

      {/* TABLA DE DEUDAS */}
      <div className="border rounded bg-white overflow-auto shadow-sm mb-3" style={{ maxHeight: '30vh', minHeight: '180px' }}>
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
            {historialVisible.map((h, i) => (
              <tr key={h.id || i} onClick={() => toggleTilde(h.id || h.nro)} style={{ cursor: 'pointer', backgroundColor: h.tildado ? '#d1e7dd' : '' }}>
                <td className="text-center"><input type="checkbox" checked={h.tildado} onChange={() => {}} style={{ cursor: 'pointer', transform: 'scale(1.2)' }} /></td>
                <td className="text-muted font-monospace">{h.fecha || '-'}</td>
                <td className={`fw-bold font-monospace ${h.fiscal ? 'text-primary' : 'text-secondary'}`}>{h.nro}</td>
                <td className="text-secondary">{h.articulos && h.articulos.length > 0 ? h.articulos.map(a => `${a.cantidad}x ${a.desc || a.descripcion || a.cod}`).join(', ') : 'Comprobante de cuenta'}</td>
                <td className="text-end fw-bold font-monospace pe-4 text-dark">{formatoVista(h.monto)}</td>
              </tr>
            ))}
            {historialVisible.length === 0 && (
              <tr><td colSpan="5" className="text-center text-muted py-4">No hay comprobantes pendientes en este modo de vista.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* PANEL DE PAGOS */}
      <div className="card border shadow-sm p-3 bg-light rounded-3 mt-auto">
        <h6 className="fw-bold text-dark border-bottom pb-2 mb-3">💵 Registrar Pago y Liquidación</h6>
        
        <div className="row g-2 mb-3">
          <div className="col-md-3">
            <label className="small fw-bold text-muted mb-1">Efectivo</label>
            <input type="number" className="form-control font-monospace text-success fw-bold" value={pagoEfectivo} onChange={e => setPagoEfectivo(e.target.value)} placeholder="$ 0" />
          </div>
          <div className="col-md-3">
            <label className="small fw-bold text-muted mb-1">Transferencia</label>
            <input type="number" className="form-control font-monospace fw-bold text-secondary" value={pagoTransferencia} onChange={e => setPagoTransferencia(e.target.value)} placeholder="$ 0" />
          </div>
          <div className="col-md-3">
            <label className="small fw-bold text-muted mb-1">Mercado Pago</label>
            <input type="number" className="form-control font-monospace text-primary fw-bold" value={pagoMercadoPago} onChange={e => setPagoMercadoPago(e.target.value)} placeholder="$ 0" />
          </div>
          <div className="col-md-3">
            <label className="small fw-bold text-muted mb-1">Usar Billetera Virtual</label>
            <input type="number" className="form-control font-monospace text-dark fw-bold border-success" value={pagoBilletera} onChange={e => setPagoBilletera(e.target.value)} disabled={modoVista === 'OFICIAL'} placeholder={modoVista === 'OFICIAL' ? "Solo Pardo" : `Máx: ${cliente.saldo_billetera_negro || 0}`} />
          </div>
        </div>

        {/* CHEQUES */}
        <div className="border rounded p-2 mb-3 bg-white shadow-sm">
          <label className="fw-bold text-dark mb-1 small">Cheques Recibidos ({listaCheques.length}) - Total: <span className="text-success">{formatoVista(totalCheques)}</span></label>
          <div className="row g-1 align-items-end">
            <div className="col-md-3"><input type="text" className="form-control form-control-sm" placeholder="Banco" value={datosChequeAux.banco} onChange={e => setDatosChequeAux({...datosChequeAux, banco: e.target.value})} /></div>
            <div className="col-md-2"><input type="text" className="form-control form-control-sm" placeholder="Nro Cheque" value={datosChequeAux.nro} onChange={e => setDatosChequeAux({...datosChequeAux, nro: e.target.value})} /></div>
            <div className="col-md-2"><input type="date" className="form-control form-control-sm" value={datosChequeAux.vencimiento} onChange={e => setDatosChequeAux({...datosChequeAux, vencimiento: e.target.value})} /></div>
            <div className="col-md-2"><input type="text" className="form-control form-control-sm" placeholder="Firmante" value={datosChequeAux.firmante} onChange={e => setDatosChequeAux({...datosChequeAux, firmante: e.target.value})} /></div>
            <div className="col-md-2"><input type="number" className="form-control form-control-sm font-monospace fw-bold" placeholder="Monto $" value={datosChequeAux.monto} onChange={e => setDatosChequeAux({...datosChequeAux, monto: e.target.value})} /></div>
            <div className="col-md-1"><button className="btn btn-sm btn-dark w-100 fw-bold" onClick={agregarCheque}>+</button></div>
          </div>
          {listaCheques.length > 0 && (
            <div className="overflow-auto mt-2" style={{ maxHeight: '70px' }}>
              <table className="table table-sm table-bordered mb-0" style={{ fontSize: '11px' }}>
                <tbody>
                  {listaCheques.map(chq => (
                    <tr key={chq.id}>
                      <td className="ps-2">🏦 {chq.banco} #{chq.nro}</td>
                      <td>📅 {chq.vencimiento || '-'}</td>
                      <td>👤 {chq.firmante}</td>
                      <td className="text-end fw-bold font-monospace pe-2">{formatoVista(chq.monto)}</td>
                      <td width="30" className="text-center"><button className="btn btn-sm text-danger py-0 px-1 border-0" onClick={() => eliminarCheque(chq.id)}>✖</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {modoVista !== 'OFICIAL' && (
          <div className="row g-2 align-items-center mb-2">
            <div className="col-auto">
              <div className="form-check form-switch">
                <input className="form-check-input" type="checkbox" id="checkTercero" checked={esPagoTercero} onChange={e => setEsPagoTercero(e.target.checked)} />
                <label className="form-check-label small fw-bold text-dark ms-1" htmlFor="checkTercero">Comisión para mecánico/tallerista (va a su billetera)</label>
              </div>
            </div>
            {esPagoTercero && (
              <div className="col-3">
                <input type="number" className="form-control form-control-sm border-danger fw-bold font-monospace text-danger" value={montoComision} onChange={e => setMontoComision(e.target.value)} placeholder="Importe Comisión $" />
              </div>
            )}
          </div>
        )}

        <div className="border-top pt-2 d-flex justify-content-between align-items-center">
          <div>
            <span className="text-muted small d-block fw-bold">Total Deudas Tildadas:</span>
            <strong className="text-danger fs-4 font-monospace">{formatoVista(sumaTildada)}</strong>
          </div>
          <div className="d-flex gap-2">
            <button 
              className="btn btn-outline-dark fw-bold px-3 py-2 shadow-sm" 
              onClick={procesarLevantarAFacturar}
              disabled={modoVista === 'OFICIAL'}
            >
              🚀 Levantar a Facturar
            </button>
            <button 
              className="btn text-white fw-bold px-4 py-2 shadow" 
              style={{ backgroundColor: modoVista === 'OFICIAL' ? colorBordo : colorPardo }} 
              onClick={ejecutarCobroCombinado}
            >
              Liquidar Cobro
            </button>
          </div>
        </div>

      </div>

    </div>
  );
}