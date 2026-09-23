require('dotenv').config();
const { Sequelize } = require('sequelize');

// Configuración híbrida de base de datos con Sequelize:
// 1. En producción (Railway) se utiliza process.env.MYSQL_URL (o DATABASE_URL/MYSQLPRIVATEURL)
// 2. En desarrollo local (XAMPP) se toman las credenciales individuales
const connectionUri = process.env.MYSQL_URL || process.env.DATABASE_URL || process.env.MYSQLPRIVATEURL;

let sequelize;

if (connectionUri) {
  sequelize = new Sequelize(connectionUri, {
    dialect: 'mysql',
    logging: false,
    define: {
      freezeTableName: true,
      timestamps: false
    },
    dialectOptions: {
      decimalNumbers: true
    }
  });
} else {
  sequelize = new Sequelize(
    process.env.DB_NAME || 'coronado_distribuidora_db',
    process.env.DB_USER || 'root',
    process.env.DB_PASSWORD !== undefined ? process.env.DB_PASSWORD : '',
    {
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT, 10) || 3306,
      dialect: 'mysql',
      logging: false,
      define: {
        freezeTableName: true,
        timestamps: false
      },
      dialectOptions: {
        decimalNumbers: true
      }
    }
  );
}

// Wrapper de compatibilidad transparente para consultas raw previas (db.query y db.getConnection)
const originalQuery = sequelize.query.bind(sequelize);

sequelize.query = function (sql, options, ...rest) {
  if (Array.isArray(options)) {
    return originalQuery(sql, { replacements: options });
  }
  return originalQuery(sql, options, ...rest);
};

sequelize.getConnection = async function () {
  const transaction = await sequelize.transaction();
  return {
    beginTransaction: async () => {},
    commit: async () => {
      await transaction.commit();
    },
    rollback: async () => {
      await transaction.rollback();
    },
    query: async (sql, params) => {
      if (Array.isArray(params)) {
        return originalQuery(sql, { replacements: params, transaction });
      }
      return originalQuery(sql, { ...params, transaction });
    },
    release: () => {}
  };
};

// Autenticación inicial con diagnóstico informativo
sequelize.authenticate()
  .then(() => {
    if (connectionUri) {
      const maskedUri = connectionUri.replace(/:([^:@]+)@/, ':****@');
      console.log(`[Sequelize] Conexión establecida con MySQL en la nube: ${maskedUri}`);
    } else {
      console.log(`[Sequelize] Conexión establecida con MySQL local (${sequelize.config.host}:${sequelize.config.port}/${sequelize.config.database})`);
    }
  })
  .catch((err) => {
    console.error('[Sequelize Error] No se pudo conectar a la base de datos:', err.message);
    if (connectionUri) {
      console.error('[Diagnóstico Railway] Verifica que la variable MYSQL_URL esté configurada en el servicio web.');
    } else {
      console.error('[Diagnóstico Local] Verifica que MySQL esté activo en XAMPP y que la base de datos exista.');
    }
  });

module.exports = sequelize;
