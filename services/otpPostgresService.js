const { pool } = require('../config/postgres');

/**
 * Criar/atualizar código OTP no PostgreSQL
 * @param {Object} otpData - Dados do OTP
 * @returns {Promise<Object>} OTP criado
 */
const createOTP = async (otpData) => {
  const { userEmail, userId, phone, code, expirationMinutes = 10, maxAttempts = 5 } = otpData;

  try {
    const result = await pool.query(
      `INSERT INTO otp_codes (user_email, user_id, phone, code, expires_at, verified, attempts, max_attempts)
       VALUES ($1, $2, $3, $4, NOW() + ($5 || ' minutes')::INTERVAL, false, 0, $6)
       RETURNING *`,
      [userEmail, userId || null, phone, code, expirationMinutes, maxAttempts]
    );

    return result.rows[0];
  } catch (error) {
    console.error('Erro ao criar OTP:', error);
    throw error;
  }
};

/**
 * Buscar OTP pendente não verificado
 * @param {string} userEmail - Email do usuário
 * @param {string} code - Código OTP
 * @param {string} phone - Telefone
 * @returns {Promise<Object|null>} OTP encontrado ou null
 */
const findPendingOTP = async (userEmail, code, phone) => {
  try {
    const result = await pool.query(
      `SELECT * FROM otp_codes 
       WHERE user_email = $1 AND code = $2 AND phone = $3 
       AND verified = false AND expires_at > NOW()
       LIMIT 1`,
      [userEmail, code, phone]
    );

    return result.rows[0] || null;
  } catch (error) {
    console.error('Erro ao buscar OTP pendente:', error);
    throw error;
  }
};

/**
 * Buscar OTP mais recente para usuário e telefone
 * @param {string} userEmail - Email do usuário
 * @param {string} phone - Telefone
 * @param {boolean} verified - Se está verificado
 * @returns {Promise<Object|null>} OTP encontrado ou null
 */
const findLatestOTP = async (userEmail, phone, verified = false) => {
  try {
    const result = await pool.query(
      `SELECT * FROM otp_codes 
       WHERE user_email = $1 AND phone = $2 AND verified = $3
       ORDER BY created_at DESC
       LIMIT 1`,
      [userEmail, phone, verified]
    );

    return result.rows[0] || null;
  } catch (error) {
    console.error('Erro ao buscar OTP mais recente:', error);
    throw error;
  }
};

/**
 * Invalidar códigos OTP não verificados para um email/telefone
 * @param {string} userEmail - Email do usuário
 * @param {string} phone - Telefone
 * @returns {Promise<Object>} Resultado da operação
 */
const invalidateOTPCodes = async (userEmail, phone) => {
  try {
    const result = await pool.query(
      `UPDATE otp_codes 
       SET verified = true 
       WHERE user_email = $1 AND phone = $2 AND verified = false
       RETURNING *`,
      [userEmail, phone]
    );

    return result.rows;
  } catch (error) {
    console.error('Erro ao invalidar OTP codes:', error);
    throw error;
  }
};

/**
 * Verificar código OTP (marcar como verificado)
 * @param {number} otpId - ID do OTP
 * @returns {Promise<Object>} OTP verificado
 */
const verifyOTP = async (otpId) => {
  try {
    const result = await pool.query(
      `UPDATE otp_codes 
       SET verified = true, verified_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [otpId]
    );

    return result.rows[0];
  } catch (error) {
    console.error('Erro ao verificar OTP:', error);
    throw error;
  }
};

/**
 * Incrementar tentativas de um OTP
 * @param {number} otpId - ID do OTP
 * @returns {Promise<Object>} OTP atualizado
 */
const incrementAttempts = async (otpId) => {
  try {
    const result = await pool.query(
      `UPDATE otp_codes 
       SET attempts = attempts + 1
       WHERE id = $1
       RETURNING *`,
      [otpId]
    );

    return result.rows[0];
  } catch (error) {
    console.error('Erro ao incrementar tentativas:', error);
    throw error;
  }
};

/**
 * Limpar OTP codes expirados (pode ser executado periodicamente)
 * @returns {Promise<Object>} Resultado da operação
 */
const cleanExpiredOTPs = async () => {
  try {
    const result = await pool.query(
      `DELETE FROM otp_codes 
       WHERE expires_at < NOW()`
    );

    console.log(`✅ ${result.rowCount} OTP codes expirados removidos`);
    return result;
  } catch (error) {
    console.error('Erro ao limpar OTP codes expirados:', error);
    throw error;
  }
};

/**
 * Buscar OTP por ID
 * @param {number} otpId - ID do OTP
 * @returns {Promise<Object|null>} OTP encontrado ou null
 */
const findOTPById = async (otpId) => {
  try {
    const result = await pool.query(
      `SELECT * FROM otp_codes WHERE id = $1`,
      [otpId]
    );

    return result.rows[0] || null;
  } catch (error) {
    console.error('Erro ao buscar OTP por ID:', error);
    throw error;
  }
};

module.exports = {
  createOTP,
  findPendingOTP,
  findLatestOTP,
  invalidateOTPCodes,
  verifyOTP,
  incrementAttempts,
  cleanExpiredOTPs,
  findOTPById,
};
