import { useState, useEffect } from 'react';
import { dbOficial } from './supabaseClient';
import { RefreshCw } from 'lucide-react';
import { syncCatalogo } from './utils/dbLocal';

// Imports de los módulos (Fijate que volamos FacturacionModal de acá)
import GestionStock from './components/GestionStock';
import Configuracion from './components/Configuracion';
import Contabilidad from './components/Contabilidad';
import Pedidos from './components/Pedidos';
import Mostrador from './components/mostrador/Mostrador';
import Deposito from './components/Deposito';
import HistorialComprobantes from './components/HistorialComprobantes';
import MenuDashboard from './components/MenuDashboard';
import Clientes from './components/Clientes';

function App() {
  const [session, setSession] = useState(null);
  const [usuarioActivo, setUsuarioActivo] = useState(null);
  const [usuariosDB, setUsuariosDB] = useState([]);
  const [onlineUsers, setOnlineUsers] = useState([]);
  
  const [emailInput, setEmailInput] = useState('');
  const [passInput, setPassInput] = useState('');
  const [vista, setVista] = useState('dashboard');

  const [mostrarCambioSesion, setMostrarCambioSesion] = useState(false);
  const [switchEmail, setSwitchEmail] = useState('');
  const [switchPass, setSwitchPass] = useState('');

  useEffect(() => {
    dbOficial.auth.getSession().then(({ data: { session } }) => setSession(session));
    
    const { data: authListener } = dbOficial.auth.onAuthStateChange((_evt, currentSession) => {
      setSession(currentSession);
      if (!currentSession) setUsuarioActivo(null);
    });

    const cargarUsuarios = async () => {
      const { data } = await dbOficial.from('config_usuarios').select('*');
      if (data) setUsuariosDB(data);
    };
    cargarUsuarios();

    // Sincronización cruda a IndexedDB en background
    syncCatalogo().catch(console.error);

    return () => authListener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (session && usuariosDB.length > 0) {
      const perfil = usuariosDB.find(u => u.email === session.user.email);
      setUsuarioActivo(perfil ? perfil : { email: session.user.email, nombre: session.user.email.split('@')[0] });
    }
  }, [session, usuariosDB]);

  useEffect(() => {
    if (!usuarioActivo) return;
    const channel = dbOficial.channel('global_presence', {
      config: { presence: { key: usuarioActivo.email } }
    });

    channel.on('presence', { event: 'sync' }, () => {
      const state = channel.presenceState();
      setOnlineUsers(Object.keys(state));
    }).subscribe(async (status) => {
      if (status === 'SUBSCRIBED') await channel.track({ nombre: usuarioActivo.nombre });
    });

    return () => { dbOficial.removeChannel(channel); };
  }, [usuarioActivo]);

  const manejarLogin = async (e, isSwitch = false) => {
    e.preventDefault();
    const targetEmail = isSwitch ? switchEmail : emailInput;
    const targetPass = isSwitch ? switchPass : passInput;

    const { error } = await dbOficial.auth.signInWithPassword({ email: targetEmail, password: targetPass });
    if (error) {
      alert("Credenciales incorrectas: " + error.message);
      return;
    }
    if (isSwitch) {
      setMostrarCambioSesion(false);
      setSwitchPass('');
    }
  };

  const cerrarSesion = () => dbOficial.auth.signOut();

  if (!session || !usuarioActivo) {
    return (
      <div className="container-fluid min-vh-100 d-flex align-items-center justify-content-center bg-light p-3">
        <div className="card p-4 shadow-sm border-0 w-100" style={{ maxWidth: '400px', borderRadius: '12px' }}>
          <h4 className="text-center mb-4 fw-bold" style={{ color: '#6B1116' }}>RSR Repuestos</h4>
          <form onSubmit={(e) => manejarLogin(e, false)}>
            <div className="mb-3">
              <label className="form-label small fw-bold text-muted">Usuario</label>
              <select className="form-select fw-bold" value={emailInput} onChange={(e) => setEmailInput(e.target.value)} required>
                <option value="">Seleccionar usuario...</option>
                {usuariosDB.map(u => <option key={u.email} value={u.email}>{u.nombre}</option>)}
              </select>
            </div>
            <div className="mb-4">
              <label className="form-label small fw-bold text-muted">Contraseña</label>
              <input type="password" className="form-control fw-bold" value={passInput} onChange={(e) => setPassInput(e.target.value)} required />
            </div>
            <button type="submit" className="btn text-white w-100 fw-bold py-2 shadow" style={{ backgroundColor: '#6B1116' }}>Ingresar</button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="container-fluid p-0 d-flex flex-column vh-100">
      
      {mostrarCambioSesion && (
        <div className="position-fixed top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center p-3" style={{ zIndex: 10000, background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }}>
          <div className="card shadow-lg border-0 p-4 w-100" style={{ maxWidth: '380px', borderRadius: '12px' }}>
            <div className="d-flex justify-content-between align-items-center mb-3">
              <h5 className="m-0 fw-bold text-dark d-flex align-items-center gap-2"><RefreshCw size={18}/> Cambio Rápido</h5>
              <button onClick={() => setMostrarCambioSesion(false)} className="btn-close"></button>
            </div>
            <form onSubmit={(e) => manejarLogin(e, true)}>
              <div className="mb-3">
                <label className="form-label small fw-bold text-muted">Identificarse como:</label>
                <select className="form-select fw-bold" value={switchEmail} onChange={(e) => setSwitchEmail(e.target.value)} required>
                  <option value="">Seleccionar...</option>
                  {usuariosDB.map(u => <option key={u.email} value={u.email}>{u.nombre}</option>)}
                </select>
              </div>
              <div className="mb-3">
                <input type="password" placeholder="Contraseña" className="form-control fw-bold" value={switchPass} onChange={(e) => setSwitchPass(e.target.value)} required />
              </div>
              <button type="submit" className="btn btn-dark w-100 fw-bold">Entrar y Reemplazar</button>
            </form>
          </div>
        </div>
      )}

      {vista === 'dashboard' && (
        <MenuDashboard 
          cambiarPantalla={setVista} 
          usuarioActivo={usuarioActivo} 
          usuariosDB={usuariosDB} 
          onlineUsers={onlineUsers}
          abrirCambioSesion={() => { setSwitchEmail(''); setSwitchPass(''); setMostrarCambioSesion(true); }}
          cerrarSesion={cerrarSesion}
        />
      )}

      {/* Fijate cómo quedó limpio el llamado al Mostrador */}
      {vista === 'mostrador' && (
        <Mostrador 
          volverAlMenu={() => setVista('dashboard')}
          usuarioOperador={usuarioActivo.nombre}
        />
      )}

      {vista === 'configuracion' && <Configuracion volverAlMenu={() => setVista('dashboard')} />}
      {vista === 'deposito' && <Deposito volverAlMenu={() => setVista('dashboard')} />}
      {vista === 'clientes' && <Clientes volverAlMenu={() => setVista('dashboard')} />}
      {vista === 'pedidos' && <Pedidos volverAlMenu={() => setVista('dashboard')} />}
      {vista === 'contabilidad' && <Contabilidad volverAlMenu={() => setVista('dashboard')} />} 
      {vista === 'stock' && <GestionStock volverAlMenu={() => setVista('dashboard')} />}
      {(vista === 'comprobantes' || vista === 'historial') && <HistorialComprobantes volverAlMenu={() => setVista('dashboard')} />}
    </div>
  );
}

export default App;