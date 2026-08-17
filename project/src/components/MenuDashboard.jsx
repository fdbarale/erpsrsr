import React, { useState, useEffect, useRef } from "react";
import { dbOficial } from '../supabaseClient';
import {
  Bell, Package, Users, Phone, DollarSign, ClipboardList,
  Search, Plus, Check, LogOut, Trash2, ShoppingBag,
  Volume2, Edit2, Settings, Clock, Truck, ShoppingCart, FileText, Box, Home, Receipt, PieChart, RefreshCw
} from "lucide-react";

const C = {
  brandBordo: "#6B1116", brandGris: "#54565b", bg: "#f4f6f8", panel: "#ffffff", border: "#dee2e6",
  text: "#212529", textDim: "#6c757d", green: "#198754", orange: "#fd7e14", red: "#dc3545", purple: "#6f42c1", blue: "#0d6efd", pink: "#d63384"
};

const CATEGORIES = [
  { id: "pedido", label: "Pedido / Falta", color: C.red, icon: ClipboardList },
  { id: "encargo", label: "Armar pedido", color: C.brandBordo, icon: Package },
  { id: "retiro", label: "Comisionista", color: "#20c997", icon: Users },
  { id: "cadete", label: "Cadete", color: C.purple, icon: Truck },
  { id: "proveedor", label: "Consulta proveedor", color: C.blue, icon: Phone },
  { id: "rotativo", label: "Aviso Rotativo", color: C.pink, icon: Clock },
  { id: "factura", label: "Facturas / Pagos", color: C.orange, icon: DollarSign },
  { id: "urgente", label: "URGENTE", color: C.red, icon: Bell },
];

const ALLOWED_PAYMENT_ROLES = ["oficina", "guillermo", "fernando"];

const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2);

function timeAgo(ts) {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return "recién";
  const m = Math.floor(s / 60); if (m < 60) return `hace ${m}m`;
  const h = Math.floor(m / 60); if (h < 24) return `hace ${h}h`;
  return `hace ${Math.floor(h / 24)}d`;
}

const isTodayOrPast = (dateStr) => {
  if (!dateStr) return false;
  const d = new Date(dateStr + 'T00:00:00');
  const today = new Date(); today.setHours(0, 0, 0, 0);
  return d <= today;
};

const formatAmount = (val) => {
  if (!val) return null; if (val === "PAGADO") return "PAGADO";
  const n = Number(val); return isNaN(n) ? val : `$ ${n.toLocaleString("es-AR")}`;
};

