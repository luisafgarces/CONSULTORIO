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
  window._frApi={ leerP:function(){return leerP();}, guardarP:function(a){ guardarP(a); }, pesos:pesos, esc:esc, ymd:ymd, hoyLocal:hoyLocal, leerLinea:leerLinea, estado:null, repintar:function(){ pintar(); }, toast:toastS, catsConsultorio:function(){ return catsConsultorio(); } };

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
  var estado=window._frApi.estado={ tipo: ls('fr_tipo')==='ingreso'?'ingreso':'gasto', anio: anioAct(), vista: ls('fr_vista')==='consultorio'?'consultorio':'personal', abierto: false, fecha: '', otraFecha: false, cfg: false, pagandoTarjeta: false };
  function suma(a,f){ return a.filter(f||function(){return true;}).reduce(function(s,g){ return s+(+g.monto||0); },0); }
  function esIngreso(g){ return g && g.tipo==='ingreso'; }
  function esPagoTarjeta(g){ return g && g.tipo==='pagotarjeta'; }
  function repetibles(P){
    var vistos={}, out=[]; P.filter(function(g){ return !esPagoTarjeta(g); }).slice().sort(function(a,b){ return String(b.fecha+b.id).localeCompare(String(a.fecha+a.id)); }).forEach(function(g){
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
        if(esPagoTarjeta(g)) return; if(esIngreso(g)) meses[m].i+=(+g.monto||0); else { meses[m].g+=(+g.monto||0); var c=g.medio==='tarjeta'?'💳 Tarjeta':'💵 Mi plata'; cats[c]=(cats[c]||0)+(+g.monto||0); } });
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
  function diaYmd(off){ var d=new Date(); d.setDate(d.getDate()+off); return ymd(d); }
  function fechaElegida(){ var f=$('fr-fecha'); var v=(f&&f.value)||estado.fecha||''; return /^\d{4}-\d{2}-\d{2}$/.test(v)?v:hoyLocal(); }
  function pintar(){
    var c=$('fin-rapido'); if(!c) return; var cats=catsConsultorio(), ing=(estado.tipo==='ingreso');
    if(!ult.cat || cats.indexOf(ult.cat)<0) ult.cat=cats[cats.length-1];
    var P=leerP(), hoy=new Date(), mes=mesDe(ymd(hoy)), l0=ymd(lunesDe(hoy));
    var h='<div class="fr-card"><h4>⚡ Anota un movimiento</h4>'
      +'<div class="fr-chips" style="margin-top:0"><button class="fr-chip'+(!ing?' on':'')+'" data-a="tipo" data-v="gasto">💸 Gasto</button><button class="fr-chip'+(ing?' on':'')+'" data-a="tipo" data-v="ingreso">💰 Ingreso personal</button></div>'
      +'<div class="fr-lin" style="margin-top:10px"><input type="text" id="fr-linea" placeholder="'+(ing?'Ej.: 1718861 nómina':'Ej.: 25000 papelería')+'" autocomplete="off" enterkeyhint="done"><button class="fr-go" data-a="guardar">Guardar</button></div>'
      +'<div class="fr-prev" id="fr-prev"></div>'
      +'<div class="fr-chips" style="margin:2px 0 0"><button class="fr-chip'+(!estado.fecha&&!estado.otraFecha?' on':'')+'" data-a="fecha" data-v="hoy" style="min-height:38px;font-size:.82rem">📅 Hoy</button><button class="fr-chip'+(estado.fecha===diaYmd(-1)?' on':'')+'" data-a="fecha" data-v="ayer" style="min-height:38px;font-size:.82rem">Ayer</button><button class="fr-chip'+(estado.otraFecha?' on':'')+'" data-a="fecha" data-v="otra" style="min-height:38px;font-size:.82rem">Otra fecha</button>'
      +(estado.otraFecha?'<input type="date" id="fr-fecha" value="'+esc(estado.fecha||hoyLocal())+'" max="'+hoyLocal()+'" style="font-size:16px;padding:8px;border:1.5px solid #f0d8de;border-radius:12px">':'')+'</div>';
    var rep=repetibles(P);
    if(rep.length) h+='<div class="fr-chips" style="margin-top:2px">'+rep.map(function(g,i){ return '<button class="fr-chip" data-a="repetir" data-id="'+esc(g.id)+'" style="font-size:.8rem;min-height:38px">↻ '+(esIngreso(g)?'+':'')+esc(g.desc||'Gasto')+' · '+pesos(g.monto)+'</button>'; }).join('')+'</div>';
    if(!ing){
      h+='<div class="fr-chips" id="fr-donde"><button class="fr-chip'+(ult.donde==='consultorio'?' on':'')+'" data-a="donde" data-v="consultorio">🏥 Consultorio</button><button class="fr-chip'+(ult.donde==='personal'?' on':'')+'" data-a="donde" data-v="personal">🏠 Personal</button></div>'
      +'<div class="fr-chips" id="fr-medio" style="display:'+(ult.donde==='personal'?'flex':'none')+'"><button class="fr-chip'+(ult.medio==='tarjeta'?' on':'')+'" data-a="medio" data-v="tarjeta">💳 Tarjeta</button><button class="fr-chip'+(ult.medio==='efectivo'?' on':'')+'" data-a="medio" data-v="efectivo">💵 Mi plata</button></div>'
      +'<div id="fr-catw" style="display:'+(ult.donde==='consultorio'?'block':'none')+';margin-top:10px"><select id="fr-cat">'+cats.map(function(k){ return '<option'+(k===ult.cat?' selected':'')+'>'+esc(k)+'</option>'; }).join('')+'</select></div>';
    } else h+='<div class="fr-sub" style="margin-top:8px">Los pagos de pacientes no se anotan aquí: entran solos cuando haces el recibo.</div>';
    h+='</div>';
    var delMes=P.filter(function(g){ return mesDe(g.fecha)===mes; }), semana=P.filter(function(g){ return g.fecha>=l0 && !esIngreso(g) && !esPagoTarjeta(g); });
    var gMes=delMes.filter(function(g){return !esIngreso(g) && !esPagoTarjeta(g);}), iMes=suma(delMes,esIngreso);
    h+='<div class="fr-card"><h4>🏠 Personal · '+MESES[hoy.getMonth()]+'</h4>'
      +'<div class="fr-sub">Entró</div><div class="fr-num">'+pesos(iMes)+'</div>'
      +'<div class="fr-sub" style="margin-top:6px">Salió '+pesos(suma(gMes))+' · esta semana '+pesos(suma(semana))+'</div>'
      +'<div class="fr-sub">💳 Tarjeta '+pesos(suma(gMes,function(g){return g.medio==='tarjeta';}))+' · 💵 Mi plata '+pesos(suma(gMes,function(g){return g.medio!=='tarjeta';}))+'</div></div>';
    var ult10=P.slice().sort(function(a,b){ return String(b.fecha+b.id).localeCompare(String(a.fecha+a.id)); }).slice(0,8);
    h+='<div class="fr-card"><h4>Últimos movimientos personales</h4>'+(ult10.length?ult10.map(function(g){ var inn=esIngreso(g), pt=esPagoTarjeta(g); return '<div class="fr-it"><div><b>'+esc(g.desc||(pt?'Pago de la tarjeta':inn?'Ingreso':'Gasto'))+'</b><div class="fr-sub">'+esc(g.fecha)+' · '+(pt?'💳 pago de tarjeta':inn?'💰 ingreso':(g.medio==='tarjeta'?'💳 tarjeta':'💵 mi plata'))+'</div></div><div style="display:flex;align-items:center;gap:4px"><b>'+(inn?'+':'')+pesos(g.monto)+'</b><button class="fr-x" data-a="borrar" data-id="'+esc(g.id)+'">Quitar</button></div></div>'; }).join(''):'<div class="fr-sub">Todavía no hay movimientos personales. Cuando registres el primero, aparece aquí. Sin afán.</div>')+'</div>'
      +'<div class="fr-card"><button class="fr-chip" data-a="verAnio" style="width:100%">📊 Mi año '+(estado.abierto?'▴':'▾')+'</button>'+(estado.abierto?'<div style="margin-top:10px">'+htmlAnio()+'</div>':'')+'</div>'
      +'<div class="fr-sub" style="margin:0 2px 10px">Los gastos del consultorio los ves también en <b>Resumen</b> e <b>Historial</b>, como siempre.</div>';
    if(typeof window._frPagosHTML==='function'){ try{ h=window._frPagosHTML(h); }catch(e){ console.warn('[pagos]',e); } }
    c.innerHTML=h;
  }
  function preview(){
    var v=$('fr-linea'), p=$('fr-prev'); if(!v||!p) return; var r=leerLinea(v.value);
    p.textContent = r ? '→ '+pesos(r.monto)+(r.desc?' · '+r.desc:'') : (v.value.trim()?'Escribe también el monto, por ejemplo «25000 papelería».':'');
  }
  function guardar(){
    var v=$('fr-linea'); if(!v) return; var r=leerLinea(v.value), ing=(estado.tipo==='ingreso');
    if(!r){ toastS('Escribe el monto, por ejemplo: '+(ing?'1718861 nómina':'25000 papelería')); return; }
    var desc=r.desc||(ing?'Ingreso':'Gasto'), fecha=fechaElegida();
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
    v.value=''; estado.fecha=''; estado.otraFecha=false; pintar(); var n=$('fr-linea'); if(n) n.focus();
  }
  function clic(e){
    var b=e.target.closest&&e.target.closest('[data-a]'); if(!b||!$('fin-rapido')||!$('fin-rapido').contains(b)) return;
    var a=b.getAttribute('data-a');
    if(a==='donde'){ ult.donde=b.getAttribute('data-v'); ls('fr_donde',ult.donde); var txt=($('fr-linea')||{}).value||''; pintar(); var n=$('fr-linea'); if(n){ n.value=txt; preview(); } }
    else if(a==='medio'){ ult.medio=b.getAttribute('data-v'); ls('fr_medio',ult.medio); var t2=($('fr-linea')||{}).value||''; pintar(); var n2=$('fr-linea'); if(n2){ n2.value=t2; preview(); } }
    else if(a==='guardar') guardar();
    else if(a==='fecha'){ var v0=b.getAttribute('data-v'), t0=($('fr-linea')||{}).value||''; if(v0==='hoy'){ estado.fecha=''; estado.otraFecha=false; } else if(v0==='ayer'){ estado.fecha=diaYmd(-1); estado.otraFecha=false; } else { estado.otraFecha=true; estado.fecha=estado.fecha||hoyLocal(); } pintar(); var n0=$('fr-linea'); if(n0){ n0.value=t0; preview(); } }
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
    s.addEventListener('change',function(e){ if(e.target&&e.target.id==='fr-fecha') estado.fecha=e.target.value||''; });
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

/* ===========================================================================
   📅 Pagos por hacer + «¿con qué pago?»
   Tú escribes una vez: tu tarjeta (cupo, corte, pago), tu nómina, cuánto tienes
   hoy y tus pagos fijos (con día). La app calcula, con lo que registraste:
   · qué pagos vienen y cuáles ya vencieron,
   · para cada uno, si conviene ponerlo en la TARJETA (a una cuota) o pagarlo con
     TU PLATA, y avisa si en alguna fecha no alcanzaría.
   Es un cálculo con tus números, no asesoría financiera. Todo queda en tu cuenta
   (clave «finanzas_config»), no en el código.
   =========================================================================== */
(function(){
  'use strict';
  var A=window._frApi; if(!A) return;
  var CK='finanzas_config', esc=A.esc, pesos=A.pesos, E=A.estado;
  var MES_L=['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'], DIA_L=['dom','lun','mar','mié','jue','vie','sáb'];
  function cfg(){ var c=null; try{ c=DB.get(CK); }catch(e){} c=(c&&typeof c==='object'&&!Array.isArray(c))?c:{}; c.tarjeta=c.tarjeta||{}; c.nomina=c.nomina||{}; c.disp=c.disp||{}; c.pagos=Array.isArray(c.pagos)?c.pagos:[]; c.pagados=(c.pagados&&typeof c.pagados==='object')?c.pagados:{}; return c; }
  function sv(c){ try{ DB.set(CK,c); }catch(e){} }
  function ult(y,m){ return new Date(y,m+1,0).getDate(); }
  function dEn(y,m,d){ return new Date(y,m,Math.min(d,ult(y,m))); }
  function hoy0(){ var n=new Date(); return new Date(n.getFullYear(),n.getMonth(),n.getDate()); }
  function yy(d){ return A.ymd(d); }
  function parseY(s){ var m=/^(\d{4})-(\d{2})-(\d{2})$/.exec(s||''); return m?new Date(+m[1],+m[2]-1,+m[3]):null; }
  function lab(d){ return DIA_L[d.getDay()]+' '+d.getDate()+' '+MES_L[d.getMonth()]; }
  function dias(txt){ var out=[]; String(txt||'').split(/[^0-9]+/).forEach(function(x){ var n=+x; if(n>=1&&n<=31&&out.indexOf(n)<0) out.push(n); }); return out.sort(function(a,b){return a-b;}); }
  function ocurr(diasArr, desde, hasta){
    var out=[], cur=new Date(desde.getFullYear(),desde.getMonth(),1);
    while(cur<=hasta){ diasArr.forEach(function(d){ var f=dEn(cur.getFullYear(),cur.getMonth(),d); if(f>=desde && f<=hasta) out.push(f); }); cur=new Date(cur.getFullYear(),cur.getMonth()+1,1); }
    return out.sort(function(a,b){return a-b;});
  }
  function num(v){ var r=A.leerLinea(String(v||'')); return r?r.monto:0; }

  // ---- tarjeta: a qué fecha de pago cae un gasto hecho el día S ----
  function tarjetaOK(t){ return t && +t.corte>=1 && +t.pago>=1 && +t.cupo>0; }
  function corteDe(S,t){ var c=dEn(S.getFullYear(),S.getMonth(),+t.corte); if(S>c) c=dEn(S.getFullYear(),S.getMonth()+1,+t.corte); return c; }
  function vence(S,t){ var c=corteDe(S,t), v=dEn(c.getFullYear(),c.getMonth(),+t.pago); if(v<=c) v=dEn(c.getFullYear(),c.getMonth()+1,+t.pago); return v; }
  function proxPago(S,t){ var v=dEn(S.getFullYear(),S.getMonth(),+t.pago); if(v<S) v=dEn(S.getFullYear(),S.getMonth()+1,+t.pago); return v; }

  // ---- lo que ya registraste desde que escribiste «cuánto tienes hoy» / «cuánto debes» ----
  function estadoActual(c){
    var P=A.leerP(), t=c.tarjeta, tsC=+c.disp.ts||0, tsT=+t.deboTs||0, hoy=hoy0();
    var cash=(+c.disp.monto||0);
    P.forEach(function(g){ var id=+g.id||0; if(id<=tsC) return;
      if(g.tipo==='ingreso') cash+=(+g.monto||0); else if(g.tipo==='pagotarjeta') cash-=(+g.monto||0); else if(g.medio!=='tarjeta') cash-=(+g.monto||0); });
    var stm={}, pagosT=0;
    function suma(k,v){ stm[k]=(stm[k]||0)+v; }
    if(tarjetaOK(t) && +t.debo>0) suma(yy(proxPago(hoy,t)), +t.debo);
    P.forEach(function(g){ var id=+g.id||0; if(id<=tsT) return;
      if(g.tipo==='pagotarjeta') pagosT+=(+g.monto||0);
      else if(g.medio==='tarjeta' && g.tipo!=='ingreso' && tarjetaOK(t)){ var f=parseY(g.fecha)||hoy; suma(yy(vence(f,t)), +g.monto||0); } });
    var ks=Object.keys(stm).sort(), resto=pagosT; ks.forEach(function(k){ var q=Math.min(stm[k],resto); stm[k]-=q; resto-=q; }); // los pagos se aplican al más antiguo
    var debe=0; ks.forEach(function(k){ debe+=stm[k]; }); if(resto>0) debe=Math.max(0,debe-resto);
    return {cash:cash, stm:stm, debe:debe, cupoLibre:(+t.cupo||0)-debe, hayDisp: c.disp.monto!=null && c.disp.monto!=='' };
  }

  // ---- plan: pagos de los próximos 30 días (y los que quedaron atrasados) con sugerencia ----
  function armarPlan(c){
    var hoy=hoy0(), hasta=new Date(hoy.getFullYear(),hoy.getMonth(),hoy.getDate()+30), atras=new Date(hoy.getFullYear(),hoy.getMonth(),hoy.getDate()-20), items=[];
    c.pagos.forEach(function(p){
      var fechas = p.frec==='unico' ? (parseY(p.fecha)?[parseY(p.fecha)]:[]) : ocurr(p.dias||[], atras, hasta);
      fechas.forEach(function(f){ if(f<atras||f>hasta) return; var key=p.id+'|'+yy(f); if(c.pagados[key]) return;
        items.push({p:p,key:key,orig:f,fecha:f<hoy?hoy:f,atrasado:f<hoy,monto:+p.monto||0,tarj:!!p.tarjeta && p.donde!=='consultorio',medio:'efectivo',motivo:'',ok:true}); });
    });
    items.sort(function(a,b){ return a.fecha-b.fecha || a.orig-b.orig; });
    var est=estadoActual(c), t=c.tarjeta, nom=(+c.nomina.monto>0)?ocurr(c.nomina.dias||[], new Date(hoy.getFullYear(),hoy.getMonth(),hoy.getDate()+1), hasta):[];
    function eventos(over){
      var ev=[], stm={}; Object.keys(est.stm).forEach(function(k){ stm[k]=est.stm[k]; });
      nom.forEach(function(f){ ev.push({f:yy(f),d:+c.nomina.monto}); });
      items.forEach(function(it,i){ if(it.p.donde==='consultorio') return; var med=(i in over)?over[i]:it.medio;
        if(med==='tarjeta' && tarjetaOK(t)){ var k=yy(vence(it.fecha,t)); stm[k]=(stm[k]||0)+it.monto; } else ev.push({f:yy(it.fecha),d:-it.monto}); });
      Object.keys(stm).forEach(function(k){ if(stm[k]>0) ev.push({f:k,d:-stm[k]}); });
      return ev;
    }
    function caja(ev,f){ var s=est.cash, k=yy(f); ev.forEach(function(e){ if(e.f<=k) s+=e.d; }); return s; }
    var usadoTarj=0, listo=est.hayDisp;
    items.forEach(function(it,i){
      if(it.p.donde==='consultorio'){ it.medio=''; return; }
      if(!listo){ it.medio=it.tarj?'?':'efectivo'; return; }
      if(it.tarj && tarjetaOK(t)){
        var vv=vence(it.fecha,t), sinCupo=(est.debe+usadoTarj+it.monto)>(+t.cupo||0);
        var ov={}; ov[i]='tarjeta'; var cT=caja(eventos(ov),vv);
        var ov2={}; ov2[i]='efectivo'; var cE=caja(eventos(ov2),it.fecha);
        if(sinCupo){ it.medio='efectivo'; it.motivo='La tarjeta no tiene cupo libre para esto.'; }
        else if(cT<0){ it.medio='efectivo'; it.motivo='Si lo pones en la tarjeta, el '+lab(vv)+' no te alcanzaría para pagarla completa.'; }
        else { it.medio='tarjeta'; usadoTarj+=it.monto; it.motivo= cE<0 ? 'Con tu plata no alcanzaría ese día; en la tarjeta lo pagas el '+lab(vv)+', ya con tu nómina.' : 'Puedes ponerlo en la tarjeta: la pagas el '+lab(vv)+' y alcanza.'; }
      } else { it.medio='efectivo'; it.motivo = it.tarj ? 'Configura tu tarjeta para que te sugiera.' : (it.p.tarjeta?'':'No se puede con tarjeta.'); }
      it.medio = it.medio||'efectivo';
    });
    var evF=eventos({}), aviso=null;
    if(listo){ var fechasEv=evF.map(function(e){return e.f;}).sort(); var visto={}; for(var k=0;k<fechasEv.length;k++){ var fk=fechasEv[k]; if(visto[fk]) continue; visto[fk]=1; var cc=caja(evF,parseY(fk)); if(cc<0){ aviso={f:parseY(fk),falta:-cc}; break; } } }
    return {items:items,est:est,aviso:aviso,listo:listo,t:t};
  }


  // ---- nómina: te pregunto el día que toca y dejo de preguntar cuando dices «sí» ----
  function nomPend(c){
    var n=c.nomina; if(!(+n.monto>0)||!(n.dias&&n.dias.length)) return [];
    var hoy=hoy0(), ini=new Date(hoy.getFullYear(),hoy.getMonth(),hoy.getDate()-10), d0=parseY(n.desde)||hoy; if(d0>ini) ini=d0;
    c.nominaOk=(c.nominaOk&&typeof c.nominaOk==='object')?c.nominaOk:{};
    return ocurr(n.dias,ini,hoy).filter(function(f){ return !c.nominaOk['nom|'+yy(f)]; }).reverse();
  }
  function htmlNom(c,conId){
    var l=nomPend(c); if(!l.length) return '';
    var f=l[0], k=yy(f);
    return '<div class="fr-nom"><b>💰 ¿Ya te entró la nómina del '+lab(f)+'?</b>'+(l.length>1?'<div class="fr-sub">Tienes '+l.length+' por confirmar</div>':'')
      +'<div class="fr-row"><input type="text" id="'+conId+'" inputmode="numeric" value="'+(+c.nomina.monto)+'"><button class="fr-go" data-a="pg-nomsi" data-k="'+k+'" data-inp="'+conId+'">Sí, ya entró</button></div>'
      +'<div class="fr-chips" style="margin:6px 0 0"><button class="fr-chip" data-a="pg-nomno" style="min-height:40px;font-size:.84rem">Todavía no</button></div>'
      +'<div class="fr-sub">Si cambió el valor, corrígelo antes de tocar «Sí». Al decir «Sí» lo anoto como ingreso y no te vuelvo a preguntar por esa fecha.</div></div>';
  }
  function nomSi(k,inpId){
    var c=cfg(), m=num((document.getElementById(inpId)||{}).value)||+c.nomina.monto; if(!m){ A.toast('Escribe el monto'); return; }
    c.nominaOk=c.nominaOk||{}; if(c.nominaOk['nom|'+k]) return; c.nominaOk['nom|'+k]=true; sv(c);
    var P=A.leerP(); P.push({id:String(Date.now()),tipo:'ingreso',fecha:k,monto:m,desc:'Nómina'}); A.guardarP(P);
    A.toast('✅ Nómina anotada: '+pesos(m)); banner(); A.repintar();
  }
  var nomOculto=false;
  function banner(){
    var old=document.getElementById('fr-nom-flot'); if(old) old.remove();
    var lg=document.getElementById('login-overlay'); if(lg && lg.style.display!=='none' && getComputedStyle(lg).display!=='none') return;
    if(nomOculto) return;
    var root=document.getElementById('fin-rapido'); if(root && root.offsetParent) return; // ya se ve en Gastos
    var c=cfg(), h=htmlNom(c,'pg-nmv-f'); if(!h) return;
    var d=document.createElement('div'); d.id='fr-nom-flot'; d.innerHTML=h; document.body.appendChild(d);
  }
  setInterval(function(){ try{ banner(); }catch(e){} },4000); setTimeout(function(){ try{ banner(); }catch(e){} },1500);

  // ---- pantalla ----
  function chip(a,txt,extra){ return '<button class="fr-chip" data-a="'+a+'" '+(extra||'')+' style="min-height:40px;font-size:.84rem">'+txt+'</button>'; }
  function htmlPagos(c, plan){
    var h='<div class="fr-card"><h4>📅 Pagos por hacer</h4>', t=c.tarjeta; h+=htmlNom(c,'pg-nmv');
    if(!plan.listo) h+='<div class="fr-sub" style="margin-bottom:8px">Para que te diga con qué pagar, cuéntame <b>cuánto tienes hoy</b> y los datos de tu tarjeta en «⚙️ Mis números».</div>';
    else {
      h+='<div class="fr-sub">💵 Con lo que anotaste tienes hoy <b>'+pesos(plan.est.cash)+'</b></div>';
      if(tarjetaOK(t)){ var ks=Object.keys(plan.est.stm).filter(function(k){return plan.est.stm[k]>0;}).sort(), prox=ks[0];
        h+='<div class="fr-sub">💳 Debes <b>'+pesos(plan.est.debe)+'</b> · cupo libre '+pesos(Math.max(0,plan.est.cupoLibre))+(prox?' · próximo pago '+lab(parseY(prox))+' ('+pesos(plan.est.stm[prox])+')':'')+'</div>'; }
      if(plan.aviso) h+='<div class="fr-aviso">⚠️ Según lo que registraste, el <b>'+lab(plan.aviso.f)+'</b> te faltarían <b>'+pesos(plan.aviso.falta)+'</b>. Hay tiempo de revisarlo; por ahora es solo un aviso.</div>';
    }
    if(E.pagandoTarjeta){ var sug=plan.est.stm?Math.max(0,plan.est.debe):0; h+='<div class="fr-row"><input type="text" id="pg-pt" inputmode="numeric" value="'+(sug||'')+'" placeholder="Monto que pagaste"><button class="fr-go" data-a="pg-ptok">Guardar pago</button></div>'; }
    else if(tarjetaOK(t)) h+='<div class="fr-chips" style="margin:6px 0 0">'+chip('pg-pt','💳 Pagué la tarjeta')+'</div>';
    h+='<div style="margin-top:10px">';
    if(!plan.items.length) h+='<div class="fr-sub">'+(c.pagos.length?'No tienes pagos en los próximos 30 días. 🌿':'Aún no hay pagos. Agrega los que se repiten (arriendo, servicios, cuotas) en «⚙️ Mis números».')+'</div>';
    plan.items.forEach(function(it,i){
      var sug=it.medio, cons=it.p.donde==='consultorio';
      h+='<div class="fr-pg"><div class="fr-pgh"><div><b>'+esc(it.p.nombre||'Pago')+'</b> · '+pesos(it.monto)+(cons?' <span class="fr-sub">(consultorio)</span>':'')+'<div class="fr-sub">'+(it.atrasado?'⏰ Venció el '+lab(it.orig)+' — sin culpa, cuando puedas':'📅 '+lab(it.fecha))+'</div></div></div>';
      if(!cons){
        if(it.tarj && sug==='?') h+='<div class="fr-sub">Puede ir en tarjeta. Completa «Mis números» para saber si conviene.</div>';
        else if(plan.listo) h+='<div class="fr-sug">'+(sug==='tarjeta'?'💳 Ponlo en la tarjeta':'💵 Págalo con tu plata')+'</div>'+(it.motivo?'<div class="fr-sub">'+esc(it.motivo)+'</div>':'');
        h+='<div class="fr-chips" style="margin:6px 0 0"><button class="fr-chip'+(sug==='tarjeta'?' on':'')+'" data-a="pg-pagar" data-i="'+i+'" data-m="tarjeta" style="min-height:40px;font-size:.82rem"'+(tarjetaOK(t)&&it.p.tarjeta?'':' disabled')+'>✓ Pagué con 💳</button><button class="fr-chip'+(sug==='efectivo'?' on':'')+'" data-a="pg-pagar" data-i="'+i+'" data-m="efectivo" style="min-height:40px;font-size:.82rem">✓ Pagué con 💵</button></div>';
      } else h+='<div class="fr-chips" style="margin:6px 0 0"><button class="fr-chip" data-a="pg-pagar" data-i="'+i+'" data-m="consultorio" style="min-height:40px;font-size:.82rem">✓ Pagado</button></div>';
      h+='</div>';
    });
    h+='</div><div class="fr-chips" style="margin-top:8px">'+chip('pg-todos','📋 Todos mis pagos fijos ('+c.pagos.length+') '+(E.todos?'▴':'▾'))+chip('pg-cfg','⚙️ Mis números '+(E.cfg?'▴':'▾'))+'</div>';
    if(E.todos) h+=htmlTodos(c);
    if(E.cfg) h+=htmlCfg(c);
    return h+'</div>';
  }

  function proxFecha(p,c){
    var hoy=hoy0(), fin=new Date(hoy.getFullYear(),hoy.getMonth(),hoy.getDate()+70);
    var fs = p.frec==='unico' ? (parseY(p.fecha)?[parseY(p.fecha)]:[]) : ocurr(p.dias||[], new Date(hoy.getFullYear(),hoy.getMonth(),hoy.getDate()-20), fin);
    for(var i=0;i<fs.length;i++){ var f=fs[i]; if(c.pagados[p.id+'|'+yy(f)]) continue; return f; }
    return null;
  }
  function htmlTodos(c){
    if(!c.pagos.length) return '<div class="fr-sub" style="margin-top:8px">Todavía no has agregado pagos fijos. Hazlo en «⚙️ Mis números» → «＋ Agregar un pago».</div>';
    var lista=c.pagos.map(function(p){ return {p:p,f:proxFecha(p,c)}; }).sort(function(a,b){ return (a.f?a.f.getTime():9e15)-(b.f?b.f.getTime():9e15); });
    var perso=0, cons=0; c.pagos.forEach(function(p){ if(p.frec==='unico') return; if(p.donde==='consultorio') cons+=+p.monto||0; else perso+=+p.monto||0; });
    var h='<div class="fr-cfg"><div class="fr-sub"><b>Cada mes pagas</b> '+pesos(perso)+' en lo personal'+(cons?' y '+pesos(cons)+' en el consultorio':'')+'.</div>';
    lista.forEach(function(x){ var p=x.p;
      h+='<div class="fr-it"><div><b>'+esc(p.nombre)+'</b> · '+pesos(p.monto)+'<div class="fr-sub">'+(x.f?'próximo: '+lab(x.f):'sin fecha próxima')+' · '+(p.frec==='unico'?'una vez':'cada mes, día '+esc((p.dias||[]).join(' y ')))+(p.donde==='consultorio'?' · 🏥 consultorio':'')+(p.tarjeta?' · 💳 se puede con tarjeta':'')+'</div></div><button class="fr-x" data-a="pg-editar" data-id="'+esc(p.id)+'">Editar</button></div>'; });
    return h+'</div>';
  }
  function inp(id,lbl,val,ph,extra){ return '<div class="fr-f"><label>'+lbl+'</label><input type="text" id="'+id+'" value="'+esc(val==null?'':val)+'" placeholder="'+esc(ph||'')+'" inputmode="'+(extra||'numeric')+'"></div>'; }
  function htmlCfg(c){
    var t=c.tarjeta, n=c.nomina, d=c.disp, cats=A.catsConsultorio();
    var h='<div class="fr-cfg"><div class="fr-sub"><b>💵 Cuánto tienes hoy</b> (en tu cuenta, sin contar la tarjeta; actualízalo cuando quieras)</div>'+inp('pg-disp','Disponible hoy',d.monto,'Ej.: 400000')
      +'<div class="fr-sub" style="margin-top:8px"><b>💳 Tarjeta de crédito</b> (siempre a una cuota)</div>'+inp('pg-cupo','Cupo',t.cupo,'Ej.: 1000000')+'<div class="fr-2">'+inp('pg-corte','Día de corte',t.corte,'Ej.: 10')+inp('pg-pago','Día de pago',t.pago,'Ej.: 25')+'</div>'+inp('pg-debo','Cuánto debes hoy en la tarjeta (0 si nada)',t.debo,'Ej.: 0')
      +'<div class="fr-sub" style="margin-top:8px"><b>💰 Tu nómina</b></div>'+inp('pg-nm','Monto de cada pago',n.monto,'Ej.: 1718861')+inp('pg-nd','Días del mes en que te llega',(n.dias||[]).join(', '),'Ej.: 15, 30','text')
      +'<div class="fr-chips"><button class="fr-go" data-a="pg-guardar">Guardar mis números</button></div>'
      +'<div class="fr-sub" style="margin-top:12px"><b>📅 Mis pagos fijos</b></div>';
    h+=c.pagos.length?c.pagos.map(function(p){ return '<div class="fr-it"><div><b>'+esc(p.nombre)+'</b> · '+pesos(p.monto)+'<div class="fr-sub">'+(p.frec==='unico'?'una vez · '+esc(p.fecha||''):'cada mes · día '+esc((p.dias||[]).join(' y ')))+(p.tarjeta?' · 💳 se puede con tarjeta':'')+(p.donde==='consultorio'?' · consultorio':'')+'</div></div><div style="display:flex;gap:4px"><button class="fr-x" data-a="pg-editar" data-id="'+esc(p.id)+'">Editar</button><button class="fr-x" data-a="pg-quitar" data-id="'+esc(p.id)+'">Quitar</button></div></div>'; }).join(''):'<div class="fr-sub">Todavía no hay ninguno.</div>';
    var ed=E.edit?c.pagos.filter(function(q){return String(q.id)===String(E.edit);})[0]:null; if(E.edit&&!ed) E.edit=null;
    h+='<div class="fr-card" id="pn-form" style="margin:10px 0 0;background:#fffafb"><b style="font-size:.85rem">'+(ed?'✏️ Editando: '+esc(ed.nombre):'＋ Agregar un pago')+'</b>'+inp('pn-nom','Nombre',ed?ed.nombre:'','Ej.: Arriendo, Internet, Netflix','text')+inp('pn-mon','Monto',ed?ed.monto:'','Ej.: 350000')
      +'<div class="fr-chips" style="margin:4px 0"><button class="fr-chip'+(E.pnFrec!=='unico'?' on':'')+'" data-a="pg-frec" data-v="mensual" style="min-height:40px;font-size:.84rem">Cada mes</button><button class="fr-chip'+(E.pnFrec==='unico'?' on':'')+'" data-a="pg-frec" data-v="unico" style="min-height:40px;font-size:.84rem">Una sola vez</button></div>'
      +(E.pnFrec==='unico'?'<div class="fr-f"><label>Fecha</label><input type="date" id="pn-fec" value="'+esc(ed&&ed.fecha||'')+'"></div>':inp('pn-dia','Día(s) del mes',ed&&ed.dias?ed.dias.join(', '):'','Ej.: 5   (o 15, 30)','text'))
      +'<label class="fr-ck"><input type="checkbox" id="pn-tar"'+(ed&&ed.tarjeta?' checked':'')+'> Se puede pagar con tarjeta (por ejemplo, débito automático)</label>'
      +'<div class="fr-chips" style="margin:4px 0"><button class="fr-chip'+(E.pnDonde!=='consultorio'?' on':'')+'" data-a="pg-donde" data-v="personal" style="min-height:40px;font-size:.84rem">🏠 Personal</button><button class="fr-chip'+(E.pnDonde==='consultorio'?' on':'')+'" data-a="pg-donde" data-v="consultorio" style="min-height:40px;font-size:.84rem">🏥 Consultorio</button></div>'
      +'<button class="fr-go" data-a="pg-agregar" style="margin-top:6px">'+(ed?'Guardar cambios':'Agregar pago')+'</button>'+(ed?' <button class="fr-chip" data-a="pg-cancelar" style="min-height:40px;font-size:.84rem">Cancelar</button>':'')+'</div></div>';
    return h;
  }
  window._frPagosHTML=function(htmlBase){
    var c=cfg(), plan=armarPlan(c);
    // se inserta después de la tarjeta de «Anota un movimiento»
    var cut=htmlBase.indexOf('<div class="fr-card"><h4>🏠 Personal');
    var bloque=htmlPagos(c,plan);
    return cut>0 ? htmlBase.slice(0,cut)+bloque+htmlBase.slice(cut) : htmlBase+bloque;
  };

  // ---- acciones ----
  function val(id){ var e=document.getElementById(id); return e?e.value.trim():''; }
  function guardarCfg(){
    var c=cfg(), dsp=val('pg-disp');
    if(dsp!==''){ var nd=num(dsp); if(String(nd)!==String(c.disp.monto)||!c.disp.ts){ c.disp={monto:nd,ts:Date.now()}; } } 
    var t=c.tarjeta; var cupo=num(val('pg-cupo')), corte=+val('pg-corte')||0, pago=+val('pg-pago')||0, debo=val('pg-debo');
    if(corte<0||corte>31||pago<0||pago>31){ A.toast('Los días van del 1 al 31'); return false; }
    var nuevoDebo = debo===''?(t.debo||0):num(debo);
    if(nuevoDebo!==(+t.debo||0) || !t.deboTs) t.deboTs=Date.now();
    t.cupo=cupo; t.corte=corte; t.pago=pago; t.debo=nuevoDebo;
    c.nomina={monto:num(val('pg-nm')), dias:dias(val('pg-nd')), desde:(c.nomina&&c.nomina.desde)||A.hoyLocal()};
    sv(c); A.toast('✅ Guardé tus números'); return true;
  }
  function agregarPago(){
    var nom=val('pn-nom'), mon=num(val('pn-mon')), frec=E.pnFrec==='unico'?'unico':'mensual';
    if(!nom||!mon){ A.toast('Escribe el nombre y el monto'); return; }
    var p={id:String(Date.now()),nombre:nom,monto:mon,frec:frec,donde:E.pnDonde==='consultorio'?'consultorio':'personal',tarjeta:!!(document.getElementById('pn-tar')||{}).checked};
    if(frec==='unico'){ p.fecha=val('pn-fec'); if(!parseY(p.fecha)){ A.toast('Elige la fecha'); return; } }
    else { p.dias=dias(val('pn-dia')); if(!p.dias.length){ A.toast('Escribe el día del mes (1 a 31)'); return; } }
    var c=cfg();
    if(E.edit){ var ix=-1; c.pagos.forEach(function(q,i){ if(String(q.id)===String(E.edit)) ix=i; });
      if(ix>=0){ p.id=c.pagos[ix].id; if(c.pagos[ix].categoria) p.categoria=c.pagos[ix].categoria; c.pagos[ix]=p; sv(c); E.edit=null; E.pnFrec='mensual'; E.pnDonde='personal'; A.toast('✅ Cambios guardados'); A.repintar(); return; } }
    c.pagos.push(p); sv(c); E.pnFrec='mensual'; A.toast('✅ Pago agregado'); A.repintar();
  }
  function pagar(i,medio){
    var c=cfg(), plan=armarPlan(c), it=plan.items[i]; if(!it) return;
    var hoyS=A.hoyLocal();
    if(it.p.donde==='consultorio'){
      if(typeof registros==='undefined'||typeof finGuardar!=='function'){ A.toast('No pude guardar en el Finanzas del consultorio'); return; }
      var cat=(it.p.categoria)||'Otro', reg={id:Date.now(),tipo:'gasto',descripcion:it.p.nombre,fecha:hoyS,monto:it.monto,categoria:cat};
      if(window.ROL_ACTUAL==='administrador' && typeof finEnviarARevision==='function') finEnviarARevision(reg); else { registros.push(reg); finGuardar(); try{ renderAll(); }catch(e){} }
    } else {
      var P=A.leerP(); P.push({id:String(Date.now()),fecha:hoyS,monto:it.monto,desc:it.p.nombre,medio:medio==='tarjeta'?'tarjeta':'efectivo'}); A.guardarP(P);
    }
    c.pagados[it.key]=true; sv(c); A.toast('✅ Pago anotado: '+it.p.nombre); A.repintar();
  }
  document.addEventListener('click',function(e){
    var b=e.target.closest&&e.target.closest('[data-a^="pg-"]'); var root=document.getElementById('fin-rapido'); var fl0=document.getElementById('fr-nom-flot'); if(!b||!((root&&root.contains(b))||(fl0&&fl0.contains(b)))) return;
    var a=b.getAttribute('data-a');
    if(a==='pg-editar'){ var c0=cfg(), q=c0.pagos.filter(function(x){return String(x.id)===b.getAttribute('data-id');})[0]; if(q){ E.edit=q.id; E.pnFrec=q.frec==='unico'?'unico':'mensual'; E.pnDonde=q.donde==='consultorio'?'consultorio':'personal'; E.cfg=true; A.repintar(); var fm=document.getElementById('pn-form'); if(fm&&fm.scrollIntoView) fm.scrollIntoView({block:'center'}); } }
    else if(a==='pg-cancelar'){ E.edit=null; E.pnFrec='mensual'; E.pnDonde='personal'; A.repintar(); }
    else if(a==='pg-todos'){ E.todos=!E.todos; A.repintar(); }
    else if(a==='pg-nomsi'){ nomSi(b.getAttribute('data-k'),b.getAttribute('data-inp')); }
    else if(a==='pg-nomno'){ nomOculto=true; var fl=document.getElementById('fr-nom-flot'); if(fl) fl.remove(); A.toast('Vale, te pregunto de nuevo la próxima vez que entres'); }
    else if(a==='pg-cfg'){ E.cfg=!E.cfg; A.repintar(); }
    else if(a==='pg-guardar'){ if(guardarCfg()) A.repintar(); }
    else if(a==='pg-agregar') agregarPago();
    else if(a==='pg-frec'){ E.pnFrec=b.getAttribute('data-v'); A.repintar(); }
    else if(a==='pg-donde'){ E.pnDonde=b.getAttribute('data-v'); A.repintar(); }
    else if(a==='pg-quitar'){ var id=b.getAttribute('data-id'), c=cfg(); c.pagos=c.pagos.filter(function(p){ return String(p.id)!==id; }); sv(c); A.repintar(); }
    else if(a==='pg-pagar') pagar(+b.getAttribute('data-i'), b.getAttribute('data-m'));
    else if(a==='pg-pt'){ E.pagandoTarjeta=true; A.repintar(); var f=document.getElementById('pg-pt'); if(f) f.focus(); }
    else if(a==='pg-ptok'){ var m=num(val('pg-pt')); if(!m){ A.toast('Escribe cuánto pagaste'); return; } var P=A.leerP(); P.push({id:String(Date.now()),tipo:'pagotarjeta',fecha:A.hoyLocal(),monto:m,desc:'Pago de la tarjeta'}); A.guardarP(P); E.pagandoTarjeta=false; A.toast('✅ Pago de tarjeta anotado'); A.repintar(); }
  },true);
  // estilos
  var st=document.createElement('style'); st.textContent='#fin-rapido .fr-pg{border-top:1px solid #f6e6ea;padding:10px 0}#fin-rapido .fr-pg:first-child{border-top:none}#fin-rapido .fr-sug{font-weight:700;color:#7a3c4b;margin-top:4px}#fin-rapido .fr-aviso{background:#fff3e6;border:1.5px solid #e8c9a0;border-radius:12px;padding:8px 10px;margin:8px 0;font-size:.85rem;color:#7a4a1c}#fin-rapido .fr-cfg{margin-top:10px;border-top:1px solid #f6e6ea;padding-top:10px}#fin-rapido .fr-f{display:flex;flex-direction:column;gap:3px;margin:6px 0}#fin-rapido .fr-f label{font-size:.74rem;color:#a0536a}#fin-rapido .fr-f input{font-size:16px;padding:10px 12px;border:1.5px solid #f0d8de;border-radius:12px;width:100%;box-sizing:border-box;font-family:inherit}#fin-rapido .fr-2{display:grid;grid-template-columns:1fr 1fr;gap:8px}#fin-rapido .fr-row{display:flex;gap:8px;margin-top:8px}#fin-rapido .fr-row input{flex:1;font-size:16px;padding:10px 12px;border:1.5px solid #f0d8de;border-radius:12px}#fin-rapido .fr-ck{display:flex;gap:8px;align-items:center;font-size:.85rem;margin:6px 0}#fin-rapido .fr-ck input{width:22px;height:22px}#fin-rapido .fr-chip[disabled]{opacity:.45}#fin-rapido .fr-nom,#fr-nom-flot .fr-nom{background:#fff8e6;border:1.5px solid #e8d49a;border-radius:14px;padding:10px;margin:0 0 10px}#fr-nom-flot{position:fixed;left:10px;right:10px;bottom:10px;z-index:9000;max-width:460px;margin:0 auto;box-shadow:0 6px 24px rgba(0,0,0,.2);border-radius:14px;background:#fff}#fr-nom-flot .fr-row{display:flex;gap:8px;margin-top:8px;flex-wrap:wrap}#fr-nom-flot .fr-row input{flex:1;min-width:0;font-size:16px;padding:10px 12px;border:1.5px solid #f0d8de;border-radius:12px}#fr-nom-flot .fr-go,#fin-rapido .fr-go{padding:10px 14px}#fr-nom-flot .fr-chip{border:1.5px solid #f0d8de;border-radius:20px;background:#fff;padding:6px 14px}#fr-nom-flot .fr-sub{font-size:.76rem;color:#a0536a;margin-top:4px}#fin-rapido .fr-it{gap:8px;min-width:0}#fin-rapido .fr-it>div:first-child{min-width:0;flex:1;overflow-wrap:anywhere}#fin-rapido .fr-row{flex-wrap:wrap}#fin-rapido .fr-row input{min-width:0}#fin-rapido .fr-go{max-width:100%}';
  document.head.appendChild(st);

  // ---- pagos en el Calendario (franja de «todo el día», arriba, como Google Calendar) ----
  window._frPagosRango=function(d0,d1){
    var c=cfg(), plan=armarPlan(c), mp={}, out=[];
    plan.items.forEach(function(it){ mp[it.key]=it; });
    c.pagos.forEach(function(p){
      var fs = p.frec==='unico' ? (parseY(p.fecha)?[parseY(p.fecha)]:[]) : ocurr(p.dias||[], d0, d1);
      fs.forEach(function(f){ if(f<d0||f>d1) return; var key=p.id+'|'+yy(f); if(c.pagados[key]) return;
        var it=mp[key], m=p.donde==='consultorio'?'consultorio':(it&&it.medio&&it.medio!=='?'?it.medio:'');
        out.push({ymd:yy(f),nombre:p.nombre||'Pago',monto:+p.monto||0,medio:m}); });
    });
    return out;
  };
  function chipPago(x){
    var ic=x.medio==='tarjeta'?'💳':x.medio==='efectivo'?'💵':x.medio==='consultorio'?'🏥':'📅';
    return '<div class="frp-chip" data-frp="1" title="'+esc(x.nombre+' · '+pesos(x.monto)+(x.medio==='tarjeta'?' · sugerido: tarjeta':x.medio==='efectivo'?' · sugerido: tu plata':''))+'">'+ic+' '+esc(x.nombre)+' '+pesos(x.monto)+'</div>';
  }
  function pagosEnCalendario(){
    try{
      var cont=document.getElementById('ag-container'); if(!cont) return;
      var c=cfg(); if(!c.pagos.length) return;
      var cols=cont.querySelectorAll('.agg-head .agg-dh'), celdas=cont.querySelectorAll('.agg-mes .agg-mc:not(.fuera)'), fechas=[];
      var F=(typeof agGFecha!=='undefined')?agGFecha:new Date();
      if(cols.length){
        if(cols.length===1) fechas=[new Date(F.getFullYear(),F.getMonth(),F.getDate())];
        else { var l=agGLunes(); for(var i=0;i<cols.length;i++) fechas.push(new Date(l.getFullYear(),l.getMonth(),l.getDate()+i)); }
        var pg=window._frPagosRango(fechas[0],fechas[fechas.length-1]);
        if(!pg.length) return;
        var head=cont.querySelector('.agg-head'); if(!head) return;
        var tpl=head.style.gridTemplateColumns||('56px repeat('+cols.length+',minmax(0,1fr))');
        var h='<div class="frp-row" style="grid-column:1/-1;display:grid;grid-template-columns:'+tpl+'"><div class="frp-lbl">pagos</div>';
        fechas.forEach(function(d){ var k=yy(d); h+='<div class="frp-cell">'+pg.filter(function(x){return x.ymd===k;}).map(chipPago).join('')+'</div>'; });
        var w=document.createElement('div'); w.innerHTML=h+'</div>'; head.appendChild(w.firstChild);
      } else if(celdas.length){
        var y=F.getFullYear(), m=F.getMonth(), pm=window._frPagosRango(new Date(y,m,1),new Date(y,m+1,0));
        celdas.forEach(function(cel,i){ var k=yy(new Date(y,m,i+1)), l=pm.filter(function(x){return x.ymd===k;}); if(!l.length) return;
          var n=cel.querySelector('.agg-mn'); var d=document.createElement('div'); d.innerHTML=l.map(chipPago).join(''); while(d.firstChild){ if(n&&n.nextSibling) cel.insertBefore(d.firstChild,n.nextSibling); else cel.appendChild(d.firstChild); } });
      }
    }catch(e){ console.warn('[pagos cal]',e); }
  }
  var oRH=window.agRenderHorario;
  if(typeof oRH==='function') window.agRenderHorario=function(){ var r=oRH.apply(this,arguments); pagosEnCalendario(); return r; };
  document.addEventListener('click',function(e){
    var b=e.target.closest&&e.target.closest('[data-frp]'); if(!b) return; e.stopPropagation();
    var t=document.querySelector('.ag-tab[data-tab="t-gastos"]'); if(t) t.click();
  },true);
  var st2=document.createElement('style'); st2.textContent='.frp-lbl{font-size:.6rem;color:#70757a;text-align:right;padding:3px 6px 0 0;align-self:start}.frp-cell{border-left:1px solid #e8eaed;padding:2px;min-width:0}.frp-row{border-top:1px solid #f1f3f4}.frp-chip{background:#ffe3b8;color:#5a3a00;border-radius:4px;font-size:.66rem;padding:2px 4px;margin:1px 0;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;cursor:pointer}.agg-mc .frp-chip{margin-bottom:2px}';
  document.head.appendChild(st2);
})();
