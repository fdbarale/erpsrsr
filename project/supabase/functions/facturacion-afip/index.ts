import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import Afip from "npm:@afipsdk/afip.js"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { total, cliente_doc, cliente_iva, is_nc, cbte_asoc_tipo, cbte_asoc_nro } = await req.json();

    const afip = new Afip({
      CUIT: 27106145909,
      cert: Deno.env.get('AFIP_CERT'),
      key: Deno.env.get('AFIP_KEY'),
      access_token: Deno.env.get('AFIP_TOKEN'),
      production: true
    });

    // Determinar código fiscal. Si es NC (is_nc = true), usamos 3 o 8. Si es Factura, 1 o 6.
    let cbteTipo = (cliente_iva === 'Responsable Inscripto' || cliente_iva === 'Monotributo') ? 1 : 6;
    if (is_nc) cbteTipo = cbteTipo === 1 ? 3 : 8; 

    const docStr = cliente_doc ? cliente_doc.toString() : '';
    const docTipo = docStr.length === 11 ? 80 : (docStr.length > 0 ? 96 : 99);
    const docNro = docStr.length > 0 ? parseInt(docStr) : 0;

    const impNeto = Math.round((total / 1.21) * 100) / 100;
    const impIva = Math.round((total - impNeto) * 100) / 100;

    const ultimoCbte = await afip.ElectronicBilling.getLastVoucher(14, cbteTipo);
    const numeroComprobante = ultimoCbte + 1;
    const fechaHoy = new Date(Date.now() - 10800000).toISOString().split('T')[0].replace(/-/g, '');

    const payload: any = {
        'CantReg': 1, 'PtoVta': 14, 'CbteTipo': cbteTipo, 'Concepto': 1,
        'DocTipo': docTipo, 'DocNro': docNro,
        'CbteDesde': numeroComprobante, 'CbteHasta': numeroComprobante, 'CbteFch': parseInt(fechaHoy),
        'ImpTotal': total, 'ImpTotConc': 0, 'ImpNeto': impNeto, 'ImpOpEx': 0, 'ImpIVA': impIva, 'ImpTrib': 0,
        'MonId': 'PES', 'MonCotiz': 1,
        'Iva': [{ 'Id': 5, 'BaseImp': impNeto, 'Importe': impIva }]
    };

    // REGLA AFIP PARA NOTAS DE CRÉDITO: Obligatorio enviar el ticket asociado
    if (is_nc && cbte_asoc_tipo && cbte_asoc_nro) {
        payload['CbtesAsoc'] = [{
            'Tipo': cbte_asoc_tipo,
            'PtoVta': 14,
            'Nro': cbte_asoc_nro,
            'Cuit': docTipo === 99 ? 27106145909 : docNro // Si es anónimo, AFIP exige enviar el propio CUIT
        }];
    }

    const res = await afip.ElectronicBilling.createVoucher(payload);

    return new Response(
      JSON.stringify({ cae: res.CAE, vtoCae: res.CAEFchVto, nroComprobante: numeroComprobante, tipoComprobante: cbteTipo }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 });
  }
})