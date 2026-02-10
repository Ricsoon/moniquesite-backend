const { pool } = require('../config/postgres');
const planPostgresService = require('./planPostgresService');

/**
 * Criar transação no PostgreSQL
 * @param {Object} transactionData - Dados da transação
 * @returns {Promise<Object>} Transação criada
 */
const createTransaction = async (transactionData) => {
  try {
    const {
      user,
      plan,
      amount,
      status = 'pending',
      paymentMethod = 'other',
      transactionId = null,
      asaasPaymentId = null,
      asaasSubscriptionId = null,
      asaasCustomerId = null,
      paymentDate = null,
      dueDate = null,
      pixQrCode = null,
      pixQrCodeExpiration = null,
      bankSlipUrl = null,
      notes = null,
    } = transactionData;

    // Converter plan_id para o formato Postgres (INTEGER)
    let planId = null;
    if (plan) {
      if (typeof plan === 'object' && (plan._id || plan.id)) {
        // Se for um objeto Plan, usar o ID numérico do Postgres
        planId = plan.id || parseInt(plan._id) || null;
      } else if (typeof plan === 'number' || /^\d+$/.test(plan)) {
        planId = parseInt(plan);
      } else {
        // Tentar buscar pelo ID se for string numérica
        const planInPostgres = await planPostgresService.findPlanById(parseInt(plan));
        planId = planInPostgres ? planInPostgres.id : null;
      }
    }

    // Converter user_id (User ainda está no MongoDB, então mantemos como string)
    const userId = typeof user === 'object' && user.id ? user.id.toString() : user.toString();

    const result = await pool.query(
      `INSERT INTO transactions (
        user_id, plan_id, amount, status, payment_method, transaction_id,
        asaas_payment_id, asaas_subscription_id, asaas_customer_id,
        payment_date, due_date, pix_qr_code, pix_qr_code_expiration,
        bank_slip_url, notes
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
      RETURNING *`,
      [
        userId,
        planId,
        amount,
        status,
        paymentMethod,
        transactionId,
        asaasPaymentId,
        asaasSubscriptionId,
        asaasCustomerId,
        paymentDate,
        dueDate,
        pixQrCode,
        pixQrCodeExpiration,
        bankSlipUrl,
        notes,
      ]
    );

    return await mapTransactionFromDB(result.rows[0]);
  } catch (error) {
    console.error('Erro ao criar transação no PostgreSQL:', error);
    throw error;
  }
};

/**
 * Buscar transação por ID
 * @param {number} id - ID da transação
 * @returns {Promise<Object|null>} Transação encontrada ou null
 */
const findTransactionById = async (id) => {
  try {
    const result = await pool.query('SELECT * FROM transactions WHERE id = $1', [id]);
    if (result.rows.length === 0) {
      return null;
    }
    return await mapTransactionFromDB(result.rows[0]);
  } catch (error) {
    console.error('Erro ao buscar transação por ID:', error);
    throw error;
  }
};

/**
 * Buscar transação por ID da Asaas
 * @param {string} asaasPaymentId - ID do pagamento na Asaas
 * @param {string} asaasSubscriptionId - ID da assinatura na Asaas (opcional)
 * @returns {Promise<Object|null>} Transação encontrada ou null
 */
const findTransactionByAsaasId = async (asaasPaymentId, asaasSubscriptionId = null) => {
  try {
    let query = '';
    const params = [];
    let paramCount = 1;

    if (asaasPaymentId && asaasSubscriptionId) {
      query = 'SELECT * FROM transactions WHERE asaas_payment_id = $1 OR asaas_subscription_id = $2 LIMIT 1';
      params.push(asaasPaymentId, asaasSubscriptionId);
    } else if (asaasPaymentId) {
      query = 'SELECT * FROM transactions WHERE asaas_payment_id = $1 LIMIT 1';
      params.push(asaasPaymentId);
    } else if (asaasSubscriptionId) {
      query = 'SELECT * FROM transactions WHERE asaas_subscription_id = $1 LIMIT 1';
      params.push(asaasSubscriptionId);
    } else {
      return null;
    }

    const result = await pool.query(query, params);
    if (result.rows.length === 0) {
      return null;
    }
    return await mapTransactionFromDB(result.rows[0]);
  } catch (error) {
    console.error('Erro ao buscar transação por ID Asaas:', error);
    throw error;
  }
};

/**
 * Listar transações com filtros
 * @param {Object} filters - Filtros de busca
 * @param {string} filters.userId - ID do usuário
 * @param {string} filters.status - Status da transação
 * @param {number} filters.page - Página (para paginação)
 * @param {number} filters.limit - Limite por página
 * @returns {Promise<Object>} Objeto com transações e informações de paginação
 */
