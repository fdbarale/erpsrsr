import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    // AHORA RECIBE "permisos"
    const { accion, email, password, nombre, rol, permisos } = await req.json()
    
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '', 
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    if (accion === 'crear') {
      const { data: userAuth, error: authErr } = await supabaseAdmin.auth.admin.createUser({
        email: email,
        password: password,
        email_confirm: true
      })
      
      if (authErr) throw new Error("Fallo en Auth: " + authErr.message)

      const { error: dbErr } = await supabaseAdmin.from('config_usuarios').upsert({
        email: email,
        nombre: nombre,
        rol: rol,
        permisos: permisos || {} // SE GUARDAN ACÁ
      })
      
      if (dbErr) throw new Error("Fallo guardando datos: " + dbErr.message)

      return new Response(JSON.stringify({ ok: true, mensaje: "Usuario creado con éxito." }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 })
    }

    if (accion === 'eliminar') {
      const { data: listData } = await supabaseAdmin.auth.admin.listUsers()
      const user = listData.users.find(u => u.email === email)
      if (user) await supabaseAdmin.auth.admin.deleteUser(user.id)
      
      await supabaseAdmin.from('config_usuarios').delete().eq('email', email)
      
      return new Response(JSON.stringify({ ok: true, mensaje: "Eliminado." }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 })
    }

  } catch (error) {
    return new Response(JSON.stringify({ ok: false, error: error.message }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 })
  }
})