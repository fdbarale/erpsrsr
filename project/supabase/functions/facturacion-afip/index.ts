import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import Afip from "npm:@afipsdk/afip.js"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Manejo de seguridad para llamadas desde el navegador (CORS)
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { total, cliente_doc, cliente_iva } = await req.json()

    // 1. Instanciar AFIP chupando las credenciales de las variables de entorno seguras
    const afip = new Afip({
      CUIT: 27106145909,
      cert: Deno.env.get('AFIP_CERT'),
      key: Deno.env.get('AFIP_KEY'),
      access_token: Deno.env.get('AFIP_TOKEN'),
      production: true
    });

    // 2. Determinar Tipo de Comprobante
    const cbteTipo = (cliente_iva === 'Responsable Inscripto' || cliente_iva === 'Monotributo') ? 1 : 6;

    // 3. Determinar Tipo de Documento (80 = CUIT, 96 = DNI, 99 = Consumidor Final Anónimo)
    const docStr = cliente_doc ? cliente_doc.toString() : '';
    const docTipo = docStr.length === 11 ? 80 : (docStr.length > 0 ? 96 : 99);
    const docNro = docStr.length > 0 ? parseInt(docStr) : 0;

    // 4. Cálculos impositivos al centavo
    const impNeto = Math.round((total / 1.21) * 100) / 100;
    const impIva = Math.round((total - impNeto) * 100) / 100;

    // 5. Consultar último comprobante a los servidores de AFIP
    const ultimoCbte = await afip.ElectronicBilling.getLastVoucher(14, cbteTipo);
    const numeroComprobante = ultimoCbte + 1;
    
    // Obtener fecha actual en formato YYYYMMDD (Hora Argentina)
    const fechaHoy = new Date(Date.now() - 10800000).toISOString().split('T')[0].replace(/-/g, '');

    // 6. Armar el paquete de datos
    const payload = {
        'CantReg': 1,
        'PtoVta': 14,
        'CbteTipo': cbteTipo,
        'Concepto': 1, // 1 = Venta de Productos
        'DocTipo': docTipo,
        'DocNro': docNro,
        'CbteDesde': numeroComprobante,
        'CbteHasta': numeroComprobante,
        'CbteFch': parseInt(fechaHoy),
        'ImpTotal': total,
        'ImpTotConc': 0,
        'ImpNeto': impNeto,
        'ImpOpEx': 0,
        'ImpIVA': impIva,
        'ImpTrib': 0,
        'MonId': 'PES',
        'MonCotiz': 1,
        'Iva': [
            {
                'Id': 5, // IVA 21%
                'BaseImp': impNeto,
                'Importe': impIva
            }
        ]
    };

    // 7. Disparar el webservice de facturación
    const res = await afip.ElectronicBilling.createVoucher(payload);

    // 8. Devolver los datos del ticket al frontend
    return new Response(
      JSON.stringify({ 
        cae: res.CAE, 
        vtoCae: res.CAEFchVto, 
        nroComprobante: numeroComprobante, 
        tipoComprobante: cbteTipo 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error("Fallo crítico en AFIP:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})