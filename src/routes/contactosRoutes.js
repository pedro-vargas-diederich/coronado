const express = require('express');
const router = express.Router();
const contactosController = require('../controllers/contactosController');
const { isAuthenticated } = require('../middlewares/authMiddleware');

router.use(isAuthenticated);

router.get('/', contactosController.listar);
router.get('/nuevo', contactosController.mostrarCrear);
router.post('/nuevo', contactosController.crear);
router.get('/editar/:id', contactosController.mostrarEditar);
router.post('/editar/:id', contactosController.actualizar);

module.exports = router;
