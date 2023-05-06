const { default: mongoose } = require("mongoose");
const Schema = mongoose.Schema;


const fieldSchema = new Schema({
  //0 = radio, 1 = multi select, 2 = text
  type: {type: Number,required: true,default: 0},
  parameters: {type:[Object], trim:true , default:[]},
},
{
  timestamps: true,
}
);

const Field = mongoose.model("fields", fieldSchema);
module.exports = { Field }