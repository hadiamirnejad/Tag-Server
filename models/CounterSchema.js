const { default: mongoose } = require("mongoose");
const Schema = mongoose.Schema;

var CounterSchema = Schema({
  _id: {type: String, required: true},
  seq: { type: Number, default: 0 }
});
const Counter = mongoose.model('counters', CounterSchema);

module.exports = { Counter}