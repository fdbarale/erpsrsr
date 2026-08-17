import React, { useState, useEffect } from 'react';
import { dbOficial } from '../supabaseClient';
import { UserPlus, Trash2, Shield } from 'lucide-react';

export default function Configuracion({ volverAlMenu }) {
  const [tabActiva, setTabActiva] = useState('empresa');
  const [procesando, setProcesando] = useState(false);

  const colorBordo = '#6B1116';
  const colorGris = '#54565b';

  // --- ESTADOS: EMPRESA ---
  const [empresa, setEmpresa] = useState({
    razon_social: '', nombre_fantasia: '', cuit: '', condicion_iva: 'Responsable Inscripto',
    iibb: '', inicio_actividades: '', direccion: '', telefono: '', whatsapp: '', email: '',
    logo_url: '', leyenda_factura: '', leyendas_presupuesto: ['', '', ''],
    config_hardware: { ticket: '', a4: '', etiquetas: '', ancho_etiqueta: 50, alto_etiqueta: 25 },
    smtp_host: '', smtp_port: 465, smtp_user: '', smtp_pass: ''
  });

  const [tipoLeyendaAfip, setTipoLeyendaAfip] = useState('NINGUNA');
  const LEYENDAS_AFIP = {
    'NINGUNA': '',
    'RG_1415': 'Comprobante autorizado. R.G. N° 1415/03 AFIP DGI.',
    'FACTURA_A': 'El crédito fiscal discriminado en el presente comprobante sólo podrá ser computado a efectos del Régimen de Sostenimiento e Inclusión Fiscal para Pequeños Contribuyentes de la Ley Nº 27.618.',
    'FACTURA_M': 'La operación sujeta a retención del 100% de IVA y 3% de Ganancias.',
    'PERSONALIZADA': 'PERSONALIZADA'
  };

  // --- ESTADOS: OTROS MÓDULOS ---
  const [mediosPago, setMediosPago] = useState([]);
  const [proveedores, setProveedores] = useState([]);
  const [transportes, setTransportes] = useState([]);
  const [nuevoMedio, setNuevoMedio] = useState({ nombre: '', tipo: 'NORMAL', porcentaje: 0 });
  const [nuevoProveedor, setNuevoProveedor] = useState({ nombre: '', url_catalogo: '' });
  const [nuevoTransporte, setNuevoTransporte] = useState({ nombre: '', telefono: '' });

  // --- ESTADOS: USUARIOS Y AUTH ---
  const [usuarios, setUsuarios] = useState([]);
  const [formUsuario, setFormUsuario] = useState({ 
    nombre: '', email: '', password: '', rol: 'mostrador',
    permisos: { facturar_blanco: true, operar_sombra: false, anular_comprobantes: false, configurar_sistema: false }
  });

  // --- FUNCIONES DE CARGA ---
  const cargarUsuarios = async () => {
    const { data } = await dbOficial.from('config_usuarios').select('*').order('nombre');
    if (data) setUsuarios(data);
  };

  const cargarTodo = async () => {
    try {
      const [resEmpresa, resMedios, resProveedores, resTransportes] = await Promise.all([
        dbOficial.from('config_empresa').select('*').single(),
        dbOficial.from('config_medios_pago').select('*').order('nombre', { ascending: true }),
        dbOficial.from('proveedores_distribuidores').select('*').order('nombre', { ascending: true }),
        dbOficial.from('transportes').select('*').order('nombre', { ascending: true })
      ]);

      if (resEmpresa.data) {
        const leyendas = Array.isArray(resEmpresa.data.leyendas_presupuesto) ? resEmpresa.data.leyendas_presupuesto : ['', '', ''];
        const hw = resEmpresa.data.config_hardware || { ticket: '', a4: '', etiquetas: '', ancho_etiqueta: 50, alto_etiqueta: 25 };
        
        let leyendaEncontrada = 'PERSONALIZADA';
        for (const [clave, texto] of Object.entries(LEYENDAS_AFIP)) {
          if (resEmpresa.data.leyenda_factura === texto) {
            leyendaEncontrada = clave;
            break;
          }
        }
        setTipoLeyendaAfip(leyendaEncontrada);

        setEmpresa({
          ...resEmpresa.data,
          leyendas_presupuesto: [leyendas[0] || '', leyendas[1] || '', leyendas[2] || ''],
          config_hardware: hw,
          smtp_host: resEmpresa.data.smtp_host || '', smtp_port: resEmpresa.data.smtp_port || 465,
          smtp_user: resEmpresa.data.smtp_user || '', smtp_pass: resEmpresa.data.smtp_pass || ''
        });
      }

      if (resMedios.data) setMediosPago(resMedios.data);
      if (resProveedores.data) setProveedores(resProveedores.data);
      if (resTransportes.data) setTransportes(resTransportes.data);
      
      await cargarUsuarios();
    } catch (err) {
      console.error("Error cargando configuración:", err);
    }
  };

  useEffect(() => { cargarTodo(); }, []);

  // --- FUNCIONES: EMPRESA ---
  const procesarLogo = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 500000) return alert("El logo es muy pesado. Elegí una imagen de menos de 500 KB.");
      const reader = new FileReader();
      reader.onloadend = () => setEmpresa({...empresa, logo_url: reader.result});
      reader.readAsDataURL(file);
    }
  };

  const guardarDatosEmpresa = async () => {
    setProcesando(true);
    try {
      const { error } = await dbOficial.from('config_empresa').update({
        razon_social: empresa.razon_social, nombre_fantasia: empresa.nombre_fantasia, cuit: empresa.cuit, 
        condicion_iva: empresa.condicion_iva, iibb: empresa.iibb, inicio_actividades: empresa.inicio_actividades || null, 
        direccion: empresa.direccion, telefono: empresa.telefono, whatsapp: empresa.whatsapp, email: empresa.email,
        logo_url: empresa.logo_url, leyenda_factura: empresa.leyenda_factura, leyendas_presupuesto: empresa.leyendas_presupuesto, 
        config_hardware: empresa.config_hardware, smtp_host: empresa.smtp_host, smtp_port: empresa.smtp_port, 
        smtp_user: empresa.smtp_user, smtp_pass: empresa.smtp_pass
      }).eq('id', 1);

      if (error) throw error;
      alert("Configuración guardada correctamente.");
    } catch (err) { alert("Error al guardar: " + err.message); } finally { setProcesando(false); }
  };

  // --- FUNCIONES: USUARIOS ---
  const crearUsuario = async (e) => {
    e.preventDefault();
    if (formUsuario.password.length < 6) return alert("La contraseña debe tener al menos 6 caracteres.");
    
    setProcesando(true);
    try {
      const { data, error } = await dbOficial.functions.invoke('admin-usuarios', {
        body: { accion: 'crear', email: formUsuario.email, password: formUsuario.password, nombre: formUsuario.nombre, rol: formUsuario.rol, permisos: formUsuario.permisos }
      });

      if (error) throw new Error(error.message);
      if (data && !data.ok) throw new Error(data.error);

      setFormUsuario({ nombre: '', email: '', password: '', rol: 'mostrador', permisos: { facturar_blanco: true, operar_sombra: false, anular_comprobantes: false, configurar_sistema: false }});
      cargarUsuarios();
    } catch (error) { alert("❌ Error: " + error.message); } finally { setProcesando(false); }
  };

  const eliminarUsuario = async (emailObjetivo) => {
    if (!window.confirm(`¿Seguro que querés aniquilar del sistema a ${emailObjetivo}?`)) return;
    setProcesando(true);
    try {
      const { data, error } = await dbOficial.functions.invoke('admin-usuarios', { body: { accion: 'eliminar', email: emailObjetivo }});
      if (error) throw new Error(error.message);
      if (data && !data.ok) throw new Error(data.error);
      cargarUsuarios();
    } catch (error) { alert("❌ Error: " + error.message); } finally { setProcesando(false); }
  };

  // --- FUNCIONES: OTROS ---
  const agregarMedioPago = async () => { if (!nuevoMedio.nombre) return; await dbOficial.from('config_medios_pago').insert([{ nombre: nuevoMedio.nombre, tipo: nuevoMedio.tipo, porcentaje: parseFloat(nuevoMedio.porcentaje)||0 }]); setNuevoMedio({nombre:'',tipo:'NORMAL',porcentaje:0}); cargarTodo(); };
  const borrarMedioPago = async (id) => { if (!window.confirm("¿Borrar?")) return; await dbOficial.from('config_medios_pago').delete().eq('id', id); cargarTodo(); };
  const agregarProveedor = async () => { if (!nuevoProveedor.nombre) return; await dbOficial.from('proveedores_distribuidores').insert([nuevoProveedor]); setNuevoProveedor({nombre:'',url_catalogo:''}); cargarTodo(); };
  const borrarProveedor = async (id) => { if (!window.confirm("¿Borrar?")) return; await dbOficial.from('proveedores_distribuidores').delete().eq('id', id); cargarTodo(); };
  const agregarTransporte = async () => { if (!nuevoTransporte.nombre) return; await dbOficial.from('transportes').insert([nuevoTransporte]); setNuevoTransporte({nombre:'',telefono:''}); cargarTodo(); };
  const borrarTransporte = async (id) => { if (!window.confirm("¿Borrar?")) return; await dbOficial.from('transportes').delete().eq('id', id); cargarTodo(); };

  return (
    <div className="bg-light min-vh-100 d-flex flex-column" style={{ overflowX: 'hidden' }}>
      <nav className="navbar navbar-dark shadow-sm px-3" style={{ backgroundColor: colorBordo, borderBottom: `4px solid ${colorGris}` }}>
        <div className="container-fluid p-0">
          <div className="d-flex align-items-center">
            <button className="btn btn-sm btn-outline-light me-3 fw-bold" onClick={volverAlMenu}>⬅ Volver al Menú</button>
            <span className="navbar-brand fw-bold m-0 tracking-wide">Configuración del Sistema ERP</span>
          </div>
        </div>
      </nav>

      <div className="container-fluid mt-4 flex-grow-1 px-4 mb-5 pb-5">
        <div className="row h-100">
          
          <div className="col-md-3 border-end pe-4">
            <div className="nav flex-column nav-pills gap-2" role="tablist">
              <button className={`nav-link fw-bold text-start p-3 shadow-sm border ${tabActiva === 'empresa' ? 'active' : 'bg-white text-secondary'}`} onClick={() => setTabActiva('empresa')} style={tabActiva === 'empresa' ? { backgroundColor: colorBordo, color: 'white' } : {}}>🏢 Datos Empresa y Fiscales</button>
              <button className={`nav-link fw-bold text-start p-3 shadow-sm border ${tabActiva === 'usuarios' ? 'active' : 'bg-white text-secondary'}`} onClick={() => setTabActiva('usuarios')} style={tabActiva === 'usuarios' ? { backgroundColor: colorBordo, color: 'white' } : {}}>👥 Usuarios y Accesos</button>
              <button className={`nav-link fw-bold text-start p-3 shadow-sm border ${tabActiva === 'finanzas' ? 'active' : 'bg-white text-secondary'}`} onClick={() => setTabActiva('finanzas')} style={tabActiva === 'finanzas' ? { backgroundColor: colorBordo, color: 'white' } : {}}>💳 Medios de Pago y Recargos</button>
              <button className={`nav-link fw-bold text-start p-3 shadow-sm border ${tabActiva === 'hardware' ? 'active' : 'bg-white text-secondary'}`} onClick={() => setTabActiva('hardware')} style={tabActiva === 'hardware' ? { backgroundColor: colorBordo, color: 'white' } : {}}>🖨️ Impresoras y Etiquetas</button>
              <button className={`nav-link fw-bold text-start p-3 shadow-sm border ${tabActiva === 'logistica' ? 'active' : 'bg-white text-secondary'}`} onClick={() => setTabActiva('logistica')} style={tabActiva === 'logistica' ? { backgroundColor: colorBordo, color: 'white' } : {}}>🚚 Distribuidores y Logística</button>
            </div>
          </div>

          <div className="col-md-9 ps-4">
            <div className="tab-content h-100 pb-5">

              {tabActiva === 'empresa' && (
                <div className="card shadow-sm border-0 p-4 bg-white">
                  {/* CÓDIGO EMPRESA (Intacto) */}
                  <div className="d-flex align-items-center mb-4 pb-4 border-bottom">
                    <div className="me-4"><div className="bg-light border rounded d-flex align-items-center justify-content-center overflow-hidden shadow-sm" style={{ width: '120px', height: '120px' }}>{empresa.logo_url ? <img src={empresa.logo_url} alt="Logo" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} /> : <span className="text-muted small text-center px-2">Sin Logo</span>}</div></div>
                    <div><h6 className="fw-bold mb-1">Logotipo de la Empresa</h6><input type="file" className="form-control form-control-sm" accept="image/*" onChange={procesarLogo} />{empresa.logo_url && (<button className="btn btn-link text-danger p-0 small fw-bold mt-1" onClick={() => setEmpresa({...empresa, logo_url: ''})}>Eliminar Logo</button>)}</div>
                  </div>
                  <h5 className="fw-bold border-bottom pb-2 mb-4">Información Fiscal y Comercial</h5>
                  <div className="row g-3 mb-4">
                    <div className="col-md-6"><label className="form-label small fw-bold text-muted">Razón Social</label><input type="text" className="form-control fw-bold" value={empresa.razon_social || ''} onChange={e => setEmpresa({...empresa, razon_social: e.target.value})} /></div>
                    <div className="col-md-6"><label className="form-label small fw-bold text-muted">Nombre de Fantasía</label><input type="text" className="form-control fw-bold" value={empresa.nombre_fantasia || ''} onChange={e => setEmpresa({...empresa, nombre_fantasia: e.target.value})} /></div>
                    <div className="col-md-3"><label className="form-label small fw-bold text-muted">CUIT</label><input type="text" className="form-control font-monospace" value={empresa.cuit || ''} onChange={e => setEmpresa({...empresa, cuit: e.target.value})} /></div>
                    <div className="col-md-3"><label className="form-label small fw-bold text-muted">Condición IVA</label><select className="form-select" value={empresa.condicion_iva || 'Responsable Inscripto'} onChange={e => setEmpresa({...empresa, condicion_iva: e.target.value})}><option>Responsable Inscripto</option><option>Monotributo</option><option>Exento</option></select></div>
                    <div className="col-md-3"><label className="form-label small fw-bold text-muted">Ingresos Brutos (IIBB)</label><input type="text" className="form-control font-monospace" value={empresa.iibb || ''} onChange={e => setEmpresa({...empresa, iibb: e.target.value})} /></div>
                    <div className="col-md-3"><label className="form-label small fw-bold text-muted">Inicio Actividades</label><input type="date" className="form-control" value={empresa.inicio_actividades || ''} onChange={e => setEmpresa({...empresa, inicio_actividades: e.target.value})} /></div>
                    <div className="col-md-12"><label className="form-label small fw-bold text-muted">Dirección Comercial</label><input type="text" className="form-control" value={empresa.direccion || ''} onChange={e => setEmpresa({...empresa, direccion: e.target.value})} /></div>
                    <div className="col-md-4"><label className="form-label small fw-bold text-muted">Teléfono Fijo / Alternativo</label><input type="text" className="form-control" value={empresa.telefono || ''} onChange={e => setEmpresa({...empresa, telefono: e.target.value})} /></div>
                    <div className="col-md-4"><label className="form-label small fw-bold text-muted text-success">WhatsApp (Para envíos)</label><input type="text" className="form-control border-success" placeholder="Ej: 5492954..." value={empresa.whatsapp || ''} onChange={e => setEmpresa({...empresa, whatsapp: e.target.value})} /></div>
                    <div className="col-md-4"><label className="form-label small fw-bold text-muted">Email Comercial</label><input type="email" className="form-control" value={empresa.email || ''} onChange={e => setEmpresa({...empresa, email: e.target.value})} /></div>
                  </div>
                  <h5 className="fw-bold border-bottom pb-2 mb-4 mt-5">Configuración de Envío de Correos (SMTP)</h5>
                  <div className="row g-3 mb-4 bg-light p-3 border rounded">
                    <div className="col-md-4"><label className="form-label small fw-bold text-muted">Servidor SMTP</label><input type="text" className="form-control font-monospace" placeholder="Ej: smtp.gmail.com" value={empresa.smtp_host || ''} onChange={e => setEmpresa({...empresa, smtp_host: e.target.value})} /></div>
                    <div className="col-md-2"><label className="form-label small fw-bold text-muted">Puerto</label><input type="number" className="form-control font-monospace" placeholder="465" value={empresa.smtp_port || ''} onChange={e => setEmpresa({...empresa, smtp_port: parseInt(e.target.value)})} /></div>
                    <div className="col-md-3"><label className="form-label small fw-bold text-muted">Usuario (Correo)</label><input type="text" className="form-control font-monospace" placeholder="Ej: ventas@tuempresa.com" value={empresa.smtp_user || ''} onChange={e => setEmpresa({...empresa, smtp_user: e.target.value})} /></div>
                    <div className="col-md-3"><label className="form-label small fw-bold text-muted">Contraseña</label><input type="password" className="form-control font-monospace" placeholder="••••••••" value={empresa.smtp_pass || ''} onChange={e => setEmpresa({...empresa, smtp_pass: e.target.value})} /></div>
                  </div>
                  <div className="mt-4 text-end"><button className="btn fw-bold text-white px-5 shadow" style={{backgroundColor: colorBordo}} onClick={guardarDatosEmpresa} disabled={procesando}>{procesando ? 'Guardando...' : 'Guardar Cambios de Empresa'}</button></div>
                </div>
              )}

              {/* USUARIOS CON MATRIZ DE PERMISOS */}
              {tabActiva === 'usuarios' && (
                <div className="card shadow-sm border-0 mb-4 bg-white" style={{ borderRadius: '12px' }}>
                  <div className="card-header bg-white border-bottom py-3"><h5 className="m-0 fw-bold d-flex align-items-center gap-2" style={{ color: colorBordo }}><Shield size={20} /> Control de Accesos y Usuarios</h5></div>
                  <div className="card-body bg-light p-4">
                    <div className="row g-4">
                      
                      {/* FORMULARIO DE ALTA CON SWITCHES */}
                      <div className="col-lg-5">
                        <div className="card border-0 shadow-sm p-4 h-100">
                          <h6 className="fw-bold text-muted mb-3 text-uppercase small">Nuevo Empleado</h6>
                          <form onSubmit={crearUsuario}>
                            <div className="mb-3"><label className="form-label small fw-bold">Nombre a mostrar</label><input type="text" className="form-control fw-bold" placeholder="Ej: Fernando..." value={formUsuario.nombre} onChange={e => setFormUsuario({...formUsuario, nombre: e.target.value})} required /></div>
                            <div className="mb-3"><label className="form-label small fw-bold">Email de Ingreso</label><input type="email" className="form-control font-monospace" placeholder="ejemplo@rsr.com" value={formUsuario.email} onChange={e => setFormUsuario({...formUsuario, email: e.target.value})} required /></div>
                            <div className="row g-2 mb-3">
                              <div className="col-7"><label className="form-label small fw-bold">Contraseña</label><input type="text" className="form-control font-monospace" placeholder="Mínimo 6 let/num" value={formUsuario.password} onChange={e => setFormUsuario({...formUsuario, password: e.target.value})} required /></div>
                              <div className="col-5"><label className="form-label small fw-bold">Rol Principal</label><select className="form-select fw-bold" value={formUsuario.rol} onChange={e => setFormUsuario({...formUsuario, rol: e.target.value})}><option value="mostrador">Mostrador</option><option value="deposito">Depósito</option><option value="oficina">Admin</option></select></div>
                            </div>
                            
                            <div className="bg-light border rounded p-3 mb-4">
                              <h6 className="fw-bold text-dark border-bottom pb-2 mb-3 small">Matriz de Permisos Específicos</h6>
                              <div className="form-check form-switch mb-2"><input className="form-check-input" type="checkbox" checked={!!formUsuario.permisos.facturar_blanco} onChange={e => setFormUsuario({...formUsuario, permisos: {...formUsuario.permisos, facturar_blanco: e.target.checked}})} /><label className="form-check-label small fw-bold">Permitir Facturación (AFIP)</label></div>
                              <div className="form-check form-switch mb-2"><input className="form-check-input" type="checkbox" checked={!!formUsuario.permisos.operar_sombra} onChange={e => setFormUsuario({...formUsuario, permisos: {...formUsuario.permisos, operar_sombra: e.target.checked}})} /><label className="form-check-label small fw-bold text-danger">Órdenes Especiales (Presupuestos)</label></div>
                              <div className="form-check form-switch mb-2"><input className="form-check-input" type="checkbox" checked={!!formUsuario.permisos.anular_comprobantes} onChange={e => setFormUsuario({...formUsuario, permisos: {...formUsuario.permisos, anular_comprobantes: e.target.checked}})} /><label className="form-check-label small fw-bold">Anular / Notas de Crédito</label></div>
                              <div className="form-check form-switch"><input className="form-check-input" type="checkbox" checked={!!formUsuario.permisos.configurar_sistema} onChange={e => setFormUsuario({...formUsuario, permisos: {...formUsuario.permisos, configurar_sistema: e.target.checked}})} /><label className="form-check-label small fw-bold text-primary">Acceso a Configuración y Finanzas</label></div>
                            </div>

                            <button type="submit" className="btn w-100 text-white fw-bold py-2 shadow-sm" style={{ backgroundColor: colorBordo }} disabled={procesando}>{procesando ? 'Procesando...' : <><UserPlus size={18} className="me-2"/> Crear Usuario</>}</button>
                          </form>
                        </div>
                      </div>

                      {/* TABLA CON TILDES DE PERMISOS */}
                      <div className="col-lg-7">
                        <div className="card border-0 shadow-sm h-100">
                          <div className="card-body p-0 overflow-auto" style={{ maxHeight: '600px' }}>
                            <table className="table table-hover mb-0 align-middle">
                              <thead className="table-light sticky-top">
                                <tr>
                                  <th className="ps-3">Usuario</th>
                                  <th className="text-center" title="Facturar (AFIP)">FA</th>
                                  <th className="text-center" title="Órdenes Especiales">OE</th>
                                  <th className="text-center" title="Anular Comprobantes">AN</th>
                                  <th className="text-center" title="Configuración">CF</th>
                                  <th className="text-center pe-3">Acción</th>
                                </tr>
                              </thead>
                              <tbody>
                                {usuarios.length === 0 && <tr><td colSpan="6" className="text-center text-muted py-4">No hay usuarios.</td></tr>}
                                {usuarios.map(u => (
                                  <tr key={u.email}>
                                    <td className="ps-3">
                                      <div className="fw-bold text-dark">{u.nombre}</div>
                                      <div className="font-monospace small text-muted">{u.email}</div>
                                      <span className={`badge mt-1 ${u.rol === 'oficina' ? 'bg-danger' : 'bg-secondary'}`} style={{fontSize:'0.65rem'}}>{u.rol.toUpperCase()}</span>
                                    </td>
                                    <td className="text-center fs-5">{u.permisos?.facturar_blanco ? '✅' : '❌'}</td>
                                    <td className="text-center fs-5">{u.permisos?.operar_sombra ? '✅' : '❌'}</td>
                                    <td className="text-center fs-5">{u.permisos?.anular_comprobantes ? '✅' : '❌'}</td>
                                    <td className="text-center fs-5">{u.permisos?.configurar_sistema ? '✅' : '❌'}</td>
                                    <td className="text-center pe-3"><button onClick={() => eliminarUsuario(u.email)} className="btn btn-sm text-danger border-0 p-1" disabled={procesando} title="Eliminar Acceso"><Trash2 size={18} /></button></td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      </div>

                    </div>
                  </div>
                </div>
              )}

              {/* RESTO DE TABS (Finanzas, Hardware, Logística) INTACTAS... */}
              {tabActiva === 'finanzas' && (
                <div className="card shadow-sm border-0 p-4 bg-white"><h5 className="fw-bold border-bottom pb-2 mb-4">Medios de Pago y Reglas Financieras</h5><div className="row g-2 align-items-end mb-4 bg-light p-3 border rounded shadow-sm"><div className="col-md-4"><label className="form-label small fw-bold text-muted mb-1">Nombre del Medio</label><input type="text" className="form-control form-control-sm fw-bold" placeholder="Ej: Tarjeta Visa 3 cuotas" value={nuevoMedio.nombre} onChange={e => setNuevoMedio({...nuevoMedio, nombre: e.target.value})} /></div><div className="col-md-3"><label className="form-label small fw-bold text-muted mb-1">Tipo de Ajuste</label><select className="form-select form-select-sm fw-bold" value={nuevoMedio.tipo} onChange={e => setNuevoMedio({...nuevoMedio, tipo: e.target.value})}><option value="NORMAL">Normal (Precio Lista)</option><option value="DESCUENTO">Descuento (-)</option><option value="RECARGO">Recargo (+)</option></select></div><div className="col-md-3"><label className="form-label small fw-bold text-muted mb-1">Porcentaje (%)</label><input type="number" step="0.1" className="form-control form-control-sm font-monospace fw-bold" placeholder="0" value={nuevoMedio.porcentaje} onChange={e => setNuevoMedio({...nuevoMedio, porcentaje: e.target.value})} /></div><div className="col-md-2"><button className="btn btn-sm btn-dark w-100 fw-bold" onClick={agregarMedioPago}>+ Agregar</button></div></div><table className="table table-hover align-middle"><thead className="table-light"><tr><th>Descripción</th><th>Comportamiento</th><th className="text-end">Porcentaje (%)</th><th className="text-end">Acciones</th></tr></thead><tbody>{mediosPago.map(m => (<tr key={m.id}><td className="fw-bold">{m.nombre}</td><td><span className={`badge ${m.tipo === 'RECARGO' ? 'bg-danger' : m.tipo === 'DESCUENTO' ? 'bg-success' : 'bg-secondary'}`}>{m.tipo}</span></td><td className={`text-end fw-bold font-monospace ${m.tipo === 'RECARGO' ? 'text-danger' : m.tipo === 'DESCUENTO' ? 'text-success' : ''}`}>{m.porcentaje}%</td><td className="text-end"><button className="btn btn-sm text-danger border-0" onClick={() => borrarMedioPago(m.id)}>✖</button></td></tr>))}</tbody></table></div>
              )}
              {tabActiva === 'hardware' && (
                <div><div className="card shadow-sm border-0 p-4 bg-white mb-4 border-start border-4 border-primary"><div className="d-flex justify-content-between align-items-center"><div><div className="d-flex align-items-center gap-2 mb-1"><h5 className="fw-bold text-dark m-0">Controlador Local RSR</h5><span className="badge bg-success bg-opacity-10 text-success border border-success fw-bold">Recomendado</span></div><p className="text-muted small m-0 mt-1">Instalá el controlador para emitir tickets térmicos instantáneos sin que se abra la ventana de diálogo de Windows.</p></div><a href="https://wmqkspuzebothufolmuo.supabase.co/storage/v1/object/public/instaladores/Instalador_Controlador_Impresion_RSR.exe" download className="btn btn-primary fw-bold shadow-sm px-4 py-2 text-decoration-none">⬇ Descargar Instalador (.exe)</a></div></div><div className="card shadow-sm border-0 p-4 bg-white mb-4"><h5 className="fw-bold border-bottom pb-2 mb-3">Ruteo de Nombres de Impresoras</h5><div className="row g-3"><div className="col-md-4"><label className="form-label small fw-bold text-muted">Impresora Ticket 80mm</label><input type="text" className="form-control" placeholder="Ej: EPSON TM-T20II o POS-80" value={empresa.config_hardware?.ticket || ''} onChange={e => setEmpresa({...empresa, config_hardware: {...empresa.config_hardware, ticket: e.target.value}})} /></div><div className="col-md-4"><label className="form-label small fw-bold text-muted">Impresora Facturas A4</label><input type="text" className="form-control" placeholder="Ej: HP LaserJet P1102" value={empresa.config_hardware?.a4 || ''} onChange={e => setEmpresa({...empresa, config_hardware: {...empresa.config_hardware, a4: e.target.value}})} /></div><div className="col-md-4"><label className="form-label small fw-bold text-muted">Impresora Etiquetas Térmicas</label><input type="text" className="form-control" placeholder="Ej: Zebra GC420t" value={empresa.config_hardware?.etiquetas || ''} onChange={e => setEmpresa({...empresa, config_hardware: {...empresa.config_hardware, etiquetas: e.target.value}})} /></div></div></div><div className="mt-4 text-end"><button className="btn fw-bold text-white px-5 shadow" style={{ backgroundColor: colorBordo }} onClick={guardarDatosEmpresa} disabled={procesando}>{procesando ? 'Guardando...' : 'Guardar Ajustes de Impresión'}</button></div></div>
              )}
              {tabActiva === 'logistica' && (
                <div className="card shadow-sm border-0 p-4 bg-white"><h5 className="fw-bold border-bottom pb-2 mb-3">Distribuidores Mayoristas</h5><div className="row g-2 align-items-end mb-4 bg-light p-3 border rounded"><div className="col-md-4"><label className="form-label small fw-bold text-muted mb-1">Nombre Distribuidor</label><input type="text" className="form-control form-control-sm fw-bold" placeholder="Ej: Warnes Repuestos" value={nuevoProveedor.nombre} onChange={e => setNuevoProveedor({...nuevoProveedor, nombre: e.target.value})} /></div><div className="col-md-6"><label className="form-label small fw-bold text-muted mb-1">URL Catálogo / API de Precios</label><input type="text" className="form-control form-control-sm font-monospace text-primary" placeholder="https://proveedor.com/lista" value={nuevoProveedor.url_catalogo} onChange={e => setNuevoProveedor({...nuevoProveedor, url_catalogo: e.target.value})} /></div><div className="col-md-2"><button className="btn btn-sm btn-dark w-100 fw-bold" onClick={agregarProveedor}>+ Agregar</button></div></div><table className="table table-hover align-middle mb-5"><thead className="table-light"><tr><th>Distribuidor</th><th>URL Catálogo</th><th className="text-end">Acciones</th></tr></thead><tbody>{proveedores.map(p => (<tr key={p.id}><td className="fw-bold">{p.nombre}</td><td className="font-monospace small text-muted">{p.url_catalogo || '-'}</td><td className="text-end"><button className="btn btn-sm text-danger border-0" onClick={() => borrarProveedor(p.id)}>✖</button></td></tr>))}</tbody></table><h5 className="fw-bold border-bottom pb-2 mb-3">Transportes y Comisionistas</h5><div className="row g-2 align-items-end mb-4 bg-light p-3 border rounded"><div className="col-md-5"><label className="form-label small fw-bold text-muted mb-1">Empresa / Nombre Chofer</label><input type="text" className="form-control form-control-sm fw-bold" placeholder="Ej: Vía Cargo" value={nuevoTransporte.nombre} onChange={e => setNuevoTransporte({...nuevoTransporte, nombre: e.target.value})} /></div><div className="col-md-5"><label className="form-label small fw-bold text-muted mb-1">Teléfono / WhatsApp</label><input type="text" className="form-control form-control-sm" placeholder="Ej: 2954-123456" value={nuevoTransporte.telefono} onChange={e => setNuevoTransporte({...nuevoTransporte, telefono: e.target.value})} /></div><div className="col-md-2"><button className="btn btn-sm btn-dark w-100 fw-bold" onClick={agregarTransporte}>+ Agregar</button></div></div><table className="table table-hover align-middle"><thead className="table-light"><tr><th>Transporte</th><th>Contacto</th><th className="text-end">Acciones</th></tr></thead><tbody>{transportes.map(t => (<tr key={t.id}><td className="fw-bold">{t.nombre}</td><td className="font-monospace">{t.telefono || '-'}</td><td className="text-end"><button className="btn btn-sm text-danger border-0" onClick={() => borrarTransporte(t.id)}>✖</button></td></tr>))}</tbody></table></div>
              )}

            </div>
          </div>
        </div>
      </div>
    </div>
  );
}