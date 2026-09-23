const db = require('./src/config/database');

const BASE_URL = 'http://localhost:3000';

async function login(email, password) {
  const body = new URLSearchParams({ correo: email, clave: password }).toString();
  const res = await fetch(`${BASE_URL}/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
    redirect: 'manual'
  });
  return res.headers.get('set-cookie');
}

async function testGPS() {
  console.log('=== INICIANDO PRUEBAS DEL MÓDULO DE SEGUIMIENTO EN VIVO (GPS) ===\n');

  try {
    // 1. Obtener vehículos activos de prueba
    const [vehiculos] = await db.query('SELECT id, placa, modelo, conductor_asignado FROM vehiculos WHERE activo = 1 ORDER BY placa ASC');
    if (vehiculos.length === 0) {
      throw new Error('No hay vehículos activos registrados en la base de datos.');
    }

    const testVehiculo = vehiculos[0];
    console.log(`[Vehículo de Prueba]: ${testVehiculo.placa} (${testVehiculo.modelo}) - Conductor: ${testVehiculo.conductor_asignado}`);

    // Iniciar sesión con distintos roles
    const socioCookie = await login('socio@distribuidora.com', 'Socio123!');
    const adminCookie = await login('admin@distribuidora.com', 'Admin123!');
    const vendedorCookie = await login('vendedor@distribuidora.com', 'Vendedor123!');

    // -------------------------------------------------------------
    // PRUEBA 1: Validación y Recepción de Coordenadas (POST /api/vehiculos/:id/ubicacion)
    // -------------------------------------------------------------
    console.log('\n--- PRUEBA 1: Receptor de Coordenadas (POST /api/vehiculos/:id/ubicacion) ---');

    // 1.1 Rechazo por coordenadas fuera de rango
    const resInvalida = await fetch(`${BASE_URL}/api/vehiculos/${testVehiculo.id}/ubicacion`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ latitud: 120.5, longitud: -66.15 }) // Latitud inválida > 90
    });
    const dataInvalida = await resInvalida.json();
    console.log(`Rechazo coordenadas inválidas: HTTP ${resInvalida.status} -> ${dataInvalida.error}`);
    if (resInvalida.status !== 400 || dataInvalida.success !== false) {
      throw new Error('FALLO: Se debió rechazar coordenadas con latitud > 90 con código 400.');
    }
    console.log('✓ OK: Validación de coordenadas geográficas correcta.');

    // 1.2 Rechazo por vehículo inexistente
    const resNoExiste = await fetch(`${BASE_URL}/api/vehiculos/00000000-0000-0000-0000-000000000000/ubicacion`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ latitud: -17.3895, longitud: -66.1568, velocidad_kmh: 40 })
    });
    if (resNoExiste.status !== 404) {
      throw new Error('FALLO: Se debió retornar 404 para vehículo inexistente.');
    }
    console.log('✓ OK: Validación de existencia de vehículo correcta (HTTP 404).');

    // 1.3 Inserción exitosa de primera posición
    const coord1 = {
      latitud: -17.38950000,
      longitud: -66.15680000,
      velocidad_kmh: 42.50
    };

    const resInsert = await fetch(`${BASE_URL}/api/vehiculos/${testVehiculo.id}/ubicacion`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(coord1)
    });
    const dataInsert = await resInsert.json();
    console.log(`Respuesta primer envío: HTTP ${resInsert.status} ->`, dataInsert.mensaje);
    if (resInsert.status !== 200 || !dataInsert.success) {
      throw new Error('FALLO: No se pudo guardar la ubicación inicial del vehículo.');
    }

    // Verificar en MySQL
    const [row1] = await db.query('SELECT * FROM ubicaciones_vehiculo WHERE vehiculo_id = ?', [testVehiculo.id]);
    if (row1.length !== 1 || parseFloat(row1[0].latitud).toFixed(4) !== (-17.3895).toFixed(4)) {
      throw new Error('FALLO: La ubicación en la tabla ubicaciones_vehiculo no coincide con lo enviado.');
    }
    console.log(`✓ OK: Inserción en base de datos verificada: Lat=${row1[0].latitud}, Lng=${row1[0].longitud}, Vel=${row1[0].velocidad_kmh} km/h`);

    // 1.4 Actualización de la misma unidad (ON DUPLICATE KEY UPDATE)
    const coord2 = {
      latitud: -17.39500000,
      longitud: -66.16200000,
      velocidad_kmh: 58.00
    };

    const resUpdate = await fetch(`${BASE_URL}/api/vehiculos/${testVehiculo.id}/ubicacion`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(coord2)
    });
    const dataUpdate = await resUpdate.json();
    console.log(`Respuesta segundo envío: HTTP ${resUpdate.status} ->`, dataUpdate.mensaje);

    // Verificar que siga existiendo exactamente 1 fila para esa unidad y con los datos nuevos
    const [row2] = await db.query('SELECT * FROM ubicaciones_vehiculo WHERE vehiculo_id = ?', [testVehiculo.id]);
    if (row2.length !== 1) {
      throw new Error(`FALLO: Debería haber exactamente 1 fila única por vehículo. Encontradas: ${row2.length}`);
    }
    if (parseFloat(row2[0].latitud).toFixed(4) !== (-17.3950).toFixed(4) || parseFloat(row2[0].velocidad_kmh) !== 58.00) {
      throw new Error('FALLO: ON DUPLICATE KEY UPDATE no actualizó correctamente las nuevas coordenadas.');
    }
    console.log(`✓ OK: ON DUPLICATE KEY UPDATE verificado exitosamente (Fila única actualizada: Lat=${row2[0].latitud}, Vel=${row2[0].velocidad_kmh} km/h).`);

    // -------------------------------------------------------------
    // PRUEBA 2: Seguridad y Consulta de Ubicaciones (GET /api/vehiculos/ubicaciones)
    // -------------------------------------------------------------
    console.log('\n--- PRUEBA 2: Consulta de Ubicaciones de Flota (GET /api/vehiculos/ubicaciones) ---');

    // 2.1 Intento sin autenticación -> 302 Redirección a login
    const resAnon = await fetch(`${BASE_URL}/api/vehiculos/ubicaciones`, { redirect: 'manual' });
    console.log(`Consulta anónima: HTTP ${resAnon.status}`);
    if (resAnon.status !== 302) {
      throw new Error('FALLO: Se debió bloquear el acceso anónimo con HTTP 302.');
    }
    console.log('✓ OK: Acceso anónimo bloqueado.');

    // 2.2 Intento con rol VENDEDOR -> 403 Forbidden
    const resVendedor = await fetch(`${BASE_URL}/api/vehiculos/ubicaciones`, {
      headers: { 'Cookie': vendedorCookie },
      redirect: 'manual'
    });
    console.log(`Consulta con rol VENDEDOR: HTTP ${resVendedor.status}`);
    if (resVendedor.status !== 403 && resVendedor.status !== 302) {
      throw new Error('FALLO: Rol VENDEDOR no debe tener acceso a las ubicaciones de la flota.');
    }
    console.log('✓ OK: Rol VENDEDOR correctamente bloqueado.');

    // 2.3 Acceso con rol ADMINISTRADOR -> 200 OK JSON
    const resAdmin = await fetch(`${BASE_URL}/api/vehiculos/ubicaciones`, {
      headers: { 'Cookie': adminCookie }
    });
    const dataAdmin = await resAdmin.json();
    console.log(`Consulta con rol ADMINISTRADOR: HTTP ${resAdmin.status} -> Total vehículos: ${dataAdmin.total}`);
    if (resAdmin.status !== 200 || !dataAdmin.success || !Array.isArray(dataAdmin.vehiculos)) {
      throw new Error('FALLO: Rol ADMINISTRADOR debe recibir JSON con la lista de vehículos.');
    }

    // 2.4 Acceso con rol SOCIO -> 200 OK JSON
    const resSocio = await fetch(`${BASE_URL}/api/vehiculos/ubicaciones`, {
      headers: { 'Cookie': socioCookie }
    });
    const dataSocio = await resSocio.json();
    console.log(`Consulta con rol SOCIO: HTTP ${resSocio.status} -> Total vehículos: ${dataSocio.total}`);
    if (resSocio.status !== 200 || !dataSocio.success) {
      throw new Error('FALLO: Rol SOCIO debe recibir JSON con la lista de vehículos.');
    }

    // Verificar que el vehículo de prueba figure como 'EN_LINEA'
    const vehiculoEncontrado = dataSocio.vehiculos.find(v => v.vehiculo_id === testVehiculo.id);
    if (!vehiculoEncontrado) {
      throw new Error('FALLO: El vehículo de prueba no figura en la respuesta JSON.');
    }
    console.log(`Telemetría de ${vehiculoEncontrado.placa}: Estado=${vehiculoEncontrado.estado_gps}, Velocidad=${vehiculoEncontrado.velocidad_kmh} km/h, Tiempo=${vehiculoEncontrado.tiempo_relativo}`);
    if (vehiculoEncontrado.estado_gps !== 'EN_LINEA') {
      throw new Error(`FALLO: El vehículo que acaba de transmitir debería tener estado_gps = EN_LINEA. Obtenido: ${vehiculoEncontrado.estado_gps}`);
    }
    console.log('✓ OK: Cálculo de estado GPS en tiempo real verificado (EN_LINEA).');

    // -------------------------------------------------------------
    // PRUEBA 3: Renderizado de Vistas EJS
    // -------------------------------------------------------------
    console.log('\n--- PRUEBA 3: Renderizado de Vistas EJS ---');

    // 3.1 Vista de Monitoreo / Mapa (/vehiculos/mapa)
    const resMapa = await fetch(`${BASE_URL}/vehiculos/mapa`, {
      headers: { 'Cookie': socioCookie }
    });
    const htmlMapa = await resMapa.text();
    console.log(`GET /vehiculos/mapa: HTTP ${resMapa.status}`);
    if (resMapa.status !== 200 || !htmlMapa.toLowerCase().includes('leaflet') || !htmlMapa.includes('mapa-flota')) {
      throw new Error('FALLO: La vista /vehiculos/mapa no renderizó correctamente el mapa Leaflet.');
    }
    console.log('✓ OK: Vista /vehiculos/mapa renderizada con Leaflet y OpenStreetMap.');

    // 3.2 Vista del Emisor GPS para Tablet (/vehiculos/:id/gps-tracker)
    const resEmisor = await fetch(`${BASE_URL}/vehiculos/${testVehiculo.id}/gps-tracker`, {
      headers: { 'Cookie': vendedorCookie } // Accesible para tablet/conductor
    });
    const htmlEmisor = await resEmisor.text();
    console.log(`GET /vehiculos/:id/gps-tracker: HTTP ${resEmisor.status}`);
    if (resEmisor.status !== 200 || !htmlEmisor.includes('INICIAR RASTREO') || !htmlEmisor.includes('gps-tracker.js') || !htmlEmisor.includes(testVehiculo.placa)) {
      throw new Error('FALLO: La vista del emisor para tablet no renderizó los controles o el script.');
    }
    console.log('✓ OK: Vista /vehiculos/:id/gps-tracker renderizada con controles táctiles y gps-tracker.js.');

    // 3.3 Vista principal de Flota (/vehiculos)
    const resIndex = await fetch(`${BASE_URL}/vehiculos`, {
      headers: { 'Cookie': socioCookie }
    });
    const htmlIndex = await resIndex.text();
    if (!htmlIndex.includes('Mapa GPS en Vivo') || !htmlIndex.includes('Tablet GPS')) {
      throw new Error('FALLO: La vista principal de vehículos no contiene los botones de acceso al mapa y tablet GPS.');
    }
    console.log('✓ OK: Vista principal de vehículos incluye accesos a Mapa GPS y Tablet.');

    console.log('\n=== TODAS LAS PRUEBAS DEL MÓDULO GPS COMPLETADAS CON ÉXITO (100% OK) ===');

  } catch (err) {
    console.error('\n❌ ERROR EN LA SUITE DE PRUEBAS GPS:', err.message);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

testGPS();
