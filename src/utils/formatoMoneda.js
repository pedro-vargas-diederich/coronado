/**
 * Utilidad de formateo financiero para Bolivia (Moneda nacional: Bolivianos - Bs)
 */

/**
 * Formatea un número o cadena numérica a formato de Bolivianos (Bs)
 * Ejemplo: 1250.5 -> "Bs 1,250.50"
 * @param {number|string|null|undefined} valor 
 * @returns {string} Valor formateado en Bs
 */
function formatMoney(valor) {
  if (valor === null || valor === undefined || valor === '') {
    return 'Bs 0.00';
  }

  const numero = typeof valor === 'number' ? valor : parseFloat(valor);

  if (isNaN(numero)) {
    return 'Bs 0.00';
  }

  const esNegativo = numero < 0;
  const absoluto = Math.abs(numero);
  
  // Separación de miles con coma y 2 decimales fijos con punto
  const partes = absoluto.toFixed(2).split('.');
  partes[0] = partes[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  
  const montoFormateado = partes.join('.');
  return `${esNegativo ? '-' : ''}Bs ${montoFormateado}`;
}

/**
 * Formato alternativo con convención decimal por coma (Bs 1.250,50)
 * @param {number|string} valor 
 * @returns {string}
 */
function formatMoneyLocal(valor) {
  if (valor === null || valor === undefined || valor === '') {
    return 'Bs 0,00';
  }

  const numero = typeof valor === 'number' ? valor : parseFloat(valor);

  if (isNaN(numero)) {
    return 'Bs 0,00';
  }

  const esNegativo = numero < 0;
  const absoluto = Math.abs(numero);

  const partes = absoluto.toFixed(2).split('.');
  partes[0] = partes[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.');

  return `${esNegativo ? '-' : ''}Bs ${partes[0]},${partes[1]}`;
}

module.exports = {
  formatMoney,
  formatMoneyLocal
};
