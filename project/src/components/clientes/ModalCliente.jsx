import React, { useState } from 'react';
import { dbOficial } from '../../supabaseClient';

export default function ModalCliente({ cerrar, recargarLista }) {
  const [datos, setDatos] = useState({
    nombre: '',
    cuit: '',
    sobrenombre: '',
    cuenta_corriente_activa: false,
    condicionIva: 'Consumidor Final',
    direccion: '',
    telefono: '',
    email: ''
  });
  
  const [buscandoAfip, setBuscandoAfip] = useState(false);
  const [guardando, setGuardando] = useState(false);

  const consultarAfip = async () => {
    if (!datos.cuit || datos.cuit.length < 7) {
      return alert('Ingresá un CUIT o DNI válido primero.');
    }
    
    setBuscandoAfip(true);
    // ACA VA EL FETCH A TU API O PUENTE DE AFIP
    // Simulo un delay de red para que veas cómo funciona visualmente
    setTimeout(() => {
      alert('⚠️ Faltaría conectar un servicio/API que haga de puente con AFIP (Ej: MiAfip, CuitOnline, o un backend propio). Por ahora cargalo manual.');
      setBuscandoAfip(false);
    }, 1000);
  };

  const guardarCliente = async (e) => {
    e.preventDefault();
    if (!datos.nombre.trim()) return alert('El nombre es obligatorio.');

    setGuardando(true);
    
    // Le clavamos frecuencia_uso en 0 al nacer, y los saldos en 0
    const payload = {
      ...datos,
      frecuencia_uso: 0,
      saldo_fiscal: 0,
      saldo_interno: 0
    };

    const { error } = await dbOficial.from('clientes').insert([payload]);
    
    if (error) {
      alert('Error al guardar: ' + error.message);
      setGuardando(false);
    } else {
      recargarLista();
      cerrar();
    }
  };

  return (
    <div className="position-fixed top-0 start-0 w-100 h-100 bg-dark bg-opacity-75 d-flex justify-content-center align-items-center" style={{ zIndex: 1050 }}>
      <div className="card shadow-lg" style={{ width: '600px', borderRadius: '12px' }}>
        <div className="card-header bg-primary text-white fw-bold d-flex justify-content-between">
          <span>➕ Alta de Cliente</span>
          <button className="btn-close btn-close-white" onClick={cerrar}></button>
        </div>
        <div className="card-body bg-light">
          
          <div className="alert alert-info border-info small mb-3">
            <div className="d-flex gap-2">
              <input 
                type="text" 
                className="form-control form-control-sm font-monospace" 
                placeholder="CUIT o DNI para buscar..." 
                value={datos.cuit}
                onChange={e => setDatos({...datos, cuit: e.target.value.replace(/[^0-9]/g, '')})}
              />
              <button 
                className="btn btn-sm btn-info text-white fw-bold w-50" 
                onClick={consultarAfip}
                disabled={buscandoAfip}
              >
                {buscandoAfip ? 'Buscando...' : '🔍 Auto-completar AFIP'}
              </button>
            </div>
          </div>

          <form onSubmit={guardarCliente}>
            <div className="row mb-3">
              <div className="col-12 mb-2">
                <label className="form-label small fw-bold text-muted">Nombre / Razón Social *</label>
                <input type="text" className="form-control fw-bold" value={datos.nombre} onChange={e => setDatos({...datos, nombre: e.target.value})} required autoFocus />
              </div>
              
              <div className="col-6 mb-2">
                <label className="form-label small fw-bold text-muted">Sobrenombre (Fantasía)</label>
                <input type="text" className="form-control" value={datos.sobrenombre} onChange={e => setDatos({...datos, sobrenombre: e.target.value})} placeholder="Ej: El Tano" />
              </div>
              
              <div className="col-6 mb-2">
                <label className="form-label small fw-bold text-muted">Condición IVA</label>
                <select className="form-select" value={datos.condicionIva} onChange={e => setDatos({...datos, condicionIva: e.target.value})}>
                  <option value="Consumidor Final">Consumidor Final</option>
                  <option value="Responsable Inscripto">Responsable Inscripto</option>
                  <option value="Monotributo">Monotributo</option>
                  <option value="Exento">Exento</option>
                </select>
              </div>

              <div className="col-6 mb-2">
                <label className="form-label small fw-bold text-muted">Teléfono</label>
                <input type="text" className="form-control" value={datos.telefono} onChange={e => setDatos({...datos, telefono: e.target.value})} />
              </div>
              
              <div className="col-6 mb-2">
                <label className="form-label small fw-bold text-muted">Dirección</label>
                <input type="text" className="form-control" value={datos.direccion} onChange={e => setDatos({...datos, direccion: e.target.value})} />
              </div>
            </div>

            <div className="border rounded p-3 bg-white mb-4">
              <div className="form-check form-switch">
                <input 
                  className="form-check-input" 
                  type="checkbox" 
                  id="switchActivarCta" 
                  checked={datos.cuenta_corriente_activa}
                  onChange={e => setDatos({...datos, cuenta_corriente_activa: e.target.checked})}
                />
                <label className="form-check-label fw-bold text-success" htmlFor="switchActivarCta">
                  Habilitar Cuenta Corriente
                </label>
              </div>
              <small className="text-muted d-block mt-1">Permite enviarle saldos y registrar deudas en mostrador.</small>
            </div>

            <div className="d-flex justify-content-end gap-2">
              <button type="button" className="btn btn-outline-secondary fw-bold" onClick={cerrar} disabled={guardando}>Cancelar</button>
              <button type="submit" className="btn btn-primary fw-bold px-4" disabled={guardando}>
                {guardando ? 'Guardando...' : 'Guardar Cliente'}
              </button>
            </div>
          </form>

        </div>
      </div>
    </div>
  );
}