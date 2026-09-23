const express = require('express');
const router = express.Router();
const vehiculosController = require('../controllers/vehiculosController');
const { isAuthenticated, requireRoles } = require('../middlewares/authMiddleware');

router.use(isAuthenticated);

// 1. Vista de Transmisión para Tablet a Bordo (Accesible para cualquier usuario autenticado en la unidad)
router.get('/:id/gps-tracker', vehiculosController.mostrarEmisorGps);
router.get('/gps-tracker/:id', vehiculosController.mostrarEmisorGps);

// 2. Rutas Restringidas Exclusivamente a Roles Directivos y Operativos (SOCIO y ADMINISTRADOR)
router.use(requireRoles('SOCIO', 'ADMINISTRADOR'));

// Monitoreo en Vivo (Mapa interactivo Leaflet)
router.get('/mapa', vehiculosController.mostrarMapa);
router.get('/monitoreo', vehiculosController.mostrarMapa);

// Listado de unidades de la flota
router.get('/', vehiculosController.listar);

// Crear vehículo
router.get('/nuevo', vehiculosController.mostrarCrear);
router.post('/nuevo', vehiculosController.crear);
router.post('/', vehiculosController.crear);

// Editar y cambiar estado (soporta ambas convenciones de URL)
router.get('/editar/:id', vehiculosController.mostrarEditar);
router.get('/:id/editar', vehiculosController.mostrarEditar);
router.post('/editar/:id', vehiculosController.actualizar);
router.post('/:id/editar', vehiculosController.actualizar);

// Alias de API para redundancia dentro del prefijo /vehiculos
router.post('/api/:id/ubicacion', vehiculosController.guardarUbicacion);
router.get('/api/ubicaciones', vehiculosController.obtenerUbicaciones);

module.exports = router;
