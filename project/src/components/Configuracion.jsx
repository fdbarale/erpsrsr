import React, { useState, useEffect } from 'react';
import { dbOficial } from '../supabaseClient';

export default function Configuracion({ volverAlMenu }) {
  const [tabActiva, setTabActiva] = useState('empresa');
  const [procesando, setProcesando] = useState(false);

  const colorBordo = '#6B1116';
  const colorGris = '#54565b';

  // === ESTADOS DE DATOS ===
  const [empresa, setEmpresa] = useState({
    razon_social: '',
    nombre_fantasia: '',
    cuit: '',
    condicion_iva: 'Responsable Inscripto',
    iibb: '',
    inicio_actividades: '',
    direccion: '',
    telefono: '',
    email: '',
    logo_url: '',
    leyenda_factura: '',
    leyendas_presupuesto: ['', '', ''],
    config_hardware: { ticket: '', a4: '', etiquetas: '', ancho_etiqueta: 50, alto_etiqueta: 25 }
  });

  const [usuarios, setUsuarios] = useState([]);
  const [mediosPago, setMediosPago] = useState([]);
  const [proveedores, setProveedores] = useState([]);
  const [transportes, setTransportes] = useState([]);

  // === ESTADOS DE FORMULARIOS AUXILIARES ===
  const [modalUsuario, setModalUsuario] = useState(null);
  const [nuevoMedio, setNuevoMedio] = useState({ nombre: '', tipo: 'NORMAL', porcentaje: 0 });
  const [nuevoProveedor, setNuevoProveedor] = useState({ nombre: '', url_catalogo: '' });
  const [nuevoTransporte, setNuevoTransporte] = useState({ nombre: '', telefono: '' });

  // === CARGA INICIAL COMPLETA ===
  const cargarTodo = async () => {
    try {
      const [resEmpresa, resUsuarios, resMedios, resProveedores, resTransportes] = await Promise.all([
        dbOficial.from('config_empresa').select('*').single(),
        dbOficial.from('usuarios').select('*').order('creado_en', { ascending: true }),
        dbOficial.from('config_medios_pago').select('*').order('nombre', { ascending: true }),
        dbOficial.from('proveedores_distribuidores').select('*').order('nombre', { ascending: true }),
        dbOficial.from('transportes').select('*').order('nombre', { ascending: true })
      ]);

      if (resEmpresa.data) {
        const leyendas = Array.isArray(resEmpresa.data.leyendas_presupuesto) 
          ? resEmpresa.data.leyendas_presupuesto 
          : ['', '', ''];
        
        const hw = resEmpresa.data.config_hardware || { ticket: '', a4: '', etiquetas: '', ancho_etiqueta: 50, alto_etiqueta: 25 };

        setEmpresa({
          ...resEmpresa.data,
          leyendas_presupuesto: [leyendas[0] || '', leyendas[1] || '', leyendas[2] || ''],
          config_hardware: hw
        });
      }

      if (resUsuarios.data) setUsuarios(resUsuarios.data);
      if (resMedios.data) setMediosPago(resMedios.data);
      if (resProveedores.data) setProveedores(resProveedores.data);
      if (resTransportes.data) setTransportes(resTransportes.data);

    } catch (err) {
      console.error("Error cargando configuración:", err);
    }
  };

  useEffect(() => {
    cargarTodo();
  }, []);

  // === GUARDAR CONFIGURACIÓN EMPRESA Y HARDWARE ===
  const guardarDatosEmpresa = async () => {
    setProcesando(true);
    try {
      const { error } = await dbOficial.from('config_empresa').update({
        razon_social: empresa.razon_social,
        nombre_fantasia: empresa.nombre_fantasia,
        cuit: empresa.cuit,
        condicion_iva: empresa.condicion_iva,
        iibb: empresa.iibb,
        inicio_actividades: empresa.inicio_actividades || null,
        direccion: empresa.direccion,
        telefono: empresa.telefono,
        email: empresa.email,
        logo_url: empresa.logo_url,
        leyenda_factura: empresa.leyenda_factura,
        leyendas_presupuesto: empresa.leyendas_presupuesto,
        config_hardware: empresa.config_hardware
      }).eq('id', 1);

      if (error) throw error;
      alert("Configuración guardada correctamente.");
    } catch (err) {
      alert("Error al guardar: " + err.message);
    } finally {
      setProcesando(false);
    }
  };

  // === GESTIÓN DE USUARIOS ===
  const guardarUsuario = async (e) => {
    e.preventDefault();
    setProcesando(true);
    try {
      const payload = {
        nombre: modalUsuario.nombre,
        email: modalUsuario.email,
        pin_ingreso: modalUsuario.pin_ingreso,
        permisos: modalUsuario.permisos
      };

      if (modalUsuario.id) {
        const { error } = await dbOficial.from('usuarios').update(payload).eq('id', modalUsuario.id);
        if (error) throw error;
      } else {
        const { error } = await dbOficial.from('usuarios').insert([payload]);
        if (error) throw error;
      }

      setModalUsuario(null);
      cargarTodo();
    } catch (err) {
      alert("Error en usuario: " + err.message);
    } finally {
      setProcesando(false);
    }
  };

  const borrarUsuario = async (id) => {
    if (!window.confirm("¿Seguro que deseás borrar este usuario?")) return;
    try {
      const { error } = await dbOficial.from('usuarios').delete().eq('id', id);
      if (error) throw error;
      cargarTodo();
    } catch (err) {
      alert("Error al borrar: " + err.message);
    }
  };

  // === GESTIÓN DE MEDIOS DE PAGO ===
  const agregarMedioPago = async () => {
    if (!nuevoMedio.nombre.trim()) return alert("Ingresá un nombre para el medio de pago.");
    try {
      const { error } = await dbOficial.from('config_medios_pago').insert([{
        nombre: nuevoMedio.nombre,
        tipo: nuevoMedio.tipo,
        porcentaje: parseFloat(nuevoMedio.porcentaje) || 0
      }]);
      if (error) throw error;
      setNuevoMedio({ nombre: '', tipo: 'NORMAL', porcentaje: 0 });
      cargarTodo();
    } catch (err) {
      alert("Error al agregar medio de pago: " + err.message);
    }
  };

  const borrarMedioPago = async (id) => {
    if (!window.confirm("¿Eliminar este medio de pago?")) return;
    try {
      const { error } = await dbOficial.from('config_medios_pago').delete().eq('id', id);
      if (error) throw error;
      cargarTodo();
    } catch (err) {
      alert("Error al borrar medio: " + err.message);
    }
  };

  // === GESTIÓN DE PROVEEDORES ===
  const agregarProveedor = async () => {
    if (!nuevoProveedor.nombre.trim()) return alert("Ingresá el nombre del distribuidor.");
    try {
      const { error } = await dbOficial.from('proveedores_distribuidores').insert([{
        nombre: nuevoProveedor.nombre,
        url_catalogo: nuevoProveedor.url_catalogo
      }]);
      if (error) throw error;
      setNuevoProveedor({ nombre: '', url_catalogo: '' });
      cargarTodo();
    } catch (err) {
      alert("Error al guardar proveedor: " + err.message);
    }
  };

  const borrarProveedor = async (id) => {
    if (!window.confirm("¿Eliminar este distribuidor?")) return;
    try {
      const { error } = await dbOficial.from('proveedores_distribuidores').delete().eq('id', id);
      if (error) throw error;
      cargarTodo();
    } catch (err) {
      alert("Error al borrar proveedor: " + err.message);
    }
  };

  // === GESTIÓN DE TRANSPORTES ===
  const agregarTransporte = async () => {
    if (!nuevoTransporte.nombre.trim()) return alert("Ingresá el nombre del comisionista o transporte.");
    try {
      const { error } = await dbOficial.from('transportes').insert([{
        nombre: nuevoTransporte.nombre,
        telefono: nuevoTransporte.telefono
      }]);
      if (error) throw error;
      setNuevoTransporte({ nombre: '', telefono: '' });
      cargarTodo();
    } catch (err) {
      alert("Error al guardar transporte: " + err.message);
    }
  };

  const borrarTransporte = async (id) => {
    if (!window.confirm("¿Eliminar este transporte?")) return;
    try {
      const { error } = await dbOficial.from('transportes').delete().eq('id', id);
      if (error) throw error;
      cargarTodo();
    } catch (err) {
      alert("Error al borrar transporte: " + err.message);
    }
  };

  return (
    <div className="bg-light min-vh-100 d-flex flex-column" style={{ overflowX: 'hidden' }}>
      
      {/* NAV SUPERIOR */}
      <nav className="navbar navbar-dark shadow-sm px-3" style={{ backgroundColor: colorBordo, borderBottom: `4px solid ${colorGris}` }}>
        <div className="container-fluid p-0">
          <div className="d-flex align-items-center">
            <button className="btn btn-sm btn-outline-light me-3 fw-bold" onClick={volverAlMenu}>
              ⬅ Volver al Menú
            </button>
            <span className="navbar-brand fw-bold m-0 tracking-wide">Configuración del Sistema ERP</span>
          </div>
        </div>
      </nav>

      <div className="container-fluid mt-4 flex-grow-1 px-4 mb-5 pb-5">
        <div className="row h-100">
          
          {/* PANEL LATERAL */}
          <div className="col-md-3 border-end pe-4">
            <div className="nav flex-column nav-pills gap-2" role="tablist">
              <button 
                className={`nav-link fw-bold text-start p-3 shadow-sm border ${tabActiva === 'empresa' ? 'active' : 'bg-white text-secondary'}`} 
                onClick={() => setTabActiva('empresa')} 
                style={tabActiva === 'empresa' ? { backgroundColor: colorBordo, color: 'white' } : {}}
              >
                🏢 Datos Empresa y Fiscales
              </button>
              <button 
                className={`nav-link fw-bold text-start p-3 shadow-sm border ${tabActiva === 'usuarios' ? 'active' : 'bg-white text-secondary'}`} 
                onClick={() => setTabActiva('usuarios')} 
                style={tabActiva === 'usuarios' ? { backgroundColor: colorBordo, color: 'white' } : {}}
              >
                👥 Usuarios y Accesos
              </button>
              <button 
                className={`nav-link fw-bold text-start p-3 shadow-sm border ${tabActiva === 'finanzas' ? 'active' : 'bg-white text-secondary'}`} 
                onClick={() => setTabActiva('finanzas')} 
                style={tabActiva === 'finanzas' ? { backgroundColor: colorBordo, color: 'white' } : {}}
              >
                💳 Medios de Pago y Recargos
              </button>
              <button 
                className={`nav-link fw-bold text-start p-3 shadow-sm border ${tabActiva === 'hardware' ? 'active' : 'bg-white text-secondary'}`} 
                onClick={() => setTabActiva('hardware')} 
                style={tabActiva === 'hardware' ? { backgroundColor: colorBordo, color: 'white' } : {}}
              >
                🖨️ Impresoras y Etiquetas
              </button>
              <button 
                className={`nav-link fw-bold text-start p-3 shadow-sm border ${tabActiva === 'logistica' ? 'active' : 'bg-white text-secondary'}`} 
                onClick={() => setTabActiva('logistica')} 
                style={tabActiva === 'logistica' ? { backgroundColor: colorBordo, color: 'white' } : {}}
              >
                🚚 Distribuidores y Logística
              </button>
            </div>
          </div>

          {/* PANEL CENTRAL */}
          <div className="col-md-9 ps-4">
            <div className="tab-content h-100 pb-5">

              {/* === PESTAÑA 1: EMPRESA Y FACTURACIÓN === */}
              {tabActiva === 'empresa' && (
                <div className="card shadow-sm border-0 p-4 bg-white">
                  <h5 className="fw-bold border-bottom pb-2 mb-4">Información Fiscal y Comercial</h5>
                  <div className="row g-3 mb-4">
                    <div className="col-md-6">
                      <label className="form-label small fw-bold text-muted">Razón Social</label>
                      <input type="text" className="form-control fw-bold" value={empresa.razon_social || ''} onChange={e => setEmpresa({...empresa, razon_social: e.target.value})} />
                    </div>
                    <div className="col-md-6">
                      <label className="form-label small fw-bold text-muted">Nombre de Fantasía</label>
                      <input type="text" className="form-control fw-bold" value={empresa.nombre_fantasia || ''} onChange={e => setEmpresa({...empresa, nombre_fantasia: e.target.value})} />
                    </div>
                    <div className="col-md-3">
                      <label className="form-label small fw-bold text-muted">CUIT</label>
                      <input type="text" className="form-control font-monospace" value={empresa.cuit || ''} onChange={e => setEmpresa({...empresa, cuit: e.target.value})} />
                    </div>
                    <div className="col-md-3">
                      <label className="form-label small fw-bold text-muted">Condición IVA</label>
                      <select className="form-select" value={empresa.condicion_iva || 'Responsable Inscripto'} onChange={e => setEmpresa({...empresa, condicion_iva: e.target.value})}>
                        <option>Responsable Inscripto</option>
                        <option>Monotributo</option>
                        <option>Exento</option>
                      </select>
                    </div>
                    <div className="col-md-3">
                      <label className="form-label small fw-bold text-muted">Ingresos Brutos (IIBB)</label>
                      <input type="text" className="form-control font-monospace" value={empresa.iibb || ''} onChange={e => setEmpresa({...empresa, iibb: e.target.value})} />
                    </div>
                    <div className="col-md-3">
                      <label className="form-label small fw-bold text-muted">Inicio de Actividades</label>
                      <input type="date" className="form-control" value={empresa.inicio_actividades || ''} onChange={e => setEmpresa({...empresa, inicio_actividades: e.target.value})} />
                    </div>
                    <div className="col-md-6">
                      <label className="form-label small fw-bold text-muted">Dirección Comercial</label>
                      <input type="text" className="form-control" value={empresa.direccion || ''} onChange={e => setEmpresa({...empresa, direccion: e.target.value})} />
                    </div>
                    <div className="col-md-3">
                      <label className="form-label small fw-bold text-muted">Teléfono</label>
                      <input type="text" className="form-control" value={empresa.telefono || ''} onChange={e => setEmpresa({...empresa, telefono: e.target.value})} />
                    </div>
                    <div className="col-md-3">
                      <label className="form-label small fw-bold text-muted">Email Comercial</label>
                      <input type="email" className="form-control" value={empresa.email || ''} onChange={e => setEmpresa({...empresa, email: e.target.value})} />
                    </div>
                    <div className="col-md-12">
                      <label className="form-label small fw-bold text-muted">URL del Logo (Para comprobantes y presupuestos)</label>
                      <input type="text" className="form-control font-monospace" placeholder="https://..." value={empresa.logo_url || ''} onChange={e => setEmpresa({...empresa, logo_url: e.target.value})} />
                    </div>
                  </div>

                  <h5 className="fw-bold border-bottom pb-2 mb-3 mt-4">Plantillas de Leyendas</h5>
                  <div className="row g-3">
                    <div className="col-md-12">
                      <label className="form-label small fw-bold text-muted">Leyenda para Pie de Factura AFIP</label>
                      <input type="text" className="form-control" placeholder="Ej: Régimen de emisión de comprobantes..." value={empresa.leyenda_factura || ''} onChange={e => setEmpresa({...empresa, leyenda_factura: e.target.value})} />
                    </div>
                    <div className="col-md-12">
                      <label className="form-label small fw-bold text-muted mb-2">3 Leyendas Configurables para Presupuestos</label>
                      <input 
                        type="text" 
                        className="form-control mb-2" 
                        placeholder="Leyenda 1 (Ej: Validez del presupuesto: 7 días)" 
                        value={empresa.leyendas_presupuesto[0] || ''} 
                        onChange={e => {
                          const arr = [...empresa.leyendas_presupuesto];
                          arr[0] = e.target.value;
                          setEmpresa({...empresa, leyendas_presupuesto: arr});
                        }} 
                      />
                      <input 
                        type="text" 
                        className="form-control mb-2" 
                        placeholder="Leyenda 2 (Ej: Precios sujetos a variación sin previo aviso)" 
                        value={empresa.leyendas_presupuesto[1] || ''} 
                        onChange={e => {
                          const arr = [...empresa.leyendas_presupuesto];
                          arr[1] = e.target.value;
                          setEmpresa({...empresa, leyendas_presupuesto: arr});
                        }} 
                      />
                      <input 
                        type="text" 
                        className="form-control" 
                        placeholder="Leyenda 3 (Ej: Repuestos eléctricos no tienen cambio ni devolución)" 
                        value={empresa.leyendas_presupuesto[2] || ''} 
                        onChange={e => {
                          const arr = [...empresa.leyendas_presupuesto];
                          arr[2] = e.target.value;
                          setEmpresa({...empresa, leyendas_presupuesto: arr});
                        }} 
                      />
                    </div>
                  </div>

                  <div className="mt-4 text-end">
                    <button className="btn fw-bold text-white px-5" style={{backgroundColor: colorBordo}} onClick={guardarDatosEmpresa} disabled={procesando}>
                      {procesando ? 'Guardando...' : 'Guardar Cambios de Empresa'}
                    </button>
                  </div>
                </div>
              )}

              {/* === PESTAÑA 2: USUARIOS Y PERMISOS === */}
              {tabActiva === 'usuarios' && (
                <div className="card shadow-sm border-0 p-4 bg-white">
                  <div className="d-flex justify-content-between align-items-center mb-4 border-bottom pb-2">
                    <h5 className="fw-bold m-0">Matriz de Acceso y Permisos</h5>
                    <button 
                      className="btn btn-dark fw-bold btn-sm" 
                      onClick={() => setModalUsuario({ 
                        nombre: '', 
                        email: '', 
                        pin_ingreso: '', 
                        permisos: { facturar_blanco: true, operar_sombra: false, anular_comprobantes: false, configurar_sistema: false } 
                      })}
                    >
                      + Nuevo Usuario
                    </button>
                  </div>
                  <div className="table-responsive">
                    <table className="table table-hover align-middle">
                      <thead className="table-light">
                        <tr>
                          <th>Nombre</th>
                          <th>PIN Mostrador</th>
                          <th className="text-center">Facturación (AFIP)</th>
                          <th className="text-center">Órdenes Especiales</th>
                          <th className="text-center">Anulaciones</th>
                          <th className="text-center">Configuración</th>
                          <th className="text-end">Acciones</th>
                        </tr>
                      </thead>
                      <tbody>
                        {usuarios.map(u => (
                          <tr key={u.id}>
                            <td className="fw-bold">{u.nombre}</td>
                            <td className="font-monospace text-muted">{u.pin_ingreso}</td>
                            <td className="text-center">{u.permisos?.facturar_blanco ? '✅' : '❌'}</td>
                            <td className="text-center">{u.permisos?.operar_sombra ? '✅' : '❌'}</td>
                            <td className="text-center">{u.permisos?.anular_comprobantes ? '✅' : '❌'}</td>
                            <td className="text-center">{u.permisos?.configurar_sistema ? '✅' : '❌'}</td>
                            <td className="text-end">
                              <button className="btn btn-sm btn-outline-primary border-0 me-2" onClick={() => setModalUsuario(u)}>Editar</button>
                              <button className="btn btn-sm btn-outline-danger border-0" onClick={() => borrarUsuario(u.id)}>Borrar</button>
                            </td>
                          </tr>
                        ))}
                        {usuarios.length === 0 && (
                          <tr><td colSpan="7" className="text-center text-muted py-3">No hay usuarios dados de alta.</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* === PESTAÑA 3: MEDIOS DE PAGO === */}
              {tabActiva === 'finanzas' && (
                <div className="card shadow-sm border-0 p-4 bg-white">
                  <h5 className="fw-bold border-bottom pb-2 mb-4">Medios de Pago y Reglas Financieras</h5>
                  
                  <div className="row g-2 align-items-end mb-4 bg-light p-3 border rounded shadow-sm">
                    <div className="col-md-4">
                      <label className="form-label small fw-bold text-muted mb-1">Nombre del Medio</label>
                      <input type="text" className="form-control form-control-sm fw-bold" placeholder="Ej: Tarjeta Visa 3 cuotas" value={nuevoMedio.nombre} onChange={e => setNuevoMedio({...nuevoMedio, nombre: e.target.value})} />
                    </div>
                    <div className="col-md-3">
                      <label className="form-label small fw-bold text-muted mb-1">Tipo de Ajuste</label>
                      <select className="form-select form-select-sm fw-bold" value={nuevoMedio.tipo} onChange={e => setNuevoMedio({...nuevoMedio, tipo: e.target.value})}>
                        <option value="NORMAL">Normal (Precio Lista)</option>
                        <option value="DESCUENTO">Descuento (-)</option>
                        <option value="RECARGO">Recargo (+)</option>
                      </select>
                    </div>
                    <div className="col-md-3">
                      <label className="form-label small fw-bold text-muted mb-1">Porcentaje (%)</label>
                      <input type="number" step="0.1" className="form-control form-control-sm font-monospace fw-bold" placeholder="0" value={nuevoMedio.porcentaje} onChange={e => setNuevoMedio({...nuevoMedio, porcentaje: e.target.value})} />
                    </div>
                    <div className="col-md-2">
                      <button className="btn btn-sm btn-dark w-100 fw-bold" onClick={agregarMedioPago}>+ Agregar</button>
                    </div>
                  </div>

                  <table className="table table-hover align-middle">
                    <thead className="table-light">
                      <tr>
                        <th>Descripción</th>
                        <th>Comportamiento</th>
                        <th className="text-end">Porcentaje (%)</th>
                        <th className="text-end">Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {mediosPago.map(m => (
                        <tr key={m.id}>
                          <td className="fw-bold">{m.nombre}</td>
                          <td><span className={`badge ${m.tipo === 'RECARGO' ? 'bg-danger' : m.tipo === 'DESCUENTO' ? 'bg-success' : 'bg-secondary'}`}>{m.tipo}</span></td>
                          <td className={`text-end fw-bold font-monospace ${m.tipo === 'RECARGO' ? 'text-danger' : m.tipo === 'DESCUENTO' ? 'text-success' : ''}`}>
                            {m.porcentaje}%
                          </td>
                          <td className="text-end">
                            <button className="btn btn-sm text-danger border-0" onClick={() => borrarMedioPago(m.id)}>✖</button>
                          </td>
                        </tr>
                      ))}
                      {mediosPago.length === 0 && (
                        <tr><td colSpan="4" className="text-center text-muted py-3">No hay medios de pago cargados.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}

              {/* === PESTAÑA 4: HARDWARE E IMPRESORAS === */}
              {tabActiva === 'hardware' && (
                <div>
                  <div className="card shadow-sm border-0 p-4 bg-white mb-4 border-start border-4 border-primary">
                    <div className="d-flex justify-content-between align-items-center">
                      <div>
                        <h5 className="fw-bold text-dark m-0">Controlador Local de Impresión Directa</h5>
                        <p className="text-muted small m-0 mt-1">Descargá el ejecutable nativo para habilitar la impresión térmica por USB/Red sin cuadros de diálogo de Chrome.</p>
                      </div>
                      <button className="btn btn-primary fw-bold shadow-sm px-4 py-2" onClick={() => alert('Generaremos el script Python en el próximo paso.')}>
                        ⬇ Descargar Controlador (.exe)
                      </button>
                    </div>
                  </div>

                  <div className="card shadow-sm border-0 p-4 bg-white mb-4">
                    <h5 className="fw-bold border-bottom pb-2 mb-3">Ruteo de Nombres de Impresoras (Windows/Linux)</h5>
                    <div className="row g-3">
                      <div className="col-md-4">
                        <label className="form-label small fw-bold text-muted">Impresora Ticket 80mm</label>
                        <input 
                          type="text" 
                          className="form-control" 
                          placeholder="Ej: EPSON TM-T20II" 
                          value={empresa.config_hardware?.ticket || ''} 
                          onChange={e => setEmpresa({...empresa, config_hardware: {...empresa.config_hardware, ticket: e.target.value}})} 
                        />
                      </div>
                      <div className="col-md-4">
                        <label className="form-label small fw-bold text-muted">Impresora Facturas A4</label>
                        <input 
                          type="text" 
                          className="form-control" 
                          placeholder="Ej: HP LaserJet P1102" 
                          value={empresa.config_hardware?.a4 || ''} 
                          onChange={e => setEmpresa({...empresa, config_hardware: {...empresa.config_hardware, a4: e.target.value}})} 
                        />
                      </div>
                      <div className="col-md-4">
                        <label className="form-label small fw-bold text-muted">Impresora Etiquetas Térmicas</label>
                        <input 
                          type="text" 
                          className="form-control" 
                          placeholder="Ej: Zebra GC420t" 
                          value={empresa.config_hardware?.etiquetas || ''} 
                          onChange={e => setEmpresa({...empresa, config_hardware: {...empresa.config_hardware, etiquetas: e.target.value}})} 
                        />
                      </div>
                    </div>
                  </div>

                  <div className="card shadow-sm border-0 p-4 bg-white">
                    <h5 className="fw-bold border-bottom pb-2 mb-3">Parámetros de Etiquetas Térmicas</h5>
                    <div className="row g-3 align-items-center">
                      <div className="col-md-3">
                        <label className="form-label small fw-bold text-muted">Ancho del Rollo (mm)</label>
                        <input 
                          type="number" 
                          className="form-control fw-bold" 
                          value={empresa.config_hardware?.ancho_etiqueta || 50} 
                          onChange={e => setEmpresa({...empresa, config_hardware: {...empresa.config_hardware, ancho_etiqueta: Number(e.target.value)}})} 
                        />
                      </div>
                      <div className="col-md-3">
                        <label className="form-label small fw-bold text-muted">Alto del Rollo (mm)</label>
                        <input 
                          type="number" 
                          className="form-control fw-bold" 
                          value={empresa.config_hardware?.alto_etiqueta || 25} 
                          onChange={e => setEmpresa({...empresa, config_hardware: {...empresa.config_hardware, alto_etiqueta: Number(e.target.value)}})} 
                        />
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 text-end">
                    <button className="btn fw-bold text-white px-5" style={{backgroundColor: colorBordo}} onClick={guardarDatosEmpresa} disabled={procesando}>
                      {procesando ? 'Guardando...' : 'Guardar Ajustes de Impresión'}
                    </button>
                  </div>
                </div>
              )}

              {/* === PESTAÑA 5: DISTRIBUIDORES Y LOGÍSTICA === */}
              {tabActiva === 'logistica' && (
                <div className="card shadow-sm border-0 p-4 bg-white">
                  <h5 className="fw-bold border-bottom pb-2 mb-3">Distribuidores Mayoristas (Scraping de Precios)</h5>
                  <div className="row g-2 align-items-end mb-4 bg-light p-3 border rounded">
                    <div className="col-md-4">
                      <label className="form-label small fw-bold text-muted mb-1">Nombre Distribuidor</label>
                      <input type="text" className="form-control form-control-sm fw-bold" placeholder="Ej: Warnes Repuestos" value={nuevoProveedor.nombre} onChange={e => setNuevoProveedor({...nuevoProveedor, nombre: e.target.value})} />
                    </div>
                    <div className="col-md-6">
                      <label className="form-label small fw-bold text-muted mb-1">URL Catálogo / API de Precios</label>
                      <input type="text" className="form-control form-control-sm font-monospace text-primary" placeholder="https://proveedor.com/lista" value={nuevoProveedor.url_catalogo} onChange={e => setNuevoProveedor({...nuevoProveedor, url_catalogo: e.target.value})} />
                    </div>
                    <div className="col-md-2">
                      <button className="btn btn-sm btn-dark w-100 fw-bold" onClick={agregarProveedor}>+ Agregar</button>
                    </div>
                  </div>

                  <table className="table table-hover align-middle mb-5">
                    <thead className="table-light">
                      <tr>
                        <th>Distribuidor</th>
                        <th>URL Catálogo</th>
                        <th className="text-end">Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {proveedores.map(p => (
                        <tr key={p.id}>
                          <td className="fw-bold">{p.nombre}</td>
                          <td className="font-monospace small text-muted">{p.url_catalogo || '-'}</td>
                          <td className="text-end">
                            <button className="btn btn-sm text-danger border-0" onClick={() => borrarProveedor(p.id)}>✖</button>
                          </td>
                        </tr>
                      ))}
                      {proveedores.length === 0 && (
                        <tr><td colSpan="3" className="text-center text-muted py-2">No hay distribuidores registrados.</td></tr>
                      )}
                    </tbody>
                  </table>

                  <h5 className="fw-bold border-bottom pb-2 mb-3">Transportes y Comisionistas</h5>
                  <div className="row g-2 align-items-end mb-4 bg-light p-3 border rounded">
                    <div className="col-md-5">
                      <label className="form-label small fw-bold text-muted mb-1">Empresa / Nombre Chofer</label>
                      <input type="text" className="form-control form-control-sm fw-bold" placeholder="Ej: Vía Cargo / Comisionista Toay" value={nuevoTransporte.nombre} onChange={e => setNuevoTransporte({...nuevoTransporte, nombre: e.target.value})} />
                    </div>
                    <div className="col-md-5">
                      <label className="form-label small fw-bold text-muted mb-1">Teléfono / WhatsApp</label>
                      <input type="text" className="form-control form-control-sm" placeholder="Ej: 2954-123456" value={nuevoTransporte.telefono} onChange={e => setNuevoTransporte({...nuevoTransporte, telefono: e.target.value})} />
                    </div>
                    <div className="col-md-2">
                      <button className="btn btn-sm btn-dark w-100 fw-bold" onClick={agregarTransporte}>+ Agregar</button>
                    </div>
                  </div>

                  <table className="table table-hover align-middle">
                    <thead className="table-light">
                      <tr>
                        <th>Transporte</th>
                        <th>Contacto</th>
                        <th className="text-end">Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {transportes.map(t => (
                        <tr key={t.id}>
                          <td className="fw-bold">{t.nombre}</td>
                          <td className="font-monospace">{t.telefono || '-'}</td>
                          <td className="text-end">
                            <button className="btn btn-sm text-danger border-0" onClick={() => borrarTransporte(t.id)}>✖</button>
                          </td>
                        </tr>
                      ))}
                      {transportes.length === 0 && (
                        <tr><td colSpan="3" className="text-center text-muted py-2">No hay transportes cargados.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}

            </div>
          </div>
        </div>
      </div>

      {/* MODAL USUARIOS */}
      {modalUsuario && (
        <div className="position-fixed top-0 start-0 w-100 h-100 bg-dark bg-opacity-75 d-flex justify-content-center align-items-center" style={{ zIndex: 2000 }}>
          <div className="card shadow-lg border-0" style={{ width: '500px', borderRadius: '12px' }}>
            <div className="card-header bg-dark text-white d-flex justify-content-between align-items-center">
              <h5 className="modal-title fw-bold m-0">{modalUsuario.id ? 'Editar Usuario' : 'Nuevo Usuario'}</h5>
              <button className="btn-close btn-close-white" onClick={() => setModalUsuario(null)}></button>
            </div>
            <form onSubmit={guardarUsuario}>
              <div className="card-body p-4 bg-light">
                <div className="mb-3">
                  <label className="form-label fw-bold small text-muted">Nombre</label>
                  <input type="text" className="form-control fw-bold" required value={modalUsuario.nombre || ''} onChange={e => setModalUsuario({...modalUsuario, nombre: e.target.value})} />
                </div>
                <div className="row mb-4">
                  <div className="col-md-8">
                    <label className="form-label fw-bold small text-muted">Email</label>
                    <input type="email" className="form-control" required value={modalUsuario.email || ''} onChange={e => setModalUsuario({...modalUsuario, email: e.target.value})} />
                  </div>
                  <div className="col-md-4">
                    <label className="form-label small fw-bold text-muted">PIN Mostrador</label>
                    <input type="text" className="form-control font-monospace fw-bold text-center" maxLength="4" required value={modalUsuario.pin_ingreso || ''} onChange={e => setModalUsuario({...modalUsuario, pin_ingreso: e.target.value})} />
                  </div>
                </div>
                
                <h6 className="fw-bold text-dark border-bottom pb-2 mb-3">Matriz de Permisos</h6>
                <div className="form-check form-switch mb-2">
                  <input className="form-check-input" type="checkbox" checked={!!modalUsuario.permisos?.facturar_blanco} onChange={e => setModalUsuario({...modalUsuario, permisos: {...modalUsuario.permisos, facturar_blanco: e.target.checked}})} />
                  <label className="form-check-label small fw-bold">Permitir Facturación Fiscal (AFIP)</label>
                </div>
                <div className="form-check form-switch mb-2">
                  <input className="form-check-input" type="checkbox" checked={!!modalUsuario.permisos?.operar_sombra} onChange={e => setModalUsuario({...modalUsuario, permisos: {...modalUsuario.permisos, operar_sombra: e.target.checked}})} />
                  <label className="form-check-label small fw-bold text-dark">Órdenes Especiales</label>
                </div>
                <div className="form-check form-switch mb-2">
                  <input className="form-check-input" type="checkbox" checked={!!modalUsuario.permisos?.anular_comprobantes} onChange={e => setModalUsuario({...modalUsuario, permisos: {...modalUsuario.permisos, anular_comprobantes: e.target.checked}})} />
                  <label className="form-check-label small fw-bold">Anulación de Comprobantes (Notas de Crédito)</label>
                </div>
                <div className="form-check form-switch mb-2">
                  <input className="form-check-input" type="checkbox" checked={!!modalUsuario.permisos?.configurar_sistema} onChange={e => setModalUsuario({...modalUsuario, permisos: {...modalUsuario.permisos, configurar_sistema: e.target.checked}})} />
                  <label className="form-check-label small fw-bold text-primary">Acceso a Configuración General y Finanzas</label>
                </div>

              </div>
              <div className="card-footer bg-white d-flex justify-content-end gap-2 p-3">
                <button type="button" className="btn btn-outline-secondary fw-bold" onClick={() => setModalUsuario(null)}>Cancelar</button>
                <button type="submit" className="btn btn-dark fw-bold px-4" disabled={procesando}>
                  {procesando ? 'Guardando...' : 'Guardar Usuario'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}