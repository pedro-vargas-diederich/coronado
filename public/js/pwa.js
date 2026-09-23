/**
 * PWA Client Script: Registro de Service Worker y Control Ergonómico de Instalación
 * Distribuidora Coronado
 */

let deferredPrompt = null;

// 1. Registro del Service Worker
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then((registration) => {
        console.log('[PWA] Service Worker registrado exitosamente con alcance:', registration.scope);
      })
      .catch((error) => {
        console.error('[PWA] Error al registrar Service Worker:', error);
      });
  });
}

// 2. Comprobar si ya se ejecuta en modo standalone (instalada)
function isRunningStandalone() {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    window.navigator.standalone === true ||
    document.referrer.includes('android-app://')
  );
}

// 3. Captura del evento de instalación nativo
window.addEventListener('beforeinstallprompt', (e) => {
  // Evitar que el navegador muestre automáticamente el mini-infobar estándar
  e.preventDefault();
  deferredPrompt = e;

  // Si ya está en modo standalone, no mostramos los botones de instalación
  if (isRunningStandalone()) {
    return;
  }

  // Mostrar todos los botones y contenedores de instalación configurados en la interfaz
  const installButtons = document.querySelectorAll('.pwa-install-trigger');
  const installBanners = document.querySelectorAll('.pwa-install-banner');

  installButtons.forEach((btn) => {
    btn.classList.remove('hidden');
    btn.removeAttribute('aria-hidden');
  });

  installBanners.forEach((banner) => {
    banner.classList.remove('hidden');
  });

  console.log('[PWA] Evento beforeinstallprompt capturado. Botones de instalación activados.');
});

// 4. Función global para disparar la instalación
async function triggerPwaInstall() {
  if (!deferredPrompt) {
    // Si no está disponible el prompt (ej. iOS Safari o escritorio manual), informar al usuario
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    if (isIOS) {
      alert("Para instalar en iOS: Presiona el botón de 'Compartir' en Safari y selecciona 'Añadir a pantalla de inicio' 📲");
      return;
    }
    console.log('[PWA] La instalación ya fue completada o no está disponible en este navegador.');
    return;
  }

  // Mostrar el cuadro de diálogo de instalación nativo
  deferredPrompt.prompt();

  // Esperar la decisión del usuario
  const { outcome } = await deferredPrompt.userChoice;
  console.log(`[PWA] Elección del usuario: ${outcome}`);

  // Limpiar el evento para no volver a usarlo
  deferredPrompt = null;

  // Ocultar los botones de instalación
  ocultarBotonesInstalacion();
}

// 5. Ocultar botones tras instalación o descarte
function ocultarBotonesInstalacion() {
  document.querySelectorAll('.pwa-install-trigger').forEach((el) => {
    el.classList.add('hidden');
  });
  document.querySelectorAll('.pwa-install-banner').forEach((el) => {
    el.classList.add('hidden');
  });
}

// 6. Escuchar cuando la app ha sido instalada con éxito
window.addEventListener('appinstalled', (e) => {
  console.log('[PWA] ¡Aplicación instalada con éxito!');
  ocultarBotonesInstalacion();
});

// 7. Enlazar eventos de clic en el DOM cuando cargue el documento
document.addEventListener('DOMContentLoaded', () => {
  // Asignar evento click a todos los elementos con clase .pwa-install-trigger
  const buttons = document.querySelectorAll('.pwa-install-trigger');
  buttons.forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      triggerPwaInstall();
    });
  });

  // Botón para cerrar banner si el usuario no desea instalar ahora
  const dismissButtons = document.querySelectorAll('.pwa-dismiss-banner');
  dismissButtons.forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const banner = e.target.closest('.pwa-install-banner');
      if (banner) {
        banner.classList.add('hidden');
      }
    });
  });
});