const listTransactions = async (filters = {}) => {
  try {
    const { userId, status, page = 1, limit = 10 } = filters;
    const offset = (page - 1) * limit;

    let query = 'SELECT * FROM transactions WHERE 1=1';
    const params = [];
    let paramCount = 1;

    if (userId) {
      const userIdStr = typeof userId === 'object' && userId._id ? userId._id.toString() : userId.toString();
      query += ` AND user_id = $${paramCount++}`;
      params.push(userIdStr);
    }

    if (status) {
      query += ` AND status = $${paramCount++}`;
      params.push(status);
    }

    query += ' ORDER BY created_at DESC';
    query += ` LIMIT $${paramCount++} OFFSET $${paramCount++}`;
    params.push(limit, offset);

    const result = await pool.query(query, params);
    const transactions = await Promise.all(result.rows.map(mapTransactionFromDB));

    // Contar total
    let countQuery = 'SELECT COUNT(*) FROM transactions WHERE 1=1';
    const countParams = [];
    paramCount = 1;

    if (userId) {
      const userIdStr = typeof userId === 'object' && userId._id ? userId._id.toString() : userId.toString();
      countQuery += ` AND user_id = $${paramCount++}`;
      countParams.push(userIdStr);
    }

    if (status) {
      countQuery += ` AND status = $${paramCount++}`;
      countParams.push(status);
    }

    const countResult = await pool.query(countQuery, countParams);
    const total = parseInt(countResult.rows[0].count);

    return {
      transactions,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  } catch (error) {
    console.error('Erro ao listar transações:', error);
    throw error;
  }
};

/**
 * Atualizar transação
 * @param {number} id - ID da transação
 * @param {Object} transactionData - Dados a serem atualizados
 * @returns {Promise<Object>} Transação atualizada
 */
const updateTransaction = async (id, transactionData) => {
  try {
    const updates = [];
    const values = [];
    let paramCount = 1;

    // Construir query dinamicamente
    if (transactionData.status !== undefined) {
      updates.push(`status = $${paramCount++}`);
      values.push(transactionData.status);
    }
    if (transactionData.paymentMethod !== undefined) {
      updates.push(`payment_method = $${paramCount++}`);
      values.push(transactionData.paymentMethod);
    }
    if (transactionData.transactionId !== undefined) {
      updates.push(`transaction_id = $${paramCount++}`);
      values.push(transactionData.transactionId);
    }
    if (transactionData.paymentDate !== undefined) {
      updates.push(`payment_date = $${paramCount++}`);
      values.push(transactionData.paymentDate);
    }
    if (transactionData.dueDate !== undefined) {
      updates.push(`due_date = $${paramCount++}`);
      values.push(transactionData.dueDate);
    }
    if (transactionData.pixQrCode !== undefined) {
      updates.push(`pix_qr_code = $${paramCount++}`);
      values.push(transactionData.pixQrCode);
    }
    if (transactionData.pixQrCodeExpiration !== undefined) {
      updates.push(`pix_qr_code_expiration = $${paramCount++}`);
      values.push(transactionData.pixQrCodeExpiration);
    }
    if (transactionData.bankSlipUrl !== undefined) {
      updates.push(`bank_slip_url = $${paramCount++}`);
      values.push(transactionData.bankSlipUrl);
    }
    if (transactionData.notes !== undefined) {
      updates.push(`notes = $${paramCount++}`);
      values.push(transactionData.notes);
    }

    if (updates.length === 0) {
      return await findTransactionById(id);
    }

    // Adicionar updated_at
    updates.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(id);

    const query = `
      UPDATE transactions 
      SET ${updates.join(', ')}
      WHERE id = $${paramCount}
      RETURNING *
    `;

    const result = await pool.query(query, values);

    if (result.rows.length === 0) {
      return null;
    }

    return await mapTransactionFromDB(result.rows[0]);
  } catch (error) {
    console.error('Erro ao atualizar transação:', error);
    throw error;
  }
};

/**
 * Mapear dados do banco Postgres para o formato esperado (compatível com código existente)
 * @param {Object} row - Linha do banco de dados Postgres
 * @returns {Promise<Object>} Objeto no formato esperado
 */
const mapTransactionFromDB = async (row) => {
  if (!row) return null;

  // Buscar plano relacionado se existir
  let plan = null;
  if (row.plan_id) {
    plan = await planPostgresService.findPlanById(row.plan_id);
  }

  // User ainda está no MongoDB, então retornamos apenas o user_id como string
  // O usuário será populado nas rotas quando necessário
  let user = row.user_id;

  return {
    _id: row.id.toString(), // ID como string para compatibilidade com código existente
    id: row.id,
    user: user,
    plan: plan, // Plano já vem do Postgres
    plan_id: row.plan_id, // ID numérico do plano no Postgres
    amount: parseFloat(row.amount),
    status: row.status,
    paymentMethod: row.payment_method,
    transactionId: row.transaction_id,
    asaasPaymentId: row.asaas_payment_id,
    asaasSubscriptionId: row.asaas_subscription_id,
    asaasCustomerId: row.asaas_customer_id,
    paymentDate: row.payment_date,
    dueDate: row.due_date,
    pixQrCode: row.pix_qr_code,
    pixQrCodeExpiration: row.pix_qr_code_expiration,
    bankSlipUrl: row.bank_slip_url,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    // Métodos para compatibilidade com código existente
    populate: async function (field) {
      // Simular método populate() para manter compatibilidade
      if (field === 'user' && typeof this.user === 'string') {
        const userPostgresService = require('./userPostgresService');
        this.user = await userPostgresService.findUserById(parseInt(this.user));
      }
      if (field === 'plan' && typeof this.plan === 'string') {
        this.plan = await planPostgresService.findPlanById(parseInt(this.plan));
      }
      return this;
    },
    save: async function () {
      // Simular método save() para manter compatibilidade
      return await updateTransaction(this.id, this);
    },
  };
};

module.exports = {
  createTransaction,
  findTransactionById,
  findTransactionByAsaasId,
  listTransactions,
  updateTransaction,
};

