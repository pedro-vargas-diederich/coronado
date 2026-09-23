const express = require('express');
const router = express.Router();
const dashboardController = require('../controllers/dashboardController');
const { isAuthenticated, requireRoles } = require('../middlewares/authMiddleware');

router.use(isAuthenticated);
// Solo accesible para SOCIO y ADMINISTRADOR (Vendedor ve sus pedidos)
router.use(requireRoles('SOCIO', 'ADMINISTRADOR'));

router.get('/', dashboardController.index);

module.exports = router;
