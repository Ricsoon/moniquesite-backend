const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Nome é obrigatório'],
    trim: true,
  },
  email: {
    type: String,
    required: [true, 'Email é obrigatório'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^\S+@\S+\.\S+$/, 'Email inválido'],
  },
  googleId: {
    type: String,
    unique: true,
    sparse: true,
    trim: true,
  },
  password: {
    type: String,
    required: false, // Senha não é obrigatória quando login é via Google
    minlength: [6, 'Senha deve ter no mínimo 6 caracteres'],
    select: false, // Não retornar senha por padrão
  },
  picture: {
    type: String,
    trim: true,
    default: null,
  },
  phone: {
    type: String,
    trim: true,
  },
  cpfCnpj: {
    type: String,
    trim: true,
  },
  postalCode: {
    type: String,
    trim: true,
  },
  address: {
    type: String,
    trim: true,
  },
  addressNumber: {
    type: String,
    trim: true,
  },
  complement: {
    type: String,
    trim: true,
  },
  province: {
    type: String,
    trim: true,
  },
  city: {
    type: String,
    trim: true,
  },
  state: {
    type: String,
    trim: true,
  },
  asaasCustomerId: {
    type: String,
    trim: true,
    default: null,
  },
  role: {
    type: String,
    enum: ['user', 'admin'],
    default: 'user',
  },
  activePlan: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Plan',
    default: null,
  },
  planStartDate: {
    type: Date,
    default: null,
  },
  planEndDate: {
    type: Date,
    default: null,
  },
  credits: {
    type: Number,
    default: 0,
    min: [0, 'Créditos não podem ser negativos'],
  },
  creditsUsed: {
    type: Number,
    default: 0,
    min: [0, 'Créditos utilizados não podem ser negativos'],
  },
  hasUnlimitedCredits: {
    type: Boolean,
    default: false,
  },
  isActive: {
    type: Boolean,
    default: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

// Hash da senha antes de salvar (apenas se senha foi fornecida)
userSchema.pre('save', async function (next) {
  if (!this.isModified('password') || !this.password) {
    return next();
  }
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// Método para comparar senhas
userSchema.methods.comparePassword = async function (candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Atualizar updatedAt antes de salvar
userSchema.pre('save', function (next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('User', userSchema);

