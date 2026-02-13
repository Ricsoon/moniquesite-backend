const dotenv = require('dotenv');
const planPostgresService = require('../services/planPostgresService');
const { testConnection } = require('../config/postgres');

dotenv.config();

// Valores esperados dos planos
const EXPECTED_PLANS = {
  'Gratuito': { price: 0, id: null },
  'Pro': { price: 50, id: null },
  'Ilimitado': { price: 200, id: null }
};

async function validatePlans() {
  try {
    console.log('🔍 Validando planos no banco de dados...\n');

    // Testar conexão
    const connected = await testConnection();
    if (!connected) {
      console.error('❌ Erro ao conectar ao PostgreSQL');
      process.exit(1);
    }

    // Buscar todos os planos ativos
    const result = await planPostgresService.listPlans({ isActive: true });
    const plans = result.plans;

    console.log(`📋 Encontrados ${plans.length} planos ativos:\n`);

    let allValid = true;
    const validationResults = [];

    for (const plan of plans) {
      const expected = EXPECTED_PLANS[plan.name];
      const isValid = expected && Math.abs(plan.price - expected.price) < 0.01;

      validationResults.push({
        name: plan.name,
        id: plan.id,
        expectedPrice: expected?.price ?? 'N/A',
        actualPrice: plan.price,
        isValid,
      });

      if (expected) {
        EXPECTED_PLANS[plan.name].id = plan.id;
      }

      const status = isValid ? '✅' : '❌';
      console.log(`${status} ${plan.name} (ID: ${plan.id})`);
      console.log(`   Valor esperado: R$ ${expected?.price ?? 'N/A'}`);
      console.log(`   Valor atual: R$ ${plan.price}`);
      
      if (!isValid) {
        console.log(`   ⚠️  VALOR INCORRETO!`);
        allValid = false;
      }
      console.log('');
    }

    // Verificar se todos os planos esperados existem
    console.log('\n📊 Resumo da validação:\n');
    
    for (const [planName, expected] of Object.entries(EXPECTED_PLANS)) {
      if (!expected.id) {
        console.log(`❌ Plano "${planName}" não encontrado no banco de dados`);
        allValid = false;
      } else {
        console.log(`✅ Plano "${planName}" encontrado (ID: ${expected.id}, Valor: R$ ${expected.price})`);
      }
    }

    // Verificar IDs sequenciais (opcional)
    console.log('\n🔢 Verificando IDs dos planos:\n');
    const planIds = plans.map(p => p.id).sort((a, b) => a - b);
    console.log(`IDs encontrados: ${planIds.join(', ')}`);
    
    // Mapeamento esperado: 1=Gratuito, 2=Pro, 3=Ilimitado
    const idMapping = {
      1: 'Gratuito',
      2: 'Pro',
      3: 'Ilimitado'
    };

    for (const id of planIds) {
      const plan = plans.find(p => p.id === id);
      const expectedName = idMapping[id];
      if (expectedName && plan.name !== expectedName) {
        console.log(`⚠️  AVISO: ID ${id} está associado a "${plan.name}", mas esperava "${expectedName}"`);
      }
    }

    console.log('\n' + '='.repeat(50));
    if (allValid) {
      console.log('✅ TODOS OS PLANOS ESTÃO VÁLIDOS!');
      console.log('\n📝 Mapeamento de IDs para uso no frontend:');
      console.log('   Gratuito: ID 1 (R$ 0)');
      console.log('   Pro: ID 2 (R$ 50)');
      console.log('   Ilimitado: ID 3 (R$ 200)');
    } else {
      console.log('❌ ALGUNS PLANOS ESTÃO INVÁLIDOS!');
      console.log('   Verifique os valores acima e execute o seed novamente se necessário:');
      console.log('   npm run seed:plans');
    }
    console.log('='.repeat(50) + '\n');

    process.exit(allValid ? 0 : 1);
  } catch (error) {
    console.error('❌ Erro ao validar planos:', error);
    process.exit(1);
  }
}

// Executar validação
validatePlans();

