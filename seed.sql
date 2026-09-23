-- Datos Semilla para Distribuidora de Materiales de Construcción
USE `coronado_distribuidora_db`;

-- Deshabilitar claves foráneas para inserción limpia
SET FOREIGN_KEY_CHECKS = 0;
TRUNCATE TABLE `detalles_pedido`;
TRUNCATE TABLE `comisiones`;
TRUNCATE TABLE `gastos`;
TRUNCATE TABLE `pedidos`;
TRUNCATE TABLE `productos`;
TRUNCATE TABLE `contactos`;
TRUNCATE TABLE `vehiculos`;
TRUNCATE TABLE `usuarios`;
SET FOREIGN_KEY_CHECKS = 1;

-- 1. Inserción de Usuarios de Prueba (UUID 36 caracteres exactos)
-- Clave para Socio: Socio123!
-- Clave para Admin: Admin123!
-- Clave para Vendedor: Vendedor123!
INSERT INTO `usuarios` (`id`, `nombre`, `correo`, `clave_hash`, `rol`, `porcentaje_comision`, `activo`) VALUES
('00000001-0000-0000-0000-000000000001', 'Roberto Coronado (Socio Director)', 'socio@distribuidora.com', '$2a$10$Q0gYhfn.Ue35iGZz0LQd2eXY8F/nHT0aLIvtypuTOzyediABdChQK', 'SOCIO', 0.00, 1),
('00000001-0000-0000-0000-000000000002', 'Marcela Gómez (Administradora)', 'admin@distribuidora.com', '$2a$10$Z3WEy9h7/2lAH1FGLAa8V.rVYVL0l0yRu0J5kRK9vVywsHFckg9C2', 'ADMINISTRADOR', 0.00, 1),
('00000001-0000-0000-0000-000000000003', 'Andrés Peñaloza (Asesor Comercial)', 'vendedor@distribuidora.com', '$2a$10$W4UXTz7J3LmjRzucgDFs7O2x7WQTwB4fRFBshAkIc3YlNKhGUVNuW', 'VENDEDOR', 3.50, 1);

-- 2. Inserción de Vehículos de Flota
INSERT INTO `vehiculos` (`id`, `placa`, `modelo`, `conductor_asignado`, `activo`) VALUES
('00000002-0000-0000-0000-000000000001', 'WTR-892', 'Volqueta Kenworth T880 15m3', 'Carlos Mendoza', 1),
('00000002-0000-0000-0000-000000000002', 'SKL-415', 'Camión Isuzu Forward 8 Ton', 'Jorge Ramírez', 1);

-- 3. Inserción de Contactos (Clientes y Proveedores)
INSERT INTO `contactos` (`id`, `tipo`, `razon_social`, `identificacion_fiscal`, `telefono`, `correo`, `direccion`, `limite_credito`) VALUES
('00000003-0000-0000-0000-000000000001', 'CLIENTE', 'Constructora del Valle S.A.S.', 'NIT 900.123.456-1', '3104567890', 'compras@valleobras.com', 'Carrera 15 # 85-20, Zona Industrial', 50000.00),
('00000003-0000-0000-0000-000000000002', 'CLIENTE', 'Obras Civiles y Estructuras Ltda.', 'NIT 800.789.012-3', '3187654321', 'gerencia@obrasciviles.com', 'Calle 45 # 12-34, Bodega 4', 25000.00),
('00000003-0000-0000-0000-000000000003', 'PROVEEDOR', 'Cementos Nacionales de Occidente', 'NIT 890.345.678-9', '6013456789', 'despachos@cementosnal.com', 'Km 12 Vía al Puerto', 0.00),
('00000003-0000-0000-0000-000000000004', 'PROVEEDOR', 'Agregados y Canteras del Norte', 'NIT 830.654.321-0', '6019876543', 'ventas@agregadosnorte.com', 'Cantera El Roble, Vereda Chuntame', 0.00);

-- 4. Inserción de Catálogo de Productos
INSERT INTO `productos` (`id`, `codigo_sku`, `nombre`, `categoria`, `unidad_medida`, `precio_compra`, `precio_venta`, `existencia`, `alerta_existencia_minima`) VALUES
('00000004-0000-0000-0000-000000000001', 'CEM-PORT-01', 'Cemento Gris Tipo I Uso General', 'Cementos', 'BOLSA', 26.50, 34.00, 480.00, 60.00),
('00000004-0000-0000-0000-000000000002', 'CEM-ESTR-02', 'Cemento Estructural de Alta Resistencia', 'Cementos', 'BOLSA', 29.00, 38.50, 310.00, 50.00),
('00000004-0000-0000-0000-000000000003', 'ARE-FINA-03', 'Arena Fina Lavada para Mampostería', 'Agregados', 'M3', 55.00, 78.00, 95.00, 20.00),
('00000004-0000-0000-0000-000000000004', 'GRA-TRIT-04', 'Grava Triturada 3/4 Pulgada Concretos', 'Agregados', 'M3', 62.00, 88.00, 70.00, 15.00),
('00000004-0000-0000-0000-000000000005', 'YES-CONS-05', 'Yeso de Construcción y Acabados', 'Acabados', 'BOLSA', 14.50, 22.00, 120.00, 25.00),
('00000004-0000-0000-0000-000000000006', 'VAR-CORR-06', 'Acero de Refuerzo Varilla 1/2 pulgada', 'Acero', 'TONELADA', 720.00, 930.00, 14.00, 3.00);

