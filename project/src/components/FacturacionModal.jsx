import React, { useMemo, useState, useEffect } from 'react';
import { dbOficial, dbParda } from '../supabaseClient';
import DocumentoImpresion from './DocumentoImpresion';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

// FIJATE QUE AGREGUÉ usuarioOperador ACÁ ABAJO ↓
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

  const [enviarEmail, setEnviarEmail] = useState(false);
  const [enviarWhatsapp, setEnviarWhatsapp] = useState(false);
  const [whatsappDestino, setWhatsappDestino] = useState('');
  const [emailDestino, setEmailDestino] = useState('');

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
  }, []);

  useEffect(() => {
    setWhatsappDestino(clienteSeleccionado.telefono || '');
    setEmailDestino(clienteSeleccionado.email || '');
  }, [clienteSeleccionado]);

  useEffect(() => {
    const escucharTeclado = (e) => { if (e.ctrlKey && e.shiftKey && !e.repeat) setModoPardo(prev => !prev); };
    window.addEventListener('keydown', escucharTeclado);
    return () => window.removeEventListener('keydown', escucharTeclado);
  }, []);

  const redondear = (valor) => Math.round((Number(valor) + Number.EPSILON) * 100) / 100;
  const formatoMoneda = (valor) => '$ ' + redondear(valor).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const esUUIDValido = (str) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);

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

  useEffect(() => { if (!directoCtaCte) setMontoIngresado(resumen.saldoPendiente > 0 ? resumen.saldoPendiente.toString() : ''); }, [resumen.saldoPendiente, directoCtaCte]);

  const agregarPago = () => {
    const base = parseFloat(montoIngresado);
    if (!Number.isFinite(base) || base <= 0) return alert('Ingresá un monto válido.');
    if (metodoSeleccionado === 'Cuenta Corriente' && !clienteSeleccionado.id) return alert('Seleccioná un cliente para mandar a CC.');
    const calculado = calcularPago(metodoSeleccionado, base);
    if (redondear(resumen.totalBaseCancelada + calculado.base) > resumen.totalLista + 0.01) return alert(`El monto supera el saldo.\nPendiente: ${formatoMoneda(resumen.saldoPendiente)}`);
    setPagos(prev => [...prev, { id: Date.now(), metodo: metodoSeleccionado, ...calculado }]);
  };

  const eliminarPago = (id) => setPagos(prev => prev.filter(p => p.id !== id));
  const limpiarPagos = () => setPagos([]);

  const limpiarYCerrar = () => { if (typeof vaciarYConfirmar === 'function') vaciarYConfirmar(); if (typeof cerrar === 'function') cerrar(); };

  const mandarAImprimirIframe = (html) => {
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed'; iframe.style.right = '-2000px'; iframe.style.bottom = '-2000px'; iframe.style.width = '0'; iframe.style.height = '0'; iframe.style.border = '0';
    document.body.appendChild(iframe);
    const doc = iframe.contentWindow.document;
    doc.open(); doc.write('<html><head><title>Impresión Comprobante</title>');
    document.querySelectorAll('link[rel="stylesheet"], style').forEach(nodo => doc.write(nodo.outerHTML));
    doc.write('</head><body style="background:white; margin:0; padding:10px;">'); doc.write(html); doc.write('</body></html>'); doc.close();
    iframe.contentWindow.focus();
    setTimeout(() => { iframe.contentWindow.print(); setTimeout(() => { if (document.body.contains(iframe)) document.body.removeChild(iframe); }, 500); }, 500);
  };

  const ejecutarImpresionYSalir = () => {
    const htmlTicket = opcionesImpresion.ticket ? document.getElementById('render-oculto-ticket')?.innerHTML : null;
    const htmlA4 = opcionesImpresion.a4 ? document.getElementById('render-oculto-a4')?.innerHTML : null;
    limpiarYCerrar();
    setTimeout(() => {
      if (htmlTicket) mandarAImprimirIframe(htmlTicket);
      if (htmlA4) setTimeout(() => mandarAImprimirIframe(htmlA4), htmlTicket ? 1500 : 0);
    }, 500);
  };

  useEffect(() => {
    const despacharCorreoPDF = async () => {
      if (comprobanteEmitido && enviarEmail && emailDestino) {
        try {
          const elementoPdf = document.getElementById('render-oculto-a4');
          if (!elementoPdf) return;
          
          const canvas = await html2canvas(elementoPdf, { scale: 2, useCORS: true });
          const imgData = canvas.toDataURL('image/jpeg', 0.8);
          const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
          const pdfWidth = pdf.internal.pageSize.getWidth();
          const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
          pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight);
          const pdfBase64 = pdf.output('datauristring').split(',')[1];

          // ACÁ AJUSTAMOS PARA QUE EN EL MAIL TAMBIÉN MUESTRE LA MARCA JUNTO A LA DESCRIPCIÓN
          const itemsHtml = comprobanteEmitido.items.map(it => {
            const marcaStr = it.marca ? it.marca + ' ' : '';
            const nombreItem = `${marcaStr}${it.descripcion || it.desc || it.cod}`.trim();
            return `<tr><td style="padding:8px; border-bottom:1px solid #ddd;">${it.cantidad}x ${nombreItem}</td><td style="padding:8px; border-bottom:1px solid #ddd; text-align:right;">${formatoMoneda((it.precio_unitario || it.precio) * it.cantidad)}</td></tr>`;
          }).join('');

          const htmlCuerpo = `
            <div style="font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #ddd; border-radius: 8px; overflow: hidden;">
              <div style="background-color: ${modoPardo ? '#212529' : '#6B1116'}; color: white; padding: 20px; text-align: center;">
                <h2 style="margin: 0;">Detalle de Compra</h2><p style="margin: 5px 0 0 0;">Comprobante: ${comprobanteEmitido.nroComprobante}</p>
              </div>
              <div style="padding: 20px;">
                <p>Hola <strong>${comprobanteEmitido.cliente.nombre}</strong>,</p>
                <p>Te enviamos adjunto el comprobante en formato PDF de tu compra realizada el ${comprobanteEmitido.fecha}.</p>
                <table style="width: 100%; border-collapse: collapse; margin-top: 20px;">
                  <thead><tr style="background-color: #f8f9fa;"><th style="padding: 10px; text-align: left; border-bottom: 2px solid #ddd;">Descripción</th><th style="padding: 10px; text-align: right; border-bottom: 2px solid #ddd;">Total</th></tr></thead>
                  <tbody>${itemsHtml}</tbody>
                </table><h3 style="text-align: right; margin-top: 20px;">Total Pagado: ${formatoMoneda(comprobanteEmitido.total)}</h3>
              </div>
            </div>`;

          dbOficial.functions.invoke('enviar-correo', { 
            body: { 
              emailDestino, 
              asunto: `Comprobante - ${comprobanteEmitido.nroComprobante}`, 
              mensajeHtml: htmlCuerpo,
              adjuntoBase64: pdfBase64,
              nombreAdjunto: `${comprobanteEmitido.nroComprobante}.pdf`
            } 
          }).then(({ data, error }) => {
            if (error) console.error("Error SMTP (Red):", error.message);
            else if (data && !data.ok) console.error("Error SMTP (Credenciales):", data.error);
          });
        } catch (e) {
          console.error("Fallo al generar el PDF del correo:", e);
        }
      }
    };

    if (comprobanteEmitido) {
      setTimeout(despacharCorreoPDF, 800); 
    }
  }, [comprobanteEmitido]); 

  const manejarEmision = async () => {
    if (!carrito || carrito.length === 0) return alert('El carrito está vacío.');
    if (!directoCtaCte && pagos.length === 0) return alert('Debe ingresar un medio de pago.');
    if (!resumen.estaCuadrado) return alert(`Falta cubrir: ${formatoMoneda(resumen.saldoPendiente)}`);
    if (directoCtaCte && !clienteSeleccionado.id) return alert('Seleccioná un cliente para enviar a Cuenta Corriente.');

    setProcesando(true);

    try {
      let nroGenerado = ''; let infoCae = null; let tipoComprobante = ''; let letraComprobante = '';
      const clienteIdParaDb = (clienteSeleccionado.id && esUUIDValido(clienteSeleccionado.id)) ? clienteSeleccionado.id : null;
      const pagosFinales = directoCtaCte ? [{ id: Date.now(), metodo: 'Cuenta Corriente', base: resumen.totalLista, descuento: 0, recargo: 0, fisicoCobrado: resumen.totalLista }] : pagos;
      const montoCtaCte = directoCtaCte ? resumen.totalLista : pagosFinales.filter(p => p.metodo === 'Cuenta Corriente').reduce((acc, p) => acc + p.fisicoCobrado, 0);

      if (!modoPardo) {
        const docCliente = clienteSeleccionado.cuit ? clienteSeleccionado.cuit.replace(/-/g, '') : '';
        const condIva = clienteSeleccionado.condicionIva || 'Consumidor Final';
        const { data: dataAfip, error: errorAfip } = await dbOficial.functions.invoke('facturacion-afip', { body: { total: resumen.totalFiscal, cliente_doc: docCliente, cliente_iva: condIva } });
        if (errorAfip) throw new Error("Fallo AFIP: " + errorAfip.message);
        if (dataAfip.error) throw new Error("AFIP rechazó la factura:\n" + dataAfip.error);

        letraComprobante = dataAfip.tipoComprobante === 1 ? 'A' : 'B';
        nroGenerado = `Factura ${letraComprobante} 00014-${dataAfip.nroComprobante.toString().padStart(8, '0')}`;
        tipoComprobante = 'FISCAL';
        infoCae = { cae: dataAfip.cae, vtoCae: dataAfip.vtoCae };

        const { error: errorDb } = await dbOficial.rpc('procesar_venta_interna', { p_cliente_id: clienteIdParaDb, p_total: resumen.totalFiscal, p_items: carrito, p_tipo: 'FISCAL', p_nro_comprobante: nroGenerado });
        if (errorDb) throw new Error("Error en BD Oficial: " + errorDb.message);

        if (montoCtaCte > 0 && clienteSeleccionado.id) {
          const nuevoSaldo = Number(clienteSeleccionado.saldo_fiscal || 0) + montoCtaCte;
          await dbOficial.from('clientes').update({ saldo_fiscal: nuevoSaldo }).eq('id', clienteSeleccionado.id);
          await dbOficial.from('movimientos_cc').insert([{ cliente_id: clienteSeleccionado.id, nro: nroGenerado, monto: montoCtaCte, fiscal: true, articulos: carrito }]);
        }
      } else {
        const fechaCorta = new Date().toISOString().slice(2, 10).replace(/-/g, '');
        const aleatorio = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
        nroGenerado = `Presupuesto X 00014-${fechaCorta}${aleatorio}`;
        tipoComprobante = 'PRESUPUESTO';
        letraComprobante = 'X';

        const { error: errorParda } = await dbParda.rpc('procesar_venta_parda', { p_cliente_id: clienteIdParaDb, p_total: resumen.totalFiscal, p_items: carrito, p_nro_comprobante: nroGenerado });
        if (errorParda) throw new Error("Error en BD Parda: " + errorParda.message);

        const { error: errorStock } = await dbOficial.rpc('descontar_stock_silencioso', { p_items: carrito });
        if (errorStock) throw new Error("Error descontando stock: " + errorStock.message);

        if (montoCtaCte > 0 && clienteSeleccionado.id) {
          const nuevoSaldo = Number(clienteSeleccionado.saldo_interno || 0) + montoCtaCte;
          await dbParda.from('clientes').update({ saldo_interno: nuevoSaldo }).eq('id', clienteSeleccionado.id);
          await dbParda.from('movimientos_cc').insert([{ cliente_id: clienteSeleccionado.id, nro: nroGenerado, monto: montoCtaCte, fiscal: false, articulos: carrito }]);
        }
      }

      const ahora = new Date();
      const fechaHoraTexto = ahora.toLocaleDateString('es-AR') + ' ' + ahora.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });

      const comprobanteData = {
        tipo: tipoComprobante, letra: letraComprobante, nroComprobante: nroGenerado,
        fecha: fechaHoraTexto, cliente: clienteSeleccionado, items: carrito,
        total: resumen.totalFisicoCobrado, pagos: pagosFinales, datosAfip: infoCae,
        operador: usuarioOperador || 'Vendedor'
      };

      if (opcionesImpresion.a4 && !opcionesImpresion.ticket) setVistaPrevia('A4'); else setVistaPrevia('TICKET');

      if (enviarWhatsapp && whatsappDestino) {
        const telLimpio = whatsappDestino.replace(/\D/g, '');
        // ACÁ AJUSTAMOS PARA QUE EN WHATSAPP TAMBIÉN MUESTRE LA MARCA JUNTO A LA DESCRIPCIÓN
        const itemsTxt = carrito.map(it => {
            const marcaStr = it.marca ? it.marca + ' ' : '';
            const nombreItem = `${marcaStr}${it.descripcion || it.desc || it.cod}`.trim();
            return `• ${it.cantidad}x ${nombreItem} ($${it.precio_unitario || it.precio})`;
        }).join('%0A');

        const mensajeWpp = `Hola ${clienteSeleccionado.nombre}, te adjuntamos el detalle de tu compra:%0A%0A*${nroGenerado}*%0ATotal: ${formatoMoneda(resumen.totalFisicoCobrado)}%0A%0A*Detalle:*%0A${itemsTxt}%0A%0A¡Muchas gracias por elegirnos!`;
        window.open(`https://api.whatsapp.com/send?phone=${telLimpio}&text=${mensajeWpp}`, '_blank');
      }

      setComprobanteEmitido(comprobanteData);

    } catch (error) {
      alert('❌ Error al procesar:\n' + error.message);
    } finally {
      setProcesando(false);
    }
  };

  const clientesFiltrados = listaClientes.filter(c => c.nombre.toLowerCase().includes(busquedaCliente.toLowerCase()) || (c.cuit && c.cuit.includes(busquedaCliente)));

  return (
    <div className="position-fixed top-0 start-0 w-100 h-100 bg-dark bg-opacity-75 d-flex justify-content-center align-items-center" style={{ zIndex: 9999 }}>
      {comprobanteEmitido ? (
        <div className="card shadow-lg border-0 d-flex flex-column" style={{ width: '750px', maxHeight: '94vh', borderRadius: '12px' }}>
          <div className="card-header bg-dark text-white d-flex justify-content-between align-items-center py-3">
            <h5 className="modal-title fw-bold m-0">Comprobante Generado con Éxito</h5>
            <button className="btn-close btn-close-white" onClick={limpiarYCerrar}></button>
          </div>
          <div className="bg-white border-bottom p-2 d-flex justify-content-center gap-2">
            <button className={`btn btn-sm fw-bold ${vistaPrevia === 'TICKET' ? 'btn-dark' : 'btn-outline-dark'}`} onClick={() => setVistaPrevia('TICKET')}>🧾 Ver Ticket (80mm)</button>
            <button className={`btn btn-sm fw-bold ${vistaPrevia === 'A4' ? 'btn-dark' : 'btn-outline-dark'}`} onClick={() => setVistaPrevia('A4')}>📄 Ver Hoja A4</button>
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
            <button className="btn btn-primary fw-bold px-5 shadow" onClick={ejecutarImpresionYSalir} disabled={procesando}>🖨️ Imprimir Seleccionados y Finalizar</button>
          </div>
        </div>
      ) : (
        <div className="card shadow-lg border-0 d-flex flex-column" style={{ width: '96%', maxWidth: '1450px', height: '92vh', borderRadius: '12px' }}>
          <div className="card-header text-white d-flex justify-content-between align-items-center py-3" style={{ backgroundColor: modoPardo ? colorPardo : colorBordo, borderTopLeftRadius: '12px', borderTopRightRadius: '12px' }}>
            <h4 className="modal-title fw-bold m-0 user-select-none">{modoPardo ? 'Cierre de Caja (Órdenes Especiales)' : 'Cierre de Caja Fiscal'}</h4>
            <button className="btn-close btn-close-white" onClick={cerrar} disabled={procesando} />
          </div>
          <div className="card-body p-4 bg-light overflow-hidden d-flex flex-column">
            <div className="row flex-grow-1 h-100 g-4">
              <div className="col-md-6 d-flex flex-column h-100">
                <h6 className="fw-bold text-muted mb-3 text-uppercase small">1. Composición del Pago</h6>
                <div className="card border-0 shadow-sm flex-grow-1 d-flex flex-column">
                  <div className="card-body p-3 d-flex flex-column">
                    <div className="row mb-3 border-bottom pb-3"><div className="col"><div className="small text-muted fw-bold">SALDO A CANCELAR</div><div className="fs-3 fw-bold font-monospace text-primary">{directoCtaCte ? '$ 0,00 (A Cuenta Corriente)' : formatoMoneda(resumen.saldoPendiente)}</div></div></div>
                    {directoCtaCte ? (
                      <div className="alert alert-info border-info d-flex align-items-center p-3 my-auto"><div className="fs-3 me-3">📒</div><div><strong className="d-block">Venta Directa a Cuenta Corriente</strong><span className="small text-muted">Se registrará una deuda por <strong>{formatoMoneda(resumen.totalLista)}</strong> a nombre de <strong>{clienteSeleccionado.nombre}</strong>.</span></div></div>
                    ) : (
                      <>
                        <div className="border rounded p-3 bg-light mb-3 shadow-sm">
                          <div className="row g-2 align-items-end">
                            <div className="col-md-5"><label className="form-label small fw-bold text-muted mb-1">MEDIO DE PAGO</label><select className="form-select fw-bold" value={metodoSeleccionado} onChange={(e) => setMetodoSeleccionado(e.target.value)} disabled={procesando || resumen.estaCuadrado}>{mediosPagoConfig.map((m) => (<option key={m.nombre} value={m.nombre}>{m.nombre} {m.tipo === 'DESCUENTO' ? `(-${m.porcentaje}%)` : m.tipo === 'RECARGO' ? `(+${m.porcentaje}%)` : ''}</option>))}</select></div>
                            <div className="col-md-4"><label className="form-label small fw-bold text-muted mb-1">PARTE A COBRAR</label><div className="input-group"><span className="input-group-text">$</span><input type="number" min="0" step="0.01" className="form-control fw-bold font-monospace" value={montoIngresado} onChange={(e) => setMontoIngresado(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') agregarPago(); }} disabled={procesando || resumen.estaCuadrado} /></div></div>
                            <div className="col-md-3"><button className="btn btn-secondary fw-bold w-100" onClick={agregarPago} disabled={procesando || resumen.estaCuadrado}>Agregar</button></div>
                          </div>
                        </div>
                        <div className="flex-grow-1 border rounded bg-white overflow-auto mb-3" style={{ minHeight: '160px' }}>
                          <table className="table table-sm table-hover mb-0 align-middle"><thead className="table-light sticky-top" style={{ fontSize: '11px' }}><tr><th className="ps-2">MÉTODO</th><th className="text-end">BASE</th><th className="text-end">AJUSTE</th><th className="text-end text-primary">A COBRAR</th><th className="text-center" width="45"></th></tr></thead><tbody>{pagos.map((pago) => (<tr key={pago.id}><td className="ps-2 fw-bold text-secondary">{pago.metodo}</td><td className="text-end font-monospace">{formatoMoneda(pago.base)}</td><td className={`text-end font-monospace fw-bold ${pago.descuento > 0 ? 'text-success' : pago.recargo > 0 ? 'text-danger' : 'text-muted'}`}>{pago.descuento > 0 ? `-${formatoMoneda(pago.descuento)}` : pago.recargo > 0 ? `+${formatoMoneda(pago.recargo)}` : '-'}</td><td className="text-end font-monospace fw-bold text-primary">{formatoMoneda(pago.fisicoCobrado)}</td><td className="text-center"><button className="btn btn-sm text-danger py-0 px-1 border-0" onClick={() => eliminarPago(pago.id)} disabled={procesando}>✖</button></td></tr>))}</tbody></table>
                        </div>
                        <div className="d-flex justify-content-between align-items-center"><div className="small fw-bold text-muted">Total a Recaudar: <span className="text-dark fs-5 font-monospace">{formatoMoneda(resumen.totalFisicoCobrado)}</span></div><button className="btn btn-sm btn-outline-danger" onClick={limpiarPagos} disabled={procesando || pagos.length === 0}>Limpiar pagos</button></div>
                      </>
                    )}
                  </div>
                </div>
              </div>

              <div className="col-md-3 d-flex flex-column h-100">
                <h6 className="fw-bold text-muted mb-3 text-uppercase small">2. Cliente y Destino</h6>
                <div className="card border-0 shadow-sm p-3 mb-3 bg-white flex-grow-1 d-flex flex-column">
                  <div className="d-flex justify-content-between align-items-center mb-2"><span className="small text-muted fw-bold">DESTINATARIO</span><button className="btn btn-sm btn-outline-primary fw-bold" onClick={() => setMostrarModalClientes(true)}>🔍 Buscar Cliente</button></div>
                  <div className="p-3 bg-light rounded border mb-3"><div className="fw-bold fs-6 text-dark">{clienteSeleccionado.nombre}</div><div className="small text-muted font-monospace">{clienteSeleccionado.cuit || 'Sin CUIT registrado'}</div><div className="small text-muted">{clienteSeleccionado.condicionIva}</div></div>
                  {clienteSeleccionado.id && (<div className="form-check form-switch p-3 bg-light rounded border mb-3"><input className="form-check-input ms-0 me-2" type="checkbox" id="switchCtaCte" checked={directoCtaCte} onChange={(e) => { setDirectoCtaCte(e.target.checked); if (e.target.checked) setPagos([]); }} /><label className="form-check-label fw-bold text-dark small" htmlFor="switchCtaCte" style={{ cursor: 'pointer' }}>Enviar a Cuenta Corriente</label></div>)}
                  {clienteSeleccionado.id && (<div className="p-2 border rounded bg-white small mb-3"><div className="d-flex justify-content-between"><span className="text-muted">Deuda Oficial:</span><strong className="font-monospace">{formatoMoneda(clienteSeleccionado.saldo_fiscal)}</strong></div><div className="d-flex justify-content-between"><span className="text-muted">Deuda Especial (X):</span><strong className="font-monospace text-danger">{formatoMoneda(clienteSeleccionado.saldo_interno)}</strong></div></div>)}
                  {clienteSeleccionado.id && (<button className="btn btn-sm btn-outline-secondary w-100 mt-auto" onClick={() => { setClienteSeleccionado({ id: null, nombre: 'Consumidor Final', cuit: '', condicionIva: 'Consumidor Final', direccion: '', telefono: '', email: '', saldo_fiscal: 0, saldo_interno: 0 }); setDirectoCtaCte(false); }}>Restablecer a Consumidor Final</button>)}
                </div>
              </div>

              <div className="col-md-3 d-flex flex-column h-100">
                <h6 className="fw-bold text-muted mb-3 text-uppercase small">3. Entrega y Envío</h6>
                <div className="card border-0 shadow-sm p-3 mb-3 bg-white flex-grow-1">
                  <label className="small fw-bold text-muted mb-2">FORMATOS A IMPRIMIR</label>
                  <div className="d-flex flex-column gap-2 mb-4">
                    <label className={`btn w-100 fw-bold border text-start ${opcionesImpresion.ticket ? 'btn-primary' : 'btn-light'}`} style={{ cursor: 'pointer' }}><input type="checkbox" className="form-check-input me-2" checked={opcionesImpresion.ticket} onChange={e => setOpcionesImpresion({...opcionesImpresion, ticket: e.target.checked})} />🧾 Ticket 80mm</label>
                    <label className={`btn w-100 fw-bold border text-start ${opcionesImpresion.a4 ? 'btn-primary' : 'btn-light'}`} style={{ cursor: 'pointer' }}><input type="checkbox" className="form-check-input me-2" checked={opcionesImpresion.a4} onChange={e => setOpcionesImpresion({...opcionesImpresion, a4: e.target.checked})} />📄 Hoja A4</label>
                  </div>
                  <label className="small fw-bold text-muted mb-2">CANALES DIGITALES</label>
                  <div className="border rounded p-2 mb-2 bg-light">
                    <div className="form-check form-switch mb-1"><input className="form-check-input" type="checkbox" id="checkWpp" checked={enviarWhatsapp} onChange={(e) => setEnviarWhatsapp(e.target.checked)} /><label className="form-check-label small fw-bold text-success" htmlFor="checkWpp">Enviar por WhatsApp</label></div>
                    {enviarWhatsapp && (<input type="text" className="form-control form-control-sm mt-2 border-success" placeholder="N° WhatsApp (Ej: 2954123456)" value={whatsappDestino} onChange={(e) => setWhatsappDestino(e.target.value)} />)}
                  </div>
                  <div className="border rounded p-2 bg-light">
                    <div className="form-check form-switch mb-1"><input className="form-check-input" type="checkbox" id="checkMail" checked={enviarEmail} onChange={(e) => setEnviarEmail(e.target.checked)} /><label className="form-check-label small fw-bold text-primary" htmlFor="checkMail">Enviar por Correo</label></div>
                    {enviarEmail && (<input type="email" className="form-control form-control-sm mt-2 border-primary" placeholder="Correo electrónico..." value={emailDestino} onChange={(e) => setEmailDestino(e.target.value)} />)}
                  </div>
                </div>
              </div>

            </div>
          </div>
          <div className="card-footer bg-white d-flex justify-content-between align-items-center p-4" style={{ borderBottomLeftRadius: '12px', borderBottomRightRadius: '12px' }}>
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
            <div className="card-header bg-dark text-white d-flex justify-content-between align-items-center"><h5 className="modal-title fw-bold m-0">Seleccionar Cliente</h5><button className="btn-close btn-close-white" onClick={() => setMostrarModalClientes(false)}></button></div>
            <div className="card-body p-3">
              <input type="text" className="form-control mb-3" placeholder="🔍 Buscar por nombre o CUIT..." value={busquedaCliente} onChange={(e) => setBusquedaCliente(e.target.value)} autoFocus />
              <div className="list-group overflow-auto" style={{ maxHeight: '50vh' }}>
                {clientesFiltrados.map(c => (
                  <button key={c.id} className="list-group-item list-group-item-action p-3 text-start" onClick={() => { setClienteSeleccionado(c); setMostrarModalClientes(false); }}>
                    <div className="fw-bold">{c.nombre}</div><div className="small text-muted font-monospace">{c.cuit || 'Sin CUIT'} - {c.condicionIva}</div>
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