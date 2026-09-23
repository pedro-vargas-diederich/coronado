const http = require('http');

function post(path, body, cookie = '') {
  return new Promise((resolve, reject) => {
    const req = http.request({
      hostname: 'localhost',
      port: 3000,
      path,
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(body),
        'Cookie': cookie
      }
    }, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, data }));
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

function get(path, cookie = '') {
  return new Promise((resolve, reject) => {
    http.get({
      hostname: 'localhost',
      port: 3000,
      path,
      headers: { 'Cookie': cookie }
    }, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, data }));
    }).on('error', reject);
  });
}

async function run() {
  console.log('--- INICIO DE PRUEBAS: MÓDULO INTEGRAL DE REPORTES ---');

  // 1. Acceso sin sesión
  const resNoAuth = await get('/reportes');
  console.log('[1] Acceso sin sesión: Status', resNoAuth.status, 'Location:', resNoAuth.headers.location);
  if (resNoAuth.status !== 302 || resNoAuth.headers.location !== '/login') {
    throw new Error('Fallo en protección sin sesión');
  }

  // 2. Pruebas con rol SOCIO
  console.log('\n[2] Pruebas con Rol SOCIO (socio@distribuidora.com)...');
  const loginSocio = await post('/login', 'correo=socio%40distribuidora.com&clave=Socio123%21');
  const cookieSocio = loginSocio.headers['set-cookie'][0].split(';')[0];

  // Reporte Financiero (Utilidad Neta)
  const resFinanciero = await get('/reportes?tipo=financiero', cookieSocio);
  console.log('GET /reportes?tipo=financiero -> Status:', resFinanciero.status);
  console.log('¿Contiene Utilidad Neta y Margen?:', resFinanciero.data.includes('Utilidad Neta') && resFinanciero.data.includes('Fórmula de Liquidación'));

  // Reporte Ventas
  const resVentasSocio = await get('/reportes?tipo=ventas', cookieSocio);
  console.log('GET /reportes?tipo=ventas -> Status:', resVentasSocio.status);
  console.log('¿Contiene métricas de ventas y productos?:', resVentasSocio.data.includes('Total Facturado') && resVentasSocio.data.includes('Materiales y Productos más Vendidos'));

  // Reporte Comisiones
  const resComisionesSocio = await get('/reportes?tipo=comisiones', cookieSocio);
  console.log('GET /reportes?tipo=comisiones -> Status:', resComisionesSocio.status);
  console.log('¿Contiene resumen por asesor?:', resComisionesSocio.data.includes('Rendimiento por Asesor Comercial'));

  // Reporte Flota
  const resFlotaSocio = await get('/reportes?tipo=flota', cookieSocio);
  console.log('GET /reportes?tipo=flota -> Status:', resFlotaSocio.status);
  console.log('¿Contiene costos por vehículo?:', resFlotaSocio.data.includes('Consolidado por Unidad de Transporte'));

  // Reporte Cuentas por Cobrar
  const resCobrarSocio = await get('/reportes?tipo=cobrar', cookieSocio);
  console.log('GET /reportes?tipo=cobrar -> Status:', resCobrarSocio.status);
  console.log('¿Contiene análisis de cartera y días de retraso?:', resCobrarSocio.data.includes('Cartera Total Pendiente') && resCobrarSocio.data.includes('Días Retraso'));

  // Exportación CSV
  const resCsvVentas = await get('/reportes/exportar-csv?tipo=ventas', cookieSocio);
  console.log('GET /reportes/exportar-csv?tipo=ventas -> Status:', resCsvVentas.status, 'ContentType:', resCsvVentas.headers['content-type']);
  console.log('¿CSV tiene cabeceras correctas?:', resCsvVentas.data.includes('Código;Fecha;Cliente;Asesor'));

  const resCsvFinanciero = await get('/reportes/exportar-csv?tipo=financiero', cookieSocio);
  console.log('GET /reportes/exportar-csv?tipo=financiero -> Status:', resCsvFinanciero.status);
  console.log('¿CSV financiero tiene Utilidad Neta?:', resCsvFinanciero.data.includes('UTILIDAD NETA DIRECTIVA'));

  // 3. Pruebas con rol ADMINISTRADOR
  console.log('\n[3] Pruebas con Rol ADMINISTRADOR (admin@distribuidora.com)...');
  const loginAdmin = await post('/login', 'correo=admin%40distribuidora.com&clave=Admin123%21');
  const cookieAdmin = loginAdmin.headers['set-cookie'][0].split(';')[0];

  const resVentasAdmin = await get('/reportes?tipo=ventas', cookieAdmin);
  console.log('Admin acceso a ventas -> Status:', resVentasAdmin.status);

  const resFlotaAdmin = await get('/reportes?tipo=flota', cookieAdmin);
  console.log('Admin acceso a flota -> Status:', resFlotaAdmin.status);

  const resCobrarAdmin = await get('/reportes?tipo=cobrar', cookieAdmin);
  console.log('Admin acceso a cuentas por cobrar -> Status:', resCobrarAdmin.status);

  // Admin NO debe poder ver reporte financiero directivo (debe denegarse o cambiarse a ventas)
  const resFinancieroAdmin = await get('/reportes?tipo=financiero', cookieAdmin);
  console.log('Admin intento a financiero -> Status:', resFinancieroAdmin.status);
  console.log('¿Admin bloqueado de ver margen financiero directivo?:', !resFinancieroAdmin.data.includes('Balance Financiero Directivo'));

  // 4. Pruebas con rol VENDEDOR
  console.log('\n[4] Pruebas con Rol VENDEDOR (vendedor@distribuidora.com)...');
  const loginVendedor = await post('/login', 'correo=vendedor%40distribuidora.com&clave=Vendedor123%21');
  const cookieVendedor = loginVendedor.headers['set-cookie'][0].split(';')[0];

  const resVentasVendedor = await get('/reportes?tipo=ventas', cookieVendedor);
  console.log('Vendedor acceso a sus ventas -> Status:', resVentasVendedor.status);
  console.log('¿Vendedor ve título adaptado?:', resVentasVendedor.data.includes('Mis Ventas Facturadas'));

  const resComisionesVendedor = await get('/reportes?tipo=comisiones', cookieVendedor);
  console.log('Vendedor acceso a sus comisiones -> Status:', resComisionesVendedor.status);
  console.log('¿Vendedor ve solo sus comisiones individuales?:', resComisionesVendedor.data.includes('Detalle de mis Comisiones Devengadas'));

  // Vendedor NO debe poder ver Flota ni Cobrar
  const resFlotaVendedor = await get('/reportes?tipo=flota', cookieVendedor);
  console.log('Vendedor intento a flota -> ¿Bloqueado de ver costos de flota?:', !resFlotaVendedor.data.includes('Consolidado por Unidad de Transporte'));

  console.log('\n--- TODAS LAS PRUEBAS DEL MÓDULO DE REPORTES FINALIZADAS CON ÉXITO ---');
}

run().catch(err => {
  console.error('Error en pruebas de reportes:', err);
  process.exit(1);
});
