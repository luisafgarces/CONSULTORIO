/* ===========================================================================
   Módulo TAREAS — pensado para TDAH: pocas cosas a la vista, captura rápida,
   "lo más importante de hoy" (máx. 3), modo foco con temporizador y deshacer.
   Datos: DB 'tareas' (Firestore suitedata/tareas). No toca nada del resto de la app.
   =========================================================================== */
(function(){
  if(window.__tareasInit) return; window.__tareasInit = true;

  var KEY = 'tareas';
  var T = [];                                   // todas las tareas
  var st = { vista:'hoy', filtro:'todas', verAtrasadas:false, verMasHoy:false, addFecha:null, addLista:'', foco:null, sync:null };
  try { st.vista = localStorage.getItem('tr_vista') || 'hoy'; st.filtro = localStorage.getItem('tr_filtro') || 'todas'; st.addLista = localStorage.getItem('tr_lista') || ''; } catch(e){}
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
    try { if(typeof agCalendarios==='function'){ var c=agCalendarios(); if(c && c.length) return c; } } catch(e){}
    return [{id:'consultorio',nombre:'Consultorio',color:'#cd8e9d'},{id:'personal',nombre:'Personal',color:'#7986cb'},{id:'conmovilidad',nombre:'CONMOVILIDAD',color:'#33b679'}];
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
'.tr-foco-b button.ok{background:#7ab87a;color:#fff;border-color:#7ab87a;font-weight:700}'
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
    return st.vista==='bandeja' ? 'sin' : st.vista==='proximas' ? 'manana' : 'hoy';
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
    var h=hoy();
    var hechasHoy = T.filter(function(t){ return t.hecha && t.hechaEn && t.hechaEn.slice(0,10)===h; }).length;
    var pend = pendientes().filter(function(t){ return t.fecha && t.fecha<=h; }).length;
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
    var nBand = pen.filter(function(t){return !t.fecha;}).length;
    var nHoy = pen.filter(function(t){return t.fecha && t.fecha<=h;}).length;
    function tab(id,txt){ return '<button class="tr-tab'+(st.vista===id?' on':'')+'" data-act="vista" data-v="'+id+'">'+txt+'</button>'; }
    el.innerHTML = tab('hoy','🎯 Hoy'+(nHoy?' ('+nHoy+')':''))+tab('bandeja','📥 Bandeja'+(nBand?' ('+nBand+')':''))+tab('proximas','📅 Próximas')+tab('hechas','✔ Hechas');
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
    var l = lista(t.lista||'consultorio'), h=hoy();
    var meta = '<span><span class="tr-dot" style="background:'+esc(l.color)+'"></span>'+esc(l.nombre)+'</span>';
    if(t.hora) meta += '<span>🕒 '+esc(horaTxt(t.hora))+'</span>';
    var pb = proximoBloque(t.id); if(pb) meta += '<span>📌 '+esc(bloqueTxt(pb))+'</span>';
    if(t.eventoId){ var ev0 = evs().filter(function(e){return e.id===t.eventoId;})[0]; if(ev0) meta += '<span>🔗 '+esc(ev0.titulo)+'</span>'; }
    if(t.fecha && t.fecha!==h && !opts.sinFecha) meta += '<span style="'+(t.fecha<h && !t.hecha?'color:#c27a00;font-weight:700':'')+'">📅 '+esc(etiquetaDia(t.fecha))+'</span>';
    if(t.pasos && t.pasos.length){ var d=t.pasos.filter(function(p){return p.d;}).length; meta += '<span>☑ '+d+'/'+t.pasos.length+'</span>'; }
    if(t.rep) meta += '<span>🔁</span>';
    if(t.notas) meta += '<span>📝</span>';
    var extra = '';
    if(opts.mover){
      extra = '<div class="tr-meta" style="margin-top:6px"><button class="tr-mini" data-act="mover" data-id="'+esc(t.id)+'" data-v="hoy">Hacer hoy</button><button class="tr-mini" data-act="mover" data-id="'+esc(t.id)+'" data-v="manana">Mañana</button></div>';
    }
    if(opts.restaurar){
      return '<div class="tr-row done" data-id="'+esc(t.id)+'"><button class="tr-chk" data-act="reabrir" data-id="'+esc(t.id)+'" aria-label="Reabrir"></button><div class="tr-main" data-act="edit" data-id="'+esc(t.id)+'"><div class="tr-tit">'+esc(t.titulo)+'</div><div class="tr-meta">'+meta+'</div></div></div>';
    }
    return '<div class="tr-row'+(opts.big?' big':'')+'" data-id="'+esc(t.id)+'"><button class="tr-chk" data-act="chk" data-id="'+esc(t.id)+'" aria-label="Marcar como hecha"></button>'
      + '<div class="tr-main" data-act="edit" data-id="'+esc(t.id)+'"><div class="tr-tit">'+esc(t.titulo)+'</div><div class="tr-meta">'+meta+'</div>'+extra+'</div>'
      + '<button class="tr-star'+(t.prio?' on':'')+'" data-act="star" data-id="'+esc(t.id)+'" aria-label="Marcar como importante">'+(t.prio?'★':'☆')+'</button></div>';
  }

  function pintarContenido(){
    var el=document.getElementById('tr-contenido'); if(!el) return;
    var h=hoy(), html='', pen=pendientes();
    if(st.vista==='hoy'){
      var atr = pen.filter(function(t){ return t.fecha && t.fecha<h; }).sort(function(a,b){ return a.fecha<b.fecha?-1:a.fecha>b.fecha?1:ordenar(a,b); });
      var hoyT = pen.filter(function(t){ return t.fecha===h; });
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
      var b = pen.filter(function(t){return !t.fecha;}).sort(ordenar);
      html += '<div class="tr-sec"><span>📥 Ideas y pendientes sin fecha</span></div>';
      html += b.length ? b.map(function(t){ return fila(t,{mover:true}); }).join('') : '<div class="tr-vacio"><b>Bandeja vacía ✨</b>Aquí caen las cosas que anotas sin fecha. Luego eliges cuándo.</div>';
    } else if(st.vista==='proximas'){
      var p = pen.filter(function(t){return t.fecha && t.fecha>h;}).sort(function(a,b){ return a.fecha<b.fecha?-1:a.fecha>b.fecha?1:ordenar(a,b); });
      if(!p.length) html += '<div class="tr-vacio"><b>Nada programado</b>Cuando le pongas fecha a una tarea, aparece aquí.</div>';
      var ult='';
      p.forEach(function(t){
        if(t.fecha!==ult){ ult=t.fecha; html += '<div class="tr-sec"><span>'+esc(etiquetaDia(t.fecha))+'</span></div>'; }
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
    var t={id:nuevoId(), titulo:txt, lista:l, fecha:f, hora:'', prio:false, notas:'', pasos:[], rep:'', hecha:false, creada:new Date().toISOString()};
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
      t.hecha=true; t.hechaEn=new Date().toISOString();
      var sig=null, fut=bloquesFuturos(t.id); quitarBloques(fut);
      if(t.rep){
        var nf=siguienteFecha(t);
        if(nf){ sig={id:nuevoId(), titulo:t.titulo, lista:t.lista, fecha:nf, hora:t.hora||'', prio:!!t.prio, notas:t.notas||'', pasos:(t.pasos||[]).map(function(p){return {t:p.t,d:false};}), rep:t.rep, hecha:false, creada:new Date().toISOString()}; T.push(sig); }
      }
      guardar(); pintar();
      snack(FRASES[Math.floor(Math.random()*FRASES.length)]+(sig?' · próxima: '+etiquetaDia(sig.fecha):'')+(fut.length?' · bloque'+(fut.length>1?'s':'')+' del calendario quitado'+(fut.length>1?'s':''):''), function(){
        t.hecha=false; delete t.hechaEn; if(sig) T=T.filter(function(x){return x!==sig;}); devolverBloques(fut); guardar(); pintar();
      }, 6000);
    };
    if(animar){
      var row=document.querySelector('#tr-contenido .tr-row[data-id="'+id+'"]');
      if(row){ row.classList.add('fin'); setTimeout(fn,280); return; }
    }
    fn();
  }

  function clickRoot(e){
    var b=e.target.closest('[data-act]'); if(!b) return;
    var act=b.getAttribute('data-act'), id=b.getAttribute('data-id'), v=b.getAttribute('data-v');
    if(act==='afechad') return;                       // el calendario se maneja en "change"
    if(act==='alista') return;
    if(act==='chk'){ completar(id,true); }
    else if(act==='reabrir'){ var t=porId(id); if(t){ t.hecha=false; delete t.hechaEn; guardar(); pintar(); } }
    else if(act==='star'){
      var t2=porId(id); if(!t2) return;
      if(!t2.prio){
        var h=hoy(); var yaImp = T.filter(function(x){ return !x.hecha && x.prio && x.fecha && x.fecha<=h; }).length;
        if(yaImp>=3 && t2.fecha && t2.fecha<=h){ snack('Ya tienes 3 importantes hoy. Quita una ⭐ para elegir otra.',null,3500); return; }
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
      var h2=hoy(), mov=T.filter(function(x){return !x.hecha && x.fecha && x.fecha<h2 && (st.filtro==='todas' || (x.lista||'consultorio')===st.filtro);});
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
  }
  function changeRoot(e){
    var el=e.target, act=el.getAttribute && el.getAttribute('data-act');
    if(act==='afechad'){ st.addFecha = el.value || null; pintarAddChips(); }
    else if(act==='alista'){ st.addLista=el.value; ls('tr_lista',el.value); }
  }

  // ---------- editor ----------
  function cerrarModal(){ var m=document.getElementById('tr-modal'); if(m) m.remove(); }
  function abrirEditor(id){
    cerrarModal();
    var t=porId(id); if(!t) return;
    var ls_=listas();
    var m=document.createElement('div'); m.id='tr-modal'; m.className='tr-bg';
    m.onclick=function(ev){ if(ev.target===m) cerrarModal(); };
    m.innerHTML = '<div class="tr-modal">'
      +'<div class="tr-f"><label>Tarea</label><textarea id="tre-tit" rows="2">'+esc(t.titulo)+'</textarea></div>'
      +'<div class="tr-2"><div class="tr-f"><label>Lista</label><select id="tre-lista">'+ls_.map(function(l){return '<option value="'+esc(l.id)+'"'+(l.id===(t.lista||'consultorio')?' selected':'')+'>'+esc(l.nombre)+'</option>';}).join('')+'</select></div>'
      +'<div class="tr-f"><label>Repetir</label><select id="tre-rep">'
        +[['','No se repite'],['diaria','Cada día'],['laboral','Lunes a viernes'],['semanal','Cada semana'],['mensual','Cada mes']].map(function(o){return '<option value="'+o[0]+'"'+((t.rep||'')===o[0]?' selected':'')+'>'+o[1]+'</option>';}).join('')+'</select></div></div>'
      +'<div class="tr-f"><label>Fecha</label><div class="tr-chips" style="margin:0 0 6px"><button type="button" class="tr-chip" data-q="hoy">Hoy</button><button type="button" class="tr-chip" data-q="manana">Mañana</button><button type="button" class="tr-chip" data-q="sem">En 1 semana</button><button type="button" class="tr-chip" data-q="sin">Sin fecha</button></div><input type="date" id="tre-fecha" value="'+esc(t.fecha||'')+'"></div>'
      +'<div class="tr-2"><div class="tr-f"><label>Hora (opcional)</label><input type="time" id="tre-hora" value="'+esc(t.hora||'')+'"></div>'
      +'<div class="tr-f"><label>Importante</label><select id="tre-prio"><option value="0"'+(!t.prio?' selected':'')+'>Normal</option><option value="1"'+(t.prio?' selected':'')+'>⭐ Importante</option></select></div></div>'
      +'<div class="tr-f"><label>Pasos pequeños (opcional)</label><div id="tre-pasos"></div><button type="button" class="tr-mini" id="tre-addpaso">+ Agregar paso</button></div>'
      +'<div class="tr-f"><label>Notas</label><textarea id="tre-notas" rows="2">'+esc(t.notas||'')+'</textarea></div>'
      +'<div class="tr-f"><label>Calendario</label><div id="tre-bloques"></div></div>'
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
      var ag=c.querySelector('#tre-agendar'); if(ag) ag.onclick=function(){ guardarCambiosBasicos(); agxAgendarBloque(t.id, pintarBloques); };
      [].slice.call(c.querySelectorAll('[data-brep]')).forEach(function(b){ b.onclick=function(){ agxReprogramarBloque(b.getAttribute('data-brep'), pintarBloques); }; });
      [].slice.call(c.querySelectorAll('[data-bdel]')).forEach(function(b){ b.onclick=function(){ var id=b.getAttribute('data-bdel'); quitarBloques(evs().filter(function(e){return e.id===id;})); pintarBloques(); }; });
    }
    function guardarCambiosBasicos(){ /* el título se guarda con "Guardar"; el bloque usa el título actual de la tarea */ }
    pintarBloques();
    m.querySelector('#tre-pasos').addEventListener('input',function(ev){ var i=ev.target.getAttribute('data-pt'); if(i!==null) pasos[+i].t=ev.target.value; });
    m.querySelector('#tre-pasos').addEventListener('change',function(ev){ var i=ev.target.getAttribute('data-pd'); if(i!==null) pasos[+i].d=ev.target.checked; });
    m.querySelector('#tre-pasos').addEventListener('click',function(ev){ var i=ev.target.getAttribute('data-px'); if(i!==null){ pasos.splice(+i,1); pintarPasos(); } });
    m.querySelector('#tre-addpaso').onclick=function(){ pasos.push({t:'',d:false}); pintarPasos(); var ins=m.querySelectorAll('#tre-pasos input[type=text]'); if(ins.length) ins[ins.length-1].focus(); };
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
      t.titulo=tit; t.lista=document.getElementById('tre-lista').value; t.fecha=fecha; t.hora=document.getElementById('tre-hora').value||'';
      t.prio=document.getElementById('tre-prio').value==='1'; t.rep=rep; t.notas=document.getElementById('tre-notas').value.trim();
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
    var h=hoy(), pen=pendientes().filter(function(t){ return t.fecha && t.fecha<=h; }).sort(ordenar);
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
      clearInterval(focoTimer); foco.corriendo=false; foco.restante=foco.dur;
      t.hecha=true; t.hechaEn=new Date().toISOString(); quitarBloques(bloquesFuturos(t.id));
      if(t.rep){ var nf=siguienteFecha(t); if(nf) T.push({id:nuevoId(),titulo:t.titulo,lista:t.lista,fecha:nf,hora:t.hora||'',prio:!!t.prio,notas:t.notas||'',pasos:(t.pasos||[]).map(function(p){return {t:p.t,d:false};}),rep:t.rep,hecha:false,creada:new Date().toISOString()}); }
      guardar(); foco.i++; pintarFoco();
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
  window.tareasIr = function(v){ if(['hoy','bandeja','proximas','hechas'].indexOf(v)<0) return; st.vista=v; st.addFecha=null; ls('tr_vista',v); if(document.getElementById('tr-contenido')) pintar(); };
  window.tareasDeHoyConteo = function(){ var h=hoy(); return T.filter(function(t){ return !t.hecha && t.fecha && t.fecha<=h; }).length; };
  var gpOriginal = window.goPage;
  if(typeof gpOriginal==='function'){
    window.goPage = function(name){
      var r = gpOriginal.apply(this, arguments);
      if(name==='tareas'){ var p=document.getElementById('page-tareas'); if(p && p.classList.contains('active')) abrir(); }
      return r;
    };
  }
})();
