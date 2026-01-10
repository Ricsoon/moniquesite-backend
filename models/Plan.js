const mongoose = require('mongoose');

const planSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Nome do plano é obrigatório'],
    trim: true,
    unique: true,
  },
  description: {
    type: String,
    trim: true,
  },
  price: {
    type: Number,
    required: [true, 'Preço é obrigatório'],
    min: [0, 'Preço não pode ser negativo'],
  },
  duration: {
    type: Number,
    required: [true, 'Duração é obrigatória'],
    min: [1, 'Duração deve ser no mínimo 1 mês'],
  },
  durationUnit: {
    type: String,
    enum: ['days', 'months', 'years'],
    default: 'months',
  },
  features: [{
    type: String,
    trim: true,
  }],
  credits: {
    type: Number,
    default: null, // null = ilimitado
    min: [0, 'Créditos não podem ser negativos'],
  },
  isUnlimited: {
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

// Atualizar updatedAt antes de salvar
planSchema.pre('save', function (next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('Plan', planSchema);

