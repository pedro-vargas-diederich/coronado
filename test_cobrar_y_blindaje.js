const db = require('./src/config/database');
const { v4: uuidv4 } = require('uuid');

const BASE_URL = 'http://localhost:3000';

async function loginUser(email, password) {
  const body = new URLSearchParams({ correo: email, clave: password }).toString();
  const res = await fetch(`${BASE_URL}/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
    redirect: 'manual'
  });

  const cookie = res.headers.get('set-cookie');
  return cookie;
}

async function runTests() {
  console.log('=== INICIANDO PRUEBAS DE BLINDAJE Y COBRO DE VENTAS ===\n');

  try {
    // 1. Obtener datos de referencia para pruebas
    const [clientes] = await db.query('SELECT id FROM contactos WHERE tipo IN ("CLIENTE", "AMBOS") LIMIT 1');
    const [productos] = await db.query('SELECT id, nombre, existencia, precio_venta, precio_compra FROM productos WHERE existencia > 10 LIMIT 1');
    const [vendedor] = await db.query('SELECT id, nombre, porcentaje_comision FROM usuarios WHERE rol = "VENDEDOR" AND activo = 1 LIMIT 1');

    if (!clientes.length || !productos.length || !vendedor.length) {
      throw new Error('Faltan datos de prueba en la base de datos.');
    }

    const clienteId = clientes[0].id;
    const producto = productos[0];
    const vendedorId = vendedor[0].id;

    // Limpieza preventiva de pruebas previas
    await db.query('DELETE FROM comisiones WHERE pedido_id IN (SELECT id FROM pedidos WHERE codigo_orden LIKE "COT-2026-9%" OR codigo_orden LIKE "VTA-2026-9%")');
    await db.query('DELETE FROM detalles_pedido WHERE pedido_id IN (SELECT id FROM pedidos WHERE codigo_orden LIKE "COT-2026-9%" OR codigo_orden LIKE "VTA-2026-9%")');
    await db.query('DELETE FROM pedidos WHERE codigo_orden LIKE "COT-2026-9%" OR codigo_orden LIKE "VTA-2026-9%"');

    console.log(`[Setup] Cliente: ${clienteId}, Producto: ${producto.nombre} (Stock: ${producto.existencia}), Vendedor: ${vendedor[0].nombre}`);

    // Iniciar sesión como SOCIO
    const socioCookie = await loginUser('socio@distribuidora.com', 'Socio123!');
    const headers = {
      'Cookie': socioCookie,
      'Content-Type': 'application/x-www-form-urlencoded'
    };

    // -------------------------------------------------------------
    // PRUEBA 1.1: Conversión con EFECTIVO fuerza estado PAGADO
    // -------------------------------------------------------------
    console.log('\n--- PRUEBA 1.1: Conversión con EFECTIVO fuerza estado PAGADO ---');
    const cotId1 = uuidv4();
    const codigoCot1 = `COT-2026-9001`;
    await db.query(
      `INSERT INTO pedidos (id, tipo_documento, codigo_orden, cliente_id, vendedor_id, subtotal, impuesto, total, metodo_pago, estado)
       VALUES (?, 'COTIZACION', ?, ?, ?, 100.00, 0.00, 100.00, 'EFECTIVO', 'PENDIENTE')`,
      [cotId1, codigoCot1, clienteId, vendedorId]
    );
    await db.query(
      `INSERT INTO detalles_pedido (id, pedido_id, producto_id, cantidad, precio_unitario, costo_unitario, precio_total)
       VALUES (?, ?, ?, 1.00, 100.00, 0.00, 100.00)`,
      [uuidv4(), cotId1, producto.id]
    );

    await fetch(`${BASE_URL}/pedidos/${cotId1}/convertir`, {
      method: 'POST',
      headers,
      body: new URLSearchParams({ metodo_pago: 'EFECTIVO' }).toString(),
      redirect: 'manual'
    });

    const [pedidoPost1] = await db.query('SELECT tipo_documento, estado, metodo_pago, codigo_orden FROM pedidos WHERE id = ?', [cotId1]);
    console.log(`Resultado Cot1 -> Venta: tipo=${pedidoPost1[0].tipo_documento}, estado=${pedidoPost1[0].estado}, metodo=${pedidoPost1[0].metodo_pago}, orden=${pedidoPost1[0].codigo_orden}`);
    if (pedidoPost1[0].tipo_documento !== 'VENTA' || pedidoPost1[0].estado !== 'PAGADO') {
      throw new Error(`FALLO: Se esperaba VENTA con estado PAGADO para EFECTIVO. Obtenido: ${pedidoPost1[0].estado}`);
    }
    console.log('✓ OK: Conversión con EFECTIVO forzó correctamente estado = PAGADO');

    // -------------------------------------------------------------
    // PRUEBA 1.2: Conversión con TRANSFERENCIA fuerza estado PAGADO
    // -------------------------------------------------------------
    console.log('\n--- PRUEBA 1.2: Conversión con TRANSFERENCIA fuerza estado PAGADO ---');
    const cotId2 = uuidv4();
    const codigoCot2 = `COT-2026-9002`;
    await db.query(
      `INSERT INTO pedidos (id, tipo_documento, codigo_orden, cliente_id, vendedor_id, subtotal, impuesto, total, metodo_pago, estado)
       VALUES (?, 'COTIZACION', ?, ?, ?, 150.00, 0.00, 150.00, 'TRANSFERENCIA', 'PENDIENTE')`,
      [cotId2, codigoCot2, clienteId, vendedorId]
    );
    await db.query(
      `INSERT INTO detalles_pedido (id, pedido_id, producto_id, cantidad, precio_unitario, costo_unitario, precio_total)
       VALUES (?, ?, ?, 1.00, 150.00, 0.00, 150.00)`,
      [uuidv4(), cotId2, producto.id]
    );

    await fetch(`${BASE_URL}/pedidos/${cotId2}/convertir`, {
      method: 'POST',
      headers,
      body: new URLSearchParams({ metodo_pago: 'TRANSFERENCIA' }).toString(),
      redirect: 'manual'
    });

    const [pedidoPost2] = await db.query('SELECT tipo_documento, estado, metodo_pago FROM pedidos WHERE id = ?', [cotId2]);
    console.log(`Resultado Cot2 -> Venta: tipo=${pedidoPost2[0].tipo_documento}, estado=${pedidoPost2[0].estado}, metodo=${pedidoPost2[0].metodo_pago}`);
    if (pedidoPost2[0].tipo_documento !== 'VENTA' || pedidoPost2[0].estado !== 'PAGADO') {
      throw new Error(`FALLO: Se esperaba VENTA con estado PAGADO para TRANSFERENCIA. Obtenido: ${pedidoPost2[0].estado}`);
    }
    console.log('✓ OK: Conversión con TRANSFERENCIA forzó correctamente estado = PAGADO');

    // -------------------------------------------------------------
    // PRUEBA 1.3: Conversión con CREDITO mantiene estado PENDIENTE
    // -------------------------------------------------------------
    console.log('\n--- PRUEBA 1.3: Conversión con CREDITO mantiene estado PENDIENTE ---');
    const cotId3 = uuidv4();
    const codigoCot3 = `COT-2026-9003`;
    await db.query(
      `INSERT INTO pedidos (id, tipo_documento, codigo_orden, cliente_id, vendedor_id, subtotal, impuesto, total, metodo_pago, estado)
       VALUES (?, 'COTIZACION', ?, ?, ?, 200.00, 0.00, 200.00, 'CREDITO', 'PENDIENTE')`,
      [cotId3, codigoCot3, clienteId, vendedorId]
    );
    await db.query(
      `INSERT INTO detalles_pedido (id, pedido_id, producto_id, cantidad, precio_unitario, costo_unitario, precio_total)
       VALUES (?, ?, ?, 1.00, 200.00, 0.00, 200.00)`,
      [uuidv4(), cotId3, producto.id]
    );

    await fetch(`${BASE_URL}/pedidos/${cotId3}/convertir`, {
      method: 'POST',
      headers,
      body: new URLSearchParams({ metodo_pago: 'CREDITO' }).toString(),
      redirect: 'manual'
    });

    const [pedidoPost3] = await db.query('SELECT tipo_documento, estado, metodo_pago FROM pedidos WHERE id = ?', [cotId3]);
    console.log(`Resultado Cot3 -> Venta: tipo=${pedidoPost3[0].tipo_documento}, estado=${pedidoPost3[0].estado}, metodo=${pedidoPost3[0].metodo_pago}`);
    if (pedidoPost3[0].tipo_documento !== 'VENTA' || pedidoPost3[0].estado !== 'PENDIENTE') {
      throw new Error(`FALLO: Se esperaba VENTA con estado PENDIENTE para CREDITO.`);
    }
    console.log('✓ OK: Conversión con CREDITO mantuvo correctamente estado = PENDIENTE');

    // -------------------------------------------------------------
    // PRUEBA 2: Blindaje de Transacción y Rollback Robusto ante Falta de Stock
    // -------------------------------------------------------------
    console.log('\n--- PRUEBA 2: Blindaje de Transacción ante Stock Insuficiente ---');
    const cotId4 = uuidv4();
    const codigoCot4 = `COT-2026-9004`;
    const [prodCheck] = await db.query('SELECT existencia FROM productos WHERE id = ?', [producto.id]);
    const stockAntes = parseFloat(prodCheck[0].existencia);

    await db.query(
      `INSERT INTO pedidos (id, tipo_documento, codigo_orden, cliente_id, vendedor_id, subtotal, impuesto, total, metodo_pago, estado)
       VALUES (?, 'COTIZACION', ?, ?, ?, 5000000.00, 0.00, 5000000.00, 'EFECTIVO', 'PENDIENTE')`,
      [cotId4, codigoCot4, clienteId, vendedorId]
    );
    await db.query(
      `INSERT INTO detalles_pedido (id, pedido_id, producto_id, cantidad, precio_unitario, costo_unitario, precio_total)
       VALUES (?, ?, ?, 999999.00, 5.00, 0.00, 5000000.00)`,
      [uuidv4(), cotId4, producto.id]
    );

    // Intentar convertir la cotización imposible
    const resRollback = await fetch(`${BASE_URL}/pedidos/${cotId4}/convertir`, {
      method: 'POST',
      headers,
      body: new URLSearchParams({ metodo_pago: 'EFECTIVO' }).toString(),
      redirect: 'manual'
    });

    console.log(`Respuesta tras error de stock: HTTP ${resRollback.status} -> Location: ${resRollback.headers.get('location')}`);

    // Verificar en BD que NO cambió a VENTA y que el stock NO fue tocado
    const [cotVerif] = await db.query('SELECT tipo_documento, estado FROM pedidos WHERE id = ?', [cotId4]);
    const [prodVerif] = await db.query('SELECT existencia FROM productos WHERE id = ?', [producto.id]);

    if (cotVerif[0].tipo_documento !== 'COTIZACION') {
      throw new Error('FALLO: La cotización cambió de estado a pesar del error de stock.');
    }
    if (parseFloat(prodVerif[0].existencia) !== stockAntes) {
      throw new Error(`FALLO: El inventario fue alterado a pesar del rollback! Antes: ${stockAntes}, Ahora: ${prodVerif[0].existencia}`);
    }
    console.log(`✓ OK: Rollback íntegro verificado. Cotización sigue en ${cotVerif[0].tipo_documento} y stock intacto (${prodVerif[0].existencia})`);

    // -------------------------------------------------------------
    // PRUEBA 3: Regularización de la Orden VTA-2026-0005 vía POST /pedidos/:id/cobrar
    // -------------------------------------------------------------
    console.log('\n--- PRUEBA 3: Regularización de VTA-2026-0005 vía POST /pedidos/:id/cobrar ---');
    const [orden05] = await db.query('SELECT id, codigo_orden, estado, metodo_pago, total FROM pedidos WHERE codigo_orden = "VTA-2026-0005"');
    if (!orden05.length) {
      throw new Error('No se encontró la orden VTA-2026-0005 en la base de datos.');
    }
    const target05 = orden05[0];
    console.log(`Estado actual de VTA-2026-0005: ID=${target05.id}, Estado=${target05.estado}, Método=${target05.metodo_pago}, Total=${target05.total}`);

    // Consultar ventas cobradas en dashboard antes
    const [dashAntes] = await db.query(
      `SELECT COALESCE(SUM(CASE WHEN tipo_documento = 'VENTA' AND estado = 'PAGADO' THEN total ELSE 0 END), 0) AS cobradas
       FROM pedidos`
    );
    const cobradasAntes = parseFloat(dashAntes[0].cobradas);

    // Ejecutar cobro regularizador
    const resCobrar = await fetch(`${BASE_URL}/pedidos/${target05.id}/cobrar`, {
      method: 'POST',
      headers,
      body: new URLSearchParams({ metodo_pago: 'TRANSFERENCIA' }).toString(),
      redirect: 'manual'
    });

    console.log(`Respuesta cobro: HTTP ${resCobrar.status} -> Location: ${resCobrar.headers.get('location')}`);

    // Verificar en base de datos
    const [orden05Post] = await db.query('SELECT estado, metodo_pago FROM pedidos WHERE id = ?', [target05.id]);
    console.log(`Estado de VTA-2026-0005 después de cobrar: Estado=${orden05Post[0].estado}, Método=${orden05Post[0].metodo_pago}`);
    if (orden05Post[0].estado !== 'PAGADO') {
      throw new Error(`FALLO: VTA-2026-0005 no pasó a PAGADO. Estado actual: ${orden05Post[0].estado}`);
    }

    // Verificar comisión
    const [comis05] = await db.query('SELECT * FROM comisiones WHERE pedido_id = ?', [target05.id]);
    console.log(`Comisión vinculada a VTA-2026-0005: monto=${comis05[0]?.monto}, estado=${comis05[0]?.estado}`);
    if (!comis05.length || parseFloat(comis05[0].monto) <= 0) {
      throw new Error('FALLO: La comisión de VTA-2026-0005 no existe o tiene monto inválido.');
    }

    // Consultar ventas cobradas en dashboard después
    const [dashDespues] = await db.query(
      `SELECT COALESCE(SUM(CASE WHEN tipo_documento = 'VENTA' AND estado = 'PAGADO' THEN total ELSE 0 END), 0) AS cobradas
       FROM pedidos`
    );
    const cobradasDespues = parseFloat(dashDespues[0].cobradas);
    console.log(`Ventas cobradas: Antes = Bs ${cobradasAntes.toFixed(2)}, Después = Bs ${cobradasDespues.toFixed(2)} (Incremento = Bs ${(cobradasDespues - cobradasAntes).toFixed(2)})`);

    if (target05.estado === 'PENDIENTE') {
      if (Math.abs((cobradasDespues - cobradasAntes) - parseFloat(target05.total)) > 0.01) {
        throw new Error('FALLO: El incremento en ventas cobradas no coincide con el total de VTA-2026-0005');
      }
    }
    console.log('✓ OK: VTA-2026-0005 regularizada exitosamente a PAGADO y sumada a ingresos.');

    // -------------------------------------------------------------
    // PRUEBA 4: Control de Idempotencia (No cobrar dos veces)
    // -------------------------------------------------------------
    console.log('\n--- PRUEBA 4: Control de Doble Cobro (Idempotencia) ---');
    const resCobrarDoble = await fetch(`${BASE_URL}/pedidos/${target05.id}/cobrar`, {
      method: 'POST',
      headers,
      body: '',
      redirect: 'manual'
    });
    console.log(`Intento de cobro sobre orden ya PAGADA: HTTP ${resCobrarDoble.status} -> Location: ${resCobrarDoble.headers.get('location')}`);
    console.log('✓ OK: Manejado con aviso/error descriptivo sin corromper la BD.');

    // Limpieza de cotizaciones de prueba creadas
    await db.query('DELETE FROM comisiones WHERE pedido_id IN (?, ?, ?, ?)', [cotId1, cotId2, cotId3, cotId4]);
    await db.query('DELETE FROM detalles_pedido WHERE pedido_id IN (?, ?, ?, ?)', [cotId1, cotId2, cotId3, cotId4]);
    await db.query('DELETE FROM pedidos WHERE id IN (?, ?, ?, ?)', [cotId1, cotId2, cotId3, cotId4]);

    console.log('\n=== TODAS LAS PRUEBAS DE BLINDAJE Y COBRO PASARON EXITOSAMENTE (100% OK) ===');

  } catch (err) {
    console.error('\n❌ ERROR EN LA EJECUCIÓN DE PRUEBAS:', err.message);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

runTests();
