import React, { useState, useEffect } from 'react';
import { dbOficial } from '../supabaseClient';

export default function HistorialComprobantes({ volverAlMenu }) {
  const [busqueda, setBusqueda] = useState('');
  const [filtroTipo, setFiltroTipo] = useState('TODOS');
  const [comprobantes, setComprobantes] = useState([]);
  
  const [modalDevolucion, setModalDevolucion] = useState(null);
  const [visorComprobante, setVisorComprobante] = useState(null); // Nuevo estado para el Visor PDF
  const [procesando, setProcesando] = useState(false);

  const colorBordo = '#6B1116';
  const colorGris = '#54565b';

  const cargarHistorial = async () => {
    const { data, error } = await dbOficial.from('ventas').select('*').order('fecha', { ascending: false });
    if (data) {
      setComprobantes(data.map(v => ({
        id: v.id, fecha: new Date(v.fecha).toLocaleString('es-AR'), nro: v.nro_comprobante,
        cliente: 'Consumidor Final', tipo: v.tipo, total: v.total, estado: v.estado
      })));
    }
  };

  useEffect(() => { cargarHistorial(); }, []);

  const formatoMoneda = (valor) => "$ " + Math.round(parseFloat(valor) || 0).toLocaleString('es-AR');

  const comprobantesFiltrados = comprobantes.filter(c => {
    return (c.nro.toLowerCase().includes(busqueda.toLowerCase()) || c.cliente.toLowerCase().includes(busqueda.toLowerCase())) &&
           (filtroTipo === 'TODOS' || c.tipo === filtroTipo);
  });

  // === VISOR DE COMPROBANTE (Ticket / PDF) ===
  const abrirVisor = async (comp) => {
    try {
      const { data: items, error } = await dbOficial.from('ventas_items').select('*').eq('venta_id', comp.id);
      if (error) throw new Error(error.message);
      setVisorComprobante({ ...comp, items });
    } catch (err) {
      alert("Error al cargar el detalle: " + err.message);
    }
  };

  // === LÓGICA DE NOTAS DE CRÉDITO (TOTAL Y PARCIAL) ===
  const ejecutarDevolucion = async (compOriginal, itemsDevueltos, totalADevolver, esTotal) => {
    setProcesando(true);
    try {
      let nro_nuevo = '';
      let tipo_nuevo = 'NC-INTERNA';
      let infoFiscal = '';

      if (compOriginal.tipo === 'FISCAL') {
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
        nro_nuevo = `Nota Crédito ${letra} 00014-${dataAfip.nroComprobante.toString().padStart(8, '0')} (CAE: ${dataAfip.cae})`;
        tipo_nuevo = 'NC-FISCAL';
        infoFiscal = `\nCAE: ${dataAfip.cae}`;
      } else {
        const aleatorio = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
        nro_nuevo = `NCI-X ${new Date().toISOString().slice(2, 10).replace(/-/g, '')}-${aleatorio}`;
      }

      const { error: errorDb } = await dbOficial.rpc('generar_nota_credito', {
        p_venta_original_id: compOriginal.id,
        p_items_devueltos: itemsDevueltos,
        p_total_devuelto: totalADevolver,
        p_tipo: tipo_nuevo,
        p_nro_nc: nro_nuevo
      });

      if (errorDb) throw new Error("Error en base de datos: " + errorDb.message);

      alert(`✅ Nota de Crédito generada: ${nro_nuevo}${infoFiscal}`);
      setModalDevolucion(null);
      cargarHistorial();

    } catch (err) {
      alert("❌ Error al procesar NC:\n" + err.message);
    } finally {
      setProcesando(false);
    }
  };

  const procesarNC_Total = async (comp) => {
    if (comp.tipo === 'INTERNO') {
      if (!window.confirm(`¿Anular remito interno ${comp.nro}?`)) return;
      try {
        await dbOficial.rpc('anular_venta', { p_venta_id: comp.id });
        cargarHistorial();
      } catch (err) { alert(err.message); }
      return;
    }

    if (!window.confirm(`Vas a generar una NC FISCAL TOTAL por la ${comp.nro}. ¿Continuar?`)) return;
    try {
      const { data: items } = await dbOficial.from('ventas_items').select('*').eq('venta_id', comp.id);
      const itemsMapeados = items.map(i => ({ cod: i.articulo_cod, cant: i.cantidad, precio: i.precio_unitario }));
      ejecutarDevolucion(comp, itemsMapeados, comp.total, true);
    } catch (err) { alert("Error: " + err.message); }
  };

  const abrirModalParcial = async (comp) => {
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
    ejecutarDevolucion(modalDevolucion, itemsDev, totalDev, false);
  };

  return (
    <div className="bg-light min-vh-100 d-flex flex-column" style={{ overflowX: 'hidden' }}>
      <nav className="navbar navbar-dark shadow-sm px-3" style={{ backgroundColor: colorBordo, borderBottom: `4px solid ${colorGris}` }}>
        <button className="btn btn-sm btn-outline-light fw-bold" onClick={volverAlMenu}>⬅ Volver</button>
        <span className="navbar-brand fw-bold m-0 tracking-wide mx-auto">Historial de Comprobantes</span>
      </nav>

      <div className="container-fluid mt-4 px-4 mb-5">
        <div className="card border-0 shadow-sm bg-white mb-3 p-3 d-flex flex-row gap-3">
          <input type="text" className="form-control fw-bold" placeholder="🔍 Buscar..." value={busqueda} onChange={e => setBusqueda(e.target.value)} />
          <select className="form-select fw-bold" style={{width: '200px'}} value={filtroTipo} onChange={e => setFiltroTipo(e.target.value)}>
            <option value="TODOS">Todos</option>
            <option value="FISCAL">Facturas AFIP</option>
            <option value="NC-FISCAL">NC AFIP</option>
            <option value="INTERNO">Internos</option>
            <option value="NC-INTERNA">NC Interna</option>
          </select>
        </div>

        <div className="card shadow-sm bg-white overflow-hidden">
          <table className="table table-hover mb-0 align-middle">
            <thead style={{ backgroundColor: colorGris, color: 'white' }}>
              <tr>
                <th className="ps-3 py-3">Fecha</th><th className="py-3">Comprobante</th><th className="py-3">Origen</th>
                <th className="text-end py-3">Total</th><th className="text-center py-3">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {comprobantesFiltrados.map(comp => (
                <tr key={comp.id} className={`${comp.estado === 'ANULADO' ? 'table-danger opacity-75' : ''} ${comp.tipo.includes('NC') ? 'table-warning' : ''}`}>
                  <td className="ps-3 font-monospace small">{comp.fecha}</td>
                  <td className={`fw-bold font-monospace ${comp.estado === 'ANULADO' ? 'text-danger text-decoration-line-through' : 'text-primary'}`}>{comp.nro}</td>
                  <td><span className={`badge ${comp.tipo.includes('FISCAL') ? 'bg-primary' : 'bg-secondary'}`}>{comp.tipo}</span></td>
                  <td className={`text-end fw-bold font-monospace ${comp.total < 0 ? 'text-danger' : 'text-dark'}`}>{formatoMoneda(comp.total)}</td>
                  <td className="text-center">
                    <div className="btn-group shadow-sm">
                      <button className="btn btn-sm btn-light border fw-bold" onClick={() => abrirVisor(comp)}>👀 Ver</button>
                      <button className="btn btn-sm btn-warning border fw-bold" onClick={() => abrirModalParcial(comp)} disabled={comp.estado === 'ANULADO' || comp.tipo.includes('NC')}>🔄 Parcial</button>
                      <button className="btn btn-sm btn-danger border fw-bold" onClick={() => procesarNC_Total(comp)} disabled={comp.estado === 'ANULADO' || comp.tipo.includes('NC')}>{comp.tipo === 'INTERNO' ? '❌ Anular' : '🧾 NC Total'}</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* VISOR DE COMPROBANTE NATIVO (PARA PDF O IMPRESIÓN) */}
      {visorComprobante && (
        <div className="position-fixed top-0 start-0 w-100 h-100 bg-dark bg-opacity-75 d-flex justify-content-center align-items-center" style={{ zIndex: 3000 }}>
          <div className="card border-0 shadow-lg d-flex flex-column" style={{ width: '450px', height: '85vh' }}>
            <div className="card-header bg-dark text-white d-flex justify-content-between align-items-center">
              <h6 className="m-0 fw-bold">Visor de Documento</h6>
              <button className="btn-close btn-close-white" onClick={() => setVisorComprobante(null)}></button>
            </div>
            
            {/* Contenido imprimible */}
            <div id="area-impresion" className="card-body bg-white overflow-auto p-4" style={{ fontFamily: 'monospace', color: 'black' }}>
              <div className="text-center mb-4 border-bottom border-dark pb-3 border-2">
                <h4 className="fw-bold mb-1">REPUESTOS SANTA ROSA</h4>
                <div>CUIT: 27106145909 - IVA Resp. Inscripto</div>
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
              {visorComprobante.estado === 'ANULADO' && <div className="text-center text-danger fw-bold fs-4 mt-4 border border-danger p-2 transform-rotate">*** ANULADO ***</div>}
            </div>
            
            <div className="card-footer bg-light p-3 d-flex justify-content-end gap-2">
              <button className="btn btn-secondary fw-bold" onClick={() => setVisorComprobante(null)}>Cerrar</button>
              <button className="btn btn-primary fw-bold" onClick={() => {
                const printContents = document.getElementById('area-impresion').innerHTML;
                const originalContents = document.body.innerHTML;
                document.body.innerHTML = printContents;
                window.print();
                document.body.innerHTML = originalContents;
                window.location.reload(); // Recarga limpia para restaurar React
              }}>🖨️ Guardar PDF / Imprimir</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL NC PARCIAL (Resumido para espacio) */}
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