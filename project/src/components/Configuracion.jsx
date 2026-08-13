import React, { useState, useEffect } from 'react';
import { dbOficial } from '../supabaseClient';

export default function Configuracion({ volverAlMenu }) {
  const [tabActiva, setTabActiva] = useState('MARGENES');
  const [proveedores, setProveedores] = useState([]);
  const [procesando, setProcesando] = useState(false);

  const colorBordo = '#6B1116';
  const colorGris = '#54565b';

  // === CARGAR DATOS REALES DE PROVEEDORES ===
  const cargarProveedores = async () => {
    const { data, error } = await dbOficial
      .from('proveedores')
      .select('id_proveedor, nombre, descuento_comercial, margen_ganancia, metodo_actualizacion')
      .order('nombre');

    if (!error && data) {
      setProveedores(data);
    } else {
      console.error("Error al cargar proveedores:", error);
    }
  };

  useEffect(() => {
    cargarProveedores();
  }, []);

  // === GUARDAR CAMBIOS EN MÁRGENES ===
  const manejarCambioParametro = (id, campo, valor) => {
    setProveedores(prev => prev.map(p => 
      p.id_proveedor === id ? { ...p, [campo]: parseFloat(valor) || 0 } : p
    ));
  };

  const guardarParametrosProveedor = async (prov) => {
    setProcesando(true);
    const { error } = await dbOficial
      .from('proveedores')
      .update({ 
        descuento_comercial: prov.descuento_comercial, 
        margen_ganancia: prov.margen_ganancia 
      })
      .eq('id_proveedor', prov.id_proveedor);

    setProcesando(false);
    if (!error) {
      alert(`Parámetros de ${prov.nombre} actualizados correctamente.`);
    } else {
      alert("Error al guardar en Supabase.");
      console.error(error);
    }
  };

  return (
    <div className="bg-light min-vh-100 d-flex flex-column" style={{ overflowX: 'hidden' }}>
      <nav className="navbar navbar-dark shadow-sm px-3" style={{ backgroundColor: '#343a40', borderBottom: `4px solid ${colorBordo}` }}>
        <div className="container-fluid p-0">
          <div className="d-flex align-items-center">
            <button className="btn btn-sm btn-outline-light me-3 fw-bold" onClick={volverAlMenu}>
              ⬅ Volver al Menú
            </button>
            <span className="navbar-brand fw-bold m-0 tracking-wide">Configuración del Sistema</span>
          </div>
          <div className="d-flex text-white align-items-center">
            <span className="badge bg-success me-3">🟢 Sistema Online (Supabase Dual)</span>
            <span className="me-3 fs-6">👤 Admin: Fer / Guille</span>
          </div>
        </div>
      </nav>

      <div className="container-fluid mt-4 flex-grow-1 px-4">
        <div className="row h-100">
          
          {/* PANEL LATERAL */}
          <div className="col-md-3">
            <div className="nav flex-column nav-pills" role="tablist">
              <button 
                className={`nav-link d-flex justify-content-between align-items-center shadow-sm mb-2 fw-bold ${tabActiva === 'MARGENES' ? 'active' : 'bg-white text-secondary border'}`}
                onClick={() => setTabActiva('MARGENES')}
                style={tabActiva === 'MARGENES' ? { backgroundColor: colorBordo } : {}}
              >
                <span>📊 Precios y Márgenes</span>
              </button>
              <button 
                className={`nav-link d-flex justify-content-between align-items-center shadow-sm mb-2 fw-bold ${tabActiva === 'DISTRIBUIDORES' ? 'active' : 'bg-white text-secondary border'}`}
                onClick={() => setTabActiva('DISTRIBUIDORES')}
                style={tabActiva === 'DISTRIBUIDORES' ? { backgroundColor: colorBordo } : {}}
              >
                <span>🚚 Distribuidores</span>
              </button>
              <button 
                className={`nav-link d-flex justify-content-between align-items-center shadow-sm mb-2 fw-bold ${tabActiva === 'USUARIOS' ? 'active' : 'bg-white text-secondary border'}`}
                onClick={() => setTabActiva('USUARIOS')}
                style={tabActiva === 'USUARIOS' ? { backgroundColor: colorBordo } : {}}
              >
                <span>👥 Usuarios y Accesos</span>
              </button>
              <button 
                className={`nav-link d-flex justify-content-between align-items-center shadow-sm mb-2 fw-bold ${tabActiva === 'WHATSAPP' ? 'active' : 'bg-white text-secondary border'}`}
                onClick={() => setTabActiva('WHATSAPP')}
                style={tabActiva === 'WHATSAPP' ? { backgroundColor: colorBordo } : {}}
              >
                <span>💬 Configurar WhatsApp</span>
              </button>
              <button 
                className={`nav-link d-flex justify-content-between align-items-center shadow-sm mb-2 fw-bold ${tabActiva === 'SISTEMA' ? 'active' : 'bg-white text-secondary border'}`}
                onClick={() => setTabActiva('SISTEMA')}
                style={tabActiva === 'SISTEMA' ? { backgroundColor: colorBordo } : {}}
              >
                <span>💾 Backups y Sistema</span>
              </button>
            </div>
          </div>

          {/* PANEL CENTRAL */}
          <div className="col-md-9">
            <div className="tab-content h-100">
              
              {/* 1. MÁRGENES Y LISTAS */}
              {tabActiva === 'MARGENES' && (
                <div>
                  <div className="card border-0 shadow-sm mb-4">
                    <div className="card-header bg-white pt-4 pb-2 border-bottom-0">
                      <h4 className="fw-bold text-dark mb-0">Reglas de Fijación de Precios</h4>
                      <p className="text-muted small">El sistema calcula los precios de venta en base a estos porcentajes de rentabilidad y descuento comercial al actualizar catálogos.</p>
                    </div>
                    <div className="card-body p-0">
                      <table className="table table-hover mb-0 align-middle">
                        <thead style={{ backgroundColor: colorGris, color: 'white' }}>
                          <tr>
                            <th width="30%" className="ps-4">Distribuidor</th>
                            <th width="25%" className="text-center">Descuento Prov. (%)</th>
                            <th width="25%" className="text-center">Margen Venta (%)</th>
                            <th width="20%" className="text-center pe-4">Acción</th>
                          </tr>
                        </thead>
                        <tbody>
                          {proveedores.map(prov => (
                            <tr key={prov.id_proveedor} className="border-bottom">
                              <td className="ps-4 fw-bold text-dark">{prov.nombre}</td>
                              <td className="text-center">
                                <div className="input-group input-group-sm w-75 mx-auto shadow-sm">
                                  <span className="input-group-text bg-danger text-white border-danger">-</span>
                                  <input 
                                    type="number" 
                                    className="form-control text-center fw-bold" 
                                    value={prov.descuento_comercial || 0}
                                    onChange={(e) => manejarCambioParametro(prov.id_proveedor, 'descuento_comercial', e.target.value)}
                                  />
                                  <span className="input-group-text">%</span>
                                </div>
                              </td>
                              <td className="text-center">
                                <div className="input-group input-group-sm w-75 mx-auto shadow-sm">
                                  <span className="input-group-text bg-success text-white border-success">+</span>
                                  <input 
                                    type="number" 
                                    className="form-control text-center fw-bold" 
                                    value={prov.margen_ganancia || 0}
                                    onChange={(e) => manejarCambioParametro(prov.id_proveedor, 'margen_ganancia', e.target.value)}
                                  />
                                  <span className="input-group-text">%</span>
                                </div>
                              </td>
                              <td className="text-center pe-4">
                                <button 
                                  className="btn btn-sm btn-dark fw-bold px-3 shadow-sm"
                                  onClick={() => guardarParametrosProveedor(prov)}
                                  disabled={procesando}
                                >
                                  💾 Guardar
                                </button>
                              </td>
                            </tr>
                          ))}
                          {proveedores.length === 0 && (
                            <tr><td colSpan="4" className="text-center py-4 text-muted">No hay proveedores cargados en Supabase.</td></tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                  
                  <div className="alert alert-info shadow-sm border-info bg-white">
                    <h6 className="fw-bold text-primary">💡 Actualización Masiva de Precios</h6>
                    <p className="small text-muted mb-3">Las listas se importan desde el módulo "Gestión de Stock" &gt; "Carga Masiva (CSV)". El sistema leerá el Costo de esa lista y le aplicará automáticamente los márgenes configurados arriba para calcular el Precio Público final.</p>
                  </div>
                </div>
              )}

              {/* 2. DISTRIBUIDORES */}
              {tabActiva === 'DISTRIBUIDORES' && (
                <div>
                  <div className="d-flex justify-content-between align-items-center mb-4">
                    <h4 className="fw-bold text-dark mb-0">Directorio de Distribuidores</h4>
                    <button className="btn fw-bold text-white shadow-sm" style={{ backgroundColor: colorBordo }} onClick={() => alert('Para agregar proveedores, crear el registro directo en la tabla proveedores de Supabase Oficial.')}>
                      + Nuevo Proveedor
                    </button>
                  </div>
                  <div className="row g-3">
                    {proveedores.map(prov => (
                      <div className="col-md-6" key={prov.id_proveedor}>
                        <div className="card p-3 h-100 border-0 shadow-sm bg-white" style={{ borderLeft: '5px solid #198754' }}>
                          <div className="d-flex justify-content-between align-items-start">
                            <h5 className="fw-bold text-dark mb-1">{prov.nombre}</h5>
                            <span className="badge bg-success">Activo</span>
                          </div>
                          <p className="text-muted small mb-3">
                            <strong>Actualización de listas:</strong> {prov.metodo_actualizacion || 'No definido'}
                          </p>
                          <div className="mt-auto">
                            <button className="btn btn-sm btn-outline-secondary fw-bold">Configurar Envío</button>
                            <button className="btn btn-sm btn-outline-danger fw-bold ms-2">Pausar</button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 3. USUARIOS Y PERMISOS */}
              {tabActiva === 'USUARIOS' && (
                <div>
                  <div className="d-flex justify-content-between align-items-center mb-4">
                    <h4 className="fw-bold text-dark mb-0">Gestión de Personal y Tareas</h4>
                    <button className="btn fw-bold text-white shadow-sm" style={{ backgroundColor: colorBordo }} onClick={() => alert('Las altas de usuarios se gestionan desde el panel Authentication de Supabase por motivos de seguridad criptográfica.')}>
                      + Agregar Empleado (Supabase)
                    </button>
                  </div>
                  
                  <div className="card border-0 shadow-sm bg-white">
                    <table className="table table-hover mb-0 align-middle">
                      <thead style={{ backgroundColor: colorGris, color: 'white' }}>
                        <tr>
                          <th className="ps-4 py-3">Usuario / Nombre</th>
                          <th className="py-3">Rol Operativo</th>
                          <th className="text-center py-3">Claves</th>
                          <th className="text-end pe-4 py-3">Acciones</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr className="border-bottom">
                          <td className="fw-bold text-dark ps-4">Fer / Guille</td>
                          <td>
                            <span className="badge bg-dark mb-1">Administrador Total</span><br/>
                            <small className="text-muted">Acceso total, rentabilidad, contabilidad dual y modo truco.</small>
                          </td>
                          <td className="text-center"><button className="btn btn-sm btn-light border fw-bold" onClick={() => alert('Cambiar clave desde Supabase > Authentication')}>Cambiar</button></td>
                          <td className="text-end pe-4">-</td>
                        </tr>
                        <tr className="border-bottom">
                          <td className="fw-bold text-dark ps-4">Martín / Elio</td>
                          <td>
                            <span className="badge bg-primary mb-1">Depósito y Logística</span><br/>
                            <small className="text-muted">Recepción, control de stock físico y envíos. Visibilidad restringida de costos.</small>
                          </td>
                          <td className="text-center"><button className="btn btn-sm btn-light border fw-bold">Cambiar</button></td>
                          <td className="text-end pe-4"><button className="btn btn-sm btn-outline-danger fw-bold">Inhabilitar</button></td>
                        </tr>
                        <tr>
                          <td className="fw-bold text-dark ps-4">Nacho</td>
                          <td>
                            <span className="badge bg-success mb-1">Ventas (Mostrador)</span><br/>
                            <small className="text-muted">Venta rápida, cobro y pedidos. Sin acceso al panel contable.</small>
                          </td>
                          <td className="text-center"><button className="btn btn-sm btn-light border fw-bold">Cambiar</button></td>
                          <td className="text-end pe-4"><button className="btn btn-sm btn-outline-danger fw-bold">Inhabilitar</button></td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* 4. WHATSAPP MULTIAGENTE */}
              {tabActiva === 'WHATSAPP' && (
                <div>
                  <h4 className="fw-bold text-dark mb-4">Central de WhatsApp (API)</h4>
                  
                  <div className="row g-4">
                    <div className="col-md-5">
                      <div className="card border-0 shadow-sm bg-white p-4 text-center h-100">
                        <h6 className="fw-bold mb-3 text-dark">Vincular Línea del Local</h6>
                        <div className="mx-auto mb-3 bg-light border border-2 border-dashed d-flex align-items-center justify-content-center" style={{ width: '200px', height: '200px', borderRadius: '12px' }}>
                          <span className="text-muted small fw-bold">Esperando Engine...</span>
                        </div>
                        <button className="btn btn-success fw-bold w-100 shadow-sm" onClick={() => alert('Módulo Evolution API no conectado.')}>
                          🔄 Refrescar Código QR
                        </button>
                        <div className="mt-4 text-start bg-light p-3 rounded border">
                          <span className="badge bg-secondary w-100 text-start p-2 mb-1"><span className="fs-6">⚪ Estado: OFFLINE</span></span>
                          <small className="text-muted fw-bold">Línea vinculada: Ninguna</small>
                        </div>
                      </div>
                    </div>
                    
                    <div className="col-md-7">
                      <div className="card border-0 shadow-sm bg-white p-4 h-100">
                        <h6 className="fw-bold mb-3 text-dark border-bottom pb-2">Respuestas Automáticas</h6>
                        
                        <div className="form-check form-switch mb-2">
                          <input className="form-check-input" type="checkbox" id="checkBienvenida" defaultChecked style={{ transform: 'scale(1.2)', marginRight: '10px' }} />
                          <label className="form-check-label fw-bold text-secondary" htmlFor="checkBienvenida">Mensaje de Bienvenida (Nuevos chats)</label>
                        </div>
                        <textarea className="form-control mb-4 bg-light text-muted small" rows="2" defaultValue="¡Hola! Te comunicaste con Repuestos SANTA ROSA. En breve uno de nuestros chicos tomará tu consulta. Por favor, dejanos detalle del repuesto o patente." />

                        <div className="form-check form-switch mb-2">
                          <input className="form-check-input" type="checkbox" id="checkHorario" defaultChecked style={{ transform: 'scale(1.2)', marginRight: '10px' }} />
                          <label className="form-check-label fw-bold text-secondary" htmlFor="checkHorario">Aviso de Fuera de Horario</label>
                        </div>
                        <textarea className="form-control bg-light text-muted small mb-4" rows="2" defaultValue="En este momento estamos cerrados. Nuestro horario de atención es de 08:00 a 12:30 y de 16:00 a 20:00. Te responderemos apenas abramos." />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* 5. SISTEMA Y BACKUP */}
              {tabActiva === 'SISTEMA' && (
                <div>
                  <div className="card bg-white p-5 text-center border-0 shadow-sm mb-4 rounded-3">
                    <span className="display-1 d-block mb-3">☁️</span>
                    <h4 className="fw-bold text-dark mb-2">Infraestructura Dual Operativa</h4>
                    <p className="text-muted w-75 mx-auto">El sistema está sincronizando en tiempo real con los servidores oficiales e internos de Supabase. La redundancia de datos está gestionada por la plataforma en la nube.</p>
                    
                    <div className="row justify-content-center mt-4">
                      <div className="col-md-6">
                        <button className="btn btn-outline-dark btn-lg w-100 fw-bold shadow-sm" onClick={() => alert('Para extraer un dump .SQL, utilizá la consola de Supabase > Database > Backups.')}>
                          💾 Exportar Base Local (.SQL)
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="card border-danger shadow-sm bg-white">
                    <div className="card-body p-4">
                      <h6 className="fw-bold text-danger border-bottom border-danger pb-2 mb-3">⚠️ Zona de Peligro (Gerencia)</h6>
                      <p className="small text-muted mb-3">Restablecer la base de datos truncará todas las tablas de inventario, cuentas corrientes y movimientos operativos. Esta acción es destructiva e irreversible.</p>
                      <button className="btn btn-danger fw-bold shadow-sm" onClick={() => confirm('ACCESO DENEGADO.\n\nRequiere credenciales de nivel Service_Role para truncar la base de datos en producción.')}>
                        ☠️ Restablecer Sistema de Fábrica
                      </button>
                    </div>
                  </div>
                </div>
              )}

            </div>
          </div>
        </div>
      </div>
    </div>
  );
}