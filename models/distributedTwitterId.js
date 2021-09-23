const mongoose = require('mongoose');

const { Schema } = mongoose;

const distributedTwitterIdSchema = new Schema({
  TwitterId: {
    type: String,
    required: true,
    unique: true,
  },
});

const distributedTwitterId = mongoose.model(
  'distributedTwitterId',
  distributedTwitterIdSchema
);

module.exports = distributedTwitterId;
