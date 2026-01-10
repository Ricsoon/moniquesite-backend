const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const transactionPostgresService = require('../services/transactionPostgresService');
const planPostgresService = require('../services/planPostgresService');
const User = require('../models/User');
const { authenticate, isAdmin } = require('../middleware/auth');
const validate = require('../middleware/validation');
const calculatePlanDates = require('../utils/calculatePlanDates');
const asaasService = require('../services/asaasService');

// @route   GET /api/transactions
// @desc    Listar transações
// @access  Private
router.get('/', authenticate, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;

    const filters = {};

    // Usuário comum só vê suas próprias transações
    if (req.user.role !== 'admin') {
      filters.userId = req.user._id.toString();
    } else if (req.query.userId) {
      filters.userId = req.query.userId;
    }

    if (req.query.status) {
      filters.status = req.query.status;
    }

    filters.page = page;
    filters.limit = limit;

    const result = await transactionPostgresService.listTransactions(filters);

    // Popular dados do usuário e plano para cada transação
    for (let transaction of result.transactions) {
      if (transaction.user && typeof transaction.user === 'string') {
        const user = await User.findById(transaction.user).select('name email');
        transaction.user = user || { _id: transaction.user, name: null, email: null };
      }
      // O plano já vem populado do serviço
    }

    res.json({
      success: true,
      data: {
        transactions: result.transactions,
        pagination: result.pagination,
      },
    });
  } catch (error) {
    console.error('Erro ao listar transações:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao listar transações',
      error: error.message,
    });
  }
});

// @route   GET /api/transactions/:id
// @desc    Obter transação por ID
// @access  Private
router.get('/:id', authenticate, async (req, res) => {
  try {
    const transactionId = parseInt(req.params.id);
    if (isNaN(transactionId)) {
      return res.status(400).json({
        success: false,
        message: 'ID da transação inválido',
      });
    }

    const transaction = await transactionPostgresService.findTransactionById(transactionId);

    if (!transaction) {
      return res.status(404).json({
        success: false,
        message: 'Transação não encontrada',
      });
    }

    // Popular dados do usuário se necessário
    if (transaction.user && typeof transaction.user === 'string') {
      const user = await User.findById(transaction.user).select('name email');
      transaction.user = user || { _id: transaction.user, name: null, email: null };
    }

    // Usuário comum só pode ver suas próprias transações
    const userId = transaction.user?._id?.toString() || transaction.user?.toString();
    if (req.user.role !== 'admin' && userId !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Acesso negado',
      });
    }

    res.json({
      success: true,
      data: { transaction },
    });
  } catch (error) {
    console.error('Erro ao buscar transação:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao buscar transação',
      error: error.message,
    });
  }
});

