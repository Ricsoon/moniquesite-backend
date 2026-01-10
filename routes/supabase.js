const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const { authenticate } = require('../middleware/auth');
const validate = require('../middleware/validation');
const supabaseService = require('../services/supabaseService');
const User = require('../models/User');

// @route   POST /api/supabase/sync-credits
// @desc    Sincronizar créditos do MongoDB para Supabase
// @access  Private
router.post(
  '/sync-credits',
  authenticate,
  async (req, res) => {
    try {
      const user = await User.findById(req.user._id);

      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'Usuário não encontrado',
        });
      }

      // Buscar usuário no Supabase
      let supabaseUser = null;
      if (user.googleId) {
        supabaseUser = await supabaseService.findUserByGoogleId(user.googleId);
      }
      
      if (!supabaseUser && user.email) {
        supabaseUser = await supabaseService.findUserByEmail(user.email);
      }

      if (!supabaseUser) {
        return res.status(404).json({
          success: false,
          message: 'Usuário não encontrado no Supabase',
        });
      }

      // Sincronizar créditos
      await supabaseService.syncCreditsToSupabase(
        supabaseUser.id,
        user.credits,
        user.creditsUsed || 0,
        user.hasUnlimitedCredits
      );

      res.json({
        success: true,
        message: 'Créditos sincronizados com sucesso',
        data: {
          userId: user._id,
          supabaseUserId: supabaseUser.id,
          credits: user.hasUnlimitedCredits ? 'unlimited' : user.credits,
          creditsUsed: user.creditsUsed || 0,
        },
      });
    } catch (error) {
      console.error('Erro ao sincronizar créditos:', error);
      res.status(500).json({
        success: false,
        message: 'Erro ao sincronizar créditos',
        error: error.message,
      });
    }
  }
);

// @route   GET /api/supabase/balance
// @desc    Obter saldo de créditos do Supabase
// @access  Private
router.get('/balance', authenticate, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Usuário não encontrado',
      });
    }

    // Buscar usuário no Supabase
    let supabaseUser = null;
    if (user.googleId) {
      supabaseUser = await supabaseService.findUserByGoogleId(user.googleId);
    }
    
    if (!supabaseUser && user.email) {
      supabaseUser = await supabaseService.findUserByEmail(user.email);
    }

    if (!supabaseUser) {
      return res.status(404).json({
        success: false,
        message: 'Usuário não encontrado no Supabase',
      });
    }

    // Buscar saldo no Supabase
    const balance = await supabaseService.getCreditsBalance(supabaseUser.id);

    res.json({
      success: true,
      data: {
        credits: balance.has_unlimited ? 'unlimited' : balance.credits,
        creditsUsed: balance.credits_used || 0,
        hasUnlimitedCredits: balance.has_unlimited || false,
        lastUpdated: balance.last_updated,
      },
    });
  } catch (error) {
    console.error('Erro ao buscar saldo no Supabase:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao buscar saldo no Supabase',
      error: error.message,
    });
  }
});

// @route   POST /api/supabase/find-user
// @desc    Buscar usuário no Supabase pelo token do Google
// @access  Private
router.post(
  '/find-user',
  authenticate,
  [
    body('googleToken')
      .optional()
      .trim(),
    body('googleId')
      .optional()
      .trim(),
    body('email')
      .optional()
      .isEmail()
      .withMessage('Email inválido'),
  ],
  validate,
  async (req, res) => {
    try {
      const { googleToken, googleId, email } = req.body;

      let supabaseUser = null;

      if (googleToken) {
        supabaseUser = await supabaseService.findUserByGoogleToken(googleToken);
      } else if (googleId) {
        supabaseUser = await supabaseService.findUserByGoogleId(googleId);
      } else if (email) {
        supabaseUser = await supabaseService.findUserByEmail(email);
      } else {
        return res.status(400).json({
          success: false,
          message: 'É necessário fornecer googleToken, googleId ou email',
        });
      }

      if (!supabaseUser) {
        return res.status(404).json({
          success: false,
          message: 'Usuário não encontrado no Supabase',
        });
      }

      // Buscar saldo de créditos
      const balance = await supabaseService.getCreditsBalance(supabaseUser.id);

      res.json({
        success: true,
        data: {
          user: {
            id: supabaseUser.id,
            email: supabaseUser.email,
            googleId: supabaseUser.google_id,
          },
          credits: {
            credits: balance.has_unlimited ? 'unlimited' : balance.credits,
            creditsUsed: balance.credits_used || 0,
            hasUnlimitedCredits: balance.has_unlimited || false,
          },
        },
      });
    } catch (error) {
      console.error('Erro ao buscar usuário no Supabase:', error);
      res.status(500).json({
        success: false,
        message: 'Erro ao buscar usuário no Supabase',
        error: error.message,
      });
    }
  }
);

module.exports = router;

