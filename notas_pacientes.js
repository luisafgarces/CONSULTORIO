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
  function pendientes(pid){ return items(pid).filter(function(i){return !i.hecho;}); }

  var css=document.createElement('style'); css.textContent=[
  '#nrp-fab{position:fixed;left:14px;bottom:84px;z-index:9400;border:none;border-radius:26px;background:#b4527a;color:#fff;font:700 .85rem Lato,sans-serif;padding:11px 16px;box-shadow:0 3px 12px rgba(0,0,0,.28);cursor:pointer}',
  '#nrp-fab .n{background:#fff;color:#b4527a;border-radius:10px;padding:0 7px;margin-left:6px;font-size:.78rem}',
  'html.modo-agenda #nrp-fab{display:none}',
  '#nrp-bg{position:fixed;inset:0;background:rgba(40,25,30,.45);z-index:9600;display:flex;align-items:flex-end;justify-content:center}',
  '#nrp-box{background:#fff;width:100%;max-width:520px;max-height:88vh;overflow:auto;border-radius:18px 18px 0 0;padding:16px;font-family:Lato,sans-serif;color:#3b2c31}',
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

  var pidAct='', verHechas=false;
  function badge(){
    var fab=document.getElementById('nrp-fab'); if(!fab) return;
    var n=0; pacs().forEach(function(p){ n+=pendientes(p.id).length; });
    fab.innerHTML='📝 Notas'+(n?'<span class="n">'+n+'</span>':'');
  }
  function pintar(){
    var box=document.getElementById('nrp-box'); if(!box) return;
    var P=pacs();
    if(!pidAct||!P.some(function(p){return p.id===pidAct;})) pidAct=(P.some(function(p){return p.id===ult();})?ult():(P[0]&&P[0].id)||'');
    var h='<div style="display:flex;justify-content:space-between;align-items:center"><h3>📝 Notas rápidas del paciente</h3><button class="nrp-b g" data-n="cerrar">Cerrar</button></div>';
    if(!P.length){ box.innerHTML=h+'<p>Aún no tienes pacientes creados.</p>'; return; }
    h+='<select id="nrp-pac">'+P.map(function(p){return '<option value="'+esc(p.id)+'"'+(p.id===pidAct?' selected':'')+'>'+esc(p.nombre)+'</option>';}).join('')+'</select>';
    var it=items(pidAct), pe=it.filter(function(i){return !i.hecho;}), he=it.filter(function(i){return i.hecho;});
    h+='<div style="font-weight:700;margin:4px 0">❓ Para preguntar / no olvidar</div>';
    h+='<div style="display:flex;gap:6px"><input type="text" id="nrp-nuevo" placeholder="Escribe y toca Enter o Agregar" style="margin-bottom:0"><button class="nrp-b" data-n="add">Agregar</button></div>';
    h+='<div style="margin-top:6px">'+(pe.length?pe.map(fila).join(''):'<p style="opacity:.7;font-size:.88rem">Nada pendiente por preguntar.</p>')+'</div>';
    if(he.length){ h+='<button class="nrp-b g" data-n="hechas" style="margin-top:8px">'+(verHechas?'Ocultar':'Ver')+' ya preguntadas ('+he.length+')</button>'; if(verHechas) h+=he.map(fila).join(''); }
    h+='<div style="font-weight:700;margin:14px 0 4px">🗒 Notas libres</div><textarea id="nrp-libre" rows="5" placeholder="Lo que quieras anotar durante la sesión…">'+esc(libre(pidAct))+'</textarea>';
    h+='<div style="font-size:.76rem;opacity:.7">Se guarda solo. Es información clínica del paciente: no la compartas por fuera de la Suite.</div>';
    box.innerHTML=h;
    var inp=document.getElementById('nrp-nuevo'); if(inp) inp.addEventListener('keydown',function(e){ if(e.key==='Enter'){ e.preventDefault(); add(); } });
    var ta=document.getElementById('nrp-libre'); var tm; if(ta) ta.addEventListener('input',function(){ clearTimeout(tm); var v=ta.value, pid=pidAct; tm=setTimeout(function(){ DB.set(KL+pid,v); },600); });
    if(ta) ta.addEventListener('blur',function(){ DB.set(KL+pidAct,ta.value); });
  }
  function fila(i){ return '<div class="nrp-row'+(i.hecho?' h':'')+'"><input type="checkbox" data-n="chk" data-id="'+esc(i.id)+'"'+(i.hecho?' checked':'')+'><span>'+esc(i.t)+'</span><button data-n="del" data-id="'+esc(i.id)+'" title="Borrar">✕</button></div>'; }
  function add(){
    var inp=document.getElementById('nrp-nuevo'); var t=(inp&&inp.value||'').trim(); if(!t||!pidAct) return;
    var a=items(pidAct); a.push({id:String(Date.now())+Math.random().toString(36).slice(2,6),t:t,hecho:false,ts:Date.now()}); guardarItems(pidAct,a); pintar(); badge(); refrescarSesion();
    var i2=document.getElementById('nrp-nuevo'); if(i2) i2.focus();
  }
  function abrir(pid){
    if(pid) pidAct=pid;
    cerrar(); var bg=document.createElement('div'); bg.id='nrp-bg'; bg.innerHTML='<div id="nrp-box"></div>'; document.body.appendChild(bg); pintar();
  }
  function cerrar(){ var b=document.getElementById('nrp-bg'); if(b){ var ta=document.getElementById('nrp-libre'); if(ta&&pidAct) DB.set(KL+pidAct,ta.value); b.remove(); } badge(); refrescarSesion(); }
  document.addEventListener('click',function(e){
    var t=e.target;
    if(t.id==='nrp-fab'||(t.closest&&t.closest('#nrp-fab'))){ abrir(); return; }
    if(t.id==='nrp-bg'){ cerrar(); return; }
    var b=t.closest&&t.closest('[data-n]'); if(!b) return;
    var n=b.getAttribute('data-n'), id=b.getAttribute('data-id');
    if(n==='cerrar') cerrar();
    else if(n==='add') add();
    else if(n==='hechas'){ verHechas=!verHechas; pintar(); }
    else if(n==='abrirses'){ abrir(b.getAttribute('data-p')); }
    else if(n==='chk'){ var a=items(pidAct); a.forEach(function(i){ if(i.id===id) i.hecho=b.checked; }); guardarItems(pidAct,a); pintar(); badge(); }
    else if(n==='del'){ guardarItems(pidAct,items(pidAct).filter(function(i){return i.id!==id;})); pintar(); badge(); }
  });
  document.addEventListener('change',function(e){ if(e.target&&e.target.id==='nrp-pac'){ pidAct=e.target.value; setUlt(pidAct); verHechas=false; pintar(); } });

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
    if(!document.getElementById('nrp-fab')){ var f=document.createElement('button'); f.id='nrp-fab'; f.type='button'; document.body.appendChild(f); }
    badge(); envolver();
  }
  window._nrpApi={abrir:abrir,items:items,pendientes:pendientes};
  var n=0, iv=setInterval(function(){ montar(); if(++n>40) clearInterval(iv); },1000); montar();
  document.addEventListener('visibilitychange',function(){ if(!document.hidden) badge(); });
})();
