const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const validate = require('../middleware/validation');
const transactionPostgresService = require('../services/transactionPostgresService');
const planPostgresService = require('../services/planPostgresService');
const externalCreditsService = require('../services/externalCreditsService');
const User = require('../models/User');
const { getPayment, getSubscription } = require('../services/asaasService');
const userPostgresService = require('../services/userPostgresService');

/**
 * Webhook da Asaas para notificações de pagamentos
 * Documentação: https://docs.asaas.com/reference/webhook
 */
router.post('/asaas', async (req, res) => {
  try {
    const event = req.body.event;
    const payment = req.body.payment;
    const subscription = req.body.subscription;

    console.log('Webhook Asaas recebido:', { 
      event, 
      paymentId: payment?.id,
      subscriptionId: subscription?.id 
    });

    // Responder rapidamente para a Asaas
    res.status(200).json({ received: true });

    // Processar evento de forma assíncrona
    processWebhookEvent(event, payment || subscription).catch((error) => {
      console.error('Erro ao processar webhook:', error);
    });
  } catch (error) {
    console.error('Erro ao processar webhook:', error);
    res.status(500).json({ error: 'Erro ao processar webhook' });
  }
});

/**
 * Processar eventos do webhook
 */
async function processWebhookEvent(event, paymentData) {
  try {
    if (!paymentData || !paymentData.id) {
      console.log('Webhook sem dados de pagamento válidos');
      return;
    }

    // Buscar transação pelo ID do pagamento Asaas
    // Tentar buscar primeiro como paymentId, depois como subscriptionId
    let transaction = await transactionPostgresService.findTransactionByAsaasId(paymentData.id, null);
    if (!transaction) {
      transaction = await transactionPostgresService.findTransactionByAsaasId(null, paymentData.id);
    }

    if (!transaction) {
      console.log('Transação não encontrada para o pagamento/assinatura:', paymentData.id);
      return;
    }

    // Buscar dados atualizados do pagamento/assinatura na Asaas
    let asaasPayment;
    try {
      if (transaction.asaasPaymentId && transaction.asaasPaymentId === paymentData.id) {
        asaasPayment = await getPayment(paymentData.id);
      } else if (transaction.asaasSubscriptionId && transaction.asaasSubscriptionId === paymentData.id) {
        asaasPayment = await getSubscription(paymentData.id);
      }
    } catch (error) {
      console.error('Erro ao buscar pagamento/assinatura na Asaas:', error);
    }

    // Mapear status da Asaas para nosso sistema
    const statusMap = {
      PENDING: 'pending',
      RECEIVED: 'completed',
      OVERDUE: 'pending',
      REFUNDED: 'refunded',
      RECEIVED_IN_CASH_UNDONE: 'pending',
      CHARGEBACK_REQUESTED: 'pending',
      CHARGEBACK_DISPUTE: 'pending',
      AWAITING_CHARGEBACK_REVERSAL: 'pending',
      DUNNING_REQUESTED: 'pending',
      DUNNING_RECEIVED: 'pending',
      AWAITING_RISK_ANALYSIS: 'pending',
    };

    const newStatus = statusMap[paymentData.status] || transaction.status;

    // Atualizar transação
    const updateData = {
      status: newStatus,
      transactionId: paymentData.id,
    };

    if (asaasPayment) {
      if (asaasPayment.paymentDate) {
        updateData.paymentDate = new Date(asaasPayment.paymentDate);
      }
      if (asaasPayment.dueDate) {
        updateData.dueDate = new Date(asaasPayment.dueDate);
      }
      if (asaasPayment.bankSlipUrl) {
        updateData.bankSlipUrl = asaasPayment.bankSlipUrl;
      }
    }

    await transactionPostgresService.updateTransaction(transaction.id, updateData);
    transaction.status = newStatus;
    if (updateData.paymentDate) transaction.paymentDate = updateData.paymentDate;
    if (updateData.dueDate) transaction.dueDate = updateData.dueDate;
    if (updateData.bankSlipUrl) transaction.bankSlipUrl = updateData.bankSlipUrl;

    // Quando o pagamento for confirmado, chamar API externa para atualizar plano e adicionar créditos
    if (event === 'PAYMENT_RECEIVED' || event === 'PAYMENT_CONFIRMED') {
      if (transaction.status === 'completed') {
        console.log(`Pagamento confirmado para transação ${transaction.id}. Atualizando plano e créditos na API externa.`);
        
        try {
          // Buscar dados do usuário e plano
          let userId = transaction.user?._id || transaction.user;
          let plan = transaction.plan;
          
          // Se o user é apenas um ID string, buscar o objeto User completo
          if (typeof userId === 'string') {
            const userObj = await User.findById(userId);
            if (userObj) {
              userId = userObj._id.toString();
            }
          } else if (userId && userId._id) {
            userId = userId._id.toString();
          }

          // Se o plano não veio populado, buscar pelo plan_id
          if (!plan && transaction.plan_id) {
            plan = await planPostgresService.findPlanById(transaction.plan_id);
          }

          if (!plan) {
            console.error(`Plano não encontrado para transação ${transaction.id}`);
            return;
          }

          if (!userId) {
            console.error(`User ID não encontrado para transação ${transaction.id}`);
            return;
          }

          // Buscar user_id da API externa (N8N) do PostgreSQL
          let externalUserId = null;
          let internalUserId = null;
          try {
            const userFromMongo = await User.findById(userId);
            if (userFromMongo && userFromMongo.email) {
              const userFromPostgres = await userPostgresService.findUserByEmail(userFromMongo.email);
              if (userFromPostgres) {
                externalUserId = userFromPostgres.user_id; // Atualizado para user_id
                internalUserId = userFromPostgres.id_user_platform; // ID interno da plataforma
              }
            }
          } catch (error) {
            console.error('Erro ao buscar user_id da API externa:', error);
          }

          if (!externalUserId) {
            console.warn(`user_id da API externa (N8N) não encontrado para usuário ${userId}. Tentando usar o ID interno do usuário.`);
            externalUserId = userId; // Fallback: usar ID interno do usuário
          }

          // Usar id_user_platform como identificador principal para a API externa
          const apiUserId = internalUserId || externalUserId;

          // 1. Buscar planoId da API externa baseado no valor pago
          const externalPlanId = await externalCreditsService.getExternalPlanIdByAmount(transaction.amount);
          
          if (!externalPlanId) {
            console.warn(`PlanoId não encontrado na API externa para valor ${transaction.amount}. Continuando sem atualizar plano.`);
          } else {
            // 2. Chamar API externa para atualizar plano do usuário
            await externalCreditsService.updateUserPlan(apiUserId, externalPlanId);
          }

          // 3. Adicionar créditos do plano ao usuário na API externa
          if (plan.credits && plan.credits > 0) {
            await externalCreditsService.addUserCredits(apiUserId, plan.credits);
          } else if (plan.isUnlimited) {
            // Se for plano ilimitado, pode ser necessário tratar diferente
            console.log(`Plano ${plan.name} é ilimitado. Verificar se precisa de tratamento especial na API externa.`);
          }

          console.log(`Processo de atualização de créditos concluído para transação ${transaction.id}`);
        } catch (error) {
          console.error('Erro ao processar atualização de créditos na API externa:', error);
          // Não lançar erro para não quebrar o processamento do webhook
        }
      }
    }

    // Se assinatura foi cancelada
    if (event === 'SUBSCRIPTION_DELETED' || event === 'SUBSCRIPTION_CANCELLED') {
      const userId = transaction.user?._id || transaction.user;
      if (userId) {
        const user = await User.findById(typeof userId === 'object' ? userId._id : userId);
        if (user) {
          user.activePlan = null;
          user.planStartDate = null;
          user.planEndDate = null;
          await user.save();
          console.log(`Plano cancelado para usuário ${user._id}`);
        }
      }
    }

    console.log(`Webhook processado: ${event} - Transação ${transaction.id} atualizada`);
  } catch (error) {
    console.error('Erro ao processar evento do webhook:', error);
    throw error;
  }
}

