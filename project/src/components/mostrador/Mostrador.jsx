import React, { useState, useEffect } from 'react';

// Subimos DOS niveles (../../) para llegar a stores, utils y supabaseClient
import { useMostradorStore } from '../../stores/useMostradorStore';
import { obtenerArticuloLocal } from '../../utils/dbLocal';
import { dbOficial } from '../../supabaseClient';

// Estos están en la misma carpeta (./)
import BuscadorArticulos from './BuscadorArticulos';
import TablaCarrito from './TablaCarrito';
import PanelTotales from './PanelTotales';

// Los modales quedaron UN nivel arriba (../) en la carpeta components
import FacturacionModal from '../FacturacionModal';
import PresupuestoModal from '../PresupuestoModal';
import ModalRecuperarPresupuesto from '../ModalRecuperarPresupuesto';

export default function Mostrador({ abrirFacturacionInicial, desactivarFacturacionInicial, volverAlMenu, procesarVenta, usuarioOperador }) {
  const { carrito, vaciarCarrito, setCarritoCompleto } = useMostradorStore();
  
  const [mostrarFacturacion, setMostrarFacturacion] = useState(false);
  const [mostrarPresupuesto, setMostrarPresupuesto] = useState(false);
  const [mostrarRecuperar, setMostrarRecuperar] = useState(false);
  const [modalPedido, setModalPedido] = useState(null); 

  const colorBordo = '#6B1116';
  const colorGris = '#54565b';

  useEffect(() => {
    if (abrirFacturacionInicial) {
      setMostrarFacturacion(true);
      desactivarFacturacionInicial();
    }
  }, [abrirFacturacionInicial, desactivarFacturacionInicial]);

  // Atajos globales (Fuera del buscador)
  useEffect(() => {
    const atajosGlobales = (e) => {
      if (mostrarFacturacion || mostrarPresupuesto || mostrarRecuperar || modalPedido) return; 

      if (e.key === 'F4') {
        e.preventDefault();
        if (carrito.length > 0 && window.confirm('¿Seguro que querés vaciar todo el carrito?')) {
          vaciarCarrito();
          document.getElementById('input-buscador-mostrador')?.focus();
        }
      } else if (e.key === 'F12') {
        e.preventDefault();
        if (carrito.length > 0) setMostrarFacturacion(true);
      } else if (e.key === 'F9') {
        e.preventDefault();
        if (carrito.length > 0) setMostrarPresupuesto(true);
      } else if (e.key === 'F8') {
        e.preventDefault();
        setMostrarRecuperar(true);
      } else if (e.key === 'Escape') {
        // Solo vuelve al menú si el input está vacío y el carrito también
        const inputBuscador = document.getElementById('input-buscador-mostrador');
        if (carrito.length === 0 && inputBuscador && !inputBuscador.value) {
          volverAlMenu();
        }
      }
    };
    window.addEventListener('keydown', atajosGlobales);
    return () => window.removeEventListener('keydown', atajosGlobales);
  }, [carrito, mostrarFacturacion, mostrarPresupuesto, mostrarRecuperar, modalPedido]);

  const recibirPresupuesto = (itemsRecuperados) => {
    setCarritoCompleto([...carrito, ...itemsRecuperados]);
    setMostrarRecuperar(false);
    setTimeout(() => document.getElementById('input-buscador-mostrador')?.focus(), 100);
  };

  const abrirModalPedido = async (itemCarrito) => {
    if (itemCarrito.esManual) return;
    const itemBd = await obtenerArticuloLocal(itemCarrito.cod);
    if (itemBd) setModalPedido(itemBd);
  };

  const actualizarCantidadPedido = async (cod, incremento) => {
    // Lógica para actualizar el modal del pedido directamente. 
    // La actualización de dbLocal se hace en el buscador.
    const itemBd = await obtenerArticuloLocal(cod);
    if (!itemBd) return;
    const nuevaCant = Math.max(0, (itemBd.cant_pendiente || 0) + incremento);
    if (modalPedido && modalPedido.cod === cod) setModalPedido({ ...modalPedido, cant_pendiente: nuevaCant });
    dbOficial.from('articulos').update({ cant_pendiente: nuevaCant }).eq('cod', cod).then();
  };

  return (
    <div className="bg-light min-vh-100 d-flex flex-column" style={{ maxWidth: '100%', overflowX: 'hidden' }}>
      
      {/* Modales */}
      {modalPedido && (
        <div className="position-fixed top-0 start-0 w-100 h-100 bg-dark bg-opacity-75 d-flex justify-content-center align-items-center" style={{ zIndex: 3000 }}>
          <div className="card shadow-lg border-0" style={{ width: '400px', borderRadius: '12px' }}>
            <div className="card-header text-white d-flex justify-content-between align-items-center" style={{ backgroundColor: '#17a2b8' }}>
              <h6 className="m-0 fw-bold">📦 Gestión de Pedido</h6>
              <button className="btn-close btn-close-white" onClick={() => { setModalPedido(null); document.getElementById('input-buscador-mostrador')?.focus(); }}></button>
            </div>
            <div className="card-body bg-light text-center">
              <h5 className="fw-bold text-dark font-monospace mb-1">{modalPedido.cod}</h5>
              <p className="text-muted small mb-3">{modalPedido.desc}</p>
              
              <div className="row g-2 mb-3">
                <div className="col-4 border-end">
                  <span className="d-block small text-muted">Stock Local</span>
                  <span className={`fs-5 fw-bold ${modalPedido.stock > 0 ? 'text-success' : 'text-danger'}`}>{modalPedido.stock || 0}</span>
                </div>
                <div className="col-4 border-end">
                  <span className="d-block small text-muted">🚚 En Camino</span>
                  <span className="fs-5 fw-bold text-warning">{modalPedido.cant_en_camino || 0}</span>
                </div>
                <div className="col-4">
                  <span className="d-block small text-muted">🛒 A Pedir</span>
                  <span className="fs-5 fw-bold text-info">{modalPedido.cant_pendiente || 0}</span>
                </div>
              </div>

              <div className="d-flex justify-content-center gap-2">
                <button className="btn btn-outline-danger fw-bold w-50" onClick={() => actualizarCantidadPedido(modalPedido.cod, -1)}>- Quitar 1</button>
                <button className="btn btn-info text-white fw-bold w-50 shadow-sm" onClick={() => actualizarCantidadPedido(modalPedido.cod, 1)}>+ Pedir 1</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {mostrarRecuperar && (
        <ModalRecuperarPresupuesto cerrar={() => setMostrarRecuperar(false)} cargarPresupuesto={recibirPresupuesto} />
      )}

      {mostrarFacturacion && (
        <FacturacionModal 
          carrito={carrito}
          totalCarrito={carrito.reduce((acum, item) => acum + ((Number(item.precio) || 0) * (Number(item.cantidad) || 0)), 0)} 
          cerrar={() => setMostrarFacturacion(false)} 
          vaciarYConfirmar={() => {
            procesarVenta(carrito);
            vaciarCarrito();
            setMostrarFacturacion(false);
            document.getElementById('input-buscador-mostrador')?.focus();
          }}
          usuarioOperador={usuarioOperador}
        />
      )}

      {mostrarPresupuesto && (
        <PresupuestoModal 
          carrito={carrito}
          totalCarrito={carrito.reduce((acum, item) => acum + ((Number(item.precio) || 0) * (Number(item.cantidad) || 0)), 0)} 
          cerrar={() => setMostrarPresupuesto(false)} 
          vaciarYConfirmar={() => {
            vaciarCarrito();
            setMostrarPresupuesto(false);
            document.getElementById('input-buscador-mostrador')?.focus();
          }}
        />
      )}

      {/* Navbar Superior */}
      <nav className="navbar navbar-dark shadow-sm px-3" style={{ backgroundColor: colorBordo, borderBottom: `4px solid ${colorGris}` }}>
        <div className="container-fluid p-0">
          <div className="d-flex align-items-center">
            <button className="btn btn-sm btn-outline-light me-3 fw-bold" onClick={volverAlMenu} tabIndex="-1">⬅ Menú (Esc)</button>
            <span className="navbar-brand fw-bold m-0 tracking-wide">RSR - Mostrador Ágil</span>
          </div>
          <div className="d-flex text-white align-items-center">
            <span className="me-3 fs-6">👤 {usuarioOperador}</span>
          </div>
        </div>
      </nav>

      {/* Layout Grilla Principal */}
      <div className="container-fluid px-3 mt-3 flex-grow-1">
        <div className="row h-100">
          <div className="col-lg-9 col-xl-10">
            <BuscadorArticulos setModalPedido={setModalPedido} />
            <TablaCarrito abrirModalPedido={abrirModalPedido} />
          </div>
          <div className="col-lg-3 col-xl-2">
            <PanelTotales 
              setMostrarFacturacion={setMostrarFacturacion}
              setMostrarPresupuesto={setMostrarPresupuesto}
              setMostrarRecuperar={setMostrarRecuperar}
            />
          </div>
        </div>
      </div>
    </div>
  );
}