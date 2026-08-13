import { create } from 'zustand';

export const useOperativoStore = create((set) => ({
  pagos: [],
  despachos: [],
  recordatorios: [],
  chatsWhatsapp: [
    { id: '5492954112233', nombre: 'Taller Macachín', asignadoA: null, estado: 'PENDIENTE', ultimoMensaje: '¿Tienen la bomba?' },
    { id: '5492954998877', nombre: 'Juan Pérez (Cliente)', asignadoA: 'Nacho', estado: 'EN_ATENCION', ultimoMensaje: 'Paso a la tarde' }
  ],
  chatActivo: null,

  // Acciones de Dashboard
  agregarPago: (nombre, detalle, monto) =>
    set((state) => ({ pagos: [...state.pagos, { id: Date.now(), nombre, detalle, monto, color: 'danger' }] })),
  eliminarPago: (id) => set((state) => ({ pagos: state.pagos.filter(p => p.id !== id) })),
  
  agregarDespacho: (nombre, detalle) =>
    set((state) => ({ despachos: [...state.despachos, { id: Date.now(), nombre, detalle }] })),
  eliminarDespacho: (id) => set((state) => ({ despachos: state.despachos.filter(d => d.id !== id) })),
  
  agregarRecordatorio: (nombre, detalle) =>
    set((state) => ({ recordatorios: [...state.recordatorios, { id: Date.now(), nombre, detalle }] })),
  eliminarRecordatorio: (id) => set((state) => ({ recordatorios: state.recordatorios.filter(r => r.id !== id) })),

  // Acciones WhatsApp
  asignarChat: (chatId, empleado) => set((state) => ({
    chatsWhatsapp: state.chatsWhatsapp.map(c => c.id === chatId ? { ...c, asignadoA: empleado, estado: empleado ? 'EN_ATENCION' : 'PENDIENTE' } : c),
    chatActivo: state.chatActivo?.id === chatId ? { ...state.chatActivo, asignadoA: empleado, estado: empleado ? 'EN_ATENCION' : 'PENDIENTE' } : state.chatActivo
  })),
  
  cerrarChat: (chatId) => set((state) => ({
    chatsWhatsapp: state.chatsWhatsapp.map(c => c.id === chatId ? { ...c, estado: 'RESUELTO' } : c),
    chatActivo: state.chatActivo?.id === chatId ? null : state.chatActivo
  })),
  
  setChatActivo: (chat) => set({ chatActivo: chat })
}));