const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const User = require('../models/User');
const planPostgresService = require('../services/planPostgresService');
const { authenticate, isAdmin } = require('../middleware/auth');
const validate = require('../middleware/validation');

// @route   GET /api/users
// @desc    Listar todos os usuários (apenas admin)
// @access  Private/Admin
router.get('/', authenticate, isAdmin, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const filter = {};
    if (req.query.search) {
      filter.$or = [
        { name: { $regex: req.query.search, $options: 'i' } },
        { email: { $regex: req.query.search, $options: 'i' } },
      ];
    }
    if (req.query.phone) {
      filter.phone = req.query.phone.trim();
    }
    if (req.query.isActive !== undefined) {
      filter.isActive = req.query.isActive === 'true';
    }

    const users = await User.find(filter)
      .select('-password')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    // Popular activePlan do Postgres para cada usuário
    for (let user of users) {
      if (user.activePlan) {
        try {
          const planId = parseInt(user.activePlan);
          if (!isNaN(planId)) {
            const plan = await planPostgresService.findPlanById(planId);
            user.activePlan = plan ? {
              _id: plan._id,
              id: plan.id,
              name: plan.name,
              price: plan.price,
            } : null;
          }
        } catch (error) {
          console.error('Erro ao buscar plano ativo:', error);
          user.activePlan = null;
        }
      }
    }

    const total = await User.countDocuments(filter);

    res.json({
      success: true,
      data: {
        users,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error) {
    console.error('Erro ao listar usuários:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao listar usuários',
      error: error.message,
    });
  }
});

// @route   GET /api/users/:id
// @desc    Obter usuário por ID
// @access  Private
router.get('/:id', authenticate, async (req, res) => {
  try {
    // Usuário pode ver apenas seus próprios dados, a menos que seja admin
    if (req.user._id.toString() !== req.params.id && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Acesso negado',
      });
    }

    const user = await User.findById(req.params.id)
      .select('-password');

    // Popular activePlan do Postgres se existir
    if (user && user.activePlan) {
      try {
        const planId = parseInt(user.activePlan);
        if (!isNaN(planId)) {
          const plan = await planPostgresService.findPlanById(planId);
          user.activePlan = plan ? {
            _id: plan._id,
            id: plan.id,
            name: plan.name,
            description: plan.description,
            price: plan.price,
            duration: plan.duration,
            durationUnit: plan.durationUnit,
            features: plan.features,
          } : null;
        }
      } catch (error) {
        console.error('Erro ao buscar plano ativo:', error);
        user.activePlan = null;
      }
    }

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Usuário não encontrado',
      });
    }

    res.json({
      success: true,
      data: { user },
    });
  } catch (error) {
    console.error('Erro ao buscar usuário:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao buscar usuário',
      error: error.message,
    });
  }
});

