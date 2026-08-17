import React, { useState, useRef, useEffect } from 'react';
import FacturacionModal from './FacturacionModal';
import PresupuestoModal from './PresupuestoModal';

const CONFIG_MARGEN_MAXIMO_PORCENTAJE = 20;
const LISTA_FILTROS = ['LOCAL', 'TODOS', 'Bálsamo', 'VMG', 'SKF', 'Arteb'];

export default function Mostrador({
  baseDatos,
  setBaseDatos,
  carrito,
  setCarrito,
  abrirFacturacionInicial,
  desactivarFacturacionInicial,
  volverAlMenu,
}) {
  const [textoBusqueda, setTextoBusqueda] = useState('');
  const [modoFiltro, setModoFiltro] = useState('LOCAL');
  const [faseBusqueda, setFaseBusqueda] = useState('BUSQUEDA');
  const [resultados, setResultados] = useState([]);
  const [listaEquivalencias, setListaEquivalencias] = useState([]);
  const [opcionesPrecio, setOpcionesPrecio] = useState([]);
  const [indiceFoco, setIndiceFoco] = useState(-1);
  const [indiceSubFoco, setIndiceSubFoco] = useState(-1);
  const [indicePrecioFoco, setIndicePrecioFoco] = useState(-1);
  const [itemPendiente, setItemPendiente] = useState(null);
  const [mostrarFacturacion, setMostrarFacturacion] = useState(false);
  const [mostrarPresupuesto, setMostrarPresupuesto] = useState(false);

  const buscadorRef = useRef(null);
  const cantidadesRef = useRef([]);
  const preciosRef = useRef([]);
  const listaResultadosRef = useRef(null);

  const colorBordo = '#6B1116';
  const colorGris = '#54565b';

  useEffect(() => {
    if (abrirFacturacionInicial) {
      setMostrarFacturacion(true);
      desactivarFacturacionInicial();
    }
  }, [abrirFacturacionInicial, desactivarFacturacionInicial]);

  useEffect(() => {
    if (!textoBusqueda.trim()) {
      setResultados([]);
      return;
    }
    const terminos = textoBusqueda.toLowerCase().trim().split(/\s+/);
    const filtrados = baseDatos.filter((item) => {
      if (modoFiltro === 'LOCAL') {
        if (!item.codigo_aux && item.stock <= 0) return false;
      } else if (modoFiltro !== 'TODOS') {
        if (item.distribuidor !== modoFiltro) return false;
      }
      const textoCompleto = `${item.cod} ${item.desc} ${item.codigo_aux || ''} ${item.distribuidor}`.toLowerCase();
      return terminos.every((termino) => textoCompleto.includes(termino));
    });
    setResultados(filtrados);
  }, [textoBusqueda, modoFiltro, baseDatos]);

  const vaciarCarrito = () => {
    if (carrito.length === 0) return;
    if (window.confirm('¿Seguro que desea vaciar todo el carrito?')) {
      setCarrito([]);
      limpiarBuscador();
    }
  };

  useEffect(() => {
    const atajosTeclado = (e) => {
      if (mostrarFacturacion || mostrarPresupuesto) return;
      if (e.key === 'F5') {
        e.preventDefault();
        cargaManual();
      } else if (e.key === 'F4') {
        e.preventDefault();
        vaciarCarrito();
      } else if (e.key === 'F3') {
        e.preventDefault();
        setModoFiltro((prev) => {
          const currentIndex = LISTA_FILTROS.indexOf(prev);
          const nextIndex = (currentIndex + 1) % LISTA_FILTROS.length;
          return LISTA_FILTROS[nextIndex];
        });
      } else if (e.key === 'F12') {
        e.preventDefault();
        if (carrito.length > 0) setMostrarFacturacion(true);
      } else if (e.key === 'F9') {
        e.preventDefault();
        if (carrito.length > 0) setMostrarPresupuesto(true);
      }
    };
    window.addEventListener('keydown', atajosTeclado);
    return () => window.removeEventListener('keydown', atajosTeclado);
  }, [textoBusqueda, carrito, faseBusqueda, mostrarFacturacion, mostrarPresupuesto]);

  useEffect(() => {
    let idx = -1;
    if (faseBusqueda === 'BUSQUEDA') idx = indiceFoco;
    else if (faseBusqueda === 'EQUIVALENCIAS') idx = indiceSubFoco;
    else if (faseBusqueda === 'PRECIOS') idx = indicePrecioFoco;

    if (idx >= 0 && listaResultadosRef.current) {
      const itemActivo = listaResultadosRef.current.children[idx];
      if (itemActivo) itemActivo.scrollIntoView({ block: 'nearest' });
    }
  }, [indiceFoco, indiceSubFoco, indicePrecioFoco, faseBusqueda]);

  const formatoMoneda = (valor) => '$ ' + Math.round(parseFloat(valor) || 0).toLocaleString('es-AR');

  const manejarBusqueda = (e) => {
    setTextoBusqueda(e.target.value);
    setFaseBusqueda('BUSQUEDA');
    setIndiceFoco(-1);
    setListaEquivalencias([]);
    setOpcionesPrecio([]);
    setItemPendiente(null);
  };

  const actualizarCantidadPedido = (cod, incremento) => {
    const modificarItem = (lista) => lista.map((item) => {
      if (item.cod === cod) return { ...item, cant_pendiente: Math.max(0, (item.cant_pendiente || 0) + incremento) };
      return item;
    });
    setBaseDatos((prev) => modificarItem(prev));
    if (faseBusqueda === 'EQUIVALENCIAS') setListaEquivalencias((prev) => modificarItem(prev));
  };

  const manejarTecladoBuscador = (e) => {
    if (e.key === 'Escape' && faseBusqueda === 'BUSQUEDA') {
      e.preventDefault();
      if (textoBusqueda) setTextoBusqueda('');
      else if (carrito.length === 0) volverAlMenu();
      return;
    }

    if (e.key === 'Insert' || e.key === 'Delete') {
      const incremento = e.key === 'Insert' ? 1 : -1;
      if (faseBusqueda === 'BUSQUEDA' && indiceFoco >= 0 && resultados[indiceFoco]) {
        e.preventDefault();
        actualizarCantidadPedido(resultados[indiceFoco].cod, incremento);
      } else if (faseBusqueda === 'EQUIVALENCIAS' && indiceSubFoco >= 0 && listaEquivalencias[indiceSubFoco]) {
        e.preventDefault();
        actualizarCantidadPedido(listaEquivalencias[indiceSubFoco].cod, incremento);
      }
      return;
    }

    if (faseBusqueda === 'BUSQUEDA') {
      if (resultados.length === 0) return;
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setIndiceFoco((prev) => (prev < resultados.length - 1 ? prev + 1 : prev));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setIndiceFoco((prev) => (prev > 0 ? prev - 1 : -1));
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        if (indiceFoco >= 0 && resultados[indiceFoco]) {
          const itemActual = resultados[indiceFoco];
          if (!itemActual.codigo_aux) return;
          const equivalentes = baseDatos.filter((i) => i.codigo_aux === itemActual.codigo_aux);
          if (equivalentes.length > 1) {
            setListaEquivalencias(equivalentes);
            setFaseBusqueda('EQUIVALENCIAS');
            setIndiceSubFoco(0);
          }
        }
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (indiceFoco >= 0 && resultados[indiceFoco]) procesarSeleccionArticulo(resultados[indiceFoco]);
        else if (resultados.length > 0) procesarSeleccionArticulo(resultados[0]);
      }
    } else if (faseBusqueda === 'EQUIVALENCIAS') {
      if (listaEquivalencias.length === 0) return;
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setIndiceSubFoco((prev) => (prev < listaEquivalencias.length - 1 ? prev + 1 : prev));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setIndiceSubFoco((prev) => (prev > 0 ? prev - 1 : 0));
      } else if (e.key === 'ArrowLeft' || e.key === 'Escape') {
        e.preventDefault();
        setFaseBusqueda('BUSQUEDA');
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (indiceSubFoco >= 0 && listaEquivalencias[indiceSubFoco]) iniciarSeleccionDePrecio(listaEquivalencias[indiceSubFoco]);
      }
    } else if (faseBusqueda === 'PRECIOS') {
      if (opcionesPrecio.length === 0) return;
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setIndicePrecioFoco((prev) => (prev < opcionesPrecio.length - 1 ? prev + 1 : prev));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setIndicePrecioFoco((prev) => (prev > 0 ? prev - 1 : 0));
      } else if (e.key === 'ArrowLeft' || e.key === 'Escape') {
        e.preventDefault();
        setFaseBusqueda('EQUIVALENCIAS');
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (indicePrecioFoco >= 0 && opcionesPrecio[indicePrecioFoco]) confirmarAgregarAlCarrito(itemPendiente, opcionesPrecio[indicePrecioFoco].precio);
      }
    }
  };

  const procesarSeleccionArticulo = (repuesto) => confirmarAgregarAlCarrito(repuesto, repuesto.precio);

  const iniciarSeleccionDePrecio = (repuestoElegido) => {
    setItemPendiente(repuestoElegido);
    const primos = baseDatos.filter((i) => i.codigo_aux === repuestoElegido.codigo_aux);
    const precioMaximo = Math.max(...primos.map((p) => p.precio));
    const limitePermitido = precioMaximo * (1 + CONFIG_MARGEN_MAXIMO_PORCENTAJE / 100);
    const opciones = primos
      .map((p) => ({
        distribuidor: p.distribuidor,
        precio: p.precio,
        cod: p.cod,
        stock: p.stock,
        cant_en_camino: p.cant_en_camino,
        cant_pendiente: p.cant_pendiente,
      }))
      .filter((o) => o.precio <= limitePermitido)
      .sort((a, b) => b.precio - a.precio);

    setOpcionesPrecio(opciones);
    setFaseBusqueda('PRECIOS');
    setIndicePrecioFoco(0);
  };

  const confirmarAgregarAlCarrito = (repuesto, precioFinal) => {
    const nuevoCarrito = [...carrito, { ...repuesto, precio: precioFinal, cantidad: 1, esManual: false }];
    setCarrito(nuevoCarrito);
    limpiarBuscador();
    const nuevoIndice = nuevoCarrito.length - 1;
    setTimeout(() => {
      if (cantidadesRef.current[nuevoIndice]) {
        cantidadesRef.current[nuevoIndice].focus();
        cantidadesRef.current[nuevoIndice].select();
      }
    }, 50);
  };

  const limpiarBuscador = () => {
    setTextoBusqueda('');
    setIndiceFoco(-1);
    setFaseBusqueda('BUSQUEDA');
    setListaEquivalencias([]);
    setOpcionesPrecio([]);
    setItemPendiente(null);
  };

  const cargaManual = () => {
    const descManual = textoBusqueda.trim().toUpperCase() || 'ARTÍCULO VARIOS';
    const nuevoItem = { cod: 'MANUAL', desc: descManual, precio: 0, cantidad: 1, esManual: true };
    const nuevoCarrito = [...carrito, nuevoItem];
    setCarrito(nuevoCarrito);
    limpiarBuscador();
    const nuevoIndice = nuevoCarrito.length - 1;
    setTimeout(() => {
      if (cantidadesRef.current[nuevoIndice]) {
        cantidadesRef.current[nuevoIndice].focus();
        cantidadesRef.current[nuevoIndice].select();
      }
    }, 50);
  };

  const eliminarDelCarrito = (index) => {
    const nuevoCarrito = [...carrito];
    nuevoCarrito.splice(index, 1);
    setCarrito(nuevoCarrito);
    buscadorRef.current?.focus();
  };

  const cambiarCantidad = (index, nuevoValor) => {
    const nuevoCarrito = [...carrito];
    nuevoCarrito[index].cantidad = nuevoValor;
    setCarrito(nuevoCarrito);
  };

  const cambiarDatoManual = (index, campo, valor) => {
    const nuevoCarrito = [...carrito];
    nuevoCarrito[index][campo] = valor;
    setCarrito(nuevoCarrito);
  };

  const manejarTecladoCantidad = (e, index, esManual) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (!carrito[index].cantidad) cambiarCantidad(index, 1);
      if (esManual) {
        preciosRef.current[index]?.focus();
        preciosRef.current[index]?.select();
      } else {
        buscadorRef.current?.focus();
      }
    }
  };

  const manejarTecladoPrecio = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      buscadorRef.current?.focus();
    }
  };

  const renderIconoPedido = (item) => {
    return (
      <div className="d-inline-flex ms-2 gap-1 align-items-center flex-nowrap">
        {item.cant_en_camino > 0 && (
          <span className="badge text-warning border border-warning px-1" style={{ fontSize: '0.75rem' }}>
            🚚 {item.cant_en_camino}
          </span>
        )}
        {item.cant_pendiente > 0 && (
          <span className="badge text-info border border-info px-1" style={{ fontSize: '0.75rem' }}>
            🛒 {item.cant_pendiente}
          </span>
        )}
      </div>
    );
  };

  const renderInsigniaStock = (stock) => {
    return stock > 0 ? (
      <span className="badge bg-success bg-opacity-10 text-success border border-success mx-2" style={{ fontSize: '0.75rem' }}>
        Stock: {stock}
      </span>
    ) : (
      <span className="badge bg-danger bg-opacity-10 text-danger border border-danger mx-2" style={{ fontSize: '0.75rem' }}>
        Stock: {stock}
      </span>
    );
  };

  const totalVenta = carrito.reduce((acum, item) => acum + (Number(item.precio) || 0) * (Number(item.cantidad) || 0), 0);
  const totalArticulos = carrito.reduce((acum, item) => acum + (Number(item.cantidad) || 0), 0);
  const colorFiltro = modoFiltro === 'LOCAL' ? 'bg-success' : modoFiltro === 'TODOS' ? 'bg-dark' : 'bg-secondary';

  // Función limpiada: Solo vacía carrito y oculta modal
  const manejarCierreYVaciado = () => {
    setCarrito([]);
    setMostrarFacturacion(false);
    setMostrarPresupuesto(false);
    setTimeout(() => {
      buscadorRef.current?.focus();
    }, 100);
  };

  return (
    <div className="bg-light min-vh-100 d-flex flex-column" style={{ maxWidth: '100%', overflowX: 'hidden' }}>
      
      {/* MODAL FACTURACIÓN */}
      {mostrarFacturacion && (
        <FacturacionModal
          carrito={carrito}
          totalCarrito={totalVenta}
          cerrar={() => setMostrarFacturacion(false)}
          vaciarYConfirmar={manejarCierreYVaciado}
        />
      )}

      {/* MODAL PRESUPUESTO */}
      {mostrarPresupuesto && (
        <PresupuestoModal
          carrito={carrito}
          totalCarrito={totalVenta}
          cerrar={() => setMostrarPresupuesto(false)}
          vaciarYConfirmar={manejarCierreYVaciado}
        />
      )}

      <nav className="navbar navbar-dark shadow-sm px-3" style={{ backgroundColor: colorBordo, borderBottom: `4px solid ${colorGris}` }}>
        <div className="container-fluid p-0">
          <div className="d-flex align-items-center">
            <button className="btn btn-sm btn-outline-light me-3 fw-bold" onClick={volverAlMenu} tabIndex="-1">
              ⬅ Menú (Esc)
            </button>
            <span className="navbar-brand fw-bold m-0 tracking-wide">RSR - Mostrador Ágil</span>
          </div>
          <div className="d-flex text-white align-items-center">
            <span className="me-3 fs-6">👤 Fer / Guille</span>
          </div>
        </div>
      </nav>

      <div className="container-fluid px-3 mt-3 flex-grow-1">
        <div className="row h-100">
          <div className="col-lg-9 col-xl-10">
            <div className="d-flex mb-3 position-relative">
              <div className="w-100 position-relative d-flex align-items-center bg-white border shadow-sm rounded-pill px-2" style={{ borderColor: '#ced4da', zIndex: 1060 }}>
                <span className={`badge ${colorFiltro} ms-2 rounded-pill`} style={{ cursor: 'pointer', padding: '0.4em 0.8em' }} onClick={() => setModoFiltro('LOCAL')}>
                  [F3] {modoFiltro}
                </span>
                <input
                  type="text"
                  className="form-control border-0 shadow-none bg-transparent"
                  placeholder="🔎 Buscar artículo... (Enter: Cargar | F3: Filtro | F5: Manual | Ins/Supr: Pedidos)"
                  value={textoBusqueda}
                  onChange={manejarBusqueda}
                  onKeyDown={manejarTecladoBuscador}
                  ref={buscadorRef}
                  autoComplete="off"
                />
              </div>

              {resultados.length > 0 && (
                <div className="position-absolute w-100 shadow-lg bg-white rounded-3" style={{ top: '110%', left: '0', zIndex: 1050, border: '1px solid #e9ecef', overflow: 'hidden' }}>
                  {faseBusqueda === 'BUSQUEDA' && (
                    <ul ref={listaResultadosRef} className="list-group list-group-flush" style={{ maxHeight: '400px', overflowY: 'auto' }}>
                      {resultados.map((item, idx) => {
                        const esActivo = indiceFoco === idx;
                        const tienePrimos = item.codigo_aux && baseDatos.filter((i) => i.codigo_aux === item.codigo_aux).length > 1;
                        return (
                          <li key={idx} className="list-group-item d-flex justify-content-between align-items-center py-2 border-bottom" onClick={() => procesarSeleccionArticulo(item)} style={{ cursor: 'pointer', borderLeft: esActivo ? `4px solid ${colorBordo}` : '4px solid transparent', backgroundColor: esActivo ? '#d0e7ff' : 'transparent' }}>
                            <div className="d-flex align-items-center w-75">
                              <strong className={`font-monospace ${esActivo ? 'text-dark' : 'text-primary'}`}>{item.cod}</strong>
                              <span className={`ms-2 text-truncate ${esActivo ? 'fw-bold text-dark' : 'fw-semibold text-secondary'}`}>{item.desc}</span>
                              {item.codigo_aux ? (
                                <span className="ms-auto d-flex align-items-center flex-nowrap">
                                  {renderInsigniaStock(item.stock)}
                                  <span className="badge bg-light text-dark border">{item.distribuidor}</span>
                                  {tienePrimos && <span className="badge bg-info bg-opacity-10 text-info border border-info ms-2" style={{ fontSize: '0.75rem' }}>Equivalencias (→)</span>}
                                  {renderIconoPedido(item)}
                                </span>
                              ) : (
                                <span className="badge bg-secondary bg-opacity-10 text-secondary border border-secondary mx-2" style={{ fontSize: '0.75rem' }}>Sin internalizar</span>
                              )}
                            </div>
                            <div className="fw-bold font-monospace w-25 text-end pe-2 text-dark">{formatoMoneda(item.precio)}</div>
                          </li>
                        );
                      })}
                    </ul>
                  )}

                  {faseBusqueda === 'EQUIVALENCIAS' && (
                    <div className="bg-light">
                      <div className="p-2 border-bottom text-muted fw-bold d-flex justify-content-between align-items-center" style={{ backgroundColor: '#e9ecef' }}>
                        <span className="small">⬅ (Izq) Volver</span>
                        <span className="text-dark small fw-bold">Equivalencias Disponibles (Ins/Supr para Pedido directo)</span>
                        <span style={{ width: '80px' }}></span>
                      </div>
                      <ul ref={listaResultadosRef} className="list-group list-group-flush" style={{ maxHeight: '310px', overflowY: 'auto' }}>
                        {listaEquivalencias.map((item, idx) => {
                          const esActivo = indiceSubFoco === idx;
                          return (
                            <li key={idx} className="list-group-item d-flex justify-content-between align-items-center py-2 border-bottom" onClick={() => iniciarSeleccionDePrecio(item)} style={{ cursor: 'pointer', borderLeft: esActivo ? `4px solid ${colorBordo}` : '4px solid transparent', backgroundColor: esActivo ? '#d0e7ff' : 'transparent' }}>
                              <div className="d-flex align-items-center w-75">
                                <strong className={`font-monospace ${esActivo ? 'text-dark' : 'text-primary'}`}>{item.cod}</strong>
                                <span className={`ms-2 text-truncate ${esActivo ? 'fw-bold text-dark' : 'text-secondary'}`}>{item.desc}</span>
                                <div className="ms-auto d-flex align-items-center flex-nowrap">
                                  {renderInsigniaStock(item.stock)}
                                  <span className="badge bg-light text-dark border">{item.distribuidor}</span>
                                  {renderIconoPedido(item)}
                                </div>
                              </div>
                              <div className="fw-bold text-dark font-monospace text-end w-25 pe-2">
                                {formatoMoneda(item.precio)}
                                {esActivo && <span className="d-block text-muted font-sans" style={{ fontSize: '0.65rem' }}>(Enter) Elegir para Cobrar</span>}
                              </div>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  )}

                  {faseBusqueda === 'PRECIOS' && (
                    <div className="bg-light">
                      <div className="p-2 border-bottom fw-bold text-center d-flex flex-column align-items-center" style={{ backgroundColor: '#fff3cd' }}>
                        <span className="small text-dark">
                          Entregando físico: <strong>{itemPendiente?.cod} ({itemPendiente?.distribuidor})</strong>
                        </span>
                        <span className="small text-secondary mt-1" style={{ fontSize: '0.75rem' }}>Seleccione el precio de lista que desea aplicarle a este despacho</span>
                      </div>
                      <ul ref={listaResultadosRef} className="list-group list-group-flush" style={{ maxHeight: '310px', overflowY: 'auto' }}>
                        {opcionesPrecio.map((opcion, idx) => {
                          const esActivo = indicePrecioFoco === idx;
                          return (
                            <li key={idx} className="list-group-item d-flex justify-content-between align-items-center py-2 border-bottom" onClick={() => confirmarAgregarAlCarrito(itemPendiente, opcion.precio)} style={{ cursor: 'pointer', borderLeft: esActivo ? '4px solid #ffc107' : '4px solid transparent', backgroundColor: esActivo ? '#ffebb3' : 'transparent' }}>
                              <div className="d-flex align-items-center w-75">
                                <span className={`small ${esActivo ? 'text-dark fw-bold' : 'text-secondary'}`}>Aplicar precio de lista de: </span>
                                <strong className="font-monospace text-dark ms-2">{opcion.cod}</strong>
                                <span className="badge bg-light text-dark border ms-2">{opcion.distribuidor}</span>
                                <div className="ms-auto d-flex align-items-center flex-nowrap">
                                  {renderInsigniaStock(opcion.stock)}
                                  {renderIconoPedido(opcion)}
                                </div>
                              </div>
                              <div className="fw-bold fs-5 text-dark font-monospace w-25 text-end pe-2">{formatoMoneda(opcion.precio)}</div>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="card border shadow-sm rounded-3">
              <div className="card-body p-0">
                <table className="table table-borderless table-hover mb-0 align-middle w-100">
                  <thead style={{ backgroundColor: '#f8f9fa', borderBottom: '2px solid #dee2e6' }}>
                    <tr className="text-secondary text-uppercase fw-bold" style={{ fontSize: '0.8rem' }}>
                      <th style={{ width: '15%' }} className="ps-3 py-2">Código</th>
                      <th style={{ width: '45%' }} className="py-2">Descripción</th>
                      <th style={{ width: '10%' }} className="text-center py-2">Cant.</th>
                      <th style={{ width: '12%' }} className="text-end py-2">Unitario</th>
                      <th style={{ width: '15%' }} className="text-end pe-3 py-2">Subtotal</th>
                      <th style={{ width: '3%' }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {carrito.length === 0 ? (
                      <tr>
                        <td colSpan="6" className="text-center text-muted py-4">
                          <span className="d-block fs-2 mb-1 opacity-25">🛒</span>
                          El carrito está vacío.
                        </td>
                      </tr>
                    ) : (
                      carrito.map((item, index) => (
                        <tr key={index} className="border-bottom">
                          <td className="fw-bold font-monospace text-primary ps-3">{item.cod}</td>
                          <td>
                            {item.esManual ? (
                              <input type="text" className="form-control form-control-sm border-0 bg-light fw-bold w-100" value={item.desc} onChange={(e) => cambiarDatoManual(index, 'desc', e.target.value)} />
                            ) : (
                              <span className="fw-semibold text-dark">{item.desc}</span>
                            )}
                          </td>
                          <td className="text-center">
                            <input type="number" className="form-control form-control-sm text-center font-monospace fw-bold bg-light mx-auto" style={{ maxWidth: '70px' }} value={item.cantidad} onChange={(e) => cambiarCantidad(index, e.target.value)} onKeyDown={(e) => manejarTecladoCantidad(e, index, item.esManual)} ref={(el) => (cantidadesRef.current[index] = el)} />
                          </td>
                          <td className="text-end">
                            {item.esManual ? (
                              <div className="input-group input-group-sm justify-content-end">
                                <span className="input-group-text bg-transparent border-0 text-success fw-bold pe-1 px-1">$</span>
                                <input type="number" className="form-control form-control-sm text-end font-monospace fw-bold text-success bg-light" style={{ maxWidth: '80px' }} value={item.precio || ''} onChange={(e) => cambiarDatoManual(index, 'precio', e.target.value)} onKeyDown={manejarTecladoPrecio} ref={(el) => (preciosRef.current[index] = el)} />
                              </div>
                            ) : (
                              <span className="font-monospace text-secondary">{formatoMoneda(item.precio)}</span>
                            )}
                          </td>
                          <td className="text-end fw-bold font-monospace text-dark pe-3">
                            {formatoMoneda((Number(item.precio) || 0) * (Number(item.cantidad) || 0))}
                          </td>
                          <td className="text-end pe-2">
                            <button className="btn btn-sm text-danger opacity-50 p-1" tabIndex="-1" onClick={() => eliminarDelCarrito(index)}>✖</button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div className="col-lg-3 col-xl-2">
            <div className="card border shadow-sm rounded-3 bg-white mb-2">
              <div className="card-body p-3 text-center">
                <h6 className="text-uppercase text-secondary fw-bold mb-1 small">Total Carrito</h6>
                <h2 className="fw-bolder text-dark mb-0 font-monospace">{formatoMoneda(totalVenta)}</h2>
                <hr className="text-muted my-2" />
                <div className="d-flex justify-content-between text-secondary mb-2" style={{ fontSize: '0.75rem' }}>
                  <span>Artículos: </span><strong className="text-dark">{totalArticulos}</strong>
                </div>
                <div className="d-grid gap-2">
                  <button className="btn btn-sm fw-bold py-2 text-white shadow-sm" style={{ backgroundColor: colorBordo, borderRadius: '6px' }} tabIndex="-1" onClick={() => { if (carrito.length > 0) setMostrarFacturacion(true); }} disabled={carrito.length === 0}>💳 Facturar (F12)</button>
                  <button className="btn btn-sm btn-light border-secondary border-opacity-25 fw-bold py-2 text-dark shadow-sm" style={{ borderRadius: '6px' }} tabIndex="-1" onClick={() => { if (carrito.length > 0) setMostrarPresupuesto(true); }} disabled={carrito.length === 0}>📝 Presupuestar (F9)</button>
                  <button className="btn btn-sm btn-white border fw-bold py-2 text-secondary shadow-sm" style={{ borderRadius: '6px' }} tabIndex="-1" disabled>👥 Cuentas Corrientes</button>
                  <button className="btn btn-sm btn-white border fw-bold py-2 text-secondary shadow-sm" style={{ borderRadius: '6px' }} tabIndex="-1" disabled>📦 Gestión de Stock</button>
                  <button className="btn btn-sm btn-link text-danger text-decoration-none fw-semibold p-0 mt-1 small" tabIndex="-1" onClick={vaciarCarrito}>🗑 Vaciar Carrito (F4)</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}