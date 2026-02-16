const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const userPostgresService = require('../services/userPostgresService');
const planPostgresService = require('../services/planPostgresService');
const moniqueApiService = require('../services/moniqueApiService');
const { authenticate, isAdmin } = require('../middleware/auth');
const validate = require('../middleware/validation');
const config = require('../config/config');

// Normaliza o telefone: remove não dígitos, remove prefixo 55 se presente e remove um '9' inicial do número local
function normalizePhone(phoneRaw) {
  if (!phoneRaw) return '';
  let digits = phoneRaw.toString().replace(/\D/g, '');
  // remover prefixo de país 55 se houver
  if (digits.startsWith('55')) {
    digits = digits.slice(2);
  }
  // remover leading 0s
  while (digits.startsWith('0')) digits = digits.slice(1);
  // Se o número tem DDD + 9 + restante (11 dígitos), remover o '9' que vem após o DDD
  // Ex: 81986409513 -> 8186409513 (remover o primeiro 9 após os 2 dígitos do DDD)
  if (digits.length === 11 && digits.charAt(2) === '9') {
    digits = digits.slice(0, 2) + digits.slice(3);
  }
  return digits;
}

// @route   GET /api/users/:id
// @desc    Obter usuário do PostgreSQL por ID
// @access  Private
router.get('/:id', authenticate, async (req, res) => {
  try {
    // Usuário pode ver apenas seus próprios dados, a menos que seja admin
    if (req.user.id.toString() !== req.params.id && !req.user.is_admin) {
      return res.status(403).json({
        success: false,
        message: 'Acesso negado',
      });
    }

    const user = await userPostgresService.findUserById(parseInt(req.params.id));

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Usuário não encontrado',
      });
    }

    // Popular activePlan do Postgres se existir
    let activePlan = null;
    if (user.active_plan) {
      try {
        const plan = await planPostgresService.findPlanById(user.active_plan);
        if (plan) {
          activePlan = {
            id: plan.id,
            name: plan.name,
            description: plan.description,
            price: plan.price,
            duration: plan.duration,
            duration_unit: plan.duration_unit,
            features: plan.features,
          };
        }
      } catch (error) {
        console.error('Erro ao buscar plano ativo:', error);
      }
    }

    res.json({
      success: true,
      data: {
        user: {
          ...user,
          cpfCnpj: user.cpf_cnpj, // Adicionar cpfCnpj mapeado
          active_plan: activePlan,
        }
      },
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
// @desc    Atualizar dados do usuário (nome, telefone, CPF/CNPJ)
// @access  Private
router.put(
  '/:id',
  authenticate,
  [
    body('nome').optional().trim(),
    body('phone').optional().trim(),
    body('cpfCnpj')
      .optional()
      .trim()
      .custom((value) => {
        if (!value) return true;
        const cleanValue = value.replace(/\D/g, '');
        if (cleanValue.length === 11 || cleanValue.length === 14) return true;
        throw new Error('CPF deve ter 11 dígitos ou CNPJ deve ter 14 dígitos');
      }),
  ],
  validate,
  async (req, res) => {
    try {
      // Usuário pode atualizar apenas seus próprios dados, a menos que seja admin
      if (req.user.id.toString() !== req.params.id && !req.user.is_admin) {
        return res.status(403).json({
          success: false,
          message: 'Acesso negado',
        });
      }

      const userId = parseInt(req.params.id);
      const { nome, name, phone, cpfCnpj } = req.body;

      // Normalizar telefone se fornecido
      let telefone = undefined;
      if (phone) {
        telefone = normalizePhone(phone);
      }

      const updatedUser = await userPostgresService.updateUser(userId, {
        nome: nome || name,
        telefone,
        cpfCnpj,
      });

      if (!updatedUser) {
        return res.status(404).json({
          success: false,
          message: 'Usuário não encontrado',
        });
      }

      res.json({
        success: true,
        message: 'Usuário atualizado com sucesso',
        data: {
          user: updatedUser,
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

// ==================== ROTAS WHATSAPP ====================

const OTPCode = require('../models/OTPCode'); // Descontinuado - manter para compatibilidade
const otpPostgresService = require('../services/otpPostgresService');
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
      const userId = req.user.id; // Usar ID numérico do PostgreSQL

      // Buscar usuário do PostgreSQL
      const user = await userPostgresService.findUserById(userId);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'Usuário não encontrado',
        });
      }

      // Normalizar telefone conforme regra (armazenar sem o 9 e sem código do país)
      const normalizedPhone = normalizePhone(phone);

      // Gerar código OTP de 6 dígitos
      const otpCode = Math.floor(100000 + Math.random() * 900000).toString();

      // Invalidar códigos anteriores não verificados do mesmo email e telefone
      await otpPostgresService.invalidateOTPCodes(user.email, normalizedPhone);

      // Criar novo código OTP no PostgreSQL (expiração gerada pelo PostgreSQL via NOW())
      const otpRecord = await otpPostgresService.createOTP({
        userEmail: user.email,
        userId: userId,
        phone: normalizedPhone,
        code: otpCode,
        expirationMinutes: 5,
        maxAttempts: 5,
      });

      // Preparar payload para webhook no formato requisitado (sem + no prefixo)
      const webhookPayload = {
        numeroTelefone: `55${normalizedPhone}`,
        statusCode: 'code_pending',
        code: otpCode,
      };

      // Enviar webhook (não bloqueia a resposta)
      // Usar webhook específico de teste (override header conforme solicitado)
      sendWebhook(webhookPayload, {
        url: 'https://n8n.moniquebot.com.br/webhook/7d1c18e5-1837-4f3c-8ef7-659e9b1ade00',
        authHeader: 'monique-beta-test',
      }).catch((error) => {
        console.error('Erro ao enviar webhook (não crítico):', error);
      });

      console.log(`Código OTP gerado para usuário ${userId}: ${otpCode}`);

      res.json({
        success: true,
        message: 'Código de verificação enviado com sucesso',
        data: {
          expiresAt: otpRecord.expires_at,
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
    body('phone')
      .trim()
      .notEmpty()
      .withMessage('Telefone é obrigatório')
      .matches(/^\d{10,11}$/)
      .withMessage('Telefone deve conter 10 ou 11 dígitos sem formatação'),
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
      const { code, phone } = req.body;
      const userId = req.user.id; // Usar ID numérico do PostgreSQL

      // Buscar usuário do PostgreSQL
      const user = await userPostgresService.findUserById(userId);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'Usuário não encontrado',
        });
      }

      // Normalizar telefone e buscar código OTP não verificado e não expirado
      const normalizedPhone = normalizePhone(phone);
      const otpRecord = await otpPostgresService.findPendingOTP(user.email, code, normalizedPhone);

      if (!otpRecord) {
        // Verificar se existe um código para este usuário (para incrementar tentativas)
        const existingOtp = await otpPostgresService.findLatestOTP(user.email, null, false);

        if (existingOtp) {
          const updated = await otpPostgresService.incrementAttempts(existingOtp.id);

          if (updated.attempts >= updated.max_attempts) {
            // Invalidar código após muitas tentativas
            await otpPostgresService.verifyOTP(existingOtp.id);

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
      if (otpRecord.attempts >= otpRecord.max_attempts) {
        await otpPostgresService.verifyOTP(otpRecord.id);

        return res.status(400).json({
          success: false,
          message: 'Número máximo de tentativas excedido. Solicite um novo código.',
        });
      }

      // Verificar se o código expirou
      if (otpRecord.expires_at < new Date()) {
        return res.status(400).json({
          success: false,
          message: 'Código expirado. Solicite um novo código.',
        });
      }

      // Marcar código como verificado
      await otpPostgresService.verifyOTP(otpRecord.id);

      // Atualizar usuário PostgreSQL com o telefone verificado
      // (se houver função para isso - por enquanto apenas marcar OTP como verificado)

      // Armazenar informações no PostgreSQL quando o código for verificado
      // O webhook do N8N retornará o user_id do N8N posteriormente
      try {
        // Tentar buscar usuário no PostgreSQL pelo email primeiro
        let postgresUser = await userPostgresService.findUserByEmail(user.email);

        // Se não existir, criar novo registro
        if (!postgresUser) {
          await userPostgresService.createOrUpdateUser({
            email: user.email,
            nome: user.nome,
            telefone: otpRecord.phone,
            status: 'pending', // Status pendente até receber user_id do N8N
          });
        } else {
          // Se já existir, atualizar telefone e manter status
          await userPostgresService.createOrUpdateUser({
            email: user.email,
            nome: user.nome,
            telefone: otpRecord.phone,
            status: postgresUser.status || 'pending',
          });
        }
      } catch (postgresError) {
        console.error('Erro ao armazenar no PostgreSQL (não crítico):', postgresError);
        // Não falhar a verificação se houver erro no PostgreSQL
      }

      // Preparar payload para webhook (status de sucesso) no formato requisitado
      // Observação: o segundo envio não deve incluir o código, apenas numeroTelefone e statusCode
      const webhookPayload = {
        numeroTelefone: `55${otpRecord.phone}`,
        statusCode: 'code_verified',
      };

      // Enviar webhook e aguardar resposta para capturar user.id retornado pelo N8N
      try {
        const result = await sendWebhook(webhookPayload, {
          url: 'https://n8n.moniquebot.com.br/webhook/7d1c18e5-1837-4f3c-8ef7-659e9b1ade00',
          authHeader: 'monique-beta-test',
        });

        if (result && result.success && result.data) {
          const data = result.data;
          console.log('[WEBHOOK-DEBUG] Resposta completa do N8N:', JSON.stringify(data, null, 2));
          // tentar localizar user id retornado em várias chaves possíveis
          const returnedUserId = data?.user?.id || data?.id || data?.userId || data?.user_id;
          console.log('[WEBHOOK-DEBUG] userId extraído:', returnedUserId);
          if (returnedUserId) {
            try {
              let localPlanId = null;

              // Buscar informações do plano do usuário na API Monique
              const planData = await moniqueApiService.getUserPlan(returnedUserId);
              if (planData) {
                console.log('[PLAN] Plano do usuário encontrado:', JSON.stringify(planData, null, 2));

                // Sincronizar plano com a tabela local
                const localPlan = await planPostgresService.syncPlanFromApi(planData);
                if (localPlan) {
                  localPlanId = localPlan.id;
                  console.log('[PLAN] Plano sincronizado localmente. ID:', localPlan.id);
                }
              }

              // Salvar/atualizar usuário relacionando ao ID vindo do N8N e plano
              await userPostgresService.createOrUpdateUser({
                user_id: returnedUserId,
                email: user.email,
                nome: user.nome,
                telefone: otpRecord.phone,
                status: 'verified',
                active_plan: localPlanId,
              });
            } catch (upsertErr) {
              console.error('Erro ao salvar user_id ou buscar plano:', upsertErr);
            }
          }
        }
      } catch (webhookErr) {
        console.error('Erro ao enviar webhook de verificação (não crítico):', webhookErr);
      }

      res.json({
        success: true,
        message: 'WhatsApp vinculado com sucesso',
        data: {
          user: {
            id: user.id,
            nome: user.nome,
            email: user.email,
            telefone: otpRecord.phone,
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

