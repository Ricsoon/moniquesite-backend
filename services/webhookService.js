const axios = require('axios');
const config = require('../config/config');

/**
 * Enviar payload para webhook externo
 * @param {Object} payload - Dados a serem enviados
 * @returns {Promise<Object>} Resposta do webhook
 */
/**
 * Enviar payload para webhook externo
 * @param {Object} payload - Dados a serem enviados
 * @param {Object} [options] - Override de URL e header
 * @param {string} [options.url] - URL do webhook (sobrescreve config.webhookUrl)
 * @param {string} [options.authHeader] - Valor da header Authorization (sem Bearer)
 * @returns {Promise<Object>} Resposta do webhook
 */
async function sendWebhook(payload, options = {}) {
  try {
    const url = options.url || config.webhookUrl;
    if (!url) {
      console.warn('Webhook URL não configurada. Pulando envio do webhook.');
      return { success: false, message: 'Webhook URL não configurada' };
    }

    const authHeaderValue = options.authHeader ?? config.webhookToken;

    const headers = {
      'Content-Type': 'application/json',
    };

    if (authHeaderValue) {
      // Enviar exatamente o valor configurado no header Authorization
      headers['Authorization'] = authHeaderValue;
    }

    const response = await axios.post(url, payload, {
      headers,
      timeout: 10000, // 10 segundos de timeout
    });

    console.log('Webhook enviado com sucesso:', {
      status: response.status,
      userId: payload.user_id,
    });

    return {
      success: true,
      status: response.status,
      data: response.data,
    };
  } catch (error) {
    console.error('Erro ao enviar webhook:', {
      message: error.message,
      userId: payload.user_id,
      response: error.response?.data,
    });

    // Não lançar erro para não quebrar o fluxo principal
    return {
      success: false,
      error: error.message,
      response: error.response?.data,
    };
  }
}

module.exports = {
  sendWebhook,
};

