const express = require('express');
const router = express.Router();
const usuariosController = require('../controllers/usuariosController');
const { isAuthenticated, requireRoles } = require('../middlewares/authMiddleware');

router.use(isAuthenticated);
// Control de Acceso Estricto: Exclusivo para el rol SOCIO
router.use(requireRoles('SOCIO'));

// Listado de usuarios
router.get('/', usuariosController.listar);

// Nuevo usuario
router.get('/nuevo', usuariosController.mostrarCrear);
router.post('/nuevo', usuariosController.crear);
router.post('/', usuariosController.crear);

// Alternar estado activo / inactivo
router.post('/:id/estado', usuariosController.alternarEstado);
router.post('/estado/:id', usuariosController.alternarEstado);

// Formulario de edición y actualización
router.get('/:id/editar', usuariosController.mostrarFormularioEditar);
router.get('/editar/:id', usuariosController.mostrarFormularioEditar);
router.post('/:id/editar', usuariosController.actualizarUsuario);
router.post('/editar/:id', usuariosController.actualizarUsuario);

module.exports = router;
