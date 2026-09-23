const http = require('http');

function makeRequest(method, path, body = null, cookie = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 3000,
      path: path,
      method: method,
      headers: {}
    };

    let postData = '';
    if (body) {
      if (typeof body === 'object') {
        postData = new URLSearchParams(body).toString();
        options.headers['Content-Type'] = 'application/x-www-form-urlencoded';
        options.headers['Content-Length'] = Buffer.byteLength(postData);
      } else {
        postData = body;
        options.headers['Content-Length'] = Buffer.byteLength(postData);
      }
    }

    if (cookie) {
      options.headers['Cookie'] = cookie;
    }

    const req = http.request(options, (res) => {
      let data = '';
      const setCookies = res.headers['set-cookie'];
      let newCookie = cookie;
      if (setCookies && setCookies.length > 0) {
        newCookie = setCookies[0].split(';')[0];
      }

      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          data: data,
          cookie: newCookie
        });
      });
    });

    req.on('error', err => reject(err));
    if (postData) req.write(postData);
    req.end();
  });
}

async function testAdminModules() {
  console.log('--- INICIO DE PRUEBAS: MÓDULOS DE VEHÍCULOS Y USUARIOS ---');

  // 1. Iniciar sesión como SOCIO
  console.log('\n[1] Login como SOCIO...');
  const loginSocio = await makeRequest('POST', '/login', {
    correo: 'socio@distribuidora.com',
    clave: 'Socio123!'
  });
  const socioCookie = loginSocio.cookie;

  // 2. Probar GET /vehiculos como SOCIO
  console.log('\n[2] Consultar listado de vehículos (/vehiculos)...');
  const listVeh = await makeRequest('GET', '/vehiculos', null, socioCookie);
  console.log('Status /vehiculos:', listVeh.statusCode);
  const tieneFlota = listVeh.data.includes('Flota de Vehículos') && listVeh.data.includes('Gastos Históricos Acumulados');
  console.log('¿Carga panel de flota con gastos acumulados?:', tieneFlota ? 'SI (OK)' : 'NO (ERROR)');

  // 3. Crear nuevo vehículo
  console.log('\n[3] Registrar nueva unidad en flota (POST /vehiculos)...');
  const postVeh = await makeRequest('POST', '/vehiculos', {
    placa: 'MACK-789',
    modelo: 'Tractocamión Mack Granite 20m3',
    conductor_asignado: 'Fernando Rojas'
  }, socioCookie);
  console.log('Status creación vehículo:', postVeh.statusCode, 'Location:', postVeh.headers.location);

  // 4. Iniciar sesión como ADMINISTRADOR
  console.log('\n[4] Login como ADMINISTRADOR...');
  const loginAdmin = await makeRequest('POST', '/login', {
    correo: 'admin@distribuidora.com',
    clave: 'Admin123!'
  });
  const adminCookie = loginAdmin.cookie;

  // 5. Administrador accede a /vehiculos (debe tener acceso)
  console.log('\n[5] Administrador accede a /vehiculos...');
  const adminVeh = await makeRequest('GET', '/vehiculos', null, adminCookie);
  console.log('Status /vehiculos para Admin:', adminVeh.statusCode);
  const adminVeFlota = adminVeh.data.includes('MACK-789');
  console.log('¿Admin visualiza la unidad creada MACK-789?:', adminVeFlota ? 'SI (OK)' : 'NO (ERROR)');

  // 6. Administrador intenta acceder a /usuarios (DEBE SER DENEGADO / REDIRIGIDO)
  console.log('\n[6] Administrador intenta acceder a /usuarios (Seguridad de rol)...');
  const adminUsers = await makeRequest('GET', '/usuarios', null, adminCookie);
  console.log('Status /usuarios para Admin:', adminUsers.statusCode, 'Location:', adminUsers.headers.location);
  const adminBloqueado = adminUsers.statusCode === 302 && adminUsers.headers.location === '/dashboard';
  console.log('¿Bloqueo a Administrador correcto?:', adminBloqueado ? 'SI (OK)' : 'NO (ERROR)');

  // 7. Socio accede a /usuarios
  console.log('\n[7] Socio accede a /usuarios...');
  const socioUsers = await makeRequest('GET', '/usuarios', null, socioCookie);
  console.log('Status /usuarios para Socio:', socioUsers.statusCode);
  const socioVeUsuarios = socioUsers.data.includes('Usuarios & Personal Interno') && socioUsers.data.includes('Solo Socio');
  console.log('¿Socio accede a panel de usuarios?:', socioVeUsuarios ? 'SI (OK)' : 'NO (ERROR)');

  // 8. Socio crea un nuevo Asesor Comercial con comisión del 4.25%
  const emailTest = `carlos.asesor.${Date.now()}@distribuidora.com`;
  console.log(`\n[8] Socio crea nuevo vendedor (${emailTest}) con comisión 4.25%...`);
  const postUser = await makeRequest('POST', '/usuarios', {
    nombre: 'Carlos Asesor Comercial',
    correo: emailTest,
    clave: 'Comercial123!',
    rol: 'VENDEDOR',
    porcentaje_comision: '4.25'
  }, socioCookie);
  console.log('Status creación usuario:', postUser.statusCode, 'Location:', postUser.headers.location);

  // 9. Login con el usuario recién creado
  console.log('\n[9] Probar inicio de sesión con el nuevo vendedor...');
  const loginNuevoVend = await makeRequest('POST', '/login', {
    correo: emailTest,
    clave: 'Comercial123!'
  });
  console.log('Status login nuevo vendedor:', loginNuevoVend.statusCode, 'Location:', loginNuevoVend.headers.location);
  const loginVendOk = loginNuevoVend.statusCode === 302 && loginNuevoVend.headers.location === '/pedidos';
  console.log('¿Login exitoso y redirigido a /pedidos?:', loginVendOk ? 'SI (OK)' : 'NO (ERROR)');

  // 10. Desactivar usuario y probar que ya no puede ingresar
  console.log('\n[10] Obtener ID del usuario creado y desactivar acceso...');
  const mysql = require('mysql2/promise');
  const pool = mysql.createPool({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'coronado_distribuidora_db'
  });

  const [uRows] = await pool.query('SELECT id, activo FROM usuarios WHERE correo = ?', [emailTest]);
  const newUserId = uRows[0].id;
  console.log('ID usuario:', newUserId, 'Estado inicial:', uRows[0].activo);

  const toggleRes = await makeRequest('POST', `/usuarios/${newUserId}/estado`, null, socioCookie);
  console.log('Status alternar estado:', toggleRes.statusCode, 'Location:', toggleRes.headers.location);

  const [uRowsAfter] = await pool.query('SELECT id, activo FROM usuarios WHERE id = ?', [newUserId]);
  console.log('Estado tras desactivar:', uRowsAfter[0].activo);

  // Probar login con cuenta inactiva
  console.log('\n[11] Intento de login con cuenta desactivada...');
  const loginInactivo = await makeRequest('POST', '/login', {
    correo: emailTest,
    clave: 'Comercial123!'
  });
  console.log('Status login inactivo:', loginInactivo.statusCode, 'Location:', loginInactivo.headers.location);
  const bloqueoInactivo = loginInactivo.statusCode === 302 && loginInactivo.headers.location === '/login';
  console.log('¿Bloqueo por cuenta inactiva correcto?:', bloqueoInactivo ? 'SI (OK)' : 'NO (ERROR)');

  // 12. Probar que Socio no puede desactivarse a sí mismo
  const [socioRows] = await pool.query('SELECT id FROM usuarios WHERE correo = ?', ['socio@distribuidora.com']);
  const socioId = socioRows[0].id;
  console.log('\n[12] Socio intenta desactivar su propia cuenta...');
  const selfToggle = await makeRequest('POST', `/usuarios/${socioId}/estado`, null, socioCookie);
  console.log('Status intento auto-desactivación:', selfToggle.statusCode);
  const [socioRowsAfter] = await pool.query('SELECT activo FROM usuarios WHERE id = ?', [socioId]);
  console.log('¿Socio sigue activo?:', socioRowsAfter[0].activo === 1 ? 'SI (PROTEGIDO)' : 'NO');

  await pool.end();
  console.log('\n--- PRUEBAS DE MÓDULOS DE ADMINISTRACIÓN FINALIZADAS CON ÉXITO ---');
}

testAdminModules().catch(err => console.error('Error en pruebas:', err));
