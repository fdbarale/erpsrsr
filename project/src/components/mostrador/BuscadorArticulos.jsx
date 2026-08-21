import React, { useState, useEffect, useRef } from 'react';
import { buscarArticulosLocal, buscarEquivalenciasLocal, obtenerArticuloLocal, actualizarArticuloLocal, precargarCatalogoEnRAM } from '../../utils/dbLocal';
import { useMostradorStore } from '../../stores/useMostradorStore';
import { dbOficial } from '../../supabaseClient';

const CONFIG_MARGEN_MAXIMO_PORCENTAJE = 20;

export default function BuscadorArticulos({ setModalPedido }) {
  const { agregarItem } = useMostradorStore();
  
  const [textoBusqueda, setTextoBusqueda] = useState('');
  const [modoFiltro, setModoFiltro] = useState('LOCAL');
  const [faseBusqueda, setFaseBusqueda] = useState('BUSQUEDA');
  
  const [resultados, setResultados] = useState([]);
  const [listaEquivalencias, setListaEquivalencias] = useState([]);
  const [opcionesPrecio, setOpcionesPrecio] = useState([]);
  
  const [indiceFoco, setIndiceFoco] = useState(-1);
  const [indiceSubFoco, setIndiceSubFoco] = useState(-1);
  const [indicePrecioFoco, setIndicePrecioFoco] = useState(-1);
  const [itemPendienteFisico, setItemPendienteFisico] = useState(null);

  const listaResultadosRef = useRef(null);
  const colorBordo = '#6B1116';
  const colorFiltro = modoFiltro === 'LOCAL' ? 'bg-success' : 'bg-dark';
  const formatoMoneda = (valor) => "$ " + Math.round(parseFloat(valor) || 0).toLocaleString('es-AR');

  useEffect(() => {
    precargarCatalogoEnRAM().catch(console.error);
  }, []);

  // BÚSQUEDA HÍBRIDA: Automática para LOCAL, Manual para TODOS
  useEffect(() => {
    if (modoFiltro === 'TODOS') return; // Si es TODOS, no hace nada automático, espera al Enter

    if (!textoBusqueda.trim()) {
      setResultados([]);
      return;
    }
    
    // Si es LOCAL, hace búsqueda incremental con un delay de 250ms
    const timer = setTimeout(() => {
      ejecutarBusquedaManual();
    }, 250);
    
    return () => clearTimeout(timer);
  }, [textoBusqueda, modoFiltro]);

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

  const ejecutarBusquedaManual = async () => {
    if (!textoBusqueda.trim()) {
      setResultados([]);
      return;
    }
    const filtrados = await buscarArticulosLocal(textoBusqueda, modoFiltro);
    
    const conEquivalenciasReales = await Promise.all(filtrados.map(async (item) => {
      if (!item.codigo_aux) return { ...item, tienePrimosReales: false };
      const eq = await buscarEquivalenciasLocal(item.codigo_aux);
      return { ...item, tienePrimosReales: eq.length > 1 };
    }));

    setResultados(conEquivalenciasReales);
    setFaseBusqueda('BUSQUEDA');
    setIndiceFoco(conEquivalenciasReales.length > 0 ? 0 : -1); 
  };

  const limpiarBuscador = () => {
    setTextoBusqueda('');
    setResultados([]);
    setIndiceFoco(-1);
    setFaseBusqueda('BUSQUEDA');
    setListaEquivalencias([]);
    setOpcionesPrecio([]);
    setItemPendienteFisico(null);
    document.getElementById('input-buscador-mostrador')?.focus();
  };

  const procesarSeleccionArticulo = (repuesto) => confirmarAgregarAlCarrito(repuesto, repuesto.precio);

  const confirmarAgregarAlCarrito = (repuestoFisico, precioFinalACobrar) => {
    agregarItem(repuestoFisico, precioFinalACobrar, false);
    limpiarBuscador();
  };

  const iniciarSeleccionDePrecio = async (repuestoFisicoElegido) => {
    setItemPendienteFisico(repuestoFisicoElegido); 
    const primos = await buscarEquivalenciasLocal(repuestoFisicoElegido.codigo_aux);
    const precioMaximo = Math.max(...primos.map(p => p.precio));
    const limitePermitido = precioMaximo * (1 + (CONFIG_MARGEN_MAXIMO_PORCENTAJE / 100));

    const opciones = primos
      .map(p => ({ ...p }))
      .filter(o => o.precio <= limitePermitido)
      .sort((a, b) => b.precio - a.precio); 

    setOpcionesPrecio(opciones);
    setFaseBusqueda('PRECIOS');
    setIndicePrecioFoco(0);
  };

  const actualizarCantidadPedido = async (cod, incremento) => {
    const itemEnBd = await obtenerArticuloLocal(cod);
    if (!itemEnBd) return;
    const nuevaCant = Math.max(0, (itemEnBd.cant_pendiente || 0) + incremento);

    const modificarItem = (lista) => lista.map(item => item.cod === cod ? { ...item, cant_pendiente: nuevaCant } : item);
    setResultados(prev => modificarItem(prev));
    if (faseBusqueda === 'EQUIVALENCIAS') setListaEquivalencias(prev => modificarItem(prev));
    
    await actualizarArticuloLocal(cod, { cant_pendiente: nuevaCant });
    dbOficial.from('articulos').update({ cant_pendiente: nuevaCant }).eq('cod', cod).then();
  };

  const manejarTecladoBuscador = async (e) => {
    if (e.key === 'F3') {
      e.preventDefault();
      setModoFiltro(prev => prev === 'LOCAL' ? 'TODOS' : 'LOCAL');
      document.getElementById('input-buscador-mostrador')?.focus();
      return;
    }
    
    if (e.key === 'F5') {
      e.preventDefault();
      const descManual = textoBusqueda.trim().toUpperCase() || 'ARTÍCULO VARIOS';
      agregarItem({ cod: 'MANUAL', desc: descManual, precio: 0 }, 0, true);
      limpiarBuscador();
      return;
    }

    if (e.key === 'Escape' && faseBusqueda !== 'BUSQUEDA') {
      e.preventDefault();
      setFaseBusqueda(faseBusqueda === 'PRECIOS' ? 'EQUIVALENCIAS' : 'BUSQUEDA');
      return;
    } else if (e.key === 'Escape' && textoBusqueda) {
      e.preventDefault();
      limpiarBuscador();
      return;
    }

    if (e.key === 'Insert' || e.key === 'Delete') {
      const incremento = e.key === 'Insert' ? 1 : -1;
      if (faseBusqueda === 'BUSQUEDA' && indiceFoco >= 0 && resultados[indiceFoco]) {
        e.preventDefault(); actualizarCantidadPedido(resultados[indiceFoco].cod, incremento);
      } else if (faseBusqueda === 'EQUIVALENCIAS' && indiceSubFoco >= 0 && listaEquivalencias[indiceSubFoco]) {
        e.preventDefault(); actualizarCantidadPedido(listaEquivalencias[indiceSubFoco].cod, incremento);
      }
      return;
    }

    if (faseBusqueda === 'BUSQUEDA') {
      if (e.key === 'Enter') {
        e.preventDefault();
        // En TODOS, si no hay resultados obliga a disparar la búsqueda.
        if (resultados.length === 0 || indiceFoco === -1) {
          ejecutarBusquedaManual();
        } else {
          procesarSeleccionArticulo(resultados[indiceFoco]);
        }
      } else if (e.key === 'ArrowDown') { 
        e.preventDefault(); 
        if (resultados.length > 0) setIndiceFoco(p => p < resultados.length - 1 ? p + 1 : p); 
      } else if (e.key === 'ArrowUp') { 
        e.preventDefault(); 
        if (resultados.length > 0) setIndiceFoco(p => p > 0 ? p - 1 : -1); 
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        if (indiceFoco >= 0 && resultados[indiceFoco]?.tienePrimosReales) {
          const eq = await buscarEquivalenciasLocal(resultados[indiceFoco].codigo_aux);
          if (eq.length > 1) { 
            setListaEquivalencias(eq); 
            setFaseBusqueda('EQUIVALENCIAS'); 
            setIndiceSubFoco(0); 
          }
        }
      }
    } 
    else if (faseBusqueda === 'EQUIVALENCIAS') {
      if (e.key === 'ArrowDown') { e.preventDefault(); setIndiceSubFoco(p => p < listaEquivalencias.length - 1 ? p + 1 : p); } 
      else if (e.key === 'ArrowUp') { e.preventDefault(); setIndiceSubFoco(p => p > 0 ? p - 1 : 0); } 
      else if (e.key === 'ArrowLeft') { e.preventDefault(); setFaseBusqueda('BUSQUEDA'); } 
      else if (e.key === 'Enter') { e.preventDefault(); iniciarSeleccionDePrecio(listaEquivalencias[indiceSubFoco]); }
    }
    else if (faseBusqueda === 'PRECIOS') {
      if (e.key === 'ArrowDown') { e.preventDefault(); setIndicePrecioFoco(p => p < opcionesPrecio.length - 1 ? p + 1 : p); } 
      else if (e.key === 'ArrowUp') { e.preventDefault(); setIndicePrecioFoco(p => p > 0 ? p - 1 : 0); } 
      else if (e.key === 'ArrowLeft') { e.preventDefault(); setFaseBusqueda('EQUIVALENCIAS'); } 
      else if (e.key === 'Enter') { e.preventDefault(); confirmarAgregarAlCarrito(itemPendienteFisico, opcionesPrecio[indicePrecioFoco].precio); }
    }
  };

  const renderIconoPedido = (item) => (
    <div className="d-inline-flex ms-2 gap-1 align-items-center flex-nowrap">
      {item.cant_en_camino > 0 && <span className="badge text-warning border border-warning px-1" style={{fontSize:'0.75rem'}}>🚚 {item.cant_en_camino}</span>}
      {item.cant_pendiente > 0 && <span className="badge text-info border border-info px-1" style={{fontSize:'0.75rem'}}>🛒 {item.cant_pendiente}</span>}
    </div>
  );

  const renderInsigniaStock = (stock) => stock > 0 
    ? <span className="badge bg-success bg-opacity-10 text-success border border-success mx-2" style={{fontSize:'0.75rem'}}>Stock: {stock}</span> 
    : <span className="badge bg-danger bg-opacity-10 text-danger border border-danger mx-2" style={{fontSize:'0.75rem'}}>Stock: {stock}</span>;

  return (
    <div className="d-flex mb-3 position-relative">
      <div className="w-100 position-relative d-flex align-items-center bg-white border shadow-sm rounded-pill px-2" style={{ borderColor: '#ced4da', zIndex: 1060 }}>
        <span className={`badge ${colorFiltro} ms-2 rounded-pill`} style={{ cursor: 'pointer', padding: '0.4em 0.8em' }} onClick={() => { setModoFiltro(prev => prev === 'LOCAL' ? 'TODOS' : 'LOCAL'); document.getElementById('input-buscador-mostrador')?.focus(); }}>
          [F3] {modoFiltro}
        </span>
        <input 
          id="input-buscador-mostrador"
          type="text" 
          className="form-control border-0 shadow-none bg-transparent" 
          placeholder="🔎 Buscar artículo u original... (Enter: Buscar/Cargar | F3: Filtro | F5: Manual)" 
          value={textoBusqueda}
          onChange={(e) => { 
            setTextoBusqueda(e.target.value); 
            // Si está en TODOS, borramos resultados para forzar el Enter. Si es LOCAL, el useEffect de arriba se encarga.
            if (modoFiltro === 'TODOS') setResultados([]); 
            setFaseBusqueda('BUSQUEDA'); 
            setIndiceFoco(-1); 
          }}
          onKeyDown={manejarTecladoBuscador}
          autoComplete="off"
        />
        
        {resultados.length > 0 && (
          <div className="position-absolute w-100 shadow-lg bg-white rounded-3" style={{ top: '110%', left: '0', zIndex: 1050, border: `1px solid #e9ecef`, overflow: 'hidden' }}>
            
            {faseBusqueda === 'BUSQUEDA' && (
              <ul ref={listaResultadosRef} className="list-group list-group-flush" style={{ maxHeight: '400px', overflowY: 'auto' }}>
                {resultados.map((item, idx) => {
                  const esActivo = indiceFoco === idx;
                  return (
                    <li key={idx} className="list-group-item d-flex justify-content-between align-items-center py-2 border-bottom" onClick={() => procesarSeleccionArticulo(item)} style={{ cursor: 'pointer', backgroundColor: esActivo ? '#d0e7ff' : 'transparent', borderLeft: esActivo ? `4px solid ${colorBordo}` : '4px solid transparent' }}>
                      <div className="d-flex align-items-center w-75">
                        <strong className={`font-monospace ${esActivo ? 'text-dark' : 'text-primary'}`}>{item.cod}</strong>
                        <span className={`ms-2 text-truncate ${esActivo ? 'fw-bold text-dark' : 'fw-semibold text-secondary'}`}>{item.desc}</span>
                        <div className="ms-auto d-flex align-items-center flex-nowrap">
                          {item.en_estanteria ? renderInsigniaStock(item.stock) : <span className="badge bg-secondary bg-opacity-10 text-secondary border border-secondary mx-2" style={{fontSize:'0.75rem'}}>Sin internalizar</span>}
                          <span className="badge bg-light text-dark border">{item.marca || item.distribuidor}</span>
                          {item.tienePrimosReales && <span className="badge bg-info bg-opacity-10 text-info border border-info ms-2" style={{fontSize:'0.75rem'}}>🔗 (➔)</span>}
                          {renderIconoPedido(item)}
                        </div>
                      </div>
                      <div className="fw-bold font-monospace w-25 text-end pe-2 text-dark">{formatoMoneda(item.precio)}</div>
                    </li>
                  );
                })}
              </ul>
            )}

            {faseBusqueda === 'EQUIVALENCIAS' && (
              <div className="bg-light">
                <div className="p-2 border-bottom fw-bold text-center d-flex flex-column align-items-center" style={{ backgroundColor: '#198754', color: 'white' }}>
                  <span className="small text-uppercase mb-1">Paso 1: Seleccione el repuesto FÍSICO a entregar</span>
                </div>
                <ul ref={listaResultadosRef} className="list-group list-group-flush" style={{ maxHeight: '310px', overflowY: 'auto' }}>
                  {listaEquivalencias.map((item, idx) => {
                    const esActivo = indiceSubFoco === idx;
                    return (
                      <li key={idx} className="list-group-item d-flex justify-content-between align-items-center py-2 border-bottom" onClick={() => iniciarSeleccionDePrecio(item)} style={{ cursor: 'pointer', backgroundColor: esActivo ? '#d1e7dd' : 'transparent', borderLeft: esActivo ? `4px solid #198754` : '4px solid transparent' }}>
                        <div className="d-flex align-items-center w-75">
                          <span className={`small ${esActivo ? 'text-success fw-bold' : 'text-secondary'}`}>Entregar físico:</span>
                          <strong className={`font-monospace ms-2 ${esActivo ? 'text-dark' : 'text-primary'}`}>{item.cod}</strong>
                          <span className={`ms-2 text-truncate ${esActivo ? 'fw-bold text-dark' : 'text-secondary'}`}>{item.desc}</span>
                          <div className="ms-auto d-flex align-items-center flex-nowrap">
                            {renderInsigniaStock(item.stock)}
                            <span className="badge bg-light text-dark border">{item.marca || item.distribuidor}</span>
                          </div>
                        </div>
                        <div className="fw-bold text-dark font-monospace text-end w-25 pe-2">
                          {formatoMoneda(item.precio)}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}

            {faseBusqueda === 'PRECIOS' && (
              <div className="bg-light">
                <div className="p-2 border-bottom text-white fw-bold d-flex justify-content-between align-items-center" style={{ backgroundColor: '#0d6efd' }}>
                  <span className="small">⬅️ Volver</span>
                  <div className="text-center">
                    <span className="small fw-bold text-uppercase d-block mb-1">Paso 2: Seleccione el PRECIO a facturar</span>
                  </div>
                  <span style={{ width: '60px' }}></span> 
                </div>
                <ul ref={listaResultadosRef} className="list-group list-group-flush" style={{ maxHeight: '310px', overflowY: 'auto' }}>
                  {opcionesPrecio.map((opcion, idx) => {
                    const esActivo = indicePrecioFoco === idx;
                    return (
                      <li key={idx} className="list-group-item d-flex justify-content-between align-items-center py-2 border-bottom" onClick={() => confirmarAgregarAlCarrito(itemPendienteFisico, opcion.precio)} style={{ cursor: 'pointer', backgroundColor: esActivo ? '#d0e7ff' : 'transparent', borderLeft: esActivo ? `4px solid #0d6efd` : '4px solid transparent' }}>
                        <div className="d-flex align-items-center w-75">
                          <span className={`small ${esActivo ? 'text-primary fw-bold' : 'text-secondary'}`}>Cobrar precio de:</span>
                          <strong className="font-monospace text-dark ms-2">{opcion.cod}</strong>
                        </div>
                        <div className="fw-bold fs-5 text-dark font-monospace w-25 text-end pe-2">
                          {formatoMoneda(opcion.precio)}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}