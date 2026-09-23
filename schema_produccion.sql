-- ==============================================================================
-- SISTEMA DE CONTROL ADMINISTRATIVO Y FINANCIERO - DISTRIBUIDORA CORONADO
-- SCRIPT DE MIGRACIÓN CONSOLIDADO PARA PRODUCCIÓN (RAILWAY / MYSQL 8.X / MARIADB)
-- ==============================================================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- ------------------------------------------------------------------------------
-- 1. TABLA: usuarios (Personal Interno, Socios, Administradores y Vendedores)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `usuarios` (
  `id` CHAR(36) NOT NULL,
  `nombre` VARCHAR(100) NOT NULL,
  `correo` VARCHAR(150) NOT NULL,
  `clave_hash` VARCHAR(255) NOT NULL,
  `rol` ENUM('SOCIO', 'ADMINISTRADOR', 'VENDEDOR') NOT NULL,
  `porcentaje_comision` DECIMAL(5, 2) NOT NULL DEFAULT 0.00,
  `activo` TINYINT(1) NOT NULL DEFAULT 1,
  `creado_en` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `idx_usuarios_correo` (`correo`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------------------------
-- 2. TABLA: contactos (Clientes, Proveedores y Entidades Comerciales)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `contactos` (
  `id` CHAR(36) NOT NULL,
  `tipo` ENUM('CLIENTE', 'PROVEEDOR', 'AMBOS') NOT NULL DEFAULT 'CLIENTE',
  `razon_social` VARCHAR(150) NOT NULL,
  `identificacion_fiscal` VARCHAR(50) NOT NULL,
  `telefono` VARCHAR(30) DEFAULT NULL,
  `correo` VARCHAR(100) DEFAULT NULL,
  `direccion` TEXT DEFAULT NULL,
  `limite_credito` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  `creado_en` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_contactos_tipo` (`tipo`),
  KEY `idx_contactos_identificacion` (`identificacion_fiscal`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------------------------
-- 3. TABLA: vehiculos (Flota de Camiones y Transporte Logístico)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `vehiculos` (
  `id` CHAR(36) NOT NULL,
  `placa` VARCHAR(20) NOT NULL,
  `modelo` VARCHAR(100) NOT NULL,
  `conductor_asignado` VARCHAR(100) NOT NULL,
  `activo` TINYINT(1) NOT NULL DEFAULT 1,
  `creado_en` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `idx_vehiculos_placa` (`placa`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------------------------
-- 4. TABLA: productos (Catálogo de Materiales de Construcción y Existencias)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `productos` (
  `id` CHAR(36) NOT NULL,
  `codigo_sku` VARCHAR(50) NOT NULL,
  `nombre` VARCHAR(150) NOT NULL,
  `categoria` VARCHAR(100) NOT NULL,
  `unidad_medida` ENUM('BOLSA', 'TONELADA', 'M3') NOT NULL,
  `precio_compra` DECIMAL(12, 2) NOT NULL,
  `precio_venta` DECIMAL(12, 2) NOT NULL,
  `existencia` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  `alerta_existencia_minima` DECIMAL(12, 2) NOT NULL DEFAULT 10.00,
  `creado_en` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `idx_productos_sku` (`codigo_sku`),
  KEY `idx_productos_categoria` (`categoria`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------------------------
-- 5. TABLA: pedidos (Cotizaciones Formales y Ventas Efectivas)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `pedidos` (
  `id` CHAR(36) NOT NULL,
  `tipo_documento` ENUM('COTIZACION', 'VENTA') NOT NULL DEFAULT 'COTIZACION',
  `codigo_orden` VARCHAR(30) NOT NULL,
  `cliente_id` CHAR(36) NOT NULL,
  `vendedor_id` CHAR(36) NOT NULL,
  `vehiculo_id` CHAR(36) DEFAULT NULL,
  `subtotal` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  `impuesto` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  `total` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  `metodo_pago` ENUM('EFECTIVO', 'TRANSFERENCIA', 'CREDITO') NOT NULL DEFAULT 'EFECTIVO',
  `estado` ENUM('BORRADOR', 'PENDIENTE', 'PAGADO', 'CANCELADO') NOT NULL DEFAULT 'BORRADOR',
  `fecha_vencimiento` DATE DEFAULT NULL,
  `observaciones` TEXT DEFAULT NULL,
  `creado_en` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `idx_pedidos_codigo_orden` (`codigo_orden`),
  KEY `idx_pedidos_cliente` (`cliente_id`),
  KEY `idx_pedidos_vendedor` (`vendedor_id`),
  KEY `idx_pedidos_vehiculo` (`vehiculo_id`),
  KEY `idx_pedidos_tipo_estado` (`tipo_documento`, `estado`),
  CONSTRAINT `fk_pedidos_cliente` FOREIGN KEY (`cliente_id`) REFERENCES `contactos` (`id`) ON UPDATE CASCADE,
  CONSTRAINT `fk_pedidos_vendedor` FOREIGN KEY (`vendedor_id`) REFERENCES `usuarios` (`id`) ON UPDATE CASCADE,
  CONSTRAINT `fk_pedidos_vehiculo` FOREIGN KEY (`vehiculo_id`) REFERENCES `vehiculos` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------------------------
-- 6. TABLA: detalles_pedido (Ítems y Congelamiento Histórico de Costo)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `detalles_pedido` (
  `id` CHAR(36) NOT NULL,
  `pedido_id` CHAR(36) NOT NULL,
  `producto_id` CHAR(36) NOT NULL,
  `cantidad` DECIMAL(12, 2) NOT NULL,
  `precio_unitario` DECIMAL(12, 2) NOT NULL,
  `costo_unitario` DECIMAL(12, 2) NOT NULL COMMENT 'Costo de compra histórico al momento de la venta',
  `precio_total` DECIMAL(12, 2) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_detalles_pedido` (`pedido_id`),
  KEY `idx_detalles_producto` (`producto_id`),
  CONSTRAINT `fk_detalles_pedido` FOREIGN KEY (`pedido_id`) REFERENCES `pedidos` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_detalles_producto` FOREIGN KEY (`producto_id`) REFERENCES `productos` (`id`) ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------------------------
-- 7. TABLA: gastos (Gastos Operativos, Logísticos y Mantenimiento de Flota)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `gastos` (
  `id` CHAR(36) NOT NULL,
  `categoria` ENUM('MANTENIMIENTO_VEHICULO', 'COMBUSTIBLE', 'ALQUILER', 'SERVICIOS_BASICOS', 'NOMINA', 'OTROS') NOT NULL,
  `vehiculo_id` CHAR(36) DEFAULT NULL,
  `proveedor_id` CHAR(36) DEFAULT NULL,
  `monto` DECIMAL(12, 2) NOT NULL,
  `metodo_pago` ENUM('EFECTIVO', 'TRANSFERENCIA', 'CREDITO') NOT NULL DEFAULT 'EFECTIVO',
  `numero_comprobante` VARCHAR(50) DEFAULT NULL,
  `descripcion` TEXT NOT NULL,
  `registrado_por` CHAR(36) NOT NULL,
  `fecha_gasto` DATE NOT NULL,
  `creado_en` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_gastos_categoria` (`categoria`),
  KEY `idx_gastos_fecha` (`fecha_gasto`),
  KEY `fk_gastos_vehiculo` (`vehiculo_id`),
  KEY `fk_gastos_proveedor` (`proveedor_id`),
  KEY `fk_gastos_usuario` (`registrado_por`),
  CONSTRAINT `fk_gastos_vehiculo` FOREIGN KEY (`vehiculo_id`) REFERENCES `vehiculos` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_gastos_proveedor` FOREIGN KEY (`proveedor_id`) REFERENCES `contactos` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_gastos_usuario` FOREIGN KEY (`registrado_por`) REFERENCES `usuarios` (`id`) ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------------------------
-- 8. TABLA: comisiones (Control de Comisiones Devengadas y Liquidadas a Asesores)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `comisiones` (
  `id` CHAR(36) NOT NULL,
  `vendedor_id` CHAR(36) NOT NULL,
  `pedido_id` CHAR(36) NOT NULL,
  `monto` DECIMAL(12, 2) NOT NULL,
  `estado` ENUM('PENDIENTE', 'PAGADO') NOT NULL DEFAULT 'PENDIENTE',
  `fecha_pago` DATETIME DEFAULT NULL,
  `creado_en` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_comisiones_vendedor` (`vendedor_id`),
  KEY `idx_comisiones_estado` (`estado`),
  KEY `fk_comisiones_pedido` (`pedido_id`),
  CONSTRAINT `fk_comisiones_pedido` FOREIGN KEY (`pedido_id`) REFERENCES `pedidos` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_comisiones_vendedor` FOREIGN KEY (`vendedor_id`) REFERENCES `usuarios` (`id`) ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------------------------
-- 9. TABLA: ubicaciones_vehiculo (Geolocalización en Tiempo Real de la Flota)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `ubicaciones_vehiculo` (
  `id` CHAR(36) NOT NULL,
  `vehiculo_id` CHAR(36) NOT NULL UNIQUE,
  `latitud` DECIMAL(10, 8) NOT NULL,
  `longitud` DECIMAL(11, 8) NOT NULL,
  `velocidad_kmh` DECIMAL(5, 2) DEFAULT 0.00,
  `actualizado_en` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `idx_ubicaciones_vehiculo_id` (`vehiculo_id`),
  CONSTRAINT `fk_ubicaciones_vehiculo` FOREIGN KEY (`vehiculo_id`) REFERENCES `vehiculos` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------------------------
-- 10. TABLA: sessions (Persistencia de Sesiones de Express en MySQL)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `sessions` (
  `session_id` VARCHAR(128) NOT NULL,
  `expires` INT(11) UNSIGNED NOT NULL,
  `data` MEDIUMTEXT DEFAULT NULL,
  PRIMARY KEY (`session_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

-- ------------------------------------------------------------------------------
-- DATOS SEMILLA INICIALES (USUARIOS POR DEFECTO Y FLOTA BASE)
-- Clave por defecto para Socio123!, Admin123! y Vendedor123! cifradas con bcrypt
-- ------------------------------------------------------------------------------

-- Usuario: SOCIO (socio@distribuidora.com / Socio123!)
INSERT INTO `usuarios` (`id`, `nombre`, `correo`, `clave_hash`, `rol`, `porcentaje_comision`, `activo`)
VALUES (
  '00000001-0000-0000-0000-000000000001',
  'Roberto Coronado (Socio Director)',
  'socio@distribuidora.com',
  '$2a$10$Q0gYhfn.Ue35iGZz0LQd2eXY8F/nHT0aLIvtypuTOzyediABdChQK',
  'SOCIO',
  0.00,
  1
) ON DUPLICATE KEY UPDATE `nombre` = VALUES(`nombre`);

-- Usuario: ADMINISTRADOR (admin@distribuidora.com / Admin123!)
INSERT INTO `usuarios` (`id`, `nombre`, `correo`, `clave_hash`, `rol`, `porcentaje_comision`, `activo`)
VALUES (
  '00000001-0000-0000-0000-000000000002',
  'Marcela Gómez (Administradora)',
  'admin@distribuidora.com',
  '$2a$10$Z3WEy9h7/2lAH1FGLAa8V.rVYVL0l0yRu0J5kRK9vVywsHFckg9C2',
  'ADMINISTRADOR',
  0.00,
  1
) ON DUPLICATE KEY UPDATE `nombre` = VALUES(`nombre`);

-- Usuario: VENDEDOR (vendedor@distribuidora.com / Vendedor123!)
INSERT INTO `usuarios` (`id`, `nombre`, `correo`, `clave_hash`, `rol`, `porcentaje_comision`, `activo`)
VALUES (
  '00000001-0000-0000-0000-000000000003',
  'Andrés Peñaloza (Asesor Comercial)',
  'vendedor@distribuidora.com',
  '$2a$10$iAXYrAgYv/KOId4EfWaTc.9gKUDA1eFmm/9daWeLi0A8aJGCbUfXG',
  'VENDEDOR',
  5.50,
  1
) ON DUPLICATE KEY UPDATE `nombre` = VALUES(`nombre`);

-- Catálogo Base de Materiales de Construcción
INSERT INTO `productos` (`id`, `codigo_sku`, `nombre`, `categoria`, `unidad_medida`, `precio_compra`, `precio_venta`, `existencia`, `alerta_existencia_minima`)
VALUES 
  ('00000002-0000-0000-0000-000000000001', 'CEM-PORT-01', 'Cemento Gris Tipo I Uso General (50kg)', 'Cemento', 'BOLSA', 42.00, 52.50, 400.00, 50.00),
  ('00000002-0000-0000-0000-000000000002', 'ARE-FINA-01', 'Arena Fina para Revoque', 'Agregados', 'M3', 65.00, 95.00, 85.00, 15.00),
  ('00000002-0000-0000-0000-000000000003', 'GRA-CHIC-01', 'Gravilla Triturada 3/4 Pulgadas', 'Agregados', 'M3', 80.00, 115.00, 60.00, 10.00),
  ('00000002-0000-0000-0000-000000000004', 'ACE-CORR-01', 'Acero Corrugado Estructural 12mm (Barra)', 'Hierro y Acero', 'TONELADA', 3800.00, 4600.00, 12.00, 3.00)
ON DUPLICATE KEY UPDATE `nombre` = VALUES(`nombre`);

-- Vehículos Base de la Flota
INSERT INTO `vehiculos` (`id`, `placa`, `modelo`, `conductor_asignado`, `activo`)
VALUES
  ('00000004-0000-0000-0000-000000000001', '2345-TGB', 'Camión Volqueta Volvo FMX 15m3', 'Juan Carlos Mamani', 1),
  ('00000004-0000-0000-0000-000000000002', '4589-KLP', 'Camión Plataforma Mercedes-Benz Atego', 'Eduardo Choque', 1),
  ('00000004-0000-0000-0000-000000000003', 'MACK-789', 'Tractocamión Mack Granite 20m3', 'Fernando Rojas', 1)
ON DUPLICATE KEY UPDATE `modelo` = VALUES(`modelo`);

-- Contacto Inicial (Cliente de Ejemplo)
INSERT INTO `contactos` (`id`, `tipo`, `razon_social`, `identificacion_fiscal`, `telefono`, `correo`, `direccion`, `limite_credito`)
VALUES (
  '00000003-0000-0000-0000-000000000001',
  'CLIENTE',
  'Constructora Andina del Sur S.R.L.',
  '1020304050',
  '4-4589632',
  'compras@andinasur.bo',
  'Av. Blanco Galindo Km 4.5, Cochabamba',
  50000.00
) ON DUPLICATE KEY UPDATE `razon_social` = VALUES(`razon_social`);

SET FOREIGN_KEY_CHECKS = 1;

-- ==============================================================================
-- FIN DEL SCRIPT DE MIGRACIÓN PARA PRODUCCIÓN
-- ==============================================================================
