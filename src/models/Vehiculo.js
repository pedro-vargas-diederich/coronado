const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Vehiculo = sequelize.define('Vehiculo', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  placa: {
    type: DataTypes.STRING(20),
    allowNull: false,
    unique: true
  },
  modelo: {
    type: DataTypes.STRING(100),
    allowNull: false
  },
  conductor_asignado: {
    type: DataTypes.STRING(100),
    allowNull: false
  },
  activo: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: true
  },
  creado_en: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  }
}, {
  tableName: 'vehiculos',
  timestamps: false
});

module.exports = Vehiculo;
