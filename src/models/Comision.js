const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Comision = sequelize.define('Comision', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  vendedor_id: {
    type: DataTypes.UUID,
    allowNull: false
  },
  pedido_id: {
    type: DataTypes.UUID,
    allowNull: false
  },
  monto: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: false
  },
  estado: {
    type: DataTypes.ENUM('PENDIENTE', 'PAGADO'),
    allowNull: false,
    defaultValue: 'PENDIENTE'
  },
  fecha_pago: {
    type: DataTypes.DATE,
    allowNull: true
  },
  creado_en: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  }
}, {
  tableName: 'comisiones',
  timestamps: false
});

module.exports = Comision;
