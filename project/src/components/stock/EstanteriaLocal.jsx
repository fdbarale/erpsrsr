import React, { useState, useEffect } from 'react';
import { buscarArticulosLocal } from '../../utils/dbLocal';

export default function EstanteriaLocal() {
  const [textoBusqueda, setTextoBusqueda] = useState('');
  const [misArticulos, setMisArticulos] = useState([]);

  const formatoMoneda = (valor) => "$ " + Number(valor || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 });

  useEffect(() => {
    const timer = setTimeout(async () => {
      if (!textoBusqueda.trim()) {
        setMisArticulos([]);
        return;
      }
      // Pasa 'LOCAL' para que la búsqueda incremental solo agarre tu estantería
      const res = await buscarArticulosLocal(textoBusqueda, 'LOCAL');
      setMisArticulos(res);
    }, 250);
    return () => clearTimeout(timer);
  }, [textoBusqueda]);

  return (
    <div className="d-flex flex-column h-100">
      <div className="mb-3">
        <input 
          type="text" 
          className="form-control border-success font-monospace shadow-sm" 
          placeholder="🔎 Buscar en mi estantería (Aplica mismas reglas de * y ancla)..."
          value={textoBusqueda}
          onChange={(e) => setTextoBusqueda(e.target.value)}
          autoFocus
        />
      </div>

      <div className="table-responsive flex-grow-1 border rounded">
        <table className="table table-hover align-middle mb-0" style={{ fontSize: '0.9rem' }}>
          <thead className="table-success sticky-top">
            <tr>
              <th>Código</th>
              <th>Descripción</th>
              <th className="text-center">Cod. Aux</th>
              <th className="text-center">Mi Stock</th>
              <th className="text-end text-muted">P. Lista</th>
              <th className="text-end text-muted">Costo</th>
              <th className="text-end text-primary">P. Público</th>
            </tr>
          </thead>
          <tbody>
            {misArticulos.length === 0 && <tr><td colSpan="7" className="text-center text-muted py-4">Estantería vacía o sin coincidencias.</td></tr>}
            {misArticulos.map((item, idx) => (
              <tr key={idx}>
                <td className="font-monospace fw-bold text-primary">{item.cod}</td>
                <td className="fw-semibold">{item.desc}</td>
                <td className="text-center font-monospace text-muted">{item.codigo_aux || '-'}</td>
                <td className="text-center font-monospace fw-bold fs-6">
                  {item.stock > 0 ? <span className="text-success">{item.stock}</span> : <span className="text-danger">{item.stock || 0}</span>}
                </td>
                <td className="text-end font-monospace text-muted">{formatoMoneda(item.precio_lista)}</td>
                <td className="text-end font-monospace text-muted">{formatoMoneda(item.precio_costo)}</td>
                <td className="text-end font-monospace fw-bold text-primary">{formatoMoneda(item.precio)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}