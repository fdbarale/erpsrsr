import React, { useState, useEffect } from 'react';
import { dbOficial, dbInterna } from '../supabaseClient'; // Conexión a la base dual

export default function CuentasCorrientes({ onLevantarComprobante, volverAlMenu }) {
  const [busqueda, setBusqueda] = useState('');
  const [clienteSeleccionado, setClienteSeleccionado] = useState(null);
  const [verInterno, setVerInterno] = useState(false); 
  const [clientesCtaCte, setClientesCtaCte] = useState([]);
  const [procesando, setProcesando] = useState(false);

  // Estados de cobro
  const [pagoEfectivo, setPagoEfectivo] = useState('');
  const [pagoTransferencia, setPagoTransferencia] = useState('');
  const [pagoMercadoPago, setPagoMercadoPago] = useState('');
  const [pagoBilletera, setPagoBilletera] = useState('');

  // Estados de cheques
  const [listaCheques, setListaCheques] = useState([]);
  const [datosChequeAux, setDatosChequeAux] = useState({ banco: '', nro: '', vencimiento: '', firmante: '', monto: '' });
  
  // Estados de comisión
  const [esPagoTercero, setEsPagoTercero] = useState(false);
  const [montoComision, setMontoComision] = useState('');

  const colorBordo = '#6B1116';
  const formatoVista = (valor) => "$ " + Math.round(parseFloat(valor) || 0).toLocaleString('es-AR');

  // === EFECTO DE ARRANQUE: CARGAR CLIENTES Y MOVIMIENTOS ===
  const cargarCuentas = async () => {
    try {
      // Traemos clientes y movimientos de la DB Oficial (Blanco)
      const { data: clientesOficial, error: errCliOfi } = await dbOficial.from('clientes').select('*');
      const { data: movsOficial, error: errMovOfi } = await dbOficial.from('movimientos_cc').select('*');
      
      // Traemos clientes y movimientos de la DB Interna (Negro)
      const { data: clientesInterna, error: errCliInt } = await dbInterna.from('clientes').select('id, saldo_interno');
      const { data: movsInterna, error: errMovInt } = await dbInterna.from('movimientos_cc').select('*');

      if (errCliOfi || errMovOfi || errCliInt || errMovInt) {
          throw new Error("Error obteniendo datos de Supabase");
      }

      // Fusionamos los datos de ambas bases para el frontend
      const clientesArmados = clientesOficial.map(clienteOfi => {
        const matchInterno = clientesInterna.find(ci => ci.id === clienteOfi.id);
        
        // Historial combinado de ambas bases (tildado inicial false)
        const historialCombinado = [
            ...movsOficial.filter(m => m.cliente_id === clienteOfi.id).map(m => ({...m, fiscal: true, tildado: false})),
            ...movsInterna.filter(m => m.cliente_id === clienteOfi.id).map(m => ({...m, fiscal: false, tildado: false}))
        ];

        return {
          ...clienteOfi,
          saldo_interno: matchInterno ? matchInterno.saldo_interno : 0,
          historial: historialCombinado.sort((a, b) => new Date(b.fecha) - new Date(a.fecha)) // Ordenamos más reciente primero
        };
      });

      setClientesCtaCte(clientesArmados);

      // Si había un cliente seleccionado, le actualizamos los datos
      if (clienteSeleccionado) {
          const actualizado = clientesArmados.find(c => c.id === clienteSeleccionado.id);
          if (actualizado) setClienteSeleccionado(actualizado);
      }
    } catch (error) {
        alert("Error cargando cuentas: " + error.message);
    }
  };

  useEffect(() => {
    cargarCuentas();
  }, []); // Se ejecuta una sola vez al montar

  const clientesFiltrados = clientesCtaCte.filter(c => 
    c.nombre.toLowerCase().includes(busqueda.toLowerCase()) || (c.cuit && c.cuit.includes(busqueda))
  );

  const toggleTilde = (comprobanteId) => {
    const historialAct = clienteSeleccionado.historial.map(h => 
      h.id === comprobanteId ? { ...h, tildado: !h.tildado } : h
    );
    setClienteSeleccionado({ ...clienteSeleccionado, historial: historialAct });
  };

  const sumaTildada = clienteSeleccionado?.historial
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

  // --- LEVANTAR REMITO EN NEGRO PARA FACTURARLO EN BLANCO ---
  const procesarLevantarAFacturar = () => {
    const comprobantesTildados = clienteSeleccionado.historial.filter(h => h.tildado);
    if (comprobantesTildados.length === 0) { alert("Tilde primero los remitos internos (X) que desea levantar para facturar."); return; }

    const comprobanteFiscalMezclado = comprobantesTildados.find(h => h.fiscal);
    if(comprobanteFiscalMezclado) { alert("Solo puede levantar comprobantes en negro para facturar. Desmarque los comprobantes fiscales."); return;}

    let articulosAcumulados = [];
    comprobantesTildados.forEach(comp => { 
        if (comp.articulos && comp.articulos.length > 0) {
            articulosAcumulados = [...articulosAcumulados, ...comp.articulos]; 
        }
    });

    if (articulosAcumulados.length === 0) { alert("Los comprobantes seleccionados no tienen repuestos detallados cargados."); return; }

    // No escribimos a la base acá. Solo pasamos los artículos al Mostrador para que los facture.
    // La deuda interna se debe saldar con un "Cobro Combinado" o el mostrador debe anular el remito viejo.
    onLevantarComprobante(articulosAcumulados);
  };


  // --- COBRO COMBINADO USANDO RPC ---
  const ejecutarCobroCombinado = async () => {
    if (!clienteSeleccionado) return;

    const efe = Math.round(parseFloat(pagoEfectivo)) || 0;
    const trans = Math.round(parseFloat(pagoTransferencia)) || 0;
    const mp = Math.round(parseFloat(pagoMercadoPago)) || 0;
    const bill = Math.round(parseFloat(pagoBilletera)) || 0;
    const comision = Math.round(parseFloat(montoComision)) || 0;

    const totalIngresado = efe + trans + mp + bill + totalCheques;

    if (totalIngresado <= 0) { alert("Ingrese un importe en al menos uno de los medios de pago simultáneos."); return; }
    if (bill > clienteSeleccionado.saldo_billetera_negro) { alert("Saldo insuficiente en Billetera Virtual para aplicar ese cobro."); return; }
    if (sumaTildada <= 0) { alert("Tilde en la tabla superior qué facturas se están pagando con este dinero."); return; }

    setProcesando(true);

    try {
        let remanenteSobrante = 0;
        if (totalIngresado > sumaTildada) remanenteSobrante = totalIngresado - sumaTildada;

        // Billetera = Remanente S a favor + comision de tercero - lo que usó de la billetera actual
        const ajusteBilleteraTotal = remanenteSobrante + comision - bill;

        let deudasMataFiscal = clienteSeleccionado.historial.filter(h => h.tildado && h.fiscal).reduce((acc, h) => acc + Number(h.monto), 0);
        let deudasMataInterno = clienteSeleccionado.historial.filter(h => h.tildado && !h.fiscal).reduce((acc, h) => acc + Number(h.monto), 0);

        // Si el total ingresado no cubre toda la deuda tildada, prorrateamos o tiramos error?
        // Asumimos que si tildó, paga exacto lo tildado o le sobra (remanente). Si le falta, frena.
        if (totalIngresado < sumaTildada) {
            throw new Error(`Falta dinero. Total tildado: $${sumaTildada} | Ingresado: $${totalIngresado}. No se admiten pagos parciales de comprobantes, pague el total exacto.`);
        }

        const idsPagadosOficial = clienteSeleccionado.historial.filter(h => h.tildado && h.fiscal).map(h => h.id);
        const idsPagadosInterno = clienteSeleccionado.historial.filter(h => h.tildado && !h.fiscal).map(h => h.id);

        // 1. Pegamos en la base Oficial vía RPC
        const { error: errorOficial } = await dbOficial.rpc('cobrar_oficial', {
            p_cliente_id: clienteSeleccionado.id,
            p_pago_fiscal: deudasMataFiscal, 
            p_ajuste_billetera: ajusteBilleteraTotal
        });
        if (errorOficial) throw new Error("Fallo en Base Oficial (RPC): " + errorOficial.message);

        // 2. Pegamos en la base Interna vía RPC
        const { error: errorInterna } = await dbInterna.rpc('cobrar_interna', {
            p_cliente_id: clienteSeleccionado.id,
            p_pago_interno: deudasMataInterno
        });
        if (errorInterna) throw new Error("Fallo en Base Parda (RPC): " + errorInterna.message);

        // 3. Borramos (o marcamos como pagados) los movimientos.
        // Asumo que tu intención es eliminarlos del listado pendiente
        if (idsPagadosOficial.length > 0) {
             await dbOficial.from('movimientos_cc').delete().in('id', idsPagadosOficial);
        }
        if (idsPagadosInterno.length > 0) {
            await dbInterna.from('movimientos_cc').delete().in('id', idsPagadosInterno);
        }

        // Limpieza de inputs UI
        setPagoEfectivo(''); setPagoTransferencia(''); setPagoMercadoPago(''); setPagoBilletera(''); setMontoComision(''); setListaCheques([]); setEsPagoTercero(false);
        
        alert(`¡Cobro Combinado Procesado!\n* Deuda liquidada en bases de datos.\n* Comisión e importes remanentes asentados en la billetera.`);

        // Refrescamos toda la info desde las bases de datos para garantizar consistencia total
        await cargarCuentas();

    } catch (error) {
        alert(error.message);
    } finally {
        setProcesando(false);
    }
  };

  return (
    <div className="bg-white min-vh-100 d-flex flex-column p-3">
      <div className="d-flex justify-content-between align-items-center border-bottom pb-2 mb-3">
        <div>
          <h4 className="fw-bold text-dark m-0">🎒 Billetera Modular RSR</h4>
          <p className="text-muted small m-0">Cobro simultáneo multi-canal y pasarela de remitos a facturación oficial</p>
        </div>
        <div className="d-flex gap-2">
          <div className="form-check form-switch bg-light border rounded px-5 py-1">
            <input className="form-check-input" type="checkbox" checked={verInterno} onChange={() => setVerInterno(!verInterno)} style={{cursor:'pointer'}} />
            <label className="form-check-label small fw-bold text-secondary" style={{cursor:'pointer'}}>Ver Operaciones Ocultas (En Negro)</label>
          </div>
          <button className="btn btn-sm btn-outline-secondary fw-bold" onClick={volverAlMenu} disabled={procesando}>Volver al Menú</button>
        </div>
      </div>

      <div className="row flex-grow-1">
        <div className="col-3 border-end pe-3">
          <input type="text" className="form-control form-control-sm mb-3 shadow-sm" placeholder="🔍 CUIT o Nombre..." value={busqueda} onChange={e => setBusqueda(e.target.value)} />
          <div className="list-group border rounded overflow-auto" style={{maxHeight:'75vh'}}>
            {clientesFiltrados.map(c => (
              <button key={c.id} onClick={() => setClienteSeleccionado(c)} className={`list-group-item list-group-item-action p-2 text-start ${clienteSeleccionado?.id === c.id ? 'active' : ''}`}>
                <div className={`fw-bold small ${clienteSeleccionado?.id === c.id ? 'text-white' : 'text-dark'}`}>{c.nombre}</div>
                <div className="d-flex justify-content-between mt-1">
                  <span className={`small ${clienteSeleccionado?.id === c.id ? 'text-light' : 'text-muted'}`}>
                      Deuda: {formatoVista(Number(c.saldo_fiscal) + (verInterno ? Number(c.saldo_interno) : 0))}
                  </span>
                  {verInterno && <span className={`fw-bold small ${clienteSeleccionado?.id === c.id ? 'text-white' : 'text-success'}`}>
                      Cta: {formatoVista(c.saldo_billetera_negro)}
                  </span>}
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="col-9 ps-3 d-flex flex-column">
          {clienteSeleccionado ? (
            <div className="d-flex flex-column h-100">
              <div className="row g-2 mb-3">
                <div className="col-4">
                  <div className="card bg-dark text-white p-2 border-0 text-center rounded-3">
                    <h3 className="m-0 font-monospace">{formatoVista(clienteSeleccionado.saldo_fiscal)}</h3>
                    <span className="small text-uppercase opacity-50" style={{fontSize:'10px'}}>Deuda Fiscal Oficial</span>
                  </div>
                </div>
                {verInterno && (
                  <div className="col-4">
                    <div className="card bg-secondary text-white p-2 border-0 text-center rounded-3">
                      <h3 className="m-0 font-monospace">{formatoVista(clienteSeleccionado.saldo_interno)}</h3>
                      <span className="small text-uppercase opacity-50" style={{fontSize:'10px'}}>Deuda Interna Oculta (X)</span>
                    </div>
                  </div>
                )}
                <div className="col-4">
                  <div className="card bg-success bg-opacity-10 text-success p-2 border border-success border-opacity-25 text-center rounded-3">
                    <h3 className="m-0 font-monospace text-success">{formatoVista(clienteSeleccionado.saldo_billetera_negro)}</h3>
                    <span className="small text-uppercase text-success fw-bold" style={{fontSize:'10px'}}>Billetera Virtual (Crédito en Negro)</span>
                  </div>
                </div>
              </div>

              <div className="flex-grow-1 border rounded bg-white overflow-auto shadow-sm mb-3" style={{maxHeight:'25vh', minHeight:'15vh'}}>
                <table className="table table-sm table-hover mb-0 align-middle" style={{fontSize:'12px'}}>
                  <thead className="table-dark sticky-top">
                    <tr>
                      <th width="40" className="text-center">✔</th>
                      <th>Fecha</th>
                      <th>Comprobante</th>
                      <th>Detalle Artículos Internos</th>
                      <th className="text-end pe-3">Monto</th>
                    </tr>
                  </thead>
                  <tbody>
                    {clienteSeleccionado.historial && clienteSeleccionado.historial
                      .filter(h => verInterno ? true : h.fiscal)
                      .map((h) => (
                      <tr key={h.id} onClick={() => toggleTilde(h.id)} style={{cursor:'pointer', backgroundColor: h.tildado ? '#19875412' : ''}}>
                        <td className="text-center"><input type="checkbox" checked={h.tildado} onChange={() => {}} style={{cursor:'pointer'}} /></td>
                        <td className="text-muted font-monospace">{h.fecha}</td>
                        <td className="fw-bold font-monospace text-primary">{h.nro} {h.fiscal ? '(AFIP)' : '(Pardo)'}</td>
                        <td className="text-secondary">{h.articulos && h.articulos.length > 0 ? h.articulos.map(a => `${a.cantidad}x ${a.desc}`).join(', ') : 'Ficha de deuda sin detalle'}</td>
                        <td className="text-end fw-bold font-monospace pe-3 text-dark">{formatoVista(h.monto)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="card border shadow-sm p-3 bg-white mt-auto">
                <h6 className="fw-bold text-dark border-bottom pb-1 mb-2">💵 Distribución del Dinero (Cobro Múltiple Simultáneo)</h6>
                <div className="row g-2 mb-3">
                  <div className="col-3"><label className="small fw-bold text-muted mb-1">💵 Efectivo Contado</label><input type="number" className="form-control form-control-sm font-monospace text-success fw-bold" value={pagoEfectivo} onChange={e => setPagoEfectivo(e.target.value)} placeholder="$ 0" /></div>
                  <div className="col-3"><label className="small fw-bold text-muted mb-1">🏦 Transferencia Bancaria</label><input type="number" className="form-control form-control-sm font-monospace fw-bold text-secondary" value={pagoTransferencia} onChange={e => setPagoTransferencia(e.target.value)} placeholder="$ 0" /></div>
                  <div className="col-3"><label className="small fw-bold text-muted mb-1">🔵 Mercado Pago</label><input type="number" className="form-control form-control-sm font-monospace text-primary fw-bold" value={pagoMercadoPago} onChange={e => setPagoMercadoPago(e.target.value)} placeholder="$ 0" /></div>
                  <div className="col-3"><label className="small fw-bold text-muted mb-1">🎒 Usar Billetera (A Favor)</label><input type="number" className="form-control form-control-sm font-monospace text-dark fw-bold" value={pagoBilletera} onChange={e => setPagoBilletera(e.target.value)} placeholder={`Max: ${clienteSeleccionado.saldo_billetera_negro}`} /></div>
                </div>

                <div className="border rounded p-2 mb-3 bg-light">
                  <label className="small fw-bold text-dark mb-1">🛒 Carga de Cheques Recibidos ({listaCheques.length}) - Total Cartera: {formatoVista(totalCheques)}</label>
                  <div className="row g-1 align-items-end mb-2">
                    <div className="col-2"><input type="text" className="form-control form-control-sm" placeholder="Banco Emisor" value={datosChequeAux.banco} onChange={e => setDatosChequeAux({...datosChequeAux, banco: e.target.value})} /></div>
                    <div className="col-2"><input type="text" className="form-control form-control-sm" placeholder="Nro Cheque" value={datosChequeAux.nro} onChange={e => setDatosChequeAux({...datosChequeAux, nro: e.target.value})} /></div>
                    <div className="col-2"><input type="date" className="form-control form-control-sm" value={datosChequeAux.vencimiento} onChange={e => setDatosChequeAux({...datosChequeAux, vencimiento: e.target.value})} title="Fecha Vencimiento"/></div>
                    <div className="col-3"><input type="text" className="form-control form-control-sm" placeholder="Firmante / CUIT" value={datosChequeAux.firmante} onChange={e => setDatosChequeAux({...datosChequeAux, firmante: e.target.value})} /></div>
                    <div className="col-2"><input type="number" className="form-control form-control-sm font-monospace fw-bold" placeholder="Monto $" value={datosChequeAux.monto} onChange={e => setDatosChequeAux({...datosChequeAux, monto: e.target.value})} /></div>
                    <div className="col-1"><button className="btn btn-sm btn-dark w-100 fw-bold" onClick={agregarCheque} title="Añadir cheque a la lista">+</button></div>
                  </div>
                  {listaCheques.length > 0 && (
                    <div className="overflow-auto bg-white border rounded" style={{maxHeight:'80px'}}>
                      <table className="table table-sm table-bordered mb-0" style={{fontSize: '11px'}}>
                        <tbody>
                          {listaCheques.map(chq => (
                            <tr key={chq.id}>
                              <td className="ps-2">🏦 <strong>{chq.banco}</strong> - Nro: #{chq.nro}</td>
                              <td>📅 Vto: {chq.vencimiento || '-'}</td>
                              <td>👤 Firma: {chq.firmante}</td>
                              <td className="text-end fw-bold font-monospace text-dark pe-2">{formatoVista(chq.monto)}</td>
                              <td width="30" className="text-center"><button className="btn btn-sm text-danger opacity-50 py-0 px-1 border-0 bg-transparent" onClick={() => eliminarCheque(chq.id)}>✖</button></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                <div className="row g-2 align-items-center mb-2">
                  <div className="col-auto">
                    <div className="form-check">
                      <input className="form-check-input" type="checkbox" id="thirdp" checked={esPagoTercero} onChange={e => setEsPagoTercero(e.target.checked)} style={{cursor:'pointer'}} />
                      <label className="form-check-label small fw-bold text-dark" htmlFor="thirdp" style={{cursor:'pointer'}}>Asentar Comisión en Billetera Oculta</label>
                    </div>
                  </div>
                  {esPagoTercero && (
                    <div className="col-3">
                      <input type="number" className="form-control form-control-sm border-danger fw-bold font-monospace text-danger" value={montoComision} onChange={e => setMontoComision(e.target.value)} placeholder="Importe de Comisión $" />
                    </div>
                  )}
                </div>

                <div className="border-top pt-2 d-flex justify-content-between align-items-center">
                  <div>
                    <span className="small text-muted d-block">Suma total de deudas tildadas: <strong className="text-danger fs-5 font-monospace">{formatoVista(sumaTildada)}</strong></span>
                  </div>
                  <div className="d-flex gap-2">
                    <button className="btn btn-dark fw-bold px-4 shadow-sm" onClick={procesarLevantarAFacturar} disabled={procesando}>🚀 LEVANTAR PARA FACTURAR OFICIAL</button>
                    <button className="btn text-white fw-bold px-4 shadow" style={{backgroundColor: colorBordo}} onClick={ejecutarCobroCombinado} disabled={procesando}>
                        {procesando ? 'Procesando en Nube...' : 'LIQUIDAR COBRO COMBINADO'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="h-100 d-flex flex-column align-items-center justify-content-center text-muted border border-dashed rounded bg-light">
              <span className="fs-1 opacity-25">🎒</span>
              <p className="small mt-2">Abra una cuenta de deudor a la izquierda para operar la pasarela.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}