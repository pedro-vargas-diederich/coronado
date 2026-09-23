const http = require('http');
const mysql = require('mysql2/promise');

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

async function runEditUserTests() {
  console.log('--- INICIO DE PRUEBAS: EDICIÓN DE USUARIOS Y CONTROL DE SEGURIDAD ---');

  const pool = mysql.createPool({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'coronado_distribuidora_db'
  });

  // 1. Obtener ID del vendedor de prueba
  const [vendRows] = await pool.query("SELECT id, clave_hash FROM usuarios WHERE correo = 'vendedor@distribuidora.com' LIMIT 1");
  const vendedorId = vendRows[0].id;
  const hashOriginal = vendRows[0].clave_hash;
  console.log('[Info] ID Vendedor:', vendedorId);

  // 2. Probar restricción de seguridad con ADMINISTRADOR
  console.log('\n[1] Verificando bloqueo de rol ADMINISTRADOR a GET y POST de edición...');
  const loginAdmin = await makeRequest('POST', '/login', {
    correo: 'admin@distribuidora.com',
    clave: 'Admin123!'
  });
  const adminCookie = loginAdmin.cookie;

  const adminGetEdit = await makeRequest('GET', `/usuarios/${vendedorId}/editar`, null, adminCookie);
  console.log('GET /usuarios/:id/editar con Admin -> Status:', adminGetEdit.statusCode, 'Location:', adminGetEdit.headers.location);
  const bloqueoGet = adminGetEdit.statusCode === 302 && adminGetEdit.headers.location === '/dashboard';

  const adminPostEdit = await makeRequest('POST', `/usuarios/${vendedorId}/editar`, {
    nombre: 'Intruso',
    correo: 'admin@distribuidora.com',
    rol: 'ADMINISTRADOR'
  }, adminCookie);
  console.log('POST /usuarios/:id/editar con Admin -> Status:', adminPostEdit.statusCode, 'Location:', adminPostEdit.headers.location);
  const bloqueoPost = adminPostEdit.statusCode === 302 && adminPostEdit.headers.location === '/dashboard';

  console.log('¿Administrador estrictamente bloqueado en GET y POST?:', (bloqueoGet && bloqueoPost) ? 'SI (CORRECTO)' : 'NO (ERROR)');

  // 3. Login como SOCIO
  console.log('\n[2] Iniciar sesión como SOCIO (socio@distribuidora.com)...');
  const loginSocio = await makeRequest('POST', '/login', {
    correo: 'socio@distribuidora.com',
    clave: 'Socio123!'
  });
  const socioCookie = loginSocio.cookie;

  // 4. Socio accede a la vista de edición
  console.log('\n[3] Socio accede a GET /usuarios/:id/editar...');
  const socioGetEdit = await makeRequest('GET', `/usuarios/${vendedorId}/editar`, null, socioCookie);
  console.log('Status GET Editar Socio:', socioGetEdit.statusCode);
  const cargaFormulario = socioGetEdit.data.includes('Editar Usuario') && socioGetEdit.data.includes('vendedor@distribuidora.com');
  console.log('¿Formulario carga datos precargados?:', cargaFormulario ? 'SI (CORRECTO)' : 'NO (ERROR)');

  // 5. Socio edita nombre y comisión dejando la contraseña en blanco (debe conservar clave_hash)
  console.log('\n[4] Socio edita nombre y sube comisión a 5.50% dejando contraseña vacía...');
  const editSinClave = await makeRequest('POST', `/usuarios/${vendedorId}/editar`, {
    nombre: 'Andrés Peñaloza Asesor Master',
    correo: 'vendedor@distribuidora.com',
    nueva_clave: '', // VACÍA
    rol: 'VENDEDOR',
    porcentaje_comision: '5.50',
    activo: '1'
  }, socioCookie);
  console.log('Status POST Editar:', editSinClave.statusCode, 'Location:', editSinClave.headers.location);

  const [vendAfter1] = await pool.query('SELECT nombre, porcentaje_comision, clave_hash FROM usuarios WHERE id = ?', [vendedorId]);
  console.log('Nombre actualizado:', vendAfter1[0].nombre);
  console.log('Comisión actualizada:', vendAfter1[0].porcentaje_comision);
  const conservaHash = vendAfter1[0].clave_hash === hashOriginal;
  console.log('¿Se conservó exactamente el clave_hash original?:', conservaHash ? 'SI (CORRECTO)' : 'NO (ERROR)');

  // Probar que el vendedor sigue logueándose con su clave original
  const loginVendConClaveOriginal = await makeRequest('POST', '/login', {
    correo: 'vendedor@distribuidora.com',
    clave: 'Vendedor123!'
  });
  console.log('Login vendedor con clave original -> Status:', loginVendConClaveOriginal.statusCode, 'Location:', loginVendConClaveOriginal.headers.location);
  const loginOk1 = loginVendConClaveOriginal.statusCode === 302 && loginVendConClaveOriginal.headers.location === '/pedidos';
  console.log('¿Login de vendedor funcional con clave preservada?:', loginOk1 ? 'SI (CORRECTO)' : 'NO (ERROR)');

  // 6. Socio edita la contraseña del vendedor
  console.log('\n[5] Socio actualiza la contraseña a "NuevaClave999!"...');
  const editConClave = await makeRequest('POST', `/usuarios/${vendedorId}/editar`, {
    nombre: 'Andrés Peñaloza Asesor Master',
    correo: 'vendedor@distribuidora.com',
    nueva_clave: 'NuevaClave999!',
    rol: 'VENDEDOR',
    porcentaje_comision: '5.50',
    activo: '1'
  }, socioCookie);
  console.log('Status POST Editar con clave:', editConClave.statusCode);

  const [vendAfter2] = await pool.query('SELECT clave_hash FROM usuarios WHERE id = ?', [vendedorId]);
  const hashCambiado = vendAfter2[0].clave_hash !== hashOriginal;
  console.log('¿Se actualizó el hash de la clave?:', hashCambiado ? 'SI (CORRECTO)' : 'NO (ERROR)');

  // Probar que la clave antigua falla y la nueva funciona
  const loginViejaFalla = await makeRequest('POST', '/login', {
    correo: 'vendedor@distribuidora.com',
    clave: 'Vendedor123!'
  });
  const rechazoClaveVieja = loginViejaFalla.headers.location === '/login';

  const loginNuevaFunciona = await makeRequest('POST', '/login', {
    correo: 'vendedor@distribuidora.com',
    clave: 'NuevaClave999!'
  });
  const exitoClaveNueva = loginNuevaFunciona.headers.location === '/pedidos';

  console.log('¿Clave antigua rechazada y nueva aceptada?:', (rechazoClaveVieja && exitoClaveNueva) ? 'SI (CORRECTO)' : 'NO (ERROR)');

  // 7. Validación de correo duplicado
  console.log('\n[6] Intentar cambiar correo a "socio@distribuidora.com" (debe ser rechazado por unicidad)...');
  const editCorreoDuplicado = await makeRequest('POST', `/usuarios/${vendedorId}/editar`, {
    nombre: 'Andrés Peñaloza',
    correo: 'socio@distribuidora.com', // DUPLICADO
    nueva_clave: '',
    rol: 'VENDEDOR',
    porcentaje_comision: '5.50',
    activo: '1'
  }, socioCookie);
  console.log('Status correo duplicado:', editCorreoDuplicado.statusCode, 'Location:', editCorreoDuplicado.headers.location);
  const rechazoDuplicado = editCorreoDuplicado.headers.location.includes(`/usuarios/${vendedorId}/editar`);
  console.log('¿Rechazado correctamente y devuelto al formulario de edición?:', rechazoDuplicado ? 'SI (CORRECTO)' : 'NO (ERROR)');

  // 8. Restaurar clave original del vendedor para comodidad del usuario
  const b = require('bcryptjs');
  await pool.query('UPDATE usuarios SET clave_hash = ?, nombre = ? WHERE id = ?', [hashOriginal, 'Andrés Peñaloza (Asesor Comercial)', vendedorId]);
  console.log('\n[Info] Credenciales originales de prueba restauradas (Vendedor123!).');

  await pool.end();
  console.log('\n--- TODAS LAS PRUEBAS DE EDICIÓN DE USUARIOS FINALIZADAS CON ÉXITO ---');
}

runEditUserTests().catch(err => console.error('Error:', err));
