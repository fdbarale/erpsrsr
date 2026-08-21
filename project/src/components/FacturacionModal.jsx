import React, { useMemo, useState, useEffect } from 'react';
import qz from 'qz-tray';
import { dbOficial, dbParda } from '../supabaseClient';
import DocumentoImpresion from './DocumentoImpresion';

const generarId = () => 'mov_' + Date.now().toString(36) + Math.random().toString(36).slice(2);

export default function FacturacionModal({ carrito, totalCarrito, cerrar, vaciarYConfirmar, usuarioOperador }) {
  const [procesando, setProcesando] = useState(false);
  const [modoPardo, setModoPardo] = useState(false);
  const [comprobanteEmitido, setComprobanteEmitido] = useState(null);

  const [listaClientes, setListaClientes] = useState([]);
  const [busquedaCliente, setBusquedaCliente] = useState('');
  const [mostrarModalClientes, setMostrarModalClientes] = useState(false);
  const [directoCtaCte, setDirectoCtaCte] = useState(false);
  const [clienteSeleccionado, setClienteSeleccionado] = useState({
    id: null, nombre: 'Consumidor Final', cuit: '', condicionIva: 'Consumidor Final',
    direccion: '', telefono: '', email: '', saldo_fiscal: 0, saldo_interno: 0
  });

  const [mediosPagoConfig, setMediosPagoConfig] = useState([]);
  const [opcionesImpresion, setOpcionesImpresion] = useState({ ticket: true, a4: false });
  const [vistaPrevia, setVistaPrevia] = useState('TICKET');

  const [pagos, setPagos] = useState([]);
  const [metodoSeleccionado, setMetodoSeleccionado] = useState('Efectivo');
  const [montoIngresado, setMontoIngresado] = useState('');

  const [enviarWhatsapp, setEnviarWhatsapp] = useState(false);
  const [whatsappDestino, setWhatsappDestino] = useState('');

  const colorBordo = '#6B1116';
  const colorPardo = '#212529';

  useEffect(() => {
    const cargarDatosIniciales = async () => {
      try {
        const [resMedios, resClientes] = await Promise.all([
          dbOficial.from('config_medios_pago').select('*').eq('activo', true),
          dbOficial.from('clientes').select('*').order('nombre', { ascending: true })
        ]);
        if (resMedios.data && resMedios.data.length > 0) {
          setMediosPagoConfig(resMedios.data);
          setMetodoSeleccionado(resMedios.data[0].nombre);
        } else {
          setMediosPagoConfig([{ nombre: 'Efectivo', tipo: 'NORMAL', porcentaje: 0 }, { nombre: 'Cuenta Corriente', tipo: 'NORMAL', porcentaje: 0 }]);
        }
        if (resClientes.data) setListaClientes(resClientes.data);
      } catch (err) { console.error(err); }
    };
    cargarDatosIniciales();

    if (!qz.websocket.isActive()) {
      qz.websocket.connect().catch(() => console.log('QZ Tray no detectado en el puerto'));
    }
  }, []);

  useEffect(() => {
    setWhatsappDestino(clienteSeleccionado.telefono || '');
  }, [clienteSeleccionado]);

  useEffect(() => {
    const escucharTeclado = (e) => { 
      if (e.ctrlKey && e.shiftKey && !e.repeat) setModoPardo(prev => !prev); 
    };
    window.addEventListener('keydown', escucharTeclado);
    return () => window.removeEventListener('keydown', escucharTeclado);
  }, []);

  const redondear = (valor) => Math.round((Number(valor) + Number.EPSILON) * 100) / 100;
  const formatoMoneda = (valor) => '$ ' + redondear(valor).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const calcularPago = (metodoNombre, montoBase) => {
    const config = mediosPagoConfig.find(m => m.nombre === metodoNombre);
    const base = redondear(montoBase);
    if (!config) return { base, descuento: 0, recargo: 0, fisicoCobrado: base };
    let descuento = 0, recargo = 0, fisicoCobrado = base;
    const factor = Number(config.porcentaje) / 100;
    if (config.tipo === 'DESCUENTO') { descuento = redondear(base * factor); fisicoCobrado = redondear(base - descuento); } 
    else if (config.tipo === 'RECARGO') { recargo = redondear(base * factor); fisicoCobrado = redondear(base + recargo); }
    return { base, descuento, recargo, fisicoCobrado };
  };

  const resumen = useMemo(() => {
    const totalLista = redondear(totalCarrito);
    if (directoCtaCte) return { totalLista, totalBaseCancelada: totalLista, totalFisicoCobrado: totalLista, totalDescuentos: 0, totalRecargos: 0, saldoPendiente: 0, estaCuadrado: true, totalFiscal: totalLista };
    const totalBaseCancelada = redondear(pagos.reduce((acc, p) => acc + p.base, 0));
    const totalFisicoCobrado = redondear(pagos.reduce((acc, p) => acc + p.fisicoCobrado, 0));
    const totalDescuentos = redondear(pagos.reduce((acc, p) => acc + p.descuento, 0));
    const totalRecargos = redondear(pagos.reduce((acc, p) => acc + p.recargo, 0));
    const saldoPendiente = redondear(totalLista - totalBaseCancelada);
    return { totalLista, totalBaseCancelada, totalFisicoCobrado, totalDescuentos, totalRecargos, saldoPendiente, estaCuadrado: Math.abs(saldoPendiente) < 0.01, totalFiscal: totalFisicoCobrado };
  }, [pagos, totalCarrito, directoCtaCte]);

  useEffect(() => { 
    if (!directoCtaCte) setMontoIngresado(resumen.saldoPendiente > 0 ? resumen.saldoPendiente.toString() : ''); 
  }, [resumen.saldoPendiente, directoCtaCte]);

  const agregarPago = () => {
    const base = parseFloat(montoIngresado);
    if (!Number.isFinite(base) || base <= 0) return alert('Ingresá un monto válido.');
    if (metodoSeleccionado === 'Cuenta Corriente' && !clienteSeleccionado.id) return alert('Seleccioná un cliente para mandar a CC.');
    const calculado = calcularPago(metodoSeleccionado, base);
    if (redondear(resumen.totalBaseCancelada + calculado.base) > resumen.totalLista + 0.01) return alert(`El monto supera el saldo pendiente (${formatoMoneda(resumen.saldoPendiente)}).`);
    setPagos(prev => [...prev, { id: Date.now(), metodo: metodoSeleccionado, ...calculado }]);
  };

  const eliminarPago = (id) => setPagos(prev => prev.filter(p => p.id !== id));
  const limpiarPagos = () => setPagos([]);

  const limpiarYCerrar = () => { 
    if (typeof vaciarYConfirmar === 'function') vaciarYConfirmar(); 
    if (typeof cerrar === 'function') cerrar(); 
  };

  // IMPRESIÓN QZ TRAY DIRECTA A LA EPSON 80MM
  const imprimirTicketQZ = async (compData) => {
    try {
      if (!qz.websocket.isActive()) await qz.websocket.connect();
      const configTicket = qz.configs.create('EPSON TM-T20II Receipt5');
      const esCtaCteDoc = compData.pagos && compData.pagos.some(p => p.metodo === 'Cuenta Corriente');
      
      let comandos = [
        '\x1B\x40', // Reset
        '\x1B\x61\x01', // Center
        '\x1B\x45\x01', 'RSR REPUESTOS\n', '\x1B\x45\x00',
        `${compData.tipo} (${compData.letra}) ${esCtaCteDoc ? ' cc' : ''}\n`,
        '------------------------------------------\n',
        `Comp: ${compData.nroComprobante}\n`,
        `Fecha: ${compData.fecha}\n`,
        `Atendio: ${compData.operador}\n`,
        '------------------------------------------\n',
        '\x1B\x61\x00', // Left
        `Cliente: ${compData.cliente.nombre}\n`,
        compData.cliente.cuit ? `Doc: ${compData.cliente.cuit}\n` : '',
        '------------------------------------------\n',
        'Cant  Detalle                        Total\n',
        '------------------------------------------\n'
      ];

      compData.items.forEach(it => {
        const cant = Number(it.cantidad || 1);
        const sub = cant * Number(it.precio || 0);
        const descTxt = `${it.marca ? it.marca + ' ' : ''}${it.desc || it.cod}`.substring(0, 24);
        comandos.push(`${cant.toString().padEnd(4)} ${descTxt.padEnd(25)} ${formatoMoneda(sub).padStart(10)}\n`);
      });

      comandos.push('------------------------------------------\n');
      comandos.push('\x1B\x61\x02'); // Right
      comandos.push(`TOTAL: ${formatoMoneda(compData.total)}\n\n`);

      if (compData.datosAfip?.cae) {
        comandos.push('\x1B\x61\x01');
        comandos.push(`CAE: ${compData.datosAfip.cae} | Vto: ${compData.datosAfip.vtoCae}\n`);
      }

      comandos.push('\n\n\n\x1D\x56\x41\x00'); // Corte automático limpio
      await qz.print(configTicket, comandos);
      return true;
    } catch (e) {
      console.warn("Fallo QZ Tray, usando fallback web:", e);
      return false;
    }
  };

  const ejecutarImpresionYSalir = async () => {
    if (opcionesImpresion.ticket) {
      const salioPorQz = await imprimirTicketQZ(comprobanteEmitido);
      if (!salioPorQz) {
        const contenido = document.getElementById('render-oculto-ticket')?.innerHTML;
        if (contenido) {
          const w = window.open('', '_blank', 'width=350,height=600');
          w.document.write('<html><head><title>Impresión</title>');
          w.document.write('<style>@page{size:80mm auto;margin:0;}body{margin:0;padding:0;font-family:monospace;}</style>');
          w.document.write('</head><body>');
          w.document.write(contenido);
          w.document.write('</body></html>');
          w.document.close();
          w.focus();
          setTimeout(() => { w.print(); w.close(); }, 300);
        }
      }
    }

    if (opcionesImpresion.a4) {
      const contenidoA4 = document.getElementById('render-oculto-a4')?.innerHTML;
      if (contenidoA4) {
        const wA4 = window.open('', '_blank', 'width=800,height=900');
        wA4.document.write('<html><head><title>Impresión A4</title>');
        wA4.document.write('<link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">');
        wA4.document.write('</head><body style="background:#fff;">');
        wA4.document.write(contenidoA4);
        wA4.document.write('</body></html>');
        wA4.document.close();
        wA4.focus();
        setTimeout(() => { wA4.print(); wA4.close(); }, 400);
      }
    }

    limpiarYCerrar();
  };

  const manejarEmision = async () => {
    if (!carrito || carrito.length === 0) return alert('El carrito está vacío.');
    if (!directoCtaCte && pagos.length === 0) return alert('Debe ingresar un medio de pago.');
    if (!resumen.estaCuadrado) return alert(`Falta cubrir: ${formatoMoneda(resumen.saldoPendiente)}`);
    if (directoCtaCte && !clienteSeleccionado.id) return alert('Seleccioná un cliente para enviar a Cuenta Corriente.');

    setProcesando(true);

    try {
      let nroGenerado = ''; let infoCae = null; let tipoComprobante = ''; let letraComprobante = '';
      const pagosFinales = directoCtaCte ? [{ id: Date.now(), metodo: 'Cuenta Corriente', base: resumen.totalLista, descuento: 0, recargo: 0, fisicoCobrado: resumen.totalLista }] : pagos;
      const montoCtaCte = directoCtaCte ? resumen.totalLista : pagosFinales.filter(p => p.metodo === 'Cuenta Corriente').reduce((acc, p) => acc + p.fisicoCobrado, 0);

      const ahora = new Date();
      const strFechaHora = ahora.toLocaleDateString('es-AR') + ' ' + ahora.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });

      if (!modoPardo) {
        // 1. EMISIÓN OFICIAL (AFIP)
        const docCliente = clienteSeleccionado.cuit ? clienteSeleccionado.cuit.replace(/-/g, '') : '';
        const condIva = clienteSeleccionado.condicionIva || 'Consumidor Final';
        
        const { data: dataAfip, error: errorAfip } = await dbOficial.functions.invoke('facturacion-afip', { 
          body: { total: resumen.totalFiscal, cliente_doc: docCliente, cliente_iva: condIva } 
        });
        
        if (errorAfip) throw new Error("Fallo AFIP: " + errorAfip.message);
        if (dataAfip.error) throw new Error("AFIP rechazó la factura:\n" + dataAfip.error);

        letraComprobante = dataAfip.tipoComprobante === 1 ? 'A' : 'B';
        nroGenerado = `Factura ${letraComprobante} 00014-${dataAfip.nroComprobante.toString().padStart(8, '0')}`;
        tipoComprobante = 'FISCAL';
        infoCae = { cae: dataAfip.cae, vtoCae: dataAfip.vtoCae };

        await dbOficial.from('ventas').insert([{
          cliente_id: clienteSeleccionado.id,
          cliente_nombre: clienteSeleccionado.nombre,
          total: resumen.totalFiscal,
          nro_comprobante: nroGenerado,
          tipo: 'FISCAL',
          letra: letraComprobante,
          vendedor: usuarioOperador || 'Vendedor',
          estado: 'EMITIDO'
        }]);

        if (montoCtaCte > 0 && clienteSeleccionado.id) {
          const nuevoSaldo = Number(clienteSeleccionado.saldo_fiscal || 0) + montoCtaCte;
          await dbOficial.from('clientes').update({ saldo_fiscal: nuevoSaldo }).eq('id', clienteSeleccionado.id);
          await dbOficial.from('movimientos_cc').insert([{ 
            id: generarId(),
            cliente_id: clienteSeleccionado.id, 
            nro: nroGenerado, 
            fecha: strFechaHora,
            monto: montoCtaCte, 
            fiscal: true, 
            articulos: carrito 
          }]);
        }

      } else {
        // 2. EMISIÓN INTERNA (PARDA)
        const fechaCorta = ahora.toISOString().slice(2, 10).replace(/-/g, '');
        const aleatorio = Math.floor(1000 + Math.random() * 9000);
        nroGenerado = `PRE-${fechaCorta}-${aleatorio}`;
        tipoComprobante = 'PRESUPUESTO';
        letraComprobante = 'X';

        // Si fue pago directo en mostrador (no a cuenta corriente), impacta en caja parda
        if (!directoCtaCte && montoCtaCte < resumen.totalFiscal) {
          await dbParda.from('ventas').insert([{
            cliente_id: clienteSeleccionado.id,
            total: resumen.totalFiscal - montoCtaCte,
            nro_comprobante: nroGenerado,
            tipo: 'INTERNO'
          }]);
        }

        // Si fue a cuenta corriente interna, impacta deudas y movimientos en ambas bases
        if (montoCtaCte > 0 && clienteSeleccionado.id) {
          const nuevoSaldo = Number(clienteSeleccionado.saldo_interno || 0) + montoCtaCte;
          const movPayload = { 
            id: generarId(),
            cliente_id: clienteSeleccionado.id, 
            nro: nroGenerado, 
            fecha: strFechaHora,
            monto: montoCtaCte, 
            fiscal: false, 
            articulos: carrito 
          };

          // Actualizamos saldo en ambas bases para sincronía absoluta
          await Promise.all([
            dbOficial.from('clientes').update({ saldo_interno: nuevoSaldo }).eq('id', clienteSeleccionado.id),
            dbParda.from('clientes').update({ saldo_interno: nuevoSaldo }).eq('id', clienteSeleccionado.id),
            dbOficial.from('movimientos_cc').insert([movPayload]),
            dbParda.from('movimientos_cc').insert([movPayload])
          ]);
        }
      }

      // Descontar stock físico real
      for (const it of carrito) {
        if (it.esManual || it.cod === 'MANUAL') continue;
        const { data: art } = await dbOficial.from('articulos').select('stock').eq('cod', it.cod).single();
        if (art) {
          await dbOficial.from('articulos').update({ stock: Math.max(0, Number(art.stock || 0) - Number(it.cantidad || 1)) }).eq('cod', it.cod);
        }
      }

      const comprobanteData = {
        tipo: tipoComprobante, letra: letraComprobante, nroComprobante: nroGenerado,
        fecha: strFechaHora, cliente: clienteSeleccionado, items: carrito,
        total: resumen.totalFisicoCobrado, pagos: pagosFinales, datosAfip: infoCae,
        operador: usuarioOperador || 'Vendedor'
      };

      if (enviarWhatsapp && whatsappDestino) {
        const telLimpio = whatsappDestino.replace(/\D/g, '');
        const itemsTxt = carrito.map(it => `• ${it.cantidad}x ${it.marca ? it.marca + ' ' : ''}${it.desc || it.cod} ($${it.precio})`).join('%0A');
        const mensajeWpp = `Hola ${clienteSeleccionado.nombre}, te adjuntamos el detalle:%0A%0A*${nroGenerado}*%0ATotal: ${formatoMoneda(resumen.totalFisicoCobrado)}%0A%0A*Detalle:*%0A${itemsTxt}`;
        window.open(`https://api.whatsapp.com/send?phone=${telLimpio}&text=${mensajeWpp}`, '_blank');
      }

      setComprobanteEmitido(comprobanteData);

    } catch (error) {
      alert('❌ Error al procesar:\n' + error.message);
    } finally {
      setProcesando(false);
    }
  };

  const clientesFiltrados = listaClientes.filter(c => 
    c.nombre.toLowerCase().includes(busquedaCliente.toLowerCase()) || 
    (c.cuit && c.cuit.includes(busquedaCliente)) ||
    (c.sobrenombre && c.sobrenombre.toLowerCase().includes(busquedaCliente.toLowerCase()))
  );

  return (
    <div className="position-fixed top-0 start-0 w-100 h-100 bg-dark bg-opacity-75 d-flex justify-content-center align-items-center" style={{ zIndex: 9999 }}>
      {comprobanteEmitido ? (
        <div className="card shadow-lg border-0 d-flex flex-column" style={{ width: '750px', maxHeight: '94vh', borderRadius: '12px' }}>
          <div className="card-header bg-dark text-white d-flex justify-content-between align-items-center py-3">
            <h5 className="modal-title fw-bold m-0">Comprobante Generado</h5>
            <button className="btn-close btn-close-white" onClick={limpiarYCerrar}></button>
          </div>
          <div className="bg-white border-bottom p-2 d-flex justify-content-center gap-2">
            <button className={`btn btn-sm fw-bold ${vistaPrevia === 'TICKET' ? 'btn-dark' : 'btn-outline-dark'}`} onClick={() => setVistaPrevia('TICKET')}>🧾 Ticket (80mm)</button>
            <button className={`btn btn-sm fw-bold ${vistaPrevia === 'A4' ? 'btn-dark' : 'btn-outline-dark'}`} onClick={() => setVistaPrevia('A4')}>📄 Hoja A4</button>
          </div>
          <div id="area-impresion-modal" className="card-body bg-light overflow-auto p-3 d-flex justify-content-center">
            <DocumentoImpresion {...comprobanteEmitido} formato={vistaPrevia} />
          </div>
          <div style={{ position: 'absolute', opacity: 0, pointerEvents: 'none', zIndex: -9999 }}>
            <div id="render-oculto-ticket"><DocumentoImpresion {...comprobanteEmitido} formato="TICKET" /></div>
            <div id="render-oculto-a4"><DocumentoImpresion {...comprobanteEmitido} formato="A4" /></div>
          </div>
          <div className="card-footer bg-white d-flex justify-content-between align-items-center p-3 gap-2">
            <button className="btn btn-outline-danger fw-bold px-4" onClick={limpiarYCerrar} disabled={procesando}>Cerrar sin imprimir</button>
            <button className="btn btn-primary fw-bold px-5 shadow" onClick={ejecutarImpresionYSalir} disabled={procesando}>🖨️ Imprimir y Finalizar</button>
          </div>
        </div>
      ) : (
        <div className="card shadow-lg border-0 d-flex flex-column" style={{ width: '96%', maxWidth: '1450px', height: '92vh', borderRadius: '12px' }}>
          <div className="card-header text-white d-flex justify-content-between align-items-center py-3" style={{ backgroundColor: modoPardo ? colorPardo : colorBordo }}>
            <h4 className="modal-title fw-bold m-0 user-select-none">{modoPardo ? 'Cierre de Caja (Modo Interno X)' : 'Cierre de Caja Fiscal'}</h4>
            <button className="btn-close btn-close-white" onClick={cerrar} disabled={procesando} />
          </div>
          <div className="card-body p-4 bg-light overflow-hidden d-flex flex-column">
            <div className="row flex-grow-1 h-100 g-4">
              
              {/* COMPOSICIÓN PAGO */}
              <div className="col-md-6 d-flex flex-column h-100">
                <h6 className="fw-bold text-muted mb-3 text-uppercase small">1. Composición del Pago</h6>
                <div className="card border-0 shadow-sm flex-grow-1 d-flex flex-column">
                  <div className="card-body p-3 d-flex flex-column">
                    <div className="row mb-3 border-bottom pb-3">
                      <div className="col">
                        <div className="small text-muted fw-bold">TOTAL A CANCELAR</div>
                        <div className="fs-3 fw-bold font-monospace text-primary">
                          {directoCtaCte ? '$ 0,00 (A Cuenta Corriente)' : formatoMoneda(resumen.saldoPendiente)}
                        </div>
                      </div>
                    </div>

                    {directoCtaCte ? (
                      <div className="alert alert-info border-info d-flex align-items-center p-3 my-auto">
                        <div className="fs-3 me-3">📒</div>
                        <div>
                          <strong className="d-block">Comprobante directo a Cuenta Corriente</strong>
                          <span className="small text-muted">Se imputará una deuda de <strong>{formatoMoneda(resumen.totalLista)}</strong> en la cuenta de <strong>{clienteSeleccionado.nombre}</strong>.</span>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="border rounded p-3 bg-light mb-3 shadow-sm">
                          <div className="row g-2 align-items-end">
                            <div className="col-md-5">
                              <label className="form-label small fw-bold text-muted mb-1">MEDIO DE PAGO</label>
                              <select className="form-select fw-bold" value={metodoSeleccionado} onChange={(e) => setMetodoSeleccionado(e.target.value)} disabled={procesando || resumen.estaCuadrado}>
                                {mediosPagoConfig.map((m) => (
                                  <option key={m.nombre} value={m.nombre}>
                                    {m.nombre} {m.tipo === 'DESCUENTO' ? `(-${m.porcentaje}%)` : m.tipo === 'RECARGO' ? `(+${m.porcentaje}%)` : ''}
                                  </option>
                                ))}
                              </select>
                            </div>
                            <div className="col-md-4">
                              <label className="form-label small fw-bold text-muted mb-1">PARTE A COBRAR</label>
                              <div className="input-group">
                                <span className="input-group-text">$</span>
                                <input type="number" min="0" step="0.01" className="form-control fw-bold font-monospace" value={montoIngresado} onChange={(e) => setMontoIngresado(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') agregarPago(); }} disabled={procesando || resumen.estaCuadrado} />
                              </div>
                            </div>
                            <div className="col-md-3">
                              <button className="btn btn-secondary fw-bold w-100" onClick={agregarPago} disabled={procesando || resumen.estaCuadrado}>Agregar</button>
                            </div>
                          </div>
                        </div>

                        <div className="flex-grow-1 border rounded bg-white overflow-auto mb-3" style={{ minHeight: '160px' }}>
                          <table className="table table-sm table-hover mb-0 align-middle">
                            <thead className="table-light sticky-top" style={{ fontSize: '11px' }}>
                              <tr>
                                <th className="ps-2">MÉTODO</th>
                                <th className="text-end">BASE</th>
                                <th className="text-end">AJUSTE</th>
                                <th className="text-end text-primary">A COBRAR</th>
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
                          <div className="small fw-bold text-muted">Total Recaudado: <span className="text-dark fs-5 font-monospace">{formatoMoneda(resumen.totalFisicoCobrado)}</span></div>
                          <button className="btn btn-sm btn-outline-danger" onClick={limpiarPagos} disabled={procesando || pagos.length === 0}>Limpiar pagos</button>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* CLIENTE */}
              <div className="col-md-3 d-flex flex-column h-100">
                <h6 className="fw-bold text-muted mb-3 text-uppercase small">2. Cliente</h6>
                <div className="card border-0 shadow-sm p-3 mb-3 bg-white flex-grow-1 d-flex flex-column">
                  <div className="d-flex justify-content-between align-items-center mb-2">
                    <span className="small text-muted fw-bold">DESTINATARIO</span>
                    <button className="btn btn-sm btn-outline-primary fw-bold" onClick={() => setMostrarModalClientes(true)}>🔍 Buscar</button>
                  </div>
                  <div className="p-3 bg-light rounded border mb-3">
                    <div className="fw-bold fs-6 text-dark">{clienteSeleccionado.nombre}</div>
                    <div className="small text-muted font-monospace">{clienteSeleccionado.cuit || 'Sin CUIT'}</div>
                    <div className="small text-muted">{clienteSeleccionado.condicionIva}</div>
                  </div>

                  {clienteSeleccionado.id && (
                    <div className="form-check form-switch p-3 bg-light rounded border mb-3">
                      <input className="form-check-input ms-0 me-2" type="checkbox" id="switchCtaCte" checked={directoCtaCte} onChange={(e) => { setDirectoCtaCte(e.target.checked); if (e.target.checked) setPagos([]); }} />
                      <label className="form-check-label fw-bold text-dark small" htmlFor="switchCtaCte" style={{ cursor: 'pointer' }}>Enviar directo a Cta. Cte.</label>
                    </div>
                  )}

                  {clienteSeleccionado.id && (
                    <div className="p-2 border rounded bg-white small mb-3">
                      <div className="d-flex justify-content-between"><span className="text-muted">Deuda Oficial:</span><strong className="font-monospace">{formatoMoneda(clienteSeleccionado.saldo_fiscal)}</strong></div>
                      <div className="d-flex justify-content-between"><span className="text-muted">Deuda Parda (X):</span><strong className="font-monospace text-danger">{formatoMoneda(clienteSeleccionado.saldo_interno)}</strong></div>
                    </div>
                  )}

                  {clienteSeleccionado.id && (
                    <button className="btn btn-sm btn-outline-secondary w-100 mt-auto" onClick={() => { setClienteSeleccionado({ id: null, nombre: 'Consumidor Final', cuit: '', condicionIva: 'Consumidor Final', direccion: '', telefono: '', email: '', saldo_fiscal: 0, saldo_interno: 0 }); setDirectoCtaCte(false); }}>
                      Restablecer a C. Final
                    </button>
                  )}
                </div>
              </div>

              {/* FORMATOS E IMPRESIÓN */}
              <div className="col-md-3 d-flex flex-column h-100">
                <h6 className="fw-bold text-muted mb-3 text-uppercase small">3. Impresión y Envío</h6>
                <div className="card border-0 shadow-sm p-3 mb-3 bg-white flex-grow-1">
                  <label className="small fw-bold text-muted mb-2">FORMATO</label>
                  <div className="d-flex flex-column gap-2 mb-4">
                    <label className={`btn w-100 fw-bold border text-start ${opcionesImpresion.ticket ? 'btn-primary' : 'btn-light'}`} style={{ cursor: 'pointer' }}>
                      <input type="checkbox" className="form-check-input me-2" checked={opcionesImpresion.ticket} onChange={e => setOpcionesImpresion({...opcionesImpresion, ticket: e.target.checked})} />🧾 Ticket 80mm
                    </label>
                    <label className={`btn w-100 fw-bold border text-start ${opcionesImpresion.a4 ? 'btn-primary' : 'btn-light'}`} style={{ cursor: 'pointer' }}>
                      <input type="checkbox" className="form-check-input me-2" checked={opcionesImpresion.a4} onChange={e => setOpcionesImpresion({...opcionesImpresion, a4: e.target.checked})} />📄 Hoja A4
                    </label>
                  </div>

                  <label className="small fw-bold text-muted mb-2">WHATSAPP</label>
                  <div className="border rounded p-2 mb-2 bg-light">
                    <div className="form-check form-switch mb-1">
                      <input className="form-check-input" type="checkbox" id="checkWpp" checked={enviarWhatsapp} onChange={(e) => setEnviarWhatsapp(e.target.checked)} />
                      <label className="form-check-label small fw-bold text-success" htmlFor="checkWpp">Enviar por WhatsApp</label>
                    </div>
                    {enviarWhatsapp && (
                      <input type="text" className="form-control form-control-sm mt-2 border-success" placeholder="N° WhatsApp (2954...)" value={whatsappDestino} onChange={(e) => setWhatsappDestino(e.target.value)} />
                    )}
                  </div>
                </div>
              </div>

            </div>
          </div>
          
          <div className="card-footer bg-white d-flex justify-content-between align-items-center p-4">
            <button className="btn btn-outline-secondary fw-bold px-4 py-2" onClick={cerrar} disabled={procesando}>Volver</button>
            <button className="btn fw-bold px-5 py-3 shadow text-white" style={{ backgroundColor: modoPardo ? colorPardo : colorBordo, fontSize: '1.15rem', opacity: resumen.estaCuadrado ? 1 : 0.5 }} onClick={manejarEmision} disabled={procesando || !resumen.estaCuadrado}>
              {procesando ? 'PROCESANDO...' : (modoPardo ? 'GENERAR COMPROBANTE (X)' : 'FACTURAR EN AFIP')}
            </button>
          </div>
        </div>
      )}

      {mostrarModalClientes && (
        <div className="position-fixed top-0 start-0 w-100 h-100 bg-dark bg-opacity-75 d-flex justify-content-center align-items-center" style={{ zIndex: 10000 }}>
          <div className="card shadow-lg border-0" style={{ width: '600px', maxHeight: '80vh', borderRadius: '12px' }}>
            <div className="card-header bg-dark text-white d-flex justify-content-between align-items-center">
              <h5 className="modal-title fw-bold m-0">Seleccionar Cliente</h5>
              <button className="btn-close btn-close-white" onClick={() => setMostrarModalClientes(false)}></button>
            </div>
            <div className="card-body p-3">
              <input type="text" className="form-control mb-3" placeholder="🔍 Buscar por nombre, CUIT o sobrenombre..." value={busquedaCliente} onChange={(e) => setBusquedaCliente(e.target.value)} autoFocus />
              <div className="list-group overflow-auto" style={{ maxHeight: '50vh' }}>
                {clientesFiltrados.map(c => (
                  <button key={c.id} className="list-group-item list-group-item-action p-3 text-start" onClick={() => { setClienteSeleccionado(c); setMostrarModalClientes(false); }}>
                    <div className="fw-bold">{c.nombre} {c.sobrenombre ? `(${c.sobrenombre})` : ''}</div>
                    <div className="small text-muted font-monospace">{c.cuit || 'Sin CUIT'} - {c.condicionIva}</div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}