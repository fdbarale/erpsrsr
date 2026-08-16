import React, { useState, useEffect } from 'react';
import { dbOficial, dbParda } from '../supabaseClient';

export default function HistorialComprobantes({ volverAlMenu }) {
  const [busqueda, setBusqueda] = useState('');
  
  // === ESTADOS DE VISTA: 'OFICIAL' -> 'PARDO' -> 'DUAL' ===
  const [modoVista, setModoVista] = useState('OFICIAL');
  const [filtroTipo, setFiltroTipo] = useState('TODOS_FISCAL'); 
  
  const [comprobantes, setComprobantes] = useState([]);
  const [modalDevolucion, setModalDevolucion] = useState(null);
  const [visorComprobante, setVisorComprobante] = useState(null);
  const [procesando, setProcesando] = useState(false);

  const colorBordo = '#6B1116';
  const colorGris = '#54565b';
  const colorPardo = '#212529'; 

  const cargarHistorial = async () => {
    try {
      const [resOficial, resParda] = await Promise.all([
        dbOficial.from('ventas').select('*'),
        dbParda.from('ventas').select('*')
      ]);

      const dataOficial = resOficial.data || [];
      const dataParda = resParda.data || [];

      const unificados = [...dataOficial, ...dataParda]
        .map(v => ({
          id: v.id, 
          fechaRaw: new Date(v.fecha),
          fecha: new Date(v.fecha).toLocaleString('es-AR'), 
          nro: v.nro_comprobante,
          cliente: 'Consumidor Final', 
          tipo: v.tipo, 
          total: v.total, 
          estado: v.estado
        }))
        .sort((a, b) => b.fechaRaw - a.fechaRaw);

      setComprobantes(unificados);
    } catch (err) {
      console.error("Error al cargar historial dual:", err);
    }
  };

  useEffect(() => { cargarHistorial(); }, []);

  const formatoMoneda = (valor) => "$ " + Math.round(parseFloat(valor) || 0).toLocaleString('es-AR');

  // === CICLO DE VISTAS (OFICIAL -> PARDO -> DUAL) ===
  const toggleModoVista = (e) => {
    if (e.ctrlKey) {
      if (modoVista === 'OFICIAL') {
        setModoVista('PARDO');
        setFiltroTipo('TODOS_PARDO');
      } else if (modoVista === 'PARDO') {
        setModoVista('DUAL');
        setFiltroTipo('TODOS');
      } else {
        setModoVista('OFICIAL');
        setFiltroTipo('TODOS_FISCAL');
      }
      setBusqueda('');
    }
  };

  // === FILTRADO BLINDADO POR MODO ===
  const comprobantesFiltrados = comprobantes.filter(c => {
    const coincideBusqueda = c.nro.toLowerCase().includes(busqueda.toLowerCase()) || c.cliente.toLowerCase().includes(busqueda.toLowerCase());
    let coincideTipo = false;

    if (modoVista === 'OFICIAL') {
      if (c.tipo.includes('INTERN')) return false; // Bloqueo matemático
      if (filtroTipo === 'TODOS_FISCAL') coincideTipo = true;
      else coincideTipo = c.tipo === filtroTipo;
    } 
    else if (modoVista === 'PARDO') {
      if (c.tipo.includes('FISCAL')) return false; // Bloqueo matemático
      if (filtroTipo === 'TODOS_PARDO') coincideTipo = true;
      else coincideTipo = c.tipo === filtroTipo;
    } 
    else if (modoVista === 'DUAL') {
      // Muestra todo
      if (filtroTipo === 'TODOS') coincideTipo = true;
      else coincideTipo = c.tipo === filtroTipo;
    }

    return coincideBusqueda && coincideTipo;
  });

  const abrirVisor = async (comp) => {
    try {
      const dbDestino = comp.tipo === 'INTERNO' ? dbParda : dbOficial;
      const { data: items, error } = await dbDestino.from('ventas_items').select('*').eq('venta_id', comp.id);
      if (error) throw new Error(error.message);
      setVisorComprobante({ ...comp, items });
    } catch (err) {
      alert("Error al cargar el detalle: " + err.message);
    }
  };

  const procesarNC_Total = async (comp) => {
    if (comp.tipo === 'INTERNO') {
      if (!window.confirm(`¿Anular remito interno ${comp.nro} y devolver stock?`)) return;
      setProcesando(true);
      try {
        const { error: errUpdate } = await dbParda.from('ventas').update({ estado: 'ANULADO' }).eq('id', comp.id);
        if (errUpdate) throw new Error(errUpdate.message);

        const { data: items } = await dbParda.from('ventas_items').select('*').eq('venta_id', comp.id);
        if (items && items.length > 0) {
          const { error: errStock } = await dbOficial.rpc('devolver_stock_silencioso', { p_items: items });
          if (errStock) throw new Error(errStock.message);
        }
        alert("Remito anulado y stock devuelto.");
        cargarHistorial();
      } catch (err) { 
        alert("Error al anular: " + err.message); 
      } finally {
        setProcesando(false);
      }
      return;
    }

    if (!window.confirm(`Vas a generar una NC FISCAL TOTAL por la ${comp.nro}. ¿Continuar?`)) return;
    setProcesando(true);
    try {
      const { data: items } = await dbOficial.from('ventas_items').select('*').eq('venta_id', comp.id);
      const itemsMapeados = items.map(i => ({ cod: i.articulo_cod, cant: i.cantidad, precio: i.precio_unitario }));
      await ejecutarDevolucionFiscal(comp, itemsMapeados, comp.total, true);
    } catch (err) { 
      alert("Error: " + err.message); 
      setProcesando(false);
    }
  };

  const ejecutarDevolucionFiscal = async (compOriginal, itemsDevueltos, totalADevolver, esTotal) => {
    try {
      const match = compOriginal.nro.match(/[AB]\s\d+-(\d+)/);
      const cbte_asoc_nro = match ? parseInt(match[1], 10) : 0;
      const cbte_asoc_tipo = compOriginal.nro.includes('Factura A') ? 1 : 6;

      const { data: dataAfip, error: errorAfip } = await dbOficial.functions.invoke('facturacion-afip', {
        body: { 
          total: totalADevolver, cliente_doc: "", cliente_iva: "Consumidor Final",
          is_nc: true, cbte_asoc_tipo, cbte_asoc_nro 
        }
      });

      if (errorAfip) throw new Error("Fallo al contactar AFIP: " + errorAfip.message);
      if (dataAfip.error) throw new Error("AFIP rechazó la Nota de Crédito:\n" + dataAfip.error);

      const letra = dataAfip.tipoComprobante === 3 ? 'A' : 'B';
      const nro_nuevo = `Nota Crédito ${letra} 00014-${dataAfip.nroComprobante.toString().padStart(8, '0')} (CAE: ${dataAfip.cae})`;

      const { error: errorDb } = await dbOficial.rpc('generar_nota_credito', {
        p_venta_original_id: compOriginal.id,
        p_items_devueltos: itemsDevueltos,
        p_total_devuelto: totalADevolver,
        p_tipo: 'NC-FISCAL',
        p_nro_nc: nro_nuevo
      });

      if (errorDb) throw new Error("Error en base de datos: " + errorDb.message);

      alert(`✅ Nota de Crédito generada: ${nro_nuevo}\nCAE: ${dataAfip.cae}`);
      setModalDevolucion(null);
      cargarHistorial();
    } catch (err) {
      alert("❌ Error al procesar NC:\n" + err.message);
    } finally {
      setProcesando(false);
    }
  };

  const abrirModalParcial = async (comp) => {
    if (comp.tipo === 'INTERNO') return alert("Las devoluciones parciales solo aplican a facturas fiscales. Para remitos, anulá y volvé a facturar.");
    try {
      const { data: items } = await dbOficial.from('ventas_items').select('*').eq('venta_id', comp.id);
      setModalDevolucion({ ...comp, items: items.map(i => ({ cod: i.articulo_cod, cantOriginal: i.cantidad, precio: i.precio_unitario, cant_devolver: 0 })) });
    } catch (err) { alert(err.message); }
  };

  const procesarNC_Parcial = () => {
    const itemsDev = modalDevolucion.items.filter(i => i.cant_devolver > 0).map(i => ({ cod: i.cod, cant: i.cant_devolver, precio: i.precio }));
    if (itemsDev.length === 0) return alert("No hay ítems seleccionados.");
    const totalDev = itemsDev.reduce((acc, i) => acc + (i.cant * i.precio), 0);
    if (!window.confirm(`Se generará NC por ${formatoMoneda(totalDev)}. ¿Confirmar?`)) return;
    setProcesando(true);
    ejecutarDevolucionFiscal(modalDevolucion, itemsDev, totalDev, false);
  };

  const cambiarCantidadDevolucion = (index, nuevaCant) => {
    const cant = parseFloat(nuevaCant) || 0;
    const itemsCopia = [...modalDevolucion.items];
    if (cant < 0) itemsCopia[index].cant_devolver = 0;
    else if (cant > itemsCopia[index].cantOriginal) itemsCopia[index].cant_devolver = itemsCopia[index].cantOriginal;
    else itemsCopia[index].cant_devolver = cant;
    setModalDevolucion({ ...modalDevolucion, items: itemsCopia });
  };

  // Lógica visual para la barra de navegación
  const obtenerFondoNav = () => {
    if (modoVista === 'OFICIAL') return colorBordo;
    if (modoVista === 'PARDO') return colorPardo;
    if (modoVista === 'DUAL') return `linear-gradient(90deg, ${colorBordo} 50%, ${colorPardo} 50%)`;
  };

  const obtenerTituloNav = () => {
    if (modoVista === 'OFICIAL') return 'Historial de Comprobantes';
    if (modoVista === 'PARDO') return 'Historial Interno (Sombra)';
    if (modoVista === 'DUAL') return 'Historial Completo (Dual)';
  };

  return (
    <div className="bg-light min-vh-100 d-flex flex-column" style={{ overflowX: 'hidden' }}>
      {/* BARRA SUPERIOR - CAMBIA SEGÚN EL MODO */}
      <nav className="navbar navbar-dark shadow-sm px-3 transition-colors" style={{ background: obtenerFondoNav(), borderBottom: `4px solid ${modoVista !== 'OFICIAL' ? '#000' : colorGris}` }}>
        <button className="btn btn-sm btn-outline-light fw-bold" onClick={volverAlMenu}>⬅ Volver</button>
        <span 
          className="navbar-brand fw-bold m-0 tracking-wide mx-auto cursor-pointer user-select-none" 
          onClick={toggleModoVista}
          style={{ cursor: 'pointer' }}
          title="Modificar Vista"
        >
          {obtenerTituloNav()}
        </span>
      </nav>

      <div className="container-fluid mt-4 px-4 mb-5">
        <div className="card border-0 shadow-sm bg-white mb-3 p-3 d-flex flex-row gap-3">
          <input type="text" className="form-control fw-bold" placeholder="🔍 Buscar..." value={busqueda} onChange={e => setBusqueda(e.target.value)} />
          
          <select className="form-select fw-bold" style={{width: '200px'}} value={filtroTipo} onChange={e => setFiltroTipo(e.target.value)}>
            {modoVista === 'OFICIAL' && (
              <>
                <option value="TODOS_FISCAL">Todas las Facturas</option>
                <option value="FISCAL">Facturas AFIP</option>
                <option value="NC-FISCAL">NC AFIP</option>
              </>
            )}
            {modoVista === 'PARDO' && (
              <>
                <option value="TODOS_PARDO">Todos los Remitos</option>
                <option value="INTERNO">Remitos Internos</option>
                <option value="NC-INTERNA">NC Interna</option>
              </>
            )}
            {modoVista === 'DUAL' && (
              <>
                <option value="TODOS">Todos los Comprobantes</option>
                <option value="FISCAL">Facturas AFIP</option>
                <option value="NC-FISCAL">NC AFIP</option>
                <option value="INTERNO">Remitos Internos</option>
                <option value="NC-INTERNA">NC Interna</option>
              </>
            )}
          </select>
        </div>

        <div className="card shadow-sm bg-white overflow-hidden">
          <table className="table table-hover mb-0 align-middle">
            <thead style={{ backgroundColor: modoVista === 'PARDO' ? '#343a40' : colorGris, color: 'white' }}>
              <tr>
                <th className="ps-3 py-3">Fecha</th><th className="py-3">Comprobante</th><th className="py-3">Origen</th>
                <th className="text-end py-3">Total</th><th className="text-center py-3">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {comprobantesFiltrados.map(comp => (
                <tr key={comp.id} className={`${comp.estado === 'ANULADO' ? 'table-danger opacity-75' : ''} ${comp.tipo.includes('NC') ? 'table-warning' : ''}`}>
                  <td className="ps-3 font-monospace small">{comp.fecha}</td>
                  <td className={`fw-bold font-monospace ${comp.estado === 'ANULADO' ? 'text-danger text-decoration-line-through' : (comp.tipo.includes('INTERN') ? 'text-secondary' : 'text-primary')}`}>{comp.nro}</td>
                  <td><span className={`badge ${comp.tipo.includes('FISCAL') ? 'bg-primary' : 'bg-dark'}`}>{comp.tipo}</span></td>
                  <td className={`text-end fw-bold font-monospace ${comp.total < 0 ? 'text-danger' : 'text-dark'}`}>{formatoMoneda(comp.total)}</td>
                  <td className="text-center">
                    <div className="btn-group shadow-sm">
                      <button className="btn btn-sm btn-light border fw-bold" onClick={() => abrirVisor(comp)}>👀 Ver</button>
                      <button className="btn btn-sm btn-warning border fw-bold" onClick={() => abrirModalParcial(comp)} disabled={comp.estado === 'ANULADO' || comp.tipo.includes('NC') || comp.tipo === 'INTERNO'}>🔄 Parcial</button>
                      <button className="btn btn-sm btn-danger border fw-bold" onClick={() => procesarNC_Total(comp)} disabled={comp.estado === 'ANULADO' || comp.tipo.includes('NC') || procesando}>{comp.tipo === 'INTERNO' ? '❌ Anular' : '🧾 NC Total'}</button>
                    </div>
                  </td>
                </tr>
              ))}
              {comprobantesFiltrados.length === 0 && (
                <tr>
                  <td colSpan="5" className="text-center py-4 text-muted">No hay comprobantes para mostrar en este modo.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* VISOR DE COMPROBANTE NATIVO */}
      {visorComprobante && (
        <div className="position-fixed top-0 start-0 w-100 h-100 bg-dark bg-opacity-75 d-flex justify-content-center align-items-center" style={{ zIndex: 3000 }}>
          <div className="card border-0 shadow-lg d-flex flex-column" style={{ width: '450px', height: '85vh' }}>
            <div className="card-header bg-dark text-white d-flex justify-content-between align-items-center">
              <h6 className="m-0 fw-bold">Visor de Documento</h6>
              <button className="btn-close btn-close-white" onClick={() => setVisorComprobante(null)}></button>
            </div>
            
            <div id="area-impresion" className="card-body bg-white overflow-auto p-4" style={{ fontFamily: 'monospace', color: 'black' }}>
              <div className="text-center mb-4 border-bottom border-dark pb-3 border-2">
                <h4 className="fw-bold mb-1">REPUESTOS SANTA ROSA</h4>
                {/* Ocultamos CUIT si es un remito interno */}
                {!visorComprobante.tipo.includes('INTERNO') && <div>CUIT: 27106145909 - IVA Resp. Inscripto</div>}
                <h5 className="mt-3 fw-bold">{visorComprobante.nro}</h5>
                <div>Fecha: {visorComprobante.fecha}</div>
                <div>Condición: {visorComprobante.tipo.includes('NC') ? 'Nota de Crédito' : 'Venta'}</div>
              </div>
              <div className="mb-2 fw-bold d-flex justify-content-between border-bottom border-dark pb-1">
                <span style={{width:'60%'}}>Descripción</span><span style={{width:'15%'}} className="text-center">Cant</span><span style={{width:'25%'}} className="text-end">Monto</span>
              </div>
              {visorComprobante.items.map((it, idx) => (
                <div key={idx} className="d-flex justify-content-between mb-1 small">
                  <span style={{width:'60%'}} className="text-truncate">{it.articulo_cod}</span>
                  <span style={{width:'15%'}} className="text-center">{Math.abs(it.cantidad)}</span>
                  <span style={{width:'25%'}} className="text-end">{formatoMoneda(it.precio_unitario * Math.abs(it.cantidad))}</span>
                </div>
              ))}
              <div className="mt-4 pt-2 border-top border-dark border-2 d-flex justify-content-between align-items-end">
                <span className="fs-5 fw-bold">TOTAL:</span>
                <span className="fs-4 fw-bold">{formatoMoneda(visorComprobante.total)}</span>
              </div>
              {visorComprobante.estado === 'ANULADO' && <div className="text-center text-danger fw-bold fs-4 mt-4 border border-danger p-2" style={{transform: 'rotate(-5deg)'}}>*** ANULADO ***</div>}
            </div>
            
            <div className="card-footer bg-light p-3 d-flex justify-content-end gap-2">
              <button className="btn btn-secondary fw-bold" onClick={() => setVisorComprobante(null)}>Cerrar</button>
              <button className="btn btn-primary fw-bold" onClick={() => {
                const printContents = document.getElementById('area-impresion').innerHTML;
                const originalContents = document.body.innerHTML;
                document.body.innerHTML = printContents;
                window.print();
                document.body.innerHTML = originalContents;
                window.location.reload(); 
              }}>🖨️ Guardar PDF / Imprimir</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL NC PARCIAL */}
      {modalDevolucion && (
         <div className="position-fixed top-0 start-0 w-100 h-100 bg-dark bg-opacity-75 d-flex justify-content-center align-items-center" style={{ zIndex: 2000 }}>
          <div className="card shadow-lg border-0" style={{ width: '650px', borderRadius: '12px' }}>
            <div className="card-header bg-warning text-dark d-flex justify-content-between align-items-center">
              <h5 className="modal-title fw-bold m-0">🔄 NC Parcial - {modalDevolucion.nro}</h5>
              <button className="btn-close" onClick={() => setModalDevolucion(null)} disabled={procesando}></button>
            </div>
            <div className="card-body p-4 bg-light">
              <table className="table table-sm bg-white mb-0 align-middle shadow-sm">
                <thead className="table-light"><tr><th className="ps-3">Cód.</th><th className="text-end">Precio</th><th className="text-center">Compró</th><th className="text-center">Devuelve</th></tr></thead>
                <tbody>
                  {modalDevolucion.items.map((item, idx) => (
                    <tr key={idx}>
                      <td className="ps-3 fw-bold">{item.cod}</td><td className="text-end">{formatoMoneda(item.precio)}</td><td className="text-center fw-bold">{item.cantOriginal}</td>
                      <td className="text-center"><input type="number" className="form-control form-control-sm text-center mx-auto fw-bold" style={{ width: '70px' }} max={item.cantOriginal} min="0" value={item.cant_devolver || ''} onChange={(e) => cambiarCantidadDevolucion(idx, e.target.value)} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="card-footer bg-white d-flex justify-content-end gap-2 p-3">
              <button className="btn btn-outline-secondary fw-bold" onClick={() => setModalDevolucion(null)} disabled={procesando}>Cancelar</button>
              <button className="btn btn-warning fw-bold px-4" onClick={procesarNC_Parcial} disabled={procesando}>{procesando ? 'Procesando...' : 'Generar NC Parcial'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}