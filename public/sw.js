// Service worker minimal : se désinstalle et recharge les pages ouvertes.
// Sert à nettoyer les navigateurs qui auraient gardé un ancien service worker.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => {
  event.waitUntil(
    self.registration.unregister()
      .then(() => self.clients.matchAll())
      .then(clients => clients.forEach(c => c.navigate(c.url)))
  );
});
