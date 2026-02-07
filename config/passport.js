const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const userPostgresService = require('../services/userPostgresService');
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
        let user = await userPostgresService.findUserByGoogleId(profile.id);

        if (user) {
          // Usuário existe, atualizar dados se necessário
          user = await userPostgresService.updateUserWithGoogleData(user.id, {
            googleId: profile.id,
            name: profile.displayName,
            email: profile.emails[0].value,
            picture: profile.photos && profile.photos[0] ? profile.photos[0].value : null
          });
          return done(null, user);
        }

        // Verificar se usuário existe pelo email (caso tenha se cadastrado antes)
        user = await userPostgresService.findUserByEmail(profile.emails[0].value);

        if (user) {
          // Usuário existe mas não tem googleId, adicionar
          user = await userPostgresService.updateUserWithGoogleData(user.id, {
            googleId: profile.id,
            name: profile.displayName,
            email: profile.emails[0].value,
            picture: profile.photos && profile.photos[0] ? profile.photos[0].value : null
          });
          return done(null, user);
        }

        // Criar novo usuário com plano gratuito
        const freePlan = await planPostgresService.findPlanByName('Gratuito');

        const newUser = await userPostgresService.createUserWithGoogle({
          googleId: profile.id,
          name: profile.displayName,
          email: profile.emails[0].value,
          picture: profile.photos && profile.photos[0] ? profile.photos[0].value : null
        });

        return done(null, newUser);
      } catch (error) {
        console.error('Erro na estratégia Google OAuth:', error);
        return done(error);
      }
    }
  )
);

// Serializar usuário (necessário para sessão)
passport.serializeUser((user, done) => {
  done(null, user.id);
});

// Desserializar usuário
passport.deserializeUser(async (id, done) => {
  try {
    const user = await userPostgresService.findUserById(id);
    done(null, user);
  } catch (error) {
    done(error);
  }
});

module.exports = passport;
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

