import React, { useState, useEffect } from 'react';
import Mostrador from './components/Mostrador';
import GestionStock from './components/GestionStock';
import CuentasCorrientes from './components/CuentasCorrientes';
import Deposito from './components/Deposito';
import { supabase } from './supabaseClient'; 

const EQUIPO = ['Fernando', 'Guillermo', 'Nacho', 'Elio', 'Martin'];

export default function App() {
  const [vistaActual, setVistaActual] = useState('MENU');
  const [baseDatos, setBaseDatos] = useState([]); 
  const [carrito, setCarrito] = useState([]);
  const [abrirFacturacionDirecta, setAbrirFacturacionDirecta] = useState(false);

  useEffect(() => {
    const cargarInventario = async () => {
      let { data: articulosDB, error } = await supabase
        .from('articulos')
        .select('*');

      if (error) {
        console.error("Error al cargar la base de datos:", error);
      } else if (articulosDB) {
        setBaseDatos(articulosDB);
      }
    };

    cargarInventario();
  }, []);

  const [pagos, setPagos] = useState([]);
  const [despachos, setDespachos] = useState([]);
  const [recordatorios, setRecordatorios] = useState([]);
  
  const [chatsWhatsapp, setChatsWhatsapp] = useState([
    { id: '5492954112233', nombre: 'Taller Macachín', asignadoA: null, estado: 'PENDIENTE', ultimoMensaje: '¿Tienen bomba de agua para Gol?', hora: '09:15' },
    { id: '5492954998877', nombre: 'Juan Pérez (Cliente)', asignadoA: 'Nacho', estado: 'EN_ATENCION', ultimoMensaje: 'Paso a buscar el filtro a las 18hs', hora: '10:02' }
  ]);
  const [chatActivo, setChatActivo] = useState(null);

  const registrarFacturaCompra = (proveedor, factura, monto, fechaVto) => {
    setPagos(prev => [...prev, { id: Date.now(), nombre: proveedor, detalle: `Fra: ${factura} - Vto: ${fechaVto}`, monto, color: 'danger' }]);
  };

  const registrarDespachoAutomatico = (cliente, destino, detalleItems) => {
    setDespachos(prev => [...prev, { id: Date.now(), nombre: `${cliente} (${destino})`, detalle: detalleItems }]);
  };

  const agregarPagoManual = () => {
    const nombre = prompt("Proveedor / Entidad:");
    if (!nombre) return;
    const detalle = prompt("Detalle del vencimiento:");
    const monto = prompt("Monto a pagar ($):");
    setPagos([...pagos, { id: Date.now(), nombre, detalle: detalle || '', monto: parseFloat(monto) || 0, color: 'danger' }]);
  };

  const agregarDespachoManual = () => {
    const nombre = prompt("Cliente y Destino:");
    if (!nombre) return;
    const detalle = prompt("Repuestos y Medio de transporte:");
    setDespachos([...despachos, { id: Date.now(), nombre, detalle: detalle || '' }]);
  };

  const agregarRecordatorioManual = () => {
    const nombre = prompt("Título del recordatorio:");
    if (!nombre) return;
    const detalle = prompt("Detalle adicional:");
    setRecordatorios([...recordatorios, { id: Date.now(), nombre, detalle: detalle || '' }]);
  };

  const asignarChat = (chatId, empleado) => {
    setChatsWhatsapp(prev => prev.map(c => c.id === chatId ? { ...c, asignadoA: empleado, estado: empleado ? 'EN_ATENCION' : 'PENDIENTE' } : c));
  };

  const cerrarChat = (chatId) => {
    setChatsWhatsapp(prev => prev.map(c => c.id === chatId ? { ...c, estado: 'RESUELTO' } : c));
    if (chatActivo?.id === chatId) setChatActivo(null);
  };

  const procesarVenta = (carritoVendido) => {
    setBaseDatos(prevBase => {
      let nuevaBase = [...prevBase];
      carritoVendido.forEach(itemVendido => {
        if (itemVendido.esManual) return; 
        const idx = nuevaBase.findIndex(bd => bd.cod === itemVendido.cod);
        if (idx >= 0) {
          const stockActual = nuevaBase[idx].stock;
          const nuevoStock = stockActual - itemVendido.cantidad;
          let sumarAPendientes = 0;
          if (nuevoStock <= 0) sumarAPendientes = itemVendido.cantidad;

          nuevaBase[idx] = { ...nuevaBase[idx], stock: nuevoStock, cant_pendiente: (nuevaBase[idx].cant_pendiente || 0) + sumarAPendientes };
        }
      });
      return nuevaBase;
    });
  };

  const levantarArticulosAFacturar = (articulos) => {
    setCarrito(articulos.map(art => ({ ...art, esManual: false })));
    setAbrirFacturacionDirecta(true); 
    setVistaActual('MOSTRADOR');
  };

  if (vistaActual === 'MOSTRADOR') return <Mostrador baseDatos={baseDatos} setBaseDatos={setBaseDatos} carrito={carrito} setCarrito={setCarrito} abrirFacturacionInicial={abrirFacturacionDirecta} desactivarFacturacionInicial={() => setAbrirFacturacionDirecta(false)} volverAlMenu={() => setVistaActual('MENU')} procesarVenta={procesarVenta} />;
  if (vistaActual === 'STOCK') return <GestionStock baseDatos={baseDatos} setBaseDatos={setBaseDatos} volverAlMenu={() => setVistaActual('MENU')} />;
  if (vistaActual === 'CUENTAS') return <CuentasCorrientes onLevantarComprobante={levantarArticulosAFacturar} volverAlMenu={() => setVistaActual('MENU')} />;
  if (vistaActual === 'DEPOSITO') return <Deposito baseDatos={baseDatos} setBaseDatos={setBaseDatos} despachos={despachos} setDespachos={setDespachos} volverAlMenu={() => setVistaActual('MENU')} />;

  if (vistaActual === 'WHATSAPP') {
    return (
      <div className="bg-light min-vh-100 d-flex flex-column">
        <div className="bg-success text-white p-2 d-flex justify-content-between align-items-center shadow-sm">
          <h5 className="m-0 fw-bold">🟢 Central de Comunicaciones WhatsApp (API)</h5>
          <button className="btn btn-sm btn-light fw-bold" onClick={() => setVistaActual('MENU')}>Volver al Dashboard</button>
        </div>
        <div className="row flex-grow-1 g-0">
          <div className="col-4 border-end bg-white d-flex flex-column">
            <div className="p-2 border-bottom fw-bold text-muted small">BANDEJA DE ENTRADA</div>
            <div className="flex-grow-1 overflow-auto">
              {chatsWhatsapp.filter(c => c.estado !== 'RESUELTO').map(chat => (
                <div key={chat.id} className={`p-3 border-bottom cursor-pointer ${chatActivo?.id === chat.id ? 'bg-light border-start border-4 border-success' : ''}`} onClick={() => setChatActivo(chat)} style={{cursor: 'pointer'}}>
                  <div className="d-flex justify-content-between">
                    <strong className="text-dark">{chat.nombre}</strong>
                    <span className="text-muted small">{chat.hora}</span>
                  </div>
                  <div className="text-muted small text-truncate mt-1">{chat.ultimoMensaje}</div>
                  <div className="mt-2 d-flex justify-content-between align-items-center">
                    <span className={`badge ${chat.estado === 'PENDIENTE' ? 'bg-danger' : 'bg-warning text-dark'}`}>{chat.estado}</span>
                    <span className="small fw-bold text-primary">{chat.asignadoA ? `Atiende: ${chat.asignadoA}` : 'Sin asignar'}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="col-8 d-flex flex-column bg-light">
            {chatActivo ? (
              <>
                <div className="bg-white border-bottom p-3 d-flex justify-content-between align-items-center">
                  <div>
                    <h5 className="m-0 fw-bold">{chatActivo.nombre}</h5>
                    <span className="small text-muted font-monospace">{chatActivo.id}</span>
                  </div>
                  <div className="d-flex gap-2 align-items-center">
                    <label className="small fw-bold text-muted">Asignar a:</label>
                    <select className="form-select form-select-sm fw-bold w-auto" value={chatActivo.asignadoA || ''} onChange={(e) => asignarChat(chatActivo.id, e.target.value)}>
                      <option value="">Nadie (Pendiente)</option>
                      {EQUIPO.map(emp => <option key={emp} value={emp}>{emp}</option>)}
                    </select>
                    <button className="btn btn-sm btn-outline-danger fw-bold ms-2" onClick={() => cerrarChat(chatActivo.id)}>Cerrar Chat</button>
                  </div>
                </div>
                <div className="flex-grow-1 p-4 d-flex flex-column justify-content-end" style={{ backgroundImage: 'url(https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png)', opacity: 0.9 }}>
                  <div className="align-self-start bg-white p-2 rounded shadow-sm mb-2" style={{ maxWidth: '75%' }}>{chatActivo.ultimoMensaje}</div>
                </div>
                <div className="p-3 bg-white border-top d-flex gap-2">
                  <input type="text" className="form-control" placeholder="Escriba un mensaje (Requiere integración API)..." disabled />
                  <button className="btn btn-success fw-bold" disabled>Enviar</button>
                </div>
              </>
            ) : (
              <div className="h-100 d-flex flex-column align-items-center justify-content-center text-muted">
                <span className="fs-1">💬</span>
                <p>Seleccione una conversación de la bandeja para interactuar.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  const chatsPendientes = chatsWhatsapp.filter(c => c.estado === 'PENDIENTE').length;

  return (
    <div className="bg-light min-vh-100 p-4" style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <div className="mb-4">
        <h2 className="fw-bold text-dark mb-1">¡Buen día equipo! 🧉</h2>
        <p className="text-muted m-0">Sistema operativo. Pendientes de WhatsApp: {chatsPendientes}</p>
      </div>

      <div className="row row-cols-1 row-cols-md-3 row-cols-lg-6 g-3 mb-5">
        <div className="col">
          <div className="card h-100 border-0 shadow-sm text-center p-3" onClick={() => { setCarrito([]); setVistaActual('MOSTRADOR'); }} style={{ cursor: 'pointer', borderRadius: '12px' }}>
            <span className="fs-1 mb-2 d-block">🛒</span><h6 className="fw-bold text-dark mb-1">Mostrador Principal</h6>
          </div>
        </div>
        <div className="col">
          <div className="card h-100 border-0 shadow-sm text-center p-3" onClick={() => setVistaActual('DEPOSITO')} style={{ cursor: 'pointer', borderRadius: '12px' }}>
            <span className="fs-1 mb-2 d-block">📦</span><h6 className="fw-bold text-dark mb-1">Depósito - Pedidos</h6>
          </div>
        </div>
        <div className="col">
          <div className="card h-100 border-0 shadow-sm text-center p-3" onClick={() => setVistaActual('CUENTAS')} style={{ cursor: 'pointer', borderRadius: '12px' }}>
            <span className="fs-1 mb-2 d-block">👥</span><h6 className="fw-bold text-dark mb-1">Clientes</h6>
          </div>
        </div>
        <div className="col">
          <div className="card h-100 border-0 shadow-sm text-center p-3" onClick={() => setVistaActual('STOCK')} style={{ cursor: 'pointer', borderRadius: '12px' }}>
            <span className="fs-1 mb-2 d-block">🚚</span><h6 className="fw-bold text-dark mb-1">Proveedores</h6>
          </div>
        </div>
        <div className="col">
          <div className="card h-100 border-0 shadow-sm text-center p-3 opacity-50" style={{ cursor: 'not-allowed', borderRadius: '12px' }}>
            <span className="fs-1 mb-2 d-block">📊</span><h6 className="fw-bold text-dark mb-1">Contabilidad</h6>
          </div>
        </div>
        <div className="col">
          <div className="card h-100 border-0 shadow-sm text-center p-3 opacity-50" style={{ cursor: 'not-allowed', borderRadius: '12px' }}>
            <span className="fs-1 mb-2 d-block">⚙️</span><h6 className="fw-bold text-dark mb-1">Configuración</h6>
          </div>
        </div>
      </div>

      <h4 className="fw-bold text-secondary mb-3">Resumen Operativo</h4>
      <div className="row row-cols-1 row-cols-md-2 row-cols-lg-4 g-4">
        
        <div className="col">
          <div className="card border-0 shadow-sm h-100" style={{ borderTop: '4px solid #dc3545', borderRadius: '10px' }}>
            <div className="card-body p-3 d-flex flex-column">
              <div className="d-flex justify-content-between align-items-center mb-3">
                <h6 className="fw-bold text-danger m-0" style={{ fontSize: '12px' }}>🔴 PAGOS / VENCIMIENTOS</h6>
                <button className="btn btn-sm btn-outline-danger py-0 px-2 fw-bold" onClick={agregarPagoManual}>+</button>
              </div>
              <div className="flex-grow-1 overflow-auto" style={{ maxHeight: '250px' }}>
                {pagos.map(p => (
                  <div key={p.id} className="mb-3 pb-2 border-bottom d-flex justify-content-between align-items-start">
                    <div><strong className="d-block text-dark small">{p.nombre}</strong><span className="text-muted" style={{ fontSize: '11px' }}>{p.detalle}</span></div>
                    <div className="d-flex align-items-center gap-2"><span className="badge bg-danger rounded-pill">${p.monto}</span><button className="btn btn-sm text-success p-0" onClick={() => setPagos(pagos.filter(x => x.id !== p.id))}>✔️</button></div>
                  </div>
                ))}
                {pagos.length === 0 && <span className="small text-muted">Bandeja de pagos vacía.</span>}
              </div>
            </div>
          </div>
        </div>

        <div className="col">
          <div className="card border-0 shadow-sm h-100" style={{ borderTop: '4px solid #0d6efd', borderRadius: '10px' }}>
            <div className="card-body p-3 d-flex flex-column">
              <div className="d-flex justify-content-between align-items-center mb-3">
                <h6 className="fw-bold text-primary m-0" style={{ fontSize: '12px' }}>🔵 DESPACHOS A PUEBLOS</h6>
                <button className="btn btn-sm btn-outline-primary py-0 px-2 fw-bold" onClick={agregarDespachoManual}>+</button>
              </div>
              <div className="flex-grow-1 overflow-auto" style={{ maxHeight: '250px' }}>
                {despachos.map(d => (
                  <div key={d.id} className="mb-3 pb-2 border-bottom d-flex justify-content-between align-items-center">
                    <div className="pe-2"><strong className="d-block text-dark small">{d.nombre}</strong><span className="text-muted" style={{ fontSize: '11px' }}>{d.detalle}</span></div>
                    <button className="btn p-0 text-primary rounded-circle border border-primary d-flex align-items-center justify-content-center" style={{ width: '22px', height: '22px' }} onClick={() => setDespachos(despachos.filter(x => x.id !== d.id))}>✓</button>
                  </div>
                ))}
                {despachos.length === 0 && <span className="small text-muted">No hay despachos logísticos pendientes.</span>}
              </div>
            </div>
          </div>
        </div>

        <div className="col">
          <div className="card border-0 shadow-sm h-100" style={{ borderTop: '4px solid #fd7e14', borderRadius: '10px' }}>
            <div className="card-body p-3 d-flex flex-column">
              <div className="d-flex justify-content-between align-items-center mb-3">
                <h6 className="fw-bold text-warning m-0" style={{ fontSize: '12px', color: '#fd7e14' }}>🟠 RECORDATORIOS</h6>
                <button className="btn btn-sm btn-outline-warning py-0 px-2 fw-bold text-dark" onClick={agregarRecordatorioManual}>+</button>
              </div>
              <div className="flex-grow-1 overflow-auto" style={{ maxHeight: '250px' }}>
                {recordatorios.map(r => (
                  <div key={r.id} className="mb-3 pb-2 border-bottom d-flex justify-content-between align-items-center">
                    <div className="pe-2"><strong className="d-block text-dark small">{r.nombre}</strong><span className="text-muted" style={{ fontSize: '11px' }}>{r.detalle}</span></div>
                    <button className="btn p-0 text-warning rounded-circle border border-warning d-flex align-items-center justify-content-center" style={{ width: '22px', height: '22px' }} onClick={() => setRecordatorios(recordatorios.filter(x => x.id !== r.id))}>✓</button>
                  </div>
                ))}
                {recordatorios.length === 0 && <span className="small text-muted">No hay recordatorios activos.</span>}
              </div>
            </div>
          </div>
        </div>

        <div className="col">
          <div className="card border-0 shadow-sm h-100" style={{ borderTop: '4px solid #198754', borderRadius: '10px', cursor: 'pointer' }} onClick={() => setVistaActual('WHATSAPP')}>
            <div className="card-body p-3">
              <div className="d-flex justify-content-between align-items-center mb-3">
                <h6 className="fw-bold text-success m-0" style={{ fontSize: '12px' }}>🟢 MONITOREO WHATSAPP</h6><span className="fs-5">📱</span>
              </div>
              <div className="mb-3 border-bottom pb-2">
                <div className="d-flex justify-content-between align-items-center">
                  <div><strong className="d-block text-dark small">Sin Asignar (Pendientes)</strong><span className="text-muted" style={{ fontSize: '11px' }}>Requieren atención inmediata</span></div>
                  <span className="badge bg-danger rounded-circle p-2">{chatsPendientes}</span>
                </div>
              </div>
              <div className="mt-4 text-center"><span className="text-success small fw-bold">Abrir Central Multi-Agente ➔</span></div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}