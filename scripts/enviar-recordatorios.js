// Envía notificaciones push con el resumen de la agenda.
// MODO=anterior -> citas de MAÑANA (aviso de la tarde anterior)
// MODO=hoy      -> citas de HOY    (resumen de la mañana)
// Los textos son genéricos: no incluyen nombres de pacientes ni motivos.
'use strict';

const ZONA_OFFSET_HORAS = -5; // Colombia (UTC-5, sin horario de verano)
const URL_APP = 'https://luisafgarces.github.io/CONSULTORIO/';

// Fecha "YYYY-MM-DD" en hora de Colombia, desplazada `dias` días.
function fechaBogota(ahoraMs, dias) {
  const d = new Date(ahoraMs + ZONA_OFFSET_HORAS * 3600 * 1000 + (dias || 0) * 86400000);
  return d.toISOString().slice(0, 10);
}

// Citas (no administrativas) de una fecha. `inicio` viene como hora local "YYYY-MM-DDTHH:MM[:SS]".
function citasDelDia(eventos, fecha) {
  return (Array.isArray(eventos) ? eventos : [])
    .filter(e => e && typeof e.inicio === 'string' && e.tipo !== 'admin' && e.inicio.slice(0, 10) === fecha)
    .sort((a, b) => a.inicio.localeCompare(b.inicio));
}

function horaTexto(inicio) {
  let h = parseInt(inicio.slice(11, 13), 10);
  const m = inicio.slice(14, 16) || '00';
  const sufijo = h >= 12 ? 'p. m.' : 'a. m.';
  h = h % 12; if (h === 0) h = 12;
  return h + ':' + m + ' ' + sufijo;
}

function armarMensaje(modo, citas) {
  const n = citas.length;
  if (!n) return null;
  const cuando = modo === 'hoy' ? 'Hoy' : 'Mañana';
  const primera = horaTexto(citas[0].inicio);
  let cuerpo = n === 1
    ? cuando + ' tienes 1 cita a las ' + primera
    : cuando + ' tienes ' + n + ' citas. La primera es a las ' + primera;
  if (!cuerpo.endsWith('.')) cuerpo += '.';
  return { titulo: 'Suite Clínica', cuerpo };
}

async function main() {
  const modo = (process.env.MODO || 'anterior').toLowerCase();
  if (modo !== 'anterior' && modo !== 'hoy') throw new Error('MODO inválido: ' + modo);
  const crudo = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!crudo) throw new Error('Falta el secreto FIREBASE_SERVICE_ACCOUNT');

  const admin = require('firebase-admin');
  admin.initializeApp({ credential: admin.credential.cert(JSON.parse(crudo)) });
  const db = admin.firestore();

  const fechaObjetivo = fechaBogota(Date.now(), modo === 'anterior' ? 1 : 0);
  const marca = db.collection('notificaciones_estado').doc(modo + '_' + fechaObjetivo);
  if ((await marca.get()).exists) { console.log('Ya enviado para', fechaObjetivo, '— nada que hacer.'); return; }

  const doc = await db.collection('suitedata').doc('agenda_eventos').get();
  const eventos = doc.exists ? doc.data().value : [];
  const msg = armarMensaje(modo, citasDelDia(eventos, fechaObjetivo));
  if (!msg) { console.log('Sin citas para', fechaObjetivo, '— no se envía nada.'); return; }

  const snap = await db.collection('dispositivos_notificaciones').get();
  const tokens = snap.docs.map(d => d.id);
  if (!tokens.length) { console.log('No hay dispositivos registrados.'); return; }

  const resp = await admin.messaging().sendEachForMulticast({
    tokens,
    notification: { title: msg.titulo, body: msg.cuerpo },
    webpush: {
      notification: { icon: URL_APP + 'icon-192.png', badge: URL_APP + 'icon-192.png', tag: 'agenda-' + modo + '-' + fechaObjetivo },
      fcmOptions: { link: URL_APP }
    }
  });

  // Limpia dispositivos que ya no existen
  const borrar = [];
  resp.responses.forEach((r, i) => {
    const c = r.error && r.error.code;
    if (c === 'messaging/registration-token-not-registered' || c === 'messaging/invalid-registration-token') borrar.push(tokens[i]);
  });
  await Promise.all(borrar.map(t => db.collection('dispositivos_notificaciones').doc(t).delete()));

  console.log('Enviadas:', resp.successCount, '· Fallidas:', resp.failureCount, '· Limpiadas:', borrar.length);
  if (resp.successCount > 0) await marca.set({ enviado: new Date().toISOString(), citas: msg.cuerpo });
  if (resp.successCount === 0) process.exitCode = 1;
}

module.exports = { fechaBogota, citasDelDia, horaTexto, armarMensaje };

if (require.main === module) {
  main().catch(e => { console.error('Error:', e && e.message ? e.message : e); process.exit(1); });
}