-- 5. Inserción de Pedidos de Ejemplo
-- Venta inicial pagada para poblar indicadores financieros
INSERT INTO `pedidos` (`id`, `tipo_documento`, `codigo_orden`, `cliente_id`, `vendedor_id`, `vehiculo_id`, `subtotal`, `impuesto`, `total`, `metodo_pago`, `estado`, `fecha_vencimiento`, `observaciones`) VALUES
('00000005-0000-0000-0000-000000000001', 'VENTA', 'VTA-2026-0001', '00000003-0000-0000-0000-000000000001', '00000001-0000-0000-0000-000000000003', '00000002-0000-0000-0000-000000000002', 3400.00, 0.00, 3400.00, 'TRANSFERENCIA', 'PAGADO', '2026-09-30', 'Despachado en Camión Isuzu - Obra Centro');

-- Detalles de la Venta Cobrada (100 bolsas de cemento vendidas a 34.00 con costo 26.50)
INSERT INTO `detalles_pedido` (`id`, `pedido_id`, `producto_id`, `cantidad`, `precio_unitario`, `costo_unitario`, `precio_total`) VALUES
('00000006-0000-0000-0000-000000000001', '00000005-0000-0000-0000-000000000001', '00000004-0000-0000-0000-000000000001', 100.00, 34.00, 26.50, 3400.00);

-- Comisión generada para el vendedor (3.5% de 3400 = 119.00)
INSERT INTO `comisiones` (`id`, `vendedor_id`, `pedido_id`, `monto`, `estado`) VALUES
('00000007-0000-0000-0000-000000000001', '00000001-0000-0000-0000-000000000003', '00000005-0000-0000-0000-000000000001', 119.00, 'PENDIENTE');

-- Cotización pendiente de ejemplo para convertir
INSERT INTO `pedidos` (`id`, `tipo_documento`, `codigo_orden`, `cliente_id`, `vendedor_id`, `vehiculo_id`, `subtotal`, `impuesto`, `total`, `metodo_pago`, `estado`, `fecha_vencimiento`, `observaciones`) VALUES
('00000005-0000-0000-0000-000000000002', 'COTIZACION', 'COT-2026-0001', '00000003-0000-0000-0000-000000000002', '00000001-0000-0000-0000-000000000003', NULL, 1780.00, 0.00, 1780.00, 'CREDITO', 'PENDIENTE', '2026-10-15', 'Cotización vigente por 15 días con flete incluido');

INSERT INTO `detalles_pedido` (`id`, `pedido_id`, `producto_id`, `cantidad`, `precio_unitario`, `costo_unitario`, `precio_total`) VALUES
('00000006-0000-0000-0000-000000000002', '00000005-0000-0000-0000-000000000002', '00000004-0000-0000-0000-000000000003', 10.00, 78.00, 0.00, 780.00),
('00000006-0000-0000-0000-000000000003', '00000005-0000-0000-0000-000000000002', '00000004-0000-0000-0000-000000000004', 10.00, 88.00, 0.00, 880.00),
('00000006-0000-0000-0000-000000000004', '00000005-0000-0000-0000-000000000002', '00000004-0000-0000-0000-000000000005', 5.00, 24.00, 0.00, 120.00);

-- 6. Inserción de Gastos Operativos
-- Gasto de combustible con vehículo obligatorio
INSERT INTO `gastos` (`id`, `categoria`, `vehiculo_id`, `proveedor_id`, `monto`, `metodo_pago`, `numero_comprobante`, `descripcion`, `registrado_por`, `fecha_gasto`) VALUES
('00000008-0000-0000-0000-000000000001', 'COMBUSTIBLE', '00000002-0000-0000-0000-000000000001', NULL, 180.00, 'TRANSFERENCIA', 'FAC-EST-9812', 'Tanqueo Diesel 50 galones para despacho de agregados', '00000001-0000-0000-0000-000000000002', '2026-09-20'),
('00000008-0000-0000-0000-000000000002', 'MANTENIMIENTO_VEHICULO', '00000002-0000-0000-0000-000000000002', NULL, 140.00, 'EFECTIVO', 'REC-TALL-441', 'Cambio de aceite motor y filtros de aire', '00000001-0000-0000-0000-000000000002', '2026-09-21'),
('00000008-0000-0000-0000-000000000003', 'ALQUILER', NULL, NULL, 650.00, 'TRANSFERENCIA', 'CAN-SEP-2026', 'Canon de arrendamiento bodega principal de despacho', '00000001-0000-0000-0000-000000000002', '2026-09-15'),
('00000008-0000-0000-0000-000000000004', 'SERVICIOS_BASICOS', NULL, NULL, 95.00, 'TRANSFERENCIA', 'ELEC-SEP-889', 'Servicio de energía eléctrica trifásica almacén', '00000001-0000-0000-0000-000000000002', '2026-09-18');
