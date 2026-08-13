import { useState, useEffect } from 'react';
import { dbOficial, dbInterna } from './supabaseClient';

// Imports de los módulos
import FacturacionModal from './components/FacturacionModal';
import GestionStock from './components/GestionStock';
import Configuracion from './components/Configuracion';
import Contabilidad from './components/Contabilidad';
import Pedidos from './components/Pedidos';
import Mostrador from './components/Mostrador';
import Deposito from './components/Deposito';
import CuentasCorrientes from './components/CuentasCorrientes';
import HistorialComprobantes from './components/HistorialComprobantes'; // ACÁ FALTABA ESTO

function App() {
  // Estados de autenticación
  const [logueado, setLogueado] = useState(false);
  const [usuario, setUsuario] = useState('fernando@rsr.com');
  const [password, setPassword] = useState('');
  
  // Estado para manejar la navegación del dashboard
  const [vista, setVista] = useState('dashboard');

  // === ESTADOS GLOBALES DEL MOSTRADOR ===
  const [carritoMostrador, setCarritoMostrador] = useState([]);
  const [baseDatosArticulos, setBaseDatosArticulos] = useState([]);
  const [abrirFacturacion, setAbrirFacturacion] = useState(false);

  // === CHUPAR INVENTARIO DE SUPABASE AL INICIAR ===
  useEffect(() => {
    const cargarArticulos = async () => {
      const { data, error } = await dbOficial.from('articulos').select('*');
      if (data) {
        setBaseDatosArticulos(data);
      }
      if (error) {
        console.error("Error al cargar artículos:", error);
      }
    };
    cargarArticulos();
  }, []);

  const manejarLogin = async (e) => {
    e.preventDefault();
    
    // Autenticamos contra la base Oficial
    const { error } = await dbOficial.auth.signInWithPassword({
      email: usuario,
      password: password
    });

    if (error) {
      alert("Credenciales incorrectas: " + error.message);
      return;
    }

    setLogueado(true);
  };

  // PANTALLA DE LOGIN
  if (!logueado) {
    return (
      <div className="container mt-5">
        <div className="row justify-content-center">
          <div className="col-md-4">
            <div className="card p-4 shadow-sm">
              <h3 className="text-center mb-4">Ingreso al Sistema</h3>
              <form onSubmit={manejarLogin}>
                <div className="mb-3">
                  <label>Email</label>
                  <input 
                    type="email" 
                    className="form-control" 
                    value={usuario} 
                    onChange={(e) => setUsuario(e.target.value)} 
                    required 
                  />
                </div>
                <div className="mb-3">
                  <label>Contraseña</label>
                  <input 
                    type="password" 
                    className="form-control" 
                    value={password} 
                    onChange={(e) => setPassword(e.target.value)} 
                    required 
                  />
                </div>
                <button type="submit" className="btn btn-dark w-100">Entrar</button>
              </form>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // PANTALLA PRINCIPAL (DASHBOARD / MÓDULOS)
  return (
    <div className="container-fluid p-4">
      {vista === 'dashboard' && (
        <>
          <h1>¡Buen día equipo! 🧉</h1>
          <p className="text-muted">Sistema operativo. Pendientes de WhatsApp: 1</p>
          
          <div className="d-flex gap-3 mt-4 flex-wrap">
            <button className="btn btn-outline-dark p-4 text-center shadow-sm" onClick={() => setVista('mostrador')}>
              <h3 className="mb-2">🛒</h3>
              Mostrador<br/>Principal
            </button>
            <button className="btn btn-outline-dark p-4 text-center shadow-sm" onClick={() => setVista('deposito')}>
              <h3 className="mb-2">📦</h3>
              Depósito -<br/>Pedidos
            </button>
            <button className="btn btn-outline-dark p-4 text-center shadow-sm" onClick={() => setVista('clientes')}>
              <h3 className="mb-2">👥</h3>
              Clientes
            </button>
            <button className="btn btn-outline-dark p-4 text-center shadow-sm" onClick={() => setVista('pedidos')}>
              <h3 className="mb-2">📝</h3>
              Pedidos
            </button>
            <button className="btn btn-outline-dark p-4 text-center shadow-sm" onClick={() => setVista('configuracion')}>
              <h3 className="mb-2">⚙️</h3>
              Configuración
            </button>
            <button className="btn btn-outline-dark p-4 text-center shadow-sm border-danger" onClick={() => setVista('contabilidad')}>
              <h3 className="mb-2">📊</h3>
              Contabilidad
            </button>
            <button className="btn btn-outline-dark p-4 text-center shadow-sm" onClick={() => setVista('stock')}>
               <h3 className="mb-2">📋</h3>
               Gestión de<br/>Stock
            </button>
            <button className="btn btn-outline-dark p-4 text-center shadow-sm" onClick={() => setVista('comprobantes')}>
                 <h3 className="mb-2">🧾</h3>
                  Comprobantes<br/>y Notas de C.
            </button>
          </div>
        </>
      )}

      {/* RENDERIZADO DE COMPONENTES */}
      {vista === 'mostrador' && (
        <Mostrador 
          baseDatos={baseDatosArticulos}
          setBaseDatos={setBaseDatosArticulos}
          carrito={carritoMostrador}
          setCarrito={setCarritoMostrador}
          abrirFacturacionInicial={abrirFacturacion}
          desactivarFacturacionInicial={() => setAbrirFacturacion(false)}
          volverAlMenu={() => setVista('dashboard')}
          procesarVenta={(carritoFacturar) => {
            setCarritoMostrador(carritoFacturar);
            setAbrirFacturacion(true);
          }}
        />
      )}

      {vista === 'configuracion' && <Configuracion volverAlMenu={() => setVista('dashboard')} />}
      
      {vista === 'deposito' && <Deposito volverAlMenu={() => setVista('dashboard')} />}
      
      {vista === 'clientes' && <CuentasCorrientes volverAlMenu={() => setVista('dashboard')} />}

      {vista === 'pedidos' && <Pedidos volverAlMenu={() => setVista('dashboard')} />}

      {vista === 'contabilidad' && <Contabilidad volverAlMenu={() => setVista('dashboard')} />} 

      {vista === 'stock' && <GestionStock volverAlMenu={() => setVista('dashboard')} />}

      {vista === 'comprobantes' && <HistorialComprobantes volverAlMenu={() => setVista('dashboard')} />}
      
      {abrirFacturacion && (
        <FacturacionModal 
          carrito={carritoMostrador}
          totalCarrito={carritoMostrador.reduce((acc, item) => acc + (item.cantidad * item.precio), 0)}
          cerrar={() => setAbrirFacturacion(false)}
          vaciarYConfirmar={() => {
            setCarritoMostrador([]);
            setAbrirFacturacion(false);
          }}
        />
      )}
    
    </div>
  );
}

export default App;