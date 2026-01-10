const jwt = require('jsonwebtoken');
const config = require('../config/config');

// Gerar token de acesso
const generateAccessToken = (userId) => {
  return jwt.sign(
    { id: userId },
    config.jwtSecret,
    { expiresIn: config.jwtExpire }
  );
};

// Gerar token de refresh
const generateRefreshToken = (userId) => {
  return jwt.sign(
    { id: userId },
    config.jwtRefreshSecret,
    { expiresIn: config.jwtRefreshExpire }
  );
};

// Verificar token de refresh
const verifyRefreshToken = (token) => {
  return jwt.verify(token, config.jwtRefreshSecret);
};

module.exports = {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
};

