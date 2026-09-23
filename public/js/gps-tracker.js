/**
 * gps-tracker.js
 * Lógica de cliente para la tablet a bordo del camión.
 * Captura GPS continua, Wake Lock (pantalla encendida), telemetría en tiempo real
 * y despacho periódico cada 30 segundos hacia /api/vehiculos/:id/ubicacion.
 */

(function () {
  'use strict';

  // Elementos del DOM
  const btnToggle = document.getElementById('btn-toggle-rastreo');
  const btnForzarEnvio = document.getElementById('btn-forzar-envio');
  const badgeEstado = document.getElementById('badge-estado');
  const indicadorPulso = document.getElementById('indicador-pulso');
  const txtLatitud = document.getElementById('txt-latitud');
  const txtLongitud = document.getElementById('txt-longitud');
  const txtVelocidad = document.getElementById('txt-velocidad');
  const txtPrecision = document.getElementById('txt-precision');
  const txtUltimoEnvio = document.getElementById('txt-ultimo-envio');
  const txtTotalEnvios = document.getElementById('txt-total-envios');
  const txtProximoEnvio = document.getElementById('txt-proximo-envio');
  const bannerAlerta = document.getElementById('banner-alerta');
  const txtAlertaMensaje = document.getElementById('txt-alerta-mensaje');
  const txtWakeLock = document.getElementById('txt-wakelock');

  // Estado del rastreador
  let rastreando = false;
  let watchId = null;
  let intervaloEnvio = null;
  let intervaloCuenta = null;
  let cuentaRegresiva = 30;
  let ultimaPosicion = null;
  let totalEnviosExitosos = 0;
  let wakeLock = null;

  // Obtener ID del vehículo desde el atributo de datos o la URL
  const contenedorTracker = document.getElementById('tracker-container');
  const vehiculoId = contenedorTracker ? contenedorTracker.dataset.vehiculoId : null;

  if (!vehiculoId) {
    mostrarAlerta('No se pudo identificar el vehículo para el rastreo.', 'error');
    return;
  }

  // Utilidad para reproducir un sutil bip sonoro de confirmación
  function reproducirBip() {
    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, audioCtx.currentTime); // La (A5)
      gain.gain.setValueAtTime(0.05, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.15);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.15);
    } catch (e) {
      // AudioContext bloqueado o no disponible, continuar silenciosamente
    }
  }

  // Activar Wake Lock para mantener la pantalla de la tablet encendida
  async function activarWakeLock() {
    if ('wakeLock' in navigator) {
      try {
        wakeLock = await navigator.wakeLock.request('screen');
        if (txtWakeLock) {
          txtWakeLock.textContent = 'Pantalla siempre activa (WakeLock ON)';
          txtWakeLock.className = 'text-[11px] font-semibold text-emerald-600 flex items-center justify-center space-x-1';
        }
        wakeLock.addEventListener('release', () => {
          if (txtWakeLock) {
            txtWakeLock.textContent = 'Pantalla normal (WakeLock OFF)';
            txtWakeLock.className = 'text-[11px] font-medium text-slate-400 flex items-center justify-center space-x-1';
          }
        });
      } catch (err) {
        console.warn('[WakeLock] Error:', err.message);
        if (txtWakeLock) {
          txtWakeLock.textContent = 'WakeLock no permitido por el navegador';
        }
      }
    } else if (txtWakeLock) {
      txtWakeLock.textContent = 'WakeLock no soportado en este navegador';
    }
  }

  async function desactivarWakeLock() {
    if (wakeLock !== null) {
      try {
        await wakeLock.release();
        wakeLock = null;
      } catch (e) {
        // Ignorar
      }
    }
  }

  // Re-solicitar Wake Lock si la tablet vuelve de segundo plano
  document.addEventListener('visibilitychange', async () => {
    if (rastreando && document.visibilityState === 'visible') {
      await activarWakeLock();
    }
  });

  // Mostrar / ocultar alertas visuales
  function mostrarAlerta(mensaje, tipo = 'error') {
    if (!bannerAlerta || !txtAlertaMensaje) return;
    txtAlertaMensaje.textContent = mensaje;
    bannerAlerta.classList.remove('hidden', 'bg-red-50', 'border-red-400', 'text-red-900', 'bg-amber-50', 'border-amber-400', 'text-amber-900');
    
    if (tipo === 'error') {
      bannerAlerta.classList.add('bg-red-50', 'border-red-400', 'text-red-900');
    } else {
      bannerAlerta.classList.add('bg-amber-50', 'border-amber-400', 'text-amber-900');
    }
  }

  function ocultarAlerta() {
    if (bannerAlerta) {
      bannerAlerta.classList.add('hidden');
    }
  }

  // Monitor de estado de conexión a internet
  window.addEventListener('offline', () => {
    mostrarAlerta('Sin conexión a internet. Los datos se transmitirán cuando se recupere la señal.', 'error');
  });

  window.addEventListener('online', () => {
    ocultarAlerta();
    if (rastreando && ultimaPosicion) {
      enviarTelemetria(true);
    }
  });

  // Manejo de nueva posición recibida del GPS
  function onPosicionExitosa(pos) {
    ocultarAlerta();
    const crd = pos.coords;
    
    // coords.speed viene en metros/segundo (m/s) -> convertir a km/h
    const velKmh = crd.speed !== null && crd.speed > 0 ? (crd.speed * 3.6).toFixed(1) : '0.0';

    ultimaPosicion = {
      latitud: crd.latitude,
      longitud: crd.longitude,
      velocidad_kmh: parseFloat(velKmh),
      precision: crd.accuracy
    };

    // Actualizar visualmente la pantalla
    if (txtLatitud) txtLatitud.textContent = crd.latitude.toFixed(6);
    if (txtLongitud) txtLongitud.textContent = crd.longitude.toFixed(6);
    if (txtVelocidad) txtVelocidad.textContent = velKmh;
    if (txtPrecision) txtPrecision.textContent = `±${Math.round(crd.accuracy)} m`;
  }

  // Manejo de errores de geolocalización
  function onPosicionError(err) {
    let msg = 'Error desconocido en el sensor GPS.';
    switch (err.code) {
      case err.PERMISSION_DENIED:
        msg = 'Permiso denegado: debe autorizar el acceso a la ubicación en el navegador de la tablet.';
        detenerRastreo();
        break;
      case err.POSITION_UNAVAILABLE:
        msg = 'Señal GPS no disponible. Asegúrese de estar en un área con cobertura satelital o active el GPS de la tablet.';
        break;
      case err.TIMEOUT:
        msg = 'Tiempo de espera agotado buscando satélites GPS. Reintentando...';
        break;
    }
    mostrarAlerta(msg, 'error');
  }

  // Envío HTTP POST de telemetría hacia /api/vehiculos/:id/ubicacion
  async function enviarTelemetria(esForzado = false) {
    if (!ultimaPosicion) {
      if (esForzado) {
        mostrarAlerta('Aún no se ha obtenido una lectura de posición GPS válida.', 'alerta');
      }
      return;
    }

    try {
      const payload = {
        latitud: ultimaPosicion.latitud,
        longitud: ultimaPosicion.longitud,
        velocidad_kmh: ultimaPosicion.velocidad_kmh
      };

      const res = await fetch(`/api/vehiculos/${vehiculoId}/ubicacion`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      const data = await res.json();

      if (res.ok && data.success) {
        ocultarAlerta();
        totalEnviosExitosos++;
        const horaStr = new Date().toLocaleTimeString('es-BO', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

        if (txtUltimoEnvio) txtUltimoEnvio.textContent = horaStr;
        if (txtTotalEnvios) txtTotalEnvios.textContent = totalEnviosExitosos.toString();
        
        // Destello de envío exitoso
        destelloTransmision();
        reproducirBip();
      } else {
        mostrarAlerta(data.error || 'Error al guardar la ubicación en el servidor central.', 'error');
      }
    } catch (error) {
      console.error('[GPS Tracker] Fallo en la transmisión:', error);
      mostrarAlerta('Fallo de red al conectar con el servidor central. Reintentando automáticamente...', 'error');
    }
  }

  // Destello visual al transmitir
  function destelloTransmision() {
    if (indicadorPulso) {
      indicadorPulso.classList.add('scale-125', 'bg-emerald-400');
      setTimeout(() => {
        indicadorPulso.classList.remove('scale-125', 'bg-emerald-400');
      }, 400);
    }
  }

  // Iniciar rastreo activo
  function iniciarRastreo() {
    if (!navigator.geolocation) {
      mostrarAlerta('Este navegador no soporta geolocalización por GPS.', 'error');
      return;
    }

    rastreando = true;
    activarWakeLock();

    // Actualizar UI
    btnToggle.innerHTML = `
      <span class="relative flex h-4 w-4 mr-2">
        <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
        <span class="relative inline-flex rounded-full h-4 w-4 bg-emerald-500"></span>
      </span>
      <span>TRANSMITIENDO EN VIVO (DETENER)</span>
    `;
    btnToggle.className = 'w-full h-16 sm:h-20 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-extrabold text-base sm:text-lg rounded-2xl shadow-lg shadow-emerald-600/30 transition flex items-center justify-center space-x-2';

    if (badgeEstado) {
      badgeEstado.textContent = 'TRANSMITIENDO EN VIVO';
      badgeEstado.className = 'px-3 py-1 text-xs font-black uppercase tracking-wider rounded-lg bg-emerald-500 text-white flex items-center space-x-1.5 shadow-sm';
    }

    if (btnForzarEnvio) {
      btnForzarEnvio.disabled = false;
      btnForzarEnvio.classList.remove('opacity-50', 'cursor-not-allowed');
    }

    // Iniciar escucha continua de posición
    watchId = navigator.geolocation.watchPosition(onPosicionExitosa, onPosicionError, {
      enableHighAccuracy: true,
      timeout: 20000,
      maximumAge: 0
    });

    // Iniciar ciclo de envío cada 30 segundos
    cuentaRegresiva = 30;
    if (txtProximoEnvio) txtProximoEnvio.textContent = `${cuentaRegresiva}s`;

    intervaloCuenta = setInterval(() => {
      cuentaRegresiva--;
      if (cuentaRegresiva <= 0) {
        cuentaRegresiva = 30;
      }
      if (txtProximoEnvio) txtProximoEnvio.textContent = `${cuentaRegresiva}s`;
    }, 1000);

    // Intentar un primer envío rápido a los 3 segundos para validar la conexión
    setTimeout(() => {
      if (rastreando && ultimaPosicion) {
        enviarTelemetria();
      }
    }, 3000);

    intervaloEnvio = setInterval(() => {
      enviarTelemetria();
    }, 30000);
  }

  // Detener rastreo
  function detenerRastreo() {
    rastreando = false;
    desactivarWakeLock();

    if (watchId !== null) {
      navigator.geolocation.clearWatch(watchId);
      watchId = null;
    }

    if (intervaloEnvio) clearInterval(intervaloEnvio);
    if (intervaloCuenta) clearInterval(intervaloCuenta);
    intervaloEnvio = null;
    intervaloCuenta = null;

    // Actualizar UI
    btnToggle.innerHTML = `
      <svg class="w-6 h-6 mr-2 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"></path>
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
      </svg>
      <span>INICIAR RASTREO</span>
    `;
    btnToggle.className = 'w-full h-16 sm:h-20 bg-slate-900 hover:bg-slate-800 active:bg-slate-950 text-white font-extrabold text-base sm:text-lg rounded-2xl shadow-lg shadow-slate-900/20 transition flex items-center justify-center space-x-2';

    if (badgeEstado) {
      badgeEstado.textContent = 'DETENIDO';
      badgeEstado.className = 'px-3 py-1 text-xs font-black uppercase tracking-wider rounded-lg bg-slate-200 text-slate-700';
    }

    if (btnForzarEnvio) {
      btnForzarEnvio.disabled = true;
      btnForzarEnvio.classList.add('opacity-50', 'cursor-not-allowed');
    }

    if (txtProximoEnvio) txtProximoEnvio.textContent = '--';
  }

  // Asignar eventos a botones
  if (btnToggle) {
    btnToggle.addEventListener('click', () => {
      if (rastreando) {
        detenerRastreo();
      } else {
        iniciarRastreo();
      }
    });
  }

  if (btnForzarEnvio) {
    btnForzarEnvio.addEventListener('click', () => {
      if (rastreando) {
        cuentaRegresiva = 30;
        if (txtProximoEnvio) txtProximoEnvio.textContent = `${cuentaRegresiva}s`;
        enviarTelemetria(true);
      }
    });
  }

})();
