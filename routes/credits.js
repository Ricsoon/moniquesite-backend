const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const User = require('../models/User');
const planPostgresService = require('../services/planPostgresService');
const { authenticate, isAdmin } = require('../middleware/auth');
const validate = require('../middleware/validation');

// @route   GET /api/credits/balance
// @desc    Obter saldo de créditos do usuário
// @access  Private
router.get('/balance', authenticate, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    
    // Popular activePlan do Postgres se existir
    let activePlan = null;
    if (user.activePlan) {
      try {
        const planId = parseInt(user.activePlan);
        if (!isNaN(planId)) {
          activePlan = await planPostgresService.findPlanById(planId);
        }
      } catch (error) {
        console.error('Erro ao buscar plano ativo:', error);
      }
    }

    const availableCredits = user.hasUnlimitedCredits ? 'unlimited' : (user.credits || 0);
    const usedCredits = user.creditsUsed || 0;

    res.json({
      success: true,
      data: {
        credits: availableCredits,
        creditsUsed: usedCredits,
        hasUnlimitedCredits: user.hasUnlimitedCredits,
        activePlan: activePlan ? {
          _id: activePlan._id,
          id: activePlan.id,
          name: activePlan.name,
          credits: activePlan.credits,
          isUnlimited: activePlan.isUnlimited,
        } : null,
        planStartDate: user.planStartDate,
        planEndDate: user.planEndDate,
      },
    });
  } catch (error) {
    console.error('Erro ao buscar saldo de créditos:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao buscar saldo de créditos',
      error: error.message,
    });
  }
});

// @route   POST /api/credits/consume
// @desc    Consumir créditos do usuário
// @access  Private
router.post(
  '/consume',
  authenticate,
  [
    body('amount')
      .isInt({ min: 1 })
      .withMessage('Quantidade de créditos deve ser um número inteiro positivo'),
  ],
  validate,
  async (req, res) => {
    try {
      const { amount } = req.body;
      const user = await User.findById(req.user._id);

      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'Usuário não encontrado',
        });
      }

      // Verificar se tem créditos ilimitados
      if (user.hasUnlimitedCredits) {
        // Usuário com créditos ilimitados, apenas incrementar créditos utilizados
        user.creditsUsed = (user.creditsUsed || 0) + amount;
        await user.save();

        return res.json({
          success: true,
          message: 'Créditos consumidos com sucesso',
          data: {
            credits: 'unlimited',
            creditsUsed: user.creditsUsed,
            amountConsumed: amount,
          },
        });
      }

      // Verificar se tem créditos suficientes
      if (user.credits < amount) {
        return res.status(400).json({
          success: false,
          message: 'Créditos insuficientes',
          data: {
            available: user.credits,
            required: amount,
            deficit: amount - user.credits,
          },
        });
      }

      // Consumir créditos
      user.credits -= amount;
      user.creditsUsed = (user.creditsUsed || 0) + amount;
      await user.save();

      res.json({
        success: true,
        message: 'Créditos consumidos com sucesso',
        data: {
          credits: user.credits,
          creditsUsed: user.creditsUsed,
          amountConsumed: amount,
        },
      });
    } catch (error) {
      console.error('Erro ao consumir créditos:', error);
      res.status(500).json({
        success: false,
        message: 'Erro ao consumir créditos',
        error: error.message,
      });
    }
  }
);

// @route   POST /api/credits/add
// @desc    Adicionar créditos ao usuário (apenas admin)
// @access  Private/Admin
router.post(
  '/add',
  authenticate,
  isAdmin,
  [
    body('userId')
      .notEmpty()
      .withMessage('ID do usuário é obrigatório')
      .isMongoId()
      .withMessage('ID do usuário inválido'),
    body('amount')
      .isInt({ min: 1 })
      .withMessage('Quantidade de créditos deve ser um número inteiro positivo'),
  ],
  validate,
  async (req, res) => {
    try {
      const { userId, amount } = req.body;
      const user = await User.findById(userId);

      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'Usuário não encontrado',
        });
      }

      // Não adicionar créditos se o usuário tem créditos ilimitados
      if (user.hasUnlimitedCredits) {
        return res.status(400).json({
          success: false,
          message: 'Usuário possui créditos ilimitados',
        });
      }

      user.credits = (user.credits || 0) + amount;
      await user.save();

      res.json({
        success: true,
        message: 'Créditos adicionados com sucesso',
        data: {
          userId: user._id,
          credits: user.credits,
          amountAdded: amount,
        },
      });
    } catch (error) {
      console.error('Erro ao adicionar créditos:', error);
      res.status(500).json({
        success: false,
        message: 'Erro ao adicionar créditos',
        error: error.message,
      });
    }
  }
);

