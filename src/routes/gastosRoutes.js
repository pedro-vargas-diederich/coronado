const express = require('express');
const router = express.Router();
const gastosController = require('../controllers/gastosController');
const { isAuthenticated, requireRoles } = require('../middlewares/authMiddleware');

router.use(isAuthenticated);
// Solo accesible para SOCIO y ADMINISTRADOR
router.use(requireRoles('SOCIO', 'ADMINISTRADOR'));

router.get('/', gastosController.listar);
router.get('/nuevo', gastosController.mostrarCrear);
router.post('/nuevo', gastosController.crear);

module.exports = router;
