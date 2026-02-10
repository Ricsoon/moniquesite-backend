require('dotenv').config();

module.exports = {
  port: process.env.PORT || 3000,
  jwtSecret: process.env.JWT_SECRET || 'jwt_secret_default_change_in_production',
  jwtRefreshSecret: process.env.JWT_REFRESH_SECRET || 'jwt_refresh_secret_default_change_in_production',
  jwtExpire: parseInt(process.env.JWT_EXPIRE) || 3600, // 1 hora - converte para número
  jwtRefreshExpire: parseInt(process.env.JWT_REFRESH_EXPIRE) || 604800, // 7 dias - converte para número
  corsOrigin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',').map(origin => origin.trim()) : ['http://localhost:3000', 'http://localhost:5173', 'http://localhost:80', 'http://localhost'],
  nodeEnv: process.env.NODE_ENV || 'development',
  // Configurações Asaas
  asaasApiKey: process.env.ASAAS_API_KEY || '',
  asaasBaseUrl: process.env.ASAAS_BASE_URL || 'https://api.asaas.com/v3',
  asaasWebhookToken: process.env.ASAAS_WEBHOOK_TOKEN || '',
  // Configurações Google OAuth
  googleClientId: process.env.GOOGLE_CLIENT_ID || '',
  googleClientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
  googleCallbackUrl: process.env.GOOGLE_CALLBACK_URL || 'http://localhost:3000/api/auth/google/callback',
  sessionSecret: process.env.SESSION_SECRET || 'session_secret_change_in_production',
  // Configurações Supabase
  supabaseUrl: process.env.SUPABASE_URL || '',
  supabaseKey: process.env.SUPABASE_ANON_KEY || '',
  supabaseServiceKey: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  // Configurações Webhook
  webhookUrl: process.env.WEBHOOK_URL || '',
  webhookToken: process.env.WEBHOOK_TOKEN || '',
  // Configurações API Externa de Créditos
  externalCreditsApiUrl: process.env.EXTERNAL_CREDITS_API_URL || '',
  externalCreditsApiToken: process.env.EXTERNAL_CREDITS_API_TOKEN || '',
  // Configurações PostgreSQL
  postgresHost: process.env.POSTGRES_HOST || 'localhost',
  postgresPort: process.env.POSTGRES_PORT || 5432,
  postgresDb: process.env.POSTGRES_DB || 'monique_db',
  postgresUser: process.env.POSTGRES_USER || 'postgres',
  postgresPassword: process.env.POSTGRES_PASSWORD || '',
};

