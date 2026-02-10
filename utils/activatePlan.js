const calculatePlanDates = require('./calculatePlanDates');
const supabaseService = require('../services/supabaseService');
const userPostgresService = require('../services/userPostgresService');

/**
 * Ativar plano para um usuário e atribuir créditos
 */
const activatePlan = async (user, plan) => {
  const { startDate, endDate } = calculatePlanDates(
    plan.duration,
    plan.duration_unit
  );

  // Preparar dados para atualização
  const updateData = {
    active_plan: plan.id,
    plan_start_date: startDate,
    plan_end_date: endDate,
  };

  // Atribuir créditos baseado no plano
  if (plan.is_unlimited || plan.credits === null) {
    // Plano ilimitado
    updateData.has_unlimited_credits = true;
    updateData.credits = 0;
  } else {
    // Plano com créditos limitados
    updateData.has_unlimited_credits = false;
    // Se o usuário já tinha créditos, adiciona os novos créditos
    if (user.credits === 0 || !user.credits) {
      updateData.credits = plan.credits;
    } else {
      // Adiciona créditos ao saldo existente
      updateData.credits = user.credits + plan.credits;
    }
  }

  // Atualizar usuário no PostgreSQL
  const updatedUser = await userPostgresService.updateUserPlan(
    user.id,
    updateData.active_plan,
    updateData.plan_start_date,
    updateData.plan_end_date,
    updateData.credits,
    updateData.has_unlimited_credits
  );

  // Sincronizar créditos com Supabase
  try {
    // Buscar usuário no Supabase
    let supabaseUser = null;
    if (user.google_id) {
      supabaseUser = await supabaseService.findUserByGoogleId(user.google_id);
    }
    
    if (!supabaseUser && user.email) {
      supabaseUser = await supabaseService.findUserByEmail(user.email);
    }

    if (supabaseUser) {
      if (plan.is_unlimited || plan.credits === null) {
        // Definir créditos ilimitados no Supabase
        await supabaseService.setUnlimitedCredits(supabaseUser.id);
      } else {
        // Adicionar créditos no Supabase
        await supabaseService.addCredits(supabaseUser.id, plan.credits, 'plan_activation');
      }
    } else {
      console.warn(`Usuário não encontrado no Supabase para sincronizar créditos. Email: ${user.email}, GoogleId: ${user.google_id}`);
    }
  } catch (supabaseError) {
    console.error('Erro ao sincronizar créditos com Supabase:', supabaseError);
    // Não falhar a ativação do plano se houver erro no Supabase
  }

  return user;
};

module.exports = activatePlan;

