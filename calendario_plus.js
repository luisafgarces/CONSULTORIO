/* ===========================================================================
   Calendario PLUS — ajustes al calendario que ya existe (no lo reemplaza):
   · Desplazamiento (ir / volver) en cada compromiso, visible en el calendario
   · Alertas con más opciones
   · Espacios libres del día + aviso de cruces
   · Compromisos fijos vs. bloques de tarea (vinculados a la tarea, sin duplicar)
   · Botón "Crear tarea relacionada" y reprogramar bloque sin duplicar
   · Área "Hospital", abrir primero en el día de hoy, textos de botones
   Todo se engancha con las funciones existentes; si algo falla, el calendario
   sigue funcionando como antes.
   =========================================================================== */
(function(){
  if(window.__agxInit) return; window.__agxInit = true;
  var $ = function(id){ return document.getElementById(id); };
  function esc(s){ return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
  function p2(n){ return String(n).padStart(2,'0'); }
  function num(v){ v = parseInt(v,10); return (isNaN(v)||v<0) ? 0 : v; }
  function safe(fn){ return function(){ try { return fn.apply(this, arguments); } catch(e){ console.warn('[calendario-plus]', e); } }; }

  var VIAJE = [0,10,15,20,30,45,60,90,120];
  var ALARMAS = [[0,'Sin alarma'],[5,'5 minutos antes'],[10,'10 minutos antes'],[15,'15 minutos antes'],[30,'30 minutos antes'],[60,'1 hora antes'],[120,'2 horas antes'],[1440,'1 día antes'],[2880,'2 días antes']];

  // ---------- estilos ----------
  function estilo(){
    if($('agx-style')) return;
    var s = document.createElement('style'); s.id = 'agx-style';
    s.textContent = [
'.agx-viaje-btn{border:1.5px dashed #cd8e9d;background:#fff;color:#7a3c4b;border-radius:10px;padding:8px 12px;font-size:.82rem;cursor:pointer;margin:2px 0 8px}',
'.agx-viaje-box{display:none;background:#fdf5f7;border-radius:10px;padding:10px;margin-bottom:10px}',
'.agx-viaje-box.open{display:block}',
'.agx-viaje-box .agx-2{display:grid;grid-template-columns:1fr 1fr;gap:10px}',
'.agx-viaje-box label{display:block;font-size:.72rem;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:#a0536a;margin-bottom:3px}',
'.agx-viaje-box select{width:100%;box-sizing:border-box;padding:8px;border:1.5px solid #ecd3d9;border-radius:8px;font-size:.9rem;background:#fff}',
'.agx-viaje-box small{display:block;color:#8a7279;margin-top:6px;font-size:.72rem}',
'.agx-panel{background:#f6f8ff;border:1.5px solid #d6dcf5;border-radius:10px;padding:10px 12px;margin-bottom:12px;font-size:.84rem;color:#3c4160}',
'.agx-panel b{color:#2b3052}',
'.agx-panel .agx-row{display:flex;gap:6px;flex-wrap:wrap;margin-top:8px}',
'.agx-mini{border:1.5px solid #cdd3ee;background:#fff;color:#3c4160;border-radius:14px;padding:6px 11px;font-size:.78rem;cursor:pointer}',
'.agx-mini.pri{background:#cd8e9d;border-color:#cd8e9d;color:#fff}',
'.agx-rel{margin-bottom:12px}',
'.agx-rel-item{display:flex;gap:8px;align-items:center;font-size:.84rem;padding:4px 0;color:#4a3a3f}',
'.agg-viaje,.agx-viaje{position:absolute;box-sizing:border-box;pointer-events:none;border-radius:6px;background:repeating-linear-gradient(45deg,rgba(0,0,0,.10) 0 5px,rgba(0,0,0,.03) 5px 10px);border:1px dashed rgba(0,0,0,.28);font-size:.62rem;color:#555;padding:0 4px;overflow:hidden;line-height:1.4}',
'.agg-ev.agx-bloque{border:2px dashed rgba(255,255,255,.95);opacity:.88;box-shadow:none}',
'.agg-ev.agx-choque{outline:2px solid #d93025;outline-offset:1px}',
'.agx-libres{background:#fff;border:1.5px solid #f1dde2;border-radius:12px;padding:8px 12px;margin:0 0 10px;font-size:.8rem;color:#5b4549}',
'.agx-libres b{color:#7a3c4b}',
'.agx-libres .agx-g{display:inline-block;background:#eaf6ee;border:1px solid #bfe0c6;color:#2d6a3e;border-radius:12px;padding:2px 9px;margin:3px 5px 0 0;font-size:.76rem}',
'.agx-libres .agx-leg{display:block;margin-top:6px;color:#8a7279;font-size:.72rem}',
'.agx-bg{position:fixed;inset:0;background:rgba(40,25,30,.45);z-index:10050;display:flex;align-items:center;justify-content:center;padding:14px}',
'.agx-modal{background:#fff;border-radius:16px;width:100%;max-width:400px;padding:18px;box-shadow:0 8px 28px rgba(0,0,0,.25);font-family:Lato,Arial,sans-serif;color:#4a3a3f}',
'.agx-modal h3{margin:0 0 12px;font-family:"Playfair Display",serif;font-size:1.05rem;color:#7a3c4b}',
'.agx-modal .agx-f{margin-bottom:10px}',
'.agx-modal label{display:block;font-size:.72rem;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:#a0536a;margin-bottom:3px}',
'.agx-modal input,.agx-modal select{width:100%;box-sizing:border-box;padding:9px;border:1.5px solid #ecd3d9;border-radius:8px;font-size:.92rem;font-family:inherit}',
'.agx-modal .agx-2{display:grid;grid-template-columns:1fr 1fr;gap:10px}',
'.agx-modal .agx-acc{display:flex;gap:8px;justify-content:flex-end;margin-top:14px}',
'.agx-modal .agx-acc button{border-radius:10px;padding:10px 16px;font-size:.9rem;cursor:pointer;border:none;background:none;color:#7a6a6f}',
'.agx-modal .agx-acc button.pri{background:#cd8e9d;color:#fff;font-weight:700}'
    ].join('\n');
    document.head.appendChild(s);
  }

  // ---------- datos de tareas (comparten la misma información) ----------
  function getTareas(){ var v = DB.get('tareas'); return Array.isArray(v) ? v : []; }
  function setTareas(a){ DB.set('tareas', a); }
  function tareaPorId(id){ return getTareas().filter(function(t){ return t.id===id; })[0]; }
  function evPorId(id){ return agEventos.filter(function(e){ return e.id===id; })[0]; }
  function finEv(e){
    var ini = new Date(e.inicio), fin = e.fin ? new Date(e.fin) : null;
    if(!fin || isNaN(fin) || fin<=ini) fin = new Date(ini.getTime()+50*60000);
    return fin;
  }
  function durTxt(min){ var h = Math.floor(min/60), m = min%60; return (h?h+' h':'')+(h&&m?' ':'')+(m?m+' min':'') || '0 min'; }
  function guardarAg(){ agGuardar(); renderAgenda(); }

  // ---------- selects (alarmas y desplazamiento) ----------
  function reconstruirAlarma(sel){
    if(!sel) return;
    var v = sel.value;
    sel.innerHTML = ALARMAS.map(function(a){ return '<option value="'+a[0]+'">'+a[1]+'</option>'; }).join('');
    if(v!=='' && ALARMAS.some(function(a){ return String(a[0])===v; })) sel.value = v;
  }
  function opcionesViaje(){ return VIAJE.map(function(m){ return '<option value="'+m+'">'+(m?m+' min':'— No —')+'</option>'; }).join(''); }
  function viajeHTML(pref){
    return '<button type="button" class="agx-viaje-btn" id="'+pref+'-btn">🚗 Añadir tiempo de desplazamiento</button>'
      + '<div class="agx-viaje-box" id="'+pref+'-box"><div class="agx-2">'
      + '<div><label>Ir (antes)</label><select id="'+pref+'-va">'+opcionesViaje()+'</select></div>'
      + '<div><label>Volver (después)</label><select id="'+pref+'-vd">'+opcionesViaje()+'</select></div></div>'
      + '<small>Se ve rayado en el calendario y avisa si se cruza con otra cosa.</small></div>';
  }
  function ligarViaje(pref){
    var b = $(pref+'-btn'); if(!b || b.dataset.ok) return; b.dataset.ok = '1';
    b.onclick = function(){
      var box = $(pref+'-box'), abrir = !box.classList.contains('open');
      box.classList.toggle('open', abrir);
      if(abrir && !num($(pref+'-va').value) && !num($(pref+'-vd').value)){ $(pref+'-va').value = '30'; $(pref+'-vd').value = '30'; }
      if(!abrir){ $(pref+'-va').value = '0'; $(pref+'-vd').value = '0'; }
      b.textContent = abrir ? '🚗 Quitar desplazamiento' : '🚗 Añadir tiempo de desplazamiento';
    };
  }
  function setViaje(pref, va, vd){
    $(pref+'-va').value = String(num(va)); $(pref+'-vd').value = String(num(vd));
    if(!$(pref+'-va').value) $(pref+'-va').value = '0'; if(!$(pref+'-vd').value) $(pref+'-vd').value = '0';
    var abierto = num(va)>0 || num(vd)>0;
    $(pref+'-box').classList.toggle('open', abierto);
    $(pref+'-btn').textContent = abierto ? '🚗 Quitar desplazamiento' : '🚗 Añadir tiempo de desplazamiento';
  }
  function leerViaje(pref){ var a=$(pref+'-va'), d=$(pref+'-vd'); return a ? {va:num(a.value), vd:num(d.value)} : {va:0, vd:0}; }

  // ---------- cruces (con desplazamiento) ----------
  function intervalo(ini, fin, va, vd){ return [ini.getTime()-num(va)*60000, fin.getTime()+num(vd)*60000]; }
  function choques(iniISO, finISO, va, vd, ignorarId){
    var ini = new Date(iniISO), fin = finISO ? new Date(finISO) : new Date(ini.getTime()+50*60000);
    if(isNaN(ini)) return [];
    if(isNaN(fin) || fin<=ini) fin = new Date(ini.getTime()+50*60000);
    var a = intervalo(ini, fin, va, vd);
    return agEventos.filter(function(e){
      if(e.id===ignorarId || !e.inicio) return false;
      var b = intervalo(new Date(e.inicio), finEv(e), e.viajeAntes, e.viajeDespues);
      return a[0] < b[1] && b[0] < a[1];
    });
  }
  function avisoChoques(lista){
    if(!lista.length) return;
    toast('⚠️ Con el desplazamiento se cruza con: '+lista.slice(0,2).map(function(e){ return e.titulo; }).join(', ')+(lista.length>2?'…':''));
  }

  // ---------- NUEVO compromiso (modal flotante) ----------
  var oAbrirModal = window.agGAbrirModal;
  window.agGAbrirModal = function(inicioISO){
    window._agxNuevo = null;
    var r = oAbrirModal.apply(this, arguments);
    try {
      estilo();
      var m = $('agg-modal'); if(!m || $('aggm-btn')) return r;
      var acc = m.querySelector('.agg-acc'); if(!acc) return r;
      var d = document.createElement('div'); d.innerHTML = viajeHTML('aggm');
      while(d.firstChild) acc.parentNode.insertBefore(d.firstChild, acc);
      ligarViaje('aggm'); reconstruirAlarma($('aggm-alarma'));
      var pre = window._agxPrefill; window._agxPrefill = null;
      if(pre){
        if(pre.titulo) $('aggm-titulo').value = pre.titulo;
        if(pre.cal){ $('aggm-cal').value = pre.cal; agGModalCal(); }
        if(pre.tipo) $('aggm-tipo').value = pre.tipo;
        if(pre.alarma!=null){ $('aggm-alarma').value = String(pre.alarma); $('aggm-alarma').dataset.manual = '1'; }
        if(pre.durMin){ var f = new Date(new Date($('aggm-inicio').value).getTime()+pre.durMin*60000); $('aggm-fin').value = agFechaLocalISO(f); $('aggm-fin').dataset.manual = '1'; }
        window._agxNuevoTarea = pre.tareaId || null;
      } else window._agxNuevoTarea = null;
    } catch(e){ console.warn('[calendario-plus]', e); }
    return r;
  };

  var oGuardarModal = window.agGGuardarModal;
  window.agGGuardarModal = function(){
    try {
      var v = leerViaje('aggm');
      window._agxNuevo = { va:v.va, vd:v.vd, tareaId: window._agxNuevoTarea || null };
      if($('aggm-inicio') && $('aggm-titulo') && $('aggm-titulo').value.trim() && (v.va||v.vd)) avisoChoques(choques($('aggm-inicio').value, $('aggm-fin').value, v.va, v.vd, null));
    } catch(e){}
    return oGuardarModal.apply(this, arguments);
  };

  // los eventos nuevos se arman dentro de agAgregarEvento → se marcan al confirmarlos
  var oConf = window.agMostrarConfirmacion;
  window.agMostrarConfirmacion = function(nuevos){
    try {
      var x = window._agxNuevo; window._agxNuevo = null; window._agxNuevoTarea = null;
      if(x && nuevos && nuevos.length) nuevos.forEach(function(e){
        if(x.va) e.viajeAntes = x.va; if(x.vd) e.viajeDespues = x.vd; if(x.tareaId) e.tareaId = x.tareaId;
      });
    } catch(e){}
    return oConf.apply(this, arguments);
  };

  // ---------- EDITAR compromiso ----------
  function asegurarEdicionUI(){
    estilo();
    if($('agx-edit-extra')) return;
    var ov = $('ag-edit-overlay'); if(!ov) return;
    var fila = ov.querySelector('.btn-row'); if(!fila) return;
    var d = document.createElement('div'); d.id = 'agx-edit-extra';
    d.innerHTML = viajeHTML('agxe') + '<div id="agx-edit-panel"></div>';
    fila.parentNode.insertBefore(d, fila);
    ligarViaje('agxe');
    d.addEventListener('click', function(ev){
      var b = ev.target.closest('[data-agx]'); if(!b) return;
      var id = $('ag-edit-id').value, acc = b.getAttribute('data-agx');
      if(acc==='crear-tarea') crearTareaRelacionada(id);
      else if(acc==='hecha') marcarTareaHecha(id);
      else if(acc==='reprog') reprogramarBloque(id);
      else if(acc==='desvincular') desvincular(id);
    });
    reconstruirAlarma($('ag-edit-alarma'));
  }
  function rellenarEdicion(e){
    setViaje('agxe', e.viajeAntes, e.viajeDespues);
    var p = $('agx-edit-panel'); if(!p) return;
    var h = '';
    if(e.tareaId){
      var t = tareaPorId(e.tareaId), pasado = new Date(e.inicio) < new Date();
      if(t){
        h += '<div class="agx-panel">📌 <b>Bloque de trabajo</b> de la tarea «'+esc(t.titulo)+'» · '+(t.hecha?'<b>✔ hecha</b>':'pendiente')
          + (pasado && !t.hecha ? '<div style="margin-top:4px;color:#8a5a00">Este bloque ya pasó y la tarea sigue pendiente. Puedes reprogramarlo sin perder la tarea.</div>' : '')
          + '<div class="agx-row">'
          + (t.hecha ? '' : '<button type="button" class="agx-mini pri" data-agx="hecha">✅ Marcar tarea hecha</button><button type="button" class="agx-mini" data-agx="reprog">↪ Reprogramar bloque</button>')
          + '<button type="button" class="agx-mini" data-agx="desvincular">Desvincular</button></div></div>';
      } else {
        h += '<div class="agx-panel">📌 Este bloque estaba vinculado a una tarea que ya no existe.<div class="agx-row"><button type="button" class="agx-mini" data-agx="desvincular">Desvincular</button></div></div>';
      }
    }
    var rel = getTareas().filter(function(t){ return t.eventoId===e.id; });
    h += '<div class="agx-rel">'+(rel.length ? '<div style="font-size:.72rem;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:#a0536a;margin-bottom:2px">Tareas relacionadas</div>'+rel.map(function(t){ return '<div class="agx-rel-item">'+(t.hecha?'✔':'○')+' '+esc(t.titulo)+(t.fecha?' <span style="color:#8a7279">· '+esc(t.fecha)+'</span>':'')+'</div>'; }).join('') : '')
      + '<button type="button" class="agx-mini" data-agx="crear-tarea" style="margin-top:4px">✅ Crear tarea relacionada</button></div>';
    p.innerHTML = h;
  }
  var oEditar = window.agEditarEvento;
  window.agEditarEvento = function(id){
    var r = oEditar.apply(this, arguments);
    try { asegurarEdicionUI(); var e = evPorId(id); if(e) rellenarEdicion(e); } catch(x){ console.warn('[calendario-plus]', x); }
    return r;
  };
  var oGuardarEd = window.agGuardarEdicion;
  window.agGuardarEdicion = function(){
    try {
      var v = leerViaje('agxe');
      if((v.va||v.vd) && $('ag-edit-inicio').value) avisoChoques(choques($('ag-edit-inicio').value, $('ag-edit-fin').value, v.va, v.vd, $('ag-edit-id').value));
    } catch(e){}
    return oGuardarEd.apply(this, arguments);
  };
  var oConfEd = window.agMostrarConfirmacionEdicion;
  window.agMostrarConfirmacionEdicion = function(idx, datos){
    var r = oConfEd.apply(this, arguments);
    try {
      var v = leerViaje('agxe'), btn = $('ag-confirmar-edicion-btn');
      if(btn){
        var old = btn.onclick;
        btn.onclick = function(){
          var e = agEventos[idx];
          if(e){ if(v.va) e.viajeAntes = v.va; else delete e.viajeAntes; if(v.vd) e.viajeDespues = v.vd; else delete e.viajeDespues; }
          return old.apply(this, arguments);
        };
      }
    } catch(e){ console.warn('[calendario-plus]', e); }
    return r;
  };
  // las repeticiones heredan el desplazamiento y el vínculo
  var oRep = window.agCrearRepeticiones;
  if(typeof oRep === 'function') window.agCrearRepeticiones = function(base){
    var res = oRep.apply(this, arguments);
    try { res.forEach(function(n){ if(base.viajeAntes) n.viajeAntes = base.viajeAntes; if(base.viajeDespues) n.viajeDespues = base.viajeDespues; if(base.tareaId) n.tareaId = base.tareaId; }); } catch(e){}
    return res;
  };

  // ---------- mini ventanas ----------
  function ventana(html){
    estilo(); var v = $('agx-modal-bg'); if(v) v.remove();
    var m = document.createElement('div'); m.id = 'agx-modal-bg'; m.className = 'agx-bg';
    m.onclick = function(ev){ if(ev.target===m) m.remove(); };
    m.innerHTML = '<div class="agx-modal">'+html+'</div>'; document.body.appendChild(m); return m;
  }

  // ---------- Crear tarea relacionada ----------
  function crearTareaRelacionada(eventoId){
    var e = evPorId(eventoId); if(!e) return;
    var dia = String(e.inicio).slice(0,10);
    var m = ventana('<h3>✅ Crear tarea relacionada</h3>'
      + '<div class="agx-f"><label>Tarea</label><input id="agxt-tit" value="'+esc('Pendiente de: '+e.titulo)+'"></div>'
      + '<div class="agx-2"><div class="agx-f"><label>Fecha límite</label><input type="date" id="agxt-fecha" value="'+esc(dia)+'"></div>'
      + '<div class="agx-f"><label>Lista</label><select id="agxt-lista">'+agCalendarios().map(function(c){ return '<option value="'+esc(c.id)+'"'+(c.id===(e.calendario||'consultorio')?' selected':'')+'>'+esc(c.nombre)+'</option>'; }).join('')+'</select></div></div>'
      + '<div style="font-size:.76rem;color:#8a7279">Queda en tu lista de Tareas, enlazada a este compromiso. No se agrega al calendario.</div>'
      + '<div class="agx-acc"><button id="agxt-no">Cancelar</button><button class="pri" id="agxt-ok">Crear tarea</button></div>');
    $('agxt-no').onclick = function(){ m.remove(); };
    $('agxt-ok').onclick = function(){
      var tit = $('agxt-tit').value.replace(/\s+/g,' ').trim(); if(!tit){ $('agxt-tit').focus(); return; }
      var ts = getTareas();
      if(ts.some(function(t){ return t.eventoId===eventoId && !t.hecha && t.titulo.toLowerCase()===tit.toLowerCase(); })){ toast('Ya existe esa tarea para este compromiso'); return; }
      ts.push({id:'t'+Date.now().toString(36)+Math.random().toString(36).slice(2,6), titulo:tit, lista:$('agxt-lista').value, fecha:$('agxt-fecha').value||'', hora:'', prio:false, notas:'', pasos:[], rep:'', hecha:false, creada:new Date().toISOString(), eventoId:eventoId});
      setTareas(ts); m.remove(); rellenarEdicion(e); toast('Tarea creada ✓ (la ves en Tareas)');
    };
    setTimeout(function(){ var i=$('agxt-tit'); if(i){ i.focus(); i.select(); } }, 50);
  }

  function marcarTareaHecha(eventoId){
    var e = evPorId(eventoId); if(!e || !e.tareaId) return;
    var ts = getTareas(), t = ts.filter(function(x){ return x.id===e.tareaId; })[0]; if(!t) return;
    t.hecha = true; t.hechaEn = new Date().toISOString(); setTareas(ts);
    rellenarEdicion(e); toast('Tarea marcada como hecha ✓');
  }
  function desvincular(eventoId){
    var e = evPorId(eventoId); if(!e) return;
    delete e.tareaId; agGuardar(); rellenarEdicion(e); renderAgenda(); toast('Bloque desvinculado: ahora es un compromiso fijo');
  }
  function reprogramarBloque(eventoId, cb){
    var e = evPorId(eventoId); if(!e) return;
    var ini = new Date(e.inicio), dur = Math.round((finEv(e)-ini)/60000);
    var man = new Date(ini); man.setDate(man.getDate() + (ini < new Date() ? Math.max(1, Math.ceil((Date.now()-ini.getTime())/864e5)) : 1));
    var m = ventana('<h3>↪ Reprogramar bloque</h3>'
      + '<div style="font-size:.82rem;margin-bottom:10px">«'+esc(e.titulo)+'» · dura '+durTxt(dur)+'. La tarea se conserva; solo cambia el bloque.</div>'
      + '<div class="agx-2"><div class="agx-f"><label>Día</label><input type="date" id="agxr-dia" value="'+esc(agFechaLocalISO(man).slice(0,10))+'"></div>'
      + '<div class="agx-f"><label>Hora</label><input type="time" id="agxr-hora" value="'+esc(String(e.inicio).slice(11,16))+'"></div></div>'
      + '<div class="agx-acc"><button id="agxr-no">Cancelar</button><button class="pri" id="agxr-ok">Reprogramar</button></div>');
    $('agxr-no').onclick = function(){ m.remove(); };
    $('agxr-ok').onclick = function(){
      var dia = $('agxr-dia').value, hora = $('agxr-hora').value; if(!dia || !hora) return;
      var n = new Date(dia+'T'+hora); if(isNaN(n)) return;
      e.inicio = agFechaLocalISO(n); e.fin = agFechaLocalISO(new Date(n.getTime()+dur*60000));
      m.remove(); var ov = $('ag-edit-overlay'); if(ov) ov.classList.remove('open');
      agGFecha = new Date(n); agGFecha.setHours(0,0,0,0);
      guardarAg(); toast('Bloque reprogramado ✓'); if(typeof cb==='function') cb();
    };
  }

  // ---------- Agendar bloque desde una tarea (lo usa el módulo Tareas) ----------
  window.agxAgendarBloque = function(tareaId, alTerminar){
    var t = tareaPorId(tareaId); if(!t) return;
    var base = new Date(); base.setMinutes(0,0,0); base.setHours(base.getHours()+1);
    var dia = (t.fecha && t.fecha >= agFechaLocalISO(new Date()).slice(0,10)) ? t.fecha : agFechaLocalISO(base).slice(0,10);
    var hora = t.hora || p2(base.getHours())+':00';
    var m = ventana('<h3>📅 Bloque de trabajo</h3>'
      + '<div style="font-size:.84rem;margin-bottom:10px"><b>'+esc(t.titulo)+'</b><br><span style="color:#8a7279">Se agrega al calendario vinculado a esta tarea. Si no la terminas, reprogramas el bloque y la tarea sigue ahí.</span></div>'
      + '<div class="agx-2"><div class="agx-f"><label>Día</label><input type="date" id="agxb-dia" value="'+esc(dia)+'"></div>'
      + '<div class="agx-f"><label>Hora</label><input type="time" id="agxb-hora" value="'+esc(hora)+'"></div></div>'
      + '<div class="agx-f"><label>Duración</label><select id="agxb-dur">'+[25,30,45,60,90,120,180].map(function(x){ return '<option value="'+x+'"'+(x===60?' selected':'')+'>'+durTxt(x)+'</option>'; }).join('')+'</select></div>'
      + '<div class="agx-acc"><button id="agxb-no">Cancelar</button><button class="pri" id="agxb-ok">Agendar</button></div>');
    $('agxb-no').onclick = function(){ m.remove(); };
    $('agxb-ok').onclick = function(){
      var d = $('agxb-dia').value, h = $('agxb-hora').value; if(!d || !h) return;
      var ini = new Date(d+'T'+h); if(isNaN(ini)) return;
      var fin = new Date(ini.getTime()+num($('agxb-dur').value)*60000);
      var ev = {id:'ev'+Date.now()+'_b', titulo:t.titulo, inicio:agFechaLocalISO(ini), fin:agFechaLocalISO(fin), tipo:'admin', descripcion:'', pacienteId:null, calendario:t.lista||'consultorio', alarma:10, tareaId:t.id};
      var cr = choques(ev.inicio, ev.fin, 0, 0, null);
      agEventos.push(ev); agGuardar(); m.remove();
      toast(cr.length ? '⚠️ Bloque agendado, pero se cruza con: '+cr[0].titulo : 'Bloque agendado ✓');
      try { agGFecha = new Date(ini); agGFecha.setHours(0,0,0,0); if(document.getElementById('page-agenda').classList.contains('active')) renderAgenda(); } catch(e){}
      if(typeof alTerminar === 'function') alTerminar(ev);
    };
  };
  window.agxReprogramarBloque = reprogramarBloque;

  // ---------- decoración del calendario ----------
  function decorar(){
    if(window._agDragActivo) return;
    estilo();
    // botones con los nombres pedidos
    [].forEach.call(document.querySelectorAll('.agg-crear, .agg-crear-m'), function(b){ b.textContent = '＋ Nuevo compromiso'; });
    var tb = document.querySelector('.agg-toolbar');
    if(tb){
      [].forEach.call(tb.querySelectorAll('button.agg-btn'), function(b){
        var t = b.textContent.trim();
        if(t==='Hoy'){ b.textContent = 'Ver hoy'; b.onclick = function(){ window.agxVerHoy(); }; }
        else if(t==='Semana') b.textContent = 'Ver semana';
      });
    }
    var cont = $('ag-container'); if(!cont) return;
    [].forEach.call(cont.querySelectorAll('.agx-viaje,.agx-libres'), function(n){ n.remove(); });
    [].forEach.call(cont.querySelectorAll('.agx-bloque,.agx-choque'), function(n){ n.classList.remove('agx-bloque','agx-choque'); });
    if(typeof agGView === 'undefined' || agGView==='mes') return;
    var PX = window.AG_PX_HORA || 48;
    var oc = []; try { oc = agCalOcultos(); } catch(e){}
    var vis = agEventos.filter(function(e){ return oc.indexOf(e.calendario||'consultorio')<0; });
    [].forEach.call(cont.querySelectorAll('.agg-col'), function(col){
      var ymd = col.getAttribute('data-ymd');
      var delDia = vis.filter(function(e){ return e.inicio && String(e.inicio).slice(0,10)===ymd; });
      delDia.forEach(function(e){
        var el = col.querySelector('.agg-ev[data-id="'+(window.CSS&&CSS.escape?CSS.escape(e.id):e.id)+'"]'); if(!el) return;
        if(e.tareaId){ el.classList.add('agx-bloque'); if(!/📌/.test(el.textContent)){ var b = el.querySelector('b'); if(b) b.insertAdjacentText('beforebegin','📌 '); } }
        var va = num(e.viajeAntes), vd = num(e.viajeDespues); if(!va && !vd) return;
        var ini = new Date(e.inicio), fin = finEv(e), s = ini.getHours()*60+ini.getMinutes(), f = fin.getHours()*60+fin.getMinutes();
        if(fin.toDateString()!==ini.toDateString()) f = 24*60;
        function bloque(topMin, mins, txt){
          var d = document.createElement('div'); d.className = 'agx-viaje'; d.style.top = (topMin*PX/60)+'px'; d.style.height = (mins*PX/60)+'px';
          d.style.left = el.style.left; d.style.width = el.style.width; d.textContent = mins*PX/60 >= 14 ? txt : ''; d.title = txt; col.insertBefore(d, col.firstChild);
        }
        if(va){ var t0 = Math.max(0, s-va); if(s>t0) bloque(t0, s-t0, '🚗 '+va+' min'); }
        if(vd){ var t1 = Math.min(24*60, f+vd); if(t1>f) bloque(f, t1-f, '🚗 '+vd+' min'); }
        if((va||vd) && choques(e.inicio, e.fin, va, vd, e.id).length) el.classList.add('agx-choque');
      });
    });
    if(agGView==='dia') libres(cont, vis);
  }

  function libres(cont, vis){
    var main = cont.querySelector('.agg-main'), tb = cont.querySelector('.agg-toolbar'); if(!main || !tb) return;
    var d = new Date(agGFecha), ymd = d.getFullYear()+'-'+p2(d.getMonth()+1)+'-'+p2(d.getDate());
    var H0 = 6*60, H1 = 21*60, hoy = new Date(), esHoy = hoy.toDateString()===d.toDateString();
    var ini0 = H0; if(esHoy){ ini0 = Math.max(H0, Math.ceil((hoy.getHours()*60+hoy.getMinutes())/15)*15); }
    var ocupados = vis.filter(function(e){ return e.inicio && String(e.inicio).slice(0,10)===ymd; }).map(function(e){
      var i = new Date(e.inicio), f = finEv(e);
      return [i.getHours()*60+i.getMinutes()-num(e.viajeAntes), (f.toDateString()===i.toDateString()? f.getHours()*60+f.getMinutes() : 24*60)+num(e.viajeDespues)];
    }).sort(function(a,b){ return a[0]-b[0]; });
    var gaps = [], cur = ini0;
    ocupados.forEach(function(o){ if(o[0]-cur>=30 && cur<H1) gaps.push([cur, Math.min(o[0],H1)]); if(o[1]>cur) cur = o[1]; });
    if(H1-cur>=30) gaps.push([cur,H1]);
    function hm(m){ var h = Math.floor(m/60), mi = m%60; return ((h%12)||12)+':'+p2(mi)+' '+(h<12?'a. m.':'p. m.'); }
    var box = document.createElement('div'); box.className = 'agx-libres';
    var txt = '<b>Espacios libres</b> '+(esHoy?'(desde ahora) ':'')+'· ';
    if(!ocupados.length) txt += 'día completamente libre';
    else if(!gaps.length) txt += 'no quedan espacios de 30 min o más';
    else txt += gaps.slice(0,6).map(function(g){ return '<span class="agx-g">'+hm(g[0])+' – '+hm(g[1])+' · '+durTxt(g[1]-g[0])+'</span>'; }).join('')+(gaps.length>6?' +'+(gaps.length-6)+' más':'');
    txt += '<span class="agx-leg">Sólido = compromiso fijo · Con borde punteado y 📌 = bloque de una tarea (flexible) · Rayado 🚗 = desplazamiento</span>';
    box.innerHTML = txt;
    tb.parentNode.insertBefore(box, tb.nextSibling);
  }

  var oRender = window.agRenderHorario;
  window.agRenderHorario = function(){
    var r = oRender.apply(this, arguments);
    try { decorar(); asegurarHospital(); } catch(e){ console.warn('[calendario-plus]', e); }
    return r;
  };

  window.agxVerHoy = function(){ agGView = 'dia'; agGHoy(); };

  // ---------- Hospital como área + abrir en el día de hoy ----------
  function asegurarHospital(){
    try {
      if(!DB._loaded) return;
      if(localStorage.getItem('agx_hospital_ok')==='1') return;
      var l = agCalendarios();
      if(!l.some(function(c){ return c.id==='hospital' || /hospital/i.test(c.nombre); })){
        l = l.concat([{id:'hospital', nombre:'Hospital', color:'#f4511e'}]);
        agGuardarCalendarios(l);
        localStorage.setItem('agx_hospital_ok','1');
        renderAgenda();
      } else localStorage.setItem('agx_hospital_ok','1');
    } catch(e){}
  }
  var oGoPage = window.goPage, abiertaYa = false;
  if(typeof oGoPage === 'function') window.goPage = function(name){
    if(name==='agenda' && !abiertaYa){ abiertaYa = true; try { agGView = 'dia'; agGFecha = new Date(); agGFecha.setHours(0,0,0,0); } catch(e){} }
    return oGoPage.apply(this, arguments);
  };

  // ---------- todas las listas de alarmas con las mismas opciones ----------
  safe(function(){ reconstruirAlarma($('ag-nuevo-alarma')); reconstruirAlarma($('ag-edit-alarma')); })();
})();
