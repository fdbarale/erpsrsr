import React, { useState } from 'react';
import * as XLSX from 'xlsx';
import { dbOficial } from '../../supabaseClient';
import { syncCatalogo } from '../../utils/dbLocal';

export default function ImportadorMasivo() {
  const [archivo, setArchivo] = useState(null);
  const [datosCrudos, setDatosCrudos] = useState([]);
  
  const [distribuidor, setDistribuidor] = useState('');
  const [descuentoBase, setDescuentoBase] = useState(0);
  const [ganancia, setGanancia] = useState(40);
  
  const [descuentosMarcas, setDescuentosMarcas] = useState([]); // [{ marca: 'BOSCH', descuento: 15 }]
  const [nuevaMarca, setNuevaMarca] = useState('');
  const [nuevoDescMarca, setNuevoDescMarca] = useState('');

  const [colCod, setColCod] = useState('');
  const [colDesc, setColDesc] = useState('');
  const [colMarca, setColMarca] = useState('');
  const [colPrecio, setColPrecio] = useState('');
  const [colStock, setColStock] = useState('');

  const [procesando, setProcesando] = useState(false);
  const [progreso, setProgreso] = useState(0);

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
      const data = XLSX.utils.sheet_to_json(ws, { defval: '' });
      setDatosCrudos(data);
      
      if (data.length > 0) {
        const headers = Object.keys(data[0]);
        setColCod(headers[0] || '');
        setColDesc(headers[1] || '');
        setColPrecio(headers[2] || '');
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
    let precioListaCrudo = String(fila[colPrecio]).replace(/[^0-9,.-]/g, '').replace(',', '.');
    let precioLista = parseFloat(precioListaCrudo) || 0;

    let descAplicar = Number(descuentoBase);
    
    // Si la fila tiene marca, buscamos si hay un descuento especial para esa marca
    if (colMarca && fila[colMarca]) {
      const marcaFila = String(fila[colMarca]).toUpperCase().trim();
      const descEspecial = descuentosMarcas.find(d => d.marca === marcaFila);
      if (descEspecial) {
        descAplicar = descEspecial.descuento;
      }
    }

    let precioCosto = precioLista - (precioLista * (descAplicar / 100));
    let precioPublico = precioCosto + (precioCosto * (Number(ganancia) / 100));

    return {
      precio_lista: precioLista,
      precio_costo: precioCosto,
      precio: precioPublico
    };
  };

  const procesarYSubir = async () => {
    if (!distribuidor.trim()) return alert('Poné el nombre de la distribuidora.');
    if (!colCod || !colDesc || !colPrecio) return alert('Mapeá las columnas obligatorias (Código, Desc, Precio).');

    setProcesando(true);
    setProgreso(0);

    const payload = datosCrudos.map(fila => {
      const precios = calcularPrecios(fila);
      return {
        cod: String(fila[colCod]).trim(),
        desc: String(fila[colDesc]).trim(),
        marca: colMarca ? String(fila[colMarca]).trim() : null,
        stock: colStock ? String(fila[colStock]).trim() : '0',
        distribuidor: distribuidor.toUpperCase().trim(),
        precio_lista: precios.precio_lista,
        precio_costo: precios.precio_costo,
        precio: precios.precio,
        en_estanteria: false // Entran como catálogo crudo por defecto
      };
    }).filter(i => i.cod && i.desc);

    const chunk_size = 1000;
    for (let i = 0; i < payload.length; i += chunk_size) {
      const lote = payload.slice(i, i + chunk_size);
      
      const { error } = await dbOficial.from('articulos').upsert(lote, { onConflict: 'cod' });
      if (error) {
        alert(`Fallo en lote ${i}: ${error.message}`);
        setProcesando(false);
        return;
      }
      setProgreso(Math.round(((i + chunk_size) / payload.length) * 100));
    }

    alert('✅ Catálogo procesado y subido. Sincronizando memoria RAM...');
    
    // Obligamos a IndexedDB a bajarse todo de nuevo para tener los precios frescos
    await syncCatalogo(true); 
    
    setProcesando(false);
    setArchivo(null);
    setDatosCrudos([]);
    alert('✅ Todo listo. Ya podés buscar.');
  };

  const columnasDisponibles = datosCrudos.length > 0 ? Object.keys(datosCrudos[0]) : [];

  return (
    <div className="container-fluid p-0">
      <div className="row">
        <div className="col-md-4">
          <div className="card shadow-sm mb-3">
            <div className="card-header bg-dark text-white fw-bold">1. Archivo y Distribuidora</div>
            <div className="card-body bg-light">
              <input type="file" className="form-control mb-3" accept=".xlsx, .xls, .csv" onChange={manejarArchivo} disabled={procesando} />
              <input type="text" className="form-control fw-bold text-uppercase" placeholder="Nombre Distribuidora (Ej: ARCORE)" value={distribuidor} onChange={e => setDistribuidor(e.target.value)} disabled={procesando} />
            </div>
          </div>

          <div className="card shadow-sm mb-3">
            <div className="card-header bg-dark text-white fw-bold">2. Mapeo de Columnas</div>
            <div className="card-body bg-light">
              <label className="small fw-bold text-muted">Columna CÓDIGO *</label>
              <select className="form-select mb-2" value={colCod} onChange={e => setColCod(e.target.value)}><option value="">-- Seleccionar --</option>{columnasDisponibles.map(c => <option key={c} value={c}>{c}</option>)}</select>
              
              <label className="small fw-bold text-muted">Columna DESCRIPCIÓN *</label>
              <select className="form-select mb-2" value={colDesc} onChange={e => setColDesc(e.target.value)}><option value="">-- Seleccionar --</option>{columnasDisponibles.map(c => <option key={c} value={c}>{c}</option>)}</select>
              
              <label className="small fw-bold text-muted">Columna PRECIO LISTA *</label>
              <select className="form-select mb-2" value={colPrecio} onChange={e => setColPrecio(e.target.value)}><option value="">-- Seleccionar --</option>{columnasDisponibles.map(c => <option key={c} value={c}>{c}</option>)}</select>

              <label className="small fw-bold text-muted">Columna MARCA (Opcional)</label>
              <select className="form-select mb-2" value={colMarca} onChange={e => setColMarca(e.target.value)}><option value="">-- Omitir --</option>{columnasDisponibles.map(c => <option key={c} value={c}>{c}</option>)}</select>

              <label className="small fw-bold text-muted">Columna STOCK (Opcional)</label>
              <select className="form-select" value={colStock} onChange={e => setColStock(e.target.value)}><option value="">-- Omitir --</option>{columnasDisponibles.map(c => <option key={c} value={c}>{c}</option>)}</select>
            </div>
          </div>
        </div>

        <div className="col-md-8">
          <div className="card shadow-sm mb-3 h-100">
            <div className="card-header bg-dark text-white fw-bold d-flex justify-content-between align-items-center">
              <span>3. Rentabilidad y Descuentos</span>
              <button className="btn btn-sm btn-success fw-bold px-4" onClick={procesarYSubir} disabled={procesando || datosCrudos.length === 0}>
                {procesando ? `Subiendo... ${progreso > 100 ? 100 : progreso}%` : '🚀 Procesar y Subir'}
              </button>
            </div>
            <div className="card-body bg-light row">
              
              <div className="col-md-6 border-end">
                <h6 className="fw-bold text-primary mb-3">Configuración General</h6>
                <div className="mb-3">
                  <label className="form-label small fw-bold">Descuento Base Lista (%)</label>
                  <div className="input-group">
                    <input type="number" className="form-control" value={descuentoBase} onChange={e => setDescuentoBase(e.target.value)} />
                    <span className="input-group-text">%</span>
                  </div>
                  <small className="text-muted">Se aplica a todo lo que no tenga descuento especial.</small>
                </div>
                <div className="mb-3">
                  <label className="form-label small fw-bold">Margen de Ganancia Final (%)</label>
                  <div className="input-group">
                    <input type="number" className="form-control" value={ganancia} onChange={e => setGanancia(e.target.value)} />
                    <span className="input-group-text">%</span>
                  </div>
                  <small className="text-muted">Se suma sobre el Costo ya descontado.</small>
                </div>
              </div>

              <div className="col-md-6">
                <h6 className="fw-bold text-danger mb-3">Descuentos Especiales por Marca</h6>
                <div className="d-flex gap-2 mb-3">
                  <input type="text" className="form-control form-control-sm text-uppercase" placeholder="Marca (Ej: MONROE)" value={nuevaMarca} onChange={e => setNuevaMarca(e.target.value)} />
                  <input type="number" className="form-control form-control-sm w-25" placeholder="Desc %" value={nuevoDescMarca} onChange={e => setNuevoDescMarca(e.target.value)} />
                  <button className="btn btn-sm btn-secondary fw-bold" onClick={agregarDescuentoMarca}>Agregar</button>
                </div>
                
                <ul className="list-group list-group-sm">
                  {descuentosMarcas.length === 0 && <li className="list-group-item text-muted small">Sin descuentos particulares.</li>}
                  {descuentosMarcas.map((d, i) => (
                    <li key={i} className="list-group-item d-flex justify-content-between align-items-center p-2">
                      <span className="fw-bold">{d.marca}</span>
                      <div>
                        <span className="badge bg-danger me-2">-{d.descuento}%</span>
                        <button className="btn btn-sm btn-outline-danger py-0 px-2 border-0" onClick={() => quitarDescuentoMarca(i)}>✖</button>
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