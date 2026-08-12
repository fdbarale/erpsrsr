import React, { useState, useEffect, useRef } from 'react';
import qz from 'qz-tray';
import { dbOficial, dbInterna } from '../supabaseClient';

const configPagos = [
  { id: 'EFE', nombre: 'Efectivo', recargo: -10 },
  { id: 'DEB', nombre: 'Tarjeta Débito', recargo: 0 },
  { id: 'TC3', nombre: 'Tarjeta Crédito (3 Cuotas)', recargo: 15 },
  { id: 'TC1', nombre: 'Tarjeta Crédito (1 Pago)', recargo: 10 },
  { id: 'TRF', nombre: 'Transferencia', recargo: 0 },
  { id: 'CTA', nombre: 'Cuenta Corriente', recargo: 0, requiereCtaCte: true },
];

export default function FacturacionModal({ totalCarrito, cerrar, vaciarYConfirmar, carrito }) {
  const [pagos, setPagos] = useState([]);
  const [metodoActual, setMetodoActual] = useState(configPagos[0].id);
  const [montoAingresar, setMontoAingresar] = useState('');
  const [clientesBd, setClientesBd] = useState([]);
  const [busquedaCliente, setBusquedaCliente] = useState('');
  const [clienteSeleccionado, setClienteSeleccionado] = useState(null);
  const [modoAltaCliente, setModoAltaCliente] = useState(false);
  const [nuevoCliente, setNuevoCliente] = useState({
    doc: '',
    nombre: '',
    email: '',
    tel: '',
    tipo: 'Consumidor Final',
  });
  const [tipoComprobante, setTipoComprobante] = useState('INTERNO');
  const [salidaTicket, setSalidaTicket] = useState(true);
  const [salidaA4, setSalidaA4] = useState(false);
  const [procesando, setProcesando] = useState(false);

  const docRef = useRef(null);
  const inputBusquedaRef = useRef(null);
  const colorBordo = '#6B1116';

  useEffect(() => {
    docRef.current?.focus();
    if (!qz.websocket.isActive()) {
      qz.websocket.connect().catch((err) => console.error('Error QZ:', err));
    }

    const cargarClientes = async () => {
      const { data: ofic } = await dbOficial.from('clientes').select('*');
      const { data: inter } = await dbInterna.from('clientes_internos').select('id, saldo_interno');

      if (ofic) {
        const fusionados = ofic.map((c) => {
          const cPardo = inter?.find((p) => p.id === c.id);
          return {
            ...c,
            saldo_interno: cPardo?.saldo_interno || 0,
            doc: c.cuit || '', 
          };
        });
        setClientesBd(fusionados);
      }
    };
    cargarClientes();
  }, []);

  const formatoMoneda = (valor) => parseFloat(valor).toFixed(2);
  const formatoVista = (valor) => '$ ' + Math.round(parseFloat(valor) || 0).toLocaleString('es-AR');

  const baseCubiertaPorPagos = pagos.reduce((acc, p) => acc + p.baseCubierta, 0);
  const saldoRestanteBase = Math.max(0, Math.round(totalCarrito - baseCubiertaPorPagos));

  useEffect(() => {
    if (saldoRestanteBase > 0.1) {
      const config = configPagos.find((p) => p.id === metodoActual);
      let fisicoSugerido = 0;
      if (config.recargo < 0) {
        fisicoSugerido = saldoRestanteBase / (1 + Math.abs(config.recargo) / 100);
      } else if (config.recargo > 0) {
        fisicoSugerido = saldoRestanteBase * (1 + config.recargo / 100);
      } else {
        fisicoSugerido = saldoRestanteBase;
      }
      setMontoAingresar(Math.round(fisicoSugerido).toString());
    } else {
      setMontoAingresar('');
    }
  }, [saldoRestanteBase, metodoActual]);

  const agregarPago = () => {
    const fisicoIngresado = Math.round(parseFloat(montoAingresar));
    if (!fisicoIngresado || fisicoIngresado <= 0) return;

    const config = configPagos.find((p) => p.id === metodoActual);

    if (config.requiereCtaCte && !clienteSeleccionado) {
      alert('Debe seleccionar un cliente validado para cobrar en Cuenta Corriente.');
      return;
    }

    let baseSaldada = 0;
    let fisicoFinalEfectivo = fisicoIngresado;
    let descuentoCalculado = 0;
    let recargoCalculado = 0;

    if (config.recargo < 0) {
      descuentoCalculado = fisicoIngresado * (Math.abs(config.recargo) / 100);
      baseSaldada = fisicoIngresado + descuentoCalculado;
      if (baseSaldada > saldoRestanteBase) {
        baseSaldada = saldoRestanteBase;
        fisicoFinalEfectivo = Math.round(baseSaldada / (1 + Math.abs(config.recargo) / 100));
        descuentoCalculado = baseSaldada - fisicoFinalEfectivo;
      }
    } else if (config.recargo > 0) {
      baseSaldada = fisicoIngresado / (1 + config.recargo / 100);
      if (baseSaldada > saldoRestanteBase) {
        baseSaldada = saldoRestanteBase;
        fisicoFinalEfectivo = Math.round(baseSaldada * (1 + config.recargo / 100));
      }
      recargoCalculado = fisicoFinalEfectivo - baseSaldada;
    } else {
      baseSaldada = fisicoIngresado;
      if (baseSaldada > saldoRestanteBase) baseSaldada = saldoRestanteBase;
      fisicoFinalEfectivo = baseSaldada;
    }

    const nuevoPago = {
      id: Date.now(),
      metodoNombre: config.nombre,
      metodoId: config.id,
      montoFisico: fisicoFinalEfectivo,
      baseCubierta: baseSaldada,
      descuento: Math.round(descuentoCalculado),
      recargo: Math.round(recargoCalculado),
    };

    setPagos([...pagos, nuevoPago]);
    inputBusquedaRef.current?.focus();
  };

  const quitarPago = (id) => setPagos(pagos.filter((p) => p.id !== id));

  const totalDescuentos = pagos.reduce((acc, p) => acc + p.descuento, 0);
  const totalRecargos = pagos.reduce((acc, p) => acc + p.recargo, 0);
  const totalNetoAFIP = totalCarrito - totalDescuentos + totalRecargos;

  const buscarCliente = () => {
    const term = busquedaCliente.toLowerCase().trim();
    if (!term) return;

    const encontrado = clientesBd.find(
      (c) => c.doc.includes(term) || c.nombre.toLowerCase().includes(term)
    );

    if (encontrado) {
      setClienteSeleccionado(encontrado);
      setModoAltaCliente(false);
      setBusquedaCliente('');
      if (encontrado.tipo === 'Responsable Inscripto') {
        setTipoComprobante('FACTURA');
      } else {
        setTipoComprobante('INTERNO');
      }
    } else {
      setClienteSeleccionado(null);
      setModoAltaCliente(true);
      setNuevoCliente({
        ...nuevoCliente,
        doc: /^\d+$/.test(term) ? term : '',
        nombre: /^\d+$/.test(term) ? '' : term.toUpperCase(),
      });
    }
  };

  const padR = (str, len) => str.toString().substring(0, len).padEnd(len);
  const padL = (str, len) => str.toString().substring(0, len).padStart(len);

  const ejecutarColaImpresion = async (nroComprobante) => {
    try {
      const fechaEmi = new Date();
      const strFecha = fechaEmi.toLocaleDateString('es-AR');
      const strHora = fechaEmi.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });

      const titular = clienteSeleccionado ? clienteSeleccionado.nombre.toUpperCase() : 'CONSUMIDOR FINAL';
      const docTitu = clienteSeleccionado ? clienteSeleccionado.doc : '1';
      const condIva = clienteSeleccionado ? (clienteSeleccionado.tipo || 'CONSUMIDOR FINAL').toUpperCase() : 'CONSUMIDOR FINAL';

      // 1. DISPARO A LA TIQUEADORA
      if (salidaTicket) {
        if (!qz.websocket.isActive()) await qz.websocket.connect();
        const configTicket = qz.configs.create('EPSON TM-T20II Receipt5');
        
        let comandos = [
          '\x1B\x40',
          '\x1B\x61\x00',
          'RSR REPUESTOS\n',
          'C.U.I.T.: 27-10614590-9\n',
          'Ingresos Brutos: 173070/4\n',
          'Inicio de Actividades: 1-8-94\n',
          'LA PAMPA\n',
          `FECHA: ${strFecha} ${strHora} a. m.\n`,
          `Nro: ${nroComprobante}\n`,
          `\n${titular}\n`,
          `DNI/CUIT: ${docTitu}\n`,
          `IVA: (CF) ${condIva}\n`,
          'CONDICION DE VENTA: MIXTO\n',
          'CANT DESCRIPCION           P.UNIT     TOTAL  \n',
          '------------------------------------------\n',
        ];

        carrito.forEach(item => {
          comandos.push(
            `${item.cantidad} ${padR(item.desc.substring(0,17), 17)} ${padL(formatoMoneda(item.precio), 9)} ${padL(formatoMoneda(item.precio * item.cantidad), 9)}\n`
          );
        });

        comandos.push('------------------------------------------\n');
        comandos.push(`${padL('SUBTOTAL', 20)} ${padL(formatoMoneda(totalCarrito), 21)}\n`);

        if (totalDescuentos > 0) {
          comandos.push(`DESCUENTO APLICADO ${padL('-' + formatoMoneda(totalDescuentos), 23)}\n`);
        }
        if (totalRecargos > 0) {
          comandos.push(`RECARGO FINANCIERO ${padL('+' + formatoMoneda(totalRecargos), 23)}\n`);
        }

        comandos.push(`${padL('NETO', 20)} ${padL(formatoMoneda(totalNetoAFIP), 21)}\n\n`);
        comandos.push('\x1B\x45\x01');
        comandos.push(`${padL('TOTAL', 20)} ${padL(formatoMoneda(totalNetoAFIP), 21)}\n`);
        comandos.push('\x1B\x45\x00');
        comandos.push('------------------------------------------\n');
        comandos.push('FORMA DE PAGO:\n');

        pagos.forEach((p) => {
          comandos.push(`${padR(p.metodoNombre, 25)} ${padL(formatoMoneda(p.montoFisico), 16)}\n`);
        });

        comandos.push('\n\n\x1B\x61\x01');
        
        if (tipoComprobante === 'FACTURA') {
          comandos.push(`CAE: ${Math.floor(10000000000000 + Math.random() * 90000000000000)}\n\n`);
        } else {
          comandos.push('DOCUMENTO NO VALIDO COMO FACTURA\n\n');
        }
        
        comandos.push('Regimen de transparencia\n');
        comandos.push('fiscal al consumidor (ley 27.743)\n');
        comandos.push('\n\n\n\n\n\x1D\x56\x41\x00');

        await qz.print(configTicket, comandos);
      }

      // 2. DISPARO A4
      if (salidaA4) {
        const htmlA4 = `
          <div style="font-family: Arial, sans-serif; color: #000; padding: 20px; font-size:14px; max-width: 800px; margin: auto;">
            <h1 style="margin: 0; font-size: 28px; color: #6B1116;">RSR REPUESTOS</h1>
            <p style="margin: 5px 0 20px 0; color: #555;">Comprobante Nro: ${nroComprobante} <br>Fecha: ${strFecha} ${strHora}</p>
            <table style="width: 100%; border: 1px solid #ccc; padding: 15px; margin-bottom: 25px; border-radius: 8px;">
              <tr>
                <td style="width: 50%;"><strong>Cliente:</strong> ${titular}</td>
                <td style="width: 50%;"><strong>Doc/CUIT:</strong> ${docTitu}</td>
              </tr>
              <tr>
                <td style="padding-top: 10px;"><strong>Condición de Venta:</strong> MIXTO</td>
                <td style="padding-top: 10px;"><strong>Condición IVA:</strong> ${condIva}</td>
              </tr>
            </table>
            <table style="width: 100%; border-collapse: collapse; margin-bottom: 30px;">
              <thead>
                <tr style="background: #f8f9fa; border-bottom: 2px solid #000;">
                  <th style="padding: 10px; text-align: left;">Detalle de Venta</th>
                  <th style="padding: 10px; text-align: right;">Total</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style="padding: 15px 10px; border-bottom: 1px solid #eee;">Artículos Varios de Repuestos del Automotor</td>
                  <td style="padding: 15px 10px; text-align: right; border-bottom: 1px solid #eee; font-family: monospace; font-size: 16px;">${formatoVista(totalCarrito)}</td>
                </tr>
              </tbody>
            </table>
            <div style="display: flex; justify-content: space-between;">
              <div style="width: 45%; border: 1px solid #ccc; padding: 15px; border-radius: 8px;">
                <strong style="display:block; border-bottom:1px solid #ccc; padding-bottom:5px; margin-bottom:10px;">Medios de Pago:</strong>
                <ul style="list-style: none; padding: 0; margin: 0; font-family: monospace;">
                  ${pagos.map((p) => `<li style="display:flex; justify-content:space-between; margin-bottom:5px;"><span>${p.metodoNombre}</span><strong>${formatoVista(p.montoFisico)}</strong></li>`).join('')}
                </ul>
              </div>
              <div style="width: 45%; text-align: right; line-height: 2;">
                Subtotal Original: <span style="font-family: monospace;">${formatoVista(totalCarrito)}</span><br>
                ${totalDescuentos > 0 ? `Descuentos Totales (-): <span style="font-family: monospace; color: green;">-${formatoVista(totalDescuentos)}</span><br>` : ''}
                ${totalRecargos > 0 ? `Recargos Totales (+): <span style="font-family: monospace; color: red;">+${formatoVista(totalRecargos)}</span><br>` : ''}
                <div style="border-top: 2px solid #000; margin-top: 10px; padding-top: 10px;">
                  <h2 style="margin: 0; color: #000; font-size: 22px;">TOTAL LIQUIDADO: <span style="font-family: monospace;">${formatoVista(totalNetoAFIP)}</span></h2>
                </div>
              </div>
            </div>
            <div style="text-align:center; margin-top: 50px; font-size: 12px; color: #888;">
              <p>Régimen de transparencia fiscal al consumidor (ley 27.743)</p>
            </div>
          </div>
        `;

        const printWindow = window.open('', '_blank');
        printWindow.document.write(`
          <html>
            <head>
              <title>Comprobante ${nroComprobante}</title>
              <style>
                body { margin: 0; padding: 0; }
                @media print { @page { margin: 15mm; size: A4; } }
              </style>
            </head>
            <body onload="window.print();">
              ${htmlA4}
            </body>
          </html>
        `);
        printWindow.document.close();
      }
    } catch (err) {
      alert('Error Hardware (Impresión): ' + err.message);
    }
  };

  const finalizarVenta = async () => {
    if (saldoRestanteBase > 1) {
      alert('La deuda del carrito no ha sido saldada.');
      return;
    }
    
    setProcesando(true);
    let nroComprobante = '';

    try {
      const pagoCta = pagos.find(p => p.metodoId === 'CTA');
      const montoFiado = pagoCta ? parseFloat(pagoCta.baseCubierta) : 0;
      const clienteId = clienteSeleccionado ? clienteSeleccionado.id : null;

      // Filtramos la data en crudo para la base
      const itemsPayload = carrito
        .filter(c => !c.esManual && c.cod)
        .map(c => ({ cod: c.cod, cantidad: c.cantidad, desc: c.desc }));

      if (tipoComprobante === 'FACTURA') {
        const { data, error } = await dbOficial.rpc('procesar_venta_oficial', {
          p_es_fiscal: true,
          p_cliente_id: clienteId,
          p_monto_fiado: Number(montoFiado) || 0,
          p_total: Number(totalNetoAFIP) || 0,
          p_items: itemsPayload || []
        });
        if (error) throw error;
        nroComprobante = data;
      } else {
        const { error: errOficial } = await dbOficial.rpc('procesar_venta_oficial', {
          p_es_fiscal: false,
          p_cliente_id: null,
          p_monto_fiado: 0,
          p_total: 0,
          p_items: itemsPayload || []
        });
        if (errOficial) throw errOficial;

        const { data, error: errInterna } = await dbInterna.rpc('procesar_venta_interna', {
          p_cliente_id: clienteId || null,
          p_monto_fiado: Number(montoFiado) || 0,
          p_total: Number(totalNetoAFIP) || 0,
          p_items: itemsPayload || []
        });
        if (errInterna) throw errInterna;
        nroComprobante = data;
      }

      await ejecutarColaImpresion(nroComprobante);
      setProcesando(false);
      vaciarYConfirmar();
    } catch (err) {
      setProcesando(false);
      console.error(err);
      alert("Error crítico registrando la venta. Detalle: " + err.message);
    }
  };

  return (
    <div className="position-fixed top-0 start-0 w-100 h-100 bg-dark bg-opacity-75 d-flex justify-content-center align-items-center" style={{ zIndex: 2000 }}>
      <div className="card shadow-lg border-0 d-flex flex-column overflow-hidden" style={{ width: '92vw', height: '88vh', maxWidth: '1200px', borderRadius: '12px' }}>
        
        <div className="card-header text-white d-flex justify-content-between align-items-center py-2 px-3" style={{ backgroundColor: colorBordo }}>
          <h5 className="mb-0 fw-bold tracking-wide">Cierre de Caja</h5>
          <button className="btn btn-sm btn-close btn-close-white" onClick={cerrar} disabled={procesando}></button>
        </div>

        <div className="card-body p-0 d-flex flex-row overflow-hidden bg-light h-100">
          
          {/* COLUMNA 1: COMPOSICIÓN DEL PAGO */}
          <div className="col-5 p-3 d-flex flex-column border-end bg-white h-100">
            <h6 className="fw-bold mb-3 text-secondary text-uppercase border-bottom pb-1" style={{ fontSize: '0.85rem' }}>
              1. Composición del Pago
            </h6>
            
            <div className="d-flex gap-2 mb-3">
              <select className="form-select form-select-sm fw-bold bg-light shadow-sm" style={{ width: '45%' }} value={metodoActual} onChange={(e) => setMetodoActual(e.target.value)}>
                {configPagos.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nombre}{' '}
                    {p.recargo !== 0 ? `(${p.recargo > 0 ? '+' : ''}${p.recargo}%)` : ''}
                  </option>
                ))}
              </select>
              <div className="input-group input-group-sm shadow-sm" style={{ width: '55%' }}>
                <span className="input-group-text fw-bold text-success bg-white border-end-0">$</span>
                <input
                  type="number"
                  className="form-control fw-bold font-monospace border-start-0 fs-6"
                  value={montoAingresar}
                  onChange={(e) => setMontoAingresar(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && agregarPago()}
                  placeholder="Monto"
                />
                <button className="btn btn-dark fw-bold px-3" onClick={agregarPago} disabled={saldoRestanteBase <= 0}>Add</button>
              </div>
            </div>

            <div className="flex-grow-1 overflow-auto mb-3 border rounded shadow-sm">
              <table className="table table-sm table-hover mb-0 align-middle">
                <thead className="table-light sticky-top">
                  <tr className="text-secondary text-uppercase fw-bold" style={{ fontSize: '0.7rem' }}>
                    <th className="py-2 ps-2">Método</th>
                    <th className="text-end py-2">Monto Neto Cobrado</th>
                    <th className="text-end py-2 pe-2">Cancela de Factura</th>
                  </tr>
                </thead>
                <tbody>
                  {pagos.length === 0 ? (
                    <tr>
                      <td colSpan="3" className="text-center text-muted py-4 small">Ingrese importes físicos...</td>
                    </tr>
                  ) : (
                    pagos.map((p) => (
                      <tr key={p.id} className="border-bottom">
                        <td className="fw-semibold text-dark ps-2" style={{ fontSize: '0.8rem' }}>
                          {p.metodoNombre}
                          <button className="btn btn-sm text-danger ms-2 py-0 px-1 border-0" onClick={() => quitarPago(p.id)}>✖</button>
                        </td>
                        <td className="text-end font-monospace text-dark fw-bold small">{formatoVista(p.montoFisico)}</td>
                        <td className="text-end font-monospace text-secondary small p-2 pe-2">{formatoVista(p.baseCubierta)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="card border-0 shadow-sm mt-auto" style={{ backgroundColor: '#f8f9fa' }}>
              <div className="card-body p-3">
                <div className="d-flex justify-content-between text-secondary mb-1 small">
                  <span>SUBTOTAL LISTA:</span>
                  <span className="font-monospace fw-bold">{formatoVista(totalCarrito)}</span>
                </div>
                {totalDescuentos > 0 && (
                  <div className="d-flex justify-content-between text-success mb-1 small">
                    <span>DESCUENTOS:</span>
                    <span className="font-monospace fw-bold">-{formatoVista(totalDescuentos)}</span>
                  </div>
                )}
                {totalRecargos > 0 && (
                  <div className="d-flex justify-content-between text-danger mb-1 small">
                    <span>RECARGOS (INTERESES):</span>
                    <span className="font-monospace fw-bold">+{formatoVista(totalRecargos)}</span>
                  </div>
                )}
                <div className="d-flex justify-content-between align-items-center mt-2 border-top pt-2">
                  <span className="fw-bold text-dark small">TOTAL A COBRAR:</span>
                  <span className="fs-4 fw-bolder font-monospace text-dark">{formatoVista(totalNetoAFIP)}</span>
                </div>

                {saldoRestanteBase > 1 ? (
                  <div className="text-center p-2 rounded-2 mt-2 fw-bold text-danger small" style={{ border: '1px solid #dc3545' }}>
                    RESTRICCIÓN DE SALDO: FALTA {formatoVista(saldoRestanteBase)}
                  </div>
                ) : (
                  <div className="text-center p-2 rounded-2 mt-2 fw-bold text-white small" style={{ backgroundColor: '#198754' }}>
                    COMPROBANTE CUADRADO AL CENTAVO
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* COLUMNA 2: CLIENTE Y DESTINO FISCAL */}
          <div className="col-5 p-3 d-flex flex-column border-end bg-light h-100 overflow-auto">
            <h6 className="fw-bold mb-3 text-secondary text-uppercase border-bottom pb-1" style={{ fontSize: '0.85rem' }}>
              2. Cliente y Documento
            </h6>
            
            <div className="input-group input-group-sm mb-3 shadow-sm">
              <input
                type="text"
                className="form-control"
                placeholder="CUIT, Razón Social..."
                value={busquedaCliente}
                onChange={(e) => setBusquedaCliente(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && buscarCliente()}
                ref={inputBusquedaRef}
              />
              <button className="btn btn-primary fw-bold" onClick={buscarCliente}>🔍</button>
            </div>

            {clienteSeleccionado ? (
              <div className="card border-success shadow-sm mb-3">
                <div className="card-body p-2">
                  <h6 className="fw-bold mb-0 text-dark" style={{ fontSize: '0.9rem' }}>{clienteSeleccionado.nombre}</h6>
                  <span className="text-secondary font-monospace" style={{ fontSize: '0.75rem' }}>CUIT/DNI: {clienteSeleccionado.doc}</span>
                </div>
              </div>
            ) : (
              <div className="alert alert-light border text-muted text-center shadow-sm mb-3 small py-2">
                Facturación a <strong>Consumidor Final</strong>.
              </div>
            )}

            <div className="card border-0 shadow-sm mt-auto">
              <div className="card-body p-2">
                <label className="fw-bold text-secondary small mb-2 d-block text-uppercase" style={{ fontSize: '0.75rem' }}>
                  Destino Fiscal (Separación de Cajas)
                </label>
                <div className="btn-group-vertical w-100 shadow-sm" role="group">
                  <input
                    type="radio"
                    className="btn-check"
                    name="btnradio"
                    id="btnradio2"
                    checked={tipoComprobante === 'INTERNO'}
                    onChange={() => setTipoComprobante('INTERNO')}
                  />
                  <label className="btn btn-outline-secondary fw-bold text-start py-2" htmlFor="btnradio2">
                    Comprobante Interno (Base Parda)
                  </label>

                  <input
                    type="radio"
                    className="btn-check"
                    name="btnradio"
                    id="btnradio1"
                    checked={tipoComprobante === 'FACTURA'}
                    onChange={() => setTipoComprobante('FACTURA')}
                  />
                  <label className="btn btn-outline-primary fw-bold text-start py-2" htmlFor="btnradio1">
                    Factura Oficial AFIP (Base Oficial)
                  </label>
                </div>
              </div>
            </div>
          </div>

          {/* COLUMNA 3: IMPRESIÓN */}
          <div className="col-2 p-3 d-flex flex-column bg-white h-100">
            <h6 className="fw-bold mb-3 text-secondary text-uppercase border-bottom pb-1 text-center" style={{ fontSize: '0.85rem' }}>
              Impresión
            </h6>
            
            <div className="d-flex flex-column gap-2 h-100">
              <div
                className={`form-check p-2 border rounded-3 d-flex flex-column align-items-center justify-content-center text-center flex-grow-1 ${salidaTicket ? 'bg-primary bg-opacity-10 border-primary' : 'bg-light text-muted'}`}
                onClick={() => setSalidaTicket(!salidaTicket)}
                style={{ cursor: 'pointer' }}
              >
                <span className="fs-3 mb-1">🧾</span>
                <label className="form-check-label fw-bold small" style={{ cursor: 'pointer' }}>Ticket 80mm</label>
              </div>

              <div
                className={`form-check p-2 border rounded-3 d-flex flex-column align-items-center justify-content-center text-center flex-grow-1 ${salidaA4 ? 'bg-primary bg-opacity-10 border-primary' : 'bg-light text-muted'}`}
                onClick={() => setSalidaA4(!salidaA4)}
                style={{ cursor: 'pointer' }}
              >
                <span className="fs-3 mb-1">📄</span>
                <label className="form-check-label fw-bold small" style={{ cursor: 'pointer' }}>Hoja A4</label>
              </div>
            </div>
          </div>

        </div>

        <div className="card-footer bg-white border-top p-3 d-flex justify-content-between align-items-center">
          <button className="btn btn-outline-secondary fw-bold px-4" onClick={cerrar} disabled={procesando}>
            Volver (Esc)
          </button>
          <button
            className="btn btn-lg fw-bolder shadow px-5 text-white"
            style={{ backgroundColor: colorBordo }}
            disabled={saldoRestanteBase > 1 || procesando}
            onClick={finalizarVenta}
          >
            {procesando ? 'Procesando...' : 'CONFIRMAR Y EMITIR (Enter)'}
          </button>
        </div>

      </div>
    </div>
  );
}