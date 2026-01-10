const mongoose = require('mongoose');

const otpCodeSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'ID do usuário é obrigatório'],
    index: true,
  },
  phone: {
    type: String,
    required: [true, 'Telefone é obrigatório'],
    trim: true,
  },
  code: {
    type: String,
    required: [true, 'Código é obrigatório'],
    length: 6,
  },
  expiresAt: {
    type: Date,
    required: [true, 'Data de expiração é obrigatória'],
    index: { expireAfterSeconds: 0 }, // TTL index para remover automaticamente após expiração
  },
  verified: {
    type: Boolean,
    default: false,
  },
  verifiedAt: {
    type: Date,
    default: null,
  },
  attempts: {
    type: Number,
    default: 0,
    min: 0,
  },
  maxAttempts: {
    type: Number,
    default: 5,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

// Índice composto para busca rápida
otpCodeSchema.index({ userId: 1, phone: 1, verified: 1 });
otpCodeSchema.index({ code: 1, verified: 1 });

module.exports = mongoose.model('OTPCode', otpCodeSchema);

