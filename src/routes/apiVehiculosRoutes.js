const express = require('express');
const router = express.Router();
const vehiculosController = require('../controllers/vehiculosController');
const { isAuthenticated, requireRoles } = require('../middlewares/authMiddleware');

// Endpoint receptor de coordenadas desde la tablet a bordo del camión
// (Acepta peticiones del emisor web o cliente GPS)
router.post('/:id/ubicacion', vehiculosController.guardarUbicacion);
router.post('/ubicacion/:id', vehiculosController.guardarUbicacion);

// Endpoint de consulta de coordenadas de toda la flota activa
// Exclusivo para roles directivos y operativos: SOCIO y ADMINISTRADOR
router.get('/ubicaciones', isAuthenticated, requireRoles('SOCIO', 'ADMINISTRADOR'), vehiculosController.obtenerUbicaciones);

module.exports = router;
