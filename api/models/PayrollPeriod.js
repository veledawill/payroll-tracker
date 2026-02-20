const mongoose = require('mongoose');

const PayrollPeriodSchema = new mongoose.Schema({
  period_label: {
    type: String,
    required: true
  },
  start_date: {
    type: Date,
    required: true
  },
  end_date: {
    type: Date,
    required: true
  },
  year: {
    type: Number,
    required: true
  }
});

module.exports = mongoose.model('PayrollPeriod', PayrollPeriodSchema);