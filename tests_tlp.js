/* Tests de TLP para el módulo «Tests de Evaluación» (sin tocar main.js)
   1) MSI-BPD · McLean Screening Instrument for BPD (Zanarini et al., 2003). Versión española validada: Soler et al., Rev Psiquiatr Salud Ment 2016;9:195-202 (periodo «durante este último año», sí=1/no=0, corte 7). Los ítems están traducidos fieles al original en inglés; contrástalos con el Anexo 1 de Soler et al. 2016.
   2) Criterios DSM-5-TR de TLP: lista que marca la psicóloga (9 criterios; el umbral es 5 o más).
   Son ayudas para la entrevista clínica. NO diagnostican. */
(function(){
  'use strict';
  var MSI=[
    '¿Alguna de tus relaciones más cercanas se ha visto afectada por muchas discusiones o por rupturas repetidas?',
    '¿Te has hecho daño físico a propósito (por ejemplo, golpeándote, cortándote, quemándote)? ¿Y has hecho algún intento de suicidio?',
    '¿Has tenido al menos otros dos problemas de impulsividad (por ejemplo, atracones de comida y gastos descontrolados, beber demasiado y arrebatos verbales)?',
    '¿Has estado extremadamente malhumorado/a?',
    '¿Te has sentido muy enfadado/a la mayor parte del tiempo? ¿Has actuado con frecuencia de forma furiosa o sarcástica?',
    '¿Has desconfiado a menudo de otras personas?',
    '¿Te has sentido con frecuencia irreal, o como si las cosas a tu alrededor no fueran reales?',
    '¿Te has sentido vacío/a de forma crónica?',
    '¿Has sentido a menudo que no sabes quién eres o que no tienes identidad?',
    '¿Has hecho esfuerzos desesperados para evitar sentirte abandonado/a o ser abandonado/a (por ejemplo, llamar repetidamente a alguien para asegurarte de que le importas, rogarle que no te deje, aferrarte físicamente a esa persona)?'
  ];

  var DSM=[
    'Esfuerzos desesperados por evitar un abandono real o imaginado (no incluye conductas suicidas o autolesivas del criterio 5).',
    'Relaciones interpersonales inestables e intensas, que alternan entre idealización y devaluación extremas.',
    'Alteración de la identidad: autoimagen o sentido de sí mismo marcada y persistentemente inestable.',
    'Impulsividad en al menos dos áreas potencialmente dañinas para sí (gastos, sexo, abuso de sustancias, conducción imprudente, atracones). No incluye conductas suicidas o autolesivas.',
    'Comportamiento, actitud o amenazas suicidas recurrentes, o conducta autolesiva.',
    'Inestabilidad afectiva por una marcada reactividad del ánimo (disforia, irritabilidad o ansiedad episódicas; suelen durar horas y rara vez más de unos días).',
    'Sensación crónica de vacío.',
    'Ira inapropiada e intensa, o dificultad para controlarla.',
    'Ideación paranoide transitoria relacionada con el estrés, o síntomas disociativos graves.'
  ];
  var SEG='<div style="background:#fff3e6;border:1.5px solid #e8c9a0;border-radius:10px;padding:10px 12px;margin-top:12px;font-size:.84rem;color:#7a4a1c"><b>⚠️ Explorar riesgo.</b> Hay respuesta positiva en autolesión o conducta suicida. Indaga ideación, plan e intención actuales y sigue tu protocolo de riesgo. En Colombia: línea 106 o urgencias.</div>';
  function esc(s){ return String(s).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];}); }
  function nota(t){ return '<p style="font-size:.78rem;color:var(--strong);margin-top:12px;line-height:1.5">'+t+'</p>'; }

  function pintarMSI(c){
    c.innerHTML='<div class="card"><div class="sec-title">MSI-BPD · Tamizaje de TLP (McLean)</div>'
      +'<p style="font-size:.82rem;color:var(--border);margin-bottom:6px"><b>Durante este último año:</b> 10 preguntas de sí/no. Es un tamizaje, no un diagnóstico.</p>'
      +MSI.map(function(q,i){ return '<div class="test-question"><p><strong>'+(i+1)+'.</strong> '+esc(q)+'</p><div class="likert"><label><input type="radio" name="msi'+i+'" value="1"> Sí</label><label><input type="radio" name="msi'+i+'" value="0"> No</label></div></div>'; }).join('')
      +'<div class="btn-row"><button class="btn primary" onclick="calcMSIBPD()">Calcular Resultado</button></div></div>';
  }
  function pintarDSM(c){
    c.innerHTML='<div class="card"><div class="sec-title">Criterios DSM-5-TR · Trastorno límite de la personalidad</div>'
      +'<p style="font-size:.82rem;color:var(--border);margin-bottom:6px">Lista para la psicóloga: marca los criterios que observas como patrón persistente (desde la adolescencia o adultez temprana y en distintos contextos).</p>'
      +DSM.map(function(q,i){ return '<div class="test-question"><label style="display:flex;gap:10px;align-items:flex-start;cursor:pointer"><input type="checkbox" name="dsmtlp" value="'+i+'" style="margin-top:4px;width:20px;height:20px"> <span><strong>'+(i+1)+'.</strong> '+esc(q)+'</span></label></div>'; }).join('')
      +'<div class="btn-row"><button class="btn primary" onclick="calcDSMTLP()">Calcular Resultado</button></div></div>';
  }
  window.calcMSIBPD=function(){
    var t=0, falta=false, r2=false;
    MSI.forEach(function(_,i){ var r=document.querySelector('input[name="msi'+i+'"]:checked'); if(!r) falta=true; else { t+=parseInt(r.value,10); if(i===1&&r.value==='1') r2=true; } });
    if(falta){ toast('Responde todas las preguntas'); return; }
    var pos=t>=7, color=pos?'#ff9800':'#4caf50', sev=pos?'Tamizaje positivo (7 o más): conviene evaluar con entrevista clínica':'Tamizaje negativo (menos de 7)';
    showTestResult('MSI-BPD · Resultados','<div style="text-align:center;padding:20px 0"><div style="font-size:3rem;font-family:Playfair Display,serif;color:'+color+'">'+t+'</div><div style="font-size:.8rem;color:var(--strong);text-transform:uppercase;letter-spacing:1px">de 10 puntos</div><div style="margin-top:10px;font-size:1.05rem;font-weight:700;color:'+color+'">'+sev+'</div></div><div class="result-bar"><div class="result-bar-fill" style="width:'+(t/10*100)+'%;background:'+color+'"></div></div>'
      +nota('Periodo evaluado: último año. Punto de corte 7 (versión española, Soler et al., 2016: sensibilidad 0,71 y especificidad 0,68 frente a la entrevista DIB-R). Con esa sensibilidad, un resultado bajo <b>no descarta</b> TLP, y uno alto <b>no lo confirma</b>: el diagnóstico sale de la entrevista clínica (DSM-5-TR / CIE-11) y de descartar otras explicaciones.')+(r2?SEG:''),
      {score:t,severity:sev,test:'MSI-BPD',date:new Date().toISOString()});
  };
  window.calcDSMTLP=function(){
    var m=[].slice.call(document.querySelectorAll('input[name="dsmtlp"]:checked')).map(function(x){return +x.value;}), n=m.length, ok=n>=5, color=ok?'#ff9800':'#4caf50',
        sev=ok?'Cumple el umbral numérico (5 o más de 9)':'No alcanza el umbral numérico (menos de 5)';
    showTestResult('Criterios DSM-5-TR TLP · Resultados','<div style="text-align:center;padding:20px 0"><div style="font-size:3rem;font-family:Playfair Display,serif;color:'+color+'">'+n+'</div><div style="font-size:.8rem;color:var(--strong);text-transform:uppercase;letter-spacing:1px">de 9 criterios</div><div style="margin-top:10px;font-size:1.05rem;font-weight:700;color:'+color+'">'+sev+'</div></div><div class="result-bar"><div class="result-bar-fill" style="width:'+(n/9*100)+'%;background:'+color+'"></div></div>'
      +'<div style="margin-top:12px;font-size:.84rem;line-height:1.5"><b>Criterios marcados:</b>'+(n?'<ul style="margin:6px 0 0 18px">'+m.map(function(i){return '<li>'+(i+1)+'. '+esc(DSM[i])+'</li>';}).join('')+'</ul>':' ninguno')+'</div>'
      +nota('El DSM-5-TR pide 5 o más criterios dentro de un patrón generalizado que empieza en la adolescencia o adultez temprana. Esta lista es un apoyo: el diagnóstico es clínico y exige descartar otras causas (p. ej., trastornos del ánimo, TEPT complejo, consumo de sustancias, condición médica).')+(m.indexOf(4)>=0?SEG:''),
      {score:n,severity:sev,test:'Criterios DSM-5-TR TLP',date:new Date().toISOString()});
  };

  function montar(){
    var sel=document.getElementById('tst-sel'); if(!sel||typeof window.loadTest!=='function') return false;
    if(!sel.querySelector('option[value="msibpd"]')){
      [['msibpd','MSI-BPD (Tamizaje TLP)'],['dsmtlp','Criterios DSM-5-TR TLP (clínica)']].forEach(function(o){ var op=document.createElement('option'); op.value=o[0]; op.textContent=o[1]; sel.appendChild(op); });
    }
    if(!window.loadTest._tlp){
      var o=window.loadTest;
      window.loadTest=function(){
        var s=document.getElementById('tst-sel'), t=s&&s.value;
        if(t==='msibpd'||t==='dsmtlp'){ var c=document.getElementById('test-container'); document.getElementById('test-resultados').style.display='none'; (t==='msibpd'?pintarMSI:pintarDSM)(c); return; }
        return o.apply(this,arguments);
      };
      window.loadTest._tlp=true;
    }
    return true;
  }
  var n=0, iv=setInterval(function(){ if(montar()||++n>40) clearInterval(iv); },250);
})();
