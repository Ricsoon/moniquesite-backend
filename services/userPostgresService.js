const { pool } = require('../config/postgres');

/**
 * Criar ou atualizar usuário no PostgreSQL
 * @param {Object} userData - Dados do usuário
 * @param {string} userData.user_id - ID do usuário no N8N
 * @param {string} userData.email - Email do usuário
 * @param {string} userData.nome - Nome do usuário
 * @param {string} userData.telefone - Telefone do usuário
 * @param {string} userData.status - Status do usuário (pending, verified, active, etc)
 * @returns {Promise<Object>} Usuário criado/atualizado
 */
const createOrUpdateUser = async (userData) => {
  try {
    const { user_id, email, nome, telefone, status = 'pending', active_plan } = userData;

    // Verificar se usuário já existe pelo user_id ou email
    let existingUser = null;
    if (user_id) {
      const result = await pool.query(
        'SELECT * FROM users WHERE n8n_user_id = $1',
        [user_id]
      );
      existingUser = result.rows[0];
    }

    if (!existingUser && email) {
      const result = await pool.query(
        'SELECT * FROM users WHERE email = $1',
        [email]
      );
      existingUser = result.rows[0];
    }

    if (existingUser) {
      // Atualizar usuário existente - mesclar dados existentes com novos
      // Só atualiza campos que foram fornecidos (não null/undefined)
      const updates = [];
      const values = [];
      let paramCount = 1;

      if (user_id !== undefined && user_id !== null && user_id !== '') {
        updates.push(`n8n_user_id = $${paramCount++}`);
        values.push(user_id);
      }
      if (email !== undefined && email !== null && email !== '') {
        updates.push(`email = $${paramCount++}`);
        values.push(email);
      }
      if (nome !== undefined && nome !== null && nome !== '') {
        updates.push(`nome = $${paramCount++}`);
        values.push(nome);
      }
      if (telefone !== undefined && telefone !== null && telefone !== '') {
        updates.push(`telefone = $${paramCount++}`);
        values.push(telefone);
      }
      if (status !== undefined && status !== null && status !== '') {
        updates.push(`status = $${paramCount++}`);
        values.push(status);
      }
      if (active_plan !== undefined && active_plan !== null) {
        updates.push(`active_plan = $${paramCount++}`);
        values.push(active_plan);
      }

      if (updates.length > 0) {
        updates.push(`updated_at = CURRENT_TIMESTAMP`);
        values.push(existingUser.id);

        const updateQuery = `
          UPDATE users 
          SET ${updates.join(', ')}
          WHERE id = $${paramCount}
          RETURNING *
        `;

        const result = await pool.query(updateQuery, values);
        return result.rows[0];
      } else {
        return existingUser;
      }
    } else {
      // Criar novo usuário - só insere campos que foram fornecidos
      const fields = [];
      const placeholders = [];
      const values = [];
      let paramCount = 1;

      if (user_id !== undefined && user_id !== null && user_id !== '') {
        fields.push('n8n_user_id');
        placeholders.push(`$${paramCount++}`);
        values.push(user_id);
      }
      if (email !== undefined && email !== null && email !== '') {
        fields.push('email');
        placeholders.push(`$${paramCount++}`);
        values.push(email);
      }
      if (nome !== undefined && nome !== null && nome !== '') {
        fields.push('nome');
        placeholders.push(`$${paramCount++}`);
        values.push(nome);
      }
      if (telefone !== undefined && telefone !== null && telefone !== '') {
        fields.push('telefone');
        placeholders.push(`$${paramCount++}`);
        values.push(telefone);
      }

      // Status sempre é definido (usa padrão 'pending' se não fornecido)
      fields.push('status');
      placeholders.push(`$${paramCount++}`);
      values.push(status || 'pending');

      if (active_plan !== undefined && active_plan !== null) {
        fields.push('active_plan');
        placeholders.push(`$${paramCount++}`);
        values.push(active_plan);
      }

      // Verificar se pelo menos um identificador foi fornecido (email ou user_id)
      if (!email && !user_id) {
        throw new Error('Pelo menos um identificador (email ou user_id) deve ser fornecido para criar usuário');
      }

      const insertQuery = `
        INSERT INTO users (${fields.join(', ')})
        VALUES (${placeholders.join(', ')})
        RETURNING *
      `;

      const result = await pool.query(insertQuery, values);
      return result.rows[0];
    }
  } catch (error) {
    console.error('Erro ao criar/atualizar usuário no PostgreSQL:', error);
    throw error;
  }
};

