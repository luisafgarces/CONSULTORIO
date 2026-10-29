/* 1) C-SSRS · Columbia-Escala de Severidad Suicida (versión de pesquisa/«screener», pauta Chile con puntos para triage,
      Posner et al. 2008; revisada para Chile por Martínez 2017). Ayuda para la entrevista: NO predice ni reemplaza el juicio clínico.
   2) YSQ: en cada esquema se pueden anotar los números de los ítems que puntuaron 6 y 5; se muestran en el perfil de esquemas.
   Sin tocar main.js. */
(function(){
  'use strict';
  function esc(s){ return String(s).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];}); }
  function nota(t){ return '<p style="font-size:.78rem;color:var(--strong);margin-top:12px;line-height:1.5">'+t+'</p>'; }
  function rad(n,v,txt){ return '<label><input type="radio" name="'+n+'" value="'+v+'"> '+txt+'</label>'; }
  function val(n){ var r=document.querySelector('input[name="'+n+'"]:checked'); return r?r.value:''; }

  var Q=[
    ['¿Has deseado estar muerto(a) o poder dormirte y no despertar?','La persona confirma que ha tenido ideas relacionadas con el deseo de estar muerta o de no seguir viviendo, o el deseo de quedarse dormida y no despertar.'],
    ['¿Has tenido realmente la idea de suicidarte?','Pensamientos generales y no específicos de poner fin a su vida (por ejemplo, «He pensado en suicidarme»), sin ideas sobre cómo (métodos, intención o plan).'],
    ['¿Has pensado en cómo llevarías esto a cabo?','Ha tenido ideas suicidas y ha pensado en al menos un método, sin un plan específico de hora, lugar o método.'],
    ['¿Has tenido estas ideas y en cierto grado la intención de llevarlas a cabo?','Ideas suicidas activas y cierta intención de llevarlas a cabo (a diferencia de «tengo los pensamientos, pero definitivamente no haré nada al respecto»).'],
    ['¿Has comenzado a elaborar o has elaborado los detalles sobre cómo suicidarte? ¿Tienes intenciones de llevar a cabo este plan?','Ideas suicidas con detalles del plan parcial o totalmente elaborados y cierta intención de llevarlo a cabo.']
  ];
  var P6='¿Alguna vez has hecho algo, comenzado a hacer algo o te has preparado para hacer algo para terminar con tu vida?';
  var P6D='Conducta suicida. Ejemplos: ¿has juntado medicamentos, obtenido un arma, regalado cosas de valor, escrito un testamento o una carta de suicidio?; ¿has sacado pastillas del frasco sin tragarlas, agarrado un arma y cambiado de idea o alguien te la quitó, subido al techo sin saltar?; o ¿realmente has tomado pastillas, tratado de dispararte, cortado con intención suicida, tratado de colgarte, etc.?';

  function bloque(i){ var q=Q[i];
    return '<div class="test-question" id="cs-b'+i+'"><p><strong>'+(i+1)+'.</strong> '+esc(q[0])+'</p><p style="font-size:.78rem;color:var(--strong);margin:2px 0 6px">'+esc(q[1])+'</p><div class="likert">'+rad('cs'+i,'1','Sí')+rad('cs'+i,'0','No')+'</div></div>';
  }
  function pintarCSSRS(c){
    c.innerHTML='<div class="card"><div class="sec-title">C-SSRS · Escala de Severidad Suicida (pesquisa)</div>'
      +'<p style="font-size:.82rem;color:var(--border);margin-bottom:6px"><b>Preguntas 1 a 5: último mes.</b> Pregunta 6: alguna vez en la vida y, si es sí, si fue en los últimos 3 meses. Es una ayuda para la entrevista; no reemplaza el juicio clínico.</p>'
      +bloque(0)+bloque(1)
      +'<div id="cs-mas" style="display:none"><p style="font-size:.8rem;color:var(--strong);margin:8px 0 0">Respondió «Sí» a la pregunta 2: formula las preguntas 3, 4 y 5.</p>'+bloque(2)+bloque(3)+bloque(4)+'</div>'
      +'<div class="test-question"><p><strong>6.</strong> '+esc(P6)+'</p><p style="font-size:.78rem;color:var(--strong);margin:2px 0 6px">'+esc(P6D)+'</p><div class="likert">'+rad('cs5','1','Sí')+rad('cs5','0','No')+'</div>'
      +'<div id="cs-3m" style="display:none;margin-top:6px"><p style="font-size:.84rem"><b>¿Fue dentro de los últimos 3 meses?</b></p><div class="likert">'+rad('cs5m','1','Sí, en los últimos 3 meses')+rad('cs5m','0','No, fue hace más de 3 meses')+'</div></div></div>'
      +'<div class="btn-row"><button class="btn primary" onclick="calcCSSRS()">Calcular Resultado</button></div></div>';
    function ver(){ document.getElementById('cs-mas').style.display=(val('cs1')==='1')?'block':'none'; document.getElementById('cs-3m').style.display=(val('cs5')==='1')?'block':'none'; }
    c.querySelectorAll('input[type=radio]').forEach(function(r){ r.addEventListener('change',ver); });
  }

  window.calcCSSRS=function(){
    var a=[val('cs0'),val('cs1')], masVisible=(a[1]==='1'), falta=(a[0]===''||a[1]===''||val('cs5')===''||(val('cs5')==='1'&&val('cs5m')===''));
    var it=[a[0]==='1',a[1]==='1',false,false,false];
    if(masVisible){ for(var i=2;i<5;i++){ var v=val('cs'+i); if(v==='') falta=true; it[i]=(v==='1'); } }
    if(falta){ toast('Responde todas las preguntas que se muestran'); return; }
    var c6=(val('cs5')==='1'), c63=(c6&&val('cs5m')==='1'), c6mas=(c6&&!c63);
    var nivel, color, sev, acc;
    if(it[3]||it[4]||c63){
      nivel='Alto'; color='#b71c1c'; sev='Riesgo alto (ítem 4, 5 o conducta en los últimos 3 meses)';
      acc='Evaluación presencial dentro de las 24 horas siguientes y derivación o enlace con atención primaria para una evaluación integral de salud mental. Si el riesgo es severo o extremo (ideación frecuente, intensa, duradera y con plan definido; síntomas severos; autocontrol deteriorado; desesperanza severa; medio protector ausente o inseguro), derivar al servicio de urgencias más cercano. Aplicar medidas de precaución para el riesgo suicida.';
    } else if(it[2]||c6mas){
      nivel='Moderado'; color='#ef6c00'; sev='Riesgo moderado (ítem 3, o conducta suicida hace más de 3 meses)';
      acc='Cita presencial lo antes posible y derivación o enlace con atención primaria para una evaluación integral de salud mental si es necesario. Considerar medidas de precaución para el riesgo suicida.';
    } else if(it[0]||it[1]){
      nivel='Bajo'; color='#f9a825'; sev='Riesgo bajo (ítem 1 o 2)';
      acc='Derivar a atención de salud mental para evaluación y formulación de riesgos.';
    } else { nivel='Sin ideación'; color='#4caf50'; sev='Sin ideación ni conducta suicida referida en esta pesquisa'; acc='Sin acciones de triage. Mantener la observación clínica y repetir la pesquisa si cambia el cuadro.'; }
    var resp=Q.map(function(q,i){ var vis=(i<2)||masVisible; return '<tr><td style="padding:3px 8px 3px 0">'+(i+1)+'. '+esc(q[0]).slice(0,70)+(q[0].length>70?'…':'')+'</td><td style="padding:3px 0"><b>'+(vis?(it[i]?'Sí':'No'):'No se pregunta')+'</b></td></tr>'; }).join('')
      +'<tr><td style="padding:3px 8px 3px 0">6. Conducta suicida alguna vez</td><td><b>'+(c6?(c63?'Sí (últimos 3 meses)':'Sí (hace más de 3 meses)'):'No')+'</b></td></tr>';
    showTestResult('C-SSRS · Resultados',
      '<div style="text-align:center;padding:16px 0"><div style="font-size:1.8rem;font-family:Playfair Display,serif;color:'+color+';font-weight:700">'+esc(nivel)+'</div><div style="margin-top:8px;font-size:1rem;font-weight:700;color:'+color+'">'+esc(sev)+'</div></div>'
      +'<div style="font-size:.86rem;line-height:1.5"><b>Qué hacer según la pauta:</b> '+esc(acc)+'</div>'
      +'<table style="font-size:.82rem;margin-top:12px;border-collapse:collapse">'+resp+'</table>'
      +'<div style="background:#fdecea;border:1.5px solid #e57373;border-radius:10px;padding:10px 12px;margin-top:12px;font-size:.84rem;color:#7a2f2f"><b>Línea de ayuda inmediata en Colombia: 106.</b> Si hay peligro inminente, urgencias o la línea 123. No dejes a la persona sola mientras se coordina la ayuda.</div>'
      +nota('Pesquisa breve basada en la C-SSRS (Posner et al., 2008), pauta de triage de la versión para Chile (revisada por Martínez, 2017). No predice conducta suicida ni reemplaza la entrevista clínica y la formulación del riesgo. Registra la evaluación y los factores de riesgo y protectores en la nota de sesión.'),
      {score:nivel,severity:sev,test:'C-SSRS',items:{p1:it[0],p2:it[1],p3:masVisible?it[2]:null,p4:masVisible?it[3]:null,p5:masVisible?it[4]:null,p6:c6,p6_3meses:c63},date:new Date().toISOString()});
  };

  /* ---------- YSQ: ítems con 6 y con 5 por esquema ---------- */
  function nums(txt){ var m=String(txt||'').match(/\d+/g)||[], out=[]; m.forEach(function(x){ x=+x; if(x>=1&&x<=232&&out.indexOf(x)<0) out.push(x); }); return out.sort(function(a,b){return a-b;}); }
  function aumentarYSQ(){
    var c=document.getElementById('test-container'); if(!c) return;
    var intro=c.querySelector('p'); 
    if(intro&&!c.querySelector('.ysq-items-nota')){ var n=document.createElement('p'); n.className='ysq-items-nota'; n.style.cssText='font-size:.8rem;color:var(--strong);margin-bottom:14px'; n.textContent='Opcional: en cada esquema escribe los números de los ítems del cuestionario que puntuaron 6 y 5 (separados por coma). Aparecerán en los resultados. Con 5 o 6 un ítem suele leerse como clínicamente relevante.'; intro.parentNode.insertBefore(n,intro.nextSibling); }
    c.querySelectorAll('input[id^="ysq_"]').forEach(function(inp){
      var i=inp.id.slice(4); if(document.getElementById('ysq6_'+i)) return;
      var box=inp.closest('.fg')||inp.parentNode, d=document.createElement('div'); d.className='fg';
      d.innerHTML='<label class="lbl">Ítems que puntuaron 6 (números)</label><input type="text" id="ysq6_'+i+'" placeholder="Ej.: 12, 47, 103" inputmode="numeric" style="width:100%"><label class="lbl" style="margin-top:6px">Ítems que puntuaron 5 (números)</label><input type="text" id="ysq5_'+i+'" placeholder="Ej.: 5, 60" inputmode="numeric" style="width:100%">';
      box.parentNode.insertBefore(d,box.nextSibling);
    });
  }
  window.calcYSQ=function(){
    var schemas=Object.keys(YSQ_DOMAINS).reduce(function(a,k){ return a.concat(YSQ_DOMAINS[k]); },[]), err='';
    var results=schemas.map(function(s,i){
      var v=parseFloat((document.getElementById('ysq_'+i)||{}).value)||0, i6=nums((document.getElementById('ysq6_'+i)||{}).value), i5=nums((document.getElementById('ysq5_'+i)||{}).value);
      var dup=i6.filter(function(x){return i5.indexOf(x)>=0;}); if(dup.length&&!err) err='En «'+s+'» el ítem '+dup[0]+' está en 6 y en 5.';
      return {name:s,val:v,items6:i6,items5:i5};
    });
    if(err){ toast(err); return; }
    var sorted=results.slice().sort(function(a,b){return b.val-a.val;}), tot=0;
    results.forEach(function(r){ tot+=r.items6.length+r.items5.length; });
    var html='<p style="font-size:.82rem;color:var(--strong);margin-bottom:16px">Esquemas ordenados por intensidad (1=mínima, 6=máxima):</p>'
      +sorted.map(function(r){
        var it=(r.items6.length||r.items5.length)?'<p style="font-size:.8rem;margin-top:6px;line-height:1.5">'+(r.items6.length?'<b>Ítems con 6 ('+r.items6.length+'):</b> '+r.items6.join(', ')+'<br>':'')+(r.items5.length?'<b>Ítems con 5 ('+r.items5.length+'):</b> '+r.items5.join(', '):'')+'</p>':'';
        return '<div class="result-schema"><h4>'+esc(r.name)+'</h4><div class="result-bar"><div class="result-bar-fill" style="width:'+(r.val?((r.val-1)/5*100).toFixed(0):0)+'%"></div></div>'
          +'<p style="font-size:.78rem;color:var(--strong)">'+r.val.toFixed(1)+'/6 · '+(r.val>=4.5?'Alta activación':r.val>=3?'Activación moderada':'Baja activación')+'</p>'+it+'</div>'; }).join('')
      +(tot?'<p style="font-size:.78rem;color:var(--strong);margin-top:10px">Total de ítems anotados con 5 o 6: <b>'+tot+'</b>.</p>':'<p style="font-size:.78rem;color:var(--strong);margin-top:10px">No anotaste ítems con 5 o 6.</p>');
    showTestResult('YSQ · Perfil de Esquemas',html,{schemas:results,test:'YSQ',date:new Date().toISOString()});
  };

  function montar(){
    var sel=document.getElementById('tst-sel'); if(!sel||typeof window.loadTest!=='function') return false;
    if(!sel.querySelector('option[value="cssrs"]')){ var op=document.createElement('option'); op.value='cssrs'; op.textContent='C-SSRS (Riesgo suicida · pesquisa)'; sel.appendChild(op); }
    if(!window.loadTest._cs){
      var o=window.loadTest;
      window.loadTest=function(){
        var s=document.getElementById('tst-sel'), t=s&&s.value;
        if(t==='cssrs'){ document.getElementById('test-resultados').style.display='none'; pintarCSSRS(document.getElementById('test-container')); return; }
        var r=o.apply(this,arguments); if(t==='ysq') aumentarYSQ(); return r;
      };
      window.loadTest._cs=true;
    }
    return true;
  }
  var n=0, iv=setInterval(function(){ if(montar()||++n>40) clearInterval(iv); },250);
})();
