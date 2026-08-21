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

  if (!empresa) return <div className="p-3 text-center small text-muted font-monospace">Cargando...</div>;

  const esPresupuestoO_Interno = tipo === 'PRESUPUESTO' || tipo === 'INTERNO' || letra === 'X';
  const esCtaCte = pagos && pagos.some(p => p.metodo === 'Cuenta Corriente');
  const condicionVenta = esCtaCte ? 'Cuenta Corriente' : 'Contado';
  const tituloDocumento = esPresupuestoO_Interno ? 'PRESUPUESTO' : (letra === 'A' ? 'FACTURA A' : 'FACTURA B');

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
  // FORMATO TICKET 80mm
  // ==========================================
  if (formato === 'TICKET') {
    return (
      <div className="ticket-termico position-relative" style={{ width: '76mm', margin: '0 auto', fontFamily: 'monospace', fontSize: '11px', color: '#000', lineHeight: '1.25' }}>
        <style>{`
          @page { size: 80mm auto; margin: 0mm; }
          @media print {
            body { margin: 0 !important; padding: 0 !important; }
            .ticket-termico { width: 76mm !important; margin: 0 !important; }
          }
        `}</style>

        {/* MARCA DISIMULADA CC EN EL ÁNGULO SUPERIOR DERECHO */}
        {esCtaCte && (
          <div style={{ position: 'absolute', top: 0, right: 0, fontSize: '8px', color: '#444', fontWeight: 'bold' }}>
            cc
          </div>
        )}

        {/* ENCABEZADO */}
        <div className="text-center pb-2 border-bottom border-dark border-1">
          {empresa.logo_url && (
            <img src={empresa.logo_url} alt="Logo" style={{ maxHeight: '42px', maxWidth: '90%', marginBottom: '4px', filter: 'grayscale(100%)' }} />
          )}
          <div className="fw-bold fs-6">{empresa.nombre_fantasia || empresa.razon_social}</div>
          <div style={{ fontSize: '10px' }}>{empresa.direccion}</div>
          {empresa.telefono && <div style={{ fontSize: '10px' }}>Tel: {empresa.telefono}</div>}
          
          {!esPresupuestoO_Interno && (
            <div className="mt-1" style={{ fontSize: '10px' }}>
              <div>CUIT: {empresa.cuit}</div>
              <div>IVA {empresa.condicion_iva} - IIBB: {empresa.iibb}</div>
            </div>
          )}
        </div>

        {/* IDENTIFICACIÓN */}
        <div className="text-center py-2 border-bottom border-dark border-1">
          <div className="d-inline-block border border-dark px-2 fw-bold fs-6">{letra}</div>
          <div className="fw-bold mt-1">{tituloDocumento}</div>
          <div className="font-monospace">{nroComprobante}</div>
          <div style={{ fontSize: '10px' }}>Fecha: {fecha}</div>
          <div style={{ fontSize: '10px' }}>Atendió: {operador}</div>
          {esPresupuestoO_Interno && (
            <div className="fw-bold mt-1" style={{ fontSize: '9px' }}>DOCUMENTO NO VÁLIDO COMO FACTURA</div>
          )}
        </div>

        {/* CLIENTE */}
        <div className="py-2 border-bottom border-dark border-1" style={{ fontSize: '10px' }}>
          <div><strong>Cliente:</strong> {cliente.nombre} {cliente.sobrenombre ? `(${cliente.sobrenombre})` : ''}</div>
          {cliente.cuit && <div><strong>CUIT/DNI:</strong> {cliente.cuit}</div>}
          <div><strong>Condición IVA:</strong> {cliente.condicionIva}</div>
        </div>

        {/* PRODUCTOS */}
        <table className="w-100 my-2" style={{ fontSize: '10px' }}>
          <thead>
            <tr className="border-bottom border-dark">
              <th className="text-start" style={{ width: '55%' }}>Detalle</th>
              <th className="text-center" style={{ width: '15%' }}>Cant</th>
              <th className="text-end" style={{ width: '30%' }}>Total</th>
            </tr>
          </thead>
          <tbody>
            {items.map((it, idx) => {
              const cant = Number(it.cantidad || it.cant || 1);
              const precio = Number(it.precio_unitario || it.precio || 0);
              return (
                <tr key={idx}>
                  <td className="text-start" style={{ wordBreak: 'break-word' }}>
                    {it.marca ? `${it.marca} ` : ''}{it.desc || it.descripcion || it.cod}
                  </td>
                  <td className="text-center align-top">{cant}</td>
                  <td className="text-end font-monospace align-top">{formatoMoneda(cant * precio)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {/* TOTAL */}
        <div className="border-top border-dark border-2 pt-1 pb-1 text-end">
          <div className="fs-6 fw-bold">TOTAL: {formatoMoneda(total)}</div>
        </div>

        {/* PIE */}
        {!esPresupuestoO_Interno ? (
          <>
            {letra === 'B' && (
              <div className="border-top border-dark pt-1 pb-2" style={{ fontSize: '8.5px' }}>
                <strong className="d-block text-center mb-1">Régimen de Transparencia Fiscal (Ley 27.743)</strong>
                <div className="d-flex justify-content-between"><span>IVA Contenido:</span><span>{formatoMoneda(ivaContenido)}</span></div>
              </div>
            )}
            {datosAfip && datosAfip.cae && (
              <div className="border-top border-dark pt-2 d-flex flex-column align-items-center" style={{ fontSize: '9px' }}>
                <img src={generarUrlQR()} alt="QR AFIP" style={{ width: '70px', height: '70px', marginBottom: '5px' }} />
                <div className="fw-bold">CAE: {datosAfip.cae}</div>
                <div>Vto. CAE: {datosAfip.vtoCae}</div>
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
  // FORMATO A4
  // ==========================================
  return (
    <div className="hoja-a4 bg-white p-4 text-dark position-relative" style={{ width: '210mm', minHeight: '297mm', margin: '0 auto', fontFamily: 'Arial, sans-serif', fontSize: '12px', display: 'flex', flexDirection: 'column' }}>
      {esCtaCte && (
        <div style={{ position: 'absolute', top: '15px', right: '15px', fontSize: '10px', color: '#666', fontWeight: 'bold' }}>
          cc
        </div>
      )}

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
            <div className="small"><strong>Teléfono:</strong> {empresa.telefono}</div>
            <div className="small"><strong>Condición IVA:</strong> {empresa.condicion_iva}</div>
          </div>
          <div className="col-6 p-3 ps-4">
            <h4 className="fw-bold tracking-wide">{tituloDocumento}</h4>
            <div className="fs-6 font-monospace mb-1"><strong>Nro:</strong> {nroComprobante}</div>
            <div><strong>Fecha:</strong> {fecha}</div>
            <div><strong>Atendió:</strong> {operador}</div>
          </div>
        </div>
      </div>

      <div className="border border-dark p-2 mb-3 bg-light bg-opacity-50">
        <div className="row">
          <div className="col-7"><strong>Cliente:</strong> {cliente.nombre} {cliente.sobrenombre ? `(${cliente.sobrenombre})` : ''}</div>
          <div className="col-5"><strong>CUIT / DNI:</strong> {cliente.cuit || 'Consumidor Final'}</div>
          <div className="col-7 mt-1"><strong>Condición IVA:</strong> {cliente.condicionIva}</div>
          <div className="col-5 mt-1"><strong>Domicilio:</strong> {cliente.direccion || '-'}</div>
        </div>
      </div>

      <table className="table table-bordered table-sm border-dark mb-3 align-middle">
        <thead className="table-secondary border-dark text-center">
          <tr><th style={{ width: '15%' }}>Código</th><th style={{ width: '50%' }}>Descripción</th><th style={{ width: '10%' }}>Cant.</th><th style={{ width: '12%' }}>Precio Unit.</th><th style={{ width: '13%' }}>Subtotal</th></tr>
        </thead>
        <tbody>
          {items.map((it, idx) => {
            const cant = Number(it.cantidad || it.cant || 1); 
            const precio = Number(it.precio_unitario || it.precio || 0);
            return (
              <tr key={idx}>
                <td className="font-monospace text-center">{it.cod || it.articulo_cod || '-'}</td>
                <td>{it.marca ? `${it.marca} ` : ''}{it.desc || it.descripcion}</td>
                <td className="text-center fw-bold">{cant}</td>
                <td className="text-end font-monospace">{formatoMoneda(precio)}</td>
                <td className="text-end font-monospace fw-bold">{formatoMoneda(cant * precio)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <div className="d-flex flex-column align-items-end mb-3">
        <div className="border border-dark p-3 text-end mb-2" style={{ width: '280px' }}>
          <div className="fs-5 fw-bold font-monospace">TOTAL: {formatoMoneda(total)}</div>
        </div>
      </div>

      <div className="mt-auto border-top border-dark border-2 pt-3">
        {!esPresupuestoO_Interno && datosAfip?.cae && (
          <div className="d-flex justify-content-between align-items-center">
            <div>
              <div className="fw-bold">CAE N°: {datosAfip.cae}</div>
              <div>Vencimiento CAE: {datosAfip.vtoCae}</div>
            </div>
            <img src={generarUrlQR()} alt="QR AFIP" style={{ width: '80px', height: '80px', border: '1px solid #000' }} />
          </div>
        )}
      </div>
    </div>
  );
}