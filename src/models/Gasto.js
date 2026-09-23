const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Gasto = sequelize.define('Gasto', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  categoria: {
    type: DataTypes.ENUM('MANTENIMIENTO_VEHICULO', 'COMBUSTIBLE', 'ALQUILER', 'SERVICIOS_BASICOS', 'NOMINA', 'OTROS'),
    allowNull: false
  },
  vehiculo_id: {
    type: DataTypes.UUID,
    allowNull: true
  },
  proveedor_id: {
    type: DataTypes.UUID,
    allowNull: true
  },
  monto: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: false
  },
  metodo_pago: {
    type: DataTypes.ENUM('EFECTIVO', 'TRANSFERENCIA', 'CREDITO'),
    allowNull: false,
    defaultValue: 'EFECTIVO'
  },
  numero_comprobante: {
    type: DataTypes.STRING(50),
    allowNull: true
  },
  descripcion: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  registrado_por: {
    type: DataTypes.UUID,
    allowNull: false
  },
  fecha_gasto: {
    type: DataTypes.DATEONLY,
    allowNull: false
  },
  creado_en: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  }
}, {
  tableName: 'gastos',
  timestamps: false
});

module.exports = Gasto;
