const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Usuário é obrigatório'],
  },
  plan: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Plan',
    required: [true, 'Plano é obrigatório'],
  },
  amount: {
    type: Number,
    required: [true, 'Valor é obrigatório'],
    min: [0, 'Valor não pode ser negativo'],
  },
  status: {
    type: String,
    enum: ['pending', 'completed', 'failed', 'cancelled', 'refunded'],
    default: 'pending',
  },
  paymentMethod: {
    type: String,
    enum: ['credit_card', 'debit_card', 'pix', 'bank_transfer', 'other'],
    default: 'other',
  },
  transactionId: {
    type: String,
    unique: true,
    sparse: true,
  },
  asaasPaymentId: {
    type: String,
    trim: true,
    default: null,
  },
  asaasSubscriptionId: {
    type: String,
    trim: true,
    default: null,
  },
  asaasCustomerId: {
    type: String,
    trim: true,
    default: null,
  },
  paymentDate: {
    type: Date,
    default: null,
  },
  dueDate: {
    type: Date,
    default: null,
  },
  pixQrCode: {
    type: String,
    default: null,
  },
  pixQrCodeExpiration: {
    type: Date,
    default: null,
  },
  bankSlipUrl: {
    type: String,
    default: null,
  },
  notes: {
    type: String,
    trim: true,
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

// Atualizar updatedAt antes de salvar
transactionSchema.pre('save', function (next) {
  this.updatedAt = Date.now();
  next();
});

// Índices para melhor performance
transactionSchema.index({ user: 1, createdAt: -1 });
transactionSchema.index({ status: 1 });
transactionSchema.index({ transactionId: 1 });

module.exports = mongoose.model('Transaction', transactionSchema);

