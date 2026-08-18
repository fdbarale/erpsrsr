import React, { useState, useEffect, useRef } from 'react';
import qz from 'qz-tray';

// FIJATE QUE AGREGUÉ usuarioOperador ACÁ ABAJO ↓
export default function PresupuestoModal({
  carrito,
  totalCarrito,
  cerrar,
  vaciarYConfirmar,
  usuarioOperador
}) {
  // === CAMPOS EXIGIDOS ===
  const [nombre, setNombre] = useState('');
  const [apellido, setApellido] = useState('');
  const [validezDias, setValidezDias] = useState(7);
  const [vehiculo, setVehiculo] = useState('');
  const [patente, setPatente] = useState('');
  const [chasis, setChasis] = useState('');
  const [telefono, setTelefono] = useState('');
  const [mail, setMail] = useState('');

  // === LOGICA COMERCIAL ===
  const [perfilDestino, setPerfilDestino] = useState('PARTICULAR'); // PARTICULAR o SEGURO
  const [descuentoGral, setDescuentoGral] = useState(0); // Porcentaje de descuento en vivo

  // === PERIFÉRICOS ===
  const [salidaTicket, setSalidaTicket] = useState(false);
  const [salidaA4, setSalidaA4] = useState(true);
  const [salidaWsp, setSalidaWsp] = useState(false);
  const [salidaMail, setSalidaMail] = useState(false);

  const inputRef = useRef(null);
  const colorBordo = '#6B1116';

  useEffect(() => {
    inputRef.current?.focus();
    if (!qz.websocket.isActive()) {
      qz.websocket.connect().catch((err) => console.error('Error QZ:', err));
    }
  }, []);

  const formatoMoneda = (valor) =>
    '$ ' + Math.round(parseFloat(valor) || 0).toLocaleString('es-AR');

  // --- MATEMÁTICA CON DESCUENTO APLICADO EN EL ACTO ---
  const factorDescuento = 1 - (parseFloat(descuentoGral) || 0) / 100;

  const carritoPresupuestado = carrito.map((item) => {
    const precioUnitarioConDescuento = Math.round(
      item.precio * factorDescuento
    );
    return {
      ...item,
      precioPresupuesto: precioUnitarioConDescuento,
      subtotalPresupuesto: precioUnitarioConDescuento * item.cantidad,
    };
  });

  const totalPresupuestoFinal = carritoPresupuestado.reduce(
    (acc, item) => acc + item.subtotalPresupuesto,
    0
  );

  // Proyecciones de cobro para particulares basados en la configuración de FacturacionModal
  const proyeccionesPagoParticular = [
    {
      nombre: 'Efectivo (-10%)',
      total: Math.round(totalPresupuestoFinal * 0.9),
    },
    { nombre: 'Tarjeta Débito (Lista)', total: totalPresupuestoFinal },
    {
      nombre: 'Tarjeta Crédito 1 Pago (+10%)',
      total: Math.round(totalPresupuestoFinal * 1.1),
    },
    {
      nombre: 'Tarjeta Crédito 3 Pagos (+15%)',
      total: Math.round(totalPresupuestoFinal * 1.15),
    },
  ];

  const ejecutarColaImpresionQZ = async (nroPresupuesto) => {
    try {
      if (!qz.websocket.isActive()) await qz.websocket.connect();

      const fechaEmi = new Date();
      const fechaVenc = new Date();
      fechaVenc.setDate(fechaEmi.getDate() + parseInt(validezDias));

      const strFecha = fechaEmi.toLocaleDateString('es-AR');
      const strVenc = fechaVenc.toLocaleDateString('es-AR');
      const strHora = fechaEmi.toLocaleTimeString('es-AR', {
        hour: '2-digit',
        minute: '2-digit',
      });
      const titular =
        `${apellido.toUpperCase()} ${nombre.toUpperCase()}`.trim() ||
        'CONSUMIDOR FINAL';

      // =========================================================
      // FORMATO: TICKET TÉRMICO (EPSON)
      // =========================================================
      if (salidaTicket) {
        const configTicket = qz.configs.create('EPSON TM-T20II Receipt5');
        let comandos = [
          '\x1B\x40',
          '\x1B\x61\x01',
          '\x1B\x45\x01',
          'RSR REPUESTOS\n',
          '\x1B\x45\x00',
          'PRESUPUESTO VALORATIVO\n',
          'NO VALIDO COMO FACTURA\n',
          '--------------------------------\n',
          `Presupuesto: ${nroPresupuesto}\n`,
          `Fecha: ${strFecha} ${strHora}\n`,
          `Atendio: ${usuarioOperador || 'Vendedor'}\n`,
          `Validez: ${strVenc} (${validezDias} dias)\n`,
          '--------------------------------\n',
          '\x1B\x61\x00',
          `Cliente: ${titular}\n`,
          vehiculo ? `Vehiculo: ${vehiculo}\n` : '',
          patente ? `Patente: ${patente.toUpperCase()}\n` : '',
          `Tipo: ${perfilDestino}\n`,
          '--------------------------------\n',
          'Cant  Detalle             Total\n',
          '--------------------------------\n',
        ];

        carritoPresupuestado.forEach((item) => {
          comandos.push(
            `${item.cantidad.toString().padEnd(4)} ${item.desc
              .substring(0, 15)
              .padEnd(16)} ${formatoMoneda(item.subtotalPresupuesto).padStart(
              9
            )}\n`
          );
        });

        comandos.push(
          '--------------------------------\n',
          '\x1B\x61\x02',
          `TOTAL PRESUPUESTO: ${formatoMoneda(totalPresupuestoFinal)}\n`
        );

        if (perfilDestino === 'PARTICULAR') {
          comandos.push(
            '\x1B\x61\x00',
            '\nEstimados de Pago Proyectados:\n',
            proyeccionesPagoParticular
              .map((p) => ` * ${p.nombre}: ${formatoMoneda(p.total)}\n`)
              .join('')
          );
        }

        comandos.push(
          '\n\n\x1B\x61\x01',
          'Precios sujetos a variacion.\n\n\n\n\n',
          '\x1D\x56\x41\x00'
        );
        await qz.print(configTicket, comandos);
      }

      // =========================================================
      // FORMATO: HOJA HOJA A4 (BROTHER)
      // =========================================================
      if (salidaA4) {
        const configBrother = qz.configs.create('Brother HL-1200 series', {
          size: { width: 8.27, height: 11.69 },
          units: 'in',
          margins: 0.4,
        });

        const htmlA4 = `
          <div style="font-family: Arial, sans-serif; color: #000; padding: 15px;">
            <table style="width: 100%; border: 2px solid #000; border-collapse: collapse;">
              <tr>
                <td style="width: 50%; padding: 15px;">
                  <h1 style="margin: 0; color: #6B1116; font-size: 24px;">RSR REPUESTOS</h1>
                  <p style="margin: 5px 0 0 0; font-size: 11px; color:#555;">Santa Rosa - La Pampa | Tel: 2954-XXXXXX</p>
                </td>
                <td style="width: 50%; padding: 15px; text-align: right;">
                  <h2 style="margin: 0; font-size: 20px; letter-spacing:1px;">PRESUPUESTO COMERCIAL</h2>
                  <p style="margin: 5px 0; font-size: 14px; font-family: monospace;"><strong>Nro:</strong> ${nroPresupuesto}</p>
                  <p style="margin: 0; font-size: 13px;"><strong>Fecha:</strong> ${strFecha} ${strHora} &nbsp;&nbsp; <strong>Vence:</strong> ${strVenc}</p>
                  <p style="margin: 2px 0 0 0; font-size: 13px;"><strong>Atendió:</strong> ${usuarioOperador || 'Vendedor'}</p>
                </td>
              </tr>
            </table>

            <table style="width: 100%; border: 2px solid #000; border-top: none; padding: 10px; font-size: 12px; background: #fafafa; line-height:18px;">
              <tr>
                <td style="width: 50%;"><strong>Cliente / Razón:</strong> ${titular}</td>
                <td style="width: 50%;"><strong>Vehículo:</strong> ${
                  vehiculo || 'S/D'
                }</td>
              </tr>
              <tr>
                <td><strong>Teléfono / WhatsApp:</strong> ${
                  telefono || 'S/D'
                }</td>
                <td><strong>Patente:</strong> ${
                  patente.toUpperCase() || 'S/D'
                }</td>
              </tr>
              <tr>
                <td><strong>Correo Electrónico:</strong> ${mail || 'S/D'}</td>
                <td><strong>Nro Chasis:</strong> ${
                  chasis.toUpperCase() || 'S/D'
                }</td>
              </tr>
              <tr>
                <td><strong>Destinado a:</strong> <span style="background:#000; color:#fff; padding:1px 5px; font-weight:bold; font-size:10px;">${perfilDestino}</span></td>
                <td><strong>Plazo Validez:</strong> ${validezDias} días corridos</td>
              </tr>
            </table>

            <table style="width: 100%; margin-top: 15px; border-collapse: collapse; font-size: 12px;">
              <thead>
                <tr style="background: #e9ecef; text-transform: uppercase;">
                  <th style="border: 1px solid #000; padding: 6px; text-align: left;">Código</th>
                  <th style="border: 1px solid #000; padding: 6px; text-align: left;">Descripción del Repuesto</th>
                  <th style="border: 1px solid #000; padding: 6px; text-align: center;">Cant.</th>
                  <th style="border: 1px solid #000; padding: 6px; text-align: right;">P. Unit (Con Desc)</th>
                  <th style="border: 1px solid #000; padding: 6px; text-align: right;">Subtotal</th>
                </tr>
              </thead>
              <tbody>
                ${carritoPresupuestado
                  .map(
                    (item) => `
                  <tr>
                    <td style="border: 1px solid #000; padding: 6px; font-family: monospace;">${
                      item.cod
                    }</td>
                    <td style="border: 1px solid #000; padding: 6px;">${
                      item.desc
                    }</td>
                    <td style="border: 1px solid #000; padding: 6px; text-align: center;">${
                      item.cantidad
                    }</td>
                    <td style="border: 1px solid #000; padding: 6px; text-align: right; font-family: monospace;">${formatoMoneda(
                      item.precioPresupuesto
                    )}</td>
                    <td style="border: 1px solid #000; padding: 6px; text-align: right; font-family: monospace;">${formatoMoneda(
                      item.subtotalPresupuesto
                    )}</td>
                  </tr>
                `
                  )
                  .join('')}
              </tbody>
            </table>

            <table style="width:100%; margin-top: 15px;">
              <tr>
                <td style="width:55%; vertical-align:top;">
                  ${
                    perfilDestino === 'PARTICULAR'
                      ? `
                    <div style="border: 1px solid #000; padding: 8px; background:#fff; font-size:11px;">
                      <strong>Opciones Proyectadas de Pago (Finales Estimados):</strong>
                      <ul style="margin:5px 0 0 0; padding-left:15px; font-family:monospace; line-height:16px;">
                        ${proyeccionesPagoParticular
                          .map(
                            (p) =>
                              `<li>${p.nombre.padEnd(30, '.')}: ${formatoMoneda(
                                p.total
                              )}</li>`
                          )
                          .join('')}
                      </ul>
                    </div>
                  `
                      : '<div style="font-size:11px; color:#555;">Presupuesto estructurado para liquidación de siniestro en Compañía de Seguros.</div>'
                  }
                </td>
                <td style="width:45%; text-align:right; vertical-align:top;">
                  <span style="font-size:13px; font-family:monospace;">Total Base Carrito: ${formatoMoneda(
                    totalCarrito
                  )}</span><br>
                  ${
                    descuentoGral > 0
                      ? `<span style="font-size:12px; color:red; font-family:monospace;">Descuento Otorgado: ${descuentoGral}%</span><br>`
                      : ''
                  }
                  <div style="font-size: 18px; font-weight: bold; margin-top:5px; font-family:monospace;">
                    TOTAL NETO: ${formatoMoneda(totalPresupuestoFinal)}
                  </div>
                </td>
              </tr>
            </table>

            <div style="margin-top: 40px; font-size: 10px; text-align: center; border-top: 1px dashed #000; padding-top: 8px; color:#444;">
              Documento de carácter Informativo Interno. No posee validez fiscal como factura. Los precios consignados quedan congelados únicamente por el plazo de validez estipulado.
            </div>
          </div>
        `;
        await qz.print(configBrother, [
          { type: 'html', format: 'plain', data: htmlA4 },
        ]);
      }
    } catch (err) {
      alert('Error en ruteador de hardware QZ: ' + err.message);
    }
  };

  const procesarGuardadoFinal = async () => {
    const nroPresupuesto = 'PRE-' + Math.floor(100000 + Math.random() * 900000);

    // Ejecuta hardware directo
    await ejecutarColaImpresionQZ(nroPresupuesto);

    // Simulación de canales PDF digitales solicitados
    if (salidaWsp && telefono)
      alert(
        `[PDF Engine]: Compilando presupuesto comprimido y enviando PDF nativo por WhatsApp al: ${telefono}`
      );
    if (salidaMail && mail)
      alert(
        `[SMTP Engine]: Adjuntando archivo PDF de presupuesto y despachando correo electrónico a: ${mail}`
      );

    vaciarYConfirmar();
  };

  return (
    <div
      className="position-fixed top-0 start-0 w-100 h-100 bg-dark bg-opacity-75 d-flex justify-content-center align-items-center"
      style={{ zIndex: 2000 }}
    >
      <div
        className="card shadow-lg border-0 d-flex flex-column overflow-hidden"
        style={{
          width: '92vw',
          height: '88vh',
          maxWidth: '1200px',
          borderRadius: '12px',
        }}
      >
        <div
          className="card-header text-white d-flex justify-content-between align-items-center py-2 px-3"
          style={{ backgroundColor: colorBordo }}
        >
          <h5 className="mb-0 fw-bold tracking-wide">
            📝 Confección de Presupuesto Comercial
          </h5>
          <button
            className="btn btn-sm btn-close btn-close-white"
            onClick={cerrar}
          ></button>
        </div>

        <div className="card-body bg-light p-0 d-flex flex-row overflow-hidden h-100">
          {/* COLUMNA 1: FORMULARIO DE ASIGNACIÓN (7 de 12 de ancho) */}
          <div className="col-8 p-3 bg-white h-100 overflow-auto border-end">
            <h6
              className="fw-bold mb-3 text-secondary text-uppercase border-bottom pb-1"
              style={{ fontSize: '0.8rem' }}
            >
              1. Datos del Cliente y Vehículo
            </h6>

            <div className="row g-2 mb-3">
              <div className="col-4">
                <label
                  className="fw-bold text-muted"
                  style={{ fontSize: '0.75rem' }}
                >
                  Nombre
                </label>
                <input
                  type="text"
                  className="form-control form-control-sm"
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  ref={inputRef}
                  placeholder="Juan"
                />
              </div>
              <div className="col-4">
                <label
                  className="fw-bold text-muted"
                  style={{ fontSize: '0.75rem' }}
                >
                  Apellido
                </label>
                <input
                  type="text"
                  className="form-control form-control-sm"
                  value={apellido}
                  onChange={(e) => setApellido(e.target.value)}
                  placeholder="Pérez"
                />
              </div>
              <div className="col-4">
                <label
                  className="fw-bold text-muted"
                  style={{ fontSize: '0.75rem' }}
                >
                  Validez (Días)
                </label>
                <input
                  type="number"
                  className="form-control form-control-sm text-center font-monospace fw-bold"
                  value={validezDias}
                  onChange={(e) => setValidezDias(e.target.value)}
                  min="1"
                />
              </div>
            </div>

            <div className="row g-2 mb-3">
              <div className="col-5">
                <label
                  className="fw-bold text-muted"
                  style={{ fontSize: '0.75rem' }}
                >
                  Marca / Modelo Vehículo
                </label>
                <input
                  type="text"
                  className="form-control form-control-sm"
                  value={vehiculo}
                  onChange={(e) => setVehiculo(e.target.value)}
                  placeholder="VW Gol Trend 1.6 2015"
                />
              </div>
              <div className="col-3">
                <label
                  className="fw-bold text-muted"
                  style={{ fontSize: '0.75rem' }}
                >
                  Patente
                </label>
                <input
                  type="text"
                  className="form-control form-control-sm font-monospace text-uppercase"
                  value={patente}
                  onChange={(e) => setPatente(e.target.value)}
                  placeholder="AA123BB"
                />
              </div>
              <div className="col-4">
                <label
                  className="fw-bold text-muted"
                  style={{ fontSize: '0.75rem' }}
                >
                  Nro Chasis / Motor
                </label>
                <input
                  type="text"
                  className="form-control form-control-sm font-monospace text-uppercase"
                  value={chasis}
                  onChange={(e) => setChasis(e.target.value)}
                  placeholder="9SBXXXXXXXX..."
                />
              </div>
            </div>

            <div className="row g-2 mb-3">
              <div className="col-6">
                <label
                  className="fw-bold text-muted"
                  style={{ fontSize: '0.75rem' }}
                >
                  WhatsApp / Teléfono
                </label>
                <input
                  type="text"
                  className="form-control form-control-sm font-monospace"
                  value={telefono}
                  onChange={(e) => setTelefono(e.target.value)}
                  placeholder="2954123456"
                />
              </div>
              <div className="col-6">
                <label
                  className="fw-bold text-muted"
                  style={{ fontSize: '0.75rem' }}
                >
                  Email Destinatario
                </label>
                <input
                  type="email"
                  className="form-control form-control-sm"
                  value={mail}
                  onChange={(e) => setMail(e.target.value)}
                  placeholder="cliente@mail.com"
                />
              </div>
            </div>

            <h6
              className="fw-bold mb-3 mt-4 text-secondary text-uppercase border-bottom pb-1"
              style={{ fontSize: '0.8rem' }}
            >
              2. Configuración Comercial Interna
            </h6>
            <div className="row g-2 align-items-center">
              <div className="col-6">
                <label
                  className="fw-bold text-muted mb-1 d-block"
                  style={{ fontSize: '0.75rem' }}
                >
                  Destino del Presupuesto
                </label>
                <div
                  className="btn-group w-100 btn-group-sm shadow-sm"
                  role="group"
                >
                  <input
                    type="radio"
                    className="btn-check"
                    name="presupType"
                    id="p1"
                    checked={perfilDestino === 'PARTICULAR'}
                    onChange={() => setPerfilDestino('PARTICULAR')}
                  />
                  <label className="btn btn-outline-dark fw-bold" htmlFor="p1">
                    👤 Particular
                  </label>

                  <input
                    type="radio"
                    className="btn-check"
                    name="presupType"
                    id="p2"
                    checked={perfilDestino === 'SEGURO'}
                    onChange={() => setPerfilDestino('SEGURO')}
                  />
                  <label className="btn btn-outline-dark fw-bold" htmlFor="p2">
                    🛡️ Seguro / Taller
                  </label>
                </div>
              </div>
              <div className="col-6">
                <label
                  className="fw-bold text-muted mb-1 d-block"
                  style={{ fontSize: '0.75rem' }}
                >
                  Descuento General Aplicado (%)
                </label>
                <div className="input-group input-group-sm shadow-sm">
                  <span className="input-group-text fw-bold bg-light text-danger">
                    %
                  </span>
                  <input
                    type="number"
                    className="form-control text-center fw-bold text-danger font-monospace fs-6"
                    value={descuentoGral}
                    onChange={(e) =>
                      setDescuentoGral(
                        Math.max(
                          0,
                          Math.min(100, parseInt(e.target.value) || 0)
                        )
                      )
                    }
                    min="0"
                    max="100"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* COLUMNA 2: TÓTEM DE SALIDA Y REVISIÓN (4 de 12 de ancho) */}
          <div className="col-4 p-3 d-flex flex-column bg-light h-100">
            <h6
              className="fw-bold mb-2 text-secondary text-uppercase border-bottom pb-1"
              style={{ fontSize: '0.8rem' }}
            >
              3. Revisión de Totales y Canales
            </h6>

            <div
              className="flex-grow-1 overflow-auto bg-white border rounded p-2 mb-3 shadow-sm"
              style={{ maxHeight: '210px' }}
            >
              <table
                className="table table-sm table-borderless mb-0"
                style={{ fontSize: '0.75rem' }}
              >
                <thead>
                  <tr className="border-bottom text-muted">
                    <th>Detalle</th>
                    <th className="text-end">Cant</th>
                    <th className="text-end">Precio unit.</th>
                  </tr>
                </thead>
                <tbody>
                  {carritoPresupuestado.map((item, i) => (
                    <tr key={i} className="border-bottom-0">
                      <td
                        className="text-truncate fw-semibold"
                        style={{ maxWidth: '140px' }}
                      >
                        {item.desc}
                      </td>
                      <td className="text-center font-monospace">
                        {item.cantidad}
                      </td>
                      <td className="text-end font-monospace fw-bold text-dark">
                        {formatoMoneda(item.precioPresupuesto)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* SELECCIÓN MÚLTIPLE DE CANALES */}
            <div className="row g-1 mb-3">
              <div className="col-3">
                <div
                  className={`p-2 border rounded-3 text-center cursor-pointer ${
                    salidaA4
                      ? 'bg-primary bg-opacity-10 border-primary fw-bold text-primary'
                      : 'bg-white text-muted'
                  }`}
                  onClick={() => setSalidaA4(!salidaA4)}
                  style={{ cursor: 'pointer', fontSize: '0.75rem' }}
                >
                  <span className="d-block fs-5">📄</span>Brother A4
                </div>
              </div>
              <div className="col-3">
                <div
                  className={`p-2 border rounded-3 text-center cursor-pointer ${
                    salidaTicket
                      ? 'bg-primary bg-opacity-10 border-primary fw-bold text-primary'
                      : 'bg-white text-muted'
                  }`}
                  onClick={() => setSalidaTicket(!salidaTicket)}
                  style={{ cursor: 'pointer', fontSize: '0.75rem' }}
                >
                  <span className="d-block fs-5">🖨️</span>Epson 80m
                </div>
              </div>
              <div className="col-3">
                <div
                  className={`p-2 border rounded-3 text-center cursor-pointer ${
                    salidaWsp
                      ? 'bg-success bg-opacity-10 border-success fw-bold text-success'
                      : 'bg-white text-muted'
                  }`}
                  onClick={() => setSalidaWsp(!salidaWsp)}
                  style={{ cursor: 'pointer', fontSize: '0.75rem' }}
                >
                  <span className="d-block fs-5">💬</span>Envia PDF
                </div>
              </div>
              <div className="col-3">
                <div
                  className={`p-2 border rounded-3 text-center cursor-pointer ${
                    salidaMail
                      ? 'bg-info bg-opacity-10 border-info fw-bold text-info'
                      : 'bg-white text-muted'
                  }`}
                  onClick={() => setSalidaMail(!salidaMail)}
                  style={{ cursor: 'pointer', fontSize: '0.75rem' }}
                >
                  <span className="d-block fs-5">✉️</span>Envia PDF
                </div>
              </div>
            </div>

            {/* TOTALES DE PRESUPUESTO */}
            <div
              className="card border-0 shadow-sm mt-auto"
              style={{ backgroundColor: '#f8f9fa' }}
            >
              <div className="card-body p-3">
                <div className="d-flex justify-content-between text-secondary mb-1 small">
                  <span>Suma del Carrito:</span>
                  <span className="font-monospace fw-bold text-dark">
                    {formatoMoneda(totalCarrito)}
                  </span>
                </div>
                {descuentoGral > 0 && (
                  <div className="d-flex justify-content-between text-danger mb-1 small">
                    <span>Descuento Directo ({descuentoGral}%):</span>
                    <span className="font-monospace fw-bold">
                      -{formatoMoneda(totalCarrito - totalPresupuestoFinal)}
                    </span>
                  </div>
                )}
                <div className="d-flex justify-content-between align-items-center mt-2 border-top pt-2">
                  <span className="fw-bold text-dark small">TOTAL NETO:</span>
                  <span className="fs-4 fw-bolder font-monospace text-dark">
                    {formatoMoneda(totalPresupuestoFinal)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="card-footer bg-white border-top p-3 d-flex justify-content-between align-items-center">
          <button
            className="btn btn-outline-secondary fw-bold px-4"
            onClick={cerrar}
          >
            Cancelar (Esc)
          </button>
          <button
            className="btn btn-primary btn-lg fw-bolder shadow px-5 text-white"
            style={{ backgroundColor: colorBordo }}
            onClick={procesarGuardadoFinal}
          >
            CONGELAR Y EMITIR (Enter)
          </button>
        </div>
      </div>
    </div>
  );
}