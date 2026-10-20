/* ===========================================================================
   Módulo TAREAS — pensado para TDAH: pocas cosas a la vista, captura rápida,
   "lo más importante de hoy" (máx. 3), modo foco con temporizador y deshacer.
   Datos: DB 'tareas' (Firestore suitedata/tareas). No toca nada del resto de la app.
   =========================================================================== */
(function(){
  if(window.__tareasInit) return; window.__tareasInit = true;

  var KEY = 'tareas';
  var T = [], B = [];                                   // todas las tareas
  var st = { fPrio:'todas', fFecha:'todas', verArch:false, verFiltros:false, saltadas:[], verDespues:false, verTodas:false, abiertas:{}, estadoV:'curso', estadoElegido:false, vista:'hoy', filtro:'todas', verAtrasadas:false, verMasHoy:false, area:'', areaMas:{}, areaHechas:false, addFecha:null, addLista:'', foco:null, sync:null };
  try { st.estadoV = localStorage.getItem('tr_estadoV') || 'curso'; st.vista = localStorage.getItem('tr_vista') || 'hoy'; if(st.vista==='hechas'){ st.vista='tareas'; st.estadoV='completada'; st.estadoElegido=true; } st.filtro = localStorage.getItem('tr_filtro') || 'todas'; st.addLista = localStorage.getItem('tr_lista') || ''; } catch(e){}
  var MAX_HOY = 8;

  // ---------- utilidades ----------
  function esc(s){ return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
  function p2(n){ return String(n).padStart(2,'0'); }
  function ymd(d){ return d.getFullYear()+'-'+p2(d.getMonth()+1)+'-'+p2(d.getDate()); }
  function hoy(){ return ymd(new Date()); }
  function desdeYMD(s){ var a=s.split('-'); return new Date(+a[0],+a[1]-1,+a[2]); }
  function sumarDias(s,n){ var d=desdeYMD(s); d.setDate(d.getDate()+n); return ymd(d); }
  function nuevoId(){ return 't'+Date.now().toString(36)+Math.random().toString(36).slice(2,6); }
  function fechaCorta(s){ return desdeYMD(s).toLocaleDateString('es-CO',{weekday:'short',day:'numeric',month:'short'}).replace('.',''); }
  function etiquetaDia(s){
    var h=hoy(); if(s===h) return 'Hoy'; if(s===sumarDias(h,1)) return 'Mañana'; if(s===sumarDias(h,-1)) return 'Ayer';
    return fechaCorta(s);
  }
  function horaTxt(h){ if(!h) return ''; var a=h.split(':'), hh=+a[0]; return (hh%12===0?12:hh%12)+':'+a[1]+' '+(hh<12?'a. m.':'p. m.'); }
  function listas(){
    var base=null;
    try { if(typeof agCalendarios==='function'){ var c=agCalendarios(); if(c && c.length) base=c; } } catch(e){}
    if(!base) base=[{id:'consultorio',nombre:'Consultorio',color:'#cd8e9d'},{id:'personal',nombre:'Personal',color:'#7986cb'},{id:'conmovilidad',nombre:'CONMOVILIDAD',color:'#33b679'}];
    if(!base.some(function(l){ return l.id==='hospital' || /hospital/i.test(l.nombre); })) base=base.concat([{id:'hospital',nombre:'Hospital',color:'#f4511e'}]);
    return base;
  }
  function lista(id){ var l=listas().filter(function(x){return x.id===id;})[0]; return l || listas()[0]; }
  function ls(k,v){ try{ localStorage.setItem(k,v); }catch(e){} }

  // ---------- ÁREAS ----------
  var DESC_AREA = {
    consultorio:'Pacientes, agenda, seguimiento administrativo, contenido, captación y desarrollo del consultorio.',
    conmovilidad:'Diseños, entregables, reuniones, solicitudes y fechas de entrega.',
    hospital:'Turnos, actividades laborales, trámites y pendientes relacionados con ese trabajo.',
    personal:'Casa, diligencias, finanzas personales, actividades familiares y asuntos propios.'
  };
  var COLORES_AREA = ['#cd8e9d','#e67c73','#f4511e','#f6bf26','#33b679','#039be5','#7986cb','#8e24aa','#616161'];
  function descMap(){ var m=null; try{ m=DB.get('areas_desc'); }catch(e){} return (m && typeof m==='object' && !Array.isArray(m)) ? m : {}; }
  function descArea(id){ var m=descMap(); if(m[id]!=null) return String(m[id]); return DESC_AREA[id]||''; }
  function areaDe(t){ var id=t.lista||'consultorio', l=listas(); return l.some(function(x){return x.id===id;}) ? id : l[0].id; }
  function tareasDeArea(id){ return T.filter(function(t){ return areaDe(t)===id; }); }
  function areaPref(ls_){
    if(st.vista==='areas' && st.area && ls_.some(function(l){return l.id===st.area;})) return st.area;
    return (st.addLista && ls_.some(function(l){return l.id===st.addLista;})) ? st.addLista : (st.filtro!=='todas' ? st.filtro : ls_[0].id);
  }

  // ---------- vínculo con el calendario (misma información, sin duplicar) ----------
  function evs(){ return (typeof agEventos!=='undefined' && Array.isArray(agEventos)) ? agEventos : []; }
  function bloquesDe(id){ return evs().filter(function(e){ return e.tareaId===id; }).sort(function(a,b){ return String(a.inicio).localeCompare(String(b.inicio)); }); }
  function bloquesFuturos(id){ var n=new Date(); return bloquesDe(id).filter(function(e){ return new Date(e.inicio)>n; }); }
  function quitarBloques(lista){ if(!lista.length) return; window.agEventos = evs().filter(function(e){ return lista.indexOf(e)<0; }); if(typeof agGuardar==='function') agGuardar(); }
  function devolverBloques(lista){ if(!lista.length) return; window.agEventos = evs().concat(lista); if(typeof agGuardar==='function') agGuardar(); }
  function proximoBloque(id){ var n=new Date(); return bloquesDe(id).filter(function(e){ return new Date(e.fin||e.inicio)>=n; })[0]; }
  function bloqueTxt(e){ var d=String(e.inicio).slice(0,10); return etiquetaDia(d)+' '+horaTxt(String(e.inicio).slice(11,16))+(e.fin?' – '+horaTxt(String(e.fin).slice(11,16)):''); }

  // ---------- datos ----------
  function cargar(){
    var v = DB.get(KEY);
    T = Array.isArray(v) ? v.filter(function(t){ return t && t.id && t.titulo!=null; }) : [];
    T.forEach(normalizar);
    var vb = DB.get('bandeja');
    B = Array.isArray(vb) ? vb.filter(function(x){ return x && x.id && x.texto!=null; }) : [];
  }
  function guardarB(){ DB.set('bandeja', B); }
  function ideaPorId(id){ return B.filter(function(x){return x.id===id;})[0]; }
  function ideasActivas(){ return B.filter(function(x){ return !x.archivada; }); }
  function guardar(){ DB.set(KEY, T); }
  function porId(id){ return T.filter(function(t){return t.id===id;})[0]; }
  function pendientes(){ return T.filter(function(t){ return !t.hecha && (st.filtro==='todas' || (t.lista||'consultorio')===st.filtro); }); }
  function ordenar(a,b){
    if(!!b.prio !== !!a.prio) return a.prio ? -1 : 1;
    if((a.hora||'') !== (b.hora||'')){ if(!a.hora) return 1; if(!b.hora) return -1; return a.hora<b.hora?-1:1; }
    return String(a.creada||'').localeCompare(String(b.creada||''));
  }

  // "llamar a X mañana" / "hoy pagar..." → pone la fecha y quita la palabra
  function leerFechaEnTexto(txt){
    var m = /^(.*?)(?:\s+|^)(hoy|ma[ñn]ana|pasado ma[ñn]ana)\s*$/i.exec(txt) || /^()(hoy|ma[ñn]ana|pasado ma[ñn]ana)\s+(.*)$/i.exec(txt);
    if(!m) return {titulo:txt, fecha:null};
    var palabra = m[2].toLowerCase().replace('ñ','n'), resto = (m[3]!==undefined ? m[3] : m[1]).trim();
    if(!resto) return {titulo:txt, fecha:null};
    var h = hoy();
    return {titulo:resto, fecha: palabra==='hoy' ? h : palabra==='manana' ? sumarDias(h,1) : sumarDias(h,2)};
  }

  function siguienteFecha(t){
    var base = t.fecha || hoy();
    if(t.rep==='diaria') return sumarDias(base,1);
    if(t.rep==='laboral'){ var f=sumarDias(base,1); while([0,6].indexOf(desdeYMD(f).getDay())>=0) f=sumarDias(f,1); return f; }
    if(t.rep==='semanal') return sumarDias(base,7);
    if(t.rep==='mensual'){ var d=desdeYMD(base); var dia=d.getDate(); d.setDate(1); d.setMonth(d.getMonth()+1); var ult=new Date(d.getFullYear(),d.getMonth()+1,0).getDate(); d.setDate(Math.min(dia,ult)); return ymd(d); }
    return null;
  }

  // ---------- estilos ----------
  function estilo(){
    if(document.getElementById('tr-style')) return;
    var s=document.createElement('style'); s.id='tr-style';
    s.textContent = [
'.tr-wrap{max-width:720px;margin:0 auto;padding:4px 2px 90px;font-family:"Lato",Roboto,Arial,sans-serif;color:#4a3a3f}',
'.tr-top{display:flex;align-items:flex-end;justify-content:space-between;gap:10px;margin-bottom:10px}',
'.tr-h1{font-family:"Playfair Display",serif;font-size:1.55rem;margin:0;color:#7a3c4b}',
'.tr-fecha{font-size:.82rem;color:#8a7279}',
'.tr-prog{background:#fff;border:1.5px solid #f1dde2;border-radius:14px;padding:10px 14px;margin-bottom:12px}',
'.tr-prog-t{font-size:.84rem;color:#6b5459;margin-bottom:6px;display:flex;justify-content:space-between}',
'.tr-bar{height:9px;border-radius:9px;background:#f4e8ec;overflow:hidden}',
'.tr-bar>i{display:block;height:100%;background:linear-gradient(90deg,#cd8e9d,#e6a9b8);border-radius:9px;transition:width .4s}',
'.tr-add{position:sticky;top:0;z-index:20;background:#fffafb;border:1.5px solid #e8c9d1;border-radius:14px;padding:10px;margin-bottom:12px;box-shadow:0 2px 8px rgba(205,142,157,.15)}',
'.tr-add-row{display:flex;gap:8px}',
'.tr-add input[type=text]{flex:1;min-width:0;border:none;background:transparent;font-size:1rem;padding:10px 6px;outline:none;color:#4a3a3f}',
'.tr-add-btn{width:46px;min-width:46px;height:46px;border:none;border-radius:12px;background:#cd8e9d;color:#fff;font-size:1.6rem;cursor:pointer;line-height:1}',
'.tr-chips{display:flex;gap:6px;flex-wrap:wrap;margin-top:6px;align-items:center}',
'.tr-chip{border:1.5px solid #ecd3d9;background:#fff;color:#7a3c4b;border-radius:18px;padding:6px 12px;font-size:.78rem;cursor:pointer;min-height:34px}',
'.tr-chip.on{background:#cd8e9d;border-color:#cd8e9d;color:#fff}',
'.tr-chip input[type=date]{border:none;background:transparent;font-size:.78rem;color:inherit;width:auto;max-width:130px;padding:0}',
'label.tr-chip{display:inline-flex;align-items:center;gap:4px}',
'.tr-sel{border:1.5px solid #ecd3d9;background:#fff;border-radius:18px;padding:6px 10px;font-size:.78rem;color:#7a3c4b;min-height:34px}',
'.tr-tabs{display:flex;gap:6px;margin-bottom:10px;overflow:auto}',
'.tr-tab{flex:1;min-width:84px;border:1.5px solid #f1dde2;background:#fff;border-radius:12px;padding:10px 6px;font-size:.84rem;color:#6b5459;cursor:pointer;min-height:44px}',
'.tr-tab.on{background:#fbe9ee;border-color:#cd8e9d;color:#7a3c4b;font-weight:700}',
'.tr-filtros{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:12px}',
'.tr-sec{font-size:.74rem;font-weight:700;letter-spacing:.8px;text-transform:uppercase;color:#a0536a;margin:16px 2px 8px;display:flex;align-items:center;justify-content:space-between}',
'.tr-row{display:flex;align-items:center;gap:10px;background:#fff;border:1.5px solid #f1dde2;border-radius:14px;padding:8px 8px 8px 10px;margin-bottom:8px;min-height:58px;transition:opacity .28s,transform .28s,background .2s}',
'.tr-row.big{background:#fff7f9;border-color:#e6a9b8;padding:12px 10px;min-height:68px}',
'.tr-row.big .tr-tit{font-size:1.05rem;font-weight:700}',
'.tr-row.fin{opacity:.0;transform:translateX(24px);background:#eaf6ee}',
'.tr-chk{flex:0 0 auto;width:34px;height:34px;border-radius:50%;border:2.5px solid #cd8e9d;background:#fff;cursor:pointer;position:relative;padding:0}',
'.tr-chk:active{background:#fbe9ee}',
'.tr-row.done .tr-chk{background:#7ab87a;border-color:#7ab87a}',
'.tr-row.done .tr-chk:after{content:"✓";color:#fff;position:absolute;inset:0;font-size:1.2rem;line-height:30px;text-align:center}',
'.tr-row.done .tr-tit{text-decoration:line-through;color:#9a8b8f}',
'.tr-main{flex:1;min-width:0;cursor:pointer;padding:2px 0}',
'.tr-tit{font-size:.97rem;color:#4a3a3f;line-height:1.3;word-break:break-word}',
'.tr-meta{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-top:3px;font-size:.72rem;color:#8a7279}',
'.tr-dot{display:inline-block;width:9px;height:9px;border-radius:50%;margin-right:3px;vertical-align:middle}',
'.tr-star{flex:0 0 auto;width:40px;height:40px;border:none;background:none;font-size:1.35rem;cursor:pointer;color:#d0bcc2}',
'.tr-star.on{color:#f0a500}',
'.tr-mini{border:1.5px solid #ecd3d9;background:#fff;color:#7a3c4b;border-radius:14px;padding:5px 10px;font-size:.72rem;cursor:pointer}',
'.tr-vacio{text-align:center;color:#8a7279;padding:26px 10px;font-size:.92rem;line-height:1.6}',
'.tr-vacio b{display:block;font-size:1.05rem;color:#7a3c4b;margin-bottom:4px}',
'.tr-atr{background:#fff4e5;border:1.5px solid #f3d29a;border-radius:14px;padding:10px 12px;margin-bottom:10px;font-size:.84rem;color:#8a5a00}',
'.tr-atr-b{display:flex;gap:8px;flex-wrap:wrap;margin-top:8px}',
'.tr-link{background:none;border:none;color:#a0536a;text-decoration:underline;cursor:pointer;font-size:.8rem;padding:4px}',
'.tr-foco-btn{border:none;background:#7a3c4b;color:#fff;border-radius:22px;padding:10px 16px;font-size:.85rem;cursor:pointer;min-height:42px;white-space:nowrap}',
'.tr-bg{position:fixed;inset:0;background:rgba(40,25,30,.45);z-index:9500;display:flex;align-items:flex-end;justify-content:center}',
'.tr-modal{background:#fff;border-radius:18px 18px 0 0;width:100%;max-width:560px;max-height:92vh;overflow:auto;padding:18px 18px 22px;box-shadow:0 -6px 24px rgba(0,0,0,.2)}',
'@media(min-width:700px){.tr-bg{align-items:center}.tr-modal{border-radius:18px}}',
'.tr-f{margin-bottom:12px}',
'.tr-f label{display:block;font-size:.72rem;font-weight:700;letter-spacing:.6px;text-transform:uppercase;color:#a0536a;margin-bottom:4px}',
'.tr-f input,.tr-f select,.tr-f textarea{width:100%;box-sizing:border-box;border:1.5px solid #ecd3d9;border-radius:10px;padding:10px;font-size:.95rem;font-family:inherit;color:#4a3a3f;background:#fff}',
'.tr-2{display:grid;grid-template-columns:1fr 1fr;gap:10px}',
'.tr-acc{display:flex;gap:8px;justify-content:flex-end;align-items:center;margin-top:14px}',
'.tr-pri{background:#cd8e9d;color:#fff;border:none;border-radius:12px;padding:12px 22px;font-size:.95rem;font-weight:700;cursor:pointer;min-height:46px}',
'.tr-sec2{background:none;border:none;color:#7a6a6f;padding:12px 14px;cursor:pointer;font-size:.9rem}',
'.tr-del{background:none;border:none;color:#d93025;padding:12px 8px;cursor:pointer;margin-right:auto;font-size:.9rem}',
'.tr-paso{display:flex;align-items:center;gap:8px;margin-bottom:6px}',
'.tr-paso input[type=text]{flex:1;padding:8px 10px}',
'.tr-paso input[type=checkbox]{width:22px;height:22px;flex:0 0 auto}',
'.tr-snack{position:fixed;left:50%;bottom:24px;transform:translateX(-50%);z-index:10100;background:#3b2c31;color:#fff;border-radius:12px;padding:12px 16px;font-size:.88rem;display:flex;gap:16px;align-items:center;box-shadow:0 4px 16px rgba(0,0,0,.3);max-width:92vw}',
'.tr-snack button{background:none;border:none;color:#f5b9c7;font-weight:700;cursor:pointer;font-size:.88rem}',
'.tr-foco{position:fixed;inset:0;z-index:9800;background:linear-gradient(160deg,#fff7f9,#f6e6ec);display:flex;flex-direction:column;align-items:center;justify-content:center;padding:22px;text-align:center}',
'.tr-foco-lbl{font-size:.78rem;letter-spacing:1px;text-transform:uppercase;color:#a0536a;margin-bottom:10px}',
'.tr-foco-tit{font-family:"Playfair Display",serif;font-size:1.7rem;color:#4a2b34;max-width:560px;line-height:1.3;margin-bottom:10px;word-break:break-word}',
'.tr-foco-pasos{text-align:left;margin:6px auto 0;max-width:460px;width:100%}',
'.tr-foco-pasos label{display:flex;gap:10px;align-items:center;padding:8px 4px;font-size:1rem}',
'.tr-foco-pasos input{width:22px;height:22px}',
'.tr-time{font-size:3.6rem;font-weight:700;color:#7a3c4b;margin:14px 0 6px;font-variant-numeric:tabular-nums}',
'.tr-foco-b{display:flex;gap:10px;flex-wrap:wrap;justify-content:center;margin-top:10px}',
'.tr-foco-b button{min-height:48px;border-radius:24px;border:1.5px solid #cd8e9d;background:#fff;color:#7a3c4b;padding:0 20px;font-size:.95rem;cursor:pointer}',
'.tr-foco-b button.main{background:#cd8e9d;color:#fff;border-color:#cd8e9d;font-weight:700}',
'.tr-foco-b button.ok{background:#7ab87a;color:#fff;border-color:#7ab87a;font-weight:700}',
'.tr-next{font-size:.84rem;color:#5b4549;margin-top:4px;line-height:1.35}',
'.tr-punto{background:#fff8e6;border-radius:8px;padding:4px 8px;color:#7a5a00}',
'.tr-est{border:1.5px solid #ecd3d9;background:#fff;border-radius:12px;padding:2px 9px;font-size:.72rem;cursor:pointer;color:#6b5459}',
'.tr-est.e-curso{background:#eaf6ee;border-color:#bfe0c6;color:#2d6a3e}',
'.tr-est.e-pausada{background:#fff4e5;border-color:#f3d29a;color:#8a5a00}',
'.tr-est.e-espera{background:#eef1fb;border-color:#cdd3ee;color:#3c4160}',
'.tr-pl{margin-top:8px;border-top:1px dashed #ecd3d9;padding-top:6px}',
'.tr-pl label{display:flex;gap:10px;align-items:center;padding:7px 2px;font-size:.92rem;cursor:pointer}',
'.tr-pl input{width:22px;height:22px;flex:0 0 auto}',
'.tr-vistas{display:flex;gap:6px;overflow:auto;padding-bottom:4px;margin-bottom:8px}',
'.tr-vistas .tr-chip{white-space:nowrap}',
'.tr-barra{display:flex;gap:8px;align-items:center;margin-bottom:10px;flex-wrap:wrap}',
'.tr-nueva{background:#cd8e9d;color:#fff;border:none;border-radius:14px;padding:11px 18px;font-size:.95rem;font-weight:700;cursor:pointer;min-height:46px}',
'.tr-panelf{background:#fff;border:1.5px solid #f1dde2;border-radius:12px;padding:10px 12px;margin-bottom:10px}',
'.tr-panelf .tr-sec{margin:6px 0 4px}',
'.tr-hint{font-size:.74rem;color:#8a7279;margin-top:3px}',
'.tr-panel{background:#fdf5f7;border-radius:10px;padding:10px 12px;margin-bottom:10px;font-size:.88rem;color:#4a3a3f}',
'.tr-estopt{display:block;width:100%;text-align:left;border:1.5px solid #ecd3d9;background:#fff;border-radius:12px;padding:13px 14px;margin-bottom:8px;font-size:1rem;cursor:pointer;color:#4a3a3f}',
'.tr-estopt.on{background:#fbe9ee;border-color:#cd8e9d;font-weight:700}',
'.tr-summ{cursor:pointer;font-weight:700;color:#7a3c4b;padding:10px 0;font-size:.92rem}',
'.tr-foco-next{font-size:1.05rem;color:#7a3c4b;max-width:520px;margin:2px auto 8px;font-weight:700}',
'.tr-mini.pri{background:#cd8e9d;border-color:#cd8e9d;color:#fff;font-weight:700}',
'.tr-activa{background:#eaf6ee;border:1.5px solid #bfe0c6;border-radius:14px;padding:10px 12px;margin-bottom:10px;font-size:.88rem;color:#2d6a3e;display:flex;gap:8px;align-items:center;flex-wrap:wrap}',
'.tr-activa b{flex:1;min-width:120px}',
'.tr-foco{overflow:auto;justify-content:flex-start}',
'.tr-foco-in{margin:auto;width:100%;max-width:560px;padding:8px 0 24px;text-align:center}',
'.tr-foco-top{display:flex;gap:8px;justify-content:center;flex-wrap:wrap;margin-bottom:14px}',
'.tr-foco-badge{background:#cd8e9d;color:#fff;border-radius:14px;padding:4px 12px;font-size:.78rem;font-weight:700}',
'.tr-foco-badge.soft{background:#fff;color:#7a3c4b;border:1.5px solid #ecd3d9}',
'.tr-foco-area{font-size:.85rem;color:#7a6a6f;margin-bottom:18px}',
'.tr-foco-accion{font-size:1.45rem;line-height:1.35;color:#3b2430;font-weight:700;background:#fff;border:2px solid #cd8e9d;border-radius:18px;padding:20px 18px;margin:6px 0 4px;word-break:break-word}',
'.tr-foco-aj{border:none;background:none;color:#a0536a;text-decoration:underline;font-size:.8rem;cursor:pointer;padding:6px}',
'#trf-nota{width:100%;box-sizing:border-box;border:1.5px solid #ecd3d9;border-radius:12px;padding:10px;font-size:.95rem;font-family:inherit;background:#fffdfd;color:#4a3a3f;resize:vertical}',
'.tr-foco-ult{font-size:.72rem;color:#8a7279;margin-top:4px}',
'.tr-foco-mut{margin-top:12px;font-size:.84rem;color:#9a8b8f;text-align:left}',
'.tr-foco-mut summary{cursor:pointer;text-align:center;color:#8a7279}',
'.tr-foco-mut div{padding:3px 4px}',
'.tr-foco-sec{display:flex;gap:4px 14px;justify-content:center;flex-wrap:wrap;margin-top:16px}',
'.tr-foco-sec button{border:none;background:none;color:#8a7279;font-size:.82rem;text-decoration:underline;cursor:pointer;padding:6px}',
'.tr-foco-b.chico button{min-height:38px;padding:0 14px;font-size:.85rem}',
'.md-h{font-size:.74rem;font-weight:700;letter-spacing:.8px;text-transform:uppercase;color:#a0536a;margin:18px 2px 8px}',
'.md-card{background:#fff;border:1.5px solid #f1dde2;border-radius:16px;padding:12px 14px}',
'.md-res{font-size:.92rem;line-height:1.5;color:#4a3a3f}',
'.md-res b{color:#7a3c4b}',
'.md-g{display:inline-block;background:#eaf6ee;border:1px solid #bfe0c6;color:#2d6a3e;border-radius:12px;padding:2px 9px;margin:4px 5px 0 0;font-size:.76rem}',
'.md-ev{display:flex;gap:10px;align-items:flex-start;padding:9px 0;border-bottom:1px dashed #f1dde2}',
'.md-ev:last-child{border-bottom:none}',
'.md-ev.past{opacity:.5}',
'.md-ev.now{background:#fbe9ee;border-radius:10px;padding:9px 8px}',
'.md-t{flex:0 0 96px;font-size:.8rem;color:#7a3c4b;font-weight:700}',
'.md-sub{font-size:.74rem;color:#8a7279;margin-top:2px}',
'.md-step{background:#fff7f9;border:2px solid #cd8e9d;border-radius:18px;padding:16px}',
'.md-step .tit{font-size:1.15rem;font-weight:700;color:#3b2430;line-height:1.3;word-break:break-word}',
'.md-step .acc{font-size:.98rem;color:#5b4549;margin-top:8px}',
'.md-why{font-size:.76rem;color:#8a7279;margin-top:8px}',
'.md-alerta{background:#fff4e5;border:1.5px solid #f3d29a;border-radius:12px;padding:9px 12px;margin-bottom:10px;font-size:.86rem;color:#8a5a00}',
'.md-opt{display:flex;gap:10px;align-items:center;padding:9px 12px;background:#fff;border:1.5px solid #f1dde2;border-radius:14px;margin-bottom:8px}',
'.md-opt .m{flex:1;min-width:0}',
'.md-opt .tt{font-size:.92rem;color:#4a3a3f;word-break:break-word}',
'.md-lnk{background:none;border:none;color:#a0536a;text-decoration:underline;cursor:pointer;font-size:.8rem;padding:6px 2px}',
'.md-plan{display:flex;gap:8px;align-items:center;padding:9px 0;border-bottom:1px dashed #f1dde2}',
'.md-plan .m{flex:1;min-width:0;font-size:.9rem;word-break:break-word}',
'.md-plan button{border:1.5px solid #ecd3d9;background:#fff;color:#7a3c4b;border-radius:12px;padding:6px 10px;font-size:.76rem;cursor:pointer}',
'.md-plan button.on{background:#cd8e9d;border-color:#cd8e9d;color:#fff;font-weight:700}',
'.tr-areab{border:1px dashed #e3c3cb;background:#fff;color:#6b5459;border-radius:10px;padding:2px 8px;font-size:.76rem;cursor:pointer;display:inline-flex;align-items:center;gap:4px;min-height:26px}',
'.ar-card{background:#fff;border:1.5px solid #f1dde2;border-left-width:7px;border-radius:14px;padding:12px 14px;margin-bottom:10px;cursor:pointer}',
'.ar-card:active{background:#fdf6f8}',
'.ar-t{font-weight:700;color:#4a3a3f;font-size:1.02rem}',
'.ar-d{font-size:.82rem;color:#6b5459;margin-top:3px}',
'.ar-c{display:flex;gap:6px;flex-wrap:wrap;margin-top:8px;font-size:.78rem;color:#7a3c4b}',
'.ar-c span{background:#fbe9ee;border-radius:10px;padding:2px 9px}',
'.ar-head{background:#fff;border:1.5px solid #f1dde2;border-left-width:7px;border-radius:14px;padding:12px 14px;margin:6px 0 10px}',
'.ar-sw{display:flex;gap:8px;flex-wrap:wrap;margin-top:4px}',
'.ar-sw span{width:30px;height:30px;border-radius:50%;cursor:pointer;border:3px solid transparent}',
'.ar-sw span.sel{border-color:#4a3a3f}'
    ].join('\n');
    document.head.appendChild(s);
  }

  // ---------- estructura ----------
  function abrir(){
    estilo(); cargar(); try{ if(typeof window.agxMigrarAreas==='function') window.agxMigrarAreas(); }catch(e){}
    var root = document.getElementById('tareas-root'); if(!root) return;
    if(!document.getElementById('tr-head')){
      var d = new Date();
      root.innerHTML =
        '<div class="tr-wrap">'
        + '<div class="tr-top"><div><h1 class="tr-h1">✅ Tareas</h1><div class="tr-fecha" id="tr-fecha"></div></div><button class="tr-foco-btn" data-act="foco">🎯 Empezar tarea</button></div>'
        + '<div id="tr-head"></div>'
        + '<div class="tr-add" id="tr-addbar"><div class="tr-add-row"><input type="text" id="tr-nuevo" placeholder="Escribe una tarea y Enter…" autocomplete="off" enterkeyhint="done"><button class="tr-add-btn" data-act="add" aria-label="Agregar tarea">+</button></div>'
        + '<div class="tr-chips" id="tr-addchips"></div></div>'
        + '<div class="tr-tabs" id="tr-tabs"></div>'
        + '<div class="tr-filtros" id="tr-filtros"></div>'
        + '<div id="tr-contenido"></div></div>';
      var inp = document.getElementById('tr-nuevo');
      inp.addEventListener('keydown', function(e){ if(e.key==='Enter'){ e.preventDefault(); agregarDesdeInput(); } });
      root.addEventListener('keydown', function(e){ if(e.key==='Enter' && e.target && e.target.id==='tr-idea'){ e.preventDefault(); guardarDesdeCampo(); } });
      root.addEventListener('click', clickRoot);
      root.addEventListener('change', changeRoot);
    }
    var fh=new Date().toLocaleDateString('es-CO',{weekday:'long',day:'numeric',month:'long'}); document.getElementById('tr-fecha').textContent = fh.charAt(0).toUpperCase()+fh.slice(1);
    pintar();
    iniciarSync();
  }

  function fechaPorDefecto(){
    if(st.addFecha) return st.addFecha;
    return (st.vista==='bandeja'||st.vista==='tareas'||st.vista==='areas') ? 'sin' : st.vista==='proximas' ? 'manana' : 'hoy';
  }
  function resolverFecha(clave){
    var h=hoy();
    if(clave==='hoy') return h; if(clave==='manana') return sumarDias(h,1); if(clave==='sin') return '';
    return /^\d{4}-\d{2}-\d{2}$/.test(clave) ? clave : '';
  }

  function pintar(){
    var ab=document.getElementById('tr-addbar'); if(ab) ab.style.display=(st.vista==='bandeja' || (st.vista==='areas' && !st.area))?'none':'';
    pintarHead(); pintarAddChips(); pintarTabs(); pintarFiltros(); pintarContenido();
  }

  function pintarHead(){
    var el=document.getElementById('tr-head'); if(!el) return;
    var act=tareaActiva(), banner='';
    if(act && st.vista!=='hoy') banner='<div class="tr-activa">🎯 <b>En foco: '+esc(act.titulo)+'</b><button class="tr-mini pri" data-act="empezar" data-id="'+esc(act.id)+'">▶ Continuar</button><button class="tr-mini" data-act="pausarb" data-id="'+esc(act.id)+'">Guardar y pausar</button></div>';
    if(st.vista==='tareas'){ el.innerHTML=banner; return; }
    var h=hoy();
    el.innerHTML = banner;
  }

  function pintarAddChips(){
    var el=document.getElementById('tr-addchips'); if(!el) return;
    var f=fechaPorDefecto(), h=hoy();
    var esOtra = f!=='hoy' && f!=='manana' && f!=='sin' && f!=='bandeja';
    var ls_ = listas();
    var actual = areaPref(ls_);
    el.innerHTML =
      '<button class="tr-chip'+(f==='hoy'?' on':'')+'" data-act="afecha" data-v="hoy">Hoy</button>'
      +'<button class="tr-chip'+(f==='manana'?' on':'')+'" data-act="afecha" data-v="manana">Mañana</button>'
      +'<button class="tr-chip'+(f==='sin'?' on':'')+'" data-act="afecha" data-v="sin">Sin fecha</button>'
      +'<button class="tr-chip'+(f==='bandeja'?' on':'')+'" data-act="afecha" data-v="bandeja">📥 Solo guardar idea</button>'
      +'<label class="tr-chip'+(esOtra?' on':'')+'">📅 <input type="date" id="tr-add-fecha" min="'+h+'" value="'+(esOtra?esc(f):'')+'" data-act="afechad"></label>'
      +'<select class="tr-sel" id="tr-add-lista" data-act="alista">'+ls_.map(function(l){ return '<option value="'+esc(l.id)+'"'+(l.id===actual?' selected':'')+'>'+esc(l.nombre)+'</option>'; }).join('')+'</select>';
  }

  function pintarTabs(){
    var el=document.getElementById('tr-tabs'); if(!el) return;
    var h=hoy(), pen=T.filter(function(t){return !t.hecha;});
    var nBand = ideasActivas().length;
    var nHoy = pen.filter(function(t){var f=fechaEf(t); return f && f<=h;}).length;
    function tab(id,txt){ return '<button class="tr-tab'+(st.vista===id?' on':'')+'" data-act="vista" data-v="'+id+'">'+txt+'</button>'; }
    var nAct = T.filter(function(t){return !t.hecha;}).length;
    el.innerHTML = tab('hoy','☀️ Mi día'+(nHoy?' ('+nHoy+')':''))+tab('bandeja','📥 Bandeja'+(nBand?' ('+nBand+')':''))+tab('tareas','✅ Tareas'+(nAct?' ('+nAct+')':''))+tab('proximas','📅 Próximas')+tab('areas','🗂 Áreas'); marcarTabAgenda();
  }

  function pintarFiltros(){
    var el=document.getElementById('tr-filtros'); if(!el) return;
    var ls_=listas();
    if(ls_.length<2 || st.vista==='areas'){ el.innerHTML=''; return; }
    el.innerHTML = '<button class="tr-chip'+(st.filtro==='todas'?' on':'')+'" data-act="filtro" data-v="todas">Todas</button>'
      + ls_.map(function(l){ return '<button class="tr-chip'+(st.filtro===l.id?' on':'')+'" data-act="filtro" data-v="'+esc(l.id)+'"><span class="tr-dot" style="background:'+esc(l.color)+'"></span>'+esc(l.nombre)+'</button>'; }).join('');
  }

  function fila(t, opts){
    opts = opts || {};
    var l = lista(t.lista||'consultorio'), h=hoy(), full=!!opts.full, ide=esc(t.id);
    var meta = opts.sinArea ? '' : '<button type="button" class="tr-areab" data-act="area" data-id="'+ide+'" title="Cambiar de área"><span class="tr-dot" style="background:'+esc(l.color)+'"></span>'+esc(l.nombre)+' ▾</button>';
    if(!t.hecha && (full || t.estado!=='pendiente')) meta += '<button type="button" class="tr-est e-'+t.estado+'" data-act="estado" data-id="'+ide+'">'+ESTADO_ICO[t.estado]+' '+ESTADO_TXT[t.estado]+'</button>';
    if(t.limite){ var venc=!t.hecha && t.limite<h, hl=!t.hecha && t.limite===h; meta += '<span style="color:'+((venc||hl)?'#c0392b':'#a0536a')+';font-weight:700">⛔ Límite '+esc(etiquetaDia(t.limite))+(venc?' (vencida)':'')+'</span>'; }
    if(full && !t.hecha){ if(t.prioridad==='alta') meta += '<span>🔺 Alta</span>'; else if(t.prioridad==='baja') meta += '<span>🔻 Baja</span>'; }
    if(t.hora) meta += '<span>🕒 '+esc(horaTxt(t.hora))+'</span>';
    var pb = proximoBloque(t.id); if(pb) meta += '<span>📌 '+esc(bloqueTxt(pb))+'</span>';
    if(t.eventoId){ var ev0 = evs().filter(function(e){return e.id===t.eventoId;})[0]; if(ev0) meta += '<span>🔗 '+esc(ev0.titulo)+'</span>'; }
    if(t.fecha && t.fecha!==h && !opts.sinFecha && !t.hecha) meta += '<span style="'+(t.fecha<h?'color:#c27a00;font-weight:700':'')+'">🎯 '+esc(etiquetaDia(t.fecha))+'</span>';
    if(t.minutos && !t.hecha) meta += '<span>⏱ '+t.minutos+' min</span>';
    var np = (t.pasos||[]).length, nd = (t.pasos||[]).filter(function(p){return p.d;}).length;
    if(np) meta += '<span>☑ '+nd+'/'+np+'</span>';
    if(t.rep) meta += '<span>🔁</span>';
    if(t.notas) meta += '<span>📝</span>';
    if(t.hecha && t.hechaEn) meta += '<span>✔ '+esc(etiquetaDia(t.hechaEn.slice(0,10)))+'</span>';
    if(opts.restaurar){
      return '<div class="tr-row done" data-id="'+ide+'"><button class="tr-chk" data-act="reabrir" data-id="'+ide+'" aria-label="Reabrir"></button><div class="tr-main" data-act="edit" data-id="'+ide+'"><div class="tr-tit">'+esc(t.titulo)+'</div><div class="tr-meta">'+meta+'</div></div></div>';
    }
    var extra = '', na = proximaAccion(t), accs = '';
    if(na) extra += '<div class="tr-next">→ '+esc(na)+'</div>';
    if((t.estado==='pausada'||t.estado==='curso') && t.punto) extra += '<div class="tr-next tr-punto">⏸ Al volver: '+esc(t.punto)+(t.actualizada?' <span style="opacity:.7">· '+esc(ultimaTxt(t))+'</span>':'')+'</div>';
    if(t.estado==='espera' && t.esperaDe) extra += '<div class="tr-next tr-punto">⏳ Esperando: '+esc(t.esperaDe)+'</div>';
    if(np && nd===np) extra += '<div class="tr-next" style="color:#2d6a3e">✅ Pasos listos: revisa si se cumple el criterio y complétala.</div>';
    if(!na && !np) accs += '<button type="button" class="tr-mini" data-act="dividir" data-id="'+ide+'">✂ Dividir en pasos</button>';
    if(t.enfoque) accs += '<button type="button" class="tr-mini pri" data-act="empezar" data-id="'+ide+'">▶ Continuar</button>';
    else if(t.estado==='pendiente') accs += '<button type="button" class="tr-mini pri" data-act="empezar" data-id="'+ide+'">▶ Empezar tarea</button>';
    else if(t.estado==='pausada') accs += '<button type="button" class="tr-mini pri" data-act="empezar" data-id="'+ide+'">▶ Retomar tarea</button>';
    else if(t.estado==='curso') accs += '<button type="button" class="tr-mini pri" data-act="empezar" data-id="'+ide+'">▶ Continuar</button>';
    if(t.estado==='espera') accs += '<button type="button" class="tr-mini" data-act="setest" data-v="curso" data-id="'+ide+'">✔ Ya llegó</button>';
    if(np) accs += '<button type="button" class="tr-mini" data-act="expand" data-id="'+ide+'">'+(st.abiertas[t.id]?'▴':'▾')+' Pasos</button>';
    if(opts.mover) accs += '<button class="tr-mini" data-act="mover" data-id="'+ide+'" data-v="hoy">Hacer hoy</button><button class="tr-mini" data-act="mover" data-id="'+ide+'" data-v="manana">Mañana</button>';
    if(accs) extra += '<div class="tr-meta" style="margin-top:6px">'+accs+'</div>';
    if(np && st.abiertas[t.id]) extra += '<div class="tr-pl">'+t.pasos.map(function(p,i){ return '<label><input type="checkbox" data-act="paso" data-id="'+ide+'" data-i="'+i+'"'+(p.d?' checked':'')+'> <span'+(p.d?' style="text-decoration:line-through;color:#9a8b8f"':'')+'>'+esc(p.t)+'</span></label>'; }).join('')+'</div>';
    return '<div class="tr-row'+(opts.big?' big':'')+'" data-id="'+ide+'"><button class="tr-chk" data-act="chk" data-id="'+ide+'" aria-label="Marcar como hecha"></button>'
      + '<div class="tr-main" data-act="edit" data-id="'+ide+'"><div class="tr-tit">'+esc(t.titulo)+'</div><div class="tr-meta">'+meta+'</div>'+extra+'</div>'
      + '<button class="tr-star'+(t.prio?' on':'')+'" data-act="star" data-id="'+ide+'" aria-label="Marcar como importante">'+(t.prio?'★':'☆')+'</button></div>';
  }

  function pintarContenido(){
    var el=document.getElementById('tr-contenido'); if(!el) return;
    var h=hoy(), html='', pen=pendientes();
    if(st.vista==='tareas'){
      html = vistaTareas();
    } else if(st.vista==='hoy'){
      html = vistaMiDia();
    } else if(st.vista==='bandeja'){
      html = vistaBandeja();
    } else if(st.vista==='areas'){
      html = vistaAreas();
    } else if(st.vista==='proximas'){
      var p = pen.filter(function(t){var f=fechaEf(t); return f && f>h;}).sort(function(a,b){ return fechaEf(a)<fechaEf(b)?-1:fechaEf(a)>fechaEf(b)?1:ordenar(a,b); });
      if(!p.length) html += '<div class="tr-vacio"><b>Nada programado</b>Cuando le pongas fecha a una tarea, aparece aquí.</div>';
      var ult='';
      p.forEach(function(t){
        if(fechaEf(t)!==ult){ ult=fechaEf(t); html += '<div class="tr-sec"><span>'+esc(etiquetaDia(ult))+'</span></div>'; }
        html += fila(t,{sinFecha:true});
      });
    } else {
      var lim = sumarDias(h,-30);
      var d = T.filter(function(t){ return t.hecha && (st.filtro==='todas' || (t.lista||'consultorio')===st.filtro); })
               .sort(function(a,b){ return String(b.hechaEn||'').localeCompare(String(a.hechaEn||'')); });
      var rec = d.filter(function(t){ return (t.hechaEn||'').slice(0,10)>=lim; });
      if(!rec.length) html += '<div class="tr-vacio"><b>Aún no hay tareas hechas</b>Cada ✓ cuenta. Aquí verás lo que ya lograste.</div>';
      else {
        html += '<div class="tr-sec"><span>Últimos 30 días · '+rec.length+'</span><button class="tr-link" data-act="borrar-hechas">Borrar hechas</button></div>';
        var u2='';
        rec.forEach(function(t){
          var dia=(t.hechaEn||'').slice(0,10);
          if(dia!==u2){ u2=dia; html += '<div class="tr-sec" style="margin-top:10px"><span>'+esc(etiquetaDia(dia))+'</span></div>'; }
          html += fila(t,{restaurar:true,sinFecha:true});
        });
      }
    }
    el.innerHTML = html;
  }

  // ---------- acciones ----------
  function snack(texto, undo, ms, extra){
    var s=document.getElementById('tr-snack'); if(s) s.remove();
    s=document.createElement('div'); s.id='tr-snack'; s.className='tr-snack';
    var sp=document.createElement('span'); sp.textContent=texto; s.appendChild(sp);
    if(undo){ var b=document.createElement('button'); b.type='button'; b.textContent='Deshacer'; b.onclick=function(){ undo(); s.remove(); }; s.appendChild(b); }
    if(extra){ var b2=document.createElement('button'); b2.type='button'; b2.textContent=extra.txt; b2.onclick=function(){ s.remove(); extra.fn(); }; s.appendChild(b2); }
    document.body.appendChild(s);
    setTimeout(function(){ if(s.parentNode) s.remove(); }, ms||6000);
  }

  function agregarDesdeInput(){
    var inp=document.getElementById('tr-nuevo'); if(!inp) return;
    var txt=inp.value.replace(/\s+/g,' ').trim(); if(!txt) return;
    if(fechaPorDefecto()==='bandeja'){ capturarIdea(txt); inp.value=''; inp.focus(); return; }
    var f = resolverFecha(fechaPorDefecto());
    var r = leerFechaEnTexto(txt);
    if(r.fecha){ txt=r.titulo; f=r.fecha; }
    var ls_=listas();
    var sel=document.getElementById('tr-add-lista');
    var l = sel ? sel.value : (st.filtro!=='todas' ? st.filtro : ls_[0].id);
    ls('tr_lista', l); st.addLista=l;
    var t=normalizar({id:nuevoId(), titulo:txt, lista:l, fecha:f, hora:'', prio:false, notas:'', pasos:[], rep:'', hecha:false, creada:new Date().toISOString()});
    T.push(t); guardar();
    inp.value=''; inp.focus();
    // si la tarea quedó fuera de la vista actual, avisar dónde quedó
    var h=hoy(), donde = !f ? 'Bandeja' : f<=h ? 'Hoy' : etiquetaDia(f);
    var visible = (st.vista==='hoy' && f && f<=h) || (st.vista==='bandeja' && !f) || (st.vista==='proximas' && f>h);
    pintar();
    snack('Anotada ✓ '+(visible?'':'→ '+donde), function(){ T=T.filter(function(x){return x.id!==t.id;}); guardar(); pintar(); }, 4000);
  }

  var FRASES=['¡Hecha! 🎉','Una menos 💪','¡Bien hecho!','Lo lograste ✅','Eso cuenta 🌟'];
  function completar(id, animar){
    var t=porId(id); if(!t || t.hecha) return;
    var fn=function(){
      var prevE=t.estado;
      t.hecha=true; t.estado='completada'; t.enfoque=false; t.hechaEn=new Date().toISOString();
      var sig=null, fut=bloquesFuturos(t.id); quitarBloques(fut);
      if(t.rep){
        var nf=siguienteFecha(t);
        if(nf){
          var dd=Math.round((desdeYMD(nf)-desdeYMD(t.fecha||hoy()))/864e5);
          sig=normalizar({id:nuevoId(), titulo:t.titulo, lista:t.lista, fecha:nf, limite:t.limite?sumarDias(t.limite,dd):'', hora:t.hora||'', prioridad:t.prioridad, notas:t.notas||'', pasos:(t.pasos||[]).map(function(p){return {t:p.t,d:false};}), rep:t.rep, hecha:false, creada:new Date().toISOString(), siguiente:t.siguiente||'', criterio:t.criterio||'', minutos:t.minutos||0});
          T.push(sig);
        }
      }
      guardar(); pintar();
      snack(FRASES[Math.floor(Math.random()*FRASES.length)]+(sig?' · próxima: '+etiquetaDia(sig.fecha):'')+(fut.length?' · bloque'+(fut.length>1?'s':'')+' del calendario quitado'+(fut.length>1?'s':''):''), function(){
        t.hecha=false; delete t.hechaEn; t.estado=(prevE&&prevE!=='completada')?prevE:'pendiente'; if(sig) T=T.filter(function(x){return x!==sig;}); devolverBloques(fut); guardar(); pintar();
      }, 6000);
    };
    if(animar){
      var row=document.querySelector('#tr-contenido .tr-row[data-id="'+id+'"]');
      if(row){ row.classList.add('fin'); setTimeout(fn,280); return; }
    }
    fn();
  }

  function clickRoot(e){
    if(e.target.closest && e.target.closest('.tr-pl') && !(e.target.tagName==='INPUT')) return;   // etiquetas de pasos: solo cambia el check
    var b=e.target.closest('[data-act]'); if(!b) return;
    var act=b.getAttribute('data-act'), id=b.getAttribute('data-id'), v=b.getAttribute('data-v');
    if(act==='afechad') return;                       // el calendario se maneja en "change"
    if(act==='alista') return;
    if(act==='chk'){ intentarCompletar(id,true); }
    else if(act==='reabrir'){ var t=porId(id); if(t){ t.hecha=false; delete t.hechaEn; t.estado='pendiente'; guardar(); pintar(); } }
    else if(act==='star'){
      var t2=porId(id); if(!t2) return;
      if(!t2.prio){
        var h=hoy(); var yaImp = T.filter(function(x){ return !x.hecha && x.prio && fechaEf(x) && fechaEf(x)<=h; }).length;
        if(yaImp>=3 && fechaEf(t2) && fechaEf(t2)<=h){ snack('Ya tienes 3 importantes hoy. Quita una ⭐ para elegir otra.',null,3500); return; }
      }
      t2.prio=!t2.prio; guardar(); pintar();
    }
    else if(act==='edit'){ abrirEditor(id); }
    else if(act==='add'){ agregarDesdeInput(); }
    else if(act==='afecha'){ st.addFecha=v; pintarAddChips(); var i=document.getElementById('tr-nuevo'); if(i) i.focus(); }
    else if(act==='vista'){ st.vista=v; st.addFecha=null; ls('tr_vista',v); pintar(); }
    else if(act==='filtro'){ st.filtro=v; ls('tr_filtro',v); pintar(); }
    else if(act==='mover'){ var t3=porId(id); if(!t3) return; t3.fecha = v==='hoy'?hoy():sumarDias(hoy(),1); guardar(); pintar(); snack('Movida a '+(v==='hoy'?'hoy':'mañana'),null,2500); }
    else if(act==='atr-ver'){ st.verAtrasadas=!st.verAtrasadas; pintarContenido(); }
    else if(act==='atr-hoy'){
      var h2=hoy(), mov=T.filter(function(x){return !x.hecha && fechaEf(x) && fechaEf(x)<h2 && (st.filtro==='todas' || (x.lista||'consultorio')===st.filtro);});
      var prev=mov.map(function(x){return [x,x.fecha];}); mov.forEach(function(x){ x.fecha=h2; }); guardar(); pintar();
      snack(mov.length+' pasada'+(mov.length>1?'s':'')+' a hoy', function(){ prev.forEach(function(p){ p[0].fecha=p[1]; }); guardar(); pintar(); }, 8000);
    }
    else if(act==='vermas'){ st.verMasHoy=!st.verMasHoy; pintarContenido(); }
    else if(act==='borrar-hechas'){
      var hechas=T.filter(function(x){ return x.hecha && (st.filtro==='todas' || (x.lista||'consultorio')===st.filtro); });
      if(!hechas.length) return;
      if(!confirm('¿Borrar '+hechas.length+' tarea(s) hechas?')) return;
      T=T.filter(function(x){ return hechas.indexOf(x)<0; }); guardar(); pintar();
      snack(hechas.length+' borradas', function(){ hechas.forEach(function(x){T.push(x);}); guardar(); pintar(); }, 8000);
    }
    else if(act==='foco'){ abrirFoco(); }
    else if(act==='nueva'){ abrirNueva(); }
    else if(act==='isave'){ guardarDesdeCampo(); }
    else if(act==='iconv'){ convertirIdea(id); }
    else if(act==='iarch'){ archivarIdea(id); }
    else if(act==='irest'){ restaurarIdea(id); }
    else if(act==='idesc'){ descartarIdea(id); }
    else if(act==='ied'){ editarIdea(id); }
    else if(act==='irbandeja'){ st.vista='bandeja'; ls('tr_vista','bandeja'); pintar(); }
    else if(act==='iverarch'){ st.verArch=!st.verArch; pintarContenido(); }
    else if(act==='empezar'){ empezarTarea(id); }
    else if(act==='otra'){ st.saltadas.push(id); pintarContenido(); }
    else if(act==='planear'){ abrirPlan(); }
    else if(act==='reorg'){ reorganizarDia(); }
    else if(act==='vercal'){ irCalendario(); }
    else if(act==='pdespues'){ st.verDespues=!st.verDespues; pintarContenido(); }
    else if(act==='pausarb'){ var tb=porId(id); if(tb) pausarTarea(tb); }
    else if(act==='estado'){ abrirEstado(id); }
    else if(act==='setest'){ var te=porId(id); if(te) aplicarEstado(te,v); }
    else if(act==='dividir'){ dividirTarea(id); }
    else if(act==='expand'){ st.abiertas[id]=!st.abiertas[id]; pintarContenido(); }
    else if(act==='evista'){ st.estadoV=v; st.estadoElegido=true; st.verTodas=false; ls('tr_estadoV',v); pintarContenido(); }
    else if(act==='verfiltros'){ st.verFiltros=!st.verFiltros; pintarContenido(); }
    else if(act==='fprio'){ st.fPrio=v; st.verTodas=false; pintarContenido(); }
    else if(act==='ffecha'){ st.fFecha=v; st.verTodas=false; pintarContenido(); }
    else if(act==='limpiarf'){ st.fPrio='todas'; st.fFecha='todas'; pintarContenido(); }
    else if(act==='tmas'){ st.verTodas=!st.verTodas; pintarContenido(); }
    else if(act==='area'){ abrirMoverArea(id); }
    else if(act==='areaver'){ st.area=v; st.areaMas={}; st.areaHechas=false; pintar(); try{ window.scrollTo(0,0); }catch(e){} }
    else if(act==='areaback'){ st.area=''; pintar(); }
    else if(act==='areanueva'){ abrirArea(''); }
    else if(act==='areaedit'){ abrirArea(v); }
    else if(act==='areacal'){ if(typeof window.agxVerArea==='function') window.agxVerArea(st.area); else goPage('agenda'); }
    else if(act==='areamas'){ st.areaMas[v]=!st.areaMas[v]; pintarContenido(); }
    else if(act==='areahechas'){ st.areaHechas=!st.areaHechas; pintarContenido(); }
  }
  function changeRoot(e){
    var el=e.target, act=el.getAttribute && el.getAttribute('data-act');
    if(act==='afechad'){ st.addFecha = el.value || null; pintarAddChips(); }
    else if(act==='alista'){ st.addLista=el.value; ls('tr_lista',el.value); }
    else if(act==='paso'){
      var tp=porId(el.getAttribute('data-id')), i=+el.getAttribute('data-i'); if(!tp||!tp.pasos[i]) return;
      tp.pasos[i].d=el.checked; if(el.checked && tp.estado==='pendiente') tp.estado='curso';
      guardar(); pintar();
    }
  }

  // ===================== BANDEJA DE ENTRADA (ideas sin clasificar) =====================
  function capturarIdea(texto, desdeBandeja){
    var it={id:'i'+Date.now().toString(36)+Math.random().toString(36).slice(2,5), texto:texto, creada:new Date().toISOString(), archivada:false};
    B.push(it); guardarB();
    if(st.vista==='bandeja'){ pintarContenido(); pintarTabs(); } else pintarTabs();
    snack('Guardada en la Bandeja ✓', function(){ B=B.filter(function(x){return x.id!==it.id;}); guardarB(); pintar(); }, 3000);
    return it;
  }
  function fechaCaptura(iso){ var d=new Date(iso); if(isNaN(d)) return ''; return etiquetaDia(ymd(d))+' '+d.toLocaleTimeString('es-CO',{hour:'numeric',minute:'2-digit'}); }
  function filaIdea(it, arch){
    var id=esc(it.id);
    return '<div class="tr-row" data-id="'+id+'" style="align-items:flex-start;flex-wrap:wrap"><div class="tr-main" data-act="ied" data-id="'+id+'" style="min-width:60%"><div class="tr-tit">'+esc(it.texto)+'</div><div class="tr-meta"><span>🕒 '+esc(fechaCaptura(it.creada))+'</span></div></div>'
      +'<div style="display:flex;gap:6px;flex-wrap:wrap;width:100%;margin-top:6px">'
      +(arch ? '<button class="tr-mini" data-act="irest" data-id="'+id+'">↩ Restaurar</button><button class="tr-mini" data-act="idesc" data-id="'+id+'">🗑 Eliminar</button>'
             : '<button class="tr-mini pri" data-act="iconv" data-id="'+id+'">✅ Convertir en tarea</button><button class="tr-mini" data-act="iarch" data-id="'+id+'">📦 Archivar</button><button class="tr-mini" data-act="idesc" data-id="'+id+'">🗑 Descartar</button>')
      +'</div></div>';
  }
  function vistaBandeja(){
    var act=ideasActivas().sort(function(a,b){ return String(b.creada).localeCompare(String(a.creada)); });
    var arch=B.filter(function(x){return x.archivada;}).sort(function(a,b){ return String(b.archivadaEn||b.creada).localeCompare(String(a.archivadaEn||a.creada)); });
    var html='<div class="tr-add" style="position:static"><div class="tr-add-row"><input type="text" id="tr-idea" placeholder="¿Qué necesitas recordar o hacer?" autocomplete="off" enterkeyhint="done"><button class="tr-nueva" data-act="isave" style="min-height:46px;padding:0 18px">Guardar</button></div>'
      +'<div class="tr-chips"><button class="tr-chip" disabled style="opacity:.55;cursor:default" title="Llegará en una versión futura">🎙 Nota de voz · próximamente</button></div></div>'
      +'<div class="tr-hint" style="margin:0 2px 8px">Solo escribe y guarda; sin área, prioridad ni fecha. Revísala cuando quieras: aquí no hay hora obligatoria.</div>';
    html+='<div class="tr-sec"><span>📥 Ideas por revisar · '+act.length+'</span></div>';
    html+= act.length ? act.map(function(it){ return filaIdea(it,false); }).join('') : '<div class="tr-vacio"><b>Bandeja vacía ✨</b>Cuando recuerdes algo, escríbelo arriba y sigue con lo tuyo.</div>';
    if(arch.length){
      html+='<div style="margin-top:10px"><button class="tr-link" data-act="iverarch">'+(st.verArch?'Ocultar':'Ver')+' archivadas ('+arch.length+')</button></div>';
      if(st.verArch) html+=arch.map(function(it){ return filaIdea(it,true); }).join('');
    }
    return html;
  }
  function convertirIdea(id){
    var it=ideaPorId(id); if(!it) return;
    var ls_=listas(), area=(st.addLista && ls_.some(function(l){return l.id===st.addLista;})) ? st.addLista : (st.filtro!=='todas' ? st.filtro : ls_[0].id);
    var t=normalizar({id:nuevoId(), titulo:it.texto, lista:area, fecha:'', hora:'', notas:'', pasos:[], rep:'', hecha:false, creada:it.creada});
    T.push(t); B=B.filter(function(x){return x.id!==id;}); guardar(); guardarB(); pintar();
    snack('Convertida en tarea ✓ (en Pendientes, sin fecha)', function(){ T=T.filter(function(x){return x.id!==t.id;}); B.push(it); guardar(); guardarB(); pintar(); }, 8000, {txt:'Completar datos', fn:function(){ abrirEditor(t.id); }});
  }
  function archivarIdea(id){
    var it=ideaPorId(id); if(!it) return; it.archivada=true; it.archivadaEn=new Date().toISOString(); guardarB(); pintar();
    snack('Archivada', function(){ it.archivada=false; delete it.archivadaEn; guardarB(); pintar(); }, 5000);
  }
  function restaurarIdea(id){ var it=ideaPorId(id); if(!it) return; it.archivada=false; delete it.archivadaEn; guardarB(); pintar(); }
  function descartarIdea(id){
    var it=ideaPorId(id); if(!it) return; var i=B.indexOf(it); B.splice(i,1); guardarB(); pintar();
    snack('Descartada', function(){ B.splice(Math.min(i,B.length),0,it); guardarB(); pintar(); }, 6000);
  }
  function editarIdea(id){
    var it=ideaPorId(id); if(!it) return;
    preguntar('✎ Editar idea','Texto','' ,true,function(v){ if(v){ it.texto=v; guardarB(); pintar(); } });
    var q=document.getElementById('trq'); if(q) q.value=it.texto;
  }
  function guardarDesdeCampo(){
    var inp=document.getElementById('tr-idea'); if(!inp) return;
    var v=inp.value.replace(/\s+/g,' ').trim(); if(!v) return;
    capturarIdea(v); var n=document.getElementById('tr-idea'); if(n){ n.value=''; n.focus(); }
  }

  // ===================== SECCIÓN TAREAS =====================
  var ESTADOS = [['pendiente','Pendiente'],['curso','En curso'],['pausada','Pausada'],['espera','En espera']];
  var ESTADO_TXT = {pendiente:'Pendiente',curso:'En curso',pausada:'Pausada',espera:'En espera',completada:'Completada'};
  var ESTADO_ICO = {pendiente:'⚪',curso:'🟢',pausada:'⏸',espera:'⏳',completada:'✔'};
  function fechaEf(t){ return t.fecha || t.limite || ''; }
  function proximaAccion(t){ if(t.siguiente) return t.siguiente; var p=(t.pasos||[]).filter(function(x){return !x.d;})[0]; return p?p.t:''; }
  function setPrioridad(t,p){ t.prioridad=p; t.prio=(p==='alta'); }
  // Completa los campos nuevos en tareas antiguas sin perder nada
  function normalizar(t){
    if(t.hecha) t.estado='completada'; else if(!t.estado || t.estado==='completada') t.estado='pendiente';
    if(t.prioridad!=='alta' && t.prioridad!=='baja' && t.prioridad!=='normal') t.prioridad = t.prio ? 'alta' : 'normal';
    t.prio = (t.prioridad==='alta');
    if(t.hecha || t.estado!=='curso') t.enfoque=false;
    ['limite','siguiente','punto','criterio','esperaDe'].forEach(function(k){ if(t[k]==null) t[k]=''; });
    t.minutos = parseInt(t.minutos,10)||0;
    if(!Array.isArray(t.pasos)) t.pasos=[];
    return t;
  }
  function rankPrio(t){ return t.prioridad==='alta'?0 : t.prioridad==='baja'?2 : 1; }
  function ordenTareas(a,b){
    var la=a.limite||'9999', lb=b.limite||'9999'; if(la!==lb) return la<lb?-1:1;
    if(rankPrio(a)!==rankPrio(b)) return rankPrio(a)-rankPrio(b);
    return String(a.creada||'').localeCompare(String(b.creada||''));
  }
  function porHechaDesc(a,b){ return String(b.hechaEn||'').localeCompare(String(a.hechaEn||'')); }

  function vistaTareas(){
    var h=hoy();
    var base=T.filter(function(t){ return st.filtro==='todas' || (t.lista||'consultorio')===st.filtro; });
    var cnt={todas:base.length};
    ['pendiente','curso','pausada','espera','completada'].forEach(function(e){ cnt[e]=base.filter(function(t){return t.estado===e;}).length; });
    var ev=st.estadoV; if(!st.estadoElegido && ev==='curso' && !cnt.curso) ev='pendiente';
    var vistas=[['todas','Todas'],['pendiente','Pendientes'],['curso','En curso'],['pausada','Pausadas'],['espera','En espera'],['completada','Completadas']];
    var nF=(st.fPrio!=='todas'?1:0)+(st.fFecha!=='todas'?1:0);
    var html='<div class="tr-vistas">'+vistas.map(function(v){ return '<button class="tr-chip'+(ev===v[0]?' on':'')+'" data-act="evista" data-v="'+v[0]+'">'+v[1]+' '+cnt[v[0]]+'</button>'; }).join('')+'</div>'
      +'<div class="tr-barra"><button class="tr-nueva" data-act="nueva">＋ Nueva tarea</button><button class="tr-chip'+(nF?' on':'')+'" data-act="verfiltros">🔎 Filtros'+(nF?' ('+nF+')':'')+'</button></div>';
    if(st.verFiltros){
      var P=[['todas','Todas'],['alta','Alta'],['normal','Normal'],['baja','Baja']];
      var F=[['todas','Todas'],['limite','Con límite real'],['vencidas','Vencidas'],['hoy','Hoy'],['semana','Esta semana'],['sin','Sin fecha']];
      html+='<div class="tr-panelf"><div class="tr-sec"><span>Prioridad</span></div><div class="tr-chips">'+P.map(function(x){ return '<button class="tr-chip'+(st.fPrio===x[0]?' on':'')+'" data-act="fprio" data-v="'+x[0]+'">'+x[1]+'</button>'; }).join('')+'</div>'
        +'<div class="tr-sec"><span>Fecha</span></div><div class="tr-chips">'+F.map(function(x){ return '<button class="tr-chip'+(st.fFecha===x[0]?' on':'')+'" data-act="ffecha" data-v="'+x[0]+'">'+x[1]+'</button>'; }).join('')+'</div>'
        +'<div class="tr-hint">El área se filtra con los botones de arriba. Los filtros son opcionales.</div></div>';
    }
    var lst=base.filter(function(t){ return ev==='todas' || t.estado===ev; });
    if(st.fPrio!=='todas') lst=lst.filter(function(t){ return t.prioridad===st.fPrio; });
    if(st.fFecha!=='todas') lst=lst.filter(function(t){
      var f=fechaEf(t), sem=sumarDias(h,6);
      return st.fFecha==='limite' ? !!t.limite : st.fFecha==='vencidas' ? (!t.hecha && f && f<h) : st.fFecha==='hoy' ? f===h : st.fFecha==='semana' ? (f && f>=h && f<=sem) : !f;
    });
    var act=lst.filter(function(t){return !t.hecha;}).sort(ordenTareas), hec=lst.filter(function(t){return t.hecha;}).sort(porHechaDesc);
    lst = act.concat(hec);
    var MAX=7, vis = st.verTodas ? lst : lst.slice(0,MAX);
    if(!lst.length){
      var msg={todas:['Aún no hay tareas','Toca «＋ Nueva tarea» y empieza con una sola.'],pendiente:['Nada pendiente por empezar ✨','Lo que anotes y aún no empieces aparece aquí.'],curso:['Nada en curso','Cuando empieces una tarea (▶ Empezar) queda aquí. Mejor pocas a la vez.'],pausada:['Nada pausado','Si dejas algo a medias, guarda dónde te quedaste y vuelve desde aquí.'],espera:['Nada en espera','Aquí van las tareas que dependen de una respuesta, un documento o alguien más.'],completada:['Aún no hay completadas','Cada tarea que termines queda registrada aquí.']}[ev];
      html+='<div class="tr-vacio"><b>'+msg[0]+'</b>'+msg[1]+(nF?'<br><button class="tr-link" data-act="limpiarf">Quitar filtros</button>':'')+'</div>';
    } else {
      html+=vis.map(function(t){ return fila(t,{full:true, restaurar:t.hecha, sinFecha:false}); }).join('');
      if(lst.length>MAX) html+='<div style="text-align:center"><button class="tr-link" data-act="tmas">'+(st.verTodas?'Ver menos':'Ver '+(lst.length-MAX)+' más')+'</button></div>';
      if(ev==='completada' && hec.length) html+='<div style="text-align:center"><button class="tr-link" data-act="borrar-hechas">Borrar completadas</button></div>';
    }
    return html;
  }

  // ===================== ÁREAS =====================
  function conteoArea(id){
    var c={curso:0,pendiente:0,pausada:0,espera:0,completada:0};
    tareasDeArea(id).forEach(function(t){ if(c[t.estado]!=null) c[t.estado]++; });
    return c;
  }
  function textoConteo(c){
    var p=[];
    if(c.curso) p.push('▶ '+c.curso+' en curso');
    if(c.pendiente) p.push(c.pendiente+(c.pendiente>1?' pendientes':' pendiente'));
    if(c.pausada) p.push('⏸ '+c.pausada+(c.pausada>1?' pausadas':' pausada'));
    if(c.espera) p.push('⏳ '+c.espera+' en espera');
    if(c.completada) p.push('✔ '+c.completada+(c.completada>1?' completadas':' completada'));
    return p.length ? p.map(function(x){ return '<span>'+x+'</span>'; }).join('') : '<span>Sin tareas todavía</span>';
  }
  function vistaAreas(){
    var ls_=listas();
    if(st.area && !ls_.some(function(l){return l.id===st.area;})) st.area='';
    if(st.area) return vistaArea(st.area);
    var html='<div class="tr-hint" style="margin-bottom:8px">Cada tarea pertenece a un área. Toca una para ver solo lo suyo.</div>'
      +'<div class="tr-barra"><button class="tr-nueva" data-act="areanueva">＋ Nueva área</button></div>';
    ls_.forEach(function(l){
      var d=descArea(l.id);
      html+='<div class="ar-card" data-act="areaver" data-v="'+esc(l.id)+'" style="border-left-color:'+esc(l.color)+'"><div class="ar-t">'+esc(l.nombre)+'</div>'
        +(d?'<div class="ar-d">'+esc(d)+'</div>':'')+'<div class="ar-c">'+textoConteo(conteoArea(l.id))+'</div></div>';
    });
    return html;
  }
  function vistaArea(id){
    var l=lista(id), d=descArea(id), c=conteoArea(id), now=new Date();
    var html='<div><button class="tr-link" data-act="areaback">← Todas las áreas</button></div>'
      +'<div class="ar-head" style="border-left-color:'+esc(l.color)+'"><div class="ar-t">'+esc(l.nombre)+'</div>'+(d?'<div class="ar-d">'+esc(d)+'</div>':'')+'</div>'
      +'<div class="tr-barra"><button class="tr-nueva" data-act="nueva">＋ Nueva tarea</button>'
      +'<button class="tr-chip" data-act="areacal">📅 Ver en el calendario</button>'
      +'<button class="tr-chip" data-act="areaedit" data-v="'+esc(id)+'">✏ Editar área</button></div>';
    var prox=evs().filter(function(e){ return (e.calendario||'consultorio')===id && e.inicio && new Date(e.fin||e.inicio)>=now; })
      .sort(function(a,b){ return String(a.inicio).localeCompare(String(b.inicio)); }).slice(0,3);
    if(prox.length) html+='<div class="tr-sec"><span>📅 Próximos compromisos</span></div>'
      +prox.map(function(e){ return '<div class="md-opt"><div class="m"><div class="tt">'+esc(e.titulo||'Compromiso')+'</div><div class="md-sub">'+esc(bloqueTxt(e))+'</div></div></div>'; }).join('');
    var todas=tareasDeArea(id);
    var secs=[['curso','▶ En curso'],['pendiente','Pendientes'],['pausada','⏸ Pausadas'],['espera','⏳ En espera'],['completada','✔ Completadas']];
    var MAX=5;
    secs.forEach(function(sc){
      var e=sc[0], n=c[e];
      if(e==='espera' && !n) return;
      html+='<div class="tr-sec"><span>'+sc[1]+' · '+n+'</span></div>';
      if(!n){ html+='<div class="tr-hint">Nada aquí por ahora.</div>'; return; }
      if(e==='completada' && !st.areaHechas){ html+='<div style="text-align:center"><button class="tr-link" data-act="areahechas">Ver completadas ('+n+')</button></div>'; return; }
      var lst=todas.filter(function(t){ return t.estado===e; });
      lst = e==='completada' ? lst.sort(porHechaDesc) : lst.sort(ordenTareas);
      var vis = st.areaMas[e] ? lst : lst.slice(0,MAX);
      html+=vis.map(function(t){ return fila(t,{full:true, restaurar:t.hecha, sinArea:true}); }).join('');
      if(lst.length>MAX) html+='<div style="text-align:center"><button class="tr-link" data-act="areamas" data-v="'+e+'">'+(st.areaMas[e]?'Ver menos':'Ver '+(lst.length-MAX)+' más')+'</button></div>';
      if(e==='completada') html+='<div style="text-align:center"><button class="tr-link" data-act="areahechas">Ocultar completadas</button></div>';
    });
    return html;
  }

  // Cambiar una tarea de área (con sus bloques del calendario)
  function abrirMoverArea(id){
    var t=porId(id); if(!t) return;
    var actual=areaDe(t);
    var m=sheet('<div class="tr-sec" style="margin-top:0"><span>Mover a otra área</span></div>'
      +listas().map(function(l){ return '<button type="button" class="tr-estopt'+(l.id===actual?' on':'')+'" data-a="'+esc(l.id)+'"><span class="tr-dot" style="background:'+esc(l.color)+'"></span> '+esc(l.nombre)+'</button>'; }).join('')
      +'<div class="tr-acc"><button type="button" class="tr-sec2" id="trs-no">Cerrar</button></div>');
    m.querySelector('#trs-no').onclick=cerrarSheet;
    [].slice.call(m.querySelectorAll('[data-a]')).forEach(function(b){ b.onclick=function(){ var a=b.getAttribute('data-a'); cerrarSheet(); if(a!==actual) moverArea(t,a); }; });
  }
  function moverArea(t, dest){
    var prev=t.lista, bl=bloquesDe(t.id), prevB=bl.map(function(e){ return e.calendario; });
    t.lista=dest; bl.forEach(function(e){ e.calendario=dest; });
    guardar(); if(bl.length && typeof agGuardar==='function') agGuardar();
    pintar();
    snack('Movida a '+lista(dest).nombre, function(){ t.lista=prev; bl.forEach(function(e,i){ e.calendario=prevB[i]; }); guardar(); if(bl.length && typeof agGuardar==='function') agGuardar(); pintar(); }, 6000);
  }

  // Crear / editar área (comparte datos con el calendario: mismas áreas en los dos lados)
  function guardarListaAreas(l){
    if(typeof agGuardarCalendarios==='function') agGuardarCalendarios(l); else DB.set('agenda_calendarios', l);
  }
  function abrirArea(id){
    var ls_=listas(), a = id ? ls_.filter(function(x){return x.id===id;})[0] : null;
    if(id && !a) return;
    var color = a ? a.color : COLORES_AREA[ls_.length % COLORES_AREA.length];
    var m=sheet('<h3 style="margin:0 0 10px;font-family:\'Playfair Display\',serif;color:#7a3c4b">'+(a?'Editar área':'Nueva área')+'</h3>'
      +'<div class="tr-f"><label>Nombre</label><input id="tra-n" type="text" value="'+esc(a?a.nombre:'')+'" placeholder="Ej: Docencia"></div>'
      +'<div class="tr-f"><label>¿Qué incluye? (opcional)</label><textarea id="tra-d" rows="3" placeholder="Ej: clases, preparación, calificación">'+esc(a?descArea(a.id):'')+'</textarea></div>'
      +'<div class="tr-f"><label>Color</label><div class="ar-sw" id="tra-sw" data-color="'+esc(color)+'">'+COLORES_AREA.map(function(k){ return '<span data-k="'+k+'" style="background:'+k+'" class="'+(k===color?'sel':'')+'"></span>'; }).join('')+'</div></div>'
      +'<div class="tr-hint" id="tra-err" style="color:#b3453a"></div>'
      +'<div class="tr-acc">'+((a && a.id!=='consultorio')?'<button type="button" class="tr-sec2" id="tra-del" style="color:#b3453a">Eliminar</button>':'')
      +'<button type="button" class="tr-sec2" id="tra-no">Cancelar</button><button type="button" class="tr-pri" id="tra-ok">Guardar</button></div>');
    var sw=m.querySelector('#tra-sw');
    [].slice.call(sw.children).forEach(function(sp){ sp.onclick=function(){ sw.setAttribute('data-color',sp.getAttribute('data-k')); [].slice.call(sw.children).forEach(function(x){ x.classList.remove('sel'); }); sp.classList.add('sel'); }; });
    m.querySelector('#tra-no').onclick=cerrarSheet;
    var del=m.querySelector('#tra-del'); if(del) del.onclick=function(){ cerrarSheet(); eliminarArea(id); };
    m.querySelector('#tra-ok').onclick=function(){
      var nombre=m.querySelector('#tra-n').value.replace(/\s+/g,' ').trim(), desc=m.querySelector('#tra-d').value.trim(), col=sw.getAttribute('data-color');
      var err=m.querySelector('#tra-err');
      if(!nombre){ err.textContent='Escribe un nombre para el área.'; return; }
      if(ls_.some(function(x){ return x.id!==id && x.nombre.toLowerCase()===nombre.toLowerCase(); })){ err.textContent='Ya existe un área con ese nombre.'; return; }
      var base=ls_.map(function(c){ return {id:c.id,nombre:c.nombre,color:c.color}; }), nid=id;
      if(id) base.forEach(function(c){ if(c.id===id){ c.nombre=nombre; c.color=col; } });
      else { nid='cal_'+Date.now().toString(36); base.push({id:nid,nombre:nombre,color:col}); }
      guardarListaAreas(base);
      var dm=descMap(); dm[nid]=desc; DB.set('areas_desc', dm);
      cerrarSheet();
      if(!id){ st.area=nid; st.vista='areas'; ls('tr_vista','areas'); }
      pintar(); snack(id?'Área guardada ✓':'Área creada ✓',null,2500);
    };
    setTimeout(function(){ var i=m.querySelector('#tra-n'); if(i && !a) i.focus(); },50);
  }
  function eliminarArea(id){
    if(id==='consultorio'){ snack('Esta área no se puede eliminar',null,3000); return; }
    var ls_=listas(), a=ls_.filter(function(x){return x.id===id;})[0]; if(!a) return;
    var tareas=tareasDeArea(id), eventos=evs().filter(function(e){ return (e.calendario||'consultorio')===id; });
    var otras=ls_.filter(function(x){return x.id!==id;});
    function quitar(dest){
      if(dest){ tareas.forEach(function(t){ t.lista=dest; }); eventos.forEach(function(e){ e.calendario=dest; }); guardar(); if(eventos.length && typeof agGuardar==='function') agGuardar(); }
      guardarListaAreas(ls_.filter(function(x){return x.id!==id;}).map(function(c){ return {id:c.id,nombre:c.nombre,color:c.color}; }));
      var dm=descMap(); delete dm[id]; DB.set('areas_desc', dm);
      try{ var o=JSON.parse(localStorage.getItem('ag_cal_ocultos')||'[]').filter(function(x){return x!==id;}); localStorage.setItem('ag_cal_ocultos',JSON.stringify(o)); }catch(e){}
      st.area=''; pintar(); snack('Área eliminada',null,3000);
    }
    if(!tareas.length && !eventos.length){
      var m0=sheet('<h3 style="margin:0 0 10px;font-family:\'Playfair Display\',serif;color:#7a3c4b">¿Eliminar «'+esc(a.nombre)+'»?</h3><div class="tr-hint">Está vacía.</div>'
        +'<div class="tr-acc"><button type="button" class="tr-sec2" id="trd-no">Cancelar</button><button type="button" class="tr-pri" id="trd-ok">Eliminar</button></div>');
      m0.querySelector('#trd-no').onclick=cerrarSheet; m0.querySelector('#trd-ok').onclick=function(){ cerrarSheet(); quitar(''); };
      return;
    }
    var m=sheet('<h3 style="margin:0 0 10px;font-family:\'Playfair Display\',serif;color:#7a3c4b">Eliminar «'+esc(a.nombre)+'»</h3>'
      +'<div class="tr-hint" style="margin-bottom:8px">Tiene '+tareas.length+' tarea'+(tareas.length===1?'':'s')+' y '+eventos.length+' compromiso'+(eventos.length===1?'':'s')+'. No se borra nada: pasan a otra área.</div>'
      +'<div class="tr-f"><label>Pasar todo a…</label><select id="trd-dest">'+otras.map(function(x){ return '<option value="'+esc(x.id)+'">'+esc(x.nombre)+'</option>'; }).join('')+'</select></div>'
      +'<div class="tr-acc"><button type="button" class="tr-sec2" id="trd-no">Cancelar</button><button type="button" class="tr-pri" id="trd-ok">Mover y eliminar</button></div>');
    m.querySelector('#trd-no').onclick=cerrarSheet;
    m.querySelector('#trd-ok').onclick=function(){ var d=m.querySelector('#trd-dest').value; cerrarSheet(); quitar(d); };
  }

  // ---------- ventanitas ----------
  function cerrarSheet(){ var m=document.getElementById('tr-sheet'); if(m) m.remove(); }
  function sheet(html){
    cerrarSheet();
    var m=document.createElement('div'); m.id='tr-sheet'; m.className='tr-bg'; m.style.zIndex='9950';
    m.onclick=function(e){ if(e.target===m) cerrarSheet(); };
    m.innerHTML='<div class="tr-modal">'+html+'</div>'; document.body.appendChild(m); return m;
  }
  function preguntar(titulo, label, val, multi, cb){
    var m=sheet('<h3 style="margin:0 0 12px;font-family:\'Playfair Display\',serif;color:#7a3c4b">'+titulo+'</h3><div class="tr-f"><label>'+label+'</label>'
      +(multi?'<textarea id="trq" rows="3">'+esc(val)+'</textarea>':'<input id="trq" type="text" value="'+esc(val)+'">')
      +'</div><div class="tr-acc"><button type="button" class="tr-sec2" id="trq-no">Cancelar</button><button type="button" class="tr-pri" id="trq-ok">Guardar</button></div>');
    m.querySelector('#trq-no').onclick=cerrarSheet;
    m.querySelector('#trq-ok').onclick=function(){ var v=m.querySelector('#trq').value.trim(); cerrarSheet(); cb(v); };
    setTimeout(function(){ var i=m.querySelector('#trq'); if(i) i.focus(); },50);
  }
  function pedirPasos(cb){
    var m=sheet('<h3 style="margin:0 0 6px;font-family:\'Playfair Display\',serif;color:#7a3c4b">✂ Dividir en pasos</h3>'
      +'<div style="font-size:.84rem;color:#6b5459;margin-bottom:8px">Escribe un paso por línea, cada uno con un verbo concreto (Revisar…, Enviar…). No tiene que quedar perfecto: luego los editas.</div>'
      +'<div class="tr-f"><textarea id="trp" rows="6" placeholder="Revisar el material entregado&#10;Identificar lo que falta&#10;Corregir lo pendiente&#10;Revisar todo completo&#10;Entregar la versión final"></textarea></div>'
      +'<div class="tr-acc"><button type="button" class="tr-sec2" id="trp-no">Cancelar</button><button type="button" class="tr-pri" id="trp-ok">Agregar pasos</button></div>');
    m.querySelector('#trp-no').onclick=cerrarSheet;
    m.querySelector('#trp-ok').onclick=function(){
      var lines=m.querySelector('#trp').value.split(/\n/).map(function(x){ return x.replace(/^\s*(?:[-•*·]|\d+[.)])\s*/,'').trim(); }).filter(Boolean).slice(0,20);
      if(!lines.length){ m.querySelector('#trp').focus(); return; }
      cerrarSheet(); cb(lines);
    };
    setTimeout(function(){ var i=m.querySelector('#trp'); if(i) i.focus(); },50);
  }
  function dividirTarea(id){
    var t=porId(id); if(!t) return;
    pedirPasos(function(lines){
      t.pasos=(t.pasos||[]).concat(lines.map(function(x){ return {t:x,d:false}; }));
      st.abiertas[t.id]=true; guardar(); pintar(); snack('Tarea dividida en '+lines.length+' paso'+(lines.length>1?'s':''),null,3000);
    });
  }

  // ===================== MI DÍA =====================
  var H0_DIA=6*60, H1_DIA=21*60;
  function minDe(iso){ var d=new Date(iso); return d.getHours()*60+d.getMinutes(); }
  function finMinEv(e){
    var ini=new Date(e.inicio), fin=e.fin?new Date(e.fin):null;
    if(!fin||isNaN(fin)||fin<=ini) fin=new Date(ini.getTime()+50*60000);
    return fin.toDateString()===ini.toDateString() ? fin.getHours()*60+fin.getMinutes() : 24*60;
  }
  function eventosHoy(){ var h=hoy(); return evs().filter(function(e){ return e.inicio && String(e.inicio).slice(0,10)===h; }).sort(function(a,b){ return String(a.inicio).localeCompare(String(b.inicio)); }); }
  function ocupadosHoy(){
    return eventosHoy().map(function(e){ return {ini:minDe(e.inicio)-(parseInt(e.viajeAntes,10)||0), fin:finMinEv(e)+(parseInt(e.viajeDespues,10)||0), e:e}; });
  }
  function ahoraMin(){ var n=new Date(); return n.getHours()*60+n.getMinutes(); }
  function huecosHoy(minimo){
    var oc=ocupadosHoy(), ahora=ahoraMin(), cur=Math.max(H0_DIA, Math.ceil(ahora/5)*5), gaps=[];
    oc.forEach(function(o){ if(o.ini-cur>=minimo && cur<H1_DIA) gaps.push([cur, Math.min(o.ini,H1_DIA)]); if(o.fin>cur) cur=o.fin; });
    if(H1_DIA-cur>=minimo) gaps.push([cur,H1_DIA]);
    return gaps;
  }
  function estadoAhora(){      // {libre:bool, hasta:min, e:evento|null}
    var oc=ocupadosHoy(), a=ahoraMin();
    for(var i=0;i<oc.length;i++){ if(a>=oc[i].ini && a<oc[i].fin) return {libre:false, hasta:oc[i].fin, e:oc[i].e}; }
    var sig=oc.filter(function(o){return o.ini>a;})[0];
    return {libre:true, hasta:sig?sig.ini:null, e:sig?sig.e:null};
  }
  function durMin(m){ var h=Math.floor(m/60), mi=m%60; return (h?h+' h':'')+(h&&mi?' ':'')+(mi?mi+' min':'')||'0 min'; }
  function hm(m){ var h=Math.floor(m/60), mi=m%60; return ((h%12)||12)+':'+p2(mi)+' '+(h<12?'a. m.':'p. m.'); }
  function horaIso(iso){ var m=minDe(iso); return hm(m); }

  function eligibles(){
    var h=hoy(), lim=sumarDias(h,7);
    return pendientes().filter(function(t){
      if(t.estado==='espera') return false;
      if(t.planDia===h && t.plan) return true;
      if(t.enfoque||t.estado==='curso'||t.estado==='pausada') return true;
      if(t.fecha && t.fecha<=h) return true;
      if(t.limite && t.limite<=lim) return true;
      return false;
    });
  }
  function puntuar(t, disp){
    var h=hoy(), sc=0, why=[];
    if(t.limite){
      var d=Math.round((desdeYMD(t.limite)-desdeYMD(h))/864e5);
      if(d<=0){ sc+=100; why.push(d<0?'su fecha límite ya pasó':'vence hoy'); }
      else if(d===1){ sc+=80; why.push('vence mañana'); }
      else if(d<=3){ sc+=60; why.push('vence en '+d+' días'); }
      else if(d<=7){ sc+=30; why.push('vence en '+d+' días'); }
    }
    if(t.prioridad==='alta'){ sc+=40; why.push('prioridad alta'); } else if(t.prioridad==='normal') sc+=15;
    if(t.fecha===h) sc+=10;
    var need=t.minutos||15;
    if(disp>0){ if(disp>=need){ sc+=20; if(disp<900) why.push('cabe en tu espacio libre'); } else sc-=30; }
    return {sc:sc, why:why};
  }
  function dispAntes(){ var e=estadoAhora(); if(!e.libre) return 0; return e.hasta==null ? 999 : e.hasta-ahoraMin(); }
  function urgente(){
    var a=ahoraMin(), oc=ocupadosHoy().filter(function(o){ return !o.e.tareaId && o.ini>a && o.ini-a<=20; })[0];
    return oc ? {e:oc.e, en:oc.ini-a} : null;
  }
  // Reglas: 1) en foco/en curso se retoma primero  2) la que elegiste como importante
  // 3) por fecha límite, prioridad y tiempo disponible. Nunca por ser fácil ni por antigüedad.
  function recomendar(){
    var h=hoy(), c=eligibles().filter(function(t){ return st.saltadas.indexOf(t.id)<0; }), urg=urgente();
    var act=tareaActiva(); if(act) return {t:act, modo:'continuar', why:['la dejaste en foco: lo natural es continuar donde ibas'], urg:urg};
    var curso=c.filter(function(t){return t.estado==='curso';}).sort(function(a,b){ return String(b.actualizada||'').localeCompare(String(a.actualizada||'')); })[0];
    if(curso) return {t:curso, modo:'retomar', why:['ya está en curso, conviene retomarla primero'], urg:urg};
    var pr=c.filter(function(t){return t.planDia===h && t.plan==='principal';})[0];
    if(pr) return {t:pr, modo:'plan', why:['la elegiste como tu tarea importante de hoy'], urg:urg};
    var disp=dispAntes();
    var lst=c.map(function(t){ var p=puntuar(t,disp); return {t:t, sc:p.sc, why:p.why}; }).sort(function(a,b){ return b.sc-a.sc || a.t.titulo.localeCompare(b.t.titulo); });
    if(!lst.length) return {t:null, why:[], urg:urg};
    return {t:lst[0].t, modo:'nueva', why:lst[0].why, urg:urg};
  }
  function opcionalesHoy(rec){
    var h=hoy(), c=eligibles().filter(function(t){ return (!rec.t||t.id!==rec.t.id) && t.estado==='pendiente' && st.saltadas.indexOf(t.id)<0; });
    var sec=c.filter(function(t){return t.planDia===h && t.plan==='secundaria';});
    if(sec.length) return sec.slice(0,2);
    var disp=dispAntes();
    return c.map(function(t){ var p=puntuar(t,disp); return {t:t,sc:p.sc}; }).sort(function(a,b){ return b.sc-a.sc || a.t.titulo.localeCompare(b.t.titulo); }).slice(0,2).map(function(x){return x.t;});
  }

  function vistaMiDia(){
    var h=hoy(), evh=eventosHoy(), ahora=ahoraMin(), html='';
    var rec=recomendar(), opc=opcionalesHoy(rec);
    var pausadas=pendientes().filter(function(t){ return (t.estado==='pausada'||(t.estado==='curso'&&!t.enfoque)) && (!rec.t||t.id!==rec.t.id); }).sort(function(a,b){ return String(b.actualizada||'').localeCompare(String(a.actualizada||'')); }).slice(0,3);
    var mostrados=[rec.t?rec.t.id:''].concat(opc.map(function(t){return t.id;}),pausadas.map(function(t){return t.id;}));
    var despues=eligibles().filter(function(t){ return mostrados.indexOf(t.id)<0; });

    // BLOQUE 1: cómo está tu día
    var fixed=evh.filter(function(e){return !e.tareaId;}), bloques=evh.filter(function(e){return e.tareaId;});
    var ocup=ocupadosHoy().reduce(function(a,o){ return a+Math.max(0,Math.min(o.fin,H1_DIA)-Math.max(o.ini,H0_DIA)); },0);
    var gaps=huecosHoy(30), libre=gaps.reduce(function(a,g){return a+(g[1]-g[0]);},0), ea=estadoAhora();
    var ahoraTxt = ea.libre ? (ea.hasta!=null ? 'Ahora estás libre hasta las <b>'+hm(ea.hasta)+'</b> ('+durMin(Math.max(0,ea.hasta-ahora))+').' : (ahora<H1_DIA?'Ahora estás libre y no tienes más compromisos hoy.':'Ya terminó el horario de hoy.'))
                        : 'Ahora estás en <b>'+esc(ea.e.titulo)+'</b> hasta las '+hm(ea.hasta);
    var hechasHoy=T.filter(function(t){ return t.hecha && t.hechaEn && t.hechaEn.slice(0,10)===h; }).length, mh=minHoy();
    var logro=(hechasHoy||mh)?'<div class="md-sub" style="margin-top:6px">Hoy llevas'+(hechasHoy?' ✔ '+hechasHoy+' hecha'+(hechasHoy>1?'s':''):'')+(hechasHoy&&mh?' ·':'')+(mh?' ⏱ '+mh+' min de enfoque':'')+'. Todo suma.</div>':'';
    html+='<div class="md-h" style="margin-top:4px">1 · Cómo está tu día</div><div class="md-card md-res">'
      +'<b>'+fixed.length+'</b> compromiso'+(fixed.length===1?'':'s')+(bloques.length?' + '+bloques.length+' bloque'+(bloques.length>1?'s':'')+' de tarea':'')+' · ocupado <b>'+durMin(ocup)+'</b> · libre <b>'+(ahora<H1_DIA?durMin(libre):'0 min')+'</b>'
      +'<div style="margin-top:4px">'+ahoraTxt+'</div>'
      +(gaps.length?'<div>'+gaps.slice(0,4).map(function(g){ return '<span class="md-g">'+hm(g[0])+' – '+hm(g[1])+' · '+durMin(g[1]-g[0])+'</span>'; }).join('')+'</div>':'')
      +logro
      +'<div style="margin-top:8px;display:flex;gap:6px;flex-wrap:wrap"><button class="tr-mini" data-act="planear">📝 Planear mi día</button><button class="tr-mini" data-act="reorg">🔄 Reorganizar lo que queda del día</button></div></div>';

    // BLOQUE 2: compromisos de hoy
    html+='<div class="md-h">2 · Compromisos de hoy</div><div class="md-card">';
    if(!evh.length) html+='<div class="md-sub" style="font-size:.88rem">Sin compromisos con hora hoy. Tu día está abierto.</div>';
    else html+=evh.map(function(e){
      var ini=minDe(e.inicio), fin=finMinEv(e), cls=fin<=ahora?' past':(ini<=ahora&&ahora<fin?' now':'');
      var l=lista(e.calendario||'consultorio'), v=[];
      if(parseInt(e.viajeAntes,10)) v.push('🚗 '+e.viajeAntes+' min antes'); if(parseInt(e.viajeDespues,10)) v.push('🚗 '+e.viajeDespues+' min después');
      return '<div class="md-ev'+cls+'"><div class="md-t">'+hm(ini)+'<br><span style="font-weight:400;color:#8a7279">'+hm(fin)+'</span></div><div><div class="tr-tit">'+(e.tareaId?'📌 ':'')+esc(e.titulo)+'</div><div class="md-sub"><span class="tr-dot" style="background:'+esc(l.color)+'"></span>'+esc(l.nombre)+(e.tareaId?' · bloque de trabajo (flexible)':'')+(v.length?' · '+esc(v.join(' · ')):'')+(cls===' now'?' · <b>ahora</b>':'')+'</div></div></div>';
    }).join('');
    html+='<div style="text-align:right"><button class="md-lnk" data-act="vercal">Ver calendario</button></div></div>';

    // BLOQUE 3: tu siguiente paso
    html+='<div class="md-h">3 · Tu siguiente paso</div>';
    if(rec.urg) html+='<div class="md-alerta">⏰ Tienes <b>'+esc(rec.urg.e.titulo)+'</b> en '+rec.urg.en+' min. Prepárate con calma; la tarea de abajo puede esperar.</div>';
    if(rec.t){
      var t=rec.t, l=lista(t.lista||'consultorio'), na=proximaAccion(t), tm=totalMin(t);
      var bt = rec.modo==='continuar' ? '▶ Continuar' : rec.modo==='retomar' ? '▶ Retomar tarea' : '▶ Empezar tarea';
      html+='<div class="md-step"><div class="tit">'+esc(t.titulo)+'</div>'
        +'<div class="md-sub"><span class="tr-dot" style="background:'+esc(l.color)+'"></span>'+esc(l.nombre)+(t.minutos?' · ⏱ '+t.minutos+' min orientativos':'')+(tm?' · llevas '+tm+' min':'')+(t.limite?' · ⛔ límite '+esc(etiquetaDia(t.limite)):'')+'</div>'
        +'<div class="acc">'+(na?'→ '+esc(na):'<span style="opacity:.7">Aún no tiene siguiente acción: al empezar la defines.</span>')+'</div>'
        +((t.estado==='pausada'||t.estado==='curso')&&t.punto?'<div class="tr-next tr-punto" style="margin-top:8px">⏸ Al volver: '+esc(t.punto)+'</div>':'')
        +'<div style="margin-top:12px;display:flex;gap:8px;align-items:center;flex-wrap:wrap"><button class="tr-nueva" data-act="empezar" data-id="'+esc(t.id)+'">'+bt+'</button><button class="md-lnk" data-act="otra" data-id="'+esc(t.id)+'">Ahora no, otra</button></div>'
        +(rec.why.length?'<div class="md-why">Por qué esta: '+esc(rec.why.join(' · '))+'</div>':'')+'</div>';
    } else {
      html+='<div class="md-card tr-vacio" style="padding:18px"><b>Nada que necesite tu atención ahora 🌿</b>Descansa o revisa tu Bandeja. Si quieres avanzar algo, elige una tarea en «Planear mi día».</div>';
    }

    // BLOQUE 4: opcionales
    if(opc.length){
      html+='<div class="md-h">4 · Si tienes más energía o tiempo</div><div class="md-sub" style="margin:-4px 2px 8px">Opcional: no son obligaciones adicionales.</div>'
        +opc.map(function(t){ var l=lista(t.lista||'consultorio'), na=proximaAccion(t);
          return '<div class="md-opt"><div class="m"><div class="tt">'+esc(t.titulo)+'</div><div class="md-sub"><span class="tr-dot" style="background:'+esc(l.color)+'"></span>'+esc(l.nombre)+(t.minutos?' · ⏱ '+t.minutos+' min':'')+(na?' · → '+esc(na):'')+'</div></div><button class="tr-mini" data-act="empezar" data-id="'+esc(t.id)+'">Empezar</button></div>'; }).join('');
    }

    // BLOQUE 5: retomar
    if(pausadas.length){
      html+='<div class="md-h">5 · Retomar lo pendiente</div>'
        +pausadas.map(function(t){ var l=lista(t.lista||'consultorio');
          return '<div class="md-opt"><div class="m"><div class="tt">'+esc(t.titulo)+'</div><div class="md-sub">'+(t.punto?'⏸ '+esc(t.punto):'<span class="tr-dot" style="background:'+esc(l.color)+'"></span>'+esc(l.nombre))+(t.actualizada?' · '+esc(ultimaTxt(t)):'')+'</div></div><button class="tr-mini pri" data-act="empezar" data-id="'+esc(t.id)+'">▶ Retomar</button></div>'; }).join('');
    }

    var nid=ideasActivas().length;
    if(nid) html+='<div class="md-sub" style="margin-top:14px;text-align:center">📥 Tienes '+nid+' idea'+(nid>1?'s':'')+' guardada'+(nid>1?'s':'')+' en la Bandeja. <button class="md-lnk" data-act="irbandeja">Revisar cuando quieras</button></div>';
    // Pendientes para después: guardados, fuera del centro
    if(despues.length){
      html+='<div class="md-h">Pendientes para después</div><div class="md-sub" style="margin:-4px 2px 6px">Siguen guardados. No hace falta hacerlos hoy.</div>'
        +'<button class="md-lnk" data-act="pdespues">'+(st.verDespues?'Ocultar':'Ver las '+despues.length+' tareas')+'</button>'
        +(st.verDespues?despues.sort(ordenTareas).map(function(t){ return fila(t,{}); }).join(''):'');
    }
    return html;
  }

  // ---------- Planear mi día: 1 importante + hasta 2 opcionales (orientación, no obligación) ----------
  function abrirPlan(){
    var h=hoy();
    function lista_(){
      var disp=dispAntes();
      return pendientes().filter(function(t){return t.estado!=='espera';}).map(function(t){ return {t:t, sc:puntuar(t,disp).sc}; }).sort(function(a,b){ return b.sc-a.sc || a.t.titulo.localeCompare(b.t.titulo); }).slice(0,40).map(function(x){return x.t;});
    }
    function pinta(){
      var ts=lista_(), pr=ts.filter(function(t){return t.planDia===h&&t.plan==='principal';}).length, se=ts.filter(function(t){return t.planDia===h&&t.plan==='secundaria';}).length;
      var m=document.getElementById('tr-sheet'); var cont=m? m.querySelector('.tr-modal'):null; if(!cont) return;
      cont.innerHTML='<h3 style="margin:0 0 4px;font-family:\'Playfair Display\',serif;color:#7a3c4b">📝 Planear mi día</h3><div style="font-size:.84rem;color:#6b5459;margin-bottom:8px">Elige <b>1 tarea importante</b> y hasta <b>2 opcionales</b>. Es una orientación, no un límite ('+pr+'/1 · '+se+'/2).</div>'
        +(ts.length?ts.map(function(t){ var l=lista(t.lista||'consultorio'), a=t.planDia===h?t.plan:'';
          return '<div class="md-plan"><div class="m">'+esc(t.titulo)+'<div class="md-sub"><span class="tr-dot" style="background:'+esc(l.color)+'"></span>'+esc(l.nombre)+(t.limite?' · ⛔ '+esc(etiquetaDia(t.limite)):'')+'</div></div><button data-id="'+esc(t.id)+'" data-p="principal" class="'+(a==='principal'?'on':'')+'">⭐ Importante</button><button data-id="'+esc(t.id)+'" data-p="secundaria" class="'+(a==='secundaria'?'on':'')+'">Opcional</button></div>'; }).join('')
          :'<div class="tr-vacio">No tienes tareas pendientes.</div>')
        +'<div class="tr-acc"><button type="button" class="tr-pri" id="trpl-ok">Listo</button></div>';
      cont.querySelector('#trpl-ok').onclick=function(){ cerrarSheet(); pintar(); };
      [].slice.call(cont.querySelectorAll('[data-p]')).forEach(function(b){ b.onclick=function(){
        var t=porId(b.getAttribute('data-id')), tipo=b.getAttribute('data-p'); if(!t) return;
        if(t.planDia===h && t.plan===tipo){ t.plan=''; t.planDia=''; }
        else {
          if(tipo==='principal') T.forEach(function(x){ if(x.planDia===h && x.plan==='principal'){ x.plan=''; x.planDia=''; } });
          else if(T.filter(function(x){return x.planDia===h && x.plan==='secundaria' && x.id!==t.id;}).length>=2){ snack('Ya tienes 2 opcionales. Quita una para elegir otra.',null,3000); return; }
          t.plan=tipo; t.planDia=h;
        }
        guardar(); pinta();
      }; });
    }
    sheet(''); pinta();
  }

  // ---------- Reorganizar lo que queda del día: recalcula lo que cabe; el resto sigue guardado, sin moverse ----------
  function reorganizarDia(){
    var h=hoy(), prev=T.map(function(t){ return [t,t.plan,t.planDia]; });
    var gaps=huecosHoy(15), cap=gaps.reduce(function(a,g){return a+(g[1]-g[0]);},0);
    T.forEach(function(t){ if(t.planDia===h){ t.plan=''; t.planDia=''; } });
    var msg;
    if(cap<10){ msg='Hoy casi no queda espacio libre. Descansa: todo lo demás sigue guardado, nada se movió.'; }
    else {
      var disp=dispAntes(), act=tareaActiva();
      var c=eligibles().filter(function(t){return st.saltadas.indexOf(t.id)<0;}), curso=c.filter(function(t){return t.enfoque||t.estado==='curso';});
      var otros=c.filter(function(t){return curso.indexOf(t)<0;}).map(function(t){ return {t:t,sc:puntuar(t,disp).sc}; }).sort(function(a,b){ return b.sc-a.sc || a.t.titulo.localeCompare(b.t.titulo); }).map(function(x){return x.t;});
      var orden=curso.concat(otros), elegidas=[], resto=cap;
      orden.forEach(function(t){ if(elegidas.length>=3) return; var need=t.minutos||15; if(need<=resto || !elegidas.length){ elegidas.push(t); resto-=need; } });
      elegidas.forEach(function(t,i){ t.plan = i===0?'principal':'secundaria'; t.planDia=h; });
      msg='Listo: con tus '+durMin(cap)+' libres dejé '+(elegidas.length?'1 importante'+(elegidas.length>1?' y '+(elegidas.length-1)+' opcional'+(elegidas.length>2?'es':''):''):'nada')+'. El resto sigue guardado, sin cambiar de fecha.';
    }
    guardar(); st.saltadas=[]; pintar();
    snack(msg, function(){ prev.forEach(function(p){ p[0].plan=p[1]; p[0].planDia=p[2]; }); guardar(); pintar(); }, 9000);
  }

  // ---------- estados ----------
  function instantanea(t){ return {estado:t.estado,punto:t.punto,esperaDe:t.esperaDe,enfoque:t.enfoque}; }
  function cambiarEstado(t, nuevo, datos){
    var prev=instantanea(t); t.estado=nuevo; if(nuevo!=='curso') t.enfoque=false; if(datos) Object.keys(datos).forEach(function(k){ t[k]=datos[k]; });
    guardar(); pintar();
    snack('Estado: '+ESTADO_TXT[nuevo], function(){ Object.keys(prev).forEach(function(k){ t[k]=prev[k]; }); guardar(); pintar(); }, 5000);
  }
  function aplicarEstado(t, e){
    if(e===t.estado) return;
    if(e==='pausada') preguntar('⏸ Pausar tarea','¿Dónde te quedaste y qué haces cuando regreses?',t.punto||'',true,function(v){ cambiarEstado(t,'pausada',{punto:v}); });
    else if(e==='espera') preguntar('⏳ En espera','¿Qué o a quién estás esperando?',t.esperaDe||'',false,function(v){ cambiarEstado(t,'espera',{esperaDe:v}); });
    else cambiarEstado(t,e);
  }
  function abrirEstado(id){
    var t=porId(id); if(!t||t.hecha) return;
    var m=sheet('<div class="tr-sec" style="margin-top:0"><span>Estado de la tarea</span></div>'
      +ESTADOS.map(function(e){ return '<button type="button" class="tr-estopt'+(t.estado===e[0]?' on':'')+'" data-e="'+e[0]+'">'+ESTADO_ICO[e[0]]+' '+e[1]+'</button>'; }).join('')
      +'<div class="tr-acc"><button type="button" class="tr-sec2" id="trs-no">Cerrar</button></div>');
    m.querySelector('#trs-no').onclick=cerrarSheet;
    [].slice.call(m.querySelectorAll('[data-e]')).forEach(function(b){ b.onclick=function(){ var e=b.getAttribute('data-e'); cerrarSheet(); aplicarEstado(t,e); }; });
  }

  // La tarea con criterio de finalización o pasos pendientes se confirma antes de cerrarse
  function intentarCompletar(id, animar, despues){
    var t=porId(id); if(!t || t.hecha) return;
    var pend=(t.pasos||[]).filter(function(p){return !p.d;});
    if(!t.criterio && !pend.length){ completar(id,animar); if(despues) despues(); return; }
    var m=sheet('<h3 style="margin:0 0 10px;font-family:\'Playfair Display\',serif;color:#7a3c4b">¿Está terminada?</h3>'
      +(t.criterio?'<div class="tr-panel"><b>Terminada significa:</b><br>'+esc(t.criterio)+'</div>':'')
      +(pend.length?'<div class="tr-panel"><b>Pasos sin marcar ('+pend.length+'):</b><br>'+pend.map(function(p){ return '• '+esc(p.t); }).join('<br>')+'</div>':'')
      +'<div class="tr-acc"><button type="button" class="tr-sec2" id="trc-no">Todavía no</button><button type="button" class="tr-pri" id="trc-si">Sí, está completa</button></div>');
    m.querySelector('#trc-no').onclick=cerrarSheet;
    m.querySelector('#trc-si').onclick=function(){ cerrarSheet(); completar(id,false); if(despues) despues(); };
  }

  // ---------- Nueva tarea (4 preguntas) ----------
  function abrirNueva(){
    var ls_=listas();
    var area=areaPref(ls_);
    var conLim=false;
    var m=sheet('<h3 style="margin:0 0 12px;font-family:\'Playfair Display\',serif;color:#7a3c4b">＋ Nueva tarea</h3>'
      +'<div class="tr-f"><label>1. ¿Qué necesitas hacer?</label><input id="trn-tit" type="text" autocomplete="off" placeholder="Ej: Terminar carrusel de movilidad"><div class="tr-hint">Escribe el resultado que quieres conseguir.</div></div>'
      +'<div class="tr-f"><label>2. ¿A qué área pertenece?</label><div class="tr-chips" id="trn-area">'+ls_.map(function(l){ return '<button type="button" class="tr-chip'+(l.id===area?' on':'')+'" data-a="'+esc(l.id)+'"><span class="tr-dot" style="background:'+esc(l.color)+'"></span>'+esc(l.nombre)+'</button>'; }).join('')+'</div></div>'
      +'<div class="tr-f"><label>3. ¿Tiene una fecha límite real?</label><div class="tr-chips"><button type="button" class="tr-chip on" data-l="no">No</button><button type="button" class="tr-chip" data-l="si">Sí</button></div><input type="date" id="trn-lim" min="'+hoy()+'" style="display:none;margin-top:6px"><div class="tr-hint">Solo si de verdad vence ese día (no si es un día que tú eliges).</div></div>'
      +'<div class="tr-f"><label>4. ¿Cuál es la siguiente acción?</label><input id="trn-sig" type="text" autocomplete="off" placeholder="Empieza con un verbo: Revisar, Llamar, Redactar…"><div class="tr-hint">Lo primero que harías. Los demás detalles los completas después.</div></div>'
      +'<div class="tr-acc"><button type="button" class="tr-sec2" id="trn-no">Cancelar</button><button type="button" class="tr-pri" id="trn-ok">Guardar tarea</button></div>');
    [].slice.call(m.querySelectorAll('[data-a]')).forEach(function(b){ b.onclick=function(){ area=b.getAttribute('data-a'); [].slice.call(m.querySelectorAll('[data-a]')).forEach(function(x){ x.classList.toggle('on',x===b); }); }; });
    [].slice.call(m.querySelectorAll('[data-l]')).forEach(function(b){ b.onclick=function(){ conLim=b.getAttribute('data-l')==='si'; [].slice.call(m.querySelectorAll('[data-l]')).forEach(function(x){ x.classList.toggle('on',x===b); }); var i=m.querySelector('#trn-lim'); i.style.display=conLim?'':'none'; if(conLim) i.focus(); }; });
    m.querySelector('#trn-tit').addEventListener('keydown',function(e){ if(e.key==='Enter'){ e.preventDefault(); m.querySelector('#trn-sig').focus(); } });
    m.querySelector('#trn-sig').addEventListener('keydown',function(e){ if(e.key==='Enter'){ e.preventDefault(); m.querySelector('#trn-ok').click(); } });
    m.querySelector('#trn-no').onclick=cerrarSheet;
    m.querySelector('#trn-ok').onclick=function(){
      var tit=m.querySelector('#trn-tit').value.replace(/\s+/g,' ').trim();
      if(!tit){ m.querySelector('#trn-tit').focus(); return; }
      var lim=conLim ? m.querySelector('#trn-lim').value : '';
      if(conLim && !lim){ m.querySelector('#trn-lim').focus(); return; }
      var t=normalizar({id:nuevoId(), titulo:tit, lista:area, fecha:'', limite:lim, hora:'', notas:'', pasos:[], rep:'', hecha:false, creada:new Date().toISOString(), siguiente:m.querySelector('#trn-sig').value.replace(/\s+/g,' ').trim()});
      T.push(t); ls('tr_lista',area); st.addLista=area; guardar(); cerrarSheet();
      if(st.vista==='tareas' && st.estadoV!=='todas' && st.estadoV!=='pendiente'){ st.estadoV='pendiente'; st.estadoElegido=true; ls('tr_estadoV','pendiente'); }
      pintar(); snack('Tarea guardada ✓ · toca la tarea para completar más detalles', function(){ T=T.filter(function(x){return x.id!==t.id;}); guardar(); pintar(); }, 6000);
    };
    setTimeout(function(){ m.querySelector('#trn-tit').focus(); },50);
  }

  // ---------- editor ----------
  function cerrarModal(){ var m=document.getElementById('tr-modal'); if(m) m.remove(); }
  function abrirEditor(id){
    cerrarModal();
    var t=porId(id); if(!t) return;
    var ls_=listas();
    var abierto=!!(t.limite||t.fecha||t.hora||t.rep||t.minutos||t.punto||t.criterio||t.esperaDe||(t.pasos&&t.pasos.length)||t.notas||t.prioridad!=='normal');
    var m=document.createElement('div'); m.id='tr-modal'; m.className='tr-bg';
    m.onclick=function(ev){ if(ev.target===m) cerrarModal(); };
    m.innerHTML = '<div class="tr-modal">'
      +'<div class="tr-f"><label>Tarea (el resultado que quieres conseguir)</label><textarea id="tre-tit" rows="2">'+esc(t.titulo)+'</textarea></div>'
      +'<div class="tr-2"><div class="tr-f"><label>Área</label><select id="tre-lista">'+ls_.map(function(l){return '<option value="'+esc(l.id)+'"'+(l.id===(t.lista||'consultorio')?' selected':'')+'>'+esc(l.nombre)+'</option>';}).join('')+'</select></div>'
      +(t.hecha ? '<div class="tr-f"><label>Estado</label><button type="button" class="tr-mini" id="tre-reabrir" style="padding:10px 12px">✔ Completada · Reabrir</button></div>'
               : '<div class="tr-f"><label>Estado</label><select id="tre-estado">'+ESTADOS.map(function(e){return '<option value="'+e[0]+'"'+(t.estado===e[0]?' selected':'')+'>'+e[1]+'</option>';}).join('')+'</select></div>')+'</div>'
      +'<div class="tr-f"><label>Siguiente acción</label><input type="text" id="tre-sig" value="'+esc(t.siguiente||'')+'" placeholder="Verbo concreto: Llamar a…, Redactar…, Revisar…"></div>'
      +'<details id="tre-mas"'+(abierto?' open':'')+'><summary class="tr-summ">Más detalles</summary>'
      +'<div class="tr-2"><div class="tr-f"><label>Prioridad</label><select id="tre-prio">'+[['alta','Alta'],['normal','Normal'],['baja','Baja']].map(function(o){return '<option value="'+o[0]+'"'+(t.prioridad===o[0]?' selected':'')+'>'+o[1]+'</option>';}).join('')+'</select></div>'
      +'<div class="tr-f"><label>Tiempo para el siguiente paso</label><select id="tre-min"><option value="0">— Sin estimar —</option>'+[5,10,15,25,45,60,90].map(function(x){return '<option value="'+x+'"'+(t.minutos===x?' selected':'')+'>'+x+' min</option>';}).join('')+'</select></div></div>'
      +'<div class="tr-f"><label>⛔ Fecha límite real (no se puede mover)</label><input type="date" id="tre-lim" value="'+esc(t.limite||'')+'"></div>'
      +'<div class="tr-f"><label>🎯 Fecha objetivo: cuándo PLANEAS hacerla (la eliges tú)</label><div class="tr-chips" style="margin:0 0 6px"><button type="button" class="tr-chip" data-q="hoy">Hoy</button><button type="button" class="tr-chip" data-q="manana">Mañana</button><button type="button" class="tr-chip" data-q="sem">En 1 semana</button><button type="button" class="tr-chip" data-q="sin">Sin fecha</button></div><input type="date" id="tre-fecha" value="'+esc(t.fecha||'')+'"></div>'
      +'<div class="tr-2"><div class="tr-f"><label>Hora (opcional)</label><input type="time" id="tre-hora" value="'+esc(t.hora||'')+'"></div>'
      +'<div class="tr-f"><label>Repetir</label><select id="tre-rep">'+[['','No se repite'],['diaria','Cada día'],['laboral','Lunes a viernes'],['semanal','Cada semana'],['mensual','Cada mes']].map(function(o){return '<option value="'+o[0]+'"'+((t.rep||'')===o[0]?' selected':'')+'>'+o[1]+'</option>';}).join('')+'</select></div></div>'
      +'<div class="tr-f"><label>Esperando a… (si depende de alguien o algo)</label><input type="text" id="tre-esp" value="'+esc(t.esperaDe||'')+'" placeholder="Ej: respuesta del cliente"></div>'
      +'<div class="tr-f"><label>Punto de continuación: dónde te quedaste y qué haces al volver</label><textarea id="tre-punto" rows="2">'+esc(t.punto||'')+'</textarea></div>'
      +'<div class="tr-f"><label>Criterio de finalización: ¿cómo sabes que terminó?</label><textarea id="tre-crit" rows="2" placeholder="Ej: Carrusel entregado al cliente y aprobado">'+esc(t.criterio||'')+'</textarea></div>'
      +'<div class="tr-f"><label>Pasos (si tiene pasos, es un proyecto)</label><div id="tre-pasos"></div><div class="tr-chips"><button type="button" class="tr-mini" id="tre-addpaso">+ Agregar paso</button><button type="button" class="tr-mini" id="tre-dividir">✂ Dividir en pasos</button></div></div>'
      +'<div class="tr-f"><label>Notas</label><textarea id="tre-notas" rows="2">'+esc(t.notas||'')+'</textarea></div>'
      +'<div class="tr-f"><label>Calendario</label><div id="tre-bloques"></div></div></details>'
      +'<div class="tr-acc"><button type="button" class="tr-del" id="tre-del">🗑 Eliminar</button><button type="button" class="tr-sec2" id="tre-cancel">Cancelar</button><button type="button" class="tr-pri" id="tre-save">Guardar</button></div></div>';
    document.body.appendChild(m);
    var pasos=(t.pasos||[]).map(function(p){return {t:p.t,d:!!p.d};});
    function pintarPasos(){
      var c=document.getElementById('tre-pasos');
      c.innerHTML=pasos.map(function(p,i){ return '<div class="tr-paso"><input type="checkbox" data-pd="'+i+'"'+(p.d?' checked':'')+'><input type="text" data-pt="'+i+'" value="'+esc(p.t)+'" placeholder="Paso"><button type="button" class="tr-link" data-px="'+i+'" aria-label="Quitar paso">✕</button></div>'; }).join('');
    }
    pintarPasos();
    function pintarBloques(){
      var c=document.getElementById('tre-bloques'); if(!c) return;
      var bl=bloquesDe(t.id), hay=(typeof agxAgendarBloque==='function');
      c.innerHTML=(bl.length?bl.map(function(e){ return '<div class="tr-paso"><span style="flex:1;font-size:.88rem">📌 '+esc(bloqueTxt(e))+'</span><button type="button" class="tr-mini" data-brep="'+esc(e.id)+'">Reprogramar</button><button type="button" class="tr-link" data-bdel="'+esc(e.id)+'" aria-label="Quitar bloque">✕</button></div>'; }).join(''):'<div style="font-size:.82rem;color:#8a7279;margin-bottom:6px">Sin bloque en el calendario.</div>')
        +(hay?'<button type="button" class="tr-mini" id="tre-agendar">📅 Agendar bloque de trabajo</button>':'');
      var ag=c.querySelector('#tre-agendar'); if(ag) ag.onclick=function(){ agxAgendarBloque(t.id, pintarBloques); };
      [].slice.call(c.querySelectorAll('[data-brep]')).forEach(function(b){ b.onclick=function(){ agxReprogramarBloque(b.getAttribute('data-brep'), pintarBloques); }; });
      [].slice.call(c.querySelectorAll('[data-bdel]')).forEach(function(b){ b.onclick=function(){ var id=b.getAttribute('data-bdel'); quitarBloques(evs().filter(function(e){return e.id===id;})); pintarBloques(); }; });
    }
    pintarBloques();
    m.querySelector('#tre-pasos').addEventListener('input',function(ev){ var i=ev.target.getAttribute('data-pt'); if(i!==null) pasos[+i].t=ev.target.value; });
    m.querySelector('#tre-pasos').addEventListener('change',function(ev){ var i=ev.target.getAttribute('data-pd'); if(i!==null) pasos[+i].d=ev.target.checked; });
    m.querySelector('#tre-pasos').addEventListener('click',function(ev){ var i=ev.target.getAttribute('data-px'); if(i!==null){ pasos.splice(+i,1); pintarPasos(); } });
    m.querySelector('#tre-addpaso').onclick=function(){ pasos.push({t:'',d:false}); pintarPasos(); var ins=m.querySelectorAll('#tre-pasos input[type=text]'); if(ins.length) ins[ins.length-1].focus(); };
    m.querySelector('#tre-dividir').onclick=function(){ pedirPasos(function(lines){ lines.forEach(function(x){ pasos.push({t:x,d:false}); }); pintarPasos(); }); };
    var rb=m.querySelector('#tre-reabrir'); if(rb) rb.onclick=function(){ t.hecha=false; delete t.hechaEn; t.estado='pendiente'; guardar(); cerrarModal(); pintar(); };
    [].slice.call(m.querySelectorAll('[data-q]')).forEach(function(b){ b.onclick=function(){
      var q=b.getAttribute('data-q'), f=document.getElementById('tre-fecha');
      f.value = q==='hoy'?hoy(): q==='manana'?sumarDias(hoy(),1): q==='sem'?sumarDias(hoy(),7):''; }; });
    m.querySelector('#tre-cancel').onclick=function(){ cerrarModal(); pintar(); };
    m.querySelector('#tre-save').onclick=function(){
      var tit=document.getElementById('tre-tit').value.replace(/\s+/g,' ').trim();
      if(!tit){ document.getElementById('tre-tit').focus(); return; }
      var rep=document.getElementById('tre-rep').value;
      var fecha=document.getElementById('tre-fecha').value;
      if(rep && !fecha){ fecha=hoy(); }
      t.titulo=tit; t.lista=document.getElementById('tre-lista').value; t.fecha=fecha; t.limite=document.getElementById('tre-lim').value||''; t.hora=document.getElementById('tre-hora').value||'';
      setPrioridad(t, document.getElementById('tre-prio').value); t.rep=rep; t.notas=document.getElementById('tre-notas').value.trim();
      t.siguiente=document.getElementById('tre-sig').value.replace(/\s+/g,' ').trim(); t.punto=document.getElementById('tre-punto').value.trim(); t.criterio=document.getElementById('tre-crit').value.trim();
      t.esperaDe=document.getElementById('tre-esp').value.trim(); t.minutos=parseInt(document.getElementById('tre-min').value,10)||0;
      var es=document.getElementById('tre-estado'); if(es && !t.hecha){ t.estado=es.value; if(t.estado!=='curso') t.enfoque=false; }
      t.pasos=pasos.filter(function(p){return String(p.t).trim();}).map(function(p){return {t:String(p.t).trim(),d:!!p.d};});
      var bls=bloquesDe(t.id); if(bls.length){ bls.forEach(function(e){ e.titulo=t.titulo; e.calendario=t.lista||e.calendario; }); if(typeof agGuardar==='function') agGuardar(); }
      guardar(); cerrarModal(); pintar();
    };
    m.querySelector('#tre-del').onclick=function(){
      var idx=T.indexOf(t); if(idx<0) return;
      var fut=bloquesFuturos(t.id); quitarBloques(fut);
      T.splice(idx,1); guardar(); cerrarModal(); pintar();
      snack('Tarea eliminada'+(fut.length?' (y su bloque del calendario)':''), function(){ T.push(t); devolverBloques(fut); guardar(); pintar(); }, 8000);
    };
  }

  // ---------- EMPEZAR TAREA: una sola acción en pantalla ----------
  var foco=null, focoTimer=null, notaTimer=null;
  function ahoraISO(){ return new Date().toISOString(); }
  function tareaActiva(){ return T.filter(function(t){ return t.enfoque && !t.hecha; })[0]; }
  function ultimaTxt(t){ if(!t.actualizada) return ''; var d=new Date(t.actualizada); if(isNaN(d)) return ''; return etiquetaDia(ymd(d))+' '+d.toLocaleTimeString('es-CO',{hour:'numeric',minute:'2-digit'}); }
  function fmtT(s){ s=Math.max(0,Math.round(s)); return p2(Math.floor(s/60))+':'+p2(s%60); }
  function beep(){
    try{ var C=window.AudioContext||window.webkitAudioContext; var c=new C(); [0,0.3].forEach(function(d){ var o=c.createOscillator(), g=c.createGain(); o.connect(g); g.connect(c.destination); o.frequency.value=520; g.gain.value=0.08; o.start(c.currentTime+d); o.stop(c.currentTime+d+0.2); }); }catch(e){}
    try{ if(navigator.vibrate) navigator.vibrate([150,80,150]); }catch(e){}
  }
  // Guarda lo escrito en "continúa aquí" (también al cerrar o cambiar de pestaña)
  function flushNota(){
    clearTimeout(notaTimer);
    var ta=document.getElementById('trf-nota'); if(!ta||!foco) return;
    var t=porId(foco.id); if(!t) return;
    var v=ta.value.trim(); if(v===(t.punto||'')) return;
    t.punto=v; t.actualizada=ahoraISO(); guardar();
    var u=document.getElementById('trf-ult'); if(u) u.textContent='Guardado · última actualización: '+ultimaTxt(t);
  }
  window.addEventListener('pagehide', function(){ flushNota(); try{ registrarFoco(); }catch(e){} });
  document.addEventListener('visibilitychange', function(){ if(document.hidden) flushNota(); });

  // Conserva el tiempo trabajado (aunque haya sido poco): solo suma, nunca penaliza
  function registrarFoco(){
    if(!foco) return 0;
    var t=porId(foco.id); var seg=(Date.now()-(foco.t0||Date.now()))/1000;
    foco.t0=Date.now();
    if(!t || seg<30) return 0;
    var m=Math.min(240, Math.max(1, Math.round(seg/60)));
    if(!Array.isArray(t.avance)) t.avance=[];
    var h=hoy(), e=t.avance.filter(function(x){return x.d===h;})[0];
    if(e) e.m+=m; else t.avance.push({d:h,m:m});
    if(t.avance.length>90) t.avance=t.avance.slice(-90);
    t.actualizada=ahoraISO(); guardar();
    return m;
  }
  function totalMin(t){ return (t.avance||[]).reduce(function(a,x){return a+(x.m||0);},0); }
  function minHoy(){ var h=hoy(); return T.reduce(function(a,t){ return a+(t.avance||[]).filter(function(x){return x.d===h;}).reduce(function(b,x){return b+(x.m||0);},0); },0); }

  function cerrarFoco(){
    flushNota(); try{ registrarFoco(); }catch(e){}
    var f=document.getElementById('tr-foco'); if(f) f.remove();
    clearInterval(focoTimer); focoTimer=null; foco=null; pintar();
  }
  // Guardar y pausar: conserva acción, nota, pasos y hora de la última actualización
  function pausarTarea(t, nota, mins){
    if(nota!==undefined) t.punto=nota;
    t.ultimaAccion=proximaAccion(t); t.estado='pausada'; t.enfoque=false; t.actualizada=ahoraISO(); guardar(); pintar();
    snack('Guardado ✓'+(mins?' · '+mins+' min de avance conservados':'')+'. Cuando regreses, sigues desde aquí.',null,4500);
  }
  function pausarFoco(){
    flushNota(); var t=porId(foco.id); if(!t) return;
    var ta=document.getElementById('trf-nota'), mins=registrarFoco();
    pausarTarea(t, ta?ta.value.trim():undefined, mins);
    var f=document.getElementById('tr-foco'); if(f) f.remove(); clearInterval(focoTimer); focoTimer=null; foco=null; pintar();
  }
  function abrirFoco(){          // botón de arriba: la tarea que recomienda «Mi día»
    var act=tareaActiva(); if(act){ empezarTarea(act.id); return; }
    var r=recomendar();
    if(!r.t){ snack('No hay tareas por empezar. Crea una con ＋ Nueva tarea.',null,3500); return; }
    empezarTarea(r.t.id);
  }
  function empezarTarea(id){
    var t=porId(id); if(!t||t.hecha) return;
    var act=tareaActiva();
    if(act && act.id!==t.id){
      var m=sheet('<h3 style="margin:0 0 10px;font-family:\'Playfair Display\',serif;color:#7a3c4b">Ya tienes una tarea en foco</h3>'
        +'<div class="tr-panel">«'+esc(act.titulo)+'»</div>'
        +'<div style="font-size:.9rem;margin-bottom:6px">¿Quieres guardarla y pausarla antes de abrir «'+esc(t.titulo)+'»? No pierdes nada: queda justo donde la dejaste.</div>'
        +'<div class="tr-acc" style="flex-wrap:wrap"><button type="button" class="tr-sec2" id="trw-no">Seguir con la actual</button><button type="button" class="tr-pri" id="trw-si">Guardar y pausar, abrir la otra</button></div>');
      m.querySelector('#trw-no').onclick=function(){ cerrarSheet(); empezarTarea(act.id); };
      m.querySelector('#trw-si').onclick=function(){ cerrarSheet(); var ta=document.getElementById('trf-nota'); if(foco) cerrarFoco(); pausarTarea(act); abrirPantalla(t); };
      return;
    }
    abrirPantalla(t);
  }
  function abrirPantalla(t){
    if(foco) cerrarFoco();
    t.estado='curso'; t.enfoque=true; t.actualizada=ahoraISO(); guardar();
    foco={id:t.id, dur:0, fin:0, restante:0, corriendo:false, t0:Date.now()};
    pintarFoco(); pintar();
  }
  function pintarFoco(){
    var t=porId(foco&&foco.id); if(!t){ cerrarFoco(); return; }
    flushNota();
    var f=document.getElementById('tr-foco'); if(!f){ f=document.createElement('div'); f.id='tr-foco'; f.className='tr-foco'; document.body.appendChild(f); }
    var l=lista(t.lista||'consultorio'), accion=proximaAccion(t), pasos=t.pasos||[];
    var sigs=pasos.filter(function(p){return !p.d;}); if(!t.siguiente && sigs.length) sigs=sigs.slice(1);
    var hechos=pasos.filter(function(p){return p.d;});
    var orient=foco.dur?Math.round(foco.dur/60):t.minutos;
    var crono;
    if(foco.dur){
      crono='<div class="tr-time" id="trf-time" style="font-size:2.6rem;margin:10px 0 4px">'+fmtT(foco.corriendo?(foco.fin-Date.now())/1000:foco.restante)+'</div>'
        +'<div class="tr-foco-b chico"><button id="trf-play">'+(foco.corriendo?'⏸ Pausar cronómetro':'▶ '+(foco.restante<foco.dur?'Reanudar':'Iniciar')+' cronómetro')+'</button><button id="trf-nocrono">Quitar cronómetro</button></div>';
    } else {
      crono='<div class="tr-foco-lbl" style="margin-top:14px">Cronómetro (opcional)</div><div class="tr-foco-b chico"><button data-m="5">5 min</button><button data-m="15">15 min</button><button data-m="25">25 min</button><button data-m="otro">Otro…</button></div>';
    }
    f.innerHTML='<div class="tr-foco-in">'
      +'<div class="tr-foco-top"><span class="tr-foco-badge">● En curso</span>'+(orient?'<span class="tr-foco-badge soft">'+orient+' minutos orientativos</span>':'')+'</div>'
      +'<div class="tr-foco-tit">'+esc(t.titulo)+'</div>'
      +'<div class="tr-foco-area"><span class="tr-dot" style="background:'+esc(l.color)+'"></span>'+esc(l.nombre)+'</div>'
      +'<div class="tr-foco-lbl">Tu siguiente acción</div>'
      +'<div class="tr-foco-accion">'+(accion?esc(accion):'<span style="opacity:.6;font-weight:400;font-size:1.05rem">Aún no hay siguiente acción. Escríbela con «Ajustar».</span>')+'</div>'
      +'<button class="tr-foco-aj" id="trf-aj">✎ Ajustar siguiente paso</button>'
      +'<div class="tr-foco-lbl" style="margin-top:14px">Cuando regreses, continúa aquí</div>'
      +'<textarea id="trf-nota" rows="3" placeholder="Dónde te quedaste y qué harás al volver…">'+esc(t.punto||'')+'</textarea>'
      +'<div class="tr-foco-ult" id="trf-ult">'+(t.actualizada?'Se guarda solo · última actualización: '+esc(ultimaTxt(t)):'Se guarda solo mientras escribes')+'</div>'
      +crono
      +'<div class="tr-foco-b"><button class="main" id="trf-pausa">Guardar y pausar</button><button class="ok" id="trf-paso">Completar paso</button></div>'
      +((sigs.length||hechos.length)?'<details class="tr-foco-mut"><summary>Pasos del proyecto ('+hechos.length+' de '+pasos.length+' hechos)</summary>'+hechos.map(function(p){return '<div style="text-decoration:line-through">✓ '+esc(p.t)+'</div>';}).join('')+sigs.map(function(p){return '<div>○ '+esc(p.t)+'</div>';}).join('')+'</details>':'')
      +'<div class="tr-foco-sec"><button id="trf-idea">💡 Guardar otra idea</button><button id="trf-cambiar">Cambiar de tarea</button><button id="trf-note">No terminé</button><button id="trf-fin">Terminé toda la tarea</button><button id="trf-cerrar">Cerrar (sigue en curso)</button></div>'
      +'</div>';
    var ta=f.querySelector('#trf-nota'); ta.addEventListener('input',function(){ clearTimeout(notaTimer); notaTimer=setTimeout(flushNota,800); }); ta.addEventListener('blur',flushNota);
    [].slice.call(f.querySelectorAll('[data-m]')).forEach(function(b){ b.onclick=function(){
      var v=b.getAttribute('data-m');
      if(v==='otro') preguntar('⏱ Otro tiempo','¿Cuántos minutos? (1 a 240)','',false,function(x){ var n=parseInt(x,10); if(n>=1&&n<=240) iniciarCrono(n); });
      else iniciarCrono(+v);
    }; });
    var pl=f.querySelector('#trf-play'); if(pl) pl.onclick=function(){
      if(foco.corriendo){ foco.restante=Math.max(0,(foco.fin-Date.now())/1000); foco.corriendo=false; clearInterval(focoTimer); focoTimer=null; }
      else { foco.fin=Date.now()+foco.restante*1000; foco.corriendo=true; clearInterval(focoTimer); focoTimer=setInterval(tick,500); }
      pintarFoco();
    };
    var nc=f.querySelector('#trf-nocrono'); if(nc) nc.onclick=function(){ foco.dur=0; foco.corriendo=false; clearInterval(focoTimer); focoTimer=null; pintarFoco(); };
    f.querySelector('#trf-pausa').onclick=pausarFoco;
    f.querySelector('#trf-paso').onclick=completarPaso;
    f.querySelector('#trf-aj').onclick=ajustarSiguiente;
    f.querySelector('#trf-idea').onclick=guardarIdea;
    f.querySelector('#trf-cambiar').onclick=cambiarTarea;
    f.querySelector('#trf-note').onclick=function(){ var mm=registrarFoco(); opcionesSinTerminar('Está bien no haber terminado', 'Tu avance está guardado'+(mm?' ('+mm+' min más sumados)':'')+'. Elige cómo seguir.', false); };
    f.querySelector('#trf-fin').onclick=function(){ flushNota(); registrarFoco(); intentarCompletar(t.id,false,function(){ var o=document.getElementById('tr-foco'); if(o) o.remove(); clearInterval(focoTimer); focoTimer=null; foco=null; pintar(); }); };
    f.querySelector('#trf-cerrar').onclick=cerrarFoco;
    if(foco.corriendo && !focoTimer) focoTimer=setInterval(tick,500);
  }
  function iniciarCrono(min){ foco.dur=min*60; foco.restante=foco.dur; foco.fin=Date.now()+foco.restante*1000; foco.corriendo=true; clearInterval(focoTimer); focoTimer=setInterval(tick,500); pintarFoco(); }
  function tick(){
    if(!foco||!foco.corriendo) return;
    var r=(foco.fin-Date.now())/1000, el=document.getElementById('trf-time');
    if(r<=0){ foco.corriendo=false; foco.dur=0; clearInterval(focoTimer); focoTimer=null; beep(); flushNota(); registrarFoco(); pintarFoco(); opcionesSinTerminar('Se acabó el tiempo orientativo','Sin presión. ¿Cómo quieres seguir?', true); return; }
    if(el) el.textContent=fmtT(r);
  }
  // Tres salidas, sin mensajes de fracaso: continuar, guardar y pausar, o ajustar el siguiente paso
  function opcionesSinTerminar(titulo, sub, deCrono){
    var m=sheet('<h3 style="margin:0 0 6px;font-family:\'Playfair Display\',serif;color:#7a3c4b">'+esc(titulo)+'</h3><div style="font-size:.88rem;color:#6b5459;margin-bottom:12px">'+esc(sub)+'</div>'
      +'<button type="button" class="tr-estopt" id="trn1">▶ '+(deCrono?'Continuar 5 minutos más':'Continuar')+'</button>'
      +'<button type="button" class="tr-estopt" id="trn2">⏸ Guardar y pausar</button>'
      +'<button type="button" class="tr-estopt" id="trn3">✎ Ajustar el siguiente paso</button>');
    m.querySelector('#trn1').onclick=function(){ cerrarSheet(); if(deCrono) iniciarCrono(5); };
    m.querySelector('#trn2').onclick=function(){ cerrarSheet(); pausarFoco(); };
    m.querySelector('#trn3').onclick=function(){ cerrarSheet(); ajustarSiguiente(); };
  }
  function ajustarSiguiente(){
    flushNota(); var t=porId(foco.id); if(!t) return;
    var pend=(t.pasos||[]).filter(function(p){return !p.d;})[0], viaPaso=!t.siguiente && pend;
    preguntar('✎ Ajustar el siguiente paso','Siguiente acción (con un verbo concreto)',proximaAccion(t),false,function(v){
      if(!v) return;
      if(viaPaso) pend.t=v; else t.siguiente=v;
      t.actualizada=ahoraISO(); guardar(); if(foco) pintarFoco();
    });
  }
  function completarPaso(){
    flushNota(); var t=porId(foco.id); if(!t) return;
    var pend=(t.pasos||[]).filter(function(p){return !p.d;});
    if(t.siguiente) t.siguiente='';
    else if(pend.length) pend[0].d=true;
    t.actualizada=ahoraISO(); guardar();
    var next=proximaAccion(t);
    if(next){ pintarFoco(); snack('Paso completado ✓',null,2500); return; }
    var m=sheet('<h3 style="margin:0 0 6px;font-family:\'Playfair Display\',serif;color:#7a3c4b">Paso completado ✓</h3><div style="font-size:.88rem;color:#6b5459;margin-bottom:10px">¿Qué sigue?</div>'
      +'<div class="tr-f"><label>Siguiente acción</label><input id="trs-sig" type="text" placeholder="Empieza con un verbo: Revisar, Enviar…"></div>'
      +'<div class="tr-acc" style="flex-wrap:wrap"><button type="button" class="tr-sec2" id="trs-pausa">Guardar y pausar</button><button type="button" class="tr-sec2" id="trs-fin">Ya terminé la tarea</button><button type="button" class="tr-pri" id="trs-ok">Guardar siguiente acción</button></div>');
    m.querySelector('#trs-ok').onclick=function(){ var v=m.querySelector('#trs-sig').value.replace(/\s+/g,' ').trim(); if(!v){ m.querySelector('#trs-sig').focus(); return; } t.siguiente=v; t.actualizada=ahoraISO(); guardar(); cerrarSheet(); pintarFoco(); };
    m.querySelector('#trs-sig').addEventListener('keydown',function(e){ if(e.key==='Enter'){ e.preventDefault(); m.querySelector('#trs-ok').click(); } });
    m.querySelector('#trs-pausa').onclick=function(){ cerrarSheet(); pausarFoco(); };
    m.querySelector('#trs-fin').onclick=function(){ cerrarSheet(); registrarFoco(); intentarCompletar(t.id,false,function(){ var o=document.getElementById('tr-foco'); if(o) o.remove(); clearInterval(focoTimer); focoTimer=null; foco=null; pintar(); }); };
    setTimeout(function(){ var i=m.querySelector('#trs-sig'); if(i) i.focus(); },50);
  }
  // Otra idea → Bandeja, sin tocar la tarea activa
  function guardarIdea(){
    var t=porId(foco.id); if(!t) return;
    preguntar('💡 Guardar otra idea','Anótala y sigue con lo tuyo: va a tu Bandeja.','',false,function(v){
      v=v.replace(/\s+/g,' ').trim(); if(!v) return;
      B.push({id:'i'+Date.now().toString(36)+Math.random().toString(36).slice(2,5), texto:v, creada:ahoraISO(), archivada:false}); guardarB();
      guardar(); snack('Idea guardada en la Bandeja ✓',null,2500);
    });
  }
  // Cambiar de tarea: primero se guarda y se pausa la actual
  function cambiarTarea(){
    flushNota(); var t=porId(foco.id); if(!t) return;
    var m=sheet('<h3 style="margin:0 0 8px;font-family:\'Playfair Display\',serif;color:#7a3c4b">Cambiar de tarea</h3><div style="font-size:.9rem;margin-bottom:10px">¿Guardar y pausar «'+esc(t.titulo)+'» antes de abrir otra? No se borra nada de tu avance.</div>'
      +'<div class="tr-acc" style="flex-wrap:wrap"><button type="button" class="tr-sec2" id="trx-no">Seguir con esta</button><button type="button" class="tr-pri" id="trx-si">Guardar y pausar</button></div>');
    m.querySelector('#trx-no').onclick=cerrarSheet;
    m.querySelector('#trx-si').onclick=function(){
      cerrarSheet(); var id0=t.id; pausarFoco();
      var h=hoy(), c=pendientes().filter(function(x){ return x.id!==id0 && x.estado!=='espera'; });
      var hoyC=c.filter(function(x){ var f=fechaEf(x); return f && f<=h; }).sort(ordenar), otras=c.filter(function(x){ return hoyC.indexOf(x)<0; }).sort(ordenTareas);
      var lst=hoyC.concat(otras).slice(0,6);
      if(!lst.length) return;
      var m2=sheet('<h3 style="margin:0 0 10px;font-family:\'Playfair Display\',serif;color:#7a3c4b">¿Con cuál sigues?</h3>'
        +lst.map(function(x){ return '<button type="button" class="tr-estopt" data-id="'+esc(x.id)+'">'+esc(x.titulo)+'<br><span style="font-size:.78rem;color:#8a7279">'+esc(lista(x.lista||'consultorio').nombre)+(proximaAccion(x)?' · → '+esc(proximaAccion(x)):'')+'</span></button>'; }).join('')
        +'<div class="tr-acc"><button type="button" class="tr-sec2" id="trx-cerrar">Ahora no</button></div>');
      m2.querySelector('#trx-cerrar').onclick=cerrarSheet;
      [].slice.call(m2.querySelectorAll('[data-id]')).forEach(function(b){ b.onclick=function(){ cerrarSheet(); empezarTarea(b.getAttribute('data-id')); }; });
    };
  }

  // ---------- sincronización entre dispositivos ----------
  function refrescar(){
    var page=document.getElementById('page-tareas');
    if(!page || !page.classList.contains('active')) return;
    if(document.getElementById('tr-modal') || document.getElementById('tr-foco')) return;   // no interrumpir
    if(document.getElementById('tr-sheet')) return;
    var ae=document.activeElement; if(ae && (ae.id==='tr-nuevo'||ae.id==='tr-idea') && ae.value) return;
    if(typeof DB==='undefined' || !DB.loadAll) return;
    DB.loadAll().then(function(ok){ if(ok){ cargar(); try{ if(typeof window.agxMigrarAreas==='function') window.agxMigrarAreas(); }catch(e){} pintar(); } }).catch(function(){});
  }
  function iniciarSync(){
    if(st.sync) return;
    st.sync=setInterval(refrescar, 120000);
    document.addEventListener('visibilitychange', function(){ if(!document.hidden) refrescar(); });
  }

  // ---------- Tareas dentro de la Agenda (pestañas del calendario) ----------
  var TABS_AG = [['t-hoy','hoy','☀️ Mi día'],['t-tareas','tareas','✅ Tareas'],['t-areas','areas','🗂 Áreas']];
  function enAgenda(){ var r=document.getElementById('tareas-root'); return !!(r && r.parentNode && r.parentNode.id==='ag-panel-tareas'); }
  function volverRoot(){ var r=document.getElementById('tareas-root'), pg=document.getElementById('page-tareas'); if(r && pg && r.parentNode!==pg) pg.appendChild(r); var p=document.getElementById('ag-panel-tareas'); if(p) p.style.display='none'; }
  function marcarTabAgenda(){
    if(!enAgenda()) return;
    var m = st.vista==='hoy' ? 't-hoy' : st.vista==='areas' ? 't-areas' : 't-tareas';
    [].forEach.call(document.querySelectorAll('.ag-tab-nav .ag-tab'), function(b){ b.classList.toggle('active', b.getAttribute('data-tab')===m); });
  }
  function irCalendario(){
    if(enAgenda()){ var tb=document.querySelector('.ag-tab[data-tab="horario"]'); if(tb && typeof agSwitchTab==='function'){ agSwitchTab('horario', tb); return; } }
    goPage('agenda');
  }
  window.agxTabTareas = function(vista, el){
    var panel=document.getElementById('ag-panel-tareas'), root=document.getElementById('tareas-root'); if(!panel || !root) return;
    try { window.agTabActual='horario'; } catch(e){}
    [].forEach.call(document.querySelectorAll('.ag-tab-nav .ag-tab'), function(b){ b.classList.remove('active'); });
    if(el) el.classList.add('active');
    ['ag-nav-card','ag-container','ag-form-card','ag-panel-cumple'].forEach(function(id){ var e=document.getElementById(id); if(e) e.style.display='none'; });
    panel.style.display=''; if(root.parentNode!==panel) panel.appendChild(root);
    if(vista!=='areas' || !st.area) {} 
    window.tareasIr(vista); abrir(); marcarTabAgenda();
  };
  function montarTabsAgenda(){
    var n=document.querySelector('.ag-tab-nav'); if(!n || n.querySelector('[data-tab="t-hoy"]')) return;
    var cumple=document.getElementById('ag-tab-cumple'), cp=document.getElementById('ag-panel-cumple'); if(!cp) return;
    TABS_AG.forEach(function(v){ var b=document.createElement('button'); b.className='ag-tab'; b.setAttribute('data-tab',v[0]); b.textContent=v[2]; b.onclick=function(){ window.agxTabTareas(v[1], b); }; n.insertBefore(b, cumple||null); });
    var panel=document.createElement('div'); panel.id='ag-panel-tareas'; panel.style.display='none'; cp.parentNode.insertBefore(panel, cp);
    // «Semana» pasa a ser el calendario tipo Google (rejilla por horas); Hoy y Mes siguen como estaban
    var oSw=window.agSwitchTab;
    if(typeof oSw==='function') window.agSwitchTab=function(tab, el){
      volverRoot();
      if(tab==='semana'){
        var h=document.querySelector('.ag-tab[data-tab="horario"]');
        oSw.call(this,'horario',h||el);
        try { window.agGView='semana'; window.agGFecha=new Date(); window.agGFecha.setHours(0,0,0,0); } catch(e){}
        [].forEach.call(document.querySelectorAll('.ag-tab-nav .ag-tab'), function(b){ b.classList.toggle('active', b===el); });
        if(typeof renderAgenda==='function') renderAgenda();
        return;
      }
      return oSw.apply(this, arguments);
    };
  }
  montarTabsAgenda();
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', montarTabsAgenda);

  // ---------- integración con la navegación de la app ----------
  window.tareasAbrir = abrir;
  window.tareasIr = function(v){ if(['hoy','bandeja','tareas','proximas','areas'].indexOf(v)<0) return; st.vista=v; st.addFecha=null; ls('tr_vista',v); if(document.getElementById('tr-contenido')) pintar(); };
  window.tareasDeHoyConteo = function(){ var h=hoy(); return T.filter(function(t){ return !t.hecha && fechaEf(t) && fechaEf(t)<=h; }).length; };
  var gpOriginal = window.goPage;
  if(typeof gpOriginal==='function'){
    window.goPage = function(name){
      var r = gpOriginal.apply(this, arguments);
      if(name==='tareas'){ var p=document.getElementById('page-tareas'); if(p && p.classList.contains('active')){ volverRoot(); abrir(); } }
      return r;
    };
  }
})();
