const mongoose = require('mongoose');

const TaxBracketSchema = new mongoose.Schema({
  earnings: {
    type: Number,
    required: true
  },
  with_tax: {
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
  }
});

module.exports = mongoose.model('TaxBracket', TaxBracketSchema);