const { connectDB } = require("../db");
const {User, Token, Chat, ChatRoom} = require("../../models/Schemas");
const mongoose = require("mongoose");

connectDB();

const getChatRooms = {
  path: "/api/getChatRooms",
  method: "post",
  checkTokenValidation: true,
  handler: async (req, res) => {
    const { userId } = req.body;
    // const chatRooms = await ChatRoom.find({ members: {$elemMatch: {user: mongoose.Types.ObjectId(userId)}}}).populate({path:'members.user',select: {'name':1,'_id':1,'username':1, 'avatar':1}});
    const chatRooms = await Chat.aggregate([
      {
        '$sort': {
          'createdAt': -1
        }
      }, {
        '$group': {
          '_id': {
            'roomId': '$roomId', 
            'status': '$status'
          }, 
          'count': {
            '$sum': 1
          }, 
          'lastMessage': {
            '$first': '$message'
          }, 
          'lastUser': {
            '$first': '$user'
          }, 
          'lastDate': {
            '$first': '$createdAt'
          }
        }
      }, {
        '$lookup': {
          'from': 'chatrooms', 
          'localField': '_id.roomId', 
          'foreignField': '_id', 
          'as': 'room'
        }
      }, {
        '$lookup': {
          'from': 'users', 
          'localField': 'lastUser', 
          'foreignField': '_id', 
          'as': 'lastUser'
        }
      }, {
        '$unwind': {
          'path': '$room'
        }
      }, {
        '$unwind': {
          'path': '$lastUser'
        }
      }, {
        '$match': {
          'room.members': {
            '$elemMatch': {
              'user': mongoose.Types.ObjectId(userId)
            }
          }
        }
      }, {
        '$lookup': {
          'from': 'users', 
          'localField': 'room.members.user', 
          'foreignField': '_id', 
          'as': 'room.members'
        }
      }, {
        '$project': {
          'lastMessage': 1, 
          'lastDate': 1, 
          'lastUser': '$lastUser.name', 
          'room._id': 1, 
          'room.title': 1, 
          'room.createdAt': 1, 
          'room.updatedAt': 1, 
          'room.type': 1, 
          'room.members._id': 1, 
          'room.members.name': 1, 
          'room.members.avatar': 1
        }
      }
    ]);
    return res.json(chatRooms);
  },
};

const getChatRoomById = {
  path: "/api/getChatRoomById",
  method: "post",
  checkTokenValidation: true,
  handler: async (req, res) => {
    const { roomId } = req.body;
    const chatRoom = await ChatRoom.findById(roomId).populate({path:'members.user',select: {'name':1,'_id':1,'username':1, 'avatar':1}});
    return res.json(chatRoom);
  },
};

const changeChatRoomMember = {
  path: "/api/changeChatRoomMember",
  method: "post",
  checkTokenValidation: true,
  handler: async (req, res) => {
    const { roomId, members } = req.body;
    const newMembers = members.map(m=>{return {user: mongoose.Types.ObjectId(m.user),role: m.role}});
    const chatRoom = await ChatRoom.findByIdAndUpdate(roomId, {members:newMembers},{new:true}).populate({path:'members.user',select: {'name':1,'_id':1,'username':1, 'avatar':1}});
    return res.json(chatRoom);
  },
};

