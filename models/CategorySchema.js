const { default: mongoose } = require("mongoose");
const Schema = mongoose.Schema;


const categorySchema = new Schema({
  title: {type:String, trim:true , required: true},
  description: {type:String, trim:true , default:""}
},
{
  timestamps: true,
});

const Category = mongoose.model("categories", categorySchema);
module.exports = {Category}