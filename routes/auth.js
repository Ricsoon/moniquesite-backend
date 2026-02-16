const express = require('express');
const router = express.Router();
const passport = require('passport');
const axios = require('axios');
const userPostgresService = require('../services/userPostgresService');
const planPostgresService = require('../services/planPostgresService');
const moniqueApiService = require('../services/moniqueApiService');
const { generateAccessToken, generateRefreshToken } = require('../utils/jwt');
const { authenticate } = require('../middleware/auth');

// Inicializar Passport
require('../config/passport');

// @route   GET /api/auth/google
// @desc    Iniciar autenticação com Google
// @access  Public
router.get(
  '/google',
  passport.authenticate('google', {
    scope: ['profile', 'email'],
  })
);

// @route   GET /api/auth/google/callback
// @desc    Callback do Google OAuth
// @access  Public
router.get(
  '/google/callback',
  passport.authenticate('google', { session: false, failureRedirect: '/login?error=auth_failed' }),
  async (req, res) => {
    try {
      const user = req.user;

      if (!user || !user.is_active) {
        const frontendUrl = process.env.FRONTEND_URL || (process.env.NODE_ENV === 'production' ? 'http://localhost:80' : 'http://localhost:3000');
        return res.redirect(`${frontendUrl}/auth/callback?error=user_inactive`);
      }

      // Gerar tokens JWT
      const accessToken = generateAccessToken(user.id);
      const refreshToken = generateRefreshToken(user.id);

      // Redirecionar para o frontend com tokens
      const frontendUrl = process.env.FRONTEND_URL || (process.env.NODE_ENV === 'production' ? 'http://localhost:80' : 'http://localhost:3000');
      const redirectUrl = `${frontendUrl}/auth/callback?token=${accessToken}&refreshToken=${refreshToken}`;

      res.redirect(redirectUrl);
    } catch (error) {
      console.error('Erro no callback do Google:', error);
      const frontendUrl = process.env.FRONTEND_URL || (process.env.NODE_ENV === 'production' ? 'http://localhost:80' : 'http://localhost:3000');
      res.redirect(`${frontendUrl}/auth/callback?error=server_error`);
    }
  }
);

// @route   POST /api/auth/google/token
// @desc    Obter tokens JWT após autenticação Google (alternativa ao redirect)
// @access  Public
router.post('/google/token', async (req, res) => {
  try {
    const { googleToken } = req.body;

    if (!googleToken) {
      return res.status(400).json({
        success: false,
        message: 'Token do Google é obrigatório',
      });
    }

    // Verificar token do Google (usando Google API)
    const googleResponse = await axios.get(`https://www.googleapis.com/oauth2/v3/userinfo`, {
      headers: {
        Authorization: `Bearer ${googleToken}`,
      },
    });

    const googleUser = googleResponse.data;

    // Buscar ou criar usuário
    let user = await userPostgresService.findUserByGoogleId(googleUser.sub);

    if (!user) {
      // Verificar se existe pelo email
      user = await userPostgresService.findUserByEmail(googleUser.email);

      if (user) {
        // Adicionar googleId ao usuário existente
        user = await userPostgresService.updateUserWithGoogleData(user.id, {
          googleId: googleUser.sub,
          name: googleUser.name,
          email: googleUser.email,
          picture: googleUser.picture || null
        });
      } else {
        // Criar novo usuário
        user = await userPostgresService.createUserWithGoogle({
          googleId: googleUser.sub,
          name: googleUser.name,
          email: googleUser.email,
          picture: googleUser.picture || null
        });
      }
    } else {
      // Atualizar dados se necessário
      if (googleUser.picture && user.picture !== googleUser.picture) {
        user = await userPostgresService.updateUserWithGoogleData(user.id, {
          googleId: googleUser.sub,
          name: googleUser.name,
          email: googleUser.email,
          picture: googleUser.picture
        });
      }
    }

    if (!user.is_active) {
      return res.status(401).json({
        success: false,
        message: 'Usuário inativo. Entre em contato com o suporte.',
      });
    }

    // Sincronizar plano se possível
    if (user.n8n_user_id) {
      try {
        const planData = await moniqueApiService.getUserPlan(user.n8n_user_id);
        if (planData) {
          const localPlan = await planPostgresService.syncPlanFromApi(planData);
          if (localPlan && localPlan.id !== user.active_plan) {
            await userPostgresService.createOrUpdateUser({
              user_id: user.n8n_user_id,
              active_plan: localPlan.id
            });
            user.active_plan = localPlan.id; // Atualizar para o token/resposta
          }
        }
      } catch (err) {
        console.error('[AUTH] Erro ao sincronizar plano no login:', err);
      }
    }

    // Buscar detalhes do plano ativo
    let activePlan = null;
    if (user && user.active_plan) {
      try {
        const planId = parseInt(user.active_plan);
        if (!isNaN(planId)) {
          activePlan = await planPostgresService.findPlanById(planId);
        }
      } catch (error) {
        console.error('Erro ao buscar plano ativo:', error);
      }
    }

    // Gerar tokens JWT
    const accessToken = generateAccessToken(user.id);
    const refreshToken = generateRefreshToken(user.id);

    res.json({
      success: true,
      message: 'Login realizado com sucesso',
      data: {
        user: {
          id: user.id,
          name: user.nome,
          email: user.email,
          picture: user.picture,
          phone: user.telefone,
          cpfCnpj: user.cpfCnpj || user.cpf_cnpj,
          role: user.role,
          activePlan: activePlan ? {
            id: activePlan.id,
            name: activePlan.name,
            description: activePlan.description,
            price: activePlan.price,
            duration: activePlan.duration,
            duration_unit: activePlan.duration_unit || activePlan.durationUnit,
            features: activePlan.features,
          } : null,
          planStartDate: user.plan_start_date,
          planEndDate: user.plan_end_date,
          credits: user.has_unlimited_credits ? 'unlimited' : user.credits,
          creditsUsed: user.credits_used || 0,
          hasUnlimitedCredits: user.has_unlimited_credits,
        },
        accessToken,
        refreshToken,
      },
    });
  } catch (error) {
    console.error('Erro ao autenticar com Google:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao autenticar com Google',
      error: error.message,
    });
  }
});

