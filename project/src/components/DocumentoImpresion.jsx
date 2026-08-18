import React, { useEffect, useState } from 'react';
import { dbOficial } from '../supabaseClient';

export default function DocumentoImpresion({ 
  tipo = 'FISCAL', 
  letra = 'B',     
  nroComprobante = '00014-00000000',
  fecha = '',
  cliente = { nombre: 'Consumidor Final', cuit: '', condicionIva: 'Consumidor Final', direccion: '' },
  items = [],
  total = 0,
  pagos = [],
  datosAfip = null,
  formato = 'TICKET',
  leyendasSeleccionadas = [true, true, true],
  operador = 'Vendedor'
}) {
  const [empresa, setEmpresa] = useState(null);

  useEffect(() => {
    const cargarDatosEmpresa = async () => {
      const { data } = await dbOficial.from('config_empresa').select('*').single();
      if (data) setEmpresa(data);
    };
    cargarDatosEmpresa();
  }, []);

  const redondear = (valor) => Math.round((Number(valor) + Number.EPSILON) * 100) / 100;
  const formatoMoneda = (val) => "$ " + Number(val || 0).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  if (!empresa) return <div className="p-3 text-center small text-muted font-monospace">Cargando membrete...</div>;

  const esPresupuestoO_Interno = tipo === 'PRESUPUESTO' || letra === 'X';
  const esCtaCte = pagos && pagos.some(p => p.metodo === 'Cuenta Corriente');
  
  // LOGICA RIGUROSA DE CONDICIÓN DE VENTA
  const condicionVenta = esCtaCte ? 'Cuenta Corriente' : 'Contado';

  let tituloDocumento = esPresupuestoO_Interno ? 'PRESUPUESTO' : (letra === 'A' ? 'FACTURA A' : 'FACTURA B');
  if (esPresupuestoO_Interno && esCtaCte) tituloDocumento = 'PRESUPUESTO (CC)';

  // === GENERADOR DE QR OFICIAL ARCA/AFIP ===
  const generarUrlQR = () => {
    if (!datosAfip || !datosAfip.cae) return null;
    try {
      const cuitEmisor = empresa.cuit ? Number(empresa.cuit.replace(/\D/g, '')) : 0;
      const cuitReceptor = cliente.cuit ? Number(cliente.cuit.replace(/\D/g, '')) : 0;
      const partesFecha = fecha.split(',')[0].split('/');
      const fechaFormat = `${partesFecha[2]}-${partesFecha[1].padStart(2, '0')}-${partesFecha[0].padStart(2, '0')}`;
      
      const jsonAfip = {
        ver: 1, fecha: fechaFormat, cuit: cuitEmisor, ptoVta: 14,
        tipoCmp: letra === 'A' ? 1 : 6, nroCmp: Number(nroComprobante.split('-')[1] || 0),
        importe: total, moneda: 'PES', ctz: 1,
        tipoDocRec: cuitReceptor ? 80 : 99, nroDocRec: cuitReceptor,
        tipoCodAut: 'E', codAut: Number(datosAfip.cae)
      };
      
      const base64 = btoa(JSON.stringify(jsonAfip));
      return `https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=https://www.afip.gob.ar/fe/qr/?p=${base64}`;
    } catch (e) {
      return null;
    }
  };

  const ivaContenido = redondear(total - (total / 1.21));

  // ==========================================
  // 1. FORMATO TICKET TÉRMICO (80mm)
  // ==========================================
  if (formato === 'TICKET') {
    return (
      <div className="ticket-termico" style={{ width: '72mm', margin: '0 auto', fontFamily: 'monospace', fontSize: '11px', color: '#000', lineHeight: '1.2' }}>
        
        {/* ENCABEZADO */}
        <div className="text-center pb-2 border-bottom border-dark border-1">
          {empresa.logo_url && (<img src={empresa.logo_url} alt="Logo" style={{ maxHeight: '40px', maxWidth: '100%', marginBottom: '4px', filter: 'grayscale(100%)' }} />)}
          <div className="fw-bold fs-6">{empresa.nombre_fantasia || empresa.razon_social}</div>
          <div style={{ fontSize: '10px' }}>{empresa.direccion}</div>
          {empresa.telefono && <div style={{ fontSize: '10px' }}>Tel: {empresa.telefono}</div>}
          
          {!esPresupuestoO_Interno && (
            <div className="mt-1" style={{ fontSize: '10px' }}>
              <div>CUIT: {empresa.cuit}</div>
              <div>IVA {empresa.condicion_iva} - IIBB: {empresa.iibb}</div>
              <div>Inicio Act.: {empresa.inicio_actividades}</div>
            </div>
          )}
        </div>

        {/* IDENTIFICACIÓN */}
        <div className="text-center py-2 border-bottom border-dark border-1">
          <div className="d-inline-block border border-dark px-2 fw-bold fs-6">{letra}</div>
          <div className="fw-bold mt-1">{tituloDocumento}</div>
          <div className="font-monospace">{nroComprobante}</div>
          <div style={{ fontSize: '10px' }}>Fecha: {fecha}</div>
          <div style={{ fontSize: '10px' }}>Cajero/a: {operador}</div>
          {esPresupuestoO_Interno && (<div className="fw-bold mt-1" style={{ fontSize: '9px' }}>DOCUMENTO NO VÁLIDO COMO FACTURA</div>)}
        </div>

        {/* CLIENTE */}
        <div className="py-2 border-bottom border-dark border-1" style={{ fontSize: '10px' }}>
          <div><strong>Cliente:</strong> {cliente.nombre}</div>
          {cliente.cuit && <div><strong>CUIT/DNI:</strong> {cliente.cuit}</div>}
          <div><strong>Condición IVA:</strong> {cliente.condicionIva}</div>
          <div className="mt-1 border-top border-dotted pt-1"><strong>Cond. Venta:</strong> {condicionVenta}</div>
        </div>

        {/* PRODUCTOS */}
        <table className="w-100 my-2" style={{ fontSize: '10px' }}>
          <thead>
            <tr className="border-bottom border-dark">
              <th className="text-start" style={{ width: '55%' }}>Desc</th><th className="text-center" style={{ width: '15%' }}>Cant</th><th className="text-end" style={{ width: '30%' }}>Total</th>
            </tr>
          </thead>
          <tbody>
            {items.map((it, idx) => {
              const cant = Number(it.cantidad || it.cant || 1);
              const precio = Number(it.precio_unitario || it.precio || 0);
              return (
                <tr key={idx}>
                  <td className="text-start text-truncate" style={{ maxWidth: '100px' }}>{it.descripcion || it.desc || it.articulo_cod || it.cod}</td>
                  <td className="text-center">{cant}</td>
                  <td className="text-end font-monospace">{formatoMoneda(cant * precio)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {/* TOTAL */}
        <div className="border-top border-dark border-2 pt-1 pb-1 text-end">
          <div className="fs-6 fw-bold">TOTAL: {formatoMoneda(total)}</div>
        </div>

        {/* DETALLE DE PAGOS */}
        {pagos && pagos.length > 0 && (
          <div className="border-bottom border-dark pb-2 mb-2" style={{ fontSize: '9px' }}>
            <strong>Detalle de Pagos:</strong>
            {pagos.map((p, i) => (
              <div key={i} className="d-flex justify-content-between">
                <span>- {p.metodo}</span>
                <span className="font-monospace fw-bold">{formatoMoneda(p.fisicoCobrado)}</span>
              </div>
            ))}
          </div>
        )}

        {/* PIE ARCA/AFIP Y TRANSPARENCIA FISCAL */}
        {!esPresupuestoO_Interno ? (
          <>
            {letra === 'B' && (
              <div className="border-top border-dark pt-1 pb-2" style={{ fontSize: '8.5px' }}>
                <strong className="d-block text-center mb-1">Régimen de Transparencia Fiscal al Consumidor (Ley 27.743)</strong>
                <div className="d-flex justify-content-between"><span>IVA Contenido:</span><span>{formatoMoneda(ivaContenido)}</span></div>
                <div className="d-flex justify-content-between"><span>Otros Imp. Nac. Indirectos:</span><span>$ 0,00</span></div>
              </div>
            )}
            {datosAfip && datosAfip.cae && (
              <div className="border-top border-dark pt-2 d-flex flex-column align-items-center" style={{ fontSize: '9px' }}>
                <img src={generarUrlQR()} alt="QR AFIP" style={{ width: '70px', height: '70px', marginBottom: '5px' }} />
                <div className="fw-bold">CAE: {datosAfip.cae}</div>
                <div>Vto. CAE: {datosAfip.vtoCae}</div>
                {empresa.leyenda_factura && <div className="mt-2 text-center fst-italic">{empresa.leyenda_factura}</div>}
              </div>
            )}
          </>
        ) : (
          <div className="border-top border-dark pt-2" style={{ fontSize: '8.5px' }}>
            {empresa.leyendas_presupuesto && empresa.leyendas_presupuesto.map((ley, i) => (
              leyendasSeleccionadas[i] && ley ? <div key={i}>• {ley}</div> : null
            ))}
          </div>
        )}
      </div>
    );
  }

  // ==========================================
  // 2. FORMATO HOJA A4 (Oficial / Presupuesto Formal)
  // ==========================================
  return (
    <div className="hoja-a4 bg-white p-4 text-dark" style={{ width: '210mm', minHeight: '297mm', margin: '0 auto', fontFamily: 'Arial, sans-serif', fontSize: '12px', display: 'flex', flexDirection: 'column' }}>
      
      {/* CUADRO SUPERIOR */}
      <div className="border border-dark position-relative mb-3">
        <div className="position-absolute top-0 start-50 translate-middle-x bg-white border border-dark text-center" style={{ width: '55px', height: '55px', zIndex: 10 }}>
          <div className="fs-2 fw-bold leading-none">{letra}</div>
          <div style={{ fontSize: '8px', marginTop: '-4px' }}>{esPresupuestoO_Interno ? 'CÓD. 090' : (letra === 'A' ? 'CÓD. 001' : 'CÓD. 006')}</div>
        </div>

        <div className="row g-0">
          <div className="col-6 p-3 border-end border-dark">
            <div className="d-flex align-items-center mb-2">
              {empresa.logo_url && <img src={empresa.logo_url} alt="Logo" style={{ maxHeight: '55px', maxWidth: '140px', marginRight: '15px' }} />}
              <div><h5 className="fw-bold m-0">{empresa.nombre_fantasia || empresa.razon_social}</h5><small className="text-muted">{empresa.razon_social}</small></div>
            </div>
            <div className="small"><strong>Dirección:</strong> {empresa.direccion}</div>
            <div className="small"><strong>Teléfono:</strong> {empresa.telefono} | <strong>WhatsApp:</strong> {empresa.whatsapp}</div>
            <div className="small"><strong>Condición IVA:</strong> {empresa.condicion_iva}</div>
          </div>
          <div className="col-6 p-3 ps-4">
            <h4 className="fw-bold tracking-wide">{tituloDocumento}</h4>
            <div className="fs-6 font-monospace mb-1"><strong>Nro:</strong> {nroComprobante}</div>
            <div><strong>Fecha de Emisión:</strong> {fecha}</div>
            <div><strong>Atendió:</strong> {operador}</div>
            <div><strong>Condición de Venta:</strong> {condicionVenta}</div>
            
            {!esPresupuestoO_Interno ? (
              <div className="mt-2 pt-2 border-top small">
                <div><strong>CUIT:</strong> {empresa.cuit}</div>
                <div><strong>Ingresos Brutos:</strong> {empresa.iibb}</div>
                <div><strong>Inicio de Actividades:</strong> {empresa.inicio_actividades}</div>
              </div>
            ) : (
              <div className="mt-3 text-muted fw-bold small">DOCUMENTO NO VÁLIDO COMO FACTURA</div>
            )}
          </div>
        </div>
      </div>

      {/* DATOS DEL CLIENTE */}
      <div className="border border-dark p-2 mb-3 bg-light bg-opacity-50">
        <div className="row">
          <div className="col-7"><strong>Razón Social / Nombre:</strong> {cliente.nombre}</div>
          <div className="col-5"><strong>CUIT / DNI:</strong> {cliente.cuit || 'Consumidor Final'}</div>
          <div className="col-7 mt-1"><strong>Condición frente al IVA:</strong> {cliente.condicionIva}</div>
          <div className="col-5 mt-1"><strong>Domicilio Comercial:</strong> {cliente.direccion || '-'}</div>
        </div>
      </div>

      {/* TABLA DE PRODUCTOS */}
      <table className="table table-bordered table-sm border-dark mb-3 align-middle">
        <thead className="table-secondary border-dark text-center">
          <tr><th style={{ width: '15%' }}>Código</th><th style={{ width: '50%' }}>Descripción del Repuesto</th><th style={{ width: '10%' }}>Cant.</th><th style={{ width: '12%' }}>Precio Unit.</th><th style={{ width: '13%' }}>Subtotal</th></tr>
        </thead>
        <tbody>
          {items.map((it, idx) => {
            const cant = Number(it.cantidad || it.cant || 1); const precio = Number(it.precio_unitario || it.precio || 0);
            return (
              <tr key={idx}>
                <td className="font-monospace text-center">{it.articulo_cod || it.cod || '-'}</td>
                <td>{it.descripcion || it.desc || it.articulo_cod}</td>
                <td className="text-center fw-bold">{cant}</td>
                <td className="text-end font-monospace">{formatoMoneda(precio)}</td>
                <td className="text-end font-monospace fw-bold">{formatoMoneda(cant * precio)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* TOTALES Y DETALLE DE PAGO */}
      <div className="d-flex flex-column align-items-end mb-3">
        <div className="border border-dark p-3 text-end mb-2" style={{ width: '280px' }}>
          <div className="fs-5 fw-bold font-monospace">TOTAL: {formatoMoneda(total)}</div>
        </div>
        
        {pagos && pagos.length > 0 && (
          <div className="border border-dark p-2 bg-light bg-opacity-50" style={{ width: '280px', fontSize: '11px' }}>
            <strong className="d-block mb-1 border-bottom border-dark pb-1">Detalle de Pagos:</strong>
            {pagos.map((p, idx) => (
              <div key={idx} className="d-flex justify-content-between mt-1">
                <span>{p.metodo}</span>
                <span className="font-monospace fw-bold">{formatoMoneda(p.fisicoCobrado)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* PIE DE PÁGINA: LEYES Y ARCA */}
      <div className="mt-auto border-top border-dark border-2 pt-3">
        {!esPresupuestoO_Interno ? (
          <div className="row">
            {/* LEY DE TRANSPARENCIA FISCAL (Izquierda) */}
            <div className="col-7 border-end border-dark">
              {letra === 'B' && (
                <div className="p-2 bg-light border border-dark h-100" style={{ fontSize: '10px' }}>
                  <strong className="d-block border-bottom border-dark pb-1 mb-1">Régimen de Transparencia Fiscal al Consumidor (Ley 27.743)</strong>
                  <div className="d-flex justify-content-between"><span>IVA Contenido:</span><strong>{formatoMoneda(ivaContenido)}</strong></div>
                  <div className="d-flex justify-content-between"><span>Otros Impuestos Nacionales Indirectos:</span><strong>$ 0,00</strong></div>
                </div>
              )}
              {empresa.leyenda_factura && <div className="mt-2 small fst-italic text-muted">{empresa.leyenda_factura}</div>}
            </div>

            {/* QR Y CAE (Derecha) */}
            <div className="col-5 d-flex justify-content-end align-items-center gap-3">
              <div className="text-end">
                <div className="badge bg-dark px-3 py-1 mb-2">Comprobante Autorizado</div>
                <div className="fw-bold">CAE N°: {datosAfip?.cae || '-'}</div>
                <div className="small">Vencimiento CAE: {datosAfip?.vtoCae || '-'}</div>
              </div>
              <div>
                {datosAfip?.cae && <img src={generarUrlQR()} alt="QR AFIP" style={{ width: '80px', height: '80px', border: '1px solid #000' }} />}
              </div>
            </div>
          </div>
        ) : (
          <div>
            <h6 className="fw-bold mb-1" style={{ fontSize: '11px' }}>Condiciones del Presupuesto:</h6>
            {empresa.leyendas_presupuesto && empresa.leyendas_presupuesto.map((ley, i) => (
              leyendasSeleccionadas[i] && ley ? <div key={i} className="text-muted" style={{ fontSize: '10px' }}>• {ley}</div> : null
            ))}
          </div>
        )}
      </div>

    </div>
  );
}