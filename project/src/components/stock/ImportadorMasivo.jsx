import React, { useState } from 'react';
import * as XLSX from 'xlsx';
import { dbOficial } from '../../supabaseClient';
import { syncCatalogo } from '../../utils/dbLocal';

export default function ImportadorMasivo() {
  const [archivo, setArchivo] = useState(null);
  const [datosCrudos, setDatosCrudos] = useState([]); // Array 2D
  const [maxColumnas, setMaxColumnas] = useState(0);
  
  const [distribuidor, setDistribuidor] = useState('');
  const [filasIgnorar, setFilasIgnorar] = useState(1); // Por defecto salta 1 (encabezado)
  
  const [descuentoBase, setDescuentoBase] = useState(0);
  const [ganancia, setGanancia] = useState(40);
  
  const [descuentosMarcas, setDescuentosMarcas] = useState([]); 
  const [nuevaMarca, setNuevaMarca] = useState('');
  const [nuevoDescMarca, setNuevoDescMarca] = useState('');

  const [colCod, setColCod] = useState('');
  const [colDesc, setColDesc] = useState('');
  const [colMarca, setColMarca] = useState('');
  const [colPrecio, setColPrecio] = useState('');
  const [colStock, setColStock] = useState('');

  const [procesando, setProcesando] = useState(false);
  const [progreso, setProgreso] = useState(0);

  // Convierte índice numérico a Letra de Columna Excel (0->A, 1->B, 26->AA)
  const letraColumna = (index) => {
    let letStr = '';
    let col = index;
    while (col >= 0) {
      letStr = String.fromCharCode((col % 26) + 65) + letStr;
      col = Math.floor(col / 26) - 1;
    }
    return letStr;
  };

  const manejarArchivo = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setArchivo(file);

    const reader = new FileReader();
    reader.onload = (evt) => {
      const bstr = evt.target.result;
      const wb = XLSX.read(bstr, { type: 'binary' });
      const wsname = wb.SheetNames[0];
      const ws = wb.Sheets[wsname];
      
      // header: 1 fuerza a leerlo como array de arrays (crudo)
      const data = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
      setDatosCrudos(data);
      
      if (data.length > 0) {
        // Calcula cuál es la fila con más columnas para armar los selectores
        const maxCols = Math.max(...data.slice(0, 50).map(row => row.length));
        setMaxColumnas(maxCols || 10);
      }
    };
    reader.readAsBinaryString(file);
  };

  const agregarDescuentoMarca = () => {
    if (!nuevaMarca.trim()) return;
    setDescuentosMarcas([...descuentosMarcas, { marca: nuevaMarca.toUpperCase(), descuento: Number(nuevoDescMarca) || 0 }]);
    setNuevaMarca('');
    setNuevoDescMarca('');
  };

  const quitarDescuentoMarca = (index) => {
    setDescuentosMarcas(descuentosMarcas.filter((_, i) => i !== index));
  };

  const calcularPrecios = (fila) => {
    let precioListaCrudo = colPrecio !== '' ? String(fila[Number(colPrecio)] || '').replace(/[^0-9,.-]/g, '').replace(',', '.') : '0';
    let precioLista = parseFloat(precioListaCrudo) || 0;

    let descAplicar = Number(descuentoBase);
    
    if (colMarca !== '' && fila[Number(colMarca)]) {
      const marcaFila = String(fila[Number(colMarca)]).toUpperCase().trim();
      const descEspecial = descuentosMarcas.find(d => d.marca === marcaFila);
      if (descEspecial) {
        descAplicar = descEspecial.descuento;
      }
    }

    let precioCosto = precioLista - (precioLista * (descAplicar / 100));
    let precioPublico = precioCosto + (precioCosto * (Number(ganancia) / 100));

    return { precio_lista: precioLista, precio_costo: precioCosto, precio: precioPublico };
  };

  const procesarYSubir = async () => {
    if (!distribuidor.trim()) return alert('Falta el nombre de la distribuidora.');
    if (colCod === '' || colDesc === '' || colPrecio === '') return alert('Es obligatorio mapear Código, Descripción y Precio.');

    setProcesando(true);
    setProgreso(0);

    // Cortamos la basura de arriba
    const datosUtiles = datosCrudos.slice(Number(filasIgnorar));

    const payload = datosUtiles.map(fila => {
      // Ignorar filas vacías
      if (!fila || fila.length === 0) return null;
      
      const valCod = String(fila[Number(colCod)] || '').trim();
      const valDesc = String(fila[Number(colDesc)] || '').trim();
      
      if (!valCod || !valDesc) return null;

      const precios = calcularPrecios(fila);
      
      return {
        cod: valCod,
        desc: valDesc,
        marca: colMarca !== '' ? String(fila[Number(colMarca)] || '').trim() : null,
        stock: colStock !== '' ? String(fila[Number(colStock)] || '').trim() : '0',
        distribuidor: distribuidor.toUpperCase().trim(),
        precio_lista: precios.precio_lista,
        precio_costo: precios.precio_costo,
        precio: precios.precio,
        en_estanteria: false
      };
    }).filter(Boolean); // Limpia los nulos

    if (payload.length === 0) {
      alert('No se encontraron datos válidos con el mapeo actual.');
      setProcesando(false);
      return;
    }

    const chunk_size = 1000;
    for (let i = 0; i < payload.length; i += chunk_size) {
      const lote = payload.slice(i, i + chunk_size);
      const { error } = await dbOficial.from('articulos').upsert(lote, { onConflict: 'cod' });
      if (error) {
        alert(`Error en BD (Fila ${i}): ${error.message}`);
        setProcesando(false);
        return;
      }
      setProgreso(Math.round(((i + chunk_size) / payload.length) * 100));
    }

    alert(`✅ ${payload.length} repuestos guardados. Sincronizando memoria RAM...`);
    
    // Obliga a IndexedDB a bajarse todo de nuevo
    await syncCatalogo(true); 
    
    setProcesando(false);
    setArchivo(null);
    setDatosCrudos([]);
    alert('✅ Proceso finalizado.');
  };

  const opcionesColumnas = Array.from({ length: maxColumnas }, (_, i) => ({ valor: i, etiqueta: `Columna ${letraColumna(i)}` }));

  return (
    <div className="container-fluid p-0">
      <div className="row g-3">
        {/* PANEL IZQUIERDO: Archivo y Mapeo */}
        <div className="col-lg-4 col-xl-3 d-flex flex-column gap-3">
          
          <div className="card shadow-sm">
            <div className="card-header bg-dark text-white fw-bold">1. Origen de Datos</div>
            <div className="card-body bg-light">
              <input type="file" className="form-control mb-3" accept=".xlsx, .xls, .csv" onChange={manejarArchivo} disabled={procesando} />
              <label className="small fw-bold text-muted mb-1">Nombre Distribuidora (Requerido)</label>
              <input type="text" className="form-control fw-bold text-uppercase mb-3" placeholder="Ej: ARCORE" value={distribuidor} onChange={e => setDistribuidor(e.target.value)} disabled={procesando} />
              
              <label className="small fw-bold text-muted mb-1">Ignorar primeras filas (Basura/Títulos)</label>
              <input type="number" min="0" className="form-control font-monospace" value={filasIgnorar} onChange={e => setFilasIgnorar(e.target.value)} disabled={procesando} />
            </div>
          </div>

          <div className="card shadow-sm">
            <div className="card-header bg-dark text-white fw-bold">2. Asignación de Columnas</div>
            <div className="card-body bg-light">
              <label className="small fw-bold text-muted">CÓDIGO *</label>
              <select className="form-select mb-2 font-monospace" value={colCod} onChange={e => setColCod(e.target.value)} disabled={!datosCrudos.length}><option value="">-- Seleccionar --</option>{opcionesColumnas.map(c => <option key={c.valor} value={c.valor}>{c.etiqueta}</option>)}</select>
              
              <label className="small fw-bold text-muted">DESCRIPCIÓN *</label>
              <select className="form-select mb-2 font-monospace" value={colDesc} onChange={e => setColDesc(e.target.value)} disabled={!datosCrudos.length}><option value="">-- Seleccionar --</option>{opcionesColumnas.map(c => <option key={c.valor} value={c.valor}>{c.etiqueta}</option>)}</select>
              
              <label className="small fw-bold text-muted">PRECIO LISTA *</label>
              <select className="form-select mb-2 font-monospace" value={colPrecio} onChange={e => setColPrecio(e.target.value)} disabled={!datosCrudos.length}><option value="">-- Seleccionar --</option>{opcionesColumnas.map(c => <option key={c.valor} value={c.valor}>{c.etiqueta}</option>)}</select>

              <label className="small fw-bold text-muted">MARCA (Opcional)</label>
              <select className="form-select mb-2 font-monospace" value={colMarca} onChange={e => setColMarca(e.target.value)} disabled={!datosCrudos.length}><option value="">-- Omitir --</option>{opcionesColumnas.map(c => <option key={c.valor} value={c.valor}>{c.etiqueta}</option>)}</select>

              <label className="small fw-bold text-muted">STOCK DISTRI. (Opcional)</label>
              <select className="form-select font-monospace" value={colStock} onChange={e => setColStock(e.target.value)} disabled={!datosCrudos.length}><option value="">-- Omitir --</option>{opcionesColumnas.map(c => <option key={c.valor} value={c.valor}>{c.etiqueta}</option>)}</select>
            </div>
          </div>

        </div>

        {/* PANEL DERECHO: Previsualización y Rentabilidad */}
        <div className="col-lg-8 col-xl-9 d-flex flex-column gap-3">
          
          <div className="card shadow-sm flex-grow-1">
            <div className="card-header bg-secondary text-white fw-bold">Vista Previa de Datos (Primeras 8 filas activas)</div>
            <div className="card-body p-0 overflow-auto bg-white" style={{ minHeight: '200px' }}>
              {datosCrudos.length === 0 ? (
                <div className="p-4 text-center text-muted mt-4">Cargá un archivo Excel para previsualizar los datos.</div>
              ) : (
                <table className="table table-bordered table-sm mb-0" style={{ fontSize: '0.85rem' }}>
                  <thead className="table-light sticky-top">
                    <tr>
                      <th className="bg-dark text-white text-center" style={{ width: '40px' }}>#</th>
                      {Array.from({ length: maxColumnas }).map((_, i) => (
                        <th key={i} className="text-center bg-secondary text-white fw-bold">{letraColumna(i)}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {datosCrudos.slice(Number(filasIgnorar), Number(filasIgnorar) + 8).map((fila, rowIndex) => (
                      <tr key={rowIndex}>
                        <td className="text-center fw-bold bg-light text-muted">{Number(filasIgnorar) + rowIndex + 1}</td>
                        {Array.from({ length: maxColumnas }).map((_, colIndex) => (
                          <td key={colIndex} className="text-truncate" style={{ maxWidth: '150px' }} title={fila[colIndex] || ''}>
                            {fila[colIndex] !== undefined ? String(fila[colIndex]) : ''}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          <div className="card shadow-sm">
            <div className="card-header bg-dark text-white fw-bold d-flex justify-content-between align-items-center">
              <span>3. Rentabilidad y Descuentos</span>
              <button className="btn btn-sm btn-success fw-bold px-5" onClick={procesarYSubir} disabled={procesando || datosCrudos.length === 0}>
                {procesando ? `Subiendo... ${progreso > 100 ? 100 : progreso}%` : '🚀 Procesar Catálogo'}
              </button>
            </div>
            <div className="card-body bg-light row">
              
              <div className="col-md-5 border-end">
                <h6 className="fw-bold text-primary mb-3">Configuración Base</h6>
                <div className="mb-3">
                  <label className="form-label small fw-bold">Descuento General Lista (%)</label>
                  <div className="input-group input-group-sm">
                    <input type="number" className="form-control font-monospace" value={descuentoBase} onChange={e => setDescuentoBase(e.target.value)} />
                    <span className="input-group-text">%</span>
                  </div>
                </div>
                <div className="mb-0">
                  <label className="form-label small fw-bold">Margen de Ganancia Final (%)</label>
                  <div className="input-group input-group-sm">
                    <input type="number" className="form-control font-monospace" value={ganancia} onChange={e => setGanancia(e.target.value)} />
                    <span className="input-group-text">%</span>
                  </div>
                </div>
              </div>

              <div className="col-md-7">
                <h6 className="fw-bold text-danger mb-3">Descuentos Especiales por Marca</h6>
                <div className="d-flex gap-2 mb-3">
                  <input type="text" className="form-control form-control-sm text-uppercase" placeholder="Marca (Ej: MONROE)" value={nuevaMarca} onChange={e => setNuevaMarca(e.target.value)} />
                  <input type="number" className="form-control form-control-sm" style={{ width: '80px' }} placeholder="Desc %" value={nuevoDescMarca} onChange={e => setNuevoDescMarca(e.target.value)} />
                  <button className="btn btn-sm btn-secondary fw-bold px-3" onClick={agregarDescuentoMarca}>Agregar</button>
                </div>
                
                <ul className="list-group list-group-sm overflow-auto" style={{ maxHeight: '100px' }}>
                  {descuentosMarcas.length === 0 && <li className="list-group-item text-muted small border-0 bg-transparent px-0">Sin descuentos particulares cargados.</li>}
                  {descuentosMarcas.map((d, i) => (
                    <li key={i} className="list-group-item d-flex justify-content-between align-items-center py-1 px-2 mb-1 border rounded shadow-sm">
                      <span className="fw-bold small">{d.marca}</span>
                      <div>
                        <span className="badge bg-danger me-2">-{d.descuento}%</span>
                        <button className="btn btn-sm btn-outline-danger py-0 px-1 border-0" onClick={() => quitarDescuentoMarca(i)}>✖</button>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>

            </div>
          </div>

        </div>
      </div>
    </div>
  );
}