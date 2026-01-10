const { pool } = require('../config/postgres');

/**
 * Criar plano no PostgreSQL
 * @param {Object} planData - Dados do plano
 * @returns {Promise<Object>} Plano criado
 */
const createPlan = async (planData) => {
  try {
    const {
      name,
      description,
      price,
      duration,
      durationUnit = 'months',
      features = [],
      credits = null,
      isUnlimited = false,
      isActive = true,
    } = planData;

    const result = await pool.query(
      `INSERT INTO plans (name, description, price, duration, duration_unit, features, credits, is_unlimited, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [name, description || null, price, duration, durationUnit, features, credits, isUnlimited, isActive]
    );

    return mapPlanFromDB(result.rows[0]);
  } catch (error) {
    console.error('Erro ao criar plano no PostgreSQL:', error);
    throw error;
  }
};

/**
 * Buscar plano por ID
 * @param {number} id - ID do plano
 * @returns {Promise<Object|null>} Plano encontrado ou null
 */
const findPlanById = async (id) => {
  try {
    const result = await pool.query('SELECT * FROM plans WHERE id = $1', [id]);
    return result.rows[0] ? mapPlanFromDB(result.rows[0]) : null;
  } catch (error) {
    console.error('Erro ao buscar plano por ID:', error);
    throw error;
  }
};

/**
 * Buscar plano por nome
 * @param {string} name - Nome do plano
 * @returns {Promise<Object|null>} Plano encontrado ou null
 */
const findPlanByName = async (name) => {
  try {
    const result = await pool.query('SELECT * FROM plans WHERE name = $1', [name]);
    return result.rows[0] ? mapPlanFromDB(result.rows[0]) : null;
  } catch (error) {
    console.error('Erro ao buscar plano por nome:', error);
    throw error;
  }
};

/**
 * Listar planos com filtros
 * @param {Object} filters - Filtros de busca
 * @param {boolean} filters.isActive - Filtrar por status ativo
 * @param {number} filters.page - Página (para paginação)
 * @param {number} filters.limit - Limite por página
 * @returns {Promise<Object>} Objeto com planos e informações de paginação
 */
const listPlans = async (filters = {}) => {
  try {
    const { isActive, page = 1, limit = 100 } = filters;
    const offset = (page - 1) * limit;

    let query = 'SELECT * FROM plans WHERE 1=1';
    const params = [];
    let paramCount = 1;

    if (isActive !== undefined) {
      query += ` AND is_active = $${paramCount++}`;
      params.push(isActive);
    }

    query += ' ORDER BY price ASC';
    query += ` LIMIT $${paramCount++} OFFSET $${paramCount++}`;
    params.push(limit, offset);

    const result = await pool.query(query, params);
    const plans = result.rows.map(mapPlanFromDB);

    // Contar total
    let countQuery = 'SELECT COUNT(*) FROM plans WHERE 1=1';
    const countParams = [];
    paramCount = 1;

    if (isActive !== undefined) {
      countQuery += ` AND is_active = $${paramCount++}`;
      countParams.push(isActive);
    }

    const countResult = await pool.query(countQuery, countParams);
    const total = parseInt(countResult.rows[0].count);

    return {
      plans,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  } catch (error) {
    console.error('Erro ao listar planos:', error);
    throw error;
  }
};

/**
 * Atualizar plano
 * @param {number} id - ID do plano
 * @param {Object} planData - Dados a serem atualizados
 * @returns {Promise<Object>} Plano atualizado
 */
const updatePlan = async (id, planData) => {
  try {
    const updates = [];
    const values = [];
    let paramCount = 1;

    // Construir query dinamicamente baseado nos campos fornecidos
    if (planData.name !== undefined) {
      updates.push(`name = $${paramCount++}`);
      values.push(planData.name);
    }
    if (planData.description !== undefined) {
      updates.push(`description = $${paramCount++}`);
      values.push(planData.description);
    }
    if (planData.price !== undefined) {
      updates.push(`price = $${paramCount++}`);
      values.push(planData.price);
    }
    if (planData.duration !== undefined) {
      updates.push(`duration = $${paramCount++}`);
      values.push(planData.duration);
    }
    if (planData.durationUnit !== undefined) {
      updates.push(`duration_unit = $${paramCount++}`);
      values.push(planData.durationUnit);
    }
    if (planData.features !== undefined) {
      updates.push(`features = $${paramCount++}`);
      values.push(planData.features);
    }
    if (planData.credits !== undefined) {
      updates.push(`credits = $${paramCount++}`);
      values.push(planData.credits);
    }
    if (planData.isUnlimited !== undefined) {
      updates.push(`is_unlimited = $${paramCount++}`);
      values.push(planData.isUnlimited);
    }
    if (planData.isActive !== undefined) {
      updates.push(`is_active = $${paramCount++}`);
      values.push(planData.isActive);
    }

    if (updates.length === 0) {
      // Se não há atualizações, retornar plano atual
      return await findPlanById(id);
    }

    // Adicionar updated_at
    updates.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(id);

    const query = `
      UPDATE plans 
      SET ${updates.join(', ')}
      WHERE id = $${paramCount}
      RETURNING *
    `;

    const result = await pool.query(query, values);

    if (result.rows.length === 0) {
      return null;
    }

    return mapPlanFromDB(result.rows[0]);
  } catch (error) {
    console.error('Erro ao atualizar plano:', error);
    throw error;
  }
};

/**
 * Desativar plano (soft delete)
 * @param {number} id - ID do plano
 * @returns {Promise<Object>} Plano desativado
 */
const deactivatePlan = async (id) => {
  try {
    const result = await pool.query(
      `UPDATE plans 
       SET is_active = false, updated_at = CURRENT_TIMESTAMP 
       WHERE id = $1 
       RETURNING *`,
      [id]
    );

    return result.rows[0] ? mapPlanFromDB(result.rows[0]) : null;
  } catch (error) {
    console.error('Erro ao desativar plano:', error);
    throw error;
  }
};

/**
 * Mapear dados do banco Postgres para o formato esperado (compatível com código existente)
 * @param {Object} row - Linha do banco de dados Postgres
 * @returns {Object} Objeto no formato esperado
 */
const mapPlanFromDB = (row) => {
  if (!row) return null;

  return {
    _id: row.id.toString(), // ID como string para compatibilidade com código existente
    id: row.id,
    name: row.name,
    description: row.description,
    price: parseFloat(row.price),
    duration: row.duration,
    durationUnit: row.duration_unit,
    features: row.features || [],
    credits: row.credits,
    isUnlimited: row.is_unlimited,
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
};

module.exports = {
  createPlan,
  findPlanById,
  findPlanByName,
  listPlans,
  updatePlan,
  deactivatePlan,
};

