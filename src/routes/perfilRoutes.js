const express = require('express');
const router = express.Router();
const perfilController = require('../controllers/perfilController');
const { isAuthenticated } = require('../middlewares/authMiddleware');

// Protección estricta: Requiere sesión activa en cualquier rol (SOCIO, ADMINISTRADOR, VENDEDOR)
router.use(isAuthenticated);

// Redirección conveniente /perfil -> /perfil/cambiar-clave
router.get('/', (req, res) => {
  res.redirect('/perfil/cambiar-clave');
});

// Formulario de perfil y cambio de contraseña
router.get('/cambiar-clave', perfilController.mostrarPerfil);

// Procesar cambio de contraseña
router.post('/cambiar-clave', perfilController.actualizarClavePropia);

module.exports = router;
