import React, { useState, useEffect } from 'react';
import { dbOficial } from '../../supabaseClient';
import ModalCliente from './ModalCliente';

export default function ListaClientes({ abrirCuentaCorriente }) {
  const [clientes, setClientes] = useState([]);
  const [busqueda, setBusqueda] = useState('');
  const [soloCtaCte, setSoloCtaCte] = useState(false);
  const [cargando, setCargando] = useState(true);
  
  const [mostrarModal, setMostrarModal] = useState(false);

  const cargarClientes = async () => {
    setCargando(true);
    // Traemos todos, ordenados primero por los más usados (mayor frecuencia_uso)
    const { data, error } = await dbOficial
      .from('clientes')
      .select('*')
      .order('frecuencia_uso', { ascending: false })
      .order('nombre', { ascending: true });

    if (error) {
      alert('Fallo al cargar clientes: ' + error.message);
    } else {
      setClientes(data || []);
    }
    setCargando(false);
  };

  useEffect(() => {
    cargarClientes();
  }, []);

  const clientesFiltrados = clientes.filter(c => {
    if (soloCtaCte && !c.cuenta_corriente_activa) return false;
    
    if (!busqueda) return true;
    
    const texto = busqueda.toLowerCase();
    return (
      (c.nombre && c.nombre.toLowerCase().includes(texto)) ||
      (c.cuit && c.cuit.includes(texto)) ||
      (c.sobrenombre && c.sobrenombre.toLowerCase().includes(texto))
    );
  });

  const formatoMoneda = (valor) => "$ " + Number(valor || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 });

  return (
    <div className="d-flex flex-column h-100 bg-white border rounded shadow-sm p-3 mb-4">
      
      {mostrarModal && (
        <ModalCliente 
          cerrar={() => setMostrarModal(false)} 
          recargarLista={cargarClientes} 
        />
      )}

      <div className="row mb-3 align-items-center">
        <div className="col-md-6">
          <input 
            type="text" 
            className="form-control form-control-lg shadow-sm font-monospace" 
            placeholder="🔎 Buscar por nombre, CUIT, DNI o sobrenombre..." 
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            autoFocus
          />
        </div>
        <div className="col-md-3">
          <div className="form-check form-switch mt-2">
            <input 
              className="form-check-input" 
              type="checkbox" 
              id="switchCtaCte" 
              checked={soloCtaCte} 
              onChange={(e) => setSoloCtaCte(e.target.checked)} 
            />
            <label className="form-check-label fw-bold" htmlFor="switchCtaCte">
              Solo con Cta. Cte. Activa
            </label>
          </div>
        </div>
        <div className="col-md-3 text-end">
          <button className="btn btn-primary fw-bold px-4" onClick={() => setMostrarModal(true)}>
            ➕ Nuevo Cliente
          </button>
        </div>
      </div>

      <div className="table-responsive flex-grow-1 border rounded">
        <table className="table table-hover align-middle mb-0">
          <thead className="table-light sticky-top">
            <tr>
              <th>Nombre / Razón Social</th>
              <th>Sobrenombre</th>
              <th>Documento</th>
              <th className="text-center">Estado</th>
              <th className="text-end">Deuda Oficial</th>
              <th className="text-end">Deuda X</th>
              <th className="text-center" width="120">Acción</th>
            </tr>
          </thead>
          <tbody>
            {cargando && <tr><td colSpan="7" className="text-center py-4">Cargando...</td></tr>}
            {!cargando && clientesFiltrados.length === 0 && <tr><td colSpan="7" className="text-center text-muted py-4">No se encontraron clientes.</td></tr>}
            
            {!cargando && clientesFiltrados.map(c => (
              <tr key={c.id}>
                <td className="fw-bold">{c.nombre}</td>
                <td className="text-muted fst-italic">{c.sobrenombre || '-'}</td>
                <td className="font-monospace">{c.cuit || '-'}</td>
                <td className="text-center">
                  {c.cuenta_corriente_activa ? (
                    <span className="badge bg-success">Cta Cte Activa</span>
                  ) : (
                    <span className="badge bg-secondary">Sin Cta Cte</span>
                  )}
                </td>
                <td className={`text-end font-monospace fw-bold ${c.saldo_fiscal > 0 ? 'text-danger' : 'text-success'}`}>
                  {formatoMoneda(c.saldo_fiscal)}
                </td>
                <td className={`text-end font-monospace fw-bold ${c.saldo_interno > 0 ? 'text-danger' : 'text-success'}`}>
                  {formatoMoneda(c.saldo_interno)}
                </td>
                <td className="text-center">
                  <button 
                    className="btn btn-sm btn-outline-dark fw-bold w-100" 
                    onClick={() => abrirCuentaCorriente(c)}
                  >
                    Abrir Ficha
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}