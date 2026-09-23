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

async function verifyBolivianos() {
  console.log('--- VERIFICACIÓN DE ESTANDARIZACIÓN MONETARIA (BOLIVIANOS - Bs) ---');

  // 1. Login como Socio
  const loginSocio = await makeRequest('POST', '/login', {
    correo: 'socio@distribuidora.com',
    clave: 'Socio123!'
  });
  const socioCookie = loginSocio.cookie;

  // 2. Verificar Dashboard
  console.log('\n[1] Verificando Dashboard Directivo...');
  const dashRes = await makeRequest('GET', '/dashboard', null, socioCookie);
  const tieneBsEnDashboard = dashRes.data.includes('Bs ');
  const tieneDolarEnDashboard = dashRes.data.match(/(\$\s*\d+|\$\d+)/);
  console.log('¿Muestra moneda en Bs?:', tieneBsEnDashboard ? 'SI (CORRECTO)' : 'NO (ERROR)');
  console.log('¿Contiene algún símbolo $ para dinero?:', tieneDolarEnDashboard ? `ERROR: ${tieneDolarEnDashboard[0]}` : 'NINGUNO (CORRECTO)');

  // 3. Verificar Catálogo de Productos
  console.log('\n[2] Verificando Catálogo de Productos...');
  const prodRes = await makeRequest('GET', '/productos', null, socioCookie);
  const tieneBsEnProductos = prodRes.data.includes('Bs ');
  const tieneDolarEnProductos = prodRes.data.match(/(\$\s*\d+|\$\d+)/);
  const tieneUSDEnProductos = prodRes.data.includes('USD');
  console.log('¿Muestra precios en Bs?:', tieneBsEnProductos ? 'SI (CORRECTO)' : 'NO (ERROR)');
  console.log('¿Contiene $ o USD?:', (tieneDolarEnProductos || tieneUSDEnProductos) ? 'ERROR' : 'NINGUNO (CORRECTO)');

  // 4. Verificar Formulario de Cotizaciones
  console.log('\n[3] Verificando Formulario de Nueva Cotización (/pedidos/nuevo)...');
  const cotRes = await makeRequest('GET', '/pedidos/nuevo', null, socioCookie);
  const tienePrecioUnitBs = cotRes.data.includes('Precio Unit. (Bs)');
  const tieneTotalBs = cotRes.data.includes('Bs 0.00');
  const tieneDolarEnCot = cotRes.data.includes('Precio Unit. ($)') || cotRes.data.includes('$0.00');
  console.log('¿Etiqueta en Bs y total inicial Bs 0.00?:', (tienePrecioUnitBs && tieneTotalBs) ? 'SI (CORRECTO)' : 'NO (ERROR)');
  console.log('¿Contiene Precio Unit. ($) o $0.00?:', tieneDolarEnCot ? 'ERROR' : 'NINGUNO (CORRECTO)');

  // 5. Verificar Gastos
  console.log('\n[4] Verificando Centro de Gastos (/gastos y /gastos/nuevo)...');
  const gastosRes = await makeRequest('GET', '/gastos', null, socioCookie);
  const gastosNuevoRes = await makeRequest('GET', '/gastos/nuevo', null, socioCookie);
  const gastosEnBs = gastosRes.data.includes('Bs ');
  const gastosNuevoEnBs = gastosNuevoRes.data.includes('Monto del Gasto (Bs)');
  console.log('¿Gastos expresados con Bs y formulario con (Bs)?:', (gastosEnBs && gastosNuevoEnBs) ? 'SI (CORRECTO)' : 'NO (ERROR)');

  // 6. Verificar Flota de Vehículos
  console.log('\n[5] Verificando Gastos Acumulados de Flota (/vehiculos)...');
  const vehRes = await makeRequest('GET', '/vehiculos', null, socioCookie);
  const vehEnBs = vehRes.data.includes('Bs ');
  console.log('¿Gastos acumulados de flota en Bs?:', vehEnBs ? 'SI (CORRECTO)' : 'NO (ERROR)');

  console.log('\n--- VERIFICACIÓN DE MONEDA FINALIZADA EXITOSAMENTE ---');
}

verifyBolivianos().catch(err => console.error('Error:', err));