const getChatRoomsByUser = {
  path: "/api/getChatRooms/:partnerId",
  method: "post",
  checkTokenValidation: true,
  handler: async (req, res) => {
    const { userId } = req.body;
    const { partnerId } = req.params;
    // let chatRoom = await ChatRoom.findOne({ '$members.user': {$match:[mongoose.Types.ObjectId(userId), mongoose.Types.ObjectId(partnerId)]} }).populate({path:'members.user',select: {'name':1,'_id':1,'username':1, 'avatar':1}});
    try {
      let chatRoom = await ChatRoom.aggregate([
        {
          '$addFields': {
            'users': '$members.user'
          }
        }, {
          '$match': {
            'users': [mongoose.Types.ObjectId(userId), mongoose.Types.ObjectId(partnerId)]
          }
        }
      ]);
      if(chatRoom.length === 0){
        chatRoom = await ChatRoom.create({ title: partnerId, type: partnerId===userId?0:1, members: [{user: mongoose.Types.ObjectId(userId), role: 'user'}, {user: mongoose.Types.ObjectId(partnerId), role:'user'}] });
      }
      else{
        chatRoom = chatRoom[0];
      }
      chatRoom = await ChatRoom.findById(chatRoom._id).populate({path:'members.user',select: {'name':1,'_id':1,'username':1, 'avatar':1}});

      const chatRooms = await Chat.aggregate([
        {
          '$sort': {
            'createdAt': -1
          }
        }, {
          '$group': {
            '_id': {
              'roomId': '$roomId', 
              'status': '$status'
            }, 
            'count': {
              '$sum': 1
            }, 
            'lastMessage': {
              '$first': '$message'
            }, 
            'lastUser': {
              '$first': '$user'
            }, 
            'lastDate': {
              '$first': '$createdAt'
            }
          }
        }, {
          '$lookup': {
            'from': 'chatrooms', 
            'localField': '_id.roomId', 
            'foreignField': '_id', 
            'as': 'room'
          }
        }, {
          '$lookup': {
            'from': 'users', 
            'localField': 'lastUser', 
            'foreignField': '_id', 
            'as': 'lastUser'
          }
        }, {
          '$unwind': {
            'path': '$room'
          }
        }, {
          '$unwind': {
            'path': '$lastUser'
          }
        }, {
          '$match': {
            'room.members': {
              '$elemMatch': {
                'user': mongoose.Types.ObjectId(userId)
              }
            }
          }
        }, {
          '$lookup': {
            'from': 'users', 
            'localField': 'room.members.user', 
            'foreignField': '_id', 
            'as': 'room.members'
          }
        }, {
          '$project': {
            'lastMessage': 1, 
            'lastDate': 1, 
            'lastUser': '$lastUser.name', 
            'room._id': 1, 
            'room.title': 1, 
            'room.createdAt': 1, 
            'room.updatedAt': 1, 
            'room.type': 1, 
            'room.members._id': 1, 
            'room.members.name': 1, 
            'room.members.avatar': 1
          }
        }
      ]);

      return res.json({id:chatRoom._id,chatRooms:[...chatRooms,{room: {...chatRoom._doc, members: chatRoom.members.map(m=>m.user)}}]});
    } catch (error) {
      return res.json({error});
    }
  },
};

const addChatRoom = {
  path: "/api/addChatRoom",
  method: "post",
  checkTokenValidation: true,
  handler: async (req, res) => {
    const { title, members, type } = req.body;
    const chatRoom = await ChatRoom.create({ title, members, type });
    return res.json(chatRoom);
  },
};

const getChats = {
  path: "/api/getChats",
  method: "post",
  checkTokenValidation: true,
  handler: async (req, res) => {
    const { roomId } = req.body;
    const chats = await Chat.find({ roomId: mongoose.Types.ObjectId(roomId) }).populate({path:'user', select: {'name':1,'_id':1,'username':1, 'avatar':1}});
    return res.json(chats);
  },
};

const addChat = {
  path: "/api/addChat",
  method: "post",
  checkTokenValidation: true,
  handler: async (req, res) => {
    const { userId, roomId, message, type, replyTo, forwardFrom } = req.body;
    console.log(userId, roomId, message, type, replyTo, forwardFrom)
    const newChat = await Chat.create({roomId: mongoose.Types.ObjectId(roomId), user: mongoose.Types.ObjectId(userId), roomId, message, type, replyTo, forwardFrom });
    const chats = await Chat.find({roomId: mongoose.Types.ObjectId(roomId)}).populate({path:'user', select: {'name':1,'_id':1,'username':1, 'avatar':1}});
    return res.json(chats);
  },
};

module.exports = { getChatRooms, getChatRoomById, changeChatRoomMember, getChatRoomsByUser, addChatRoom, getChats, addChat };
