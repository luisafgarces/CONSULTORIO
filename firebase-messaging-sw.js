// Suite Clínica — recibe notificaciones push con la app cerrada.
// Las notificaciones que envía el servidor traen título y texto, así que el
// navegador las muestra solo; al tocarlas abre el enlace indicado en el envío.
importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyB-N6-kZ3_E9CxzKPom79TPJ1pBA3-M11c",
  authDomain: "consultorio-449a6.firebaseapp.com",
  projectId: "consultorio-449a6",
  storageBucket: "consultorio-449a6.firebasestorage.app",
  messagingSenderId: "853876080178",
  appId: "1:853876080178:web:a89b0d5b71ec077c66c62b"
});

const messaging = firebase.messaging();

// Respaldo: si algún día llega un mensaje solo con datos (sin título), se muestra igual.
messaging.onBackgroundMessage(function(payload){
  if(payload.notification) return; // ya la muestra el navegador
  var d = payload.data || {};
  return self.registration.showNotification(d.title || 'Suite Clínica', {
    body: d.body || '',
    icon: 'icon-192.png',
    badge: 'icon-192.png',
    tag: d.tag || undefined
  });
});
