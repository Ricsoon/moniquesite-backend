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
    // Se já tem asaasCustomerId, tenta atualizar
    if (userData.asaasCustomerId) {
      try {
        const response = await asaasClient.put(
          `/customers/${userData.asaasCustomerId}`,
          {
            name: userData.name,
            email: userData.email,
            phone: userData.phone || '',
            cpfCnpj: userData.cpfCnpj || '',
            postalCode: userData.postalCode || '',
            address: userData.address || '',
            addressNumber: userData.addressNumber || '',
            complement: userData.complement || '',
            province: userData.province || '',
            city: userData.city || '',
            state: userData.state || '',
          }
        );
        return response.data;
      } catch (error) {
        // Se não encontrou, cria novo
        if (error.response?.status === 404) {
          console.log('Cliente não encontrado no Asaas, criando novo...');
        } else {
          throw error;
        }
      }
    }

    // Criar novo cliente
    const response = await asaasClient.post('/customers', {
      name: userData.name,
      email: userData.email,
      phone: userData.phone || '',
      cpfCnpj: userData.cpfCnpj || '',
      postalCode: userData.postalCode || '',
      address: userData.address || '',
      addressNumber: userData.addressNumber || '',
      complement: userData.complement || '',
      province: userData.province || '',
      city: userData.city || '',
      state: userData.state || '',
    });

    return response.data;
  } catch (error) {
    console.error('Erro ao criar/atualizar cliente no Asaas:', error.response?.data || error.message);
    throw new Error(error.response?.data?.errors?.[0]?.description || 'Erro ao criar cliente no Asaas');
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

