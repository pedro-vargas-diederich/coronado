// Interacciones client-side para la interfaz móvil y de escritorio

document.addEventListener('DOMContentLoaded', () => {
  // Manejo del Drawer Móvil (Menú hamburguesa / botón Más)
  const drawer = document.getElementById('mobile-drawer');
  const openButtons = document.querySelectorAll('.toggle-mobile-drawer');
  const closeButtons = document.querySelectorAll('.close-mobile-drawer');
  const overlay = document.getElementById('mobile-drawer-overlay');

  function openDrawer() {
    if (drawer) {
      drawer.classList.remove('translate-x-full');
      if (overlay) overlay.classList.remove('hidden');
      document.body.classList.add('overflow-hidden');
    }
  }

  function closeDrawer() {
    if (drawer) {
      drawer.classList.add('translate-x-full');
      if (overlay) overlay.classList.add('hidden');
      document.body.classList.remove('overflow-hidden');
    }
  }

  openButtons.forEach(btn => btn.addEventListener('click', (e) => {
    e.preventDefault();
    openDrawer();
  }));

  closeButtons.forEach(btn => btn.addEventListener('click', (e) => {
    e.preventDefault();
    closeDrawer();
  }));

  if (overlay) {
    overlay.addEventListener('click', closeDrawer);
  }

  // Cierre de alertas flash
  const alertCloses = document.querySelectorAll('.alert-close');
  alertCloses.forEach(btn => {
    btn.addEventListener('click', (e) => {
      const container = e.target.closest('.flash-alert-item');
      if (container) {
        container.remove();
      }
    });
  });
});
