require('dotenv').config();
const mysql = require('mysql2/promise');

// Configuración de conexión híbrida:
// 1. En producción en Railway se detecta automáticamente MYSQL_URL o DATABASE_URL.
// 2. En desarrollo local (XAMPP) se utilizan las credenciales individuales.
const connectionUri = process.env.MYSQL_URL || process.env.DATABASE_URL || process.env.MYSQLPRIVATEURL;

let poolConfig;

if (connectionUri) {
  poolConfig = {
    uri: connectionUri,
    waitForConnections: true,
    connectionLimit: 15,
    queueLimit: 0,
    decimalNumbers: true, // Convierte campos DECIMAL a Number en JavaScript
    timezone: 'Z',
    charset: 'utf8mb4'
  };
} else {
  poolConfig = {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT, 10) || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD !== undefined ? process.env.DB_PASSWORD : '',
    database: process.env.DB_NAME || 'coronado_distribuidora_db',
    waitForConnections: true,
    connectionLimit: 15,
    queueLimit: 0,
    decimalNumbers: true,
    timezone: 'Z',
    charset: 'utf8mb4'
  };
}

// Crear pool de conexiones optimizado
const pool = mysql.createPool(poolConfig);

// Verificación de conexión con logs descriptivos al arrancar el contenedor
pool.getConnection()
  .then((conn) => {
    if (connectionUri) {
      // Ocultar credenciales sensibles en logs de Railway
      const maskedUri = connectionUri.replace(/:([^:@]+)@/, ':****@');
      console.log(`[Base de Datos] Conexión establecida exitosamente vía URI en la nube: ${maskedUri}`);
    } else {
      console.log(`[Base de Datos] Conexión establecida con MySQL local (${poolConfig.host}:${poolConfig.port}/${poolConfig.database})`);
    }
    conn.release();
  })
  .catch((err) => {
    console.error('[Base de Datos Error] No se pudo conectar a MySQL:', err.message);
    if (connectionUri) {
      console.error('[Diagnóstico Railway] Verifica que la variable MYSQL_URL esté conectada al servicio MySQL en Railway.');
    } else {
      console.error('[Diagnóstico Local] Verifica que MySQL esté activo en XAMPP y que la base de datos exista.');
    }
  });

module.exports = pool;
