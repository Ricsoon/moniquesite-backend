const mongoose = require('mongoose');

/**
 * Conectar ao MongoDB (opcional - apenas se MONGODB_URI estiver configurado)
 * Se não estiver configurado, o Mongoose funcionará em modo desconectado
 * mas os modelos ainda podem ser usados para validação
 */
const connectDB = async () => {
  // Verificar se MONGODB_URI está configurado
  if (!process.env.MONGODB_URI) {
    console.log('⚠️  MONGODB_URI não configurado. MongoDB não será conectado.');
    console.log('ℹ️  PostgreSQL será usado como banco de dados principal.');
    return;
  }

  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    console.log(`✅ MongoDB Conectado: ${conn.connection.host}`);
  } catch (error) {
    console.error(`❌ Erro ao conectar ao MongoDB: ${error.message}`);
    console.warn('⚠️  Continuando sem conexão MongoDB. Certifique-se de que o PostgreSQL está configurado.');
    // Não fazer process.exit(1) para permitir que a aplicação continue apenas com Postgres
  }
};

module.exports = connectDB;

