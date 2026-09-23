const db = require('../src/config/database');

async function restore() {
  await db.query(
    "UPDATE pedidos SET tipo_documento = 'COTIZACION', codigo_orden = 'COT-2026-0002', estado = 'PENDIENTE' WHERE id = '00000005-0000-0000-0000-000000000002'"
  );
  await db.query(
    "DELETE FROM comisiones WHERE pedido_id = '00000005-0000-0000-0000-000000000002'"
  );
  await db.query(
    "UPDATE productos SET existencia = 150 WHERE id = '00000002-0000-0000-0000-000000000002'"
  );
  console.log('[OK] Cotización COT-2026-0002 lista y restaurada para pruebas.');
  process.exit(0);
}

restore().catch(err => {
  console.error(err);
  process.exit(1);
});
