const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const planPostgresService = require('../services/planPostgresService');
const { authenticate, isAdmin } = require('../middleware/auth');
const validate = require('../middleware/validation');

// @route   GET /api/plans
// @desc    Listar todos os planos ativos
// @access  Public
router.get('/', async (req, res) => {
  try {
    let isActive = true;
    
    // Admin pode ver todos os planos
    if (req.query.all === 'true') {
      const auth = require('../middleware/auth');
      // Verificar se é admin (sem retornar erro se não for)
      try {
        await new Promise((resolve, reject) => {
          auth.authenticate(req, res, (err) => {
            if (err) reject(err);
            else resolve();
          });
        });
        if (req.user && req.user.role === 'admin') {
          isActive = undefined; // Mostrar todos
        }
      } catch (error) {
        // Não autenticado, continuar com filtro de ativos
      }
    }

    const result = await planPostgresService.listPlans({ 
      isActive,
      page: parseInt(req.query.page) || 1,
      limit: parseInt(req.query.limit) || 100,
    });

    res.json({
      success: true,
      data: { plans: result.plans },
    });
  } catch (error) {
    console.error('Erro ao listar planos:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao listar planos',
      error: error.message,
    });
  }
});

// @route   GET /api/plans/:id
// @desc    Obter plano por ID
// @access  Public
router.get('/:id', async (req, res) => {
  try {
    const planId = parseInt(req.params.id);
    if (isNaN(planId)) {
      return res.status(400).json({
        success: false,
        message: 'ID do plano inválido',
      });
    }

    const plan = await planPostgresService.findPlanById(planId);

    if (!plan) {
      return res.status(404).json({
        success: false,
        message: 'Plano não encontrado',
      });
    }

    // Se não for admin, só mostrar planos ativos
    if (!plan.isActive) {
      try {
        const auth = require('../middleware/auth');
        await new Promise((resolve, reject) => {
          auth.authenticate(req, res, (err) => {
            if (err) reject(err);
            else resolve();
          });
        });
        if (!req.user || req.user.role !== 'admin') {
          return res.status(404).json({
            success: false,
            message: 'Plano não encontrado',
          });
        }
      } catch (error) {
        return res.status(404).json({
          success: false,
          message: 'Plano não encontrado',
        });
      }
    }

    res.json({
      success: true,
      data: { plan },
    });
  } catch (error) {
    console.error('Erro ao buscar plano:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao buscar plano',
      error: error.message,
    });
  }
});

// @route   POST /api/plans
// @desc    Criar novo plano (apenas admin)
// @access  Private/Admin
router.post(
  '/',
  authenticate,
  isAdmin,
  [
    body('name')
      .trim()
      .notEmpty()
      .withMessage('Nome do plano é obrigatório'),
    body('price')
      .isFloat({ min: 0 })
      .withMessage('Preço deve ser um número positivo'),
    body('duration')
      .isInt({ min: 1 })
      .withMessage('Duração deve ser um número inteiro positivo'),
    body('durationUnit')
      .optional()
      .isIn(['days', 'months', 'years'])
      .withMessage('Unidade de duração inválida'),
  ],
  validate,
  async (req, res) => {
    try {
      // Verificar se já existe plano com este nome
      const existingPlan = await planPostgresService.findPlanByName(req.body.name);
      if (existingPlan) {
        return res.status(400).json({
          success: false,
          message: 'Já existe um plano com este nome',
        });
      }

      const plan = await planPostgresService.createPlan(req.body);

      res.status(201).json({
        success: true,
        message: 'Plano criado com sucesso',
        data: { plan },
      });
    } catch (error) {
      if (error.code === '23505') { // PostgreSQL unique violation
        return res.status(400).json({
          success: false,
          message: 'Já existe um plano com este nome',
        });
      }
      console.error('Erro ao criar plano:', error);
      res.status(500).json({
        success: false,
        message: 'Erro ao criar plano',
        error: error.message,
      });
    }
  }
);

// @route   PUT /api/plans/:id
// @desc    Atualizar plano (apenas admin)
// @access  Private/Admin
router.put(
  '/:id',
  authenticate,
  isAdmin,
  [
    body('name')
      .optional()
      .trim()
      .notEmpty()
      .withMessage('Nome do plano não pode ser vazio'),
    body('price')
      .optional()
      .isFloat({ min: 0 })
      .withMessage('Preço deve ser um número positivo'),
    body('duration')
      .optional()
      .isInt({ min: 1 })
      .withMessage('Duração deve ser um número inteiro positivo'),
    body('durationUnit')
      .optional()
      .isIn(['days', 'months', 'years'])
      .withMessage('Unidade de duração inválida'),
  ],
  validate,
  async (req, res) => {
    try {
      const planId = parseInt(req.params.id);
      if (isNaN(planId)) {
        return res.status(400).json({
          success: false,
          message: 'ID do plano inválido',
        });
      }

      const plan = await planPostgresService.findPlanById(planId);

      if (!plan) {
        return res.status(404).json({
          success: false,
          message: 'Plano não encontrado',
        });
      }

      // Verificar se nome já está em uso
      if (req.body.name && req.body.name !== plan.name) {
        const existingPlan = await planPostgresService.findPlanByName(req.body.name);
        if (existingPlan) {
          return res.status(400).json({
            success: false,
            message: 'Já existe um plano com este nome',
          });
        }
      }

      // Mapear campos para o formato do serviço
      const updateData = {};
      if (req.body.name !== undefined) updateData.name = req.body.name;
      if (req.body.description !== undefined) updateData.description = req.body.description;
      if (req.body.price !== undefined) updateData.price = req.body.price;
      if (req.body.duration !== undefined) updateData.duration = req.body.duration;
      if (req.body.durationUnit !== undefined) updateData.durationUnit = req.body.durationUnit;
      if (req.body.features !== undefined) updateData.features = req.body.features;
      if (req.body.credits !== undefined) updateData.credits = req.body.credits;
      if (req.body.isUnlimited !== undefined) updateData.isUnlimited = req.body.isUnlimited;
      if (req.body.isActive !== undefined) updateData.isActive = req.body.isActive;

      const updatedPlan = await planPostgresService.updatePlan(planId, updateData);

      res.json({
        success: true,
        message: 'Plano atualizado com sucesso',
        data: { plan: updatedPlan },
      });
    } catch (error) {
      if (error.code === '23505') { // PostgreSQL unique violation
        return res.status(400).json({
          success: false,
          message: 'Já existe um plano com este nome',
        });
      }
      console.error('Erro ao atualizar plano:', error);
      res.status(500).json({
        success: false,
        message: 'Erro ao atualizar plano',
        error: error.message,
      });
    }
  }
);

// @route   DELETE /api/plans/:id
// @desc    Deletar plano (soft delete - apenas admin)
// @access  Private/Admin
router.delete('/:id', authenticate, isAdmin, async (req, res) => {
  try {
    const planId = parseInt(req.params.id);
    if (isNaN(planId)) {
      return res.status(400).json({
        success: false,
        message: 'ID do plano inválido',
      });
    }

    const plan = await planPostgresService.findPlanById(planId);

    if (!plan) {
      return res.status(404).json({
        success: false,
        message: 'Plano não encontrado',
      });
    }

    // Soft delete - apenas desativar
    await planPostgresService.deactivatePlan(planId);

    res.json({
      success: true,
      message: 'Plano desativado com sucesso',
    });
  } catch (error) {
    console.error('Erro ao desativar plano:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao desativar plano',
      error: error.message,
    });
  }
});

module.exports = router;

