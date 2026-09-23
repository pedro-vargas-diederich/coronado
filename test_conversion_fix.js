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

async function test() {
  console.log('--- TEST DE CONVERSIÓN COTIZACIÓN A VENTA DIRECTA ---');
  // Login as Socio
  const loginRes = await post('/login', 'correo=socio%40distribuidora.com&clave=Socio123%21');
  const cookie = loginRes.headers['set-cookie'][0].split(';')[0];
  console.log('[1] Login Socio Status:', loginRes.status);

  // Check GET /pedidos/ver/00000005-0000-0000-0000-000000000002
  const viewRes = await get('/pedidos/ver/00000005-0000-0000-0000-000000000002', cookie);
  console.log('[2] View quote Status:', viewRes.status);
  console.log('¿Formulario POST presente?:', viewRes.data.includes('action="/pedidos/00000005-0000-0000-0000-000000000002/convertir"'));
  console.log('¿Confirmación onsubmit presente?:', viewRes.data.includes('onsubmit="return confirm('));
  console.log('¿Sin llamadas a JS modal inerte?:', !viewRes.data.includes('abrirModalConversion'));

  // Test POST /pedidos/00000005-0000-0000-0000-000000000002/convertir
  const convertRes = await post('/pedidos/00000005-0000-0000-0000-000000000002/convertir', '', cookie);
  console.log('[3] POST /pedidos/:id/convertir Status:', convertRes.status, 'Location:', convertRes.headers.location);

  // Verify it converted to VENTA
  const checkRes = await get(convertRes.headers.location, cookie);
  console.log('[4] Verificación tras conversión: Status', checkRes.status);
  console.log('¿Documento convertido en Venta?:', checkRes.data.includes('COMPROBANTE DE VENTA') || checkRes.data.includes('VENTA'));
  console.log('¿Botón de conversión desaparecido tras ser venta?:', !checkRes.data.includes('Convertir a Venta'));

  console.log('--- TEST COMPLETADO EXITOSAMENTE ---');
}
test().catch(console.error);
