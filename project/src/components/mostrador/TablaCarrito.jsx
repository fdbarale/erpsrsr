import React, { useRef } from 'react';
import { useMostradorStore } from '../../stores/useMostradorStore';

export default function TablaCarrito({ abrirModalPedido }) {
  const { carrito, cambiarCantidad, cambiarDatoManual, eliminarItem } = useMostradorStore();
  const cantidadesRef = useRef([]);
  const preciosRef = useRef([]);

  const formatoMoneda = (valor) => "$ " + Math.round(parseFloat(valor) || 0).toLocaleString('es-AR');

  const manejarTecladoCantidad = (e, index, esManual) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (!carrito[index].cantidad) cambiarCantidad(index, 1);
      if (esManual) {
        preciosRef.current[index]?.focus();
        preciosRef.current[index]?.select();
      } else {
        document.getElementById('input-buscador-mostrador')?.focus();
      }
    }
  };

  const manejarTecladoPrecio = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      document.getElementById('input-buscador-mostrador')?.focus();
    }
  };

  return (
    <div className="card border shadow-sm rounded-3">
      <div className="card-body p-0">
        <table className="table table-borderless table-hover mb-0 align-middle w-100">
          <thead style={{ backgroundColor: '#f8f9fa', borderBottom: '2px solid #dee2e6' }}>
            <tr className="text-secondary text-uppercase fw-bold" style={{ fontSize: '0.8rem' }}>
              <th style={{ width: '15%' }} className="ps-3 py-2">Código</th>
              <th style={{ width: '42%' }} className="py-2">Descripción</th>
              <th style={{ width: '10%' }} className="text-center py-2">Cant.</th>
              <th style={{ width: '12%' }} className="text-end py-2">Unitario</th>
              <th style={{ width: '15%' }} className="text-end pe-3 py-2">Subtotal</th>
              <th style={{ width: '6%' }}></th>
            </tr>
          </thead>
          <tbody>
            {carrito.length === 0 ? (
              <tr><td colSpan="6" className="text-center text-muted py-4"><span className="d-block fs-2 mb-1 opacity-25">🛒</span>El carrito está vacío.</td></tr>
            ) : (
              carrito.map((item, index) => (
                <tr key={index} className="border-bottom">
                  <td className="fw-bold font-monospace text-primary ps-3">{item.cod}</td>
                  <td>{item.esManual ? <input type="text" className="form-control form-control-sm border-0 bg-light fw-bold w-100" value={item.desc} onChange={(e) => cambiarDatoManual(index, 'desc', e.target.value)} /> : <span className="fw-semibold text-dark">{item.marca ? item.marca + ' ' : ''}{item.desc}</span>}</td>
                  <td className="text-center"><input type="number" className="form-control form-control-sm text-center font-monospace fw-bold bg-light mx-auto" style={{ maxWidth: '70px' }} value={item.cantidad} onChange={(e) => cambiarCantidad(index, e.target.value)} onKeyDown={(e) => manejarTecladoCantidad(e, index, item.esManual)} ref={(el) => (cantidadesRef.current[index] = el)} /></td>
                  <td className="text-end">{item.esManual ? <div className="input-group input-group-sm justify-content-end"><span className="input-group-text bg-transparent border-0 text-success fw-bold pe-1 px-1">$</span><input type="number" className="form-control form-control-sm text-end font-monospace fw-bold text-success bg-light" style={{ maxWidth: '80px' }} value={item.precio || ''} onChange={(e) => cambiarDatoManual(index, 'precio', e.target.value)} onKeyDown={manejarTecladoPrecio} ref={(el) => (preciosRef.current[index] = el)} /></div> : <span className="font-monospace text-secondary">{formatoMoneda(item.precio)}</span>}</td>
                  <td className="text-end fw-bold font-monospace text-dark pe-3">{formatoMoneda((Number(item.precio) || 0) * (Number(item.cantidad) || 0))}</td>
                  <td className="text-end pe-2 text-nowrap">
                    {!item.esManual && (
                      <button className="btn btn-sm btn-outline-info p-1 border-0 me-1 shadow-sm" title="Estado de Fábrica y Pedidos" onClick={() => abrirModalPedido(item)} tabIndex="-1">📦</button>
                    )}
                    <button className="btn btn-sm text-danger opacity-50 p-1 border-0" onClick={() => eliminarItem(index)} tabIndex="-1">✖</button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}