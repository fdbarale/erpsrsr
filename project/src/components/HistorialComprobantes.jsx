import React, { useState, useEffect } from 'react';
import { dbOficial } from '../supabaseClient';

export default function HistorialComprobantes({ volverAlMenu }) {
  const [busqueda, setBusqueda] = useState('');
  const [filtroTipo, setFiltroTipo] = useState('TODOS');
  const [modalDevolucion, setModalDevolucion] = useState(null);
  
  // Ahora arranca vacío, esperando a Supabase
  const [comprobantes, setComprobantes] = useState([]);

  const colorBordo = '#6B1116';
  const colorGris = '#54565b';

  // === CHUPAR VENTAS REALES DE LA BASE ===
  useEffect(() => {
    const cargarHistorial = async () => {
      const { data, error } = await dbOficial
        .from('ventas')
        .select('*')
        .order('fecha', { ascending: false });

      if (data) {
        const mapeados = data.map(v => ({
          id: v.id,
          fecha: new Date(v.fecha).toLocaleString('es-AR'),
          nro: v.nro_comprobante,
          cliente: 'Consumidor Final', // Pendiente: cruzar con tabla clientes
          tipo: v.tipo,
          total: v.total,
          estado: v.estado,
          items: [] // Pendiente: traer detalle para devoluciones
        }));
        setComprobantes(mapeados);
      } else {
        console.error("Error al cargar historial:", error);
      }
    };
    cargarHistorial();
  }, []);

  const formatoMoneda = (valor) => "$ " + Math.round(parseFloat(valor) || 0).toLocaleString('es-AR');

  const comprobantesFiltrados = comprobantes.filter(c => {
    const coincideBusqueda = c.nro.toLowerCase().includes(busqueda.toLowerCase()) || c.cliente.toLowerCase().includes(busqueda.toLowerCase());
    const coincideTipo = filtroTipo === 'TODOS' || c.tipo === filtroTipo;
    return coincideBusqueda && coincideTipo;
  });

  const reimprimir = (nro) => {
    alert(`Enviando señal a la impresora térmica para reimprimir comprobante: ${nro}`);
  };

  const anularComprobante = async (comp) => {
    if (comp.estado === 'ANULADO') return;
    const confirmacion = window.confirm(`ATENCIÓN: Estás por anular el comprobante ${comp.nro}.\n\n(La anulación real de stock y caja la conectaremos en el próximo paso). ¿Marcar como anulado visualmente?`);
    if (confirmacion) {
      // Impacto visual temporal
      setComprobantes(prev => prev.map(c => c.id === comp.id ? { ...c, estado: 'ANULADO' } : c));
    }
  };

  const procesarDevolucionParcial = () => {
    alert(`Generando NC Parcial...`);
    setModalDevolucion(null);
  };

  const blanquearRemito = (comp) => {
    const confirmacion = window.confirm(`Vas a convertir el Remito Interno ${comp.nro} en una Factura Oficial.\n\n¿Continuar?`);
    if (confirmacion) {
      alert("Redirigiendo a facturación fiscal...");
    }
  };

  return (
    <div className="bg-light min-vh-100 d-flex flex-column" style={{ overflowX: 'hidden' }}>
      <nav className="navbar navbar-dark shadow-sm px-3" style={{ backgroundColor: colorBordo, borderBottom: `4px solid ${colorGris}` }}>
        <div className="container-fluid p-0">
          <div className="d-flex align-items-center">
            <button className="btn btn-sm btn-outline-light me-3 fw-bold" onClick={volverAlMenu}>
              ⬅ Volver al Menú
            </button>
            <span className="navbar-brand fw-bold m-0 tracking-wide">Historial y Auditoría de Comprobantes</span>
          </div>
          <div className="d-flex text-white align-items-center">
            <span className="me-3 fs-6">👤 Admin: Fer / Guille</span>
          </div>
        </div>
      </nav>

      <div className="container-fluid mt-4 flex-grow-1 px-4 mb-5">
        <div className="card border-0 shadow-sm bg-white mb-3">
          <div className="card-body d-flex gap-3 align-items-center p-3">
            <div className="flex-grow-1">
              <input 
                type="text" 
                className="form-control fw-bold" 
                placeholder="🔍 Buscar por Nro Comprobante o Cliente..." 
                value={busqueda} 
                onChange={e => setBusqueda(e.target.value)} 
              />
            </div>
            <div>
              <select className="form-select fw-bold" value={filtroTipo} onChange={e => setFiltroTipo(e.target.value)}>
                <option value="TODOS">Todos los comprobantes</option>
                <option value="FISCAL">Solo Facturas Fiscales (Blanco)</option>
                <option value="INTERNO">Solo Remitos Internos (Pardo)</option>
              </select>
            </div>
            <button className="btn btn-dark fw-bold px-4">Filtrar Fecha</button>
          </div>
        </div>

        <div className="card border-0 shadow-sm bg-white overflow-hidden h-100">
          <div className="overflow-auto" style={{ maxHeight: '70vh' }}>
            <table className="table table-hover mb-0 align-middle">
              <thead style={{ backgroundColor: colorGris, color: 'white' }}>
                <tr>
                  <th className="ps-3 py-3" width="12%">Fecha</th>
                  <th className="py-3" width="15%">Comprobante</th>
                  <th className="py-3" width="20%">Cliente</th>
                  <th className="py-3" width="10%">Origen</th>
                  <th className="text-end py-3" width="13%">Total</th>
                  <th className="text-center py-3" width="30%">Acciones Operativas</th>
                </tr>
              </thead>
              <tbody>
                {comprobantesFiltrados.map(comp => (
                  <tr key={comp.id} className={`border-bottom ${comp.estado === 'ANULADO' ? 'table-danger opacity-75' : ''}`}>
                    <td className="ps-3 font-monospace small text-muted">{comp.fecha}</td>
                    <td className={`fw-bold font-monospace ${comp.estado === 'ANULADO' ? 'text-danger text-decoration-line-through' : 'text-primary'}`}>
                      {comp.nro}
                    </td>
                    <td className="fw-semibold text-dark">{comp.cliente}</td>
                    <td>
                      {comp.tipo === 'FISCAL' ? (
                        <span className="badge bg-primary">AFIP</span>
                      ) : (
                        <span className="badge bg-secondary">INTERNO (X)</span>
                      )}
                    </td>
                    <td className="text-end fw-bold font-monospace text-dark">{formatoMoneda(comp.total)}</td>
                    <td className="text-center">
                      <div className="btn-group shadow-sm">
                        <button className="btn btn-sm btn-light border fw-bold" onClick={() => reimprimir(comp.nro)} title="Reimprimir Ticket">🖨️</button>
                        
                        <button 
                          className="btn btn-sm btn-warning border fw-bold" 
                          onClick={() => alert('Falta conectar consulta de items para NC Parcial.')} 
                          disabled={comp.estado === 'ANULADO'}
                        >
                          🔄 Parcial
                        </button>
                        
                        <button 
                          className="btn btn-sm btn-danger border fw-bold" 
                          onClick={() => anularComprobante(comp)}
                          disabled={comp.estado === 'ANULADO'}
                        >
                          ❌ NC
                        </button>

                        {comp.tipo === 'INTERNO' && comp.estado !== 'ANULADO' && (
                          <button 
                            className="btn btn-sm btn-dark border fw-bold" 
                            onClick={() => blanquearRemito(comp)}
                          >
                            ⬆️ Blanquear
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {comprobantesFiltrados.length === 0 && (
                  <tr>
                    <td colSpan="6" className="text-center py-5 text-muted">No se encontraron comprobantes reales en la base.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}