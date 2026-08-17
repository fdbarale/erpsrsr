import React, { useState, useEffect } from 'react';
import { dbOficial, dbParda } from '../supabaseClient';
import DocumentoImpresion from './DocumentoImpresion';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

export default function HistorialComprobantes({ volverAlMenu }) {
  const [busqueda, setBusqueda] = useState('');
  const [modoVista, setModoVista] = useState('OFICIAL');
  const [filtroTipo, setFiltroTipo] = useState('TODOS_FISCAL'); 
  const [comprobantes, setComprobantes] = useState([]);
  const [modalDevolucion, setModalDevolucion] = useState(null);
  
  const [visorComprobante, setVisorComprobante] = useState(null);
  const [wppHistorial, setWppHistorial] = useState('');
  const [emailHistorial, setEmailHistorial] = useState('');
  const [procesandoEnvio, setProcesandoEnvio] = useState(false);
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
          tipo: v.tipo || (v.nro_comprobante.includes('Presupuesto') ? 'INTERNO' : 'FISCAL'), 
          total: v.total, 
          estado: v.estado
        }))
        .sort((a, b) => b.fechaRaw - a.fechaRaw);

      setComprobantes(unificados);
    } catch (err) { console.error("Error al cargar historial:", err); }
  };

  useEffect(() => { cargarHistorial(); }, []);

  const formatoMoneda = (valor) => "$ " + Math.round(parseFloat(valor) || 0).toLocaleString('es-AR');

  const toggleModoVista = (e) => {
    if (e.ctrlKey) {
      if (modoVista === 'OFICIAL') { setModoVista('PARDO'); setFiltroTipo('TODOS_PARDO'); } 
      else if (modoVista === 'PARDO') { setModoVista('DUAL'); setFiltroTipo('TODOS'); } 
      else { setModoVista('OFICIAL'); setFiltroTipo('TODOS_FISCAL'); }
      setBusqueda('');
    }
  };

  const comprobantesFiltrados = comprobantes.filter(c => {
    const coincideBusqueda = c.nro.toLowerCase().includes(busqueda.toLowerCase()) || c.cliente.toLowerCase().includes(busqueda.toLowerCase());
    let coincideTipo = false;
    if (modoVista === 'OFICIAL') {
      if (c.tipo === 'INTERNO' || c.nro.includes('Presupuesto') || c.nro.includes('REM-X')) return false;
      if (filtroTipo === 'TODOS_FISCAL') coincideTipo = true; else coincideTipo = c.tipo === filtroTipo;
    } 
    else if (modoVista === 'PARDO') {
      if (c.tipo.includes('FISCAL') || c.nro.includes('Factura')) return false;
      if (filtroTipo === 'TODOS_PARDO') coincideTipo = true; else coincideTipo = c.tipo === filtroTipo;
    } 
    else if (modoVista === 'DUAL') {
      if (filtroTipo === 'TODOS') coincideTipo = true; else coincideTipo = c.tipo === filtroTipo;
    }
    return coincideBusqueda && coincideTipo;
  });

  const abrirVisor = async (comp) => {
    try {
      const dbDestino = (comp.tipo === 'INTERNO' || comp.nro.includes('Presupuesto')) ? dbParda : dbOficial;
      const { data: items, error } = await dbDestino.from('ventas_items').select('*').eq('venta_id', comp.id);
      if (error) throw new Error(error.message);

      const letraDetectada = comp.nro.includes('Factura A') ? 'A' : comp.nro.includes('Presupuesto') ? 'X' : 'B';
      const esPresupuesto = comp.tipo === 'INTERNO' || comp.nro.includes('Presupuesto');

      setWppHistorial(''); setEmailHistorial('');
      setVisorComprobante({ ...comp, letra: letraDetectada, esPresupuesto, items: items || [] });
    } catch (err) { alert("Error al cargar el detalle: " + err.message); }
  };

  const imprimirVisor = () => {
    const contenido = document.getElementById('area-impresion');
    if (!contenido) return window.print();
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed'; iframe.style.right = '0'; iframe.style.bottom = '0'; iframe.style.width = '0'; iframe.style.height = '0'; iframe.style.border = '0';
    document.body.appendChild(iframe);
    const doc = iframe.contentWindow.document;
    doc.open(); doc.write('<html><head><title>Impresión</title>');
    document.querySelectorAll('link[rel="stylesheet"], style').forEach(nodo => doc.write(nodo.outerHTML));
    doc.write('</head><body style="background:white; margin:0; padding:10px;">'); doc.write(contenido.innerHTML); doc.write('</body></html>'); doc.close();
    iframe.contentWindow.focus();
    setTimeout(() => {
      iframe.contentWindow.print();
      setTimeout(() => { if (document.body.contains(iframe)) document.body.removeChild(iframe); }, 500);
    }, 200);
  };

  const enviarWppHistorial = () => {
    if (!wppHistorial) return alert("Ingresá un número de WhatsApp.");
    const telLimpio = wppHistorial.replace(/\D/g, '');
    const itemsTxt = visorComprobante.items.map(it => `• ${it.cantidad || it.cant}x ${it.descripcion || it.desc || it.articulo_cod} ($${it.precio_unitario || it.precio})`).join('%0A');
    const mensajeWpp = `Hola, te enviamos la copia del comprobante:%0A%0A*${visorComprobante.nro}*%0ATotal: ${formatoMoneda(visorComprobante.total)}%0A%0A*Detalle:*%0A${itemsTxt}%0A%0A¡Muchas gracias!`;
    window.open(`https://api.whatsapp.com/send?phone=${telLimpio}&text=${mensajeWpp}`, '_blank');
  };

  const enviarEmailHistorial = async () => {
    if (!emailHistorial) return alert("Ingresá un correo electrónico válido.");
    setProcesandoEnvio(true);
    try {
      // 1. Generamos el PDF usando html2canvas en base al div "area-impresion"
      const elementoPdf = document.getElementById('area-impresion');
      if (!elementoPdf) throw new Error("No se pudo capturar el documento visualmente.");
      
      const canvas = await html2canvas(elementoPdf, { scale: 2, useCORS: true });
      const imgData = canvas.toDataURL('image/jpeg', 0.8);
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight);
      const pdfBase64 = pdf.output('datauristring').split(',')[1];

      // 2. Armamos el HTML del cuerpo del mensaje
      const itemsHtml = visorComprobante.items.map(it => `<tr><td style="padding:8px; border-bottom:1px solid #ddd;">${it.cantidad || it.cant}x ${it.descripcion || it.desc || it.articulo_cod}</td><td style="padding:8px; border-bottom:1px solid #ddd; text-align:right;">${formatoMoneda((it.precio_unitario || it.precio) * (it.cantidad || it.cant))}</td></tr>`).join('');
      const htmlCuerpo = `
        <div style="font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #ddd; border-radius: 8px; overflow: hidden;">
          <div style="background-color: ${visorComprobante.esPresupuesto ? '#212529' : '#6B1116'}; color: white; padding: 20px; text-align: center;">
            <h2 style="margin: 0;">Copia de Comprobante</h2><p style="margin: 5px 0 0 0;">${visorComprobante.nro}</p>
          </div>
          <div style="padding: 20px;">
            <p>Hola,</p><p>Te enviamos adjunto el comprobante en formato PDF generado el ${visorComprobante.fecha}.</p>
            <table style="width: 100%; border-collapse: collapse; margin-top: 20px;">
              <thead><tr style="background-color: #f8f9fa;"><th style="padding: 10px; text-align: left; border-bottom: 2px solid #ddd;">Descripción</th><th style="padding: 10px; text-align: right; border-bottom: 2px solid #ddd;">Total</th></tr></thead>
              <tbody>${itemsHtml}</tbody>
            </table><h3 style="text-align: right; margin-top: 20px;">Total: ${formatoMoneda(visorComprobante.total)}</h3>
          </div>
        </div>`;
        
      // 3. Enviamos a Supabase Edge Function con el PDF embebido
      const { data, error } = await dbOficial.functions.invoke('enviar-correo', { 
        body: { 
          emailDestino: emailHistorial, 
          asunto: `Copia Comprobante - ${visorComprobante.nro}`, 
          mensajeHtml: htmlCuerpo,
          adjuntoBase64: pdfBase64,
          nombreAdjunto: `${visorComprobante.nro}.pdf`
        } 
      });

      if (error) throw new Error(error.message);
      if (data && !data.ok) throw new Error(data.error);

      alert("✅ Correo con PDF adjunto despachado con éxito.");
    } catch (e) { 
      alert("❌ Error al enviar correo:\n" + e.message); 
    } finally { 
      setProcesandoEnvio(false); 
    }
  };

  const procesarNC_Total = async (comp) => {
    if (comp.tipo === 'INTERNO' || comp.nro.includes('Presupuesto')) {
      if (!window.confirm(`¿Anular ${comp.nro} y reintegrar el stock físico?`)) return;
      setProcesando(true);
      try {
        const { error: errUpdate } = await dbParda.from('ventas').update({ estado: 'ANULADO' }).eq('id', comp.id);
        if (errUpdate) throw new Error(errUpdate.message);
        const { data: items } = await dbParda.from('ventas_items').select('*').eq('venta_id', comp.id);
        if (items && items.length > 0) await dbOficial.rpc('devolver_stock_silencioso', { p_items: items });
        alert("Anulado."); cargarHistorial();
      } catch (err) { alert("Error al anular: " + err.message); } finally { setProcesando(false); }
      return;
    }
    if (!window.confirm(`Generar NC FISCAL TOTAL por ${comp.nro}?`)) return;
    setProcesando(true);
    try {
      const { data: items } = await dbOficial.from('ventas_items').select('*').eq('venta_id', comp.id);
      const itemsMapeados = items.map(i => ({ cod: i.articulo_cod, cant: i.cantidad, precio: i.precio_unitario }));
      await ejecutarDevolucionFiscal(comp, itemsMapeados, comp.total, true);
    } catch (err) { alert("Error: " + err.message); setProcesando(false); }
  };

  const ejecutarDevolucionFiscal = async (compOriginal, itemsDevueltos, totalADevolver, esTotal) => {
    try {
      const match = compOriginal.nro.match(/[AB]\s\d+-(\d+)/);
      const cbte_asoc_nro = match ? parseInt(match[1], 10) : 0;
      const cbte_asoc_tipo = compOriginal.nro.includes('Factura A') ? 1 : 6;
      const { data: dataAfip, error: errorAfip } = await dbOficial.functions.invoke('facturacion-afip', { body: { total: totalADevolver, cliente_doc: "", cliente_iva: "Consumidor Final", is_nc: true, cbte_asoc_tipo, cbte_asoc_nro } });
      if (errorAfip) throw new Error("Fallo AFIP: " + errorAfip.message);
      if (dataAfip.error) throw new Error("AFIP rechazó:\n" + dataAfip.error);
      const letra = dataAfip.tipoComprobante === 3 ? 'A' : 'B';
      const nro_nuevo = `Nota Crédito ${letra} 00014-${dataAfip.nroComprobante.toString().padStart(8, '0')} (CAE: ${dataAfip.cae})`;
      await dbOficial.rpc('generar_nota_credito', { p_venta_original_id: compOriginal.id, p_items_devueltos: itemsDevueltos, p_total_devuelto: totalADevolver, p_tipo: 'NC-FISCAL', p_nro_nc: nro_nuevo });
      alert(`✅ NC Generada: ${nro_nuevo}`); setModalDevolucion(null); cargarHistorial();
    } catch (err) { alert("❌ Error:\n" + err.message); } finally { setProcesando(false); }
  };

  const abrirModalParcial = async (comp) => {
    if (comp.tipo === 'INTERNO' || comp.nro.includes('Presupuesto')) return alert("NC Parcial solo para facturas AFIP.");
    try {
      const { data: items } = await dbOficial.from('ventas_items').select('*').eq('venta_id', comp.id);
      setModalDevolucion({ ...comp, items: items.map(i => ({ cod: i.articulo_cod, cantOriginal: i.cantidad, precio: i.precio_unitario, cant_devolver: 0 })) });
    } catch (err) { alert(err.message); }
  };

  const procesarNC_Parcial = () => {
    const itemsDev = modalDevolucion.items.filter(i => i.cant_devolver > 0).map(i => ({ cod: i.cod, cant: i.cant_devolver, precio: i.precio }));
    if (itemsDev.length === 0) return alert("Nada para devolver.");
    const totalDev = itemsDev.reduce((acc, i) => acc + (i.cant * i.precio), 0);
    if (!window.confirm(`Se generará NC por ${formatoMoneda(totalDev)}. ¿Confirmar?`)) return;
    setProcesando(true); ejecutarDevolucionFiscal(modalDevolucion, itemsDev, totalDev, false);
  };

  const cambiarCantidadDevolucion = (index, nuevaCant) => {
    const cant = parseFloat(nuevaCant) || 0; const itemsCopia = [...modalDevolucion.items];
    if (cant < 0) itemsCopia[index].cant_devolver = 0; else if (cant > itemsCopia[index].cantOriginal) itemsCopia[index].cant_devolver = itemsCopia[index].cantOriginal; else itemsCopia[index].cant_devolver = cant;
    setModalDevolucion({ ...modalDevolucion, items: itemsCopia });
  };

  return (
    <div className="bg-light min-vh-100 d-flex flex-column" style={{ overflowX: 'hidden' }}>
      <nav className="navbar navbar-dark shadow-sm px-3 transition-colors" style={{ background: modoVista === 'OFICIAL' ? colorBordo : modoVista === 'PARDO' ? colorPardo : `linear-gradient(90deg, ${colorBordo} 50%, ${colorPardo} 50%)`, borderBottom: `4px solid ${modoVista !== 'OFICIAL' ? '#000' : colorGris}` }}>
        <button className="btn btn-sm btn-outline-light fw-bold" onClick={volverAlMenu}>⬅ Volver</button>
        <span className="navbar-brand fw-bold m-0 tracking-wide mx-auto cursor-pointer user-select-none" onClick={toggleModoVista} title="Modificar Vista">
          {modoVista === 'OFICIAL' ? 'Historial Fiscal' : modoVista === 'PARDO' ? 'Historial de Presupuestos' : 'Historial Consolidado'}
        </span>
      </nav>

      <div className="container-fluid mt-4 px-4 mb-5">
        <div className="card border-0 shadow-sm bg-white mb-3 p-3 d-flex flex-row gap-3">
          <input type="text" className="form-control fw-bold" placeholder="🔍 Buscar por número o cliente..." value={busqueda} onChange={e => setBusqueda(e.target.value)} />
          <select className="form-select fw-bold" style={{ width: '220px' }} value={filtroTipo} onChange={e => setFiltroTipo(e.target.value)}>
            {modoVista === 'OFICIAL' && (<><option value="TODOS_FISCAL">Todas las Facturas</option><option value="FISCAL">Facturas AFIP</option><option value="NC-FISCAL">NC AFIP</option></>)}
            {modoVista === 'PARDO' && (<><option value="TODOS_PARDO">Todos los Presupuestos</option><option value="INTERNO">Presupuestos Emitidos</option></>)}
            {modoVista === 'DUAL' && (<><option value="TODOS">Todos los Registros</option><option value="FISCAL">Facturas AFIP</option><option value="INTERNO">Presupuestos X</option><option value="NC-FISCAL">Notas de Crédito</option></>)}
          </select>
        </div>

        <div className="card shadow-sm bg-white overflow-hidden">
          <table className="table table-hover mb-0 align-middle">
            <thead style={{ backgroundColor: modoVista === 'PARDO' ? '#343a40' : colorGris, color: 'white' }}>
              <tr><th className="ps-3 py-3">Fecha</th><th className="py-3">Comprobante</th><th className="py-3">Condición</th><th className="text-end py-3">Total</th><th className="text-center py-3">Acciones</th></tr>
            </thead>
            <tbody>
              {comprobantesFiltrados.map(comp => (
                <tr key={comp.id} className={`${comp.estado === 'ANULADO' ? 'table-danger opacity-75' : ''} ${comp.tipo.includes('NC') ? 'table-warning' : ''}`}>
                  <td className="ps-3 font-monospace small">{comp.fecha}</td>
                  <td className={`fw-bold font-monospace ${comp.estado === 'ANULADO' ? 'text-danger text-decoration-line-through' : (comp.tipo === 'INTERNO' ? 'text-secondary' : 'text-primary')}`}>{comp.nro}</td>
                  <td><span className={`badge ${comp.tipo === 'FISCAL' ? 'bg-primary' : comp.tipo === 'INTERNO' ? 'bg-dark' : 'bg-warning text-dark'}`}>{comp.tipo === 'INTERNO' ? 'PRESUPUESTO' : comp.tipo}</span></td>
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
            </tbody>
          </table>
        </div>
      </div>

      {visorComprobante && (
        <div className="position-fixed top-0 start-0 w-100 h-100 bg-dark bg-opacity-75 d-flex justify-content-center align-items-center" style={{ zIndex: 3000 }}>
          <div className="card border-0 shadow-lg d-flex flex-column" style={{ width: '850px', maxHeight: '94vh', borderRadius: '12px', overflow: 'hidden' }}>
            <div className="card-header bg-dark text-white d-flex justify-content-between align-items-center py-3">
              <h5 className="m-0 fw-bold">Visor de Documento</h5>
              <button className="btn-close btn-close-white" onClick={() => setVisorComprobante(null)}></button>
            </div>
            
            <div id="area-impresion" className="card-body bg-light overflow-auto p-4 d-flex justify-content-center border-bottom">
              <DocumentoImpresion 
                tipo={visorComprobante.esPresupuesto ? 'PRESUPUESTO' : 'FISCAL'}
                letra={visorComprobante.letra}
                nroComprobante={visorComprobante.nro}
                fecha={visorComprobante.fecha}
                items={visorComprobante.items}
                total={visorComprobante.total}
                formato="A4"
              />
            </div>
            
            <div className="bg-white p-3">
              <div className="row g-3 align-items-end">
                <div className="col-md-5">
                  <label className="small fw-bold text-success mb-1">Reenviar WhatsApp (N° sin 0 ni 15)</label>
                  <div className="input-group">
                    <input type="text" className="form-control border-success" placeholder="Ej: 5492954123456" value={wppHistorial} onChange={e => setWppHistorial(e.target.value)} />
                    <button className="btn btn-success fw-bold" onClick={enviarWppHistorial}>WhatsApp</button>
                  </div>
                </div>
                <div className="col-md-5">
                  <label className="small fw-bold text-primary mb-1">Reenviar por Correo</label>
                  <div className="input-group">
                    <input type="email" className="form-control border-primary" placeholder="cliente@correo.com" value={emailHistorial} onChange={e => setEmailHistorial(e.target.value)} />
                    <button className="btn btn-primary fw-bold" onClick={enviarEmailHistorial} disabled={procesandoEnvio}>
                      {procesandoEnvio ? '...' : 'Email'}
                    </button>
                  </div>
                </div>
                <div className="col-md-2 text-end">
                  <button className="btn btn-dark fw-bold w-100 shadow" onClick={imprimirVisor}>
                    🖨️ Imprimir
                  </button>
                </div>
              </div>
            </div>

          </div>
        </div>
      )}

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
                      <td className="ps-3 fw-bold">{item.cod}</td><td className="text-end font-monospace">{formatoMoneda(item.precio)}</td><td className="text-center fw-bold">{item.cantOriginal}</td>
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