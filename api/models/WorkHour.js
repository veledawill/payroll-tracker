const mongoose = require('mongoose');

const WorkHourSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  work_date: {
    type: Date,
    required: true
  },
  hours_worked: {
    type: Number,
    required: true,
    default: 0
  },
  clock_in_time: {
    type: String,
    default: '',
    validate: {
      validator: function(v) {
        // Allow empty string or valid time format (HH:MM)
        return v === '' || /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(v);
      },
      message: 'Clock-in time must be in HH:MM format'
    }
  },
  created_at: {
    type: Date,
    default: Date.now
  },
  updated_at: {
    type: Date,
    default: Date.now
  },
  sync_id: {
    type: String,
    default: function() {
      return this._id.toString();
    }
  },
  last_synced: {
    type: Date,
    default: null
  }
});

// Índice composto para prevenir registros duplicados para o mesmo usuário e data
WorkHourSchema.index({ user: 1, work_date: 1 }, { unique: true });

// Middleware para atualizar o campo updated_at ao modificar um documento
WorkHourSchema.pre('save', function(next) {
  this.updated_at = Date.now();
  next();
});

module.exports = mongoose.model('WorkHour', WorkHourSchema);