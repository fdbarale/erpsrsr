import React, { useState, useEffect, useRef } from 'react';
import { dbOficial } from '../supabaseClient';

export default function ModalRecuperarPresupuesto({ cerrar, cargarPresupuesto }) {
  const [presupuestos, setPresupuestos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const colorBordo = '#6B1116';
  const modalRef = useRef(null);

  useEffect(() => {
    modalRef.current?.focus();
    cargarListaPresupuestos();

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') cerrar();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const cargarListaPresupuestos = async () => {
    setCargando(true);
    const { data, error } = await dbOficial
      .from('ventas')
      .select('id, created_at, cliente_nombre, total_venta, descuento_porcentaje, notas')
      .eq('estado', 'PRESUPUESTO')
      .order('created_at', { ascending: false })
      .limit(30);

    if (!error && data) {
      setPresupuestos(data);
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
      <div className="card shadow-lg border-0 d-flex flex-column" style={{ width: '800px', height: '80vh', borderRadius: '12px' }} tabIndex="0" ref={modalRef}>
        
        <div className="card-header text-white d-flex justify-content-between align-items-center py-3 px-4" style={{ backgroundColor: colorBordo }}>
          <h5 className="mb-0 fw-bold">📋 Levantar Presupuesto Guardado</h5>
          <button className="btn btn-sm btn-close btn-close-white" onClick={cerrar}></button>
        </div>

        <div className="card-body bg-light p-0 overflow-auto h-100">
          {cargando ? (
            <div className="d-flex justify-content-center align-items-center h-100">
              <div className="spinner-border text-secondary" role="status"></div>
            </div>
          ) : presupuestos.length === 0 ? (
            <div className="d-flex flex-column justify-content-center align-items-center h-100 text-muted">
              <span className="fs-1 mb-2 opacity-50">📂</span>
              <p className="fw-bold">No hay presupuestos pendientes guardados.</p>
            </div>
          ) : (
            <div className="list-group list-group-flush">
              {presupuestos.map((p) => (
                <button key={p.id} onClick={() => seleccionarPresupuesto(p.id)} className="list-group-item list-group-item-action p-3 border-bottom d-flex justify-content-between align-items-center">
                  <div>
                    <h6 className="fw-bold text-dark mb-1">{p.cliente_nombre}</h6>
                    <small className="text-muted d-block font-monospace">PRE-{p.id.toString().padStart(6, '0')} | {formatoFecha(p.created_at)}</small>
                    {p.notas && <small className="text-secondary opacity-75">{p.notas}</small>}
                  </div>
                  <div className="text-end">
                    <span className="fw-bolder fs-5 text-dark font-monospace">{formatoMoneda(p.total_venta)}</span>
                    <br />
                    <span className="badge bg-success bg-opacity-10 text-success border border-success mt-1">📥 Cargar al mostrador</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="card-footer bg-white border-top p-3 d-flex justify-content-between">
          <span className="text-muted small align-self-center">Solo se muestran los últimos 30 presupuestos emitidos.</span>
          <button className="btn btn-outline-secondary fw-bold px-4" onClick={cerrar}>Cerrar (Esc)</button>
        </div>
      </div>
    </div>
  );
}