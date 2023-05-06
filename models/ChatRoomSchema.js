const { default: mongoose } = require("mongoose");
const Schema = mongoose.Schema;

//type: 0:saved messages, 1:private chat, 2:group, 3:channel
//role: 'user, 'admin', owner'
const chatRoomSchema = new Schema({
  title: {type:String, trim:true , required: true},
  members: {type:[{
    role: {type: String, default: 'user',trim:true},
    user: {type: Schema.Types.ObjectId, ref: 'users', trim:true},
  }], trim:true, default: []},
  image: {type: String, default: '/images/icons/Group.jpg',trim:true},
  type: {type: Number, default: 1,trim:true},
},
{
  timestamps: true,
});

const ChatRoom = mongoose.model("chatrooms", chatRoomSchema);
module.exports = { ChatRoom}