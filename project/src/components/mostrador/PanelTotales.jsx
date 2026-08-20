import React from 'react';
import { useMostradorStore } from '../../stores/useMostradorStore';

export default function PanelTotales({ setMostrarFacturacion, setMostrarPresupuesto, setMostrarRecuperar }) {
  const { carrito, vaciarCarrito, obtenerTotales } = useMostradorStore();
  const { totalVenta, totalArticulos } = obtenerTotales();

  const colorBordo = '#6B1116';
  const formatoMoneda = (valor) => "$ " + Math.round(parseFloat(valor) || 0).toLocaleString('es-AR');

  const manejarVaciar = () => {
    if (carrito.length === 0) return;
    if (window.confirm('¿Seguro que querés vaciar todo el carrito?')) {
      vaciarCarrito();
      document.getElementById('input-buscador-mostrador')?.focus();
    }
  };

  return (
    <div className="card border shadow-sm rounded-3 bg-white mb-2">
      <div className="card-body p-3 text-center">
        <h6 className="text-uppercase text-secondary fw-bold mb-1 small">Total Carrito</h6>
        <h2 className="fw-bolder text-dark mb-0 font-monospace">{formatoMoneda(totalVenta)}</h2>
        <hr className="text-muted my-2" />
        <div className="d-flex justify-content-between text-secondary mb-2" style={{ fontSize: '0.75rem' }}>
          <span>Artículos: <strong className="text-dark">{totalArticulos}</strong></span>
        </div>
        <div className="d-grid gap-2">
          <button className="btn btn-sm fw-bold py-2 text-white shadow-sm" style={{ backgroundColor: colorBordo, borderRadius: '6px' }} tabIndex="-1" onClick={() => { if(carrito.length > 0) setMostrarFacturacion(true); }} disabled={carrito.length === 0}>💳 Facturar (F12)</button>
          <button className="btn btn-sm btn-light border-secondary border-opacity-25 fw-bold py-2 text-dark shadow-sm" style={{ borderRadius: '6px' }} tabIndex="-1" onClick={() => { if(carrito.length > 0) setMostrarPresupuesto(true); }} disabled={carrito.length === 0}>📝 Presupuestar (F9)</button>
          <button className="btn btn-sm btn-warning bg-opacity-10 border-warning fw-bold py-2 text-dark shadow-sm mt-1" style={{ borderRadius: '6px' }} tabIndex="-1" onClick={() => setMostrarRecuperar(true)}>📋 Levantar (F8)</button>
          <button className="btn btn-sm btn-white border fw-bold py-2 text-secondary shadow-sm" style={{ borderRadius: '6px' }} tabIndex="-1" disabled>👥 Cuentas Corrientes</button>
          <button className="btn btn-sm btn-white border fw-bold py-2 text-secondary shadow-sm" style={{ borderRadius: '6px' }} tabIndex="-1" disabled>📦 Gestión de Stock</button>
          <button className="btn btn-sm btn-link text-danger text-decoration-none fw-semibold p-0 mt-1 small" tabIndex="-1" onClick={manejarVaciar}>🗑 Vaciar Carrito (F4)</button>
        </div>
      </div>
    </div>
  );
}