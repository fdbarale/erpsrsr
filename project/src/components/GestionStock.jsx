import React, { useState } from 'react';
import EstanteriaLocal from './stock/EstanteriaLocal';
import CatalogoProveedor from './stock/CatalogoProveedor';
import ImportadorMasivo from './stock/ImportadorMasivo'; 

export default function GestionStock({ volverAlMenu }) {
  const [pestana, setPestana] = useState('ESTANTERIA');
  const colorBordo = '#6B1116';

  return (
    <div className="bg-light min-vh-100 d-flex flex-column">
      <nav className="navbar navbar-dark shadow-sm px-3" style={{ backgroundColor: colorBordo }}>
        <div className="container-fluid p-0 d-flex align-items-center">
          <button className="btn btn-sm btn-outline-light me-3 fw-bold" onClick={volverAlMenu}>⬅ Menú (Esc)</button>
          <span className="navbar-brand fw-bold m-0">📦 Gestión de Stock e Inventario</span>
        </div>
      </nav>

      <div className="container-fluid mt-3 flex-grow-1 d-flex flex-column">
        <ul className="nav nav-tabs fw-bold mb-3">
          <li className="nav-item">
            <button className={`nav-link ${pestana === 'ESTANTERIA' ? 'active text-dark bg-white border-bottom-0' : 'text-secondary'}`} onClick={() => setPestana('ESTANTERIA')}>
              🏪 Mi Estantería
            </button>
          </li>
          <li className="nav-item">
            <button className={`nav-link ${pestana === 'PROVEEDORES' ? 'active text-dark bg-white border-bottom-0' : 'text-secondary'}`} onClick={() => setPestana('PROVEEDORES')}>
              🔎 Catálogos Proveedor
            </button>
          </li>
          <li className="nav-item">
            <button className={`nav-link ${pestana === 'IMPORTAR' ? 'active text-dark bg-white border-bottom-0' : 'text-secondary'}`} onClick={() => setPestana('IMPORTAR')}>
              📥 Importar Excel / Actualizar Precios
            </button>
          </li>
        </ul>

        <div className="flex-grow-1 bg-white border rounded shadow-sm p-3 mb-4">
          {pestana === 'ESTANTERIA' && <EstanteriaLocal />}
          {pestana === 'PROVEEDORES' && <CatalogoProveedor />}
          {pestana === 'IMPORTAR' && <ImportadorMasivo />}
        </div>
      </div>
    </div>
  );
}