/* ===========================================================================
   MIGRACIÓN (se usa UNA sola vez): copia tu cédula, tu tarjeta profesional y tu firma
   desde el código de la página a tu nube privada (suitedata/img_*), que solo se abre
   con tu usuario y clave. Cuando termina, avisa. Después de eso, las imágenes se
   quitan del código y este archivo se borra.
   No borra ni cambia nada: solo copia lo que todavía no esté guardado en la nube.
   =========================================================================== */
(function(){
  if(window.__migImg) return; window.__migImg = true;
  var PARES = [['img_cedula', function(){ return typeof CEDULA_IMG==='undefined' ? '' : CEDULA_IMG; }],
               ['img_tarjeta', function(){ return typeof TARJETA_IMG==='undefined' ? '' : TARJETA_IMG; }],
               ['img_firma', function(){ return typeof FIRMA_B64==='undefined' ? '' : FIRMA_B64; }]];
  function aviso(m){ try { if(typeof toast==='function') toast(m); } catch(e){} }
  function intentar(n){
    try {
      if(window.ROL_ACTUAL !== 'duena' || typeof DB==='undefined' || !DB._loaded){ if(n < 900) setTimeout(function(){ intentar(n+1); }, 1000); return; }
      var nuevos = 0, faltan = 0;
      PARES.forEach(function(p){
        var v = p[1](), ya = DB.get(p[0]);
        if(typeof ya === 'string' && ya.indexOf('data:image') === 0) return;          // ya está guardada
        if(typeof v === 'string' && v.indexOf('data:image') === 0){ DB.set(p[0], v); nuevos++; }
        else faltan++;
      });
      if(nuevos){
        setTimeout(function(){
          var ok = PARES.every(function(p){ var x = DB.get(p[0]); return typeof x==='string' && x.indexOf('data:image')===0; });
          aviso(ok && !DB.pendientes() ? '🔒 Cédula, tarjeta y firma guardadas en tu nube privada ✓' : '⚠️ Las imágenes aún se están guardando. Espera y recarga.');
        }, 6000);
      }
    } catch(e){ console.warn('[migración]', e); }
  }
  intentar(0);
})();
