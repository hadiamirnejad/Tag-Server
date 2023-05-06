const express = require("express");
require("dotenv").config();
const app = express();
const http = require("http");
const cors = require("cors");
const { Server } = require("socket.io");
const { checkTokenValidation } = require("../middlewares/authMiddleware");

const routes = require("./routes");
const { initializeDbConnection } = require("./db");
const { Chat, PhraseTag, ChatRoom, User } = require("../models/Schemas");

const server = http.createServer(app);
const PORT = process.env.PORT || 8080;

var bodyParser = require('body-parser');
const { default: mongoose } = require("mongoose");
app.use(bodyParser.json({limit: '50mb'}));
app.use(bodyParser.urlencoded({limit: '50mb', extended: true}));

app.use(express.static(`${__dirname}/public`));

app.use(function (req, res, next) {
  res.header("Access-Control-Allow-Origin", process.env.CLIENT_URL);
  res.header(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept"
  );
  next();
});
app.use(cors());

const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URL,
    methods: ["GET", "POST"],
  },
});

io.on("connection", (socket) => {
  console.log(`User connected: ${socket.id}`);

  socket.on("join_room", (roomId)=>{
    socket.join(roomId)
  })

  socket.on('send_message', async({ userId, roomId, message, type, replyTo, forwardFrom }) =>{
    const newChat = await Chat.create({roomId: mongoose.Types.ObjectId(roomId), user: mongoose.Types.ObjectId(userId), message, type, replyTo, forwardFrom });
    const chats = await Chat.find({roomId: mongoose.Types.ObjectId(roomId)}).populate({path:'user', select: {'name':1,'_id':1,'username':1, 'avatar':1}}).populate({path:'replyTo', select: {'message':1,'_id':1,'user':1, 'type':1}}).populate({path:'forwardFrom', select: {'message':1,'_id':1,'user':1, 'type':1, 'roomId': 1}});
    const chatRoom = await ChatRoom.findById(roomId).populate({path:'members.user', select: {'name':1,'_id':1,'username':1, 'avatar':1}});
    io.in(roomId).emit("receive_message",{chats, chatRoom})
  });
  
  socket.on('delete_message', async({ messageId, roomId }) =>{
    const newChat = await Chat.findByIdAndRemove(mongoose.Types.ObjectId(messageId));
    const chats = await Chat.find({roomId: mongoose.Types.ObjectId(roomId)}).populate({path:'user', select: {'name':1,'_id':1,'username':1, 'avatar':1}}).populate({path:'replyTo', select: {'message':1,'_id':1,'user':1, 'type':1}}).populate({path:'forwardFrom', select: {'message':1,'_id':1,'user':1, 'type':1, 'roomId': 1}});
    const chatRoom = await ChatRoom.findById(roomId).populate({path:'members.user', select: {'name':1,'_id':1,'username':1, 'avatar':1}});
    io.in(roomId).emit("receive_message",{chats, chatRoom})
  });
  
  socket.on('edit_message', async({ messageId, message, roomId }) =>{
    const newChat = await Chat.findByIdAndUpdate(mongoose.Types.ObjectId(messageId),{message: message});
    const chats = await Chat.find({roomId: mongoose.Types.ObjectId(roomId)}).populate({path:'user', select: {'name':1,'_id':1,'username':1, 'avatar':1}}).populate({path:'replyTo', select: {'message':1,'_id':1,'user':1, 'type':1}}).populate({path:'forwardFrom', select: {'message':1,'_id':1,'user':1, 'type':1, 'roomId': 1}});
    const chatRoom = await ChatRoom.findById(roomId).populate({path:'members.user', select: {'name':1,'_id':1,'username':1, 'avatar':1}});
    io.in(roomId).emit("receive_message",{chats, chatRoom})
  });
  
  socket.on('get_messages', async(roomId) =>{
    const chats = await Chat.find({roomId: mongoose.Types.ObjectId(roomId)}).populate({path:'user', select: {'name':1,'_id':1,'username':1, 'avatar':1}}).populate({path:'replyTo', select: {'message':1,'_id':1,'user':1, 'type':1}}).populate({path:'forwardFrom', select: {'message':1,'_id':1,'user':1, 'type':1, 'roomId': 1}});
    const chatRoom = await ChatRoom.findById(roomId).populate({path:'members.user', select: {'name':1,'_id':1,'username':1, 'avatar':1}});
    io.in(roomId).emit("receive_message",{chats, chatRoom})
  });

  socket.on('get_chatRooms', async(userId) =>{
    const chatRooms1 = await ChatRoom.find({ members: {$elemMatch: {user: mongoose.Types.ObjectId(userId)}}}).populate({path:'members.user',select: {'name':1,'_id':1,'username':1, 'avatar':1}});
    const chats = await Chat.aggregate([
      {
        '$group': {
          '_id': {
            'roomId': '$roomId'
          }, 
          'count': {
            '$sum': 1
          }, 
          'lastMessage': {
            '$last': '$message'
          }, 
          'lastUser': {
            '$last': '$user'
          }, 
          'lastDate': {
            '$last': '$createdAt'
          }
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
          'path': '$lastUser'
        }
      }, {
        '$project': {
          'roomId': 1, 
          'lastMessage': 1, 
          'lastDate': 1, 
          'lastUser': '$lastUser.name'
        }
      }
    ])
    const chatRooms = chatRooms1.map(r=>{if(chats.filter(c=>c._id.roomId.toString()===r._id.toString()).length>0){return {...chats.filter(c=>c._id.roomId.toString()===r._id.toString())[0], room: r}}else{return {lastMessage: '', lastUser:'', lastdate: '',room: r}}})
    const users = await User.find();
    io.emit("receive_chatRoom",{chatRooms, users: users.map(u=> {return {_id: u._id, username: u.username, active: u.active, name: u.name, avatar: u.avatar, role: u.role, currentFile: u.currentFile}})})
  });
    
  socket.on('add_group_or_channel', async({userId, title, members, type, img}) =>{
    let imgProfile = !img?type===2?'/images/icons/group.jpg':'/images/icons/channel.jpg':img
    const chatRoom = await ChatRoom.create({ title, members, type });
    const newChat = await Chat.create({roomId: mongoose.Types.ObjectId(chatRoom._id), user: mongoose.Types.ObjectId(userId), message:`به ${type===2?'گروه':'کانال'} «${title}» خوش آمدید.`, type: "1", image: img, replyTo: null, forwardFrom:null });
    
    const chatRooms1 = await ChatRoom.find({ members: {$elemMatch: {user: mongoose.Types.ObjectId(userId)}}}).populate({path:'members.user',select: {'name':1,'_id':1,'username':1, 'avatar':1}});
    const chats = await Chat.aggregate([
      {
        '$group': {
          '_id': {
            'roomId': '$roomId'
          }, 
          'count': {
            '$sum': 1
          }, 
          'lastMessage': {
            '$last': '$message'
          }, 
          'lastUser': {
            '$last': '$user'
          }, 
          'lastDate': {
            '$last': '$createdAt'
          }
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
          'path': '$lastUser'
        }
      }, {
        '$project': {
          'roomId': 1, 
          'lastMessage': 1, 
          'lastDate': 1, 
          'lastUser': '$lastUser.name'
        }
      }
    ])
    const chatRooms = chatRooms1.map(r=>{if(chats.filter(c=>c._id.roomId.toString()===r._id.toString()).length>0){return {...chats.filter(c=>c._id.roomId.toString()===r._id.toString())[0], room: r}}else{return {lastMessage: '', lastUser:'', lastdate: '',room: r}}})
    const users = await User.find();
    io.emit("receive_chatRoom",{chatRooms, users: users.map(u=> {return {_id: u._id, username: u.username, active: u.active, name: u.name, avatar: u.avatar, role: u.role, currentFile: u.currentFile}})})
  })

  socket.on("has_conflict", async (tagTemplateId) => {
    const conflictCount= await PhraseTag.count({tagTemplate: mongoose.Types.ObjectId(tagTemplateId), status: 3,$or:[{userChecked: {$exists: false}},{userChecked:null}]})
    socket.emit('has_conflict_response', conflictCount)
  });

  socket.on("conflict_and_cheching", async (userId) => {
    const conflictCount= await PhraseTag.count({status: 3,$or:[{userChecked: {$exists: false}},{userChecked:null}]})
    const checkingCount= await PhraseTag.count({status: 4,$or:[{userChecked: {$exists: false}},{userChecked:null}]})
    socket.emit('conflict_and_cheching_response', [conflictCount, checkingCount])
  });

  socket.on("has_rejected_conflicted", async (data) => {
    const conflictCount= await PhraseTag.count({tagTemplate: mongoose.Types.ObjectId(data.tagTemplateId), status: 3, userTagged: mongoose.Types.ObjectId(data.userId), $and:[{userChecked: {$exists: true}}, {userChecked:{$ne:null}}]})
    const rejectCount= await PhraseTag.count({tagTemplate: mongoose.Types.ObjectId(data.tagTemplateId), status: 6, userTagged: mongoose.Types.ObjectId(data.userId), $and:[{userChecked: {$exists: true}}, {userChecked:{$ne:null}}]})
    socket.emit('has_rejected_conflicted_response', [conflictCount, rejectCount])
  });

  socket.on("disconnect", () => {
    console.log("User Disconnected", socket.id);
  });
});

// Add all the routes to our Express server
// exported from routes/index.js
routes.forEach((route) => {
  if (route.checkTokenValidation) {
    app[route.method](route.path, checkTokenValidation, route.handler);
  } else {
    app[route.method](route.path, route.handler);
  }
});

server.listen(PORT, () => {
  console.log(`Server is listening on port ${PORT}`);
});
