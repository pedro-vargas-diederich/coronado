const express = require('express');
const router = express.Router();
const pedidosController = require('../controllers/pedidosController');
const { isAuthenticated, requireRoles } = require('../middlewares/authMiddleware');

router.use(isAuthenticated);

// Listar cotizaciones y ventas
router.get('/', pedidosController.listar);

// Nueva cotización
router.get('/nuevo', pedidosController.mostrarCrear);
router.post('/nuevo', pedidosController.crear);

// Ver y descargar/imprimir detalle
router.get('/ver/:id', pedidosController.ver);
router.get('/:id', pedidosController.ver);

// Conversión transaccional Cotización -> Venta (Socio, Administrador y Vendedor)
router.post('/:id/convertir', requireRoles('SOCIO', 'ADMINISTRADOR', 'VENDEDOR'), pedidosController.convertirAVenta);
router.post('/convertir/:id', requireRoles('SOCIO', 'ADMINISTRADOR', 'VENDEDOR'), pedidosController.convertirAVenta);

// Regularización / Cobro de Ventas: Marcar como PAGADO
router.post('/:id/cobrar', requireRoles('SOCIO', 'ADMINISTRADOR', 'VENDEDOR'), pedidosController.marcarComoCobrado);
router.post('/cobrar/:id', requireRoles('SOCIO', 'ADMINISTRADOR', 'VENDEDOR'), pedidosController.marcarComoCobrado);

// Comisiones
router.get('/comisiones', pedidosController.listarComisiones);
router.post('/comisiones/pagar/:id', requireRoles('SOCIO', 'ADMINISTRADOR'), pedidosController.marcarComisionPagada);

module.exports = router;

