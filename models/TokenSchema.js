const { default: mongoose } = require("mongoose");
const Schema = mongoose.Schema;

var minuteFromNow = function(){
  var timeObject = new Date();
  timeObject.setTime(timeObject.getTime() + 1000 * parseInt(process.env.EXPIRE_TOKEN));
  return timeObject;
};

const tokenSchema = new Schema({
  token: {type:String, trim:true , required: true},
  user: {type:Schema.Types.ObjectId, ref:'users', trim:true},
  expiredAt: {type: Date, default: minuteFromNow, expires: process.env.EXPIRE_TOKEN}
},
{
  timestamps: true,
});


const Token = mongoose.model("tokens", tokenSchema);

module.exports = {Token}