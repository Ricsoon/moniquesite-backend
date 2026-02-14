const axios = require('axios');
const config = require('../config/config');

// Cliente HTTP para API Asaas
const asaasClient = axios.create({
  baseURL: config.asaasBaseUrl,
  headers: {
    'Content-Type': 'application/json',
    'access_token': config.asaasApiKey,
  },
  timeout: 30000, // 30 segundos
});

/**
 * Criar ou atualizar cliente no Asaas
 */
const createOrUpdateCustomer = async (userData) => {
  try {
    // Validar dados obrigatórios
    if (!userData.name || userData.name.trim() === '') {
      throw new Error('Nome do cliente é obrigatório');
    }
    if (!userData.email || userData.email.trim() === '') {
      throw new Error('Email do cliente é obrigatório');
    }

    // Preparar dados para envio
    const customerData = {
      name: userData.name.trim(),
      email: userData.email.trim(),
    };

    // Adicionar dados opcionais se preenchidos
    if (userData.phone && userData.phone.trim() !== '') {
      customerData.phone = userData.phone.trim();
    }
    if (userData.cpfCnpj && userData.cpfCnpj.trim() !== '') {
      customerData.cpfCnpj = userData.cpfCnpj.trim();
    }
    if (userData.postalCode && userData.postalCode.trim() !== '') {
      customerData.postalCode = userData.postalCode.trim();
    }
    if (userData.address && userData.address.trim() !== '') {
      customerData.address = userData.address.trim();
    }
    if (userData.addressNumber && userData.addressNumber.trim() !== '') {
      customerData.addressNumber = userData.addressNumber.trim();
    }
    if (userData.complement && userData.complement.trim() !== '') {
      customerData.complement = userData.complement.trim();
    }
    if (userData.province && userData.province.trim() !== '') {
      customerData.province = userData.province.trim();
    }
    if (userData.city && userData.city.trim() !== '') {
      customerData.city = userData.city.trim();
    }
    if (userData.state && userData.state.trim() !== '') {
      customerData.state = userData.state.trim();
    }

    console.log('📧 Dados do cliente para ASAAS:', { name: customerData.name, email: customerData.email, hasPhone: !!customerData.phone });

    // Se já tem asaasCustomerId, tenta atualizar (mas continua se falhar com 404 ou 405)
    if (userData.asaasCustomerId) {
      try {
        console.log(`🔄 Atualizando cliente existente no ASAAS: ${userData.asaasCustomerId}`);
        const response = await asaasClient.put(
          `/customers/${userData.asaasCustomerId}`,
          customerData
        );
        console.log('✅ Cliente atualizado com sucesso no ASAAS');
        return response.data;
      } catch (error) {
        // Se não encontrou (404) ou método não permitido (405), cria novo
        if (error.response?.status === 404 || error.response?.status === 405) {
          console.log(`⚠️ Cliente não pode ser atualizado (status: ${error.response?.status}), criando novo...`);
        } else {
          console.error('❌ Erro ao atualizar cliente:', error.response?.data || error.message);
          throw error;
        }
      }
    }

    // Criar novo cliente
    console.log('➕ Criando novo cliente no ASAAS');
    const response = await asaasClient.post('/customers', customerData);
    console.log('✅ Cliente criado com sucesso no ASAAS:', response.data.id);

    return response.data;
  } catch (error) {
    console.error('❌ Erro ao criar/atualizar cliente no Asaas:', {
      status: error.response?.status,
      data: error.response?.data,
      message: error.message
    });
    
    // Extrair mensagem de erro do ASAAS
    const asaasError = error.response?.data?.errors?.[0]?.description || 
                       error.response?.data?.message ||
                       error.message;
    
    throw new Error(`Erro ao criar cliente no sistema de pagamento: ${asaasError}`);
  }
};

/**
 * Criar cobrança única (pagamento único)
 */
