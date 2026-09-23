const db = require('./database');

async function migrar() {
  console.log('[Migración GPS] Creando tabla ubicaciones_vehiculo...');
  const sql = `
    CREATE TABLE IF NOT EXISTS ubicaciones_vehiculo (
      id CHAR(36) PRIMARY KEY,
      vehiculo_id CHAR(36) NOT NULL UNIQUE,
      latitud DECIMAL(10, 8) NOT NULL,
      longitud DECIMAL(11, 8) NOT NULL,
      velocidad_kmh DECIMAL(5, 2) DEFAULT 0.00,
      actualizado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (vehiculo_id) REFERENCES vehiculos(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `;

  await db.query(sql);
  console.log('[Migración GPS] Tabla creada exitosamente.');

  const [cols] = await db.query('DESCRIBE ubicaciones_vehiculo');
  console.log('[Migración GPS] Estructura:', cols.map(c => `${c.Field} (${c.Type})`));
}

migrar()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('[Migración GPS] Error:', err);
    process.exit(1);
  });
