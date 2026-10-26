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
    +'#fin-rapido .fr-tb{width:100%;border-collapse:collapse;font-size:.82rem}#fin-rapido .fr-tb th,#fin-rapido .fr-tb td{padding:7px 4px;text-align:right;border-top:1px solid #f6e6ea}#fin-rapido .fr-tb th:first-child,#fin-rapido .fr-tb td:first-child{text-align:left}#fin-rapido .fr-tb th{font-size:.7rem;color:#a0536a;text-transform:uppercase;border-top:none}#fin-rapido .fr-tb tr.hoy td{background:#fbf1e8;font-weight:700}#fin-rapido .fr-tb tfoot td{font-weight:700;border-top:2px solid #cd8e9d}'
    +'#fin-rapido h4{margin:0 0 8px;font-size:.78rem;letter-spacing:.06em;text-transform:uppercase;color:#a0536a}'
    +'#fin-rapido .fr-num{font-size:1.6rem;font-weight:700;color:#643000}#fin-rapido .fr-sub{font-size:.82rem;color:#7a3c4b}'
    +'#fin-rapido .fr-it{display:flex;justify-content:space-between;gap:8px;align-items:center;padding:9px 0;border-top:1px solid #f6e6ea;font-size:.9rem}'
    +'#fin-rapido .fr-it:first-of-type{border-top:none}#fin-rapido .fr-x{border:none;background:none;color:#b0455b;cursor:pointer;font-size:.8rem;min-height:36px;padding:0 6px}';
    document.head.appendChild(s);
  }
  function catsConsultorio(){ var s=$('g_cat'); var a=s?[].map.call(s.options,function(o){return o.value||o.text;}):[]; return a.length?a:['Materiales y papelería','Plataformas o apps','Publicidad','Arriendo','Otro']; }
  var MESES=['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
  function anioAct(){ return new Date().getFullYear(); }
  var estado={ tipo: ls('fr_tipo')==='ingreso'?'ingreso':'gasto', anio: anioAct(), vista: ls('fr_vista')==='consultorio'?'consultorio':'personal', abierto: false };
  function suma(a,f){ return a.filter(f||function(){return true;}).reduce(function(s,g){ return s+(+g.monto||0); },0); }
  function esIngreso(g){ return g && g.tipo==='ingreso'; }
  function repetibles(P){
    var vistos={}, out=[]; P.slice().sort(function(a,b){ return String(b.fecha+b.id).localeCompare(String(a.fecha+a.id)); }).forEach(function(g){
      var k=(g.tipo||'gasto')+'|'+(g.desc||'')+'|'+g.monto+'|'+(g.medio||''); if(vistos[k]) return; vistos[k]=1; if(out.length<3) out.push(g); });
    return out;
  }
  function datosAnio(){
    var y=String(estado.anio), meses=[], i;
    for(i=0;i<12;i++) meses.push({i:0,g:0,n:0});
    var cats={};
    if(estado.vista==='consultorio'){
      var R=(typeof registros!=='undefined'&&Array.isArray(registros))?registros:[];
      R.forEach(function(r){ if(String(r.fecha||'').slice(0,4)!==y) return; var m=(+String(r.fecha).slice(5,7))-1; if(m<0||m>11) return;
        if(r.tipo==='ingreso' && r.estado==='pagado') meses[m].i+=(+r.monto||0);
        else if(r.tipo==='gasto'){ meses[m].g+=(+r.monto||0); var c=r.categoria||'Otro'; cats[c]=(cats[c]||0)+(+r.monto||0); } });
    } else {
      leerP().forEach(function(g){ if(String(g.fecha||'').slice(0,4)!==y) return; var m=(+String(g.fecha).slice(5,7))-1; if(m<0||m>11) return;
        if(esIngreso(g)) meses[m].i+=(+g.monto||0); else { meses[m].g+=(+g.monto||0); var c=g.medio==='tarjeta'?'💳 Tarjeta':'💵 Mi plata'; cats[c]=(cats[c]||0)+(+g.monto||0); } });
    }
    return {meses:meses,cats:cats};
  }
  function htmlAnio(){
    var d=datosAnio(), tI=suma(d.meses.map(function(m){return {monto:m.i};})), tG=suma(d.meses.map(function(m){return {monto:m.g};})), mesHoy=(estado.anio===anioAct())?new Date().getMonth():-1;
    var h='<div class="fr-chips" style="margin-top:0"><button class="fr-chip'+(estado.vista==='personal'?' on':'')+'" data-a="vistaanio" data-v="personal">🏠 Personal</button><button class="fr-chip'+(estado.vista==='consultorio'?' on':'')+'" data-a="vistaanio" data-v="consultorio">🏥 Consultorio</button></div>'
      +'<div style="display:flex;align-items:center;justify-content:center;gap:14px;margin:6px 0"><button class="fr-chip" data-a="anio" data-v="-1" aria-label="Año anterior">‹</button><b style="font-size:1.1rem;color:#643000">'+estado.anio+'</b><button class="fr-chip" data-a="anio" data-v="1" aria-label="Año siguiente">›</button></div>'
      +'<table class="fr-tb"><thead><tr><th></th><th>Entró</th><th>Salió</th><th>Neto</th></tr></thead><tbody>';
    d.meses.forEach(function(m,k){ var n=m.i-m.g; h+='<tr'+(k===mesHoy?' class="hoy"':'')+'><td>'+MESES[k]+'</td><td>'+(m.i?pesos(m.i):'–')+'</td><td>'+(m.g?pesos(m.g):'–')+'</td><td>'+((m.i||m.g)?(n<0?'−':'')+pesos(Math.abs(n)):'–')+'</td></tr>'; });
    var nt=tI-tG; h+='</tbody><tfoot><tr><td>Año</td><td>'+pesos(tI)+'</td><td>'+pesos(tG)+'</td><td>'+(nt<0?'−':'')+pesos(Math.abs(nt))+'</td></tr></tfoot></table>';
    var ks=Object.keys(d.cats).sort(function(a,b){ return d.cats[b]-d.cats[a]; });
    if(ks.length){ h+='<div class="fr-sub" style="margin:10px 0 4px"><b>En qué se fue</b></div>'+ks.map(function(k){ var pc=tG?Math.round(d.cats[k]*100/tG):0; return '<div class="fr-it"><span>'+esc(k)+'</span><span><b>'+pesos(d.cats[k])+'</b> <span class="fr-sub">('+pc+'%)</span></span></div>'; }).join(''); }
    if(estado.vista==='consultorio') h+='<div class="fr-sub" style="margin-top:8px">«Entró» cuenta los pagos de pacientes ya recibidos (los pendientes no). Viene de tus recibos.</div>';
    else h+='<div class="fr-sub" style="margin-top:8px">Es el neto de lo que registraste, no el saldo de tu banco.</div>';
    return h;
  }
  function pintar(){
    var c=$('fin-rapido'); if(!c) return; var cats=catsConsultorio(), ing=(estado.tipo==='ingreso');
    if(!ult.cat || cats.indexOf(ult.cat)<0) ult.cat=cats[cats.length-1];
    var P=leerP(), hoy=new Date(), mes=mesDe(ymd(hoy)), l0=ymd(lunesDe(hoy));
    var h='<div class="fr-card"><h4>⚡ Anota un movimiento</h4>'
      +'<div class="fr-chips" style="margin-top:0"><button class="fr-chip'+(!ing?' on':'')+'" data-a="tipo" data-v="gasto">💸 Gasto</button><button class="fr-chip'+(ing?' on':'')+'" data-a="tipo" data-v="ingreso">💰 Ingreso personal</button></div>'
      +'<div class="fr-lin" style="margin-top:10px"><input type="text" id="fr-linea" placeholder="'+(ing?'Ej.: 1718861 nómina':'Ej.: 25000 papelería')+'" autocomplete="off" enterkeyhint="done"><button class="fr-go" data-a="guardar">Guardar</button></div>'
      +'<div class="fr-prev" id="fr-prev"></div>';
    var rep=repetibles(P);
    if(rep.length) h+='<div class="fr-chips" style="margin-top:2px">'+rep.map(function(g,i){ return '<button class="fr-chip" data-a="repetir" data-id="'+esc(g.id)+'" style="font-size:.8rem;min-height:38px">↻ '+(esIngreso(g)?'+':'')+esc(g.desc||'Gasto')+' · '+pesos(g.monto)+'</button>'; }).join('')+'</div>';
    if(!ing){
      h+='<div class="fr-chips" id="fr-donde"><button class="fr-chip'+(ult.donde==='consultorio'?' on':'')+'" data-a="donde" data-v="consultorio">🏥 Consultorio</button><button class="fr-chip'+(ult.donde==='personal'?' on':'')+'" data-a="donde" data-v="personal">🏠 Personal</button></div>'
      +'<div class="fr-chips" id="fr-medio" style="display:'+(ult.donde==='personal'?'flex':'none')+'"><button class="fr-chip'+(ult.medio==='tarjeta'?' on':'')+'" data-a="medio" data-v="tarjeta">💳 Tarjeta</button><button class="fr-chip'+(ult.medio==='efectivo'?' on':'')+'" data-a="medio" data-v="efectivo">💵 Mi plata</button></div>'
      +'<div id="fr-catw" style="display:'+(ult.donde==='consultorio'?'block':'none')+';margin-top:10px"><select id="fr-cat">'+cats.map(function(k){ return '<option'+(k===ult.cat?' selected':'')+'>'+esc(k)+'</option>'; }).join('')+'</select></div>';
    } else h+='<div class="fr-sub" style="margin-top:8px">Los pagos de pacientes no se anotan aquí: entran solos cuando haces el recibo.</div>';
    h+='</div>';
    var delMes=P.filter(function(g){ return mesDe(g.fecha)===mes; }), semana=P.filter(function(g){ return g.fecha>=l0 && !esIngreso(g); });
    var gMes=delMes.filter(function(g){return !esIngreso(g);}), iMes=suma(delMes,esIngreso);
    h+='<div class="fr-card"><h4>🏠 Personal · '+MESES[hoy.getMonth()]+'</h4>'
      +'<div class="fr-sub">Entró</div><div class="fr-num">'+pesos(iMes)+'</div>'
      +'<div class="fr-sub" style="margin-top:6px">Salió '+pesos(suma(gMes))+' · esta semana '+pesos(suma(semana))+'</div>'
      +'<div class="fr-sub">💳 Tarjeta '+pesos(suma(gMes,function(g){return g.medio==='tarjeta';}))+' · 💵 Mi plata '+pesos(suma(gMes,function(g){return g.medio!=='tarjeta';}))+'</div></div>';
    var ult10=P.slice().sort(function(a,b){ return String(b.fecha+b.id).localeCompare(String(a.fecha+a.id)); }).slice(0,8);
    h+='<div class="fr-card"><h4>Últimos movimientos personales</h4>'+(ult10.length?ult10.map(function(g){ var inn=esIngreso(g); return '<div class="fr-it"><div><b>'+esc(g.desc||(inn?'Ingreso':'Gasto'))+'</b><div class="fr-sub">'+esc(g.fecha)+' · '+(inn?'💰 ingreso':(g.medio==='tarjeta'?'💳 tarjeta':'💵 mi plata'))+'</div></div><div style="display:flex;align-items:center;gap:4px"><b>'+(inn?'+':'')+pesos(g.monto)+'</b><button class="fr-x" data-a="borrar" data-id="'+esc(g.id)+'">Quitar</button></div></div>'; }).join(''):'<div class="fr-sub">Todavía no hay movimientos personales. Cuando registres el primero, aparece aquí. Sin afán.</div>')+'</div>'
      +'<div class="fr-card"><button class="fr-chip" data-a="verAnio" style="width:100%">📊 Mi año '+(estado.abierto?'▴':'▾')+'</button>'+(estado.abierto?'<div style="margin-top:10px">'+htmlAnio()+'</div>':'')+'</div>'
      +'<div class="fr-sub" style="margin:0 2px 10px">Los gastos del consultorio los ves también en <b>Resumen</b> e <b>Historial</b>, como siempre.</div>';
    c.innerHTML=h;
  }
  function preview(){
    var v=$('fr-linea'), p=$('fr-prev'); if(!v||!p) return; var r=leerLinea(v.value);
    p.textContent = r ? '→ '+pesos(r.monto)+(r.desc?' · '+r.desc:'') : (v.value.trim()?'Escribe también el monto, por ejemplo «25000 papelería».':'');
  }
  function guardar(){
    var v=$('fr-linea'); if(!v) return; var r=leerLinea(v.value), ing=(estado.tipo==='ingreso');
    if(!r){ toastS('Escribe el monto, por ejemplo: '+(ing?'1718861 nómina':'25000 papelería')); return; }
    var desc=r.desc||(ing?'Ingreso':'Gasto'), fecha=hoyLocal();
    if(ing){
      var PI=leerP(); PI.push({id:String(Date.now()),tipo:'ingreso',fecha:fecha,monto:r.monto,desc:desc}); guardarP(PI);
      toastS('✅ Ingreso guardado: '+pesos(r.monto));
    } else {
      if(!ult.donde){ toastS('Toca si es del Consultorio o Personal'); return; }
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
    }
    v.value=''; pintar(); var n=$('fr-linea'); if(n) n.focus();
  }
  function clic(e){
    var b=e.target.closest&&e.target.closest('[data-a]'); if(!b||!$('fin-rapido')||!$('fin-rapido').contains(b)) return;
    var a=b.getAttribute('data-a');
    if(a==='donde'){ ult.donde=b.getAttribute('data-v'); ls('fr_donde',ult.donde); var txt=($('fr-linea')||{}).value||''; pintar(); var n=$('fr-linea'); if(n){ n.value=txt; preview(); } }
    else if(a==='medio'){ ult.medio=b.getAttribute('data-v'); ls('fr_medio',ult.medio); var t2=($('fr-linea')||{}).value||''; pintar(); var n2=$('fr-linea'); if(n2){ n2.value=t2; preview(); } }
    else if(a==='guardar') guardar();
    else if(a==='tipo'){ estado.tipo=b.getAttribute('data-v')==='ingreso'?'ingreso':'gasto'; ls('fr_tipo',estado.tipo); var t3=($('fr-linea')||{}).value||''; pintar(); var n3=$('fr-linea'); if(n3){ n3.value=t3; preview(); } }
    else if(a==='repetir'){ var g0=leerP().filter(function(x){ return String(x.id)===b.getAttribute('data-id'); })[0]; if(g0){ estado.tipo=esIngreso(g0)?'ingreso':'gasto'; if(!esIngreso(g0)){ ult.donde='personal'; ls('fr_donde','personal'); if(g0.medio){ ult.medio=g0.medio; ls('fr_medio',g0.medio); } } pintar(); var n4=$('fr-linea'); if(n4){ n4.value=g0.monto+' '+(g0.desc||''); preview(); n4.focus(); } } }
    else if(a==='verAnio'){ estado.abierto=!estado.abierto; pintar(); }
    else if(a==='vistaanio'){ estado.vista=b.getAttribute('data-v')==='consultorio'?'consultorio':'personal'; ls('fr_vista',estado.vista); pintar(); }
    else if(a==='anio'){ estado.anio+=(+b.getAttribute('data-v')||0); pintar(); }
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
  // ---------- «💸 Gastos»: la misma pantalla, visible como pestaña de la Agenda ----------
  var PANELES_AG=['ag-nav-card','ag-container','ag-form-card','ag-panel-cumple'];
  function salirGastos(){
    var pn=$('ag-panel-gastos'); if(!pn) return;
    var visible=pn.style.display!=='none'; pn.style.display='none';
    var s=$('fin-rapido'), pg=$('page-finanzas'); if(s && pg && s.parentNode!==pg){ s.classList.remove('active'); pg.appendChild(s); }
    if(visible){ var pa=$('page-agenda'); if(pa) pa.classList.remove('ag-embed'); }
  }
  function abrirEnAgenda(b){
    var pn=$('ag-panel-gastos'), s=$('fin-rapido'); if(!pn||!s) return;
    try{ window.agTabActual='horario'; }catch(e){}
    var root=$('tareas-root'), pt=$('page-tareas'); if(root && pt && root.parentNode!==pt) pt.appendChild(root);
    var ptp=$('ag-panel-tareas'); if(ptp) ptp.style.display='none';
    PANELES_AG.forEach(function(id){ var e=$(id); if(e) e.style.display='none'; });
    [].forEach.call(document.querySelectorAll('.ag-tab-nav .ag-tab'),function(x){ x.classList.remove('active'); }); b.classList.add('active');
    pn.appendChild(s); s.classList.add('active'); pn.style.display='';
    var pa=$('page-agenda'); if(pa) pa.classList.add('ag-embed');
    pintar(); setTimeout(function(){ var n=$('fr-linea'); if(n && window.innerWidth>820) n.focus(); },50);
  }
  function montarTabAgenda(){
    var n=document.querySelector('.ag-tab-nav'), cp=$('ag-panel-cumple'); if(!n||!cp||n.querySelector('[data-tab="t-gastos"]')) return;
    css();
    var b=document.createElement('button'); b.className='ag-tab'; b.setAttribute('data-tab','t-gastos');
    b.innerHTML='<span class="ag-ico">💸</span><span class="ag-lb">Gastos</span>'; b.onclick=function(){ abrirEnAgenda(b); };
    var ref=n.querySelector('[data-tab="t-areas"]')||n.querySelector('[data-tab="t-tareas"]'); n.insertBefore(b, ref?ref.nextSibling:n.firstChild);
    var pn=document.createElement('div'); pn.id='ag-panel-gastos'; pn.style.display='none'; cp.parentNode.insertBefore(pn,cp);
    var oSw=window.agSwitchTab; if(typeof oSw==='function') window.agSwitchTab=function(){ salirGastos(); return oSw.apply(this,arguments); };
    var oTt=window.agxTabTareas; if(typeof oTt==='function') window.agxTabTareas=function(){ salirGastos(); return oTt.apply(this,arguments); };
    var oGp=window.goPage; if(typeof oGp==='function') window.goPage=function(name){ if(name!=='agenda') salirGastos(); return oGp.apply(this,arguments); };
    var oFs=window.finSwitchTab; if(typeof oFs==='function') window.finSwitchTab=function(){ salirGastos(); return oFs.apply(this,arguments); };
    window.agxGastoRapido=function(){ var pa=$('page-agenda'); if(pa && pa.classList.contains('active')) abrirEnAgenda(b); else { if(typeof goPage==='function') goPage('agenda'); abrirEnAgenda(b); } };
  }
  montar();
  montarTabAgenda();
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',function(){ montar(); montarTabAgenda(); });
})();
