/* ===========================================================================
   Agenda con Tomás (ETAPA 1: solo lectura)
   Muestra en el calendario de la Suite los eventos de la agenda azul
   (proyecto Firebase aparte: agenda-compartida-aff93).
   · La Suite SOLO LEE de la agenda. La agenda no puede leer nada de la Suite.
   · Se ve lo compartido por los dos y lo que tú misma creaste allá (incluso "Solo yo").
     Lo "Solo yo" de Tomás nunca llega aquí (las reglas de Firestore lo impiden).
   · Solo la dueña (rol 'duena') ve esta capa. Si algo falla, la Suite sigue como siempre.
   · La clave NO está en el código: se escribe una vez y Firebase la recuerda en este navegador.
   =========================================================================== */
(function(){
  if(window.__famInit) return; window.__famInit = true;
  if(typeof firebase === 'undefined' || typeof agEventosVisibles !== 'function') return;

  var CFG = {
    apiKey: "AIzaSyDSnhVY8cJc7MsXACyWHIwYvUvvDnphGvk",
    authDomain: "agenda-compartida-aff93.firebaseapp.com",
    projectId: "agenda-compartida-aff93",
    storageBucket: "agenda-compartida-aff93.firebasestorage.app",
    messagingSenderId: "56187117223",
    appId: "1:56187117223:web:d30e262eecbc398ac14582"
  };
  var CORREO = 'mama@agenda-compartida.app';
  var URL_AGENDA = 'https://luisafgarces.github.io/agenda/';
  var CLAVE_OCULTO = 'familia';                 // se guarda en ag_cal_ocultos, como cualquier calendario
  var AREAS_DEF = [
    {id:'colegio',nombre:'Colegio',emoji:'🎒',color:'#2b7de9'},{id:'futbol',nombre:'Fútbol',emoji:'⚽',color:'#2e9e68'},
    {id:'casa',nombre:'Casa',emoji:'🏠',color:'#f2994a'},{id:'familia',nombre:'Familia',emoji:'💙',color:'#8e5de8'},
    {id:'personal',nombre:'Personal',emoji:'⭐',color:'#14a3b8'},{id:'emprende',nombre:'Emprendimiento',emoji:'🚀',color:'#d99a00'}
  ];

  function esc(s){ return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;'); }
  function p2(n){ return String(n).padStart(2,'0'); }
  function ymdDe(d){ return d.getFullYear()+'-'+p2(d.getMonth()+1)+'-'+p2(d.getDate()); }
  function pYMD(s){ var a = String(s).slice(0,10).split('-'); return new Date(+a[0], +a[1]-1, +a[2]); }
  function pDT(s){ var d = String(s||''); var m = d.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2}))?/); return m ? new Date(+m[1], +m[2]-1, +m[3], +(m[4]||0), +(m[5]||0)) : new Date(NaN); }
  function toast2(m){ try { if(typeof toast==='function') toast(m); } catch(e){} }

  // ---------- estado ----------
  var app = null, auth = null, db = null, uid = null;
  var estado = 'sin-conectar';                  // sin-conectar | conectando | conectado | error
  var propios = {}, compartidos = {}, areas = AREAS_DEF.slice(), miembros = {};
  var unsubs = [];

  function esDuena(){ return window.ROL_ACTUAL === 'duena'; }
  function activa(){ return esDuena() && estado === 'conectado'; }
  function otroNombre(){
    var k = Object.keys(miembros).filter(function(u){ return u !== uid; })[0];
    return (k && miembros[k]) ? miembros[k] : 'Tomás';
  }
  function nombreDe(u){ return u === uid ? 'ti' : (miembros[u] || 'la otra persona'); }
  function areaDe(id){ for(var i=0;i<areas.length;i++) if(areas[i].id===id) return areas[i]; return {id:id||'', nombre:'Sin área', emoji:'📌', color:'#2b7de9'}; }

  function rerender(){
    try {
      if(window._agDragActivo) return;
      var pg = document.getElementById('page-agenda');
      if(pg && pg.classList.contains('active') && typeof renderAgenda === 'function') renderAgenda();
    } catch(e){ console.warn('[familia]', e); }
  }

  // ---------- conexión (proyecto Firebase aparte, con nombre propio) ----------
  function iniciar(){
    try {
      app = firebase.apps.filter(function(a){ return a.name==='familia'; })[0] || firebase.initializeApp(CFG, 'familia');
      auth = app.auth(); db = app.firestore();
      auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL).catch(function(){});
      auth.onAuthStateChanged(function(u){
        if(u){ uid = u.uid; asegurar(); }
        else { uid = null; parar(); estado = 'sin-conectar'; propios = {}; compartidos = {}; rerender(); }
      });
    } catch(e){ console.warn('[familia] no se pudo iniciar', e); estado = 'error'; }
  }
  // Solo se descarga algo cuando la dueña ya entró a la Suite; si entra otro rol, se suelta todo.
  function asegurar(){
    try {
      if(esDuena()){ if(uid && !unsubs.length) escuchar(); }
      else if(unsubs.length || estado !== 'sin-conectar'){ parar(); propios = {}; compartidos = {}; estado = 'sin-conectar'; }
    } catch(e){ console.warn('[familia]', e); }
  }
  function parar(){ unsubs.forEach(function(f){ try { f(); } catch(e){} }); unsubs = []; }
  function escuchar(){
    parar(); estado = 'conectando';
    function err(e){ console.warn('[familia] lectura', e); estado = 'error'; rerender(); }
    function mapear(snap){ var o = {}; snap.forEach(function(d){ var v = d.data(); if(v && v.tipo==='evento'){ v.id = d.id; o[d.id] = v; } }); return o; }
    unsubs.push(db.collection('items').where('owner','==',uid).onSnapshot(function(s){ propios = mapear(s); estado = 'conectado'; rerender(); }, err));
    unsubs.push(db.collection('items').where('compartido','==',true).onSnapshot(function(s){ compartidos = mapear(s); estado = 'conectado'; rerender(); }, err));
    unsubs.push(db.collection('config').doc('areas').onSnapshot(function(d){ if(d.exists && Array.isArray(d.data().lista) && d.data().lista.length) areas = d.data().lista; rerender(); }, function(){}));
    unsubs.push(db.collection('miembros').onSnapshot(function(s){ var o = {}; s.forEach(function(d){ o[d.id] = String((d.data()||{}).nombre||'').slice(0,24); }); miembros = o; rerender(); }, function(){}));
  }

  // ---------- eventos → forma de la Suite (con repeticiones) ----------
  function todos(){ var o = {}, k; for(k in compartidos) o[k] = compartidos[k]; for(k in propios) o[k] = propios[k]; return Object.keys(o).map(function(x){ return o[x]; }); }
  function ocurre(it, D, b, durDias){
    var s = ymdDe(b), dia = ymdDe(D);
    if(!it.rep){
      if(it.todoDia) return dia >= s && dia <= ymdDe(new Date(pYMD(s).getTime() + durDias*86400000 + 3600000));
      return dia === s;
    }
    if(dia < s) return false;
    if(it.repHasta && dia > it.repHasta) return false;
    var dow = D.getDay();
    switch(it.rep){
      case 'diaria': return true;
      case 'laboral': return dow>=1 && dow<=5;
      case 'semanal': return dow === b.getDay();
      case 'mensual': return D.getDate() === b.getDate();
      case 'anual': return D.getDate() === b.getDate() && D.getMonth() === b.getMonth();
    }
    return false;
  }
  function eventosVentana(){
    var c = (typeof agGFecha !== 'undefined' && agGFecha) ? new Date(agGFecha) : new Date();
    c.setHours(0,0,0,0);
    var d0 = new Date(c); d0.setDate(d0.getDate()-45); var d1 = new Date(c); d1.setDate(d1.getDate()+75);
    var out = [];
    todos().forEach(function(it){
      if(!it.inicio) return;
      var b = pDT(it.inicio); if(isNaN(b)) return;
      var f = it.fin ? pDT(it.fin) : null;
      var durMs = (f && !isNaN(f) && f > b) ? (f - b) : 3600000;
      var durDias = it.todoDia ? Math.max(0, Math.round((pYMD(it.fin||it.inicio) - pYMD(it.inicio))/86400000)) : 0;
      var area = areaDe(it.area), mio = it.owner === uid;
      for(var D = new Date(d0); D <= d1; D.setDate(D.getDate()+1)){
        if(!ocurre(it, D, b, durDias)) continue;
        var dia = ymdDe(D), ini, fin;
        if(it.todoDia){ ini = dia+'T00:00'; fin = dia+'T01:00'; }
        else {
          var i = new Date(D.getFullYear(), D.getMonth(), D.getDate(), b.getHours(), b.getMinutes());
          var e = new Date(i.getTime() + durMs);
          if(ymdDe(e) !== dia) e = new Date(D.getFullYear(), D.getMonth(), D.getDate(), 23, 59);
          ini = dia+'T'+p2(i.getHours())+':'+p2(i.getMinutes()); fin = dia+'T'+p2(e.getHours())+':'+p2(e.getMinutes());
        }
        out.push({ id:'fam_'+it.id+'_'+dia, titulo:'👨‍👦 '+(it.todoDia?'(todo el día) ':'')+(it.titulo||'(sin título)')+(it.compartido?'':' 🔒'),
          inicio:ini, fin:fin, tipo:'familia', calendario:'fam:'+(it.area||''), _fam:true, _ref:it.id, _dia:dia });
      }
    });
    return out;
  }

  // ---------- engancharse al calendario existente ----------
  var oVis = window.agEventosVisibles;
  window.agEventosVisibles = function(){
    var base = oVis.apply(this, arguments);
    try {
      asegurar();
      if(!activa()) return base;
      if(agCalOcultos().indexOf(CLAVE_OCULTO) >= 0) return base;
      return base.concat(eventosVentana());
    } catch(e){ console.warn('[familia]', e); return base; }
  };
  // para avisos de cruce y espacios libres: eventos propios + los de la agenda azul
  window.agEventosConFamilia = function(){
    try { return (activa() && agCalOcultos().indexOf(CLAVE_OCULTO) < 0) ? agEventos.concat(eventosVentana()) : agEventos; }
    catch(e){ return agEventos; }
  };
  var oPorId = window.agCalPorId;
  window.agCalPorId = function(id){
    if(typeof id === 'string' && id.indexOf('fam:') === 0){ var a = areaDe(id.slice(4)); return {id:id, nombre:'Con '+otroNombre()+' · '+a.nombre, color:a.color}; }
    return oPorId.apply(this, arguments);
  };

  // tocar un evento de la agenda azul: se muestra (solo lectura); nada se puede arrastrar ni editar aquí
  var oEditar = window.agEditarEvento;
  window.agEditarEvento = function(id){
    if(typeof id === 'string' && id.indexOf('fam_') === 0){ try { verEvento(id); } catch(e){ console.warn('[familia]', e); } return; }
    return oEditar.apply(this, arguments);
  };
  function verEvento(idOc){
    var oc = eventosVentana().filter(function(e){ return e.id === idOc; })[0]; if(!oc) return;
    var it = todos().filter(function(x){ return x.id === oc._ref; })[0]; if(!it) return;
    var a = areaDe(it.area), f = pYMD(oc._dia);
    var cuando = f.toLocaleDateString('es-CO',{weekday:'long',day:'numeric',month:'long'}) + (it.todoDia ? ' · todo el día' : ' · ' + agFormatHora(oc.inicio) + ' – ' + agFormatHora(oc.fin));
    var reps = {diaria:'Todos los días',laboral:'De lunes a viernes',semanal:'Cada semana',mensual:'Cada mes',anual:'Cada año'};
    if(typeof agGCerrarModal === 'function') agGCerrarModal();
    var m = document.createElement('div'); m.id = 'agg-modal'; m.className = 'agg-modal-bg';
    m.onclick = function(ev){ if(ev.target === m) m.remove(); };
    m.innerHTML = '<div class="agg-modal" style="max-width:420px;border-top:5px solid '+esc(a.color)+'">'
      + '<div style="font-size:.72rem;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:#2b7de9;margin-bottom:6px">👨‍👦 Agenda con '+esc(otroNombre())+' · solo lectura</div>'
      + '<div style="font-size:1.2rem;font-weight:700;color:#3c4043;margin-bottom:8px">'+esc(it.titulo)+'</div>'
      + '<div style="font-size:.9rem;color:#3c4043;line-height:1.6">📅 '+esc(cuando)+'<br>'
      + (it.lugar ? '📍 '+esc(it.lugar)+'<br>' : '') + esc(a.emoji)+' '+esc(a.nombre)+'<br>'
      + (it.rep ? '🔁 '+esc(reps[it.rep]||'Se repite')+'<br>' : '')
      + (it.compartido ? '👥 Compartido' : '🔒 Solo tuyo')+' · creado por '+esc(nombreDe(it.owner))
      + (it.notas ? '<div style="margin-top:8px;padding:8px 10px;background:#f1f6fd;border-radius:8px;font-size:.84rem">'+esc(it.notas)+'</div>' : '') + '</div>'
      + '<div style="font-size:.78rem;color:#70757a;margin-top:12px">Para cambiarlo, hazlo en la agenda azul. Aquí aparece solo para que veas tu día completo.</div>'
      + '<div class="agg-acc"><a class="agg-sec" style="text-decoration:none;display:inline-block" href="'+esc(URL_AGENDA)+'" target="_blank" rel="noopener">Abrir agenda azul</a><button class="agg-sec" id="fam-cerrar">Cerrar</button></div></div>';
    document.body.appendChild(m);
    document.getElementById('fam-cerrar').onclick = function(){ m.remove(); };
  }

  // ---------- panel lateral: conectar / mostrar u ocultar ----------
  function pintarPanel(){
    try {
      if(!esDuena()) return;
      var side = document.querySelector('#ag-container .agg-side'); if(!side || side.querySelector('.fam-box')) return;
      var box = document.createElement('div'); box.className = 'fam-box';
      var h = '<div class="agg-cal-tit" style="margin-top:14px">Familia</div>';
      if(estado === 'conectado'){
        var on = agCalOcultos().indexOf(CLAVE_OCULTO) < 0;
        h += '<div class="agg-cal-item"><label><input type="checkbox" '+(on?'checked':'')+' onchange="agCalToggle(\''+CLAVE_OCULTO+'\')" style="accent-color:#2b7de9"><span>👨‍👦 Con '+esc(otroNombre())+'</span></label></div>'
          + '<button class="agg-link" id="fam-desc" style="color:#70757a;font-size:.74rem">Desconectar de la agenda azul</button>';
      } else if(estado === 'conectando'){
        h += '<div style="font-size:.8rem;color:#70757a">Conectando con la agenda azul…</div>';
      } else {
        h += '<button class="agg-link" id="fam-con">👨‍👦 Conectar agenda azul</button>'
          + (estado === 'error' ? '<div style="font-size:.74rem;color:#d93025">No se pudo leer la agenda. Intenta conectar de nuevo.</div>' : '');
      }
      box.innerHTML = h; side.appendChild(box);
      var c = document.getElementById('fam-con'); if(c) c.onclick = pedirClave;
      var d = document.getElementById('fam-desc'); if(d) d.onclick = function(){ try { auth.signOut(); } catch(e){} };
    } catch(e){ console.warn('[familia]', e); }
  }
  var oRender = window.agRenderHorario;
  window.agRenderHorario = function(){
    var r = oRender.apply(this, arguments);
    asegurar();
    pintarPanel();
    return r;
  };

  function pedirClave(){
    if(typeof agGCerrarModal === 'function') agGCerrarModal();
    var m = document.createElement('div'); m.id = 'agg-modal'; m.className = 'agg-modal-bg';
    m.onclick = function(ev){ if(ev.target === m) m.remove(); };
    m.innerHTML = '<div class="agg-modal" style="max-width:380px"><div style="font-size:1.1rem;font-weight:700;color:#3c4043;margin-bottom:6px">👨‍👦 Conectar la agenda azul</div>'
      + '<div style="font-size:.82rem;color:#70757a;margin-bottom:12px">Escribe la clave de tu usuario <b>mama</b> de la agenda azul. Se escribe una sola vez; este computador la recuerda. La Suite solo lee la agenda, no la modifica.</div>'
      + '<input id="fam-clave" type="password" autocomplete="current-password" placeholder="Clave de la agenda azul" style="width:100%;box-sizing:border-box;padding:10px;border:1.5px solid #dadce0;border-radius:8px;font-size:1rem">'
      + '<div id="fam-err" style="color:#d93025;font-size:.8rem;min-height:1.2em;margin-top:6px"></div>'
      + '<div class="agg-acc"><button class="agg-sec" id="fam-no">Cancelar</button><button class="agg-pri" id="fam-ok">Conectar</button></div></div>';
    document.body.appendChild(m);
    var inp = document.getElementById('fam-clave'); setTimeout(function(){ inp.focus(); }, 50);
    function ir(){
      var ok = document.getElementById('fam-ok'), er = document.getElementById('fam-err');
      if(!inp.value){ er.textContent = 'Escribe la clave.'; return; }
      ok.disabled = true; er.textContent = '';
      auth.signInWithEmailAndPassword(CORREO, inp.value).then(function(){ m.remove(); toast2('Agenda azul conectada ✓'); })
        .catch(function(e){
          ok.disabled = false;
          er.textContent = (e && e.code === 'auth/too-many-requests') ? 'Demasiados intentos. Espera unos minutos.' : 'Clave incorrecta o sin conexión.';
        });
    }
    document.getElementById('fam-ok').onclick = ir;
    inp.addEventListener('keydown', function(ev){ if(ev.key === 'Enter') ir(); });
    document.getElementById('fam-no').onclick = function(){ m.remove(); };
  }

  // Si alguien arrastra un evento de la agenda azul (no se puede mover desde aquí), que no se abra la ventana al soltarlo
  var bajo = null;
  document.addEventListener('pointerdown', function(ev){
    var el = ev.target && ev.target.closest && ev.target.closest('.agg-ev');
    bajo = (el && String(el.getAttribute('data-id')||'').indexOf('fam_') === 0) ? {x:ev.clientX, y:ev.clientY} : null;
  }, true);
  document.addEventListener('click', function(ev){
    if(bajo && Math.hypot(ev.clientX - bajo.x, ev.clientY - bajo.y) > 6){ ev.stopPropagation(); ev.preventDefault(); }
    bajo = null;
  }, true);

  iniciar();
  setTimeout(rerender, 300);      // por si el calendario ya estaba abierto cuando cargó este archivo
})();
