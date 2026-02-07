const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const session = require('express-session');
const config = require('./config/config');
const connectDB = require('./config/database');
const { testConnection, initializeTables, addAuthColumnsIfNeeded } = require('./config/postgres');
const passport = require('passport');

// Importar rotas
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const planRoutes = require('./routes/plans');
const transactionRoutes = require('./routes/transactions');
const webhookRoutes = require('./routes/webhooks');
const creditsRoutes = require('./routes/credits');
// const supabaseRoutes = require('./routes/supabase'); // Temporariamente comentado para testar contato

// Inicializar app
const app = express();

// Conectar e inicializar PostgreSQL (banco de dados principal)
// Executar migração de autenticação para PostgreSQL
(async () => {
  const connected = await testConnection();
  if (connected) {
    await initializeTables();
    await addAuthColumnsIfNeeded();
  } else {
    console.error('❌ Falha ao conectar ao PostgreSQL. A aplicação pode não funcionar corretamente.');
    console.log('⚠️  Continuando sem conexão com PostgreSQL para testes...');
    // process.exit(1); // Removido para permitir testes sem banco
  }
})();

// Conectar ao MongoDB apenas se configurado (opcional - para compatibilidade com User/OTPCode)
connectDB();

// Middlewares
app.use(cors({
  origin: config.corsOrigin,
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));

// Configurar sessão (necessário para Passport em alguns casos)
app.use(
  session({
    secret: config.sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: config.nodeEnv === 'production',
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000, // 24 horas
    },
  })
);

// Inicializar Passport
app.use(passport.initialize());
app.use(passport.session());

// Rotas
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/plans', planRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/webhooks', webhookRoutes);
app.use('/api/credits', creditsRoutes);
// app.use('/api/supabase', supabaseRoutes); // Temporariamente comentado para testar contato

// Rota de teste
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'Backend User Monique API está funcionando!',
    version: '1.0.0',
    endpoints: {
      auth: '/api/auth',
      users: '/api/users',
      plans: '/api/plans',
      transactions: '/api/transactions',
      webhooks: '/api/webhooks',
      credits: '/api/credits',
      supabase: '/api/supabase',
      health: '/health',
    },
  });
});
// Rota de health check
  app.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Servidor está saudável',
    timestamp: new Date().toISOString(),
  });
});
// Rota 404
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Rota não encontrada',
  });
});

// Middleware de tratamento de erros
app.use((err, req, res, next) => {
  console.error('Erro:', err);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Erro interno do servidor',
    ...(config.nodeEnv === 'development' && { stack: err.stack }),
  });
});

// Iniciar servidor
const PORT = config.port;
app.listen(PORT, () => {
  console.log(`\n🚀 Servidor rodando na porta ${PORT}`);
  console.log(`📡 Ambiente: ${config.nodeEnv}`);
  console.log(`🌐 API disponível em: http://localhost:${PORT}\n`);
});

module.exports = app;

