const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const User = require('../models/User');
const planPostgresService = require('../services/planPostgresService');
const config = require('./config');

// Configurar estratégia Google OAuth
passport.use(
  new GoogleStrategy(
    {
      clientID: config.googleClientId,
      clientSecret: config.googleClientSecret,
      callbackURL: config.googleCallbackUrl,
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        // Verificar se usuário já existe pelo googleId
        let user = await User.findOne({ googleId: profile.id });

        if (user) {
          // Usuário existe, atualizar dados se necessário
          if (user.email !== profile.emails[0].value) {
            user.email = profile.emails[0].value;
          }
          if (user.name !== profile.displayName) {
            user.name = profile.displayName;
          }
          if (profile.photos && profile.photos[0] && user.picture !== profile.photos[0].value) {
            user.picture = profile.photos[0].value;
          }
          await user.save();
          return done(null, user);
        }

        // Verificar se usuário existe pelo email (caso tenha se cadastrado antes)
        user = await User.findOne({ email: profile.emails[0].value });

        if (user) {
          // Usuário existe mas não tem googleId, adicionar
          user.googleId = profile.id;
          if (profile.photos && profile.photos[0]) {
            user.picture = profile.photos[0].value;
          }
          await user.save();
          return done(null, user);
        }

        // Criar novo usuário com plano gratuito
        // Buscar plano gratuito do Postgres
        const freePlan = await planPostgresService.findPlanByName('Gratuito');

        user = new User({
          googleId: profile.id,
          name: profile.displayName,
          email: profile.emails[0].value,
          picture: profile.photos && profile.photos[0] ? profile.photos[0].value : null,
          isActive: true,
        });

        // Se plano gratuito existe, atribuir ao novo usuário
        // Nota: Planos estão no Postgres (ID numérico), User está no MongoDB (usa string)
        // Converter ID numérico do Postgres para string para compatibilidade com User
        if (freePlan) {
          user.activePlan = freePlan.id.toString(); // Converter ID numérico para string
          user.planStartDate = new Date();
          const endDate = new Date();
          endDate.setMonth(endDate.getMonth() + 1);
          user.planEndDate = endDate;
          user.credits = freePlan.credits || 200;
          user.hasUnlimitedCredits = freePlan.isUnlimited || false;
        } else {
          // Se não encontrar plano gratuito, dar 200 créditos padrão
          user.credits = 200;
          user.hasUnlimitedCredits = false;
        }

        await user.save();

        return done(null, user);
      } catch (error) {
        console.error('Erro na estratégia Google OAuth:', error);
        return done(error, null);
      }
    }
  )
);

// Serializar usuário para sessão
passport.serializeUser((user, done) => {
  done(null, user._id);
});

// Deserializar usuário da sessão
passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findById(id);
    done(null, user);
  } catch (error) {
    done(error, null);
  }
});

module.exports = passport;