// @route   POST /api/auth/refresh
// @desc    Renovar token de acesso
// @access  Public
router.post(
  '/refresh',
  async (req, res) => {
    try {
      const { refreshToken } = req.body;

      if (!refreshToken) {
        return res.status(400).json({
          success: false,
          message: 'Refresh token é obrigatório',
        });
      }

      const { verifyRefreshToken } = require('../utils/jwt');
      const decoded = verifyRefreshToken(refreshToken);

      // Buscar usuário do PostgreSQL
      const user = await userPostgresService.findUserById(parseInt(decoded.id));

      if (!user || !user.is_active) {
        return res.status(401).json({
          success: false,
          message: 'Token inválido ou usuário inativo',
        });
      }

      // Gerar novo token de acesso
      const accessToken = generateAccessToken(user.id);

      res.json({
        success: true,
        data: {
          accessToken,
        },
      });
    } catch (error) {
      res.status(401).json({
        success: false,
        message: 'Token de refresh inválido ou expirado',
      });
    }
  }
);

// @route   GET /api/auth/me
// @desc    Obter dados do usuário autenticado
// @access  Private
router.get('/me', authenticate, async (req, res) => {
  try {
    const user = await userPostgresService.findUserById(req.user.id);

    // Popular activePlan do Postgres se existir
    let activePlan = null;
    if (user && user.active_plan) {
      try {
        const planId = parseInt(user.active_plan);
        if (!isNaN(planId)) {
          activePlan = await planPostgresService.findPlanById(planId);
        }
      } catch (error) {
        console.error('Erro ao buscar plano ativo:', error);
      }
    }

    // Verificação e sincronização de plano com API externa se tiver n8n_user_id
    if (user && user.n8n_user_id) {
      try {
        // Buscar plano na API
        const planData = await moniqueApiService.getUserPlan(user.n8n_user_id);
        if (planData) {
          // Sincronizar localmente
          const localPlan = await planPostgresService.syncPlanFromApi(planData);

          // Se o plano mudou ou não estava setado, atualizar usuário
          if (localPlan && localPlan.id !== user.active_plan) {
            console.log(`[AUTH] Atualizando plano do usuário ${user.id} para ${localPlan.name} (ID: ${localPlan.id})`);
            await userPostgresService.createOrUpdateUser({
              user_id: user.n8n_user_id,
              active_plan: localPlan.id
            });

            // Atualizar objeto user local para refletir na resposta
            user.active_plan = localPlan.id;

            // Atualizar objeto activePlan para resposta
            activePlan = {
              id: localPlan.id,
              name: localPlan.name,
              description: localPlan.description,
              price: localPlan.price,
              duration: localPlan.duration,
              duration_unit: localPlan.durationUnit, // Note a diferença de casing no retorno do service vs DB
              features: localPlan.features,
            };
          }
        }
      } catch (syncErr) {
        console.error('[AUTH] Erro ao sincronizar plano no /me:', syncErr);
      }
    }

    res.json({
      success: true,
      data: {
        user: {
          id: user.id,
          name: user.nome,
          email: user.email,
          picture: user.picture,
          phone: user.telefone,
          cpfCnpj: user.cpfCnpj || user.cpf_cnpj,
          role: user.role,
          activePlan: activePlan ? {
            id: activePlan.id,
            name: activePlan.name,
            description: activePlan.description,
            price: activePlan.price,
            duration: activePlan.duration,
            duration_unit: activePlan.duration_unit || activePlan.durationUnit,
            features: activePlan.features,
          } : null,
          plan_start_date: user.plan_start_date,
          plan_end_date: user.plan_end_date,
          credits: user.has_unlimited_credits ? 'unlimited' : user.credits,
          creditsUsed: user.credits_used || 0,
          hasUnlimitedCredits: user.has_unlimited_credits,
          createdAt: user.createdAt,
        },
      },
    });
  } catch (error) {
    console.error('Erro ao buscar usuário:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao buscar dados do usuário',
      error: error.message,
    });
  }
});

// @route   POST /api/auth/logout
// @desc    Logout (apenas informativo, já que usamos JWT stateless)
// @access  Private
router.post('/logout', authenticate, async (req, res) => {
  try {
    // Com JWT stateless, o logout é feito no frontend removendo o token
    // Este endpoint é apenas informativo
    res.json({
      success: true,
      message: 'Logout realizado com sucesso. Remova o token no frontend.',
    });
  } catch (error) {
    console.error('Erro ao fazer logout:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao fazer logout',
      error: error.message,
    });
  }
});

module.exports = router;
