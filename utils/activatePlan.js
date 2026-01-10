const calculatePlanDates = require('./calculatePlanDates');
const supabaseService = require('../services/supabaseService');

/**
 * Ativar plano para um usuário e atribuir créditos
 */
const activatePlan = async (user, plan) => {
  const { startDate, endDate } = calculatePlanDates(
    plan.duration,
    plan.durationUnit
  );

  user.activePlan = plan._id;
  user.planStartDate = startDate;
  user.planEndDate = endDate;

  // Atribuir créditos baseado no plano
  if (plan.isUnlimited || plan.credits === null) {
    // Plano ilimitado
    user.hasUnlimitedCredits = true;
    user.credits = 0; // Não precisa armazenar créditos se for ilimitado
  } else {
    // Plano com créditos limitados
    user.hasUnlimitedCredits = false;
    // Se o usuário já tinha créditos, adiciona os novos créditos
    // Caso contrário, define os créditos do plano
    if (user.credits === 0 || !user.credits) {
      user.credits = plan.credits;
    } else {
      // Adiciona créditos ao saldo existente
      user.credits += plan.credits;
    }
  }

  await user.save();

  // Sincronizar créditos com Supabase
  try {
    // Buscar usuário no Supabase
    let supabaseUser = null;
    if (user.googleId) {
      supabaseUser = await supabaseService.findUserByGoogleId(user.googleId);
    }
    
    if (!supabaseUser && user.email) {
      supabaseUser = await supabaseService.findUserByEmail(user.email);
    }

    if (supabaseUser) {
      if (plan.isUnlimited || plan.credits === null) {
        // Definir créditos ilimitados no Supabase
        await supabaseService.setUnlimitedCredits(supabaseUser.id);
      } else {
        // Adicionar créditos no Supabase
        await supabaseService.addCredits(supabaseUser.id, plan.credits, 'plan_activation');
      }
    } else {
      console.warn(`Usuário não encontrado no Supabase para sincronizar créditos. Email: ${user.email}, GoogleId: ${user.googleId}`);
    }
  } catch (supabaseError) {
    console.error('Erro ao sincronizar créditos com Supabase:', supabaseError);
    // Não falhar a ativação do plano se houver erro no Supabase
  }

  return user;
};

module.exports = activatePlan;

