-- Esquema de Base de Datos para Distribuidora de Materiales de Construcción
-- Sistema de Control Administrativo y Financiero

CREATE DATABASE IF NOT EXISTS `coronado_distribuidora_db` 
CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE `coronado_distribuidora_db`;

-- Deshabilitar chequeo de claves foráneas para recreación segura
SET FOREIGN_KEY_CHECKS = 0;

DROP TABLE IF EXISTS `detalles_pedido`;
DROP TABLE IF EXISTS `comisiones`;
DROP TABLE IF EXISTS `gastos`;
DROP TABLE IF EXISTS `pedidos`;
DROP TABLE IF EXISTS `productos`;
DROP TABLE IF EXISTS `contactos`;
DROP TABLE IF EXISTS `vehiculos`;
DROP TABLE IF EXISTS `usuarios`;
DROP TABLE IF EXISTS `sessions`;

SET FOREIGN_KEY_CHECKS = 1;

-- 1. Tabla: usuarios
CREATE TABLE `usuarios` (
  `id` CHAR(36) NOT NULL,
  `nombre` VARCHAR(100) NOT NULL,
  `correo` VARCHAR(150) NOT NULL UNIQUE,
  `clave_hash` VARCHAR(255) NOT NULL,
  `rol` ENUM('SOCIO', 'ADMINISTRADOR', 'VENDEDOR') NOT NULL,
  `porcentaje_comision` DECIMAL(5,2) NOT NULL DEFAULT 0.00,
  `activo` TINYINT(1) NOT NULL DEFAULT 1,
  `creado_en` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Tabla: contactos
CREATE TABLE `contactos` (
  `id` CHAR(36) NOT NULL,
  `tipo` ENUM('CLIENTE', 'PROVEEDOR', 'AMBOS') NOT NULL DEFAULT 'CLIENTE',
  `razon_social` VARCHAR(150) NOT NULL,
  `identificacion_fiscal` VARCHAR(50) NOT NULL,
  `telefono` VARCHAR(30) NULL,
  `correo` VARCHAR(100) NULL,
  `direccion` TEXT NULL,
  `limite_credito` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `creado_en` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_contactos_tipo` (`tipo`),
  INDEX `idx_contactos_identificacion` (`identificacion_fiscal`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. Tabla: productos
CREATE TABLE `productos` (
  `id` CHAR(36) NOT NULL,
  `codigo_sku` VARCHAR(50) NOT NULL UNIQUE,
  `nombre` VARCHAR(150) NOT NULL,
  `categoria` VARCHAR(100) NOT NULL,
  `unidad_medida` ENUM('BOLSA', 'TONELADA', 'M3') NOT NULL,
  `precio_compra` DECIMAL(12,2) NOT NULL,
  `precio_venta` DECIMAL(12,2) NOT NULL,
  `existencia` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `alerta_existencia_minima` DECIMAL(12,2) NOT NULL DEFAULT 10.00,
  `creado_en` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_productos_categoria` (`categoria`),
  INDEX `idx_productos_sku` (`codigo_sku`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. Tabla: vehiculos
CREATE TABLE `vehiculos` (
  `id` CHAR(36) NOT NULL,
  `placa` VARCHAR(20) NOT NULL UNIQUE,
  `modelo` VARCHAR(100) NOT NULL,
  `conductor_asignado` VARCHAR(100) NOT NULL,
  `activo` TINYINT(1) NOT NULL DEFAULT 1,
  `creado_en` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5. Tabla: pedidos
CREATE TABLE `pedidos` (
  `id` CHAR(36) NOT NULL,
  `tipo_documento` ENUM('COTIZACION', 'VENTA') NOT NULL DEFAULT 'COTIZACION',
  `codigo_orden` VARCHAR(30) NOT NULL UNIQUE,
  `cliente_id` CHAR(36) NOT NULL,
  `vendedor_id` CHAR(36) NOT NULL,
  `vehiculo_id` CHAR(36) NULL,
  `subtotal` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `impuesto` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `total` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `metodo_pago` ENUM('EFECTIVO', 'TRANSFERENCIA', 'CREDITO') NOT NULL DEFAULT 'EFECTIVO',
  `estado` ENUM('BORRADOR', 'PENDIENTE', 'PAGADO', 'CANCELADO') NOT NULL DEFAULT 'BORRADOR',
  `fecha_vencimiento` DATE NULL,
  `observaciones` TEXT NULL,
  `creado_en` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  CONSTRAINT `fk_pedidos_cliente` FOREIGN KEY (`cliente_id`) REFERENCES `contactos` (`id`) ON UPDATE CASCADE,
  CONSTRAINT `fk_pedidos_vendedor` FOREIGN KEY (`vendedor_id`) REFERENCES `usuarios` (`id`) ON UPDATE CASCADE,
  CONSTRAINT `fk_pedidos_vehiculo` FOREIGN KEY (`vehiculo_id`) REFERENCES `vehiculos` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  INDEX `idx_pedidos_tipo_estado` (`tipo_documento`, `estado`),
  INDEX `idx_pedidos_vendedor` (`vendedor_id`),
  INDEX `idx_pedidos_cliente` (`cliente_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 6. Tabla: detalles_pedido
CREATE TABLE `detalles_pedido` (
  `id` CHAR(36) NOT NULL,
  `pedido_id` CHAR(36) NOT NULL,
  `producto_id` CHAR(36) NOT NULL,
  `cantidad` DECIMAL(12,2) NOT NULL,
  `precio_unitario` DECIMAL(12,2) NOT NULL,
  `costo_unitario` DECIMAL(12,2) NOT NULL COMMENT 'Costo de compra histórico al momento de la venta',
  `precio_total` DECIMAL(12,2) NOT NULL,
  PRIMARY KEY (`id`),
  CONSTRAINT `fk_detalles_pedido` FOREIGN KEY (`pedido_id`) REFERENCES `pedidos` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_detalles_producto` FOREIGN KEY (`producto_id`) REFERENCES `productos` (`id`) ON UPDATE CASCADE,
  INDEX `idx_detalles_pedido` (`pedido_id`),
  INDEX `idx_detalles_producto` (`producto_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 7. Tabla: comisiones
CREATE TABLE `comisiones` (
  `id` CHAR(36) NOT NULL,
  `vendedor_id` CHAR(36) NOT NULL,
  `pedido_id` CHAR(36) NOT NULL,
  `monto` DECIMAL(12,2) NOT NULL,
  `estado` ENUM('PENDIENTE', 'PAGADO') NOT NULL DEFAULT 'PENDIENTE',
  `fecha_pago` DATETIME NULL,
  `creado_en` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  CONSTRAINT `fk_comisiones_vendedor` FOREIGN KEY (`vendedor_id`) REFERENCES `usuarios` (`id`) ON UPDATE CASCADE,
  CONSTRAINT `fk_comisiones_pedido` FOREIGN KEY (`pedido_id`) REFERENCES `pedidos` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  INDEX `idx_comisiones_vendedor` (`vendedor_id`),
  INDEX `idx_comisiones_estado` (`estado`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 8. Tabla: gastos
CREATE TABLE `gastos` (
  `id` CHAR(36) NOT NULL,
  `categoria` ENUM('MANTENIMIENTO_VEHICULO', 'COMBUSTIBLE', 'ALQUILER', 'SERVICIOS_BASICOS', 'NOMINA', 'OTROS') NOT NULL,
  `vehiculo_id` CHAR(36) NULL,
  `proveedor_id` CHAR(36) NULL,
  `monto` DECIMAL(12,2) NOT NULL,
  `metodo_pago` ENUM('EFECTIVO', 'TRANSFERENCIA', 'CREDITO') NOT NULL DEFAULT 'EFECTIVO',
  `numero_comprobante` VARCHAR(50) NULL,
  `descripcion` TEXT NOT NULL,
  `registrado_por` CHAR(36) NOT NULL,
  `fecha_gasto` DATE NOT NULL,
  `creado_en` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  CONSTRAINT `fk_gastos_vehiculo` FOREIGN KEY (`vehiculo_id`) REFERENCES `vehiculos` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_gastos_proveedor` FOREIGN KEY (`proveedor_id`) REFERENCES `contactos` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_gastos_usuario` FOREIGN KEY (`registrado_por`) REFERENCES `usuarios` (`id`) ON UPDATE CASCADE,
  INDEX `idx_gastos_categoria` (`categoria`),
  INDEX `idx_gastos_fecha` (`fecha_gasto`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tabla para almacenar sesiones de Express de forma persistente
CREATE TABLE IF NOT EXISTS `sessions` (
  `session_id` VARCHAR(128) COLLATE utf8mb4_bin NOT NULL,
  `expires` INT(11) UNSIGNED NOT NULL,
  `data` MEDIUMTEXT COLLATE utf8mb4_bin,
  PRIMARY KEY (`session_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;
