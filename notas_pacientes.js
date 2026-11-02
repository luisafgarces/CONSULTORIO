/* Bloc de notas rápido por paciente: "para preguntar" (con check) + notas libres.
   Botón flotante 📝 siempre disponible; también se ve en Notas de Sesión al elegir paciente. */
(function(){
  'use strict';
  var KP='notas_rapidas_', KL='notas_libres_', ULT='nrp_ultimo';
  function esc(s){ return String(s==null?'':s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];}); }
  function pacs(){ try{ return (typeof getPacientes==='function'?getPacientes():[])||[]; }catch(e){ return []; } }
  function items(pid){ try{ var v=DB.get(KP+pid); return Array.isArray(v)?v:[]; }catch(e){ return []; } }
  function guardarItems(pid,a){ DB.set(KP+pid,a); }
  function libre(pid){ try{ return DB.get(KL+pid)||''; }catch(e){ return ''; } }
  function ult(){ try{ return localStorage.getItem(ULT)||''; }catch(e){ return ''; } }
  function setUlt(v){ try{ localStorage.setItem(ULT,v); }catch(e){} }
  var OCU='nrp_fab_oculto';
  function oculto(){ try{ return localStorage.getItem(OCU)==='1'; }catch(e){ return false; } }
  function setOculto(v){ try{ localStorage.setItem(OCU,v?'1':'0'); }catch(e){} var w=document.getElementById('nrp-w'); if(w) w.classList.toggle('off',!!v); }
  function pendientes(pid){ return items(pid).filter(function(i){return !i.hecho;}); }

  var css=document.createElement('style'); css.textContent=[
  '#nrp-w{position:fixed;right:14px;bottom:96px;z-index:9400;display:flex;align-items:center;gap:2px}',
  '#nrp-w.off{display:none}',
  '#nrp-w.sbo{display:none}',
  '#nrp-fab{border:none;border-radius:26px 0 0 26px;background:#b4527a;color:#fff;font:700 .85rem Lato,sans-serif;padding:10px 12px 10px 14px;box-shadow:0 3px 12px rgba(0,0,0,.28);cursor:pointer}',
  '#nrp-x{border:none;border-radius:0 26px 26px 0;background:#8f3f62;color:#fff;font:700 .8rem Lato,sans-serif;padding:10px 11px;box-shadow:0 3px 12px rgba(0,0,0,.28);cursor:pointer}',
  '#nrp-fab .n{background:#fff;color:#b4527a;border-radius:10px;padding:0 7px;margin-left:6px;font-size:.78rem}',
  'html.modo-agenda #nrp-w{display:none}',
  '#nrp-bg{position:fixed;inset:0;z-index:9600;pointer-events:none}',
  '#nrp-box{pointer-events:auto;position:fixed;background:#fff;width:560px;height:72vh;min-width:280px;min-height:240px;max-width:98vw;max-height:96vh;overflow:auto;resize:both;border-radius:16px;border:2px solid #b4527a;box-shadow:0 8px 30px rgba(0,0,0,.35);padding:14px 16px 18px;font-family:Lato,sans-serif;color:#3b2c31;box-sizing:border-box}',
  '.nrp-head{cursor:move;touch-action:none;user-select:none;margin:-6px -4px 6px;padding:6px 4px;border-radius:10px;background:#fdf2f5}',
  '.nrp-head h3{pointer-events:none}',
  '#nrp-box.ext{position:static!important;width:auto!important;height:100vh!important;max-width:none!important;max-height:none!important;border:none!important;border-radius:0!important;box-shadow:none!important;resize:none!important}',
  '#nrp-libre{min-height:26vh;resize:vertical}',
  '#nrp-box h3{margin:0 0 8px;font-size:1.05rem}',
  '#nrp-box select,#nrp-box input[type=text],#nrp-box textarea{width:100%;box-sizing:border-box;border:1.5px solid #e3c3cf;border-radius:10px;padding:9px;font:inherit;font-size:.92rem;margin-bottom:8px}',
  '.nrp-row{display:flex;gap:8px;align-items:flex-start;padding:7px 0;border-bottom:1px solid #f3e4ea}',
  '.nrp-row input{margin-top:4px;width:20px;height:20px;flex:none}',
  '.nrp-row span{flex:1;font-size:.92rem;word-break:break-word}',
  '.nrp-row.h span{text-decoration:line-through;opacity:.55}',
  '.nrp-row button{border:none;background:none;color:#a33;font-size:1rem;cursor:pointer}',
  '.nrp-b{border:none;border-radius:10px;padding:9px 14px;font:700 .85rem Lato,sans-serif;cursor:pointer;background:#b4527a;color:#fff}',
  '.nrp-b.g{background:#f3e4ea;color:#6b3a50}',
  '.nrp-card{background:#fff7f9;border:1.5px solid #e3c3cf;border-radius:12px;padding:10px 12px;margin:10px 0;font-size:.88rem}'
  ].join(''); document.head.appendChild(css);

  var BOX=null, ext=null;
  function g(id){ return BOX?BOX.querySelector('#'+id):null; }
  var PK='nrp_pos';
  function leerPos(){ try{ var v=JSON.parse(localStorage.getItem(PK)||'null'); return (v&&typeof v==='object')?v:null; }catch(e){ return null; } }
  function guardarPos(){ var b=BOX; if(!b||ext) return; var r=b.getBoundingClientRect(); try{ localStorage.setItem(PK,JSON.stringify({l:Math.round(r.left),t:Math.round(r.top),w:Math.round(r.width),h:Math.round(r.height)})); }catch(e){} }
  function colocar(){
    var b=BOX; if(!b||ext) return; var vw=window.innerWidth, vh=window.innerHeight, p=leerPos();
    var w=p&&p.w?p.w:Math.min(560,vw*0.96), h=p&&p.h?p.h:Math.round(vh*0.72);
    w=Math.max(280,Math.min(w,vw-8)); h=Math.max(240,Math.min(h,vh-8));
    var l=p&&p.l!=null?p.l:Math.max(8,vw-w-24), t=p&&p.t!=null?p.t:Math.max(8,Math.round((vh-h)/2));
    l=Math.max(0,Math.min(l,vw-w)); t=Math.max(0,Math.min(t,vh-60));
    b.style.width=w+'px'; b.style.height=h+'px'; b.style.left=l+'px'; b.style.top=t+'px';
  }
  var ro=null, roT=null;
  function vigilar(){ var b=BOX; if(!b||typeof ResizeObserver==='undefined') return; if(ro) ro.disconnect(); ro=new ResizeObserver(function(){ clearTimeout(roT); roT=setTimeout(guardarPos,400); }); ro.observe(b); }
  var arr=null;
  document.addEventListener('pointerdown',function(e){
    var h=e.target.closest&&e.target.closest('.nrp-head'); if(!h||(e.target.closest&&e.target.closest('button,select,input,textarea'))) return;
    var b=BOX; if(!b||ext) return; var r=b.getBoundingClientRect();
    arr={dx:e.clientX-r.left,dy:e.clientY-r.top,w:r.width}; try{ h.setPointerCapture(e.pointerId); }catch(x){} e.preventDefault();
  });
  document.addEventListener('pointermove',function(e){
    if(!arr) return; var b=BOX; if(!b) return;
    var l=Math.max(0,Math.min(e.clientX-arr.dx,window.innerWidth-Math.min(arr.w,window.innerWidth))), t=Math.max(0,Math.min(e.clientY-arr.dy,window.innerHeight-48));
    b.style.left=l+'px'; b.style.top=t+'px';
  });
  function soltar(){ if(arr){ arr=null; guardarPos(); } }
  document.addEventListener('pointerup',soltar); document.addEventListener('pointercancel',soltar);
  window.addEventListener('resize',function(){ if(document.getElementById('nrp-box')) colocar(); });
  var pidAct='', verHechas=false;
  function badge(){
    var fab=document.getElementById('nrp-fab'); if(!fab) return;
    var n=0; pacs().forEach(function(p){ n+=pendientes(p.id).length; });
    fab.innerHTML='📝 Notas'+(n?'<span class="n">'+n+'</span>':'');
    var nv=document.getElementById('nrp-nav'); if(nv){ var l=nv.querySelector('.nav-label'); if(l) l.textContent=' Notas rápidas'+(n?' ('+n+')':''); }
  }
  function pintar(){
    var box=BOX; if(!box) return;
    var P=pacs();
    if(!pidAct||!P.some(function(p){return p.id===pidAct;})) pidAct=(P.some(function(p){return p.id===ult();})?ult():(P[0]&&P[0].id)||'');
    var h='<div class="nrp-head" title="Arrástrame para moverme" style="display:flex;justify-content:space-between;align-items:center"><h3>📝 Notas rápidas del paciente <span style="font-weight:400;font-size:.72rem;opacity:.7">'+(ext?'':'· arrastra aquí para moverla')+'</span></h3><span style="display:flex;gap:6px;flex:none"><button class="nrp-b g" data-n="'+(ext?'dock':'pop')+'" title="'+(ext?'Volver a ponerla dentro de la app':'Sacarla a una ventana aparte (para la otra pantalla)')+'">'+(ext?'↙ Traer aquí':'↗ Otra ventana')+'</button><button class="nrp-b g" data-n="cerrar">Cerrar</button></span></div>';
    if(!P.length){ box.innerHTML=h+'<p>Aún no tienes pacientes creados.</p>'; return; }
    h+='<select id="nrp-pac">'+P.map(function(p){return '<option value="'+esc(p.id)+'"'+(p.id===pidAct?' selected':'')+'>'+esc(p.nombre)+'</option>';}).join('')+'</select>';
    var it=items(pidAct), pe=it.filter(function(i){return !i.hecho;}), he=it.filter(function(i){return i.hecho;});
    h+='<div style="font-weight:700;margin:4px 0">❓ Para preguntar / no olvidar</div>';
    h+='<div style="display:flex;gap:6px"><input type="text" id="nrp-nuevo" placeholder="Escribe y toca Enter o Agregar" style="margin-bottom:0"><button class="nrp-b" data-n="add">Agregar</button></div>';
    h+='<div style="margin-top:6px">'+(pe.length?pe.map(fila).join(''):'<p style="opacity:.7;font-size:.88rem">Nada pendiente por preguntar.</p>')+'</div>';
    if(he.length){ h+='<button class="nrp-b g" data-n="hechas" style="margin-top:8px">'+(verHechas?'Ocultar':'Ver')+' ya preguntadas ('+he.length+')</button>'; if(verHechas) h+=he.map(fila).join(''); }
    h+='<div style="font-weight:700;margin:14px 0 4px">🗒 Notas libres</div><textarea id="nrp-libre" rows="9" placeholder="Lo que quieras anotar durante la sesión…">'+esc(libre(pidAct))+'</textarea>';
    h+='<div style="margin:10px 0 4px"><button class="nrp-b g" data-n="fabtog">'+(oculto()?'Mostrar el botón flotante 📝':'Ocultar el botón flotante')+'</button></div>';
    h+='<div style="font-size:.76rem;opacity:.7">Se guarda solo. Es información clínica del paciente: no la compartas por fuera de la Suite.</div>';
    box.innerHTML=h;
    var inp=g('nrp-nuevo'); if(inp) inp.addEventListener('keydown',function(e){ if(e.key==='Enter'){ e.preventDefault(); add(); } });
    var ta=g('nrp-libre'); var tm; if(ta) ta.addEventListener('input',function(){ clearTimeout(tm); var v=ta.value, pid=pidAct; tm=setTimeout(function(){ DB.set(KL+pid,v); },600); });
    if(ta) ta.addEventListener('blur',function(){ DB.set(KL+pidAct,ta.value); });
  }
  function fila(i){ return '<div class="nrp-row'+(i.hecho?' h':'')+'"><input type="checkbox" data-n="chk" data-id="'+esc(i.id)+'"'+(i.hecho?' checked':'')+'><span>'+esc(i.t)+'</span><button data-n="del" data-id="'+esc(i.id)+'" title="Borrar">✕</button></div>'; }
  function add(){
    var inp=g('nrp-nuevo'); var t=(inp&&inp.value||'').trim(); if(!t||!pidAct) return;
    var a=items(pidAct); a.push({id:String(Date.now())+Math.random().toString(36).slice(2,6),t:t,hecho:false,ts:Date.now()}); guardarItems(pidAct,a); pintar(); badge(); refrescarSesion();
    var i2=g('nrp-nuevo'); if(i2) i2.focus();
  }
  function abrir(pid){
    if(pid) pidAct=pid;
    if(ext&&!ext.closed){ pintar(); try{ ext.focus(); }catch(x){} return; }
    cerrar(); var bg=document.createElement('div'); bg.id='nrp-bg'; bg.innerHTML='<div id="nrp-box"></div>'; document.body.appendChild(bg); BOX=document.getElementById('nrp-box'); colocar(); pintar(); vigilar();
  }
  function cerrar(){
    var ta=g('nrp-libre'); if(ta&&pidAct) DB.set(KL+pidAct,ta.value);
    if(ext){ var w=ext; ext=null; try{ w.close(); }catch(e){} }
    var b=document.getElementById('nrp-bg'); if(b){ guardarPos(); b.remove(); } BOX=null; badge(); refrescarSesion();
  }
  /* Sacar el bloc a una ventana aparte (se puede arrastrar a la otra pantalla). Chrome: ventana flotante siempre visible; otros navegadores: ventana emergente. */
  function enExt(w){
    ext=w; var d=w.document; d.title='📝 Notas rápidas';
    d.head.appendChild(css.cloneNode(true)); d.body.style.cssText='margin:0;background:#fff';
    BOX.classList.add('ext'); d.body.appendChild(BOX); pintar();
    d.addEventListener('click',onClick); d.addEventListener('change',onChange);
    w.addEventListener('pagehide',volverDeExt);
    var iv=setInterval(function(){ if(!ext||ext.closed){ clearInterval(iv); volverDeExt(); } },1000);
  }
  function volverDeExt(){
    if(!ext) return; var w=ext; ext=null; var bg=document.getElementById('nrp-bg');
    if(bg&&BOX){ BOX.classList.remove('ext'); bg.appendChild(BOX); colocar(); pintar(); vigilar(); }
    try{ if(!w.closed) w.close(); }catch(e){}
  }
  function popOut(){
    if(!BOX) return; if(ext&&!ext.closed){ ext.focus(); return; }
    guardarPos();
    function popup(){ var w=window.open('','nrp_ext','popup=yes,width=460,height=720'); if(!w){ if(typeof toast==='function') toast('Tu navegador bloqueó la ventana: permite las ventanas emergentes para esta página.'); return; } enExt(w); }
    if(window.documentPictureInPicture&&documentPictureInPicture.requestWindow){ documentPictureInPicture.requestWindow({width:460,height:720}).then(enExt).catch(popup); } else popup();
  }
  function onClick(e){
    var t=e.target;
    if(t.id==='nrp-fab'||(t.closest&&t.closest('#nrp-fab'))||(t.closest&&t.closest('#nrp-nav'))){ abrir(); try{ if(typeof cerrarSidebarMobile==='function') cerrarSidebarMobile(); }catch(x){} return; }
    if(t.id==='nrp-x'){ setOculto(true); if(typeof toast==='function') toast('Botón oculto. Para volver a verlo: menú › Notas rápidas'); return; }
    if(t.id==='nrp-bg'){ cerrar(); return; }
    var b=t.closest&&t.closest('[data-n]'); if(!b) return;
    var n=b.getAttribute('data-n'), id=b.getAttribute('data-id');
    if(n==='cerrar') cerrar();
    else if(n==='add') add();
    else if(n==='fabtog'){ setOculto(!oculto()); pintar(); }
    else if(n==='hechas'){ verHechas=!verHechas; pintar(); }
    else if(n==='abrirses'){ abrir(b.getAttribute('data-p')); }
    else if(n==='chk'){ var a=items(pidAct); a.forEach(function(i){ if(i.id===id) i.hecho=b.checked; }); guardarItems(pidAct,a); pintar(); badge(); }
    else if(n==='pop') popOut();
    else if(n==='dock'){ volverDeExt(); }
    else if(n==='del'){ guardarItems(pidAct,items(pidAct).filter(function(i){return i.id!==id;})); pintar(); badge(); }
  }
  document.addEventListener('click',onClick);
  function onChange(e){ if(e.target&&e.target.id==='nrp-pac'){ pidAct=e.target.value; setUlt(pidAct); verHechas=false; pintar(); } }
  document.addEventListener('change',onChange);

  /* Tarjeta dentro de Notas de Sesión */
  function refrescarSesion(){
    var sel=document.getElementById('ses-sel-pac'); if(!sel) return;
    var card=document.getElementById('nrp-ses'); 
    if(!card){ card=document.createElement('div'); card.id='nrp-ses'; var par=sel.parentNode; par.parentNode.insertBefore(card,par.nextSibling); }
    var pid=sel.value; if(!pid){ card.innerHTML=''; return; }
    var pe=pendientes(pid);
    card.innerHTML='<div class="nrp-card"><b>❓ Para preguntar en esta sesión'+(pe.length?' ('+pe.length+')':'')+'</b>'+
      (pe.length?'<ul style="margin:6px 0 8px 18px;padding:0">'+pe.map(function(i){return '<li>'+esc(i.t)+'</li>';}).join('')+'</ul>':'<div style="opacity:.7;margin:4px 0 8px">Nada pendiente.</div>')+
      '<button class="nrp-b g" data-n="abrirses" data-p="'+esc(pid)+'">Abrir bloc de notas</button></div>';
  }
  function envolver(){
    if(typeof window.loadSesiones==='function' && !window.loadSesiones._nrp){
      var o=window.loadSesiones; window.loadSesiones=function(){ var r=o.apply(this,arguments); try{ refrescarSesion(); }catch(e){} return r; }; window.loadSesiones._nrp=1;
    }
  }
  function montar(){
    if(!document.getElementById('nrp-w')){ var w=document.createElement('div'); w.id='nrp-w'; if(oculto()) w.className='off'; w.innerHTML='<button id="nrp-fab" type="button"></button><button id="nrp-x" type="button" title="Ocultar este botón">✕</button>'; document.body.appendChild(w); }
    if(!document.getElementById('nrp-nav')){
      var ref=[].slice.call(document.querySelectorAll('.nav-btn')).filter(function(b){ return /goPage\('sesiones'\)/.test(b.getAttribute('onclick')||''); })[0];
      if(ref){ var nb=document.createElement('button'); nb.className='nav-btn'; nb.id='nrp-nav'; nb.type='button'; nb.innerHTML='<span class="icon">📝</span><span class="nav-label"> Notas rápidas</span>'; ref.parentNode.insertBefore(nb,ref.nextSibling); }
    }
    badge(); envolver(); vigilarMenu();
  }
  /* El botón flotante se esconde mientras el menú lateral esté abierto (en celular/tablet tapaba «Cerrar sesión») */
  function vigilarMenu(){
    var sb=document.getElementById('sidebar'); if(!sb||sb._nrpObs) return; sb._nrpObs=1;
    function sync(){ var w=document.getElementById('nrp-w'); if(w) w.classList.toggle('sbo',sb.classList.contains('mobile-open')); }
    try{ new MutationObserver(sync).observe(sb,{attributes:true,attributeFilter:['class']}); }catch(e){} sync();
  }
  window._nrpApi={abrir:abrir,items:items,pendientes:pendientes};
  var n=0, iv=setInterval(function(){ montar(); if(++n>40) clearInterval(iv); },1000); montar();
  document.addEventListener('visibilitychange',function(){ if(!document.hidden) badge(); });
})();
