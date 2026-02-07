const jwt = require('jsonwebtoken');
const config = require('../config/config');
const userPostgresService = require('../services/userPostgresService');

// Middleware para verificar token JWT
const authenticate = async (req, res, next) => {
  try {
    // Pegar token do header
    const token = req.header('Authorization')?.replace('Bearer ', '');

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Token não fornecido. Acesso negado.',
      });
    }

    // Verificar token
    const decoded = jwt.verify(token, config.jwtSecret);

    // Buscar usuário
    const user = await userPostgresService.findUserById(decoded.id);

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Usuário não encontrado.',
      });
    }

    if (!user.is_active) {
      return res.status(401).json({
        success: false,
        message: 'Usuário inativo.',
      });
    }

    // Adicionar usuário ao request
    req.user = user;
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        message: 'Token inválido.',
      });
    }
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Token expirado.',
      });
    }
    res.status(500).json({
      success: false,
      message: 'Erro ao autenticar token.',
      error: error.message,
    });
  }
};

// Middleware para verificar se é admin
const isAdmin = (req, res, next) => {
  if (req.user && req.user.role === 'admin') {
    next();
  } else {
    res.status(403).json({
      success: false,
      message: 'Acesso negado. Apenas administradores.',
    });
  }
};

module.exports = {
  authenticate,
  isAdmin,
};

