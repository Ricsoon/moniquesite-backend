const { createClient } = require('@supabase/supabase-js');
const config = require('../config/config');

// Cliente Supabase com service role key (para operações administrativas)
const supabase = createClient(config.supabaseUrl, config.supabaseServiceKey || config.supabaseKey);

/**
 * Buscar usuário no Supabase pelo token OAuth do Google
 */
const findUserByGoogleToken = async (googleToken) => {
  try {
    // Buscar usuário na tabela de usuários pelo token do Google
    // Assumindo que a tabela tem uma coluna 'google_token' ou similar
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('google_token', googleToken)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // Nenhum registro encontrado
        return null;
      }
      throw error;
    }

    return data;
  } catch (error) {
    console.error('Erro ao buscar usuário no Supabase:', error);
    throw error;
  }
};

/**
 * Buscar usuário no Supabase pelo Google ID
 */
const findUserByGoogleId = async (googleId) => {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('google_id', googleId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      throw error;
    }

    return data;
  } catch (error) {
    console.error('Erro ao buscar usuário por Google ID no Supabase:', error);
    throw error;
  }
};

/**
 * Buscar usuário no Supabase pelo email
 */
const findUserByEmail = async (email) => {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('email', email)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      throw error;
    }

    return data;
  } catch (error) {
    console.error('Erro ao buscar usuário por email no Supabase:', error);
    throw error;
  }
};

/**
 * Obter saldo de créditos do usuário no Supabase
 */
const getCreditsBalance = async (userId) => {
  try {
    const { data, error } = await supabase
      .from('credits')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // Nenhum registro encontrado, retornar valores padrão
        return {
          credits: 0,
          credits_used: 0,
          has_unlimited: false,
        };
      }
      throw error;
    }

    return data;
  } catch (error) {
    console.error('Erro ao buscar saldo de créditos no Supabase:', error);
    throw error;
  }
};

/**
 * Adicionar créditos ao usuário no Supabase
 */
const addCredits = async (userId, amount, reason = 'plan_purchase') => {
  try {
    // Primeiro, buscar o saldo atual
    const currentBalance = await getCreditsBalance(userId);

    // Calcular novo saldo
    const newCredits = (currentBalance.credits || 0) + amount;

    // Inserir ou atualizar registro de créditos
    const { data, error } = await supabase
      .from('credits')
      .upsert({
        user_id: userId,
        credits: newCredits,
        credits_used: currentBalance.credits_used || 0,
        has_unlimited: false,
        last_updated: new Date().toISOString(),
      }, {
        onConflict: 'user_id',
      })
      .select()
      .single();

    if (error) {
      throw error;
    }

    // Registrar histórico de transação de créditos
    await supabase
      .from('credit_transactions')
      .insert({
        user_id: userId,
        amount: amount,
        type: 'credit',
        reason: reason,
        balance_before: currentBalance.credits || 0,
        balance_after: newCredits,
        created_at: new Date().toISOString(),
      });

    return data;
  } catch (error) {
    console.error('Erro ao adicionar créditos no Supabase:', error);
    throw error;
  }
};

/**
 * Consumir créditos do usuário no Supabase
 */
const consumeCredits = async (userId, amount) => {
  try {
    // Buscar saldo atual
    const currentBalance = await getCreditsBalance(userId);

    // Verificar se tem créditos ilimitados
    if (currentBalance.has_unlimited) {
      // Apenas incrementar créditos utilizados
      const { data, error } = await supabase
        .from('credits')
        .upsert({
          user_id: userId,
          credits: 0,
          credits_used: (currentBalance.credits_used || 0) + amount,
          has_unlimited: true,
          last_updated: new Date().toISOString(),
        }, {
          onConflict: 'user_id',
        })
        .select()
        .single();

      if (error) throw error;

      // Registrar transação
      await supabase
        .from('credit_transactions')
        .insert({
          user_id: userId,
          amount: amount,
          type: 'debit',
          reason: 'usage',
          balance_before: 'unlimited',
          balance_after: 'unlimited',
          created_at: new Date().toISOString(),
        });

      return data;
    }

    // Verificar se tem créditos suficientes
    if ((currentBalance.credits || 0) < amount) {
      throw new Error('Créditos insuficientes');
    }

    // Calcular novo saldo
    const newCredits = (currentBalance.credits || 0) - amount;
    const newCreditsUsed = (currentBalance.credits_used || 0) + amount;

    // Atualizar créditos
    const { data, error } = await supabase
      .from('credits')
      .upsert({
        user_id: userId,
        credits: newCredits,
        credits_used: newCreditsUsed,
        has_unlimited: false,
        last_updated: new Date().toISOString(),
      }, {
        onConflict: 'user_id',
      })
      .select()
      .single();

    if (error) {
      throw error;
    }

    // Registrar transação
    await supabase
      .from('credit_transactions')
      .insert({
        user_id: userId,
        amount: amount,
        type: 'debit',
        reason: 'usage',
        balance_before: currentBalance.credits || 0,
        balance_after: newCredits,
        created_at: new Date().toISOString(),
      });

    return data;
  } catch (error) {
    console.error('Erro ao consumir créditos no Supabase:', error);
    throw error;
  }
};

/**
 * Definir créditos ilimitados para o usuário
 */
const setUnlimitedCredits = async (userId) => {
  try {
    const { data, error } = await supabase
      .from('credits')
      .upsert({
        user_id: userId,
        credits: 0,
        credits_used: 0,
        has_unlimited: true,
        last_updated: new Date().toISOString(),
      }, {
        onConflict: 'user_id',
      })
      .select()
      .single();

    if (error) {
      throw error;
    }

    // Registrar transação
    await supabase
      .from('credit_transactions')
      .insert({
        user_id: userId,
        amount: 0,
        type: 'credit',
        reason: 'unlimited_plan',
        balance_before: 'limited',
        balance_after: 'unlimited',
        created_at: new Date().toISOString(),
      });

    return data;
  } catch (error) {
    console.error('Erro ao definir créditos ilimitados no Supabase:', error);
    throw error;
  }
};

/**
 * Sincronizar créditos do MongoDB para o Supabase
 */
const syncCreditsToSupabase = async (userId, credits, creditsUsed, hasUnlimited) => {
  try {
    const { data, error } = await supabase
      .from('credits')
      .upsert({
        user_id: userId,
        credits: hasUnlimited ? 0 : credits,
        credits_used: creditsUsed || 0,
        has_unlimited: hasUnlimited || false,
        last_updated: new Date().toISOString(),
      }, {
        onConflict: 'user_id',
      })
      .select()
      .single();

    if (error) {
      throw error;
    }

    return data;
  } catch (error) {
    console.error('Erro ao sincronizar créditos para Supabase:', error);
    throw error;
  }
};

module.exports = {
  supabase,
  findUserByGoogleToken,
  findUserByGoogleId,
  findUserByEmail,
  getCreditsBalance,
  addCredits,
  consumeCredits,
  setUnlimitedCredits,
  syncCreditsToSupabase,
};

