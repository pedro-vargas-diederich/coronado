const { formatMoney } = require('../utils/formatoMoneda');

/**
 * Middleware para verificar si el usuario ha iniciado sesión
 */
function isAuthenticated(req, res, next) {
  if (req.session && req.session.usuario) {
    return next();
  }
  req.flash('error', 'Debes iniciar sesión para acceder al sistema.');
  return res.redirect('/login');
}

/**
 * Middleware para autorizar roles específicos (SOCIO, ADMINISTRADOR, VENDEDOR)
 */
function requireRoles(...rolesPermitidos) {
  return (req, res, next) => {
    if (!req.session || !req.session.usuario) {
      req.flash('error', 'Sesión expirada o no iniciada.');
      return res.redirect('/login');
    }

    const { rol } = req.session.usuario;
    if (rolesPermitidos.includes(rol)) {
      return next();
    }

    req.flash('error', `Acceso denegado: El rol [${rol}] no tiene permisos para esta sección.`);
    // Redirección inteligente según el rol del usuario
    if (rol === 'VENDEDOR') {
      return res.redirect('/pedidos');
    }
    return res.redirect('/dashboard');
  };
}

/**
 * Middleware para inyectar variables globales a todas las vistas EJS
 */
function exposeLocals(req, res, next) {
  res.locals.currentUser = req.session ? req.session.usuario : null;
  res.locals.currentPath = req.path;
  res.locals.success_msg = req.flash('success');
  res.locals.error_msg = req.flash('error');
  res.locals.info_msg = req.flash('info');

  // Helpers de formato para las plantillas EJS
  res.locals.formatMoney = formatMoney;

  res.locals.formatDate = (d) => {
    if (!d) return '-';
    const date = new Date(d);
    return date.toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  next();
}

module.exports = {
  isAuthenticated,
  estaAutenticado: isAuthenticated,
  requireRoles,
  exposeLocals
};
