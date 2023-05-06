const { default: mongoose } = require("mongoose");
const Schema = mongoose.Schema;

const chatSchema = new Schema({
  roomId: {type: Schema.Types.ObjectId, ref: 'chatrooms', trim:true , required: true},
  message: {type: String, default: '', trim:true},
  type: {type: String, default: '', trim:true},
  replyTo: {type: Schema.Types.ObjectId, ref: 'chats', default: null},
  forwardFrom: {type: Schema.Types.ObjectId, ref: 'chats', default: null},
  user: {type: Schema.Types.ObjectId, ref: 'users', default: null},
  state: {type: Number, default: 0}
},
{
  timestamps: true,
});

const Chat = mongoose.model("chats", chatSchema);
module.exports = { Chat}