/**
 * Webhook do N8N para receber user_id após verificação do usuário
 * Este webhook é chamado quando o N8N processa a verificação do WhatsApp
 * e retorna o user_id do N8N junto com os dados do usuário
 */
router.post(
  '/n8n',
  [
    body('user_id')
      .notEmpty()
      .withMessage('user_id do N8N é obrigatório'),
    body('email')
      .optional()
      .isEmail()
      .withMessage('Email inválido')
      .normalizeEmail(),
    body('nome')
      .optional()
      .trim(),
    body('telefone')
      .optional()
      .trim()
      .matches(/^\d{10,15}$/)
      .withMessage('Telefone deve conter apenas números (10 a 15 dígitos)'),
    body('status')
      .optional()
      .isIn(['pending', 'verified', 'active', 'inactive'])
      .withMessage('Status inválido'),
  ],
  validate,
  async (req, res) => {
    try {
      const { user_id, email, nome, telefone, status = 'verified' } = req.body;

      console.log('Webhook N8N recebido:', {
        user_id,
        email,
        nome,
        telefone,
        status,
      });

      // Armazenar ou atualizar usuário no PostgreSQL
      const userData = {
        user_id,
        email,
        nome,
        telefone,
        status,
      };

      const user = await userPostgresService.createOrUpdateUser(userData);

      console.log('Usuário armazenado/atualizado no PostgreSQL:', {
        id: user.id,
        id_user_platform: user.id_user_platform,
        user_id: user.user_id,
        email: user.email,
        nome: user.nome,
        telefone: user.telefone,
        status: user.status,
      });

      res.json({
        success: true,
        message: 'Usuário armazenado com sucesso',
        data: {
          id: user.id,
          id_user_platform: user.id_user_platform,
          user_id: user.user_id,
          email: user.email,
          nome: user.nome,
          telefone: user.telefone,
          status: user.status,
          created_at: user.created_at,
          updated_at: user.updated_at,
        },
      });
    } catch (error) {
      console.error('Erro ao processar webhook N8N:', error);
      res.status(500).json({
        success: false,
        message: 'Erro ao processar webhook do N8N',
        error: error.message,
      });
    }
  }
);

module.exports = router;

