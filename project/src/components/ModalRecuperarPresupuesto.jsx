import React, { useState, useEffect, useRef } from 'react';
import { dbOficial } from '../supabaseClient';

export default function ModalRecuperarPresupuesto({ cerrar, cargarPresupuesto }) {
  const [presupuestos, setPresupuestos] = useState([]);
  const [cargando, setCargando] = useState(true);
  
  // Estados para filtros
  const [textoBusqueda, setTextoBusqueda] = useState('');
  
  // Fechas por defecto: últimos 30 días
  const hoy = new Date();
  const haceUnMes = new Date();
  haceUnMes.setDate(hoy.getDate() - 30);
  
  const [fechaDesde, setFechaDesde] = useState(haceUnMes.toISOString().slice(0, 10));
  const [fechaHasta, setFechaHasta] = useState(hoy.toISOString().slice(0, 10));

  const colorBordo = '#6B1116';
  const modalRef = useRef(null);

  useEffect(() => {
    modalRef.current?.focus();
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') cerrar();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Efecto que reacciona a los cambios en los filtros
  useEffect(() => {
    // Ponemos un pequeño delay (debounce) para no saturar la base de datos si teclea rápido
    const timer = setTimeout(() => {
      cargarListaPresupuestos();
    }, 400);
    return () => clearTimeout(timer);
  }, [textoBusqueda, fechaDesde, fechaHasta]);

  const cargarListaPresupuestos = async () => {
    setCargando(true);
    
    // Armamos la consulta base (Cuidado con los bordes de las fechas, sumamos un día al Hasta para incluirlo entero)
    const fechaHastaPlus1 = new Date(fechaHasta);
    fechaHastaPlus1.setDate(fechaHastaPlus1.getDate() + 1);

    let query = dbOficial
      .from('ventas')
      .select('id, created_at, cliente_nombre, total, descuento_porcentaje, notas, nro_comprobante')
      .eq('estado', 'PRESUPUESTO')
      .gte('created_at', `${fechaDesde}T00:00:00.000Z`)
      .lt('created_at', fechaHastaPlus1.toISOString())
      .order('created_at', { ascending: false })
      .limit(100);

    // Si hay texto escrito, agregamos la condición ILIKE para buscar en nombre o notas
    if (textoBusqueda.trim()) {
      const termino = `%${textoBusqueda.trim()}%`;
      query = query.or(`cliente_nombre.ilike.${termino},notas.ilike.${termino},nro_comprobante.ilike.${termino}`);
    }

    const { data, error } = await query;

    if (!error && data) {
      setPresupuestos(data);
    } else {
      console.error("Error al traer presupuestos:", error);
    }
    setCargando(false);
  };

  const seleccionarPresupuesto = async (idVenta) => {
    const { data: items, error } = await dbOficial
      .from('ventas_items')
      .select('articulo_cod, descripcion, cantidad, precio_unitario, marca, codigo_aux')
      .eq('venta_id', idVenta);

    if (error || !items) {
      alert("Error al cargar los ítems del presupuesto.");
      return;
    }

    // Convertimos lo que devuelve la base al formato que entiende tu carrito en Mostrador.jsx
    const carritoRecuperado = items.map(it => ({
      cod: it.articulo_cod || 'MANUAL',
      desc: it.descripcion,
      cantidad: it.cantidad,
      precio: parseFloat(it.precio_unitario),
      marca: it.marca,
      codigo_aux: it.codigo_aux,
      esManual: it.articulo_cod === 'MANUAL' || !it.articulo_cod
    }));

    cargarPresupuesto(carritoRecuperado);
  };

  const formatoMoneda = (valor) => '$ ' + Math.round(parseFloat(valor) || 0).toLocaleString('es-AR');
  
  const formatoFecha = (isoString) => {
    const d = new Date(isoString);
    return `${d.toLocaleDateString('es-AR')} ${d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}`;
  };

  return (
    <div className="position-fixed top-0 start-0 w-100 h-100 bg-dark bg-opacity-75 d-flex justify-content-center align-items-center" style={{ zIndex: 2000 }}>
      <div className="card shadow-lg border-0 d-flex flex-column" style={{ width: '900px', height: '85vh', borderRadius: '12px' }} tabIndex="0" ref={modalRef}>
        
        <div className="card-header text-white d-flex justify-content-between align-items-center py-3 px-4" style={{ backgroundColor: colorBordo }}>
          <h5 className="mb-0 fw-bold">📋 Buscador y Recuperador de Presupuestos</h5>
          <button className="btn btn-sm btn-close btn-close-white" onClick={cerrar}></button>
        </div>

        {/* BARRA DE FILTROS SUPERIOR */}
        <div className="bg-white border-bottom p-3">
          <div className="row g-2 align-items-center">
            <div className="col-md-6">
              <div className="input-group input-group-sm">
                <span className="input-group-text bg-light fw-bold text-muted">🔎</span>
                <input 
                  type="text" 
                  className="form-control fw-bold border-secondary" 
                  placeholder="Buscar por Nombre, Vehículo, Patente o Seguro..." 
                  value={textoBusqueda}
                  onChange={(e) => setTextoBusqueda(e.target.value)}
                />
              </div>
            </div>
            <div className="col-md-3">
              <div className="input-group input-group-sm">
                <span className="input-group-text bg-light fw-bold text-muted" style={{fontSize: '0.7rem'}}>Desde</span>
                <input 
                  type="date" 
                  className="form-control text-center fw-bold" 
                  value={fechaDesde}
                  onChange={(e) => setFechaDesde(e.target.value)}
                />
              </div>
            </div>
            <div className="col-md-3">
              <div className="input-group input-group-sm">
                <span className="input-group-text bg-light fw-bold text-muted" style={{fontSize: '0.7rem'}}>Hasta</span>
                <input 
                  type="date" 
                  className="form-control text-center fw-bold" 
                  value={fechaHasta}
                  onChange={(e) => setFechaHasta(e.target.value)}
                />
              </div>
            </div>
          </div>
        </div>

        <div className="card-body bg-light p-0 overflow-auto h-100">
          {cargando ? (
            <div className="d-flex justify-content-center align-items-center h-100">
              <div className="spinner-border text-secondary" role="status"></div>
            </div>
          ) : presupuestos.length === 0 ? (
            <div className="d-flex flex-column justify-content-center align-items-center h-100 text-muted">
              <span className="fs-1 mb-2 opacity-50">📂</span>
              <p className="fw-bold">No se encontraron presupuestos con esos filtros.</p>
              <small className="text-secondary">Asegurate de que las fechas sean correctas.</small>
            </div>
          ) : (
            <div className="list-group list-group-flush">
              {presupuestos.map((p) => (
                <div key={p.id} className="list-group-item list-group-item-action p-3 border-bottom d-flex justify-content-between align-items-center" style={{ cursor: 'default' }}>
                  <div className="w-75">
                    <div className="d-flex align-items-center gap-2 mb-1">
                      <h6 className="fw-bold text-dark m-0">{p.cliente_nombre}</h6>
                      <span className="badge bg-secondary bg-opacity-10 text-secondary border border-secondary" style={{ fontSize: '0.7rem' }}>
                        {p.nro_comprobante || `PRE-${p.id.toString().padStart(6, '0')}`}
                      </span>
                      <span className="text-muted small ms-2">{formatoFecha(p.created_at)}</span>
                    </div>
                    
                    {p.notas && (
                      <p className="text-secondary small m-0 fw-semibold" style={{ fontSize: '0.8rem' }}>
                        📝 {p.notas}
                      </p>
                    )}
                  </div>
                  
                  <div className="text-end w-25">
                    <span className="fw-bolder fs-5 text-dark font-monospace d-block mb-1">{formatoMoneda(p.total)}</span>
                    <button 
                      className="btn btn-sm btn-outline-success fw-bold w-100 shadow-sm"
                      onClick={() => seleccionarPresupuesto(p.id)}
                    >
                      📥 Cargar al Mostrador
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card-footer bg-white border-top p-3 d-flex justify-content-between">
          <span className="text-muted small align-self-center">Mostrando hasta 100 resultados. Filtre para afinar la búsqueda.</span>
          <button className="btn btn-outline-secondary fw-bold px-4" onClick={cerrar}>Cerrar (Esc)</button>
        </div>
      </div>
    </div>
  );
}