// @route   POST /api/credits/reset
// @desc    Resetar créditos utilizados (apenas admin)
// @access  Private/Admin
router.post(
  '/reset',
  authenticate,
  isAdmin,
  [
    body('userId')
      .optional()
      .isMongoId()
      .withMessage('ID do usuário inválido'),
  ],
  validate,
  async (req, res) => {
    try {
      const userId = req.body.userId || req.user._id;
      const user = await User.findById(userId);

      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'Usuário não encontrado',
        });
      }

      // Resetar créditos utilizados
      user.creditsUsed = 0;
      await user.save();

      res.json({
        success: true,
        message: 'Créditos utilizados resetados com sucesso',
        data: {
          userId: user._id,
          creditsUsed: 0,
        },
      });
    } catch (error) {
      console.error('Erro ao resetar créditos:', error);
      res.status(500).json({
        success: false,
        message: 'Erro ao resetar créditos',
        error: error.message,
      });
    }
  }
);

// @route   GET /api/credits/check
// @desc    Verificar se usuário tem créditos suficientes
// @access  Private
router.get(
  '/check',
  authenticate,
  async (req, res) => {
    try {
      const { amount } = req.query;
      const requiredAmount = parseInt(amount) || 0;

      if (requiredAmount <= 0) {
        return res.status(400).json({
          success: false,
          message: 'Quantidade de créditos deve ser maior que zero',
        });
      }

      const user = await User.findById(req.user._id);

      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'Usuário não encontrado',
        });
      }

      // Verificar se tem créditos ilimitados
      if (user.hasUnlimitedCredits) {
        return res.json({
          success: true,
          data: {
            hasEnoughCredits: true,
            credits: 'unlimited',
            required: requiredAmount,
          },
        });
      }

      const hasEnough = user.credits >= requiredAmount;

      res.json({
        success: true,
        data: {
          hasEnoughCredits: hasEnough,
          credits: user.credits,
          required: requiredAmount,
          deficit: hasEnough ? 0 : requiredAmount - user.credits,
        },
      });
    } catch (error) {
      console.error('Erro ao verificar créditos:', error);
      res.status(500).json({
        success: false,
        message: 'Erro ao verificar créditos',
        error: error.message,
      });
    }
  }
);

// @route   POST /api/credits/credito_usuarios
// @desc    Adicionar créditos ao usuário via API externa (chamado quando pagamento é confirmado)
// @access  Public (será chamado por API externa após confirmação de pagamento)
router.post(
  '/credito_usuarios',
  [
    body('telefone')
      .trim()
      .notEmpty()
      .withMessage('Telefone é obrigatório')
      .matches(/^\d{10,15}$/)
      .withMessage('Telefone deve conter apenas números (10 a 15 dígitos)'),
    body('creditos')
      .isInt({ min: 1 })
      .withMessage('Quantidade de créditos deve ser um número inteiro positivo'),
  ],
  validate,
  async (req, res) => {
    try {
      const { telefone, creditos } = req.body;

      // Buscar usuário pelo número de telefone
      const user = await User.findOne({ phone: telefone.trim() });

      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'Usuário não encontrado com o número de telefone informado',
        });
      }

      // Verificar se usuário tem créditos ilimitados (não deve adicionar créditos)
      if (user.hasUnlimitedCredits) {
        return res.status(400).json({
          success: false,
          message: 'Usuário possui créditos ilimitados. Não é possível adicionar créditos adicionais.',
        });
      }

      // Verificar se já tem saldo
      const saldoAtual = user.credits || 0;

      // Atualizar saldo: somar os novos créditos ao saldo existente
      const novoSaldo = saldoAtual + creditos;
      user.credits = novoSaldo;
      await user.save();

      console.log(`Créditos adicionados para usuário ${user._id} (telefone: ${telefone}): ${creditos} créditos. Saldo anterior: ${saldoAtual}, Saldo atual: ${novoSaldo}`);

      res.json({
        success: true,
        message: 'Créditos adicionados com sucesso',
        data: {
          user_id: user._id.toString(),
          telefone: telefone,
          creditos_adicionados: creditos,
          saldo_anterior: saldoAtual,
          saldo_atual: novoSaldo,
        },
      });
    } catch (error) {
      console.error('Erro ao adicionar créditos via API externa:', error);
      res.status(500).json({
        success: false,
        message: 'Erro ao adicionar créditos',
        error: error.message,
      });
    }
  }
);

module.exports = router;