// @route   POST /api/transactions
// @desc    Criar nova transação (comprar plano) - Integrado com Asaas
// @access  Private
router.post(
  '/',
  authenticate,
  [
    body('planId')
      .notEmpty()
      .withMessage('ID do plano é obrigatório')
      .isInt({ min: 1 })
      .withMessage('ID do plano inválido'),
    body('billingType')
      .notEmpty()
      .withMessage('Tipo de cobrança é obrigatório')
      .isIn(['CREDIT_CARD', 'DEBIT_CARD', 'PIX', 'BOLETO', 'UNDEFINED'])
      .withMessage('Tipo de cobrança inválido'),
    body('creditCard')
      .optional()
      .isObject()
      .withMessage('Dados do cartão devem ser um objeto'),
    body('creditCardToken')
      .optional()
      .isString()
      .withMessage('Token do cartão deve ser uma string'),
  ],
  validate,
  async (req, res) => {
    try {
      const { planId, billingType, creditCard, creditCardToken, creditCardHolderInfo, notes } = req.body;

      // Buscar usuário completo
      const user = await User.findById(req.user._id);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'Usuário não encontrado',
        });
      }

      // Verificar se plano existe
      const planIdInt = parseInt(planId);
      if (isNaN(planIdInt)) {
        return res.status(400).json({
          success: false,
          message: 'ID do plano inválido',
        });
      }

      const plan = await planPostgresService.findPlanById(planIdInt);
      if (!plan || !plan.isActive) {
        return res.status(404).json({
          success: false,
          message: 'Plano não encontrado ou inativo',
        });
      }

      // Criar ou atualizar cliente no Asaas
      let asaasCustomer;
      try {
        asaasCustomer = await asaasService.createOrUpdateCustomer({
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

        // Salvar ID do cliente Asaas no usuário
        if (asaasCustomer.id && !user.asaasCustomerId) {
          user.asaasCustomerId = asaasCustomer.id;
          await user.save();
        }
      } catch (error) {
        console.error('Erro ao criar cliente no Asaas:', error);
        return res.status(500).json({
          success: false,
          message: 'Erro ao criar cliente no sistema de pagamento',
          error: error.message,
        });
      }

      // Determinar se é assinatura recorrente ou pagamento único
      const isRecurring = plan.durationUnit === 'months' || plan.durationUnit === 'years';
      const cycleMap = {
        months: 'MONTHLY',
        years: 'YEARLY',
      };
      const cycle = cycleMap[plan.durationUnit] || 'MONTHLY';

      let asaasPayment;
      let asaasSubscription = null;

      try {
        if (isRecurring && billingType !== 'PIX' && billingType !== 'BOLETO') {
          // Criar assinatura recorrente
          asaasSubscription = await asaasService.createSubscription({
            customerId: asaasCustomer.id,
            billingType: billingType,
            value: plan.price,
            cycle: cycle,
            description: `Assinatura - ${plan.name}`,
            externalReference: `plan_${plan.id}_user_${user._id}`,
            creditCard: creditCard,
            creditCardToken: creditCardToken,
            creditCardHolderInfo: creditCardHolderInfo,
          });
        } else {
          // Criar pagamento único
          const dueDate = new Date();
          dueDate.setDate(dueDate.getDate() + 3); // Vencimento em 3 dias

          asaasPayment = await asaasService.createPayment({
            customerId: asaasCustomer.id,
            billingType: billingType,
            value: plan.price,
            dueDate: dueDate.toISOString().split('T')[0],
            description: `Pagamento - ${plan.name}`,
            externalReference: `plan_${plan.id}_user_${user._id}`,
            creditCard: creditCard,
            creditCardToken: creditCardToken,
            creditCardHolderInfo: creditCardHolderInfo,
          });

          // Se for PIX, obter QR Code
          if (billingType === 'PIX' && asaasPayment.id) {
            try {
              const pixData = await asaasService.getPixQrCode(asaasPayment.id);
              asaasPayment.pixQrCode = pixData.payload;
              asaasPayment.pixQrCodeExpiration = pixData.expirationDate
                ? new Date(pixData.expirationDate)
                : null;
            } catch (error) {
              console.error('Erro ao obter QR Code PIX:', error);
            }
          }
        }
      } catch (error) {
        console.error('Erro ao criar pagamento/assinatura no Asaas:', error);
        return res.status(500).json({
          success: false,
          message: 'Erro ao processar pagamento',
          error: error.message,
        });
      }

      // Criar transação no banco
      const transaction = await transactionPostgresService.createTransaction({
        user: user._id,
        plan: plan,
        amount: plan.price,
        paymentMethod: billingType === 'CREDIT_CARD' ? 'credit_card' :
                       billingType === 'DEBIT_CARD' ? 'debit_card' :
                       billingType === 'PIX' ? 'pix' :
                       billingType === 'BOLETO' ? 'bank_transfer' : 'other',
        status: 'pending',
        asaasCustomerId: asaasCustomer.id,
        asaasPaymentId: asaasPayment?.id || null,
        asaasSubscriptionId: asaasSubscription?.id || null,
        transactionId: asaasPayment?.id || asaasSubscription?.id || null,
        dueDate: asaasPayment?.dueDate ? new Date(asaasPayment.dueDate) : null,
        pixQrCode: asaasPayment?.pixQrCode || null,
        pixQrCodeExpiration: asaasPayment?.pixQrCodeExpiration || null,
        bankSlipUrl: asaasPayment?.bankSlipUrl || null,
        notes,
      });

      res.status(201).json({
        success: true,
        message: 'Transação criada com sucesso',
        data: {
          transaction,
          payment: {
            id: asaasPayment?.id || asaasSubscription?.id,
            status: asaasPayment?.status || asaasSubscription?.status,
            pixQrCode: asaasPayment?.pixQrCode,
            pixQrCodeExpiration: asaasPayment?.pixQrCodeExpiration,
            bankSlipUrl: asaasPayment?.bankSlipUrl,
            invoiceUrl: asaasPayment?.invoiceUrl || asaasSubscription?.invoiceUrl,
            isSubscription: !!asaasSubscription,
          },
        },
      });
    } catch (error) {
      console.error('Erro ao criar transação:', error);
      res.status(500).json({
        success: false,
        message: 'Erro ao criar transação',
        error: error.message,
      });
    }
  }
);

