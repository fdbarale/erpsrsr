import React, { useMemo, useState, useEffect } from 'react';
import { dbOficial, dbParda } from '../supabaseClient';

export default function FacturacionModal({ carrito, totalCarrito, cerrar, vaciarYConfirmar }) {
  const [procesando, setProcesando] = useState(false);

  // === MODO SOMBRA (Controlado por teclado) ===
  const [modoPardo, setModoPardo] = useState(false);

  // === CONFIGURACIÓN DEL NEGOCIO ===
  const CONFIG_MEDIOS = {
    'Efectivo': { tipo: 'DESCUENTO', porcentaje: 0.10 },
    'Transferencia': { tipo: 'DESCUENTO', porcentaje: 0.10 },
    'QR': { tipo: 'DESCUENTO', porcentaje: 0.10 },
    'Debito': { tipo: 'NORMAL', porcentaje: 0 },
    'Tarjeta 1 pago': { tipo: 'NORMAL', porcentaje: 0 },
    'Tarjeta 3 cuotas': { tipo: 'RECARGO', porcentaje: 0.10 },
    'Tarjeta 6 cuotas': { tipo: 'RECARGO', porcentaje: 0.20 },
    'Tarjeta 12 cuotas': { tipo: 'RECARGO', porcentaje: 0.35 },
    'Cuenta Corriente': { tipo: 'NORMAL', porcentaje: 0 }
  };

  const [formatoImpresion, setFormatoImpresion] = useState('TICKET');
  const [pagos, setPagos] = useState([]);
  const [metodoSeleccionado, setMetodoSeleccionado] = useState('Efectivo');
  const [montoIngresado, setMontoIngresado] = useState('');

  const colorBordo = '#6B1116';
  const colorPardo = '#212529'; 

  // === MOTOR DE ATAJOS DE TECLADO ===
  useEffect(() => {
    const escucharTeclado = (e) => {
      // Si presiona Ctrl + Shift en simultáneo y no está manteniendo la tecla apretada
      if (e.ctrlKey && e.shiftKey && !e.repeat) {
        setModoPardo(prev => !prev);
      }
    };

    window.addEventListener('keydown', escucharTeclado);
    return () => window.removeEventListener('keydown', escucharTeclado);
  }, []);

  // === UTILIDADES ===
  const redondear = (valor) => {
    const numero = Number(valor);
    if (!Number.isFinite(numero)) return 0;
    return Math.round((numero + Number.EPSILON) * 100) / 100;
  };

  const formatoMoneda = (valor) => {
    return '$ ' + redondear(valor).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const calcularPago = (metodo, montoBaseIngresado) => {
    const config = CONFIG_MEDIOS[metodo];
    const base = redondear(montoBaseIngresado);

    if (!config) return { base, descuento: 0, recargo: 0, fisicoCobrado: base };

    let descuento = 0;
    let recargo = 0;
    let fisicoCobrado = base;

    if (config.tipo === 'DESCUENTO') {
      descuento = redondear(base * config.porcentaje);
      fisicoCobrado = redondear(base - descuento);
    } else if (config.tipo === 'RECARGO') {
      recargo = redondear(base * config.porcentaje);
      fisicoCobrado = redondear(base + recargo);
    }

    return { base, descuento, recargo, fisicoCobrado };
  };

  const resumen = useMemo(() => {
    const totalLista = redondear(totalCarrito);
    const totalBaseCancelada = redondear(pagos.reduce((acc, p) => acc + p.base, 0));
    const totalFisicoCobrado = redondear(pagos.reduce((acc, p) => acc + p.fisicoCobrado, 0));
    const totalDescuentos = redondear(pagos.reduce((acc, p) => acc + p.descuento, 0));
    const totalRecargos = redondear(pagos.reduce((acc, p) => acc + p.recargo, 0));

    const saldoPendiente = redondear(totalLista - totalBaseCancelada);
    const estaCuadrado = Math.abs(saldoPendiente) < 0.01;
    const hayExceso = totalBaseCancelada > (totalLista + 0.01);
    const totalFiscal = totalFisicoCobrado; 

    return { totalLista, totalBaseCancelada, totalFisicoCobrado, totalDescuentos, totalRecargos, saldoPendiente, estaCuadrado, hayExceso, totalFiscal };
  }, [pagos, totalCarrito]);

  useEffect(() => {
    if (resumen.saldoPendiente > 0) {
      setMontoIngresado(resumen.saldoPendiente.toString());
    } else {
      setMontoIngresado('');
    }
  }, [resumen.saldoPendiente]);

  const agregarPago = () => {
    const base = parseFloat(montoIngresado);
    if (!Number.isFinite(base) || base <= 0) return alert('Ingresá un monto válido mayor a cero.');

    const calculado = calcularPago(metodoSeleccionado, base);
    const nuevoTotalBase = redondear(resumen.totalBaseCancelada + calculado.base);

    if (nuevoTotalBase > resumen.totalLista + 0.01) {
      alert(`El monto ingresado supera el saldo del carrito.\n\nSaldo pendiente a cancelar: ${formatoMoneda(resumen.saldoPendiente)}`);
      return;
    }

    setPagos(prev => [...prev, { id: Date.now(), metodo: metodoSeleccionado, ...calculado }]);
  };

  const eliminarPago = (id) => setPagos(prev => prev.filter(p => p.id !== id));
  const limpiarPagos = () => setPagos([]);

  const manejarEmision = async () => {
    if (!carrito || carrito.length === 0) return alert('El carrito está vacío.');
    if (pagos.length === 0) return alert('Debe ingresar al menos un medio de pago.');
    if (!resumen.estaCuadrado) return alert(`Caja descuadrada. Faltan cobrar: ${formatoMoneda(resumen.saldoPendiente)}`);

    setProcesando(true);

    try {
      let comprobanteFinal = '';
      let infoFiscal = '';

      if (!modoPardo) {
        console.log("Conectando con AFIP...");
        
        const { data: dataAfip, error: errorAfip } = await dbOficial.functions.invoke('facturacion-afip', {
          body: { total: resumen.totalFiscal, cliente_doc: "", cliente_iva: "Consumidor Final" }
        });

        if (errorAfip) throw new Error("Fallo al contactar AFIP: " + errorAfip.message);
        if (dataAfip.error) throw new Error("AFIP rechazó la operación:\n" + dataAfip.error);

        const letra = dataAfip.tipoComprobante === 1 ? 'A' : 'B';
        const nroFormateado = dataAfip.nroComprobante.toString().padStart(8, '0');
        const nroA_Guardar = `Factura ${letra} 00014-${nroFormateado}`;
        
        const { error: errorDb } = await dbOficial.rpc('procesar_venta_interna', {
          p_cliente_id: null, p_total: resumen.totalFiscal, p_items: carrito, p_tipo: 'FISCAL', p_nro_comprobante: nroA_Guardar
        });

        if (errorDb) throw new Error("Error al guardar en BD Oficial: " + errorDb.message);

        comprobanteFinal = nroA_Guardar;
        infoFiscal = `\nCAE: ${dataAfip.cae}\nVto CAE: ${dataAfip.vtoCae}`;

      } else {
        const fechaCorta = new Date().toISOString().slice(2, 10).replace(/-/g, '');
        const aleatorio = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
        const nroA_Guardar = `REM-X ${fechaCorta}-${aleatorio}`;

        const { error: errorParda } = await dbParda.rpc('procesar_venta_parda', {
          p_cliente_id: null, p_total: resumen.totalFiscal, p_items: carrito, p_nro_comprobante: nroA_Guardar
        });

        if (errorParda) throw new Error("Error al guardar en BD Parda: " + errorParda.message);

        const { error: errorStock } = await dbOficial.rpc('descontar_stock_silencioso', { p_items: carrito });
        if (errorStock) throw new Error("Error al descontar stock en BD Oficial: " + errorStock.message);

        comprobanteFinal = nroA_Guardar;
      }

      try {
        console.log('Imprimiendo...', { comprobanteFinal, formatoImpresion, pagos, resumen });
      } catch (printErr) {
        console.warn('Error de hardware ignorado:', printErr);
      }

      alert(`✅ Venta Exitosa.\nComprobante: ${comprobanteFinal}${infoFiscal}\nTotal cobrado al cliente: ${formatoMoneda(resumen.totalFisicoCobrado)}`);
      vaciarYConfirmar();

    } catch (error) {
      alert('❌ Error en la emisión:\n' + error.message);
      setProcesando(false);
    }
  };

  return (
    <div className="position-fixed top-0 start-0 w-100 h-100 bg-dark bg-opacity-75 d-flex justify-content-center align-items-center" style={{ zIndex: 9999 }}>
      <div className="card shadow-lg border-0 d-flex flex-column" style={{ width: '96%', maxWidth: '1450px', height: '92vh', borderRadius: '12px' }}>
        
        {/* HEADER */}
        <div 
          className="card-header text-white d-flex justify-content-between align-items-center py-3" 
          style={{ backgroundColor: modoPardo ? colorPardo : colorBordo, borderTopLeftRadius: '12px', borderTopRightRadius: '12px', transition: 'background-color 0.2s ease' }}
        >
          <div>
            <h4 className="modal-title fw-bold m-0 user-select-none">
              {modoPardo ? 'Cierre de Caja (Sombra)' : 'Cierre de Caja Fiscal'}
            </h4>
          </div>
          <button className="btn-close btn-close-white" onClick={cerrar} disabled={procesando} />
        </div>

        <div className="card-body p-4 bg-light overflow-hidden d-flex flex-column">
          <div className="row flex-grow-1 h-100 g-4">
            
            {/* COLUMNA 1 - PAGOS */}
            <div className="col-md-7 d-flex flex-column h-100">
              <h6 className="fw-bold text-muted mb-3 text-uppercase small">1. Composición del Pago</h6>
              <div className="card border-0 shadow-sm flex-grow-1 d-flex flex-column">
                <div className="card-body p-3 d-flex flex-column">
                  
                  <div className="row mb-3 border-bottom pb-3">
                    <div className="col">
                      <div className="small text-muted fw-bold">SALDO A CANCELAR DEL CARRITO</div>
                      <div className="fs-3 fw-bold font-monospace text-primary">
                        {formatoMoneda(resumen.saldoPendiente)}
                      </div>
                    </div>
                  </div>

                  <div className="border rounded p-3 bg-light mb-3 shadow-sm">
                    <div className="row g-2 align-items-end">
                      <div className="col-md-5">
                        <label className="form-label small fw-bold text-muted mb-1">MEDIO DE PAGO</label>
                        <select className="form-select fw-bold" value={metodoSeleccionado} onChange={(e) => setMetodoSeleccionado(e.target.value)} disabled={procesando || resumen.estaCuadrado}>
                          {Object.entries(CONFIG_MEDIOS).map(([nombre, config]) => (
                            <option key={nombre} value={nombre}>
                              {nombre} {config.tipo === 'DESCUENTO' ? `(-${config.porcentaje*100}%)` : config.tipo === 'RECARGO' ? `(+${config.porcentaje*100}%)` : ''}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="col-md-4">
                        <label className="form-label small fw-bold text-muted mb-1">PARTE A CANCELAR</label>
                        <div className="input-group">
                          <span className="input-group-text">$</span>
                          <input type="number" min="0" step="0.01" className="form-control fw-bold font-monospace" placeholder="0.00" value={montoIngresado} onChange={(e) => setMontoIngresado(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') agregarPago(); }} disabled={procesando || resumen.estaCuadrado} />
                        </div>
                      </div>
                      <div className="col-md-3">
                        <button className="btn btn-secondary fw-bold w-100" onClick={agregarPago} disabled={procesando || resumen.estaCuadrado}>Agregar</button>
                      </div>
                    </div>
                  </div>

                  <div className="flex-grow-1 border rounded bg-white overflow-auto mb-3" style={{ minHeight: '180px' }}>
                    <table className="table table-sm table-hover mb-0 align-middle">
                      <thead className="table-light sticky-top" style={{ fontSize: '11px' }}>
                        <tr>
                          <th className="ps-2">MÉTODO</th>
                          <th className="text-end">BASE CANCELADA</th>
                          <th className="text-end">AJUSTE</th>
                          <th className="text-end text-primary">FÍSICO COBRADO</th>
                          <th className="text-center" width="45"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {pagos.map((pago) => (
                          <tr key={pago.id}>
                            <td className="ps-2 fw-bold text-secondary">{pago.metodo}</td>
                            <td className="text-end font-monospace">{formatoMoneda(pago.base)}</td>
                            <td className={`text-end font-monospace fw-bold ${pago.descuento > 0 ? 'text-success' : pago.recargo > 0 ? 'text-danger' : 'text-muted'}`}>
                              {pago.descuento > 0 ? `-${formatoMoneda(pago.descuento)}` : pago.recargo > 0 ? `+${formatoMoneda(pago.recargo)}` : '-'}
                            </td>
                            <td className="text-end font-monospace fw-bold text-primary">{formatoMoneda(pago.fisicoCobrado)}</td>
                            <td className="text-center">
                              <button className="btn btn-sm text-danger py-0 px-1 border-0" onClick={() => eliminarPago(pago.id)} disabled={procesando}>✖</button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="d-flex justify-content-between align-items-center">
                    <div className="small fw-bold text-muted">
                      Total Físico en Caja: <span className="text-dark fs-5 font-monospace">{formatoMoneda(resumen.totalFisicoCobrado)}</span>
                    </div>
                    <button className="btn btn-sm btn-outline-danger" onClick={limpiarPagos} disabled={procesando || pagos.length === 0}>Limpiar pagos</button>
                  </div>
                </div>
              </div>
            </div>

            {/* COLUMNA 2 - CLIENTE */}
            <div className="col-md-3 d-flex flex-column h-100">
              <h6 className="fw-bold text-muted mb-3 text-uppercase small">2. Cliente y Documento</h6>
              <div className="input-group mb-3 shadow-sm">
                <input type="text" className="form-control" placeholder="Buscar cliente..." disabled />
                <button className="btn btn-primary" disabled>🔍</button>
              </div>
              <div className="card border-0 shadow-sm p-3 mb-4 bg-white">
                <div className="small text-muted fw-bold">CLIENTE ACTUAL</div>
                <div className="fw-bold text-primary">Consumidor Final</div>
              </div>
            </div>

            {/* COLUMNA 3 - IMPRESIÓN */}
            <div className="col-md-2 d-flex flex-column h-100">
              <h6 className="fw-bold text-muted mb-3 text-uppercase small text-center">3. Impresión</h6>
              <div className={`card shadow-sm mb-3 ${formatoImpresion === 'TICKET' ? 'border-primary' : 'border-0 opacity-75'}`} style={{ backgroundColor: formatoImpresion === 'TICKET' ? '#eaf4ff' : 'white', cursor: 'pointer', minHeight: '150px' }} onClick={() => setFormatoImpresion('TICKET')}>
                <div className={`card-body d-flex flex-column align-items-center justify-content-center ${formatoImpresion === 'TICKET' ? 'text-primary' : 'text-muted'}`}>
                  <span className="display-4 mb-2">🧾</span>
                  <span className="fw-bold text-center">Ticket 80mm</span>
                </div>
              </div>
            </div>

          </div>
        </div>

        {/* FOOTER */}
        <div className="card-footer bg-white d-flex justify-content-between align-items-center p-4" style={{ borderBottomLeftRadius: '12px', borderBottomRightRadius: '12px' }}>
          <button className="btn btn-outline-secondary fw-bold px-4 py-2" onClick={cerrar} disabled={procesando}>Volver</button>
          
          <button 
            className={`btn fw-bold px-5 py-3 shadow text-white`} 
            style={{ 
              backgroundColor: modoPardo ? colorPardo : colorBordo, 
              fontSize: '1.15rem', 
              letterSpacing: '1px', 
              opacity: resumen.estaCuadrado ? 1 : 0.5,
              transition: 'background-color 0.2s ease, transform 0.1s ease'
            }} 
            onClick={manejarEmision} 
            disabled={procesando || !resumen.estaCuadrado}
          >
            {procesando ? 'PROCESANDO...' : (modoPardo ? 'EMITIR REMITO X' : 'FACTURAR EN AFIP')}
          </button>
        </div>
      </div>
    </div>
  );
}