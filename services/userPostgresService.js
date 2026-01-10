const { pool } = require('../config/postgres');

/**
 * Criar ou atualizar usuário no PostgreSQL
 * @param {Object} userData - Dados do usuário
 * @param {string} userData.n8n_user_id - ID do usuário no N8N
 * @param {string} userData.email - Email do usuário
 * @param {string} userData.nome - Nome do usuário
 * @param {string} userData.telefone - Telefone do usuário
 * @param {string} userData.status - Status do usuário (pending, verified, active, etc)
 * @returns {Promise<Object>} Usuário criado/atualizado
 */
const createOrUpdateUser = async (userData) => {
  try {
    const { n8n_user_id, email, nome, telefone, status = 'pending' } = userData;

    // Verificar se usuário já existe pelo n8n_user_id ou email
    let existingUser = null;
    if (n8n_user_id) {
      const result = await pool.query(
        'SELECT * FROM users WHERE n8n_user_id = $1',
        [n8n_user_id]
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

      if (n8n_user_id !== undefined && n8n_user_id !== null && n8n_user_id !== '') {
        updates.push(`n8n_user_id = $${paramCount++}`);
        values.push(n8n_user_id);
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

      if (n8n_user_id !== undefined && n8n_user_id !== null && n8n_user_id !== '') {
        fields.push('n8n_user_id');
        placeholders.push(`$${paramCount++}`);
        values.push(n8n_user_id);
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

      // Verificar se pelo menos um identificador foi fornecido (email ou n8n_user_id)
      if (!email && !n8n_user_id) {
        throw new Error('Pelo menos um identificador (email ou n8n_user_id) deve ser fornecido para criar usuário');
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
 * Buscar usuário por n8n_user_id
 * @param {string} n8nUserId - ID do usuário no N8N
 * @returns {Promise<Object|null>} Usuário encontrado ou null
 */
const findUserByN8nId = async (n8nUserId) => {
  try {
    const result = await pool.query(
      'SELECT * FROM users WHERE n8n_user_id = $1',
      [n8nUserId]
    );
    return result.rows[0] || null;
  } catch (error) {
    console.error('Erro ao buscar usuário por N8N ID:', error);
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

module.exports = {
  createOrUpdateUser,
  findUserByN8nId,
  findUserByEmail,
  findUserByPhone,
  findUserById,
  updateUserStatus,
};