const createPayment = async (paymentData) => {
  try {
    const response = await asaasClient.post('/payments', {
      customer: paymentData.customerId,
      billingType: paymentData.billingType, // CREDIT_CARD, DEBIT_CARD, PIX, BOLETO, etc
      value: paymentData.value,
      dueDate: paymentData.dueDate || new Date().toISOString().split('T')[0],
      description: paymentData.description || '',
      externalReference: paymentData.externalReference || '',
      installmentCount: paymentData.installmentCount || 1,
      installmentValue: paymentData.installmentValue || paymentData.value,
      creditCard: paymentData.creditCard || undefined,
      creditCardHolderInfo: paymentData.creditCardHolderInfo || undefined,
      creditCardToken: paymentData.creditCardToken || undefined,
    });

    return response.data;
  } catch (error) {
    console.error('Erro ao criar cobrança no Asaas:', error.response?.data || error.message);
    throw new Error(error.response?.data?.errors?.[0]?.description || 'Erro ao criar cobrança no Asaas');
  }
};

/**
 * Criar assinatura (plano recorrente)
 */
const createSubscription = async (subscriptionData) => {
  try {
    const response = await asaasClient.post('/subscriptions', {
      customer: subscriptionData.customerId,
      billingType: subscriptionData.billingType, // CREDIT_CARD, DEBIT_CARD, PIX, BOLETO, etc
      value: subscriptionData.value,
      nextDueDate: subscriptionData.nextDueDate || new Date().toISOString().split('T')[0],
      cycle: subscriptionData.cycle || 'MONTHLY', // WEEKLY, BIWEEKLY, MONTHLY, QUARTERLY, SEMIANNUALLY, YEARLY
      description: subscriptionData.description || '',
      externalReference: subscriptionData.externalReference || '',
      creditCard: subscriptionData.creditCard || undefined,
      creditCardHolderInfo: subscriptionData.creditCardHolderInfo || undefined,
      creditCardToken: subscriptionData.creditCardToken || undefined,
    });

    return response.data;
  } catch (error) {
    console.error('Erro ao criar assinatura no Asaas:', error.response?.data || error.message);
    throw new Error(error.response?.data?.errors?.[0]?.description || 'Erro ao criar assinatura no Asaas');
  }
};

/**
 * Obter cobrança por ID
 */
const getPayment = async (paymentId) => {
  try {
    const response = await asaasClient.get(`/payments/${paymentId}`);
    return response.data;
  } catch (error) {
    console.error('Erro ao buscar cobrança no Asaas:', error.response?.data || error.message);
    throw new Error(error.response?.data?.errors?.[0]?.description || 'Erro ao buscar cobrança no Asaas');
  }
};

/**
 * Obter assinatura por ID
 */
const getSubscription = async (subscriptionId) => {
  try {
    const response = await asaasClient.get(`/subscriptions/${subscriptionId}`);
    return response.data;
  } catch (error) {
    console.error('Erro ao buscar assinatura no Asaas:', error.response?.data || error.message);
    throw new Error(error.response?.data?.errors?.[0]?.description || 'Erro ao buscar assinatura no Asaas');
  }
};

/**
 * Cancelar assinatura
 */
const cancelSubscription = async (subscriptionId) => {
  try {
    const response = await asaasClient.delete(`/subscriptions/${subscriptionId}`);
    return response.data;
  } catch (error) {
    console.error('Erro ao cancelar assinatura no Asaas:', error.response?.data || error.message);
    throw new Error(error.response?.data?.errors?.[0]?.description || 'Erro ao cancelar assinatura no Asaas');
  }
};

/**
 * Obter link de pagamento PIX
 */
const getPixQrCode = async (paymentId) => {
  try {
    const response = await asaasClient.get(`/payments/${paymentId}/pixQrCode`);
    return response.data;
  } catch (error) {
    console.error('Erro ao obter QR Code PIX:', error.response?.data || error.message);
    throw new Error(error.response?.data?.errors?.[0]?.description || 'Erro ao obter QR Code PIX');
  }
};

/**
 * Obter link de pagamento Boleto
 */
const getBoletoUrl = async (paymentId) => {
  try {
    const payment = await getPayment(paymentId);
    return payment.bankSlipUrl || null;
  } catch (error) {
    console.error('Erro ao obter URL do boleto:', error.response?.data || error.message);
    throw error;
  }
};

module.exports = {
  createOrUpdateCustomer,
  createPayment,
  createSubscription,
  getPayment,
  getSubscription,
  cancelSubscription,
  getPixQrCode,
  getBoletoUrl,
};

