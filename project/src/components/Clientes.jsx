import React, { useState } from 'react';
import ListaClientes from './clientes/ListaClientes';
import CuentaCorriente from './clientes/CuentaCorriente';

export default function Clientes({ volverAlMenu, onLevantarComprobante }) {
  const [vista, setVista] = useState('LISTA'); 
  const [clienteSeleccionado, setClienteSeleccionado] = useState(null);
  const [modoVista, setModoVista] = useState('OFICIAL'); // OFICIAL | PARDO | DUAL

  const colorBordo = '#6B1116';
  const colorPardo = '#212529';

  const toggleModoVista = (e) => {
    if (e.ctrlKey) {
      if (modoVista === 'OFICIAL') setModoVista('PARDO');
      else if (modoVista === 'PARDO') setModoVista('DUAL');
      else setModoVista('OFICIAL');
    }
  };

  const obtenerFondoNav = () => {
    if (modoVista === 'OFICIAL') return colorBordo;
    if (modoVista === 'PARDO') return colorPardo;
    return `linear-gradient(90deg, ${colorBordo} 50%, ${colorPardo} 50%)`;
  };

  const obtenerTituloNav = () => {
    if (modoVista === 'OFICIAL') return 'Clientes y Cuentas Corrientes (Oficial)';
    if (modoVista === 'PARDO') return 'Clientes y Libreta Interna (X)';
    return 'Clientes y Cuentas Corrientes (Consolidado)';
  };

  const abrirCuentaCorriente = (cliente) => {
    setClienteSeleccionado(cliente);
    setVista('CTA_CTE');
  };

  return (
    <div className="bg-light min-vh-100 d-flex flex-column">
      <nav className="navbar navbar-dark shadow-sm px-3" style={{ background: obtenerFondoNav(), transition: 'background 0.3s ease' }}>
        <div className="container-fluid p-0 d-flex align-items-center justify-content-between">
          <div className="d-flex align-items-center">
            <button 
              className="btn btn-sm btn-outline-light me-3 fw-bold" 
              onClick={() => vista === 'LISTA' ? volverAlMenu() : setVista('LISTA')}
            >
              {vista === 'LISTA' ? '⬅ Menú (Esc)' : '⬅ Volver a Lista'}
            </button>
            <span 
              className="navbar-brand fw-bold m-0 user-select-none cursor-pointer" 
              onClick={toggleModoVista}
              style={{ cursor: 'pointer' }}
              title="Ctrl + Clic para alternar Oficial / Pardo / Consolidado"
            >
              👥 {obtenerTituloNav()}
            </span>
          </div>
          <span className="badge bg-light text-dark font-monospace fw-bold px-2 py-1 small">
            Modo: {modoVista}
          </span>
        </div>
      </nav>

      <div className="container-fluid mt-3 flex-grow-1 d-flex flex-column">
        {vista === 'LISTA' && (
          <ListaClientes 
            abrirCuentaCorriente={abrirCuentaCorriente} 
            modoVista={modoVista}
          />
        )}

        {vista === 'CTA_CTE' && clienteSeleccionado && (
          <CuentaCorriente 
            clienteInicial={clienteSeleccionado}
            volverALista={() => setVista('LISTA')}
            onLevantarComprobante={onLevantarComprobante}
            modoVista={modoVista}
            setModoVista={setModoVista}
          />
        )}
      </div>
    </div>
  );
}