/**
 * Atualizar dados do usuário (nome, telefone, cpf_cnpj)
 * @param {number} userId - ID do usuário
 * @param {Object} updateData - Dados a atualizar
 * @returns {Promise<Object>} Usuário atualizado
 */
const updateUser = async (userId, updateData) => {
  try {
    const { nome, telefone, cpfCnpj } = updateData;
    const updates = [];
    const values = [];
    let paramCount = 1;

    if (nome !== undefined) {
      updates.push(`nome = $${paramCount++}`);
      values.push(nome);
    }
    if (telefone !== undefined) {
      updates.push(`telefone = $${paramCount++}`);
      values.push(telefone);
    }
    if (cpfCnpj !== undefined) {
      updates.push(`cpf_cnpj = $${paramCount++}`);
      values.push(cpfCnpj.replace(/\D/g, '')); // Salvar apenas números
    }

    if (updates.length === 0) {
      return findUserById(userId);
    }

    updates.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(userId);

    const query = `
      UPDATE users 
      SET ${updates.join(', ')}
      WHERE id = $${paramCount}
      RETURNING *
    `;

    const result = await pool.query(query, values);

    // Mapear cpf_cnpj de volta para cpfCnpj para compatibilidade com frontend/API
    const user = result.rows[0];
    if (user) {
      user.cpfCnpj = user.cpf_cnpj;
    }

    return user;
  } catch (error) {
    console.error('Erro ao atualizar usuário:', error);
    throw error;
  }
};

/**
 * Buscar usuário por user_id
 * @param {string} userId - ID do usuário no N8N
 * @returns {Promise<Object|null>} Usuário encontrado ou null
 */
const findUserByUserId = async (userId) => {
  try {
    const result = await pool.query(
      'SELECT * FROM users WHERE n8n_user_id = $1',
      [userId]
    );
    return result.rows[0] || null;
  } catch (error) {
    console.error('Erro ao buscar usuário por user ID:', error);
    throw error;
  }
};

/**
 * Buscar usuário por email
 * @param {string} email - Email do usuário
 * @returns {Promise<Object|null>} Usuário encontrado ou null
 */
const findUserByEmail = async (email) => {
  try {
    const result = await pool.query(
      'SELECT * FROM users WHERE email = $1',
      [email]
    );
    return result.rows[0] || null;
  } catch (error) {
    console.error('Erro ao buscar usuário por email:', error);
    throw error;
  }
};

/**
 * Buscar usuário por telefone
 * @param {string} telefone - Telefone do usuário
 * @returns {Promise<Object|null>} Usuário encontrado ou null
 */
const findUserByPhone = async (telefone) => {
  try {
    const result = await pool.query(
      'SELECT * FROM users WHERE telefone = $1',
      [telefone]
    );
    return result.rows[0] || null;
  } catch (error) {
    console.error('Erro ao buscar usuário por telefone:', error);
    throw error;
  }
};

/**
 * Buscar usuário por ID interno
 * @param {number} id - ID interno do usuário
 * @returns {Promise<Object|null>} Usuário encontrado ou null
 */
const findUserById = async (id) => {
  try {
    const result = await pool.query(
      'SELECT * FROM users WHERE id = $1',
      [id]
    );
    return result.rows[0] || null;
  } catch (error) {
    console.error('Erro ao buscar usuário por ID:', error);
    throw error;
  }
};

/**
 * Atualizar status do usuário
 * @param {number} id - ID interno do usuário
 * @param {string} status - Novo status
 * @returns {Promise<Object>} Usuário atualizado
 */
const updateUserStatus = async (id, status) => {
  try {
    const result = await pool.query(
      `UPDATE users 
       SET status = $1, updated_at = CURRENT_TIMESTAMP 
       WHERE id = $2 
       RETURNING *`,
      [status, id]
    );
    return result.rows[0];
  } catch (error) {
    console.error('Erro ao atualizar status do usuário:', error);
    throw error;
  }
};

/**
 * Buscar usuário por Google ID
 * @param {string} googleId - Google ID do usuário
 * @returns {Promise<Object|null>} Usuário encontrado ou null
 */
const findUserByGoogleId = async (googleId) => {
  try {
    const result = await pool.query(
      'SELECT * FROM users WHERE google_id = $1',
      [googleId]
    );
    return result.rows[0] || null;
  } catch (error) {
    console.error('Erro ao buscar usuário por Google ID:', error);
    throw error;
  }
};

