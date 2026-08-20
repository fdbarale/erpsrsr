import { create } from 'zustand';

export const useMostradorStore = create((set, get) => ({
  carrito: [],
  
  // Acciones del Carrito
  agregarItem: (repuesto, precioFinalACobrar, esManual = false) => set((state) => ({
    carrito: [...state.carrito, { 
      ...repuesto, 
      precio: precioFinalACobrar, 
      cantidad: 1, 
      esManual 
    }]
  })),

  eliminarItem: (index) => set((state) => {
    const nuevoCarrito = [...state.carrito];
    nuevoCarrito.splice(index, 1);
    return { carrito: nuevoCarrito };
  }),

  cambiarCantidad: (index, cantidad) => set((state) => {
    const nuevoCarrito = [...state.carrito];
    nuevoCarrito[index].cantidad = cantidad;
    return { carrito: nuevoCarrito };
  }),

  cambiarDatoManual: (index, campo, valor) => set((state) => {
    const nuevoCarrito = [...state.carrito];
    nuevoCarrito[index][campo] = valor;
    return { carrito: nuevoCarrito };
  }),

  vaciarCarrito: () => set({ carrito: [] }),
  setCarritoCompleto: (nuevoCarrito) => set({ carrito: nuevoCarrito }),

  // Totales calculados al vuelo
  obtenerTotales: () => {
    const { carrito } = get();
    const totalVenta = carrito.reduce((acum, item) => acum + ((Number(item.precio) || 0) * (Number(item.cantidad) || 0)), 0);
    const totalArticulos = carrito.reduce((acum, item) => acum + (Number(item.cantidad) || 0), 0);
    return { totalVenta, totalArticulos };
  }
}));