// @route   PUT /api/users/:id
// @desc    Atualizar usuário
// @access  Private
router.put(
  '/:id',
  authenticate,
  [
    body('name')
      .optional()
      .trim()
      .isLength({ min: 2 })
      .withMessage('Nome deve ter no mínimo 2 caracteres'),
    body('email')
      .optional()
      .isEmail()
      .withMessage('Email inválido')
      .normalizeEmail(),
    body('phone')
      .optional()
      .trim(),
    body('cpfCnpj')
      .optional()
      .trim(),
    body('postalCode')
      .optional()
      .trim(),
    body('address')
      .optional()
      .trim(),
    body('addressNumber')
      .optional()
      .trim(),
    body('complement')
      .optional()
      .trim(),
    body('province')
      .optional()
      .trim(),
    body('city')
      .optional()
      .trim(),
    body('state')
      .optional()
      .trim(),
    body('password')
      .optional()
      .isLength({ min: 6 })
      .withMessage('Senha deve ter no mínimo 6 caracteres'),
  ],
  validate,
  async (req, res) => {
    try {
      // Usuário pode atualizar apenas seus próprios dados, a menos que seja admin
      if (req.user._id.toString() !== req.params.id && req.user.role !== 'admin') {
        return res.status(403).json({
          success: false,
          message: 'Acesso negado',
        });
      }

      const user = await User.findById(req.params.id);

      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'Usuário não encontrado',
        });
      }

      // Verificar se email já está em uso
      if (req.body.email && req.body.email !== user.email) {
        const existingUser = await User.findOne({ email: req.body.email });
        if (existingUser) {
          return res.status(400).json({
            success: false,
            message: 'Email já está em uso',
          });
        }
      }

      // Atualizar campos
      Object.keys(req.body).forEach((key) => {
        if (req.body[key] !== undefined && key !== 'role' && key !== 'isActive' && key !== 'asaasCustomerId') {
          user[key] = req.body[key];
        }
        // Apenas admin pode alterar role, isActive e asaasCustomerId
        if ((key === 'role' || key === 'isActive' || key === 'asaasCustomerId') && req.user.role === 'admin') {
          user[key] = req.body[key];
        }
      });

      await user.save();

      // Se dados do usuário foram atualizados e ele tem asaasCustomerId, atualizar no Asaas
      if (user.asaasCustomerId && (req.body.name || req.body.email || req.body.phone || req.body.cpfCnpj)) {
        try {
          const asaasService = require('../services/asaasService');
          await asaasService.createOrUpdateCustomer({
            asaasCustomerId: user.asaasCustomerId,
            name: user.name,
            email: user.email,
            phone: user.phone,
            cpfCnpj: user.cpfCnpj,
            postalCode: user.postalCode,
            address: user.address,
            addressNumber: user.addressNumber,
            complement: user.complement,
            province: user.province,
            city: user.city,
            state: user.state,
          });
        } catch (error) {
          console.error('Erro ao atualizar cliente no Asaas:', error);
          // Não falhar a atualização do usuário se houver erro no Asaas
        }
      }

      res.json({
        success: true,
        message: 'Usuário atualizado com sucesso',
        data: {
          user: {
            id: user._id,
            name: user.name,
            email: user.email,
            phone: user.phone,
            role: user.role,
            isActive: user.isActive,
            activePlan: user.activePlan,
          },
        },
      });
    } catch (error) {
      console.error('Erro ao atualizar usuário:', error);
      res.status(500).json({
        success: false,
        message: 'Erro ao atualizar usuário',
        error: error.message,
      });
    }
  }
);

// @route   DELETE /api/users/:id
// @desc    Deletar usuário (soft delete - apenas admin)
// @access  Private/Admin
router.delete('/:id', authenticate, isAdmin, async (req, res) => {
  try {
    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Usuário não encontrado',
      });
    }

    // Soft delete - apenas desativar
    user.isActive = false;
    await user.save();

    res.json({
      success: true,
      message: 'Usuário desativado com sucesso',
    });
  } catch (error) {
    console.error('Erro ao desativar usuário:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao desativar usuário',
      error: error.message,
    });
  }
});

// ==================== ROTAS WHATSAPP ====================

const OTPCode = require('../models/OTPCode');
const { sendWebhook } = require('../services/webhookService');

// @route   POST /api/users/whatsapp/send-code
// @desc    Enviar código de verificação OTP para WhatsApp
// @access  Private
router.post(
  '/whatsapp/send-code',
  authenticate,
  [
    body('phone')
      .trim()
      .notEmpty()
      .withMessage('Telefone é obrigatório')
      .matches(/^\d{10,15}$/)
      .withMessage('Telefone deve conter apenas números (10 a 15 dígitos)'),
  ],
  validate,
  async (req, res) => {
    try {
      const { phone } = req.body;
      const userId = req.user._id;

      // Buscar usuário completo
      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'Usuário não encontrado',
        });
      }

      // Gerar código OTP de 6 dígitos
      const otpCode = Math.floor(100000 + Math.random() * 900000).toString();

      // Definir expiração (10 minutos)
      const expiresAt = new Date();
      expiresAt.setMinutes(expiresAt.getMinutes() + 10);

      // Invalidar códigos anteriores não verificados do mesmo usuário e telefone
      await OTPCode.updateMany(
        {
          userId,
          phone,
          verified: false,
        },
        {
          $set: { verified: true }, // Marcar como "usado" para invalidar
        }
      );

      // Criar novo código OTP
      const otpRecord = new OTPCode({
        userId,
        phone,
        code: otpCode,
        expiresAt,
        verified: false,
        attempts: 0,
      });

      await otpRecord.save();

      // Preparar payload para webhook
      const webhookPayload = {
        user_id: userId.toString(),
        nome: user.name,
        email: user.email,
        telefone: phone,
        codigo_otp: otpCode,
        status: 'code_pending',
      };

      // Enviar webhook (não bloqueia a resposta)
      sendWebhook(webhookPayload).catch((error) => {
        console.error('Erro ao enviar webhook (não crítico):', error);
      });

      console.log(`Código OTP gerado para usuário ${userId}: ${otpCode}`);

      res.json({
        success: true,
        message: 'Código de verificação enviado com sucesso',
        data: {
          expiresAt: expiresAt.toISOString(),
        },
      });
    } catch (error) {
      console.error('Erro ao enviar código OTP:', error);
      res.status(500).json({
        success: false,
        message: 'Erro ao enviar código de verificação',
        error: error.message,
      });
    }
  }
);

// @route   POST /api/users/whatsapp/verify-code
// @desc    Verificar código OTP e vincular WhatsApp
// @access  Private
router.post(
  '/whatsapp/verify-code',
  authenticate,
  [
    body('code')
      .trim()
      .notEmpty()
      .withMessage('Código é obrigatório')
      .matches(/^\d{6}$/)
      .withMessage('Código deve conter exatamente 6 dígitos'),
  ],
  validate,
  async (req, res) => {
    try {
      const { code } = req.body;
      const userId = req.user._id;

      // Buscar código OTP não verificado e não expirado
      const otpRecord = await OTPCode.findOne({
        userId,
        code,
        verified: false,
        expiresAt: { $gt: new Date() },
      });

      if (!otpRecord) {
        // Verificar se existe um código para este usuário (para incrementar tentativas)
        const existingOtp = await OTPCode.findOne({
          userId,
          verified: false,
          expiresAt: { $gt: new Date() },
        }).sort({ createdAt: -1 });

        if (existingOtp) {
          existingOtp.attempts += 1;
          await existingOtp.save();

          if (existingOtp.attempts >= existingOtp.maxAttempts) {
            // Invalidar código após muitas tentativas
            existingOtp.verified = true;
            await existingOtp.save();

            return res.status(400).json({
              success: false,
              message: 'Número máximo de tentativas excedido. Solicite um novo código.',
            });
          }
        }

        return res.status(400).json({
          success: false,
          message: 'Código inválido ou expirado',
        });
      }

      // Verificar tentativas
      if (otpRecord.attempts >= otpRecord.maxAttempts) {
        otpRecord.verified = true;
        await otpRecord.save();

        return res.status(400).json({
          success: false,
          message: 'Número máximo de tentativas excedido. Solicite um novo código.',
        });
      }

      // Verificar se o código expirou
      if (otpRecord.expiresAt < new Date()) {
        return res.status(400).json({
          success: false,
          message: 'Código expirado. Solicite um novo código.',
        });
      }

      // Marcar código como verificado
      otpRecord.verified = true;
      otpRecord.verifiedAt = new Date();
      await otpRecord.save();

      // Atualizar telefone do usuário
      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'Usuário não encontrado',
        });
      }

      user.phone = otpRecord.phone;
      await user.save();

      // Armazenar informações no PostgreSQL quando o código for verificado
      // O webhook do N8N retornará o user_id do N8N posteriormente
      // Por enquanto, armazenamos com status 'pending' até receber o user_id do N8N
      try {
        const userPostgresService = require('../services/userPostgresService');
        
        // Tentar buscar usuário no PostgreSQL pelo email primeiro
        let postgresUser = await userPostgresService.findUserByEmail(user.email);
        
        // Se não existir, criar novo registro
        if (!postgresUser) {
          await userPostgresService.createOrUpdateUser({
            email: user.email,
            nome: user.name,
            telefone: otpRecord.phone,
            status: 'pending', // Status pendente até receber user_id do N8N
          });
        } else {
          // Se já existir, atualizar telefone e manter status
          await userPostgresService.createOrUpdateUser({
            email: user.email,
            nome: user.name,
            telefone: otpRecord.phone,
            status: postgresUser.status || 'pending',
          });
        }
      } catch (postgresError) {
        console.error('Erro ao armazenar no PostgreSQL (não crítico):', postgresError);
        // Não falhar a verificação se houver erro no PostgreSQL
      }

      // Preparar payload para webhook (status de sucesso)
      const webhookPayload = {
        user_id: userId.toString(),
        nome: user.name,
        email: user.email,
        telefone: otpRecord.phone,
        codigo_otp: code,
        status: 'code_verified',
      };

      // Enviar webhook (não bloqueia a resposta)
      sendWebhook(webhookPayload).catch((error) => {
        console.error('Erro ao enviar webhook (não crítico):', error);
      });

      res.json({
        success: true,
        message: 'WhatsApp vinculado com sucesso',
        data: {
          user: {
            id: user._id,
            name: user.name,
            email: user.email,
            phone: user.phone,
          },
        },
      });
    } catch (error) {
      console.error('Erro ao verificar código OTP:', error);
      res.status(500).json({
        success: false,
        message: 'Erro ao verificar código',
        error: error.message,
      });
    }
  }
);

module.exports = router;

