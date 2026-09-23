require('dotenv').config();
const path = require('path');
const express = require('express');
const expressLayouts = require('express-ejs-layouts');
const flash = require('connect-flash');
const morgan = require('morgan');

const sessionMiddleware = require('./config/session');
const { exposeLocals, isAuthenticated } = require('./middlewares/authMiddleware');

// Importar enrutadores modulares
const authRoutes = require('./routes/authRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');
const pedidosRoutes = require('./routes/pedidosRoutes');
const productosRoutes = require('./routes/productosRoutes');
const contactosRoutes = require('./routes/contactosRoutes');
const gastosRoutes = require('./routes/gastosRoutes');
const vehiculosRoutes = require('./routes/vehiculosRoutes');
const usuariosRoutes = require('./routes/usuariosRoutes');
const perfilRoutes = require('./routes/perfilRoutes');
const reportesRoutes = require('./routes/reportesRoutes');
const apiVehiculosRoutes = require('./routes/apiVehiculosRoutes');

const { formatMoney } = require('./utils/formatoMoneda');

const app = express();
const PORT = parseInt(process.env.PORT, 10) || 3000;
const HOST = process.env.HOST || '0.0.0.0';

// Confianza en proxies inversos (necesario para Railway, Heroku y terminación HTTPS)
app.set('trust proxy', 1);

// Helper global de moneda Bolivianos (Bs) disponible en todas las vistas EJS
app.locals.formatMoney = formatMoney;

// Configuración de Logging en Desarrollo
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('dev'));
}

// Configuración de Archivos Estáticos
app.use(express.static(path.join(__dirname, '../public')));

// Configuración de Parseo de Solicitudes
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Configuración de Sesiones y Mensajes Flash
app.use(sessionMiddleware);
app.use(flash());

// Inyección de Variables Globales a Vistas EJS
app.use(exposeLocals);

// Configuración del Motor de Plantillas EJS y Layout Base
app.use(expressLayouts);
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');
app.set('layout', 'layouts/main');
app.set('layout extractScripts', true);
app.set('layout extractStyles', true);

// Rutas Públicas de Autenticación
app.use('/', authRoutes);

// Ruta Raíz Inteligente
app.get('/', (req, res) => {
  if (req.session && req.session.usuario) {
    if (req.session.usuario.rol === 'VENDEDOR') {
      return res.redirect('/pedidos');
    }
    return res.redirect('/dashboard');
  }
  return res.redirect('/login');
});

// Rutas Protegidas del Monolito
app.use('/dashboard', dashboardRoutes);
app.use('/pedidos', pedidosRoutes);
app.use('/productos', productosRoutes);
app.use('/contactos', contactosRoutes);
app.use('/gastos', gastosRoutes);
app.use('/vehiculos', vehiculosRoutes);
app.use('/usuarios', usuariosRoutes);
app.use('/perfil', perfilRoutes);
app.use('/reportes', reportesRoutes);
app.use('/api/vehiculos', apiVehiculosRoutes);

// Manejo de Error 404 (Página No Encontrada)
app.use((req, res) => {
  res.status(404).render('auth/login', {
    title: '404 - No Encontrado',
    layout: 'layouts/main'
  });
});

// Manejo Centralizado de Errores 500
app.use((err, req, res, next) => {
  console.error('[Error de Servidor]:', err.stack);
  res.status(500).send(`
    <div style="font-family: sans-serif; padding: 2rem; max-width: 600px; margin: 4rem auto; border: 1px solid #cbd5e1; border-radius: 1rem;">
      <h2 style="color: #0f172a;">Ocurrió un error inesperado en el servidor</h2>
      <p style="color: #64748b;">${err.message || 'Error interno'}</p>
      <a href="/" style="display: inline-block; margin-top: 1rem; padding: 0.5rem 1rem; background: #0f172a; color: white; text-decoration: none; border-radius: 0.5rem;">Volver al inicio</a>
    </div>
  `);
});

// Inicialización del Servidor Web (Vinculado a 0.0.0.0 para proxy inverso de Railway)
app.listen(PORT, HOST, () => {
  console.log('==================================================');
  console.log(`[CORONADO] Servidor Monolítico Express Activo`);
  console.log(`[Host]:      ${HOST}`);
  console.log(`[Puerto]:    ${PORT}`);
  console.log(`[URL Local]: http://${HOST === '0.0.0.0' ? 'localhost' : HOST}:${PORT}`);
  console.log(`[Ambiente]:  ${process.env.NODE_ENV || 'development'}`);
  console.log('==================================================');
});

module.exports = app;
