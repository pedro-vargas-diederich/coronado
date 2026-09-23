const express = require('express');
const router = express.Router();
const reportesController = require('../controllers/reportesController');
const { isAuthenticated, requireRoles } = require('../middlewares/authMiddleware');

// Todos los reportes requieren autenticación básica
router.use(isAuthenticated);

// Pantalla principal de reportes (con pestañas y filtros dinámicos)
router.get('/', reportesController.index);

// Rutas directas para cada categoría de reporte con verificación de permisos
router.get('/financiero', requireRoles('SOCIO'), (req, res, next) => {
  req.query.tipo = 'financiero';
  reportesController.index(req, res, next);
});

router.get('/ventas', (req, res, next) => {
  req.query.tipo = 'ventas';
  reportesController.index(req, res, next);
});

router.get('/comisiones', (req, res, next) => {
  req.query.tipo = 'comisiones';
  reportesController.index(req, res, next);
});

router.get('/flota', requireRoles('SOCIO', 'ADMINISTRADOR'), (req, res, next) => {
  req.query.tipo = 'flota';
  reportesController.index(req, res, next);
});

router.get('/cobrar', requireRoles('SOCIO', 'ADMINISTRADOR'), (req, res, next) => {
  req.query.tipo = 'cobrar';
  reportesController.index(req, res, next);
});

// Exportación en formato CSV
router.get('/exportar-csv', reportesController.exportarCsv);

module.exports = router;
