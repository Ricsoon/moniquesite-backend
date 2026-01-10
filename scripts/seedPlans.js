const dotenv = require('dotenv');
const planPostgresService = require('../services/planPostgresService');
const { testConnection } = require('../config/postgres');

dotenv.config();

const plans = [
  {
    name: 'Gratuito',
    description: 'Plano gratuito com 200 créditos para começar a usar a assistente pessoal',
    price: 0,
    duration: 1,
    durationUnit: 'months',
    credits: 200,
    isUnlimited: false,
    features: [
      '200 créditos mensais',
      'Acesso à assistente pessoal',
      'Suporte básico',
    ],
    isActive: true,
  },
  {
    name: 'Pro',
    description: 'Plano Pro com 600 créditos mensais para uso intensivo',
    price: 50,
    duration: 1,
    durationUnit: 'months',
    credits: 600,
    isUnlimited: false,
    features: [
      '600 créditos mensais',
      'Acesso à assistente pessoal',
      'Suporte prioritário',
      'Recursos avançados',
    ],
    isActive: true,
  },
  {
    name: 'Ilimitado',
    description: 'Plano Ilimitado com créditos ilimitados para uso sem restrições',
    price: 200,
    duration: 1,
    durationUnit: 'months',
    credits: null, // null = ilimitado
    isUnlimited: true,
    features: [
      'Créditos ilimitados',
      'Acesso completo à assistente pessoal',
      'Suporte premium 24/7',
      'Todos os recursos avançados',
      'Sem limites de uso',
    ],
    isActive: true,
  },
];

async function seedPlans() {
  try {
    // Testar conexão com PostgreSQL
    const connected = await testConnection();
    if (!connected) {
      console.error('❌ Erro ao conectar ao PostgreSQL');
      process.exit(1);
    }

    console.log('🌱 Iniciando seed dos planos...\n');

    for (const planData of plans) {
      // Verificar se plano já existe
      const existingPlan = await planPostgresService.findPlanByName(planData.name);

      if (existingPlan) {
        console.log(`⚠️  Plano "${planData.name}" já existe. Atualizando...`);
        // Atualizar plano existente
        await planPostgresService.updatePlan(existingPlan.id, planData);
        console.log(`✅ Plano "${planData.name}" atualizado com sucesso!`);
      } else {
        // Criar novo plano
        await planPostgresService.createPlan(planData);
        console.log(`✅ Plano "${planData.name}" criado com sucesso!`);
      }
    }

    console.log('\n✨ Seed dos planos concluído com sucesso!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Erro ao fazer seed dos planos:', error);
    process.exit(1);
  }
}

// Executar seed
seedPlans();

