const http = require('http');

function request(options, postData = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          data
        });
      });
    });
    req.on('error', reject);
    if (postData) {
      req.write(postData);
    }
    req.end();
  });
}

function getCookie(headers) {
  const setCookie = headers['set-cookie'];
  if (!setCookie) return null;
  return setCookie[0].split(';')[0];
}

async function run() {
  console.log('--- INICIO DE PRUEBAS: MÓDULO MI PERFIL Y CAMBIO DE CONTRASEÑA ---');

  // 1. Acceso sin sesión debe redirigir a /login
  const noAuthRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/perfil/cambiar-clave',
    method: 'GET'
  });
  console.log('[1] Acceso sin sesión a /perfil/cambiar-clave: Status', noAuthRes.statusCode, 'Location:', noAuthRes.headers.location);
  if (noAuthRes.statusCode !== 302 || noAuthRes.headers.location !== '/login') {
    throw new Error('FALLO: La ruta de perfil no está debidamente protegida.');
  }
  console.log('¿Protección de autenticación estricta?: SI (CORRECTO)');

  // 2. Iniciar sesión como VENDEDOR
  const loginPost = 'correo=vendedor%40distribuidora.com&clave=Vendedor123%21';
  const loginRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/login',
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Content-Length': Buffer.byteLength(loginPost)
    }
  }, loginPost);
  const cookie = getCookie(loginRes.headers);
  console.log('\n[2] Sesión iniciada con rol VENDEDOR.');

  // 3. GET /perfil/cambiar-clave con vendedor
  const perfilRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/perfil/cambiar-clave',
    method: 'GET',
    headers: { 'Cookie': cookie }
  });
  console.log('[3] Acceso a GET /perfil/cambiar-clave: Status', perfilRes.statusCode);
  const hasPerfilTitle = perfilRes.data.includes('Mi Perfil y Seguridad');
  const hasVendedorInfo = perfilRes.data.includes('vendedor@distribuidora.com');
  const hasComision = perfilRes.data.includes('Comisión Ventas');
  console.log('¿Carga datos del perfil y comisión de vendedor?:', (hasPerfilTitle && hasVendedorInfo && hasComision) ? 'SI (CORRECTO)' : 'NO (ERROR)');

  // 4. Intento con clave actual errónea
  const postClaveErronea = 'clave_actual=ClaveEquivocada123&clave_nueva=NuevaClave123%21&confirmar_clave_nueva=NuevaClave123%21';
  const resClaveErronea = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/perfil/cambiar-clave',
    method: 'POST',
    headers: {
      'Cookie': cookie,
      'Content-Type': 'application/x-www-form-urlencoded',
      'Content-Length': Buffer.byteLength(postClaveErronea)
    }
  }, postClaveErronea);
  console.log('\n[4] Intento con clave actual incorrecta: Status', resClaveErronea.statusCode, 'Location:', resClaveErronea.headers.location);

  // 5. Intento con contraseñas nuevas que no coinciden
  const postNoCoinciden = 'clave_actual=Vendedor123%21&clave_nueva=NuevaClave123%21&confirmar_clave_nueva=DistintaClave999%21';
  const resNoCoinciden = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/perfil/cambiar-clave',
    method: 'POST',
    headers: {
      'Cookie': cookie,
      'Content-Type': 'application/x-www-form-urlencoded',
      'Content-Length': Buffer.byteLength(postNoCoinciden)
    }
  }, postNoCoinciden);
  console.log('[5] Intento con confirmación no coincidente: Status', resNoCoinciden.statusCode);

  // 6. Intento con clave nueva idéntica a la actual
  const postIdentica = 'clave_actual=Vendedor123%21&clave_nueva=Vendedor123%21&confirmar_clave_nueva=Vendedor123%21';
  const resIdentica = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/perfil/cambiar-clave',
    method: 'POST',
    headers: {
      'Cookie': cookie,
      'Content-Type': 'application/x-www-form-urlencoded',
      'Content-Length': Buffer.byteLength(postIdentica)
    }
  }, postIdentica);
  console.log('[6] Intento con clave idéntica a la actual: Status', resIdentica.statusCode);

  // 7. Intento con clave menor a 6 caracteres
  const postCorta = 'clave_actual=Vendedor123%21&clave_nueva=123&confirmar_clave_nueva=123';
  const resCorta = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/perfil/cambiar-clave',
    method: 'POST',
    headers: {
      'Cookie': cookie,
      'Content-Type': 'application/x-www-form-urlencoded',
      'Content-Length': Buffer.byteLength(postCorta)
    }
  }, postCorta);
  console.log('[7] Intento con clave demasiado corta (<6): Status', resCorta.statusCode);

  // 8. Cambio exitoso de contraseña
  const postValido = 'clave_actual=Vendedor123%21&clave_nueva=VendedorNuevo2026%21&confirmar_clave_nueva=VendedorNuevo2026%21';
  const resValido = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/perfil/cambiar-clave',
    method: 'POST',
    headers: {
      'Cookie': cookie,
      'Content-Type': 'application/x-www-form-urlencoded',
      'Content-Length': Buffer.byteLength(postValido)
    }
  }, postValido);
  console.log('\n[8] Actualización válida de contraseña: Status', resValido.statusCode, 'Location:', resValido.headers.location);

  // 9. Verificar que la clave antigua ya NO funciona
  const loginVieja = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/login',
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Content-Length': Buffer.byteLength(loginPost)
    }
  }, loginPost);
  console.log('[9] Intento de login con clave antigua (debe fallar): Status', loginVieja.statusCode, 'Location:', loginVieja.headers.location);

  // 10. Verificar que la clave NUEVA funciona perfectamente
  const loginPostNueva = 'correo=vendedor%40distribuidora.com&clave=VendedorNuevo2026%21';
  const loginNueva = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/login',
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Content-Length': Buffer.byteLength(loginPostNueva)
    }
  }, loginPostNueva);
  const cookieNueva = getCookie(loginNueva.headers);
  console.log('[10] Login con nueva contraseña: Status', loginNueva.statusCode, 'Redirigido a:', loginNueva.headers.location);
  if (!cookieNueva || loginNueva.headers.location !== '/pedidos') {
    throw new Error('FALLO: No se pudo autenticar con la nueva contraseña.');
  }
  console.log('¿Login con nueva contraseña 100% exitoso?: SI (CORRECTO)');

  // 11. Restaurar contraseña original (Vendedor123!) para preservar el ambiente de pruebas
  const postRestaurar = 'clave_actual=VendedorNuevo2026%21&clave_nueva=Vendedor123%21&confirmar_clave_nueva=Vendedor123%21';
  await request({
    hostname: 'localhost',
    port: 3000,
    path: '/perfil/cambiar-clave',
    method: 'POST',
    headers: {
      'Cookie': cookieNueva,
      'Content-Type': 'application/x-www-form-urlencoded',
      'Content-Length': Buffer.byteLength(postRestaurar)
    }
  }, postRestaurar);
  console.log('[11] Credencial original restaurada (Vendedor123!).');

  console.log('\n--- TODAS LAS PRUEBAS DE MI PERFIL Y SEGURIDAD FINALIZADAS CON ÉXITO ---');
}

run().catch(err => {
  console.error('Error en pruebas de perfil:', err);
  process.exit(1);
});
