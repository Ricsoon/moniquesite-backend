const { Pool } = require('pg');

// Criar pool de conexões PostgreSQL
const pool = new Pool({
  host: process.env.POSTGRES_HOST || 'localhost',
  port: process.env.POSTGRES_PORT || 5432,
  database: process.env.POSTGRES_DB || 'monique_db',
  user: process.env.POSTGRES_USER || 'postgres',
  password: process.env.POSTGRES_PASSWORD || '',
  max: 20, // Máximo de conexões no pool
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Testar conexão
pool.on('connect', () => {
  console.log('PostgreSQL: Nova conexão estabelecida');
});

pool.on('error', (err) => {
  console.error('PostgreSQL: Erro inesperado na conexão', err);
  process.exit(-1);
});

// Testar conexão ao iniciar
const testConnection = async () => {
  try {
    const result = await pool.query('SELECT NOW()');
    console.log(`✅ PostgreSQL conectado com sucesso: ${result.rows[0].now}`);
    return true;
  } catch (error) {
    console.error('❌ Erro ao conectar ao PostgreSQL:', error.message);
    return false;
  }
};

// Criar tabelas se não existirem
const initializeTables = async () => {
  try {
    // Criar tabela de usuários
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        n8n_user_id VARCHAR(255) UNIQUE,
        email VARCHAR(255) UNIQUE,
        nome VARCHAR(255),
        telefone VARCHAR(20),
        status VARCHAR(50) DEFAULT 'pending',
        google_id VARCHAR(255) UNIQUE,
        is_active BOOLEAN DEFAULT true,
        picture VARCHAR(500),
        active_plan INTEGER REFERENCES plans(id),
        credits INTEGER DEFAULT 200,
        has_unlimited_credits BOOLEAN DEFAULT false,
        credits_used INTEGER DEFAULT 0,
        plan_start_date TIMESTAMP,
        plan_end_date TIMESTAMP,
        asaas_customer_id VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT users_identifier_check CHECK (n8n_user_id IS NOT NULL OR email IS NOT NULL)
      )
    `);

    // Criar índices para users (um por query)
    await pool.query('CREATE INDEX IF NOT EXISTS idx_users_n8n_user_id ON users(n8n_user_id)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_users_telefone ON users(telefone)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_users_status ON users(status)');

    // Criar tabela de planos
    await pool.query(`
      CREATE TABLE IF NOT EXISTS plans (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) UNIQUE NOT NULL,
        description TEXT,
        price DECIMAL(10, 2) NOT NULL CHECK (price >= 0),
        duration INTEGER NOT NULL CHECK (duration >= 1),
        duration_unit VARCHAR(20) DEFAULT 'months' CHECK (duration_unit IN ('days', 'months', 'years')),
        features TEXT[],
        credits INTEGER CHECK (credits >= 0),
        is_unlimited BOOLEAN DEFAULT false,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Criar índices para plans
    await pool.query('CREATE INDEX IF NOT EXISTS idx_plans_name ON plans(name)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_plans_is_active ON plans(is_active)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_plans_price ON plans(price)');

    // Criar tabela de transações
    await pool.query(`
      CREATE TABLE IF NOT EXISTS transactions (
        id SERIAL PRIMARY KEY,
        user_id VARCHAR(255) NOT NULL,
        plan_id INTEGER REFERENCES plans(id) ON DELETE SET NULL,
        amount DECIMAL(10, 2) NOT NULL CHECK (amount >= 0),
        status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed', 'cancelled', 'refunded')),
        payment_method VARCHAR(50) DEFAULT 'other' CHECK (payment_method IN ('credit_card', 'debit_card', 'pix', 'bank_transfer', 'other')),
        transaction_id VARCHAR(255) UNIQUE,
        asaas_payment_id VARCHAR(255),
        asaas_subscription_id VARCHAR(255),
        asaas_customer_id VARCHAR(255),
        payment_date TIMESTAMP,
        due_date TIMESTAMP,
        pix_qr_code TEXT,
        pix_qr_code_expiration TIMESTAMP,
        bank_slip_url TEXT,
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Criar índices para transactions
    await pool.query('CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON transactions(user_id)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_transactions_plan_id ON transactions(plan_id)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_transactions_status ON transactions(status)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_transactions_created_at ON transactions(created_at DESC)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_transactions_transaction_id ON transactions(transaction_id)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_transactions_asaas_payment_id ON transactions(asaas_payment_id)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_transactions_asaas_subscription_id ON transactions(asaas_subscription_id)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_transactions_user_created ON transactions(user_id, created_at DESC)');

    // Criar tabela de OTP Codes
    await pool.query(`
      CREATE TABLE IF NOT EXISTS otp_codes (
        id SERIAL PRIMARY KEY,
        user_email VARCHAR(255) NOT NULL,
        user_id INTEGER REFERENCES users(id),
        phone VARCHAR(20) NOT NULL,
        code VARCHAR(6) NOT NULL,
        expires_at TIMESTAMP NOT NULL,
        verified BOOLEAN DEFAULT false,
        verified_at TIMESTAMP,
        attempts INTEGER DEFAULT 0,
        max_attempts INTEGER DEFAULT 5,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Criar índices para otp_codes com TTL via política
    await pool.query('CREATE INDEX IF NOT EXISTS idx_otp_codes_user_email ON otp_codes(user_email, phone, verified)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_otp_codes_code_verified ON otp_codes(code, verified)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_otp_codes_expires_at ON otp_codes(expires_at)');

    console.log('✅ Tabelas do PostgreSQL inicializadas com sucesso');
  } catch (error) {
    console.error('❌ Erro ao inicializar tabelas PostgreSQL:', error);
    throw error;
  }
};
// Adicionar colunas de autenticação se não existirem
const addAuthColumnsIfNeeded = async () => {
  try {
    // Adicionar coluna google_id
    await pool.query(`
      ALTER TABLE users 
      ADD COLUMN IF NOT EXISTS google_id VARCHAR(255) UNIQUE
    `);

    // Adicionar coluna is_active
    await pool.query(`
      ALTER TABLE users 
      ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true
    `);

    // Adicionar coluna picture
    await pool.query(`
      ALTER TABLE users 
      ADD COLUMN IF NOT EXISTS picture VARCHAR(500)
    `);

    // Adicionar coluna active_plan
    await pool.query(`
      ALTER TABLE users 
      ADD COLUMN IF NOT EXISTS active_plan INTEGER REFERENCES plans(id)
    `);

    // Adicionar coluna credits
    await pool.query(`
      ALTER TABLE users 
      ADD COLUMN IF NOT EXISTS credits INTEGER DEFAULT 200
    `);

    // Adicionar coluna has_unlimited_credits
    await pool.query(`
      ALTER TABLE users 
      ADD COLUMN IF NOT EXISTS has_unlimited_credits BOOLEAN DEFAULT false
    `);

    // Adicionar coluna credits_used
    await pool.query(`
      ALTER TABLE users 
      ADD COLUMN IF NOT EXISTS credits_used INTEGER DEFAULT 0
    `);

    // Adicionar coluna plan_start_date
    await pool.query(`
      ALTER TABLE users 
      ADD COLUMN IF NOT EXISTS plan_start_date TIMESTAMP
    `);

    // Adicionar coluna plan_end_date
    await pool.query(`
      ALTER TABLE users 
      ADD COLUMN IF NOT EXISTS plan_end_date TIMESTAMP
    `);

    // Criar índice para google_id
    await pool.query('CREATE INDEX IF NOT EXISTS idx_users_google_id ON users(google_id)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_users_is_active ON users(is_active)');

    // Adicionar colunas para sincronização de planos (tabela plans)
    await pool.query(`
      ALTER TABLE plans 
      ADD COLUMN IF NOT EXISTS external_id VARCHAR(255) UNIQUE
    `);

    await pool.query(`
      ALTER TABLE plans 
      ADD COLUMN IF NOT EXISTS slug VARCHAR(255)
    `);

    await pool.query('CREATE INDEX IF NOT EXISTS idx_plans_external_id ON plans(external_id)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_plans_slug ON plans(slug)');

    console.log('✅ Colunas de autenticação e planos adicionadas/verificadas com sucesso');
  } catch (error) {
    console.error('⚠️  Erro ao adicionar colunas de autenticação:', error.message);
    // Não fazer throw para permitir que a aplicação continue funcionando
  }
};

module.exports = {
  pool,
  testConnection,
  initializeTables,
  addAuthColumnsIfNeeded,
};

