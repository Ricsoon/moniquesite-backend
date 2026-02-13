/**
 * Script para migração de autenticação MongoDB → PostgreSQL
 * Este script adiciona os campos necessários para autenticação Google à tabela users
 */

const { pool } = require('../config/postgres');

const migrateAuthToPostgres = async () => {
  try {
    console.log('🔄 Iniciando migração de autenticação para PostgreSQL...');

    // Verificar se a tabela users existe e adicionar campos necessários
    const addGoogleIdColumn = `
      ALTER TABLE users 
      ADD COLUMN IF NOT EXISTS google_id VARCHAR(255) UNIQUE;
    `;

    const addIsActiveColumn = `
      ALTER TABLE users 
      ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
    `;

    const addPictureColumn = `
      ALTER TABLE users 
      ADD COLUMN IF NOT EXISTS picture VARCHAR(500);
    `;

    const addActivePlanColumn = `
      ALTER TABLE users 
      ADD COLUMN IF NOT EXISTS active_plan INTEGER REFERENCES plans(id);
    `;

    const addCreditsColumn = `
      ALTER TABLE users 
      ADD COLUMN IF NOT EXISTS credits INTEGER DEFAULT 200;
    `;

    const addHasUnlimitedCreditsColumn = `
      ALTER TABLE users 
      ADD COLUMN IF NOT EXISTS has_unlimited_credits BOOLEAN DEFAULT false;
    `;

    const addCreditsUsedColumn = `
      ALTER TABLE users 
      ADD COLUMN IF NOT EXISTS credits_used INTEGER DEFAULT 0;
    `;

    const addPlanDatesColumn = `
      ALTER TABLE users 
      ADD COLUMN IF NOT EXISTS plan_start_date TIMESTAMP;
    `;

    const addPlanEndDateColumn = `
      ALTER TABLE users 
      ADD COLUMN IF NOT EXISTS plan_end_date TIMESTAMP;
    `;

    const addAsaasCustomerIdColumn = `
      ALTER TABLE users 
      ADD COLUMN IF NOT EXISTS asaas_customer_id VARCHAR(255);
    `;

    // Executar alterações
    await pool.query(addGoogleIdColumn);
    console.log('✅ Coluna google_id adicionada/verificada');

    await pool.query(addIsActiveColumn);
    console.log('✅ Coluna is_active adicionada/verificada');

    await pool.query(addPictureColumn);
    console.log('✅ Coluna picture adicionada/verificada');

    await pool.query(addActivePlanColumn);
    console.log('✅ Coluna active_plan adicionada/verificada');

    await pool.query(addCreditsColumn);
    console.log('✅ Coluna credits adicionada/verificada');

    await pool.query(addHasUnlimitedCreditsColumn);
    console.log('✅ Coluna has_unlimited_credits adicionada/verificada');

    await pool.query(addCreditsUsedColumn);
    console.log('✅ Coluna credits_used adicionada/verificada');

    await pool.query(addPlanDatesColumn);
    console.log('✅ Coluna plan_start_date adicionada/verificada');

    await pool.query(addPlanEndDateColumn);
    console.log('✅ Coluna plan_end_date adicionada/verificada');

    await pool.query(addAsaasCustomerIdColumn);
    console.log('✅ Coluna asaas_customer_id adicionada/verificada');

    console.log('✅ Migração de autenticação para PostgreSQL concluída com sucesso!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Erro ao migrar autenticação:', error);
    process.exit(1);
  }
};

// Executar migração
migrateAuthToPostgres();
