import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3"
import nodemailer from "npm:nodemailer@6.9.13"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    // AHORA RECIBIMOS EL ADJUNTO (adjuntoBase64 y nombreAdjunto)
    const { emailDestino, asunto, mensajeHtml, adjuntoBase64, nombreAdjunto } = await req.json()

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    const supabase = createClient(supabaseUrl, supabaseKey)

    const { data: config, error: dbError } = await supabase.from('config_empresa').select('smtp_host, smtp_port, smtp_user, smtp_pass, nombre_fantasia').single()
    if (dbError) throw new Error("Error leyendo BD: " + dbError.message)
    if (!config || !config.smtp_host) throw new Error("No hay configuración SMTP cargada.")

    const claveLimpia = config.smtp_pass.replace(/\s+/g, '')
    const transporter = nodemailer.createTransport({
      host: config.smtp_host, port: config.smtp_port, secure: config.smtp_port === 465,
      auth: { user: config.smtp_user, pass: claveLimpia },
    })

    const mailOptions: any = {
      from: `"${config.nombre_fantasia || 'Repuestos Santa Rosa'}" <${config.smtp_user}>`,
      to: emailDestino,
      subject: asunto,
      html: mensajeHtml,
    }

    // SI HAY UN PDF GENERADO, LO METEMOS EN EL CORREO
    if (adjuntoBase64 && nombreAdjunto) {
      mailOptions.attachments = [{
        filename: nombreAdjunto,
        content: adjuntoBase64,
        encoding: 'base64'
      }]
    }

    await transporter.sendMail(mailOptions)

    return new Response(JSON.stringify({ ok: true, mensaje: "Correo enviado con éxito" }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 })
  } catch (error) {
    return new Response(JSON.stringify({ ok: false, error: error.message }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 })
  }
})