/**
 * Atualizar usuário com informações do Google OAuth
 * @param {number} userId - ID do usuário
 * @param {Object} googleData - Dados do Google (googleId, name, picture, email)
 * @returns {Promise<Object>} Usuário atualizado
 */
const updateUserWithGoogleData = async (userId, googleData) => {
  try {
    const { googleId, name, picture, email } = googleData;

    const result = await pool.query(
      `UPDATE users 
       SET google_id = $1, 
           nome = COALESCE($2, nome),
           picture = COALESCE($3, picture),
           email = COALESCE($4, email),
           is_active = true,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $5
       RETURNING *`,
      [googleId, name, picture, email, userId]
    );
    return result.rows[0];
  } catch (error) {
    console.error('Erro ao atualizar usuário com dados do Google:', error);
    throw error;
  }
};

/**
 * Criar novo usuário com dados do Google OAuth
 * @param {Object} userData - Dados do usuário (googleId, name, email, picture)
 * @returns {Promise<Object>} Usuário criado
 */
const createUserWithGoogle = async (userData) => {
  try {
    const { googleId, name, email, picture } = userData;

    const result = await pool.query(
      `INSERT INTO users (google_id, nome, email, picture, status, is_active, created_at, updated_at)
       VALUES ($1, $2, $3, $4, 'active', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
       RETURNING *`,
      [googleId, name, email, picture || null]
    );
    return result.rows[0];
  } catch (error) {
    console.error('Erro ao criar usuário com Google OAuth:', error);
    throw error;
  }
};

/**
 * Atualizar créditos e créditos utilizados do usuário
 * @param {number} userId - ID do usuário
 * @param {number} credits - Novo saldo de créditos
 * @param {number} creditsUsed - Créditos já utilizados
 * @returns {Promise<Object>} Usuário atualizado
 */
const updateUserCredits = async (userId, credits, creditsUsed) => {
  try {
    const result = await pool.query(
      `UPDATE users 
       SET credits = $1, credits_used = $2, updated_at = CURRENT_TIMESTAMP
       WHERE id = $3
       RETURNING *`,
      [credits, creditsUsed, userId]
    );
    return result.rows[0];
  } catch (error) {
    console.error('Erro ao atualizar créditos do usuário:', error);
    throw error;
  }
};

/**
 * Atualizar apenas créditos utilizados
 * @param {number} userId - ID do usuário
 * @param {number} creditsUsed - Créditos já utilizados
 * @returns {Promise<Object>} Usuário atualizado
 */
const updateUserCreditsUsed = async (userId, creditsUsed) => {
  try {
    const result = await pool.query(
      `UPDATE users 
       SET credits_used = $1, updated_at = CURRENT_TIMESTAMP
       WHERE id = $2
       RETURNING *`,
      [creditsUsed, userId]
    );
    return result.rows[0];
  } catch (error) {
    console.error('Erro ao atualizar créditos utilizados do usuário:', error);
    throw error;
  }
};

/**
 * Ativar plano para usuário e atualizar créditos
 * @param {number} userId - ID do usuário
 * @param {number} planId - ID do plano a ativar
 * @param {Date} planStartDate - Data inicial do plano
 * @param {Date} planEndDate - Data final do plano
 * @param {number} credits - Novo saldo de créditos
 * @param {boolean} hasUnlimitedCredits - Se o plano é ilimitado
 * @returns {Promise<Object>} Usuário atualizado
 */
const updateUserPlan = async (userId, planId, planStartDate, planEndDate, credits, hasUnlimitedCredits) => {
  try {
    const result = await pool.query(
      `UPDATE users 
       SET active_plan = $1, 
           plan_start_date = $2, 
           plan_end_date = $3, 
           credits = $4,
           has_unlimited_credits = $5,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $6
       RETURNING *`,
      [planId, planStartDate, planEndDate, credits, hasUnlimitedCredits, userId]
    );
    return result.rows[0];
  } catch (error) {
    console.error('Erro ao atualizar plano do usuário:', error);
    throw error;
  }
};

module.exports = {
  createOrUpdateUser,
  findUserByUserId,
  findUserByEmail,
  findUserByPhone,
  findUserById,
  updateUserStatus,
  findUserByGoogleId,
  updateUserWithGoogleData,
  createUserWithGoogle,
  updateUserCredits,
  updateUserCreditsUsed,
  updateUserPlan,
  updateUser,
};

