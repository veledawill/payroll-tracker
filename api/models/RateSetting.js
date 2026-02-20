const mongoose = require('mongoose');

const RateSettingSchema = new mongoose.Schema({
  hourly_rate: {
    type: Number,
    required: true
  },
  effective_from: {
    type: Date,
    required: true
  },
  effective_to: {
    type: Date,
    default: null
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  }
});

module.exports = mongoose.model('RateSetting', RateSettingSchema);