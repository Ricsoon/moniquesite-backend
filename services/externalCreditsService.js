const axios = require('axios');
const config = require('../config/config');

/**
 * Buscar planos da API externa
 * @returns {Promise<Array>} Lista de planos disponíveis
 */
const getExternalPlans = async () => {
  try {
    if (!config.externalCreditsApiUrl) {
      console.warn('URL da API externa de créditos não configurada');
      return [];
    }

    const response = await axios.get(`${config.externalCreditsApiUrl}/planos`, {
      headers: {
        'Content-Type': 'application/json',
        ...(config.externalCreditsApiToken && { 'Authorization': `Bearer ${config.externalCreditsApiToken}` }),
      },
      timeout: 10000, // 10 segundos de timeout
    });

    return response.data || [];
  } catch (error) {
    console.error('Erro ao buscar planos da API externa:', {
      message: error.message,
      response: error.response?.data,
      status: error.response?.status,
    });
    throw error;
  }
};

/**
 * Buscar planoId da API externa pelo valor pago
 * @param {number} amount - Valor pago
 * @returns {Promise<string|null>} ID do plano na API externa ou null
 * 
 * NOTA: Esta função busca planos do endpoint /planos da API externa e tenta encontrar
 * o plano que corresponde ao valor pago. Se a estrutura de resposta da API externa for
 * diferente, ajuste os campos (price, valor, value, id, planoId, _id) conforme necessário.
 */
const getExternalPlanIdByAmount = async (amount) => {
  try {
    const plans = await getExternalPlans();
    
    // Verificar se plans é um array ou se está dentro de um objeto (ex: { data: [...] })
    const plansArray = Array.isArray(plans) ? plans : (plans.data || plans.plans || []);
    
    // Procurar plano que corresponde ao valor pago
    // Normalmente, os planos têm um campo de preço/valor
    // Ajustar a lógica conforme a estrutura da resposta da API externa
    const matchingPlan = plansArray.find((plan) => {
      const planValue = parseFloat(plan.price || plan.valor || plan.value || plan.preco || 0);
      // Comparar valores com margem de erro pequena (ex: 0.01) para evitar problemas de precisão de ponto flutuante
      return Math.abs(planValue - amount) < 0.01;
    });

    if (matchingPlan) {
      // Tentar diferentes campos possíveis para o ID do plano
      return matchingPlan.id || matchingPlan.planoId || matchingPlan.plan_id || matchingPlan._id || matchingPlan.planId;
    }

    console.warn(`Plano não encontrado na API externa para o valor: ${amount}`);
    console.warn('Planos disponíveis:', plansArray.map(p => ({
      id: p.id || p.planoId || p.plan_id || p._id,
      price: p.price || p.valor || p.value || p.preco,
      name: p.name || p.nome || p.title,
    })));
    return null;
  } catch (error) {
    console.error('Erro ao buscar planoId da API externa:', error);
    throw error;
  }
};

/**
 * Atualizar plano do usuário na API externa
 * @param {string} userId - ID do usuário
 * @param {string} planoId - ID do plano na API externa
 * @returns {Promise<Object>} Resposta da API externa
 */
const updateUserPlan = async (userId, planoId) => {
  try {
    if (!config.externalCreditsApiUrl) {
      console.warn('URL da API externa de créditos não configurada. Pulando atualização de plano.');
      return { success: false, message: 'URL da API externa não configurada' };
    }

    const response = await axios.put(
      `${config.externalCreditsApiUrl}/credito_usuarios/update-plano`,
      {
        user_id: userId,
        planoId: planoId,
      },
      {
        headers: {
          'Content-Type': 'application/json',
          ...(config.externalCreditsApiToken && { 'Authorization': `Bearer ${config.externalCreditsApiToken}` }),
        },
        timeout: 10000, // 10 segundos de timeout
      }
    );

    console.log('Plano atualizado na API externa:', {
      userId,
      planoId,
      status: response.status,
    });

    return {
      success: true,
      data: response.data,
    };
  } catch (error) {
    console.error('Erro ao atualizar plano na API externa:', {
      message: error.message,
      userId,
      planoId,
      response: error.response?.data,
      status: error.response?.status,
    });
    
    // Não lançar erro para não quebrar o fluxo principal
    return {
      success: false,
      error: error.message,
      response: error.response?.data,
    };
  }
};

/**
 * Adicionar créditos ao usuário na API externa
 * @param {string} userId - ID do usuário
 * @param {number} credits - Quantidade de créditos a adicionar
 * @returns {Promise<Object>} Resposta da API externa
 */
const addUserCredits = async (userId, credits) => {
  try {
    if (!config.externalCreditsApiUrl) {
      console.warn('URL da API externa de créditos não configurada. Pulando adição de créditos.');
      return { success: false, message: 'URL da API externa não configurada' };
    }

    const response = await axios.put(
      `${config.externalCreditsApiUrl}/credito_usuarios/${userId}`,
      {
        creditos: credits,
      },
      {
        headers: {
          'Content-Type': 'application/json',
          ...(config.externalCreditsApiToken && { 'Authorization': `Bearer ${config.externalCreditsApiToken}` }),
        },
        timeout: 10000, // 10 segundos de timeout
      }
    );

    console.log('Créditos adicionados na API externa:', {
      userId,
      credits,
      status: response.status,
    });

    return {
      success: true,
      data: response.data,
    };
  } catch (error) {
    console.error('Erro ao adicionar créditos na API externa:', {
      message: error.message,
      userId,
      credits,
      response: error.response?.data,
      status: error.response?.status,
    });
    
    // Não lançar erro para não quebrar o fluxo principal
    return {
      success: false,
      error: error.message,
      response: error.response?.data,
    };
  }
};

module.exports = {
  getExternalPlans,
  getExternalPlanIdByAmount,
  updateUserPlan,
  addUserCredits,
};

