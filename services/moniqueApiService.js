const axios = require('axios');

const MONIQUE_API_URL = process.env.MONIQUE_API_URL || 'https://doc.moniquebot.com.br/api';
const MONIQUE_API_TOKEN = process.env.MONIQUE_API_TOKEN;

/**
 * Buscar informações do plano do usuário na API Monique
 * @param {string} userId - ID do usuário no N8N (n8n_user_id)
 * @returns {Promise<Object|null>} Dados do plano ou null se não encontrado
 */
const getUserPlan = async (userId) => {
    try {
        const url = `${MONIQUE_API_URL}/credito_usuarios/user/${userId}/plano`;
        console.log(`[MONIQUE-API] Buscando plano do usuário ${userId}: ${url}`);

        const response = await axios.get(url, {
            timeout: 10000,
            headers: {
                'Authorization': `Bearer ${MONIQUE_API_TOKEN}`,
            },
        });

        console.log('[MONIQUE-API] Resposta do plano:', JSON.stringify(response.data, null, 2));
        return response.data;
    } catch (error) {
        console.error('[MONIQUE-API] Erro ao buscar plano:', {
            status: error.response?.status,
            message: error.message,
            data: error.response?.data,
        });
        return null;
    }
};

module.exports = {
    getUserPlan,
};