// @route   GET /api/transactions/:id/payment-status
// @desc    Verificar status do pagamento na Asaas
// @access  Private
router.get('/:id/payment-status', authenticate, async (req, res) => {
  try {
    const transactionId = parseInt(req.params.id);
    if (isNaN(transactionId)) {
      return res.status(400).json({
        success: false,
        message: 'ID da transação inválido',
      });
    }

    const transaction = await transactionPostgresService.findTransactionById(transactionId);

    if (!transaction) {
      return res.status(404).json({
        success: false,
        message: 'Transação não encontrada',
      });
    }

    // Usuário comum só pode ver suas próprias transações
    const userId = transaction.user?._id?.toString() || transaction.user?.toString();
    if (req.user.role !== 'admin' && userId !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Acesso negado',
      });
    }

    // Buscar status atualizado na Asaas
    let asaasPayment = null;
    let asaasSubscription = null;

    try {
      if (transaction.asaasPaymentId) {
        asaasPayment = await asaasService.getPayment(transaction.asaasPaymentId);
      }
      if (transaction.asaasSubscriptionId) {
        asaasSubscription = await asaasService.getSubscription(transaction.asaasSubscriptionId);
      }
    } catch (error) {
      console.error('Erro ao buscar status na Asaas:', error);
    }

    // Atualizar transação se necessário
    if (asaasPayment || asaasSubscription) {
      const paymentData = asaasPayment || asaasSubscription;
      const statusMap = {
        PENDING: 'pending',
        RECEIVED: 'completed',
        OVERDUE: 'pending',
        REFUNDED: 'refunded',
      };

      const newStatus = statusMap[paymentData.status] || transaction.status;
      if (newStatus !== transaction.status) {
        await transactionPostgresService.updateTransaction(transactionId, {
          status: newStatus,
          paymentDate: paymentData.paymentDate ? new Date(paymentData.paymentDate) : undefined,
        });
        transaction.status = newStatus;
        if (paymentData.paymentDate) {
          transaction.paymentDate = new Date(paymentData.paymentDate);
        }
      }
    }

    res.json({
      success: true,
      data: {
        transaction,
        asaasPayment: asaasPayment || null,
        asaasSubscription: asaasSubscription || null,
      },
    });
  } catch (error) {
    console.error('Erro ao verificar status do pagamento:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao verificar status do pagamento',
      error: error.message,
    });
  }
});

// @route   GET /api/transactions/:id/pix-qrcode
// @desc    Obter QR Code PIX atualizado
// @access  Private
router.get('/:id/pix-qrcode', authenticate, async (req, res) => {
  try {
    const transactionId = parseInt(req.params.id);
    if (isNaN(transactionId)) {
      return res.status(400).json({
        success: false,
        message: 'ID da transação inválido',
      });
    }

    const transaction = await transactionPostgresService.findTransactionById(transactionId);

    if (!transaction) {
      return res.status(404).json({
        success: false,
        message: 'Transação não encontrada',
      });
    }

    if (!transaction.asaasPaymentId) {
      return res.status(400).json({
        success: false,
        message: 'Transação não possui pagamento PIX',
      });
    }

    // Usuário comum só pode ver suas próprias transações
    const userId = transaction.user?._id?.toString() || transaction.user?.toString();
    if (req.user.role !== 'admin' && userId !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Acesso negado',
      });
    }

    try {
      const pixData = await asaasService.getPixQrCode(transaction.asaasPaymentId);

      // Atualizar QR Code na transação
      await transactionPostgresService.updateTransaction(transactionId, {
        pixQrCode: pixData.payload,
        pixQrCodeExpiration: pixData.expirationDate ? new Date(pixData.expirationDate) : null,
      });

      res.json({
        success: true,
        data: {
          pixQrCode: pixData.payload,
          expirationDate: pixData.expirationDate,
        },
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Erro ao obter QR Code PIX',
        error: error.message,
      });
    }
  } catch (error) {
    console.error('Erro ao obter QR Code PIX:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao obter QR Code PIX',
      error: error.message,
    });
  }
});

// @route   PUT /api/transactions/:id
// @desc    Atualizar transação (apenas admin)
// @access  Private/Admin
router.put(
  '/:id',
  authenticate,
  isAdmin,
  [
    body('status')
      .optional()
      .isIn(['pending', 'completed', 'failed', 'cancelled', 'refunded'])
      .withMessage('Status inválido'),
    body('paymentMethod')
      .optional()
      .isIn(['credit_card', 'debit_card', 'pix', 'bank_transfer', 'other'])
      .withMessage('Método de pagamento inválido'),
  ],
  validate,
  async (req, res) => {
    try {
      const transactionId = parseInt(req.params.id);
      if (isNaN(transactionId)) {
        return res.status(400).json({
          success: false,
          message: 'ID da transação inválido',
        });
      }

      const transaction = await transactionPostgresService.findTransactionById(transactionId);

      if (!transaction) {
        return res.status(404).json({
          success: false,
          message: 'Transação não encontrada',
        });
      }

      // Preparar dados para atualização (excluindo campos que não devem ser alterados)
      const updateData = {};
      if (req.body.status !== undefined) updateData.status = req.body.status;
      if (req.body.paymentMethod !== undefined) updateData.paymentMethod = req.body.paymentMethod;
      if (req.body.notes !== undefined) updateData.notes = req.body.notes;
      if (req.body.bankSlipUrl !== undefined) updateData.bankSlipUrl = req.body.bankSlipUrl;

      const updatedTransaction = await transactionPostgresService.updateTransaction(transactionId, updateData);

      // Popular dados do usuário e plano para resposta
      if (updatedTransaction.user && typeof updatedTransaction.user === 'string') {
        const user = await User.findById(updatedTransaction.user).select('name email');
        updatedTransaction.user = user || { _id: updatedTransaction.user, name: null, email: null };
      }

      res.json({
        success: true,
        message: 'Transação atualizada com sucesso',
        data: { transaction: updatedTransaction },
      });
    } catch (error) {
      console.error('Erro ao atualizar transação:', error);
      res.status(500).json({
        success: false,
        message: 'Erro ao atualizar transação',
        error: error.message,
      });
    }
  }
);

module.exports = router;

