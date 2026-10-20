/* ===========================================================================
   Módulo TAREAS — pensado para TDAH: pocas cosas a la vista, captura rápida,
   "lo más importante de hoy" (máx. 3), modo foco con temporizador y deshacer.
   Datos: DB 'tareas' (Firestore suitedata/tareas). No toca nada del resto de la app.
   =========================================================================== */
(function(){
  if(window.__tareasInit) return; window.__tareasInit = true;

  var KEY = 'tareas';
  var T = [];                                   // todas las tareas
  var st = { fPrio:'todas', fFecha:'todas', verFiltros:false, verTodas:false, abiertas:{}, estadoV:'curso', estadoElegido:false, vista:'hoy', filtro:'todas', verAtrasadas:false, verMasHoy:false, addFecha:null, addLista:'', foco:null, sync:null };
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
  }
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
'.tr-foco-next{font-size:1.05rem;color:#7a3c4b;max-width:520px;margin:2px auto 8px;font-weight:700}'
    ].join('\n');
    document.head.appendChild(s);
  }

  // ---------- estructura ----------
  function abrir(){
    estilo(); cargar();
    var root = document.getElementById('tareas-root'); if(!root) return;
    if(!document.getElementById('tr-head')){
      var d = new Date();
      root.innerHTML =
        '<div class="tr-wrap">'
        + '<div class="tr-top"><div><h1 class="tr-h1">✅ Tareas</h1><div class="tr-fecha" id="tr-fecha"></div></div><button class="tr-foco-btn" data-act="foco">🎯 Modo foco</button></div>'
        + '<div id="tr-head"></div>'
        + '<div class="tr-add"><div class="tr-add-row"><input type="text" id="tr-nuevo" placeholder="Escribe una tarea y Enter…" autocomplete="off" enterkeyhint="done"><button class="tr-add-btn" data-act="add" aria-label="Agregar tarea">+</button></div>'
        + '<div class="tr-chips" id="tr-addchips"></div></div>'
        + '<div class="tr-tabs" id="tr-tabs"></div>'
        + '<div class="tr-filtros" id="tr-filtros"></div>'
        + '<div id="tr-contenido"></div></div>';
      var inp = document.getElementById('tr-nuevo');
      inp.addEventListener('keydown', function(e){ if(e.key==='Enter'){ e.preventDefault(); agregarDesdeInput(); } });
      root.addEventListener('click', clickRoot);
      root.addEventListener('change', changeRoot);
    }
    var fh=new Date().toLocaleDateString('es-CO',{weekday:'long',day:'numeric',month:'long'}); document.getElementById('tr-fecha').textContent = fh.charAt(0).toUpperCase()+fh.slice(1);
    pintar();
    iniciarSync();
  }

  function fechaPorDefecto(){
    if(st.addFecha) return st.addFecha;
    return (st.vista==='bandeja'||st.vista==='tareas') ? 'sin' : st.vista==='proximas' ? 'manana' : 'hoy';
  }
  function resolverFecha(clave){
    var h=hoy();
    if(clave==='hoy') return h; if(clave==='manana') return sumarDias(h,1); if(clave==='sin') return '';
    return /^\d{4}-\d{2}-\d{2}$/.test(clave) ? clave : '';
  }

  function pintar(){
    pintarHead(); pintarAddChips(); pintarTabs(); pintarFiltros(); pintarContenido();
  }

  function pintarHead(){
    var el=document.getElementById('tr-head'); if(!el) return;
    if(st.vista==='tareas'){ el.innerHTML=''; return; }
    var h=hoy();
    var hechasHoy = T.filter(function(t){ return t.hecha && t.hechaEn && t.hechaEn.slice(0,10)===h; }).length;
    var pend = pendientes().filter(function(t){ var f=fechaEf(t); return f && f<=h; }).length;
    var total = hechasHoy+pend;
    var pct = total ? Math.round(hechasHoy*100/total) : 0;
    var msg = !total ? 'Día libre de tareas. Respira. 🌿' : pend===0 ? '¡Todo hecho por hoy! 🎉' : hechasHoy===0 ? 'Elige solo UNA para empezar.' : 'Vas bien: '+hechasHoy+' hecha'+(hechasHoy>1?'s':'')+'. Sigue con la siguiente.';
    el.innerHTML = '<div class="tr-prog"><div class="tr-prog-t"><span>'+esc(msg)+'</span><span>'+hechasHoy+' / '+total+'</span></div><div class="tr-bar"><i style="width:'+pct+'%"></i></div></div>';
  }

  function pintarAddChips(){
    var el=document.getElementById('tr-addchips'); if(!el) return;
    var f=fechaPorDefecto(), h=hoy();
    var esOtra = f!=='hoy' && f!=='manana' && f!=='sin';
    var ls_ = listas();
    var actual = st.addLista && ls_.some(function(l){return l.id===st.addLista;}) ? st.addLista : (st.filtro!=='todas' ? st.filtro : ls_[0].id);
    el.innerHTML =
      '<button class="tr-chip'+(f==='hoy'?' on':'')+'" data-act="afecha" data-v="hoy">Hoy</button>'
      +'<button class="tr-chip'+(f==='manana'?' on':'')+'" data-act="afecha" data-v="manana">Mañana</button>'
      +'<button class="tr-chip'+(f==='sin'?' on':'')+'" data-act="afecha" data-v="sin">Sin fecha</button>'
      +'<label class="tr-chip'+(esOtra?' on':'')+'">📅 <input type="date" id="tr-add-fecha" min="'+h+'" value="'+(esOtra?esc(f):'')+'" data-act="afechad"></label>'
      +'<select class="tr-sel" id="tr-add-lista" data-act="alista">'+ls_.map(function(l){ return '<option value="'+esc(l.id)+'"'+(l.id===actual?' selected':'')+'>'+esc(l.nombre)+'</option>'; }).join('')+'</select>';
  }

  function pintarTabs(){
    var el=document.getElementById('tr-tabs'); if(!el) return;
    var h=hoy(), pen=T.filter(function(t){return !t.hecha;});
    var nBand = pen.filter(function(t){return !fechaEf(t);}).length;
    var nHoy = pen.filter(function(t){var f=fechaEf(t); return f && f<=h;}).length;
    function tab(id,txt){ return '<button class="tr-tab'+(st.vista===id?' on':'')+'" data-act="vista" data-v="'+id+'">'+txt+'</button>'; }
    var nAct = T.filter(function(t){return !t.hecha;}).length;
    el.innerHTML = tab('hoy','☀️ Mi día'+(nHoy?' ('+nHoy+')':''))+tab('bandeja','📥 Bandeja'+(nBand?' ('+nBand+')':''))+tab('tareas','✅ Tareas'+(nAct?' ('+nAct+')':''))+tab('proximas','📅 Próximas');
  }

  function pintarFiltros(){
    var el=document.getElementById('tr-filtros'); if(!el) return;
    var ls_=listas();
    if(ls_.length<2){ el.innerHTML=''; return; }
    el.innerHTML = '<button class="tr-chip'+(st.filtro==='todas'?' on':'')+'" data-act="filtro" data-v="todas">Todas</button>'
      + ls_.map(function(l){ return '<button class="tr-chip'+(st.filtro===l.id?' on':'')+'" data-act="filtro" data-v="'+esc(l.id)+'"><span class="tr-dot" style="background:'+esc(l.color)+'"></span>'+esc(l.nombre)+'</button>'; }).join('');
  }

  function fila(t, opts){
    opts = opts || {};
    var l = lista(t.lista||'consultorio'), h=hoy(), full=!!opts.full, ide=esc(t.id);
    var meta = '<span><span class="tr-dot" style="background:'+esc(l.color)+'"></span>'+esc(l.nombre)+'</span>';
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
    if(t.estado==='pausada' && t.punto) extra += '<div class="tr-next tr-punto">⏸ Al volver: '+esc(t.punto)+'</div>';
    if(t.estado==='espera' && t.esperaDe) extra += '<div class="tr-next tr-punto">⏳ Esperando: '+esc(t.esperaDe)+'</div>';
    if(np && nd===np) extra += '<div class="tr-next" style="color:#2d6a3e">✅ Pasos listos: revisa si se cumple el criterio y complétala.</div>';
    if(!na && !np) accs += '<button type="button" class="tr-mini" data-act="dividir" data-id="'+ide+'">✂ Dividir en pasos</button>';
    if(t.estado==='pendiente' && full) accs += '<button type="button" class="tr-mini" data-act="setest" data-v="curso" data-id="'+ide+'">▶ Empezar</button>';
    if(t.estado==='pausada') accs += '<button type="button" class="tr-mini" data-act="setest" data-v="curso" data-id="'+ide+'">▶ Retomar</button>';
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
      var atr = pen.filter(function(t){ var f=fechaEf(t); return f && f<h; }).sort(function(a,b){ return fechaEf(a)<fechaEf(b)?-1:fechaEf(a)>fechaEf(b)?1:ordenar(a,b); });
      var hoyT = pen.filter(function(t){ return fechaEf(t)===h; });
      var hoyOrd = hoyT.concat(atr).sort(ordenar);
      var imp = hoyOrd.filter(function(t){return t.prio;}).slice(0,3);
      var resto = hoyT.filter(function(t){ return imp.indexOf(t)<0; }).sort(ordenar);
      if(atr.length){
        html += '<div class="tr-atr">⏰ <b>'+atr.length+' atrasada'+(atr.length>1?'s':'')+'.</b> Sin culpa: decide qué hacer con ellas.'
          + '<div class="tr-atr-b"><button class="tr-mini" data-act="atr-hoy">Pasarlas a hoy</button><button class="tr-mini" data-act="atr-ver">'+(st.verAtrasadas?'Ocultar':'Verlas')+'</button></div></div>';
        if(st.verAtrasadas) html += atr.map(function(t){ return fila(t,{mover:true}); }).join('');
      }
      if(imp.length){
        html += '<div class="tr-sec"><span>⭐ Lo más importante hoy</span></div>' + imp.map(function(t){ return fila(t,{big:true}); }).join('');
      }
      if(resto.length){
        var vis = st.verMasHoy ? resto : resto.slice(0,MAX_HOY);
        html += '<div class="tr-sec"><span>Para hoy</span></div>' + vis.map(function(t){ return fila(t); }).join('');
        if(resto.length>MAX_HOY) html += '<div style="text-align:center"><button class="tr-link" data-act="vermas">'+(st.verMasHoy?'Ver menos':'Ver '+(resto.length-MAX_HOY)+' más')+'</button></div>';
      }
      if(!imp.length && !resto.length && !atr.length){
        html += '<div class="tr-vacio"><b>Nada pendiente para hoy 🎉</b>Escribe arriba lo que tengas en mente, o revisa tu Bandeja.</div>';
      } else if(!imp.length){
        html += '<div class="tr-vacio" style="padding:10px">Toca ☆ en hasta 3 tareas para fijarlas como lo más importante.</div>';
      }
    } else if(st.vista==='bandeja'){
      var b = pen.filter(function(t){return !fechaEf(t);}).sort(ordenar);
      html += '<div class="tr-sec"><span>📥 Ideas y pendientes sin fecha</span></div>';
      html += b.length ? b.map(function(t){ return fila(t,{mover:true}); }).join('') : '<div class="tr-vacio"><b>Bandeja vacía ✨</b>Aquí caen las cosas que anotas sin fecha. Luego eliges cuándo.</div>';
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
  function snack(texto, undo, ms){
    var s=document.getElementById('tr-snack'); if(s) s.remove();
    s=document.createElement('div'); s.id='tr-snack'; s.className='tr-snack';
    var sp=document.createElement('span'); sp.textContent=texto; s.appendChild(sp);
    if(undo){ var b=document.createElement('button'); b.type='button'; b.textContent='Deshacer'; b.onclick=function(){ undo(); s.remove(); }; s.appendChild(b); }
    document.body.appendChild(s);
    setTimeout(function(){ if(s.parentNode) s.remove(); }, ms||6000);
  }

  function agregarDesdeInput(){
    var inp=document.getElementById('tr-nuevo'); if(!inp) return;
    var txt=inp.value.replace(/\s+/g,' ').trim(); if(!txt) return;
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
      t.hecha=true; t.estado='completada'; t.hechaEn=new Date().toISOString();
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

  // ---------- estados ----------
  function instantanea(t){ return {estado:t.estado,punto:t.punto,esperaDe:t.esperaDe}; }
  function cambiarEstado(t, nuevo, datos){
    var prev=instantanea(t); t.estado=nuevo; if(datos) Object.keys(datos).forEach(function(k){ t[k]=datos[k]; });
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
    var area=(st.addLista && ls_.some(function(l){return l.id===st.addLista;})) ? st.addLista : (st.filtro!=='todas' ? st.filtro : ls_[0].id);
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
      var es=document.getElementById('tre-estado'); if(es && !t.hecha) t.estado=es.value;
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

  // ---------- modo foco ----------
  var foco=null, focoTimer=null;
  function cerrarFoco(){ var f=document.getElementById('tr-foco'); if(f) f.remove(); clearInterval(focoTimer); focoTimer=null; foco=null; pintar(); }
  function abrirFoco(){
    var h=hoy(), pen=pendientes().filter(function(t){ var f=fechaEf(t); return f && f<=h; }).sort(ordenar);
    var imp=pen.filter(function(t){return t.prio;});
    var cola=imp.concat(pen.filter(function(t){return !t.prio;}));
    if(!cola.length){ snack('No hay tareas para hoy. Agrega una o mira tu Bandeja.',null,3500); return; }
    foco={cola:cola.map(function(t){return t.id;}), i:0, dur:25*60, restante:25*60, fin:0, corriendo:false};
    pintarFoco();
  }
  function beep(){
    try{ var C=window.AudioContext||window.webkitAudioContext; var c=new C(); [0,0.25,0.5].forEach(function(d){ var o=c.createOscillator(), g=c.createGain(); o.connect(g); g.connect(c.destination); o.frequency.value=660; g.gain.value=0.15; o.start(c.currentTime+d); o.stop(c.currentTime+d+0.18); }); }catch(e){}
    try{ if(navigator.vibrate) navigator.vibrate([200,100,200]); }catch(e){}
  }
  function fmtT(s){ s=Math.max(0,Math.round(s)); return p2(Math.floor(s/60))+':'+p2(s%60); }
  function pintarFoco(){
    var f=document.getElementById('tr-foco'); if(!f){ f=document.createElement('div'); f.id='tr-foco'; f.className='tr-foco'; document.body.appendChild(f); }
    var t=porId(foco.cola[foco.i]);
    if(!t || t.hecha){ // la siguiente que siga pendiente
      while(foco.i<foco.cola.length && (!porId(foco.cola[foco.i]) || porId(foco.cola[foco.i]).hecha)) foco.i++;
      t=porId(foco.cola[foco.i]);
    }
    if(!t){ f.innerHTML='<div class="tr-foco-tit">¡Terminaste todo! 🎉</div><div class="tr-foco-lbl">Descansa un momento</div><div class="tr-foco-b"><button class="main" id="trf-salir">Cerrar</button></div>'; f.querySelector('#trf-salir').onclick=cerrarFoco; clearInterval(focoTimer); return; }
    var restantes=foco.cola.length-foco.i;
    f.innerHTML = '<div class="tr-foco-lbl">Ahora solo esto · '+restantes+' en la cola</div>'
      +'<div class="tr-foco-tit">'+esc(t.titulo)+'</div>'
      +(proximaAccion(t)?'<div class="tr-foco-next">→ '+esc(proximaAccion(t))+'</div>':'')
      +(t.punto?'<div style="max-width:520px;color:#7a5a00;background:#fff8e6;border-radius:10px;padding:6px 10px;font-size:.88rem;margin-bottom:6px">Al volver: '+esc(t.punto)+'</div>':'')
      +(t.notas?'<div style="max-width:520px;color:#6b5459;font-size:.9rem;margin-bottom:6px">'+esc(t.notas)+'</div>':'')
      +((t.pasos&&t.pasos.length)?'<div class="tr-foco-pasos">'+t.pasos.map(function(p,i){return '<label><input type="checkbox" data-fp="'+i+'"'+(p.d?' checked':'')+'> '+esc(p.t)+'</label>';}).join('')+'</div>':'')
      +'<div class="tr-time" id="trf-time">'+fmtT(foco.corriendo?(foco.fin-Date.now())/1000:foco.restante)+'</div>'
      +'<div class="tr-foco-b"><button data-d="10">10 min</button><button data-d="25">25 min</button><button data-d="45">45 min</button></div>'
      +'<div class="tr-foco-b"><button class="main" id="trf-play">'+(foco.corriendo?'⏸ Pausar':'▶ Empezar')+'</button><button class="ok" id="trf-ok">✔ Hecha</button></div>'
      +'<div class="tr-foco-b"><button id="trf-sig">Siguiente ⏭</button><button id="trf-salir">Salir</button></div>';
    [].slice.call(f.querySelectorAll('[data-d]')).forEach(function(b){ b.onclick=function(){ foco.dur=foco.restante=(+b.getAttribute('data-d'))*60; foco.corriendo=false; clearInterval(focoTimer); pintarFoco(); }; });
    [].slice.call(f.querySelectorAll('[data-fp]')).forEach(function(c){ c.onchange=function(){ t.pasos[+c.getAttribute('data-fp')].d=c.checked; guardar(); }; });
    f.querySelector('#trf-play').onclick=function(){
      if(foco.corriendo){ foco.restante=Math.max(0,(foco.fin-Date.now())/1000); foco.corriendo=false; clearInterval(focoTimer); }
      else { foco.fin=Date.now()+foco.restante*1000; foco.corriendo=true; clearInterval(focoTimer); focoTimer=setInterval(tick,500); }
      pintarFoco();
    };
    f.querySelector('#trf-ok').onclick=function(){
      intentarCompletar(t.id,false,function(){
        clearInterval(focoTimer); focoTimer=null; foco.corriendo=false; foco.restante=foco.dur; foco.i++; pintarFoco();
      });
    };
    f.querySelector('#trf-sig').onclick=function(){ clearInterval(focoTimer); foco.corriendo=false; foco.restante=foco.dur;
      // la tarea saltada pasa al final de la cola
      var id=foco.cola.splice(foco.i,1)[0]; foco.cola.push(id); pintarFoco(); };
    f.querySelector('#trf-salir').onclick=cerrarFoco;
    if(foco.corriendo && !focoTimer) focoTimer=setInterval(tick,500);
  }
  function tick(){
    if(!foco||!foco.corriendo) return;
    var r=(foco.fin-Date.now())/1000, el=document.getElementById('trf-time');
    if(r<=0){ foco.corriendo=false; foco.restante=foco.dur; clearInterval(focoTimer); focoTimer=null; beep(); if(el) el.textContent='¡Tiempo! 👏'; var p=document.getElementById('trf-play'); if(p) p.textContent='▶ Empezar'; return; }
    if(el) el.textContent=fmtT(r);
  }

  // ---------- sincronización entre dispositivos ----------
  function refrescar(){
    var page=document.getElementById('page-tareas');
    if(!page || !page.classList.contains('active')) return;
    if(document.getElementById('tr-modal') || document.getElementById('tr-foco')) return;   // no interrumpir
    var ae=document.activeElement; if(ae && ae.id==='tr-nuevo' && ae.value) return;
    if(typeof DB==='undefined' || !DB.loadAll) return;
    DB.loadAll().then(function(ok){ if(ok){ cargar(); pintar(); } }).catch(function(){});
  }
  function iniciarSync(){
    if(st.sync) return;
    st.sync=setInterval(refrescar, 120000);
    document.addEventListener('visibilitychange', function(){ if(!document.hidden) refrescar(); });
  }

  // ---------- integración con la navegación de la app ----------
  window.tareasAbrir = abrir;
  window.tareasIr = function(v){ if(['hoy','bandeja','tareas','proximas'].indexOf(v)<0) return; st.vista=v; st.addFecha=null; ls('tr_vista',v); if(document.getElementById('tr-contenido')) pintar(); };
  window.tareasDeHoyConteo = function(){ var h=hoy(); return T.filter(function(t){ return !t.hecha && fechaEf(t) && fechaEf(t)<=h; }).length; };
  var gpOriginal = window.goPage;
  if(typeof gpOriginal==='function'){
    window.goPage = function(name){
      var r = gpOriginal.apply(this, arguments);
      if(name==='tareas'){ var p=document.getElementById('page-tareas'); if(p && p.classList.contains('active')) abrir(); }
      return r;
    };
  }
})();