export default function MenuDashboard({ cambiarPantalla, usuarioActivo, usuariosDB, onlineUsers, abrirCambioSesion, cerrarSesion }) {
  const [notices, setNotices] = useState([]);
  const [encargues, setEncargues] = useState([]);
  
  const [avisoSearch, setAvisoSearch] = useState("");
  const [composeText, setComposeText] = useState("");
  const [composeCat, setComposeCat] = useState("pedido");
  const [composeDueDate, setComposeDueDate] = useState("");
  const [showNewAviso, setShowNewAviso] = useState(false);
  const [editingNoticeId, setEditingNoticeId] = useState(null);
  const [editNoticeData, setEditNoticeData] = useState({ text: "", category: "pedido", dueDate: "" });
  
  const [encSearch, setEncSearch] = useState("");
  const [newEnc, setNewEnc] = useState({ cliente: "", telefono: "", repuestos: "", senia: "", monto: "" });
  const [showNewEnc, setShowNewEnc] = useState(false);
  const [editingEncId, setEditingEncId] = useState(null);
  const [editEncData, setEditEncData] = useState({ cliente: "", telefono: "", repuestos: "", senia: "", monto: "" });

  const [alarmTarget, setAlarmTarget] = useState(null);
  const [alarmMsg, setAlarmMsg] = useState("");
  const [activeAlarm, setActiveAlarm] = useState(null); 
  const audioCtxRef = useRef(null);
  const beepIntervalRef = useRef(null);
  const [manualAlarmData, setManualAlarmData] = useState(null);

  const catInfo = id => CATEGORIES.find(c => c.id === id) || CATEGORIES[0];

  const cargarAvisos = async () => {
    const { data } = await dbOficial.from('intercom_avisos').select('*').order('timestamp', { ascending: true });
    if (data) setNotices(data.map(d => ({ ...d, dueDate: d.due_date, snoozeUntil: d.snooze_until })));
  };

  const cargarEncargues = async () => {
    const { data } = await dbOficial.from('intercom_encargues').select('*').order('ts', { ascending: true });
    if (data) setEncargues(data);
  };

  useEffect(() => {
    cargarAvisos();
    cargarEncargues();

    const canal = dbOficial.channel('intercom_datos')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'intercom_avisos' }, cargarAvisos)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'intercom_encargues' }, cargarEncargues)
      .subscribe();

    return () => { dbOficial.removeChannel(canal); };
  }, []);

  const canViewPayments = ALLOWED_PAYMENT_ROLES.some(role => usuarioActivo.nombre.toLowerCase().includes(role));

  useEffect(() => {
    const cargarAlarma = async () => {
      const { data } = await dbOficial.from('intercom_alarmas').select('*').eq('user_id', usuarioActivo.email).eq('active', true).maybeSingle();
      setManualAlarmData(data ? { ...data, from: data.from_user } : null);
    };
    
    cargarAlarma();
    const canalAlarma = dbOficial.channel(`alarma_${usuarioActivo.email}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'intercom_alarmas', filter: `user_id=eq.${usuarioActivo.email}` }, cargarAlarma)
      .subscribe();

    return () => { dbOficial.removeChannel(canalAlarma); };
  }, [usuarioActivo.email]);

  useEffect(() => {
    const checkAllAlarms = () => {
      if (activeAlarm) return;
      const now = Date.now();
      
      if (manualAlarmData) {
        setActiveAlarm({ type: 'manual', id: manualAlarmData.id, title: `Llamada de ${manualAlarmData.from}`, msg: manualAlarmData.message });
        return;
      }
      
      if (canViewPayments) {
        const pendingFacturas = notices.filter(n => !n.done && n.category === 'factura' && isTodayOrPast(n.dueDate));
        if (pendingFacturas.length > 0 && !pendingFacturas.every(n => now < (n.snoozeUntil || 0))) {
          setActiveAlarm({ type: 'factura', title: "Factura / Pago Pendiente", msg: "Tenés vencimientos del día sin resolver." });
          return;
        }
      }
      
      const pendingRetiros = notices.filter(n => !n.done && (n.category === 'cadete' || n.category === 'retiro') && isTodayOrPast(n.dueDate));
      if (pendingRetiros.length > 0 && !pendingRetiros.every(n => now < (n.snoozeUntil || 0))) {
        setActiveAlarm({ type: 'retiro', title: "Retiro Programado", msg: "Hay cadetes o comisionistas agendados para hoy." });
        return;
      }

      const activeRotativos = notices.filter(n => !n.done && n.category === 'rotativo');
      if (activeRotativos.length > 0 && usuariosDB.length > 0) {
        const sortedEmps = [...usuariosDB].sort((a, b) => a.nombre.localeCompare(b.nombre));
        for (const n of activeRotativos) {
          const elapsed15m = Math.floor((now - n.timestamp) / (15 * 60 * 1000));
          if (sortedEmps[elapsed15m % sortedEmps.length].email === usuarioActivo.email && now > (n.snoozeUntil || 0)) {
            setActiveAlarm({ type: 'rotativo', id: n.id, n: n, title: "Aviso Rotativo - Tu Turno", msg: n.text });
            return;
          }
        }
      }
    };

    checkAllAlarms();
    const ticker = setInterval(checkAllAlarms, 10000); 
    return () => clearInterval(ticker);
  }, [usuarioActivo, manualAlarmData, notices, canViewPayments, usuariosDB, activeAlarm]);

  useEffect(() => {
    if (activeAlarm) {
      try {
        if (!audioCtxRef.current) audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
        const beep = () => {
          const ctx = audioCtxRef.current; if (!ctx) return;
          const osc = ctx.createOscillator(); const gain = ctx.createGain();
          osc.type = "square"; osc.frequency.value = 880;
          gain.gain.setValueAtTime(0.0001, ctx.currentTime);
          gain.gain.linearRampToValueAtTime(0.15, ctx.currentTime + 0.02);
          gain.gain.linearRampToValueAtTime(0.0001, ctx.currentTime + 0.35);
          osc.connect(gain).connect(ctx.destination); osc.start(); osc.stop(ctx.currentTime + 0.4);
        };
        beep(); beepIntervalRef.current = setInterval(beep, 900);
      } catch {}
    }
    return () => { if (beepIntervalRef.current) { clearInterval(beepIntervalRef.current); beepIntervalRef.current = null; } };
  }, [activeAlarm]);

  const handleAlarmAction = async (action) => {
    const now = Date.now();
    if (activeAlarm.type === 'manual') {
      await dbOficial.from('intercom_alarmas').update({ active: false }).eq('id', manualAlarmData.id);
    }
    else if (activeAlarm.type === 'factura' && action === 'posponer') {
      const facturasActivas = notices.filter(n => !n.done && n.category === 'factura' && isTodayOrPast(n.dueDate));
      for (const n of facturasActivas) await dbOficial.from('intercom_avisos').update({ snooze_until: now + 2 * 60 * 60 * 1000 }).eq('id', n.id);
    }
    else if (activeAlarm.type === 'retiro' && action === 'posponer') {
      const retirosActivos = notices.filter(n => !n.done && (n.category === 'cadete' || n.category === 'retiro') && isTodayOrPast(n.dueDate));
      for (const n of retirosActivos) await dbOficial.from('intercom_avisos').update({ snooze_until: now + 2 * 60 * 60 * 1000 }).eq('id', n.id);
    } 
    else if (activeAlarm.type === 'rotativo' && action === 'posponer') {
      const elapsed15m = Math.floor((now - activeAlarm.n.timestamp) / (15 * 60 * 1000));
      await dbOficial.from('intercom_avisos').update({ snooze_until: activeAlarm.n.timestamp + (elapsed15m + 1) * 15 * 60 * 1000 }).eq('id', activeAlarm.id);
    } 
    setActiveAlarm(null);
  };

  const postNotice = async () => {
    const text = composeText.trim(); if (!text) return;
    const newNotice = { id: uid(), category: composeCat, text, due_date: composeDueDate, author: usuarioActivo.nombre, timestamp: Date.now(), done: false };
    setNotices([...notices, { ...newNotice, dueDate: composeDueDate }]);
    setComposeText(""); setComposeDueDate(""); setShowNewAviso(false);
    await dbOficial.from('intercom_avisos').insert([newNotice]);
  };

  const startEditNotice = (n) => { setEditingNoticeId(n.id); setEditNoticeData({ text: n.text, category: n.category, dueDate: n.dueDate || "" }); };
  
  const saveEditNotice = async () => {
    if (!editNoticeData.text.trim()) return;
    await dbOficial.from('intercom_avisos').update({ text: editNoticeData.text.trim(), category: editNoticeData.category, due_date: editNoticeData.dueDate }).eq('id', editingNoticeId);
    setEditingNoticeId(null);
  };

  const toggleDone = async (id) => { 
    const n = notices.find(x => x.id === id);
    await dbOficial.from('intercom_avisos').update({ done: !n.done }).eq('id', id);
  };

  const deleteNotice = async (id) => { 
    if (window.confirm("¿Borrar este aviso?")) await dbOficial.from('intercom_avisos').delete().eq('id', id); 
  };
  
  const sendAlarm = async () => {
    if (!alarmTarget) return;
    await dbOficial.from('intercom_alarmas').upsert({
      id: uid(), user_id: alarmTarget.email, active: true, message: alarmMsg.trim() || "TE LLAMAN DEL MOSTRADOR/DEPÓSITO",
      from_user: usuarioActivo.nombre, timestamp: Date.now()
    });
    setAlarmTarget(null); setAlarmMsg("");
  };

  const addEncargo = async () => {
    if (!newEnc.cliente.trim()) return alert("Falta el nombre del cliente.");
    const nuevoEnc = { id: uid(), ...newEnc, author: usuarioActivo.nombre, llegado: false, entregado: false, ts: Date.now() };
    setEncargues([...encargues, nuevoEnc]);
    setNewEnc({ cliente: "", telefono: "", repuestos: "", senia: "", monto: "" }); setShowNewEnc(false);
    await dbOficial.from('intercom_encargues').insert([nuevoEnc]);
  };

  const startEditEnc = (enc) => {
    setEditingEncId(enc.id);
    setEditEncData({ cliente: enc.cliente || "", telefono: enc.telefono || "", repuestos: enc.repuestos || "", senia: enc.senia || "", monto: enc.monto || "" });
  };

  const saveEditEnc = async (id) => {
    if (!editEncData.cliente.trim()) return;
    await dbOficial.from('intercom_encargues').update({ ...editEncData }).eq('id', id);
    setEditingEncId(null);
  };

  const toggleLlegado = async (id) => { 
    const e = encargues.find(x => x.id === id);
    await dbOficial.from('intercom_encargues').update({ llegado: !e.llegado }).eq('id', id);
  };

  const marcarEntregado = async (id) => {
    if (!window.confirm("¿Marcar como entregado y archivar?")) return;
    await dbOficial.from('intercom_encargues').delete().eq('id', id);
  };

  const avisosFiltrados = notices.filter(n => {
    if (n.category === "factura" && !canViewPayments) return false;
    return n.text.toLowerCase().includes(avisoSearch.toLowerCase()) || n.author.toLowerCase().includes(avisoSearch.toLowerCase());
  }).sort((a, b) => a.timestamp - b.timestamp);

  const encarguesFiltrados = encargues.filter(e => e.cliente.toLowerCase().includes(encSearch.toLowerCase()) || (e.repuestos && e.repuestos.toLowerCase().includes(encSearch.toLowerCase()))).sort((a, b) => a.ts - b.ts);

  const MENU_BOTONES = [
    { id: 'mostrador', titulo: 'Mostrador Principal', icono: <ShoppingCart size={24}/> },
    { id: 'clientes', titulo: 'Clientes', icono: <Users size={24}/> },
    { id: 'pedidos', titulo: 'Pedidos', icono: <FileText size={24}/> },
    { id: 'stock', titulo: 'Gestión de Stock', icono: <Box size={24}/> },
    { id: 'deposito', titulo: 'Depósito', icono: <Home size={24}/> },
    { id: 'historial', titulo: 'Comprobantes', icono: <Receipt size={24}/> },
    { id: 'contabilidad', titulo: 'Contabilidad', icono: <PieChart size={24}/> },
    { id: 'configuracion', titulo: 'Configuración', icono: <Settings size={24}/> },
  ];

  return (
    <div className="d-flex flex-column h-100 bg-light">
      {/* CSS RESPONSIVO INYECTADO */}
      <style>{`
        .grilla-modulos { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; }
        @media (min-width: 576px) { .grilla-modulos { grid-template-columns: repeat(4, 1fr); } }
        @media (min-width: 992px) { .grilla-modulos { grid-template-columns: repeat(8, 1fr); gap: 12px; } }
        
        .panel-central { display: flex; flex-direction: column; overflow-y: auto; }
        .col-llamador { width: 100%; min-height: auto; flex-shrink: 0; }
        .col-modulos { width: 100%; display: flex; flex-direction: column; min-height: 500px; }
        
        @media (min-width: 992px) {
          .panel-central { flex-direction: row; overflow: hidden; }
          .col-llamador { width: 250px; height: 100%; }
          .col-modulos { flex-grow: 1; height: 100%; min-height: 0; }
        }
      `}</style>

      {/* ALARMAS DISPARADAS */}
      {activeAlarm && (
        <div className="position-fixed top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center p-3" style={{ zIndex: 9999, background: "rgba(15, 23, 42, 0.75)", backdropFilter: "blur(3px)" }}>
          <div className="card shadow-lg text-center p-4 border-danger border-3 w-100" style={{ maxWidth: 450, borderRadius: '16px' }}>
            <div className="mx-auto text-white rounded-circle d-flex align-items-center justify-content-center mb-3 shadow" style={{ width: 80, height: 80, backgroundColor: C.red }}><Bell size={40}/></div>
            <h5 className="text-danger fw-bold text-uppercase">{activeAlarm.title}</h5>
            <p className="fs-5 mb-4 fw-semibold text-dark">{activeAlarm.msg}</p>
            <div className="d-flex flex-column flex-sm-row gap-2 justify-content-center">
              {activeAlarm.type === 'manual' && <button onClick={() => handleAlarmAction('ok')} className="btn btn-danger fw-bold px-4 py-2"><Check className="me-2"/> RECIBIDO</button>}
              {(activeAlarm.type === 'factura' || activeAlarm.type === 'retiro' || activeAlarm.type === 'rotativo') && (
                <>
                  <button onClick={() => handleAlarmAction('posponer')} className="btn btn-outline-secondary fw-bold px-3">Posponer</button>
                  <button onClick={() => handleAlarmAction('revisar')} className="btn btn-danger fw-bold px-4">Ir a Revisar</button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL DISPARAR ALARMA MANUAL */}
      {alarmTarget && (
        <div className="position-fixed top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center p-3" style={{ zIndex: 9998, background: "rgba(0,0,0,0.5)" }}>
          <div className="card shadow-lg p-4 w-100" style={{ maxWidth: 400, borderRadius: '12px' }}>
            <div className="d-flex justify-content-between mb-3"><h5 className="fw-bold m-0 text-uppercase">Llamar a {alarmTarget.nombre}</h5><button onClick={() => setAlarmTarget(null)} className="btn-close"></button></div>
            <textarea value={alarmMsg} onChange={e => setAlarmMsg(e.target.value.toUpperCase())} placeholder="Motivo o mensaje rápido (opcional)..." className="form-control mb-3 fw-bold" rows={3}/>
            <button onClick={sendAlarm} className="btn fw-bold py-2 text-white shadow" style={{ backgroundColor: C.brandBordo }}><Volume2 className="me-2"/> DISPARAR ALARMA</button>
          </div>
        </div>
      )}

      {/* BARRA SUPERIOR */}
      <nav className="navbar navbar-dark shadow-sm px-3 px-lg-4 flex-shrink-0" style={{ backgroundColor: C.brandBordo, borderBottom: `4px solid ${C.brandGris}` }}>
        <div className="container-fluid p-0 d-flex flex-column flex-sm-row justify-content-between align-items-center gap-2">
          <span className="navbar-brand fw-bold m-0 tracking-wide fs-5">RSR - ERP</span>
          <div className="d-flex align-items-center gap-2">
            <div className="bg-dark bg-opacity-50 text-white border border-light border-opacity-25 d-flex align-items-center gap-2 px-3 py-1 rounded-pill">
              <div className="rounded-circle bg-success" style={{ width: 8, height: 8 }}></div>
              <span className="fw-bold small text-truncate" style={{ maxWidth: '120px' }}>{usuarioActivo.nombre}</span>
            </div>
            <button onClick={abrirCambioSesion} className="btn btn-sm btn-outline-light border-0 fw-bold d-flex align-items-center" title="Cambio Rápido de Sesión"><RefreshCw size={16} className="d-none d-sm-block me-1"/><RefreshCw size={18} className="d-block d-sm-none"/></button>
            <button onClick={cerrarSesion} className="btn btn-sm btn-outline-light border-0 fw-bold d-flex align-items-center" title="Cerrar Sesión Definitivamente"><LogOut size={18}/></button>
          </div>
        </div>
      </nav>

      {/* MENÚ DE MÓDULOS (GRILLA CSS RESPONSIVA) */}
      <div className="bg-white border-bottom shadow-sm p-3 flex-shrink-0">
        <div className="grilla-modulos">
          {MENU_BOTONES.map(btn => (
            <button 
              key={btn.id} 
              onClick={() => cambiarPantalla(btn.id)} 
              className="btn btn-light bg-white border shadow-sm d-flex flex-column align-items-center justify-content-center p-2" 
              style={{ borderRadius: '10px', height: '80px', transition: 'transform 0.15s ease, border-color 0.15s ease' }}
              onMouseEnter={e => e.currentTarget.style.borderColor = C.brandBordo}
              onMouseLeave={e => e.currentTarget.style.borderColor = '#dee2e6'}
            >
              <div style={{ color: C.brandBordo, marginBottom: '6px' }}>{btn.icono}</div>
              <span className="fw-bold text-dark text-center" style={{ fontSize: '11px', lineHeight: '1.2' }}>{btn.titulo}</span>
            </button>
          ))}
        </div>
      </div>

      {/* CUERPO PRINCIPAL: PANEL CENTRAL RESPONSIVO */}
      <div className="panel-central p-2 p-lg-3 gap-3 flex-grow-1">
        
        {/* COL 1: LLAMADOR */}
        <div className="col-llamador card shadow-sm border-0 d-flex flex-column bg-white">
          <div className="card-header bg-white border-bottom py-2 py-lg-3">
            <h6 className="m-0 fw-bold text-muted text-center text-uppercase small"><Volume2 size={16} className="me-2"/>Llamador Interno</h6>
          </div>
          <div className="card-body overflow-auto p-2 d-flex flex-row flex-lg-column gap-2" style={{ overflowX: 'auto' }}>
            {usuariosDB.filter(u => u.email !== usuarioActivo.email).map(u => {
              const isOnline = onlineUsers.includes(u.email);
              return (
                <button 
                  key={u.email} 
                  onClick={() => { setAlarmTarget(u); setAlarmMsg(""); }} 
                  className={`btn border text-start p-2 p-lg-3 shadow-sm d-flex justify-content-between align-items-center flex-shrink-0 ${isOnline ? 'bg-white' : 'bg-light opacity-50'}`}
                  style={{ borderRadius: '8px', filter: isOnline ? 'none' : 'grayscale(100%)', cursor: 'pointer', minWidth: '160px' }}
                  title={isOnline ? "En línea" : "Desconectado"}
                >
                  <div className="d-flex align-items-center gap-2">
                    <Bell size={16} className={isOnline ? "text-danger" : "text-secondary"}/>
                    <span className={`fw-bold small ${isOnline ? 'text-dark' : 'text-muted'}`}>{u.nombre}</span>
                  </div>
                  <div className={`rounded-circle ${isOnline ? 'bg-success' : 'bg-secondary'}`} style={{ width: 8, height: 8 }}></div>
                </button>
              );
            })}
          </div>
        </div>

        {/* COL 2: AVISOS Y TAREAS */}
        <div className="col-modulos card shadow-sm border-0 bg-white" style={{ borderRadius: '12px' }}>
          <div className="card-header bg-white border-bottom py-3 d-flex flex-column flex-sm-row justify-content-between align-items-sm-center gap-2">
            <div className="d-flex align-items-center gap-2">
              <ClipboardList size={20} style={{ color: C.brandBordo }}/>
              <h6 className="m-0 fw-bold text-uppercase small">Avisos y Tareas</h6>
            </div>
            <div className="d-flex gap-2 w-100 w-sm-auto">
              <div className="position-relative flex-grow-1">
                <Search size={14} className="position-absolute top-50 start-0 translate-middle-y ms-2 text-muted"/>
                <input type="text" className="form-control form-control-sm ps-4 bg-light rounded-pill border-0 fw-semibold w-100" placeholder="Buscar..." value={avisoSearch} onChange={e => setAvisoSearch(e.target.value)}/>
              </div>
              <button onClick={() => setShowNewAviso(!showNewAviso)} className="btn btn-sm text-white fw-bold rounded-pill px-3 shadow-sm flex-shrink-0" style={{ backgroundColor: C.brandBordo }}><Plus size={14} className="d-none d-sm-inline"/> Nuevo</button>
            </div>
          </div>
          <div className="card-body overflow-auto p-0 bg-light">
            {showNewAviso && (
              <div className="bg-white border-bottom p-3 shadow-sm">
                <textarea className="form-control mb-2 fw-bold" placeholder="Escribir aviso o tarea..." rows={2} value={composeText} onChange={e => setComposeText(e.target.value.toUpperCase())}></textarea>
                <div className="d-flex flex-wrap gap-2 align-items-center">
                  <select className="form-select form-select-sm fw-bold w-auto" value={composeCat} onChange={e => setComposeCat(e.target.value)}>
                    {CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                  </select>
                  {(composeCat === "factura" || composeCat === "retiro" || composeCat === "cadete") && <input type="date" className="form-control form-control-sm w-auto fw-bold" value={composeDueDate} onChange={e => setComposeDueDate(e.target.value)}/>}
                  <button onClick={postNotice} disabled={!composeText.trim()} className="btn btn-sm text-white fw-bold ms-auto px-4" style={{ backgroundColor: C.brandBordo }}>Publicar</button>
                </div>
              </div>
            )}
            <div className="p-2 p-lg-3 d-flex flex-column gap-2">
              {avisosFiltrados.length === 0 && <div className="text-center text-muted py-4 small">No hay avisos pendientes.</div>}
              {avisosFiltrados.map(n => {
                const cat = catInfo(n.category);
                if (editingNoticeId === n.id) return (
                  <div key={n.id} className="card border-warning shadow-sm p-3 mb-2 bg-white">
                    <textarea value={editNoticeData.text} onChange={e => setEditNoticeData({ ...editNoticeData, text: e.target.value.toUpperCase() })} className="form-control mb-2 fw-bold" rows={2}/>
                    <div className="d-flex gap-2 justify-content-end">
                      <button onClick={() => setEditingNoticeId(null)} className="btn btn-sm btn-light border fw-bold">Cancelar</button>
                      <button onClick={saveEditNotice} className="btn btn-sm btn-warning fw-bold">Guardar</button>
                    </div>
                  </div>
                );
                return (
                  <div key={n.id} className={`card border-0 shadow-sm ${n.done ? 'opacity-50 bg-light' : 'bg-white'}`} style={{ borderLeft: `4px solid ${cat.color} !important`, borderRadius: '8px' }}>
                    <div className="card-body p-2 p-lg-3">
                      <div className="d-flex flex-column flex-sm-row justify-content-between align-items-start mb-2 gap-2">
                        <div className="d-flex align-items-center gap-2 flex-wrap">
                          <span className="badge" style={{ backgroundColor: cat.color }}>{cat.label}</span>
                          <span className="small text-muted fw-bold">{n.author} • {timeAgo(n.timestamp)}</span>
                        </div>
                        <div className="btn-group">
                          <button onClick={() => startEditNotice(n)} className="btn btn-sm text-secondary p-1 border-0" title="Editar"><Edit2 size={14}/></button>
                          <button onClick={() => toggleDone(n.id)} className={`btn btn-sm p-1 border-0 ${n.done ? 'text-success' : 'text-secondary'}`} title="Marcar resuelto"><Check size={16} strokeWidth={n.done ? 3 : 2}/></button>
                          <button onClick={() => deleteNotice(n.id)} className="btn btn-sm text-danger p-1 border-0" title="Eliminar"><Trash2 size={14}/></button>
                        </div>
                      </div>
                      <p className={`m-0 fw-bold ${n.done ? 'text-decoration-line-through text-muted' : 'text-dark'}`} style={{ fontSize: '13px' }}>{n.text}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* COL 3: GESTIÓN DE ENCARGUES */}
        <div className="col-modulos card shadow-sm border-0 bg-white" style={{ borderRadius: '12px' }}>
          <div className="card-header bg-white border-bottom py-3 d-flex flex-column flex-sm-row justify-content-between align-items-sm-center gap-2">
            <div className="d-flex align-items-center gap-2">
              <ShoppingBag size={20} style={{ color: C.brandBordo }}/>
              <h6 className="m-0 fw-bold text-uppercase small">Gestión de Encargues</h6>
            </div>
            <div className="d-flex gap-2 w-100 w-sm-auto">
              <div className="position-relative flex-grow-1">
                <Search size={14} className="position-absolute top-50 start-0 translate-middle-y ms-2 text-muted"/>
                <input type="text" className="form-control form-control-sm ps-4 bg-light rounded-pill border-0 fw-semibold w-100" placeholder="Buscar..." value={encSearch} onChange={e => setEncSearch(e.target.value)}/>
              </div>
              <button onClick={() => setShowNewEnc(!showNewEnc)} className="btn btn-sm text-white fw-bold rounded-pill px-3 shadow-sm flex-shrink-0" style={{ backgroundColor: C.brandBordo }}><Plus size={14} className="d-none d-sm-inline"/> Nuevo</button>
            </div>
          </div>
          <div className="card-body overflow-auto p-0 bg-light">
            {showNewEnc && (
              <div className="bg-white border-bottom p-3 shadow-sm">
                <div className="row g-2 mb-2">
                  <div className="col-12 col-sm-6"><input className="form-control form-control-sm fw-bold" placeholder="CLIENTE *" value={newEnc.cliente} onChange={e => setNewEnc({ ...newEnc, cliente: e.target.value.toUpperCase() })}/></div>
                  <div className="col-12 col-sm-6"><input className="form-control form-control-sm fw-bold" placeholder="TELÉFONO" value={newEnc.telefono} onChange={e => setNewEnc({ ...newEnc, telefono: e.target.value.toUpperCase() })}/></div>
                </div>
                <input className="form-control form-control-sm mb-2 fw-bold" placeholder="DESCRIPCIÓN DEL REPUESTO" value={newEnc.repuestos} onChange={e => setNewEnc({ ...newEnc, repuestos: e.target.value.toUpperCase() })}/>
                <div className="row g-2 mb-2">
                  <div className="col-6"><input className="form-control form-control-sm fw-bold" placeholder="SEÑA ($ O PAGADO)" value={newEnc.senia} onChange={e => setNewEnc({ ...newEnc, senia: e.target.value.toUpperCase() })}/></div>
                  <div className="col-6"><input className="form-control form-control-sm fw-bold" placeholder="TOTAL EST. ($)" value={newEnc.monto} onChange={e => setNewEnc({ ...newEnc, monto: e.target.value.toUpperCase() })}/></div>
                </div>
                <div className="text-end"><button onClick={addEncargo} className="btn btn-sm text-white fw-bold px-4" style={{ backgroundColor: C.brandBordo }}>Guardar</button></div>
              </div>
            )}
            <div className="p-2 p-lg-3 d-flex flex-column gap-2">
              {encarguesFiltrados.length === 0 && <div className="text-center text-muted py-4 small">No hay encargues registrados.</div>}
              {encarguesFiltrados.map(enc => {
                if (editingEncId === enc.id) return (
                  <div key={enc.id} className="card border-warning shadow-sm p-3 mb-2 bg-white">
                    <div className="row g-2 mb-2"><div className="col-12 col-sm-6"><input className="form-control form-control-sm fw-bold" value={editEncData.cliente} onChange={e => setEditEncData({ ...editEncData, cliente: e.target.value.toUpperCase() })}/></div><div className="col-12 col-sm-6"><input className="form-control form-control-sm fw-bold" value={editEncData.telefono} onChange={e => setEditEncData({ ...editEncData, telefono: e.target.value.toUpperCase() })}/></div></div>
                    <input className="form-control form-control-sm mb-2 fw-bold" value={editEncData.repuestos} onChange={e => setEditEncData({ ...editEncData, repuestos: e.target.value.toUpperCase() })}/>
                    <div className="row g-2 mb-2"><div className="col-6"><input className="form-control form-control-sm fw-bold" value={editEncData.senia} onChange={e => setEditEncData({ ...editEncData, senia: e.target.value.toUpperCase() })}/></div><div className="col-6"><input className="form-control form-control-sm fw-bold" value={editEncData.monto} onChange={e => setEditEncData({ ...editEncData, monto: e.target.value.toUpperCase() })}/></div></div>
                    <div className="d-flex gap-2 justify-content-end"><button onClick={() => setEditingEncId(null)} className="btn btn-sm btn-light border fw-bold">Cancelar</button><button onClick={() => saveEditEnc(enc.id)} className="btn btn-sm btn-warning fw-bold">Guardar</button></div>
                  </div>
                );
                
                const isPagado = enc.senia === "PAGADO" || (enc.senia && enc.monto && Number(enc.senia) === Number(enc.monto) && Number(enc.monto) > 0);
                
                return (
                  <div key={enc.id} className={`card border-0 shadow-sm ${enc.entregado ? 'opacity-50' : 'bg-white'}`} style={{ borderLeft: enc.llegado ? `4px solid ${C.green} !important` : '4px solid transparent !important', borderRadius: '8px' }}>
                    <div className="card-body p-2 p-lg-3">
                      <div className="d-flex justify-content-between mb-1"><h6 className="m-0 fw-bold text-dark">{enc.cliente}</h6><span className="small text-muted font-monospace">{enc.telefono || '-'}</span></div>
                      <p className="small text-dark fw-bold mb-2">{enc.repuestos || 'Sin detalle'}</p>
                      <div className="d-flex justify-content-between align-items-center mb-3 p-2 bg-light rounded"><div className="d-flex flex-column"><span className="small text-muted fw-bold" style={{ fontSize: '10px' }}>SEÑA</span><span className={`fw-bold font-monospace small ${isPagado || enc.senia ? 'text-success' : 'text-muted'}`}>{isPagado ? 'PAGADO' : formatAmount(enc.senia) || '-'}</span></div><div className="d-flex flex-column text-end"><span className="small text-muted fw-bold" style={{ fontSize: '10px' }}>TOTAL</span><span className="fw-bold font-monospace text-dark small">{formatAmount(enc.monto) || '-'}</span></div></div>
                      <div className="d-flex flex-column flex-sm-row justify-content-between align-items-start align-items-sm-center gap-2">
                        <span className="small text-muted" style={{ fontSize: '11px' }}>{enc.author} • {timeAgo(enc.ts)}</span>
                        <div className="btn-group shadow-sm w-100 w-sm-auto">
                          <button onClick={() => toggleLlegado(enc.id)} className={`btn btn-sm border fw-bold w-100 ${enc.llegado ? 'bg-success text-white' : 'bg-white text-secondary'}`} title="Marcar si llegó">{enc.llegado ? '✓ Llegó' : 'Pendiente'}</button>
                          <button onClick={() => enc.llegado && marcarEntregado(enc.id)} className="btn btn-sm border fw-bold bg-white text-danger w-100" disabled={!enc.llegado} title="Entregar y archivar">Entregar</button>
                          <button onClick={() => startEditEnc(enc)} className="btn btn-sm bg-white border text-secondary w-auto" title="Editar"><Edit2 size={13}/></button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}