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
'.agx-filtro{background:#fbe9ee;border:1.5px solid #cd8e9d;border-radius:12px;padding:8px 12px;margin:0 0 10px;font-size:.84rem;color:#7a3c4b;display:flex;gap:10px;align-items:center;flex-wrap:wrap}',
'.agx-filtro button{border:1.5px solid #cd8e9d;background:#fff;color:#7a3c4b;border-radius:14px;padding:5px 12px;font-size:.8rem;cursor:pointer}',
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
    try { rotularAreas(cont); } catch(e){}
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
    try { decorar(); asegurarHospital(); window.agxMigrarAreas(); } catch(e){ console.warn('[calendario-plus]', e); }
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


  // ---------- ÁREAS: nombres iniciales, filtro del calendario por área ----------
  var AREAS_NOMBRES = { consultorio:['Consultorio','Consultorio privado'], personal:['Personal','Vida personal'], conmovilidad:['CONMOVILIDAD','Empresa de movilidad'] };
  window.agxMigrarAreas = function(){
    try {
      if(typeof DB==='undefined' || !DB._loaded) return;
      if(localStorage.getItem('agx_areas_ok')==='1') return;
      var l = agCalendarios().map(function(c){ return {id:c.id, nombre:c.nombre, color:c.color}; }), cambio = false;
      l.forEach(function(c){ var a = AREAS_NOMBRES[c.id]; if(a && c.nombre===a[0]){ c.nombre = a[1]; cambio = true; } });
      if(!l.some(function(c){ return c.id==='hospital' || /hospital/i.test(c.nombre); })){ l.push({id:'hospital', nombre:'Hospital', color:'#f4511e'}); cambio = true; }
      if(cambio) agGuardarCalendarios(l);
      localStorage.setItem('agx_areas_ok','1');
      if(cambio && typeof renderAgenda==='function') { try { renderAgenda(); } catch(e){} }
    } catch(e){}
  };
  function rotularAreas(cont){
    var t = cont.querySelector('.agg-cal-tit'); if(t) t.textContent = 'Áreas';
    var lk = cont.querySelectorAll('.agg-link'); [].forEach.call(lk, function(b){ if(/Nuevo calendario/i.test(b.textContent)) b.textContent = '＋ Nueva área'; });
    [].forEach.call(cont.querySelectorAll('.agx-filtro'), function(n){ n.remove(); });
    var oc = []; try { oc = agCalOcultos(); } catch(e){}
    var todas = agCalendarios().map(function(c){ return c.id; });
    var ocultas = oc.filter(function(id){ return todas.indexOf(id)>=0; });
    if(!ocultas.length) return;
    var visibles = agCalendarios().filter(function(c){ return ocultas.indexOf(c.id)<0; });
    var txt = visibles.length===0 ? 'Todas las áreas están ocultas' : (visibles.length<=2 ? 'Mostrando solo: '+visibles.map(function(c){ return c.nombre; }).join(' y ') : 'Mostrando '+visibles.length+' de '+todas.length+' áreas');
    var d = document.createElement('div'); d.className = 'agx-filtro';
    d.innerHTML = '<span>🗂 '+String(txt).replace(/</g,'&lt;')+'</span><button type="button">Ver todas las áreas</button>';
    d.querySelector('button').onclick = function(){ window.agxVerTodasAreas(); };
    var main = cont.querySelector('.agg-main') || cont; main.insertBefore(d, main.firstChild);
  }
  window.agxVerTodasAreas = function(){ try { localStorage.setItem('ag_cal_ocultos','[]'); } catch(e){} renderAgenda(); };
  // Abre el calendario general mostrando solo una área
  window.agxVerArea = function(id){
    try {
      var o = agCalendarios().map(function(c){ return c.id; }).filter(function(x){ return x!==id; });
      localStorage.setItem('ag_cal_ocultos', JSON.stringify(o));
    } catch(e){}
    var pt = document.getElementById('ag-panel-tareas');
    if(pt && pt.style.display!=='none'){ var tb = document.querySelector('.ag-tab[data-tab="horario"]'); if(tb && typeof agSwitchTab==='function') agSwitchTab('horario', tb); }
    else if(typeof goPage==='function') goPage('agenda');
    try { renderAgenda(); } catch(e){}
  };
  // Los nombres del formulario de calendario pasan a decir «área»
  var oAbrirCal = window.agGAbrirCalModal;
  if(typeof oAbrirCal==='function') window.agGAbrirCalModal = function(id){
    var r = oAbrirCal.apply(this, arguments);
    try { var h = document.querySelector('#agg-modal .agg-modal > div'); if(h) h.textContent = id ? 'Editar área' : 'Nueva área'; } catch(e){}
    return r;
  };
  // Un área con tareas no se elimina desde el calendario (las tareas quedarían sin área)
  var oElimCal = window.agGEliminarCal;
  if(typeof oElimCal==='function') window.agGEliminarCal = function(id){
    try {
      var T = DB.get('tareas'); var n = Array.isArray(T) ? T.filter(function(t){ return t && (t.lista||'consultorio')===id; }).length : 0;
      if(n){ toast('Esta área tiene '+n+' tarea(s). Muévelas a otra área antes de eliminarla (pestaña Áreas en Tareas)'); return; }
    } catch(e){}
    return oElimCal.apply(this, arguments);
  };

  // ---------- todas las listas de alarmas con las mismas opciones ----------
  safe(function(){ reconstruirAlarma($('ag-nuevo-alarma')); reconstruirAlarma($('ag-edit-alarma')); })();
})();

/* ===========================================================================
   Finanzas › «💳 Mis cuentas»: tus cuentas (Nequi, Bancolombia, etc.) en una
   imagen lista para mandar por WhatsApp. Los datos NO están en el código (la
   página es pública): los escribes una vez aquí y se guardan en tu cuenta.
   =========================================================================== */
(function(){
  'use strict';
  var KEY='datos_pago';
  function $(i){ return document.getElementById(i); }
  function esc(s){ return String(s==null?'':s).replace(/[&<>"']/g,function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); }
  var POR_DEFECTO=[{medio:'Nequi',dato:'321 202 1836',detalle:''},{medio:'Bancolombia',dato:'58000082803',detalle:'Cuenta de ahorros · a nombre de Luisa Fernanda Garcés García'}];
  function leer(){
    var v=null; try{ v=DB.get(KEY); }catch(e){}
    // si aún no hay nada guardado (o solo hay campos vacíos), arranca con tus cuentas ya escritas
    if(!v || !Array.isArray(v.medios) || !v.medios.some(function(m){ return m && m.dato; })){
      v={medios:POR_DEFECTO.map(function(m){ return {medio:m.medio,dato:m.dato,detalle:m.detalle}; }),nota:(v&&v.nota)||'',titulo:(v&&v.titulo)||'Cuentas'};
    }
    if(typeof v.titulo!=='string' || !v.titulo) v.titulo='Cuentas';
    return v;
  }
  function guardar(v){ try{ DB.set(KEY,v); }catch(e){} }
  function toastS(m){ try{ if(typeof toast==='function') toast(m); }catch(e){} }

  // ---------- pantalla ----------
  function css(){
    if($('dp-css')) return; var s=document.createElement('style'); s.id='dp-css';
    s.textContent='#fin-pagos .dp-card{background:#fff;border:1.5px solid #f0d8de;border-radius:16px;padding:14px;margin-bottom:12px}'
    +'#fin-pagos .dp-card h4{margin:0 0 8px;font-size:.8rem;letter-spacing:.06em;text-transform:uppercase;color:#a0536a}'
    +'#fin-pagos .dp-f{display:flex;flex-direction:column;gap:3px;margin-bottom:8px}#fin-pagos .dp-f label{font-size:.72rem;color:#a0536a}'
    +'#fin-pagos input,#fin-pagos textarea{font-size:16px;padding:10px 12px;border:1.5px solid #f0d8de;border-radius:10px;font-family:inherit;width:100%;box-sizing:border-box}'
    +'#fin-pagos .dp-row{display:flex;gap:8px;flex-wrap:wrap;margin-top:6px}'
    +'#fin-pagos .dp-b{border:1.5px solid #cd8e9d;background:#fff;color:#7a3c4b;border-radius:20px;padding:10px 16px;font-size:.85rem;cursor:pointer;min-height:44px}'
    +'#fin-pagos .dp-b.p{background:#cd8e9d;color:#fff}#fin-pagos .dp-x{color:#b0455b;border-color:#e8a0a0}'
    +'@media (max-width:820px){.fin-tab-nav{flex-wrap:wrap}.fin-tab{padding:12px 14px;flex:1 1 auto;min-height:44px}}'
    +'#fin-pagos .dp-aviso{font-size:.78rem;color:#7a3c4b;background:#fbf1e8;border-radius:10px;padding:8px 10px;margin-bottom:12px}';
    document.head.appendChild(s);
  }
  function pintar(){
    var cont=$('fin-pagos'); if(!cont) return; var v=leer();
    var h='<div class="dp-aviso">💳 Tus cuentas ya vienen escritas; cambia o agrega las que necesites y se guardan en tu cuenta. Con ellas armo una imagen para mandar por WhatsApp cuando un paciente pregunte dónde pagar.</div>';
    h+='<div class="dp-card"><h4>Título de la imagen</h4><div class="dp-f"><input id="dp-titulo" value="'+esc(v.titulo)+'" placeholder="Cuentas"></div></div>';
    v.medios.forEach(function(m,i){
      h+='<div class="dp-card" data-i="'+i+'"><h4>Cuenta '+(i+1)+'</h4>'
      +'<div class="dp-f"><label>Nombre (Nequi, Bancolombia, Daviplata…)</label><input data-k="medio" value="'+esc(m.medio)+'"></div>'
      +'<div class="dp-f"><label>Número de celular o de cuenta</label><input data-k="dato" inputmode="numeric" value="'+esc(m.dato)+'"></div>'
      +'<div class="dp-f"><label>Detalle (tipo de cuenta, a nombre de…)</label><input data-k="detalle" value="'+esc(m.detalle)+'"></div>'
      +'<div class="dp-row"><button type="button" class="dp-b" data-a="copiar">📋 Copiar número</button><button type="button" class="dp-b dp-x" data-a="quitar">Quitar</button></div></div>';
    });
    h+='<div class="dp-row"><button type="button" class="dp-b" data-a="agregar">＋ Agregar otra cuenta</button></div>'
    +'<div class="dp-card" style="margin-top:12px"><h4>Mensaje al pie (opcional)</h4><div class="dp-f"><textarea id="dp-nota" rows="2" placeholder="Ej.: Cuando pagues, envíame el comprobante por este chat.">'+esc(v.nota)+'</textarea></div></div>'
    +'<div class="dp-row"><button type="button" class="dp-b p" data-a="imagen">🖼 Generar imagen</button><button type="button" class="dp-b" data-a="texto">📋 Copiar como texto</button></div>';
    cont.innerHTML=h;
  }
  function recoger(){
    var v=leer(), cont=$('fin-pagos'); if(!cont) return v;
    var ms=[]; [].forEach.call(cont.querySelectorAll('.dp-card[data-i]'),function(c){
      var o={}; [].forEach.call(c.querySelectorAll('input[data-k]'),function(i){ o[i.getAttribute('data-k')]=i.value.trim(); }); ms.push(o);
    });
    if(ms.length) v.medios=ms; var n=$('dp-nota'); if(n) v.nota=n.value.trim(); var t=$('dp-titulo'); if(t) v.titulo=t.value.trim()||'Cuentas'; return v;
  }
  function llenos(v){ return v.medios.filter(function(m){ return m.medio && m.dato; }); }
  function texto(v){
    var t='🌸 Hola! Estas son mis cuentas:\n'; llenos(v).forEach(function(m){ t+='\n*'+m.medio+'*\n'+m.dato+(m.detalle?'\n'+m.detalle:'')+'\n'; });
    if(v.nota) t+='\n'+v.nota+'\n'; return t+'\n*Luisa Fernanda Garcés García*\n_Psicóloga · TP 174366_';
  }
  function copiar(txt, ok){
    function f(){ try{ var a=document.createElement('textarea'); a.value=txt; a.style.position='fixed'; a.style.opacity='0'; document.body.appendChild(a); a.select(); document.execCommand('copy'); a.remove(); toastS(ok); }catch(e){ toastS('No pude copiar'); } }
    if(navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(txt).then(function(){ toastS(ok); },f); else f();
  }

  // ---------- imagen ----------
  function envolver(ctx, txt, maxW){
    var pal=String(txt).split(/\s+/), ls=[], l=''; pal.forEach(function(p){ var t=l?l+' '+p:p; if(ctx.measureText(t).width>maxW && l){ ls.push(l); l=p; } else l=t; }); if(l) ls.push(l); return ls;
  }
  function dibujar(v, canvas){
    var W=800, ms=llenos(v), PAD=46, cardW=W-2*PAD;
    var tmp=document.createElement('canvas').getContext('2d'); tmp.font='600 16px Lato,Arial,sans-serif';
    var filas=ms.map(function(m){ var d=m.detalle?envolver(tmp,m.detalle,cardW-70):[]; return {m:m,d:d,h:76+d.length*22}; });
    var notaL=v.nota?envolver(tmp,v.nota,cardW-40):[];
    var cardH=30+filas.reduce(function(a,f){ return a+f.h; },0)+(notaL.length?24+notaL.length*22:0)+10;
    var topH=190, H=topH+28+cardH+88;
    canvas.width=W; canvas.height=H; var ctx=canvas.getContext('2d');
    var g=ctx.createLinearGradient(0,0,0,H); g.addColorStop(0,'#fdf5f7'); g.addColorStop(1,'#fadae1'); ctx.fillStyle=g; ctx.fillRect(0,0,W,H);
    var fg=ctx.createLinearGradient(0,0,W,0); fg.addColorStop(0,'#b87082'); fg.addColorStop(.5,'#cd8e9d'); fg.addColorStop(1,'#b87082'); ctx.fillStyle=fg; ctx.fillRect(0,0,W,topH);
    var logo=$('logo-img');
    if(logo && logo.complete && logo.naturalWidth){ try{ var sc=Math.min(240/logo.naturalWidth,100/logo.naturalHeight), lw=logo.naturalWidth*sc, lh=logo.naturalHeight*sc; ctx.save(); ctx.globalAlpha=.96; ctx.drawImage(logo,W/2-lw/2,10+(100-lh)/2,lw,lh); ctx.restore(); }catch(e){} }
    else { ctx.save(); ctx.textAlign='center'; ctx.fillStyle='rgba(255,255,255,.92)'; ctx.font='bold italic 18px "Playfair Display",Georgia,serif'; ctx.fillText('Luisa Fernanda Garcés García',W/2,62); ctx.font='13px Lato,Arial'; ctx.fillText('Psicóloga · TP 174366',W/2,84); ctx.restore(); }
    ctx.save(); ctx.strokeStyle='rgba(255,255,255,.35)'; ctx.beginPath(); ctx.moveTo(W/2-140,124); ctx.lineTo(W/2+140,124); ctx.stroke(); ctx.restore();
    ctx.save(); ctx.textAlign='center'; ctx.fillStyle='rgba(255,255,255,.96)'; ctx.font='italic 22px "Playfair Display",Georgia,serif'; ctx.fillText((v.titulo||'Cuentas')+'  ✿',W/2,163); ctx.restore();
    var cY=topH+28;
    ctx.save(); ctx.fillStyle='rgba(255,255,255,.97)'; ctx.shadowColor='rgba(140,70,90,.14)'; ctx.shadowBlur=30; ctx.shadowOffsetY=8; rrect(ctx,PAD,cY,cardW,cardH,20); ctx.fill(); ctx.restore();
    var y=cY+30;
    filas.forEach(function(f,i){
      if(i){ ctx.save(); ctx.strokeStyle='#f0d8de'; ctx.lineWidth=1.5; ctx.beginPath(); ctx.moveTo(PAD+30,y-12); ctx.lineTo(PAD+cardW-30,y-12); ctx.stroke(); ctx.restore(); }
      ctx.save(); ctx.textAlign='left';
      ctx.fillStyle='#cd8e9d'; ctx.font='700 13px Lato,Arial,sans-serif'; ctx.letterSpacing='1px'; ctx.fillText(f.m.medio.toUpperCase(),PAD+30,y+8); ctx.letterSpacing='0px';
      ctx.fillStyle='#643000'; ctx.font='bold 30px "Playfair Display",Georgia,serif'; ctx.fillText(f.m.dato,PAD+30,y+46);
      ctx.fillStyle='#7a3d20'; ctx.font='600 16px Lato,Arial,sans-serif'; f.d.forEach(function(l,k){ ctx.fillText(l,PAD+30,y+72+k*22); });
      ctx.restore(); y+=f.h;
    });
    if(notaL.length){ ctx.save(); ctx.textAlign='center'; ctx.fillStyle='#a0536a'; ctx.font='italic 15px "Playfair Display",Georgia,serif'; notaL.forEach(function(l,k){ ctx.fillText(l,W/2,y+8+k*22); }); ctx.restore(); }
    var pY=cY+cardH;
    ctx.save(); ctx.textAlign='center'; ctx.fillStyle='#cd8e9d'; ctx.font='13px Lato,Arial'; ctx.fillText('Luisa Fernanda Garcés García · Psicóloga · TP 174366',W/2,pY+36); ctx.restore();
  }
  function modal(){
    var o=$('dp-img-overlay'); if(o) return o;
    o=document.createElement('div'); o.id='dp-img-overlay'; o.className='cita-img-overlay'; o.style.zIndex=10002;
    o.innerHTML='<div class="cita-img-modal"><div class="cita-img-canvas-wrap"><canvas id="dp-img-canvas" width="800" height="600"></canvas></div><div class="cita-img-footer"><button class="btn-cita-dl" data-a="dl">⬇️ Descargar</button><button class="btn-cita-wa" data-a="wa">📱 Compartir / WhatsApp</button><button class="btn-cita-close" data-a="cerrar">Cerrar</button></div></div>';
    o.addEventListener('click',function(e){
      if(e.target===o){ o.classList.remove('open'); return; }
      var a=e.target.getAttribute && e.target.getAttribute('data-a'); if(!a) return;
      var c=$('dp-img-canvas');
      if(a==='cerrar') o.classList.remove('open');
      if(a==='dl'){ var l=document.createElement('a'); l.download='Cuentas_para_pagar.png'; l.href=c.toDataURL('image/png'); l.click(); }
      if(a==='wa'){
        var msg=texto(leer());
        if(navigator.share && navigator.canShare){
          c.toBlob(function(b){
            var f=b && new File([b],'Cuentas_para_pagar.png',{type:'image/png'});
            if(f && navigator.canShare({files:[f]})){ navigator.share({files:[f],text:msg}).catch(function(){}); }
            else { var l=document.createElement('a'); l.download='Cuentas_para_pagar.png'; l.href=c.toDataURL('image/png'); l.click(); window.open('https://wa.me/?text='+encodeURIComponent(msg),'_blank'); }
          },'image/png');
        } else { var l2=document.createElement('a'); l2.download='Cuentas_para_pagar.png'; l2.href=c.toDataURL('image/png'); l2.click(); toastS('Imagen descargada: adjúntala en el chat de WhatsApp'); window.open('https://wa.me/?text='+encodeURIComponent(msg),'_blank'); }
      }
    });
    document.body.appendChild(o); return o;
  }

  // ---------- eventos de la pantalla ----------
  function clic(e){
    var b=e.target.closest && e.target.closest('[data-a]'); if(!b || !$('fin-pagos') || !$('fin-pagos').contains(b)) return;
    var a=b.getAttribute('data-a'), v=recoger(), card=b.closest('.dp-card'), i=card?+card.getAttribute('data-i'):-1;
    if(a==='agregar'){ v.medios.push({medio:'',dato:'',detalle:''}); guardar(v); pintar(); return; }
    if(a==='quitar'){ if(v.medios.length>1) v.medios.splice(i,1); else v.medios=[{medio:'',dato:'',detalle:''}]; guardar(v); pintar(); return; }
    if(a==='copiar'){ var m=v.medios[i]; if(m && m.dato) copiar(m.dato,'Número copiado ✓'); else toastS('Escribe primero el número'); return; }
    if(a==='texto'){ if(!llenos(v).length){ toastS('Escribe al menos un medio con su número'); return; } guardar(v); copiar(texto(v),'Texto copiado ✓ (pégalo en WhatsApp)'); return; }
    if(a==='imagen'){
      if(!llenos(v).length){ toastS('Escribe al menos un medio con su número'); return; }
      guardar(v); var o=modal(); o.classList.add('open'); setTimeout(function(){ dibujar(v,$('dp-img-canvas')); },60);
    }
  }
  function montar(){
    var nav=document.querySelector('.fin-tab-nav'), pg=$('page-finanzas'); if(!nav || !pg || $('fin-pagos')) return;
    css();
    var b=document.createElement('button'); b.className='fin-tab'; b.textContent='💳 Mis cuentas';
    b.onclick=function(){ pintar(); finSwitchTab('pagos',b); }; nav.appendChild(b);
    var s=document.createElement('div'); s.className='fin-screen'; s.id='fin-pagos'; s.addEventListener('click',clic);
    s.addEventListener('change',function(){ guardar(recoger()); });
    var ref=$('fin-revision')||pg.querySelector('.fin-screen:last-of-type'); if(ref && ref.parentNode) ref.parentNode.insertBefore(s,ref.nextSibling); else pg.appendChild(s);
  }
  montar();
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',montar);
})();
