const express = require('express');
const router = express.Router();
const productosController = require('../controllers/productosController');
const { isAuthenticated, requireRoles } = require('../middlewares/authMiddleware');

router.use(isAuthenticated);

// Listar catálogo (Vendedor ve precios de venta pero no costos)
router.get('/', requireRoles('SOCIO', 'ADMINISTRADOR', 'VENDEDOR'), productosController.listar);

// Crear y editar productos (Solo Socio y Administrador)
router.get('/nuevo', requireRoles('SOCIO', 'ADMINISTRADOR'), productosController.mostrarCrear);
router.post('/nuevo', requireRoles('SOCIO', 'ADMINISTRADOR'), productosController.crear);
router.get('/editar/:id', requireRoles('SOCIO', 'ADMINISTRADOR'), productosController.mostrarEditar);
router.post('/editar/:id', requireRoles('SOCIO', 'ADMINISTRADOR'), productosController.actualizar);

module.exports = router;
