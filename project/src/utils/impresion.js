export const emitirImpresionHibrida = async ({
  datosComprobante,
  nombreImpresora = '',
  elementoHtmlId = 'area-impresion-modal'
}) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 1500);

  try {
    const respuesta = await fetch('http://127.0.0.1:5000/imprimir', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        impresora: nombreImpresora || null,
        datos: {
          empresa: 'REPUESTOS SANTA ROSA',
          cuit: '27-10614590-9',
          direccion: 'Av. Spinetto 1234, Santa Rosa',
          titulo: datosComprobante.tipo === 'FISCAL' ? 'FACTURA' : 'PRESUPUESTO',
          letra: datosComprobante.letra || 'B',
          nro: datosComprobante.nroComprobante,
          fecha: datosComprobante.fecha,
          cliente: datosComprobante.cliente?.nombre || 'Consumidor Final',
          items: datosComprobante.items || [],
          total: datosComprobante.total || 0,
          cae: datosComprobante.datosAfip?.cae || '',
          vto_cae: datosComprobante.datosAfip?.vtoCae || '',
          abrir_cajon: true
        }
      })
    });

    clearTimeout(timeoutId);

    if (!respuesta.ok) throw new Error('Error en el servicio local');
    const data = await respuesta.json();
    if (!data.ok) throw new Error(data.error);

    return { metodo: 'DIRECTA', exito: true };

  } catch (err) {
    clearTimeout(timeoutId);
    console.info("Controlador local no detectado. Imprimiendo mediante diálogo del navegador.");
    
    const contenedor = document.getElementById(elementoHtmlId);
    if (contenedor) {
      const printContents = contenedor.innerHTML;
      const originalContents = document.body.innerHTML;
      document.body.innerHTML = printContents;
      window.print();
      document.body.innerHTML = originalContents;
      window.location.reload();
    } else {
      window.print();
    }

    return { metodo: 'NAVEGADOR', exito: true };
  }
};