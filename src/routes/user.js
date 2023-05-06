const { connectDB } = require("../db");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const {User, Token} = require("../../models/Schemas");
const mongoose = require("mongoose");

connectDB();

const signInRoute = {
  path: "/api/signin",
  method: "post",
  checkTokenValidation: false,
  handler: async (req, res) => {
    const { username, password } = req.body;
    const user = await User.findOne({ username });
    if (!user) return res.json({ error: "usernam_or_password_is_incorrect" });

    const isCorrect = await bcrypt.compare(password, user.password);
    if (isCorrect) {
      const token = await bcrypt.hash(user.username + user.password + user.role + process.env.JWT_SECRET, 10);

      await Token.deleteMany({user: user._id});
      await Token.create({token: token, user: user._id});
      const { password, ...userD } = user._doc;
      res.status(200).json({ accessToken: token, user: userD });
      // jwt.sign(
      //   {
      //     id: user.id,
      //     username,
      //   },
      //   process.env.JWT_SECRET,
      //   { expiresIn: "2d" },
      //   async (err, accessToken) => {
      //     if (err) return res.send(err);
      //     const { password, ...userD } = user._doc;
      //     res.status(200).json({ accessToken, user: userD });
      //   }
      // );
    } else {
      res.json({ error: "usernam_or_password_is_incorrect" });
    }
  },
};

const checkToken = {
  path: "/api/checkToken",
  method: "post",
  checkTokenValidation: false,
  handler: async (req, res) => {
    const { accessToken } = req.body;
    const token = await Token.findOne({ token: accessToken }).populate('user');

    if (!token) return res.json({ user: null });

    const { password, ...userD } = token.user._doc;
    res.status(200).json({ user: userD });
  },
};

const addUser = {
  path: "/api/addUser",
  method: "post",
  checkTokenValidation: false,
  handler: async (req, res) => {
    const { username, name, role, password } = req.body;
    if (!username || !name || !role) return res.json({ error: "نام کاربری نباید خالی باشد." });

    const user = await User.findOne({ username });

    if (user) {
      return res.json({ error: "این نام کاربری قبلاً ثبت شده است." });
    }

    const passwordHash = await bcrypt.hash(password || '123456', 10);

    let result = await User.create({
      name,
      username,
      password: passwordHash,
      role,
      currentFile: null,
      avatar: "/images/icons/avatar.jpg"
    });
    res.status(200).json('عملیات با موفقیت انجام شد.');
  },
}

const editUser = {
  path: "/api/editUser",
  method: "put",
  checkTokenValidation: false,
  handler: async (req, res) => {
    const { username, name, role, id } = req.body;
    if (!username) return res.json({ error: "username_not_valid" });

    const user = await User.findOne({ username, _id:{ $ne: id } });

    if (user) {
      return res.json({ error: "username_duplicate" });
    }

    const result = await User.findByIdAndUpdate(id,{
      name,
      username,
      role
    }, {new: true});

    res.status(200).json({updatedUser: {_id: result._id, username: result.username, active: result.active, name: result.name, avatar: result.avatar, role: result.role, currentFile: result.currentFile}})
  },
}

const changePassword = {
  path: "/api/changePassword",
  method: "post",
  checkTokenValidation: false,
  handler: async (req, res) => {
    const { userId, oldPassword, newPassword } = req.body;
    if (!userId || !oldPassword || !newPassword) return res.json({ error: "کاربر معتبر نیست." });

    try {
      const user = await User.findById(userId);
      if (!user) {
        return res.json({ error: "کاربر وجود ندارد." });
      }
      const isCorrect = await bcrypt.compare(oldPassword, user.password);
      if(!isCorrect) {
        return res.json({ error: "رمز فعلی اشتباه است." });
      }
      const passwordHash = await bcrypt.hash(newPassword, 10);
  
      const result = await User.findByIdAndUpdate(userId,{password: passwordHash});
  
      res.status(200).json('عملیات با موفقیت انجام شد.');
    } catch (error) {
      res.json({error:'عملیات انجام نشد.'});
    }
  },
}

const getUsers = {
  path: "/api/getUsers",
  method: "post",
  checkTokenValidation: false,
  handler: async (req, res) => {
    let search={};

    const users = await User.find(search);

    res.json({users: users.map(u=> {return {_id: u._id, username: u.username, active: u.active, name: u.name, avatar: u.avatar, role: u.role, currentFile: u.currentFile}})})
  },
}

const getUser = {
  path: "/api/users/:userId",
  method: "get",
  checkTokenValidation: false,
  handler: async (req, res) => {
    const user = await User.findById(req.params.userId);
    if (!user) return res.json({ error: "usernam_or_password_is_incorrect" });

    jwt.sign(
      {
        id: user.id,
        username: user.username,
      },
      process.env.JWT_SECRET,
      { expiresIn: "2d" },
      (err, accessToken) => {
        if (err) return res.send(err);
        const { password, ...userD } = user._doc;
        res.status(200).json({ accessToken, user: userD });
      }
    );
  },
};

const setUserCurrentFile = {
  path: "/api/users/setUserCurrentFile",
  method: "put",
  checkTokenValidation: true,
  handler: async (req, res) => {
    const {currentFile, id} = req.body;
    const result = await User.findByIdAndUpdate(id,{
      currentFile: currentFile
    }, {new: true});

    res.status(200).json({updatedUser: {_id: result._id, username: result.username, active: result.active, name: result.name, avatar: result.avatar, role: result.role, currentFile: result.currentFile}})
  },
};

const deactiveUser = {
  path: "/api/users/deactiveUser",
  method: "put",
  checkTokenValidation: true,
  handler: async (req, res) => {
    const {activeStatus, id} = req.body;
    const result = await User.findByIdAndUpdate(id,{
      active: activeStatus
    }, {new: true});

    res.status(200).json({updatedUser: {_id: result._id, username: result.username, active: result.active, name: result.name, avatar: result.avatar, role: result.role, currentFile: result.currentFile}})
  },
};

const resetPassword = {
  path: "/api/users/resetPassword",
  method: "put",
  checkTokenValidation: true,
  handler: async (req, res) => {
    const {id} = req.body;

    try {
      if(!id)return res.json({error: 'اطلاعات صحیح نیست.'})
      const passwordHash = await bcrypt.hash('123456', 10);
      const result = await User.findByIdAndUpdate(id,{
        password: passwordHash
      }, {new: true});
  
      res.status(200).json({updatedUser: {_id: result._id, username: result.username, active: result.active, name: result.name, avatar: result.avatar, role: result.role, currentFile: result.currentFile}})
    } catch (error) {
      res.json({error: 'عملیات با شکست مواجه شد..'})
    }
  },
};

const updateMessengerState = {
  path: "/api/users/updateMessengerState",
  method: "post",
  checkTokenValidation: true,
  handler: async (req, res) => {
    const {id, messenger} = req.body;

    try {
      if(!id)return res.json({error: 'اطلاعات صحیح نیست.'})
      const result = await User.findByIdAndUpdate(id,{
        messenger: messenger
      }, {new: true});
  
      res.status(200).json({updatedUser: {_id: result._id, username: result.username, active: result.active, name: result.name, avatar: result.avatar, role: result.role, currentFile: result.currentFile}})
    } catch (error) {
      res.json({error: 'عملیات با شکست مواجه شد..'})
    }
  },
};

module.exports = { checkToken, signInRoute, addUser, editUser, changePassword, getUsers, getUser, deactiveUser, setUserCurrentFile, resetPassword, updateMessengerState};
