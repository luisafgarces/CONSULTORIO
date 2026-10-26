/* ===========================================================================
   ⚡ Gasto rápido (Finanzas): una línea para registrar «25000 papelería» y un
   toque para decir si es del CONSULTORIO o PERSONAL.
   · Consultorio → entra al Finanzas de siempre (mismo historial y resumen).
   · Personal    → queda aparte, en tu cuenta (clave «finanzas_personal»); no se
                   mezcla con los pagos de pacientes ni con el resumen del consultorio.
   =========================================================================== */
(function(){
  'use strict';
  var KEY='finanzas_personal';
  function $(i){ return document.getElementById(i); }
  function esc(s){ return String(s==null?'':s).replace(/[&<>"']/g,function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); }
  function pesos(n){ return '$'+Math.round(Number(n)||0).toLocaleString('es-CO'); }
  function hoyLocal(){ var d=new Date(); return d.getFullYear()+'-'+('0'+(d.getMonth()+1)).slice(-2)+'-'+('0'+d.getDate()).slice(-2); }
  function ls(k,v){ try{ if(v===undefined) return localStorage.getItem(k); localStorage.setItem(k,v); }catch(e){} return null; }
  function toastS(m){ try{ if(typeof toast==='function') toast(m); }catch(e){} }
  var ult={ donde: ls('fr_donde')||'', medio: ls('fr_medio')||'', cat: ls('fr_cat')||'' };

  // ---------- leer el monto de una línea: «25000 papelería», «$25.000 almuerzo», «20 mil taxi», «1,5 millones» ----------
  function leerLinea(txt){
    var t=String(txt||'').trim(); if(!t) return null;
    var re=/(\$\s*)?(\d{1,3}(?:[.,]\d{3})+|\d+(?:[.,]\d+)?)\s*(mil(?:lones?)?|millon(?:es)?|millón|k|lukas?|luca)?(?![a-zA-Záéíóúñ])/i, m=re.exec(t); if(!m) return null;
    var num=m[2], suf=(m[3]||'').toLowerCase().replace('ó','o'), v;
    if(/^\d{1,3}([.,]\d{3})+$/.test(num)) v=parseFloat(num.replace(/[.,]/g,''));      // 25.000 / 1,250,000
    else v=parseFloat(num.replace(',','.'));                                           // 25 / 1,5
    if(isNaN(v)) return null;
    if(/^millon/.test(suf)) v*=1000000; else if(/^(mil|k|luk|luc)/.test(suf)) v*=1000;
    v=Math.round(v); if(v<=0) return null;
    var desc=(t.slice(0,m.index)+' '+t.slice(m.index+m[0].length)).replace(/\s+/g,' ').replace(/^[\s,:\-–]+|[\s,:\-–]+$/g,'').trim();
    return {monto:v, desc:desc};
  }
  window.agxLeerGasto=leerLinea;

  // ---------- datos personales ----------
  function leerP(){ var v=null; try{ v=DB.get(KEY); }catch(e){} return Array.isArray(v)?v:[]; }
  function guardarP(a){ try{ DB.set(KEY,a); }catch(e){} }
  function mesDe(f){ return String(f||'').slice(0,7); }
  function lunesDe(d){ var x=new Date(d.getFullYear(),d.getMonth(),d.getDate()); var k=x.getDay(); x.setDate(x.getDate()-(k===0?6:k-1)); return x; }
  function ymd(d){ return d.getFullYear()+'-'+('0'+(d.getMonth()+1)).slice(-2)+'-'+('0'+d.getDate()).slice(-2); }

  // ---------- pantalla ----------
  function css(){
    if($('fr-css')) return; var s=document.createElement('style'); s.id='fr-css';
    s.textContent='#fin-rapido .fr-card{background:#fff;border:1.5px solid #f0d8de;border-radius:16px;padding:14px;margin-bottom:12px}'
    +'#fin-rapido input[type=text],#fin-rapido select{font-size:16px;padding:12px;border:1.5px solid #f0d8de;border-radius:12px;width:100%;box-sizing:border-box;font-family:inherit}'
    +'#fin-rapido .fr-lin{display:flex;gap:8px}#fin-rapido .fr-lin input{flex:1}'
    +'#fin-rapido .fr-chips{display:flex;gap:8px;flex-wrap:wrap;margin:10px 0 2px}'
    +'#fin-rapido .fr-chip{border:1.5px solid #cd8e9d;background:#fff;color:#7a3c4b;border-radius:22px;padding:10px 16px;font-size:.9rem;cursor:pointer;min-height:44px}'
    +'#fin-rapido .fr-chip.on{background:#cd8e9d;color:#fff}'
    +'#fin-rapido .fr-go{border:none;background:#cd8e9d;color:#fff;border-radius:12px;padding:0 20px;font-size:.95rem;cursor:pointer;min-height:48px}'
    +'#fin-rapido .fr-prev{font-size:.85rem;color:#7a3c4b;margin:8px 2px 0;min-height:1.2em}'
    +'#fin-rapido h4{margin:0 0 8px;font-size:.78rem;letter-spacing:.06em;text-transform:uppercase;color:#a0536a}'
    +'#fin-rapido .fr-num{font-size:1.6rem;font-weight:700;color:#643000}#fin-rapido .fr-sub{font-size:.82rem;color:#7a3c4b}'
    +'#fin-rapido .fr-it{display:flex;justify-content:space-between;gap:8px;align-items:center;padding:9px 0;border-top:1px solid #f6e6ea;font-size:.9rem}'
    +'#fin-rapido .fr-it:first-of-type{border-top:none}#fin-rapido .fr-x{border:none;background:none;color:#b0455b;cursor:pointer;font-size:.8rem;min-height:36px;padding:0 6px}';
    document.head.appendChild(s);
  }
  function catsConsultorio(){ var s=$('g_cat'); var a=s?[].map.call(s.options,function(o){return o.value||o.text;}):[]; return a.length?a:['Materiales y papelería','Plataformas o apps','Publicidad','Arriendo','Otro']; }
  function pintar(){
    var c=$('fin-rapido'); if(!c) return; var cats=catsConsultorio();
    if(!ult.cat || cats.indexOf(ult.cat)<0) ult.cat=cats[cats.length-1];
    var h='<div class="fr-card"><h4>⚡ Anota un gasto</h4>'
      +'<div class="fr-lin"><input type="text" id="fr-linea" placeholder="Ej.: 25000 papelería" autocomplete="off" enterkeyhint="done"><button class="fr-go" data-a="guardar">Guardar</button></div>'
      +'<div class="fr-prev" id="fr-prev"></div>'
      +'<div class="fr-chips" id="fr-donde"><button class="fr-chip'+(ult.donde==='consultorio'?' on':'')+'" data-a="donde" data-v="consultorio">🏥 Consultorio</button><button class="fr-chip'+(ult.donde==='personal'?' on':'')+'" data-a="donde" data-v="personal">🏠 Personal</button></div>'
      +'<div class="fr-chips" id="fr-medio" style="display:'+(ult.donde==='personal'?'flex':'none')+'"><button class="fr-chip'+(ult.medio==='tarjeta'?' on':'')+'" data-a="medio" data-v="tarjeta">💳 Tarjeta</button><button class="fr-chip'+(ult.medio==='efectivo'?' on':'')+'" data-a="medio" data-v="efectivo">💵 Mi plata</button></div>'
      +'<div id="fr-catw" style="display:'+(ult.donde==='consultorio'?'block':'none')+';margin-top:10px"><select id="fr-cat">'+cats.map(function(k){ return '<option'+(k===ult.cat?' selected':'')+'>'+esc(k)+'</option>'; }).join('')+'</select></div></div>';
    var P=leerP(), hoy=new Date(), mes=mesDe(ymd(hoy)), l0=ymd(lunesDe(hoy));
    var delMes=P.filter(function(g){ return mesDe(g.fecha)===mes; }), semana=P.filter(function(g){ return g.fecha>=l0; });
    function suma(a,f){ return a.filter(f||function(){return true;}).reduce(function(s,g){ return s+(+g.monto||0); },0); }
    h+='<div class="fr-card"><h4>🏠 Personal</h4><div class="fr-num">'+pesos(suma(delMes))+'</div><div class="fr-sub">este mes · esta semana '+pesos(suma(semana))+'</div>'
      +'<div class="fr-sub" style="margin-top:6px">💳 Tarjeta '+pesos(suma(delMes,function(g){return g.medio==='tarjeta';}))+' · 💵 Mi plata '+pesos(suma(delMes,function(g){return g.medio!=='tarjeta';}))+'</div></div>';
    var ult10=P.slice().sort(function(a,b){ return String(b.fecha+b.id).localeCompare(String(a.fecha+a.id)); }).slice(0,8);
    h+='<div class="fr-card"><h4>Últimos gastos personales</h4>'+(ult10.length?ult10.map(function(g){ return '<div class="fr-it"><div><b>'+esc(g.desc||'Gasto')+'</b><div class="fr-sub">'+esc(g.fecha)+' · '+(g.medio==='tarjeta'?'💳 tarjeta':'💵 mi plata')+'</div></div><div style="display:flex;align-items:center;gap:4px"><b>'+pesos(g.monto)+'</b><button class="fr-x" data-a="borrar" data-id="'+esc(g.id)+'">Quitar</button></div></div>'; }).join(''):'<div class="fr-sub">Todavía no hay gastos personales. Cuando registres el primero, aparece aquí. Sin afán.</div>')+'</div>'
      +'<div class="fr-sub" style="margin:0 2px 10px">Los gastos del consultorio los ves en <b>Resumen</b> e <b>Historial</b>, como siempre.</div>';
    c.innerHTML=h;
  }
  function preview(){
    var v=$('fr-linea'), p=$('fr-prev'); if(!v||!p) return; var r=leerLinea(v.value);
    p.textContent = r ? '→ '+pesos(r.monto)+(r.desc?' · '+r.desc:'') : (v.value.trim()?'Escribe también el monto, por ejemplo «25000 papelería».':'');
  }
  function guardar(){
    var v=$('fr-linea'); if(!v) return; var r=leerLinea(v.value);
    if(!r){ toastS('Escribe el monto, por ejemplo: 25000 papelería'); return; }
    if(!ult.donde){ toastS('Toca si es del Consultorio o Personal'); return; }
    var desc=r.desc||'Gasto', fecha=hoyLocal();
    if(ult.donde==='consultorio'){
      if(typeof registros==='undefined' || typeof finGuardar!=='function'){ toastS('No pude guardar en el Finanzas del consultorio'); return; }
      var cat=($('fr-cat')||{}).value||'Otro'; ult.cat=cat; ls('fr_cat',cat);
      var reg={id:Date.now(),tipo:'gasto',descripcion:desc,fecha:fecha,monto:r.monto,categoria:cat};
      if(window.ROL_ACTUAL==='administrador' && typeof finEnviarARevision==='function') finEnviarARevision(reg);
      else { registros.push(reg); finGuardar(); try{ renderAll(); }catch(e){} }
      toastS('✅ Gasto del consultorio guardado: '+pesos(r.monto));
    } else {
      if(!ult.medio){ toastS('Toca si pagaste con Tarjeta o con Mi plata'); return; }
      var P=leerP(); P.push({id:String(Date.now()),fecha:fecha,monto:r.monto,desc:desc,medio:ult.medio}); guardarP(P);
      toastS('✅ Guardado: '+pesos(r.monto));
    }
    v.value=''; pintar(); var n=$('fr-linea'); if(n) n.focus();
  }
  function clic(e){
    var b=e.target.closest&&e.target.closest('[data-a]'); if(!b||!$('fin-rapido')||!$('fin-rapido').contains(b)) return;
    var a=b.getAttribute('data-a');
    if(a==='donde'){ ult.donde=b.getAttribute('data-v'); ls('fr_donde',ult.donde); var txt=($('fr-linea')||{}).value||''; pintar(); var n=$('fr-linea'); if(n){ n.value=txt; preview(); } }
    else if(a==='medio'){ ult.medio=b.getAttribute('data-v'); ls('fr_medio',ult.medio); var t2=($('fr-linea')||{}).value||''; pintar(); var n2=$('fr-linea'); if(n2){ n2.value=t2; preview(); } }
    else if(a==='guardar') guardar();
    else if(a==='borrar'){
      var id=b.getAttribute('data-id'), P=leerP(), g=P.filter(function(x){ return String(x.id)===id; })[0]; if(!g) return;
      guardarP(P.filter(function(x){ return String(x.id)!==id; })); pintar();
      toastS('Quitado: '+(g.desc||'gasto')+' '+pesos(g.monto)+' — toca «Deshacer» arriba');
      window._frUndo=g; mostrarDeshacer();
    }
  }
  function mostrarDeshacer(){
    var a=$('fr-undo'); if(a) a.remove(); var c=$('fin-rapido'); if(!c||!window._frUndo) return;
    var d=document.createElement('div'); d.id='fr-undo'; d.className='fr-card'; d.innerHTML='<span class="fr-sub">Quitaste «'+esc(window._frUndo.desc)+'» ('+pesos(window._frUndo.monto)+').</span> <button class="fr-chip" data-a="deshacer">↩ Deshacer</button>';
    c.insertBefore(d,c.firstChild); setTimeout(function(){ var x=$('fr-undo'); if(x) x.remove(); window._frUndo=null; },12000);
  }
  function montar(){
    var nav=document.querySelector('.fin-tab-nav'), pg=$('page-finanzas'); if(!nav||!pg||$('fin-rapido')) return;
    css();
    var b=document.createElement('button'); b.className='fin-tab'; b.textContent='⚡ Gasto rápido';
    b.onclick=function(){ pintar(); finSwitchTab('rapido',b); setTimeout(function(){ var n=$('fr-linea'); if(n && window.innerWidth>820) n.focus(); },50); };
    nav.insertBefore(b, nav.firstElementChild);
    var s=document.createElement('div'); s.className='fin-screen'; s.id='fin-rapido';
    s.addEventListener('click',function(e){
      var d=e.target.closest&&e.target.closest('[data-a="deshacer"]');
      if(d){ var g=window._frUndo; if(g){ var P=leerP(); P.push(g); guardarP(P); window._frUndo=null; pintar(); toastS('Listo, lo recuperé'); } return; }
      clic(e);
    });
    s.addEventListener('input',function(e){ if(e.target&&e.target.id==='fr-linea') preview(); });
    s.addEventListener('keydown',function(e){ if(e.key==='Enter'&&e.target&&e.target.id==='fr-linea'){ e.preventDefault(); guardar(); } });
    var ref=$('fin-resumen'); if(ref&&ref.parentNode) ref.parentNode.insertBefore(s,ref); else pg.appendChild(s);
    window.agxGastoRapido=function(){ if(typeof goPage==='function') goPage('finanzas'); b.click(); };
  }
  montar();
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',montar);
})();
