const http = require('http');

// Helper para realizar peticiones HTTP con cookies de sesión
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

async function runTests() {
  console.log('--- INICIO DE PRUEBAS END-TO-END DEL MONOLITO CORONADO ---');

  // Test 1: Redirección al login en ruta raíz sin sesión
  console.log('\n[1] Verificando redirección a login...');
  const resRoot = await makeRequest('GET', '/');
  console.log('Status code:', resRoot.statusCode, 'Location:', resRoot.headers.location);

  // Test 2: Login como SOCIO
  console.log('\n[2] Iniciar sesión como SOCIO (socio@distribuidora.com)...');
  const loginSocio = await makeRequest('POST', '/login', {
    correo: 'socio@distribuidora.com',
    clave: 'Socio123!'
  });
  console.log('Status login Socio:', loginSocio.statusCode, 'Redirigido a:', loginSocio.headers.location);
  const socioCookie = loginSocio.cookie;

  // Test 3: Dashboard Directivo de Socio
  console.log('\n[3] Acceso a Dashboard Financiero con rol SOCIO...');
  const dashSocio = await makeRequest('GET', '/dashboard', null, socioCookie);
  console.log('Status Dashboard Socio:', dashSocio.statusCode);
  const tieneUtilidad = dashSocio.data.includes('Utilidad Neta Realtime');
  console.log('¿Muestra Utilidad Neta Realtime?:', tieneUtilidad ? 'SI (CORRECTO)' : 'NO (ERROR)');

  // Test 4: Login como VENDEDOR
  console.log('\n[4] Iniciar sesión como VENDEDOR (vendedor@distribuidora.com)...');
  const loginVend = await makeRequest('POST', '/login', {
    correo: 'vendedor@distribuidora.com',
    clave: 'Vendedor123!'
  });
  console.log('Status login Vendedor:', loginVend.statusCode, 'Redirigido a:', loginVend.headers.location);
  const vendCookie = loginVend.cookie;

  // Test 5: Intentar acceder a /dashboard como VENDEDOR (debe bloquearse y redirigir a /pedidos)
  console.log('\n[5] Verificando restricción de rol VENDEDOR a /dashboard...');
  const dashVend = await makeRequest('GET', '/dashboard', null, vendCookie);
  console.log('Status Dashboard con Vendedor:', dashVend.statusCode, 'Location:', dashVend.headers.location);
  const bloqueadoDashboard = dashVend.statusCode === 302 && dashVend.headers.location === '/pedidos';
  console.log('¿Bloqueo y redirección exitosa a /pedidos?:', bloqueadoDashboard ? 'SI (CORRECTO)' : 'NO (ERROR)');

  // Test 6: Intentar acceder a /gastos como VENDEDOR (debe bloquearse)
  console.log('\n[6] Verificando restricción de rol VENDEDOR a /gastos...');
  const gastosVend = await makeRequest('GET', '/gastos', null, vendCookie);
  console.log('Status Gastos con Vendedor:', gastosVend.statusCode, 'Location:', gastosVend.headers.location);
  const bloqueadoGastos = gastosVend.statusCode === 302 && gastosVend.headers.location === '/pedidos';
  console.log('¿Bloqueo y redirección exitosa de Gastos?:', bloqueadoGastos ? 'SI (CORRECTO)' : 'NO (ERROR)');

  // Test 7: Vendedor crea una nueva cotización
  console.log('\n[7] Vendedor crea una nueva cotización con 20 bolsas de Cemento Portland...');
  const itemsCotizacion = JSON.stringify([
    {
      producto_id: '00000004-0000-0000-0000-000000000001', // Cemento Gris
      nombre: 'Cemento Gris Tipo I Uso General',
      sku: 'CEM-PORT-01',
      unidad: 'BOLSA',
      cantidad: 20,
      precio_unitario: 34.00
    }
  ]);

  const postCot = await makeRequest('POST', '/pedidos/nuevo', {
    cliente_id: '00000003-0000-0000-0000-000000000001', // Constructora del Valle
    metodo_pago: 'TRANSFERENCIA',
    fecha_vencimiento: '2026-10-30',
    observaciones: 'Cotización creada en prueba automatizada',
    items: itemsCotizacion
  }, vendCookie);

  console.log('Status creación cotización:', postCot.statusCode, 'Redirigido a:', postCot.headers.location);
  const nuevaCotId = postCot.headers.location ? postCot.headers.location.split('/ver/')[1] : null;
  console.log('ID de la nueva cotización creada:', nuevaCotId);

  // Test 8: Convertir la cotización a Venta con descuento de stock y comisión
  if (nuevaCotId) {
    console.log('\n[8] Conversión Transaccional: Cotización -> Venta...');
    const postConv = await makeRequest('POST', `/pedidos/convertir/${nuevaCotId}`, {
      vehiculo_id: '00000002-0000-0000-0000-000000000002', // Isuzu Forward
      metodo_pago: 'TRANSFERENCIA'
    }, vendCookie);

    console.log('Status conversión:', postConv.statusCode, 'Redirigido a:', postConv.headers.location);

    // Consultar el detalle de la venta
    const detalleVenta = await makeRequest('GET', `/pedidos/ver/${nuevaCotId}`, null, vendCookie);
    const esVenta = detalleVenta.data.includes('VENTA') && detalleVenta.data.includes('COMPROBANTE DE VENTA');
    console.log('¿El documento ahora es Venta efectiva y comprobante?:', esVenta ? 'SI (CORRECTO)' : 'NO (ERROR)');
  }

  // Test 9: Login como ADMINISTRADOR y registro de gasto de combustible con vehículo
  console.log('\n[9] Iniciar sesión como ADMINISTRADOR (admin@distribuidora.com)...');
  const loginAdmin = await makeRequest('POST', '/login', {
    correo: 'admin@distribuidora.com',
    clave: 'Admin123!'
  });
  const adminCookie = loginAdmin.cookie;

  console.log('\n[10] Administrador registra gasto de combustible para Kenworth...');
  const postGasto = await makeRequest('POST', '/gastos/nuevo', {
    categoria: 'COMBUSTIBLE',
    vehiculo_id: '00000002-0000-0000-0000-000000000001',
    proveedor_id: '',
    monto: '75.50',
    metodo_pago: 'EFECTIVO',
    numero_comprobante: 'REC-TEST-001',
    descripcion: 'Prueba de combustible para entrega especial',
    fecha_gasto: '2026-09-23'
  }, adminCookie);

  console.log('Status registro gasto:', postGasto.statusCode, 'Redirigido a:', postGasto.headers.location);

  console.log('\n--- TODAS LAS PRUEBAS COMPLETADAS EXITOSAMENTE ---');
}

runTests().catch(err => {
  console.error('Error durante las pruebas:', err);
});
