const { validationResult } = require('express-validator');

// Middleware para validar resultados da validação
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Erros de validação',
      errors: errors.array(),
    });
  }
  next();
};

module.exports = validate;

