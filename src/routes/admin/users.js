const { connectDB } = require("../../db");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const User = require("../../../models/User");
const mongoose = require("mongoose");

connectDB();

const getUsers = {
  path: "/api/users",
  method: "get",
  checkTokenValidation: true,
  handler: async (req, res) => {
    const users = await User.find();
    return res.json(users);
  },
};

const getUser = {
  path: "/api/users/:userId",
  method: "get",
  checkTokenValidation: true,
  handler: async (req, res) => {
    const { userId } = req.params;
    const user = await User.findById(userId);

    const { password, ...userD } = user._doc;
    res.status(200).json({ user: userD });
  },
};

const getUserByUsername = {
  path: "/api/users/getUserByUsername",
  method: "post",
  checkTokenValidation: false,
  handler: async (req, res) => {
    const { username } = req.body;
    try {
      const user = await User.findOne({ username });
      const { password, ...userD } = user._doc;
      console.log(userD)
      res.status(200).json({ user: userD });
    } catch (error) {
      res.json({ error: error });
    }
  },
};

const updateUser = {
  path: "/api/users/:userId",
  method: "put",
  checkTokenValidation: true,
  handler: async (req, res) => {
    const { userId } = req.params;
    if (userId == "undefined") {
      res.json({ error: "ff" });
    }
    let { name, alias, email, mobile, country, city, address, avatar, bio } =
      req.body;

    const result = await User.findOneAndUpdate(
      { _id: mongoose.Types.ObjectId(userId) },
      {
        $set: {
          name,
          alias,
          email,
          mobile,
          country,
          city,
          address,
          avatar,
          bio,
        },
      },
      { returnOriginal: false }
    );

    const { username, role, verified, grade, createdAt } = result;

    jwt.sign(
      {
        userId,
        username,
      },
      process.env.JWT_SECRET,
      { expiresIn: "2d" },
      (err, accessToken) => {
        if (err) return res.json({ error: "can_not_update_user" });
        res.status(200).json({ accessToken });
      }
    );
  },
};

const updateUserMainColor = {
  path: "/api/users/:userId/changeColor",
  method: "put",
  checkTokenValidation: true,
  handler: async (req, res) => {
    const { userId } = req.params;
    if (userId == "undefined") {
      res.json({ error: "ff" });
    }
    let { mainColor } = req.body;

    const result = await User.findOneAndUpdate(
      { _id: mongoose.Types.ObjectId(userId) },
      {
        $set: {
          mainColor,
        },
      },
      { returnOriginal: false }
    );

    const { username, role, verified, grade, createdAt } = result;
    const { password, posts, ...userD } = result._doc;

    jwt.sign(
      {
        userId,
        username,
      },
      process.env.JWT_SECRET,
      { expiresIn: "2d" },
      (err, accessToken) => {
        if (err) return res.json({ error: "can_not_update_user" });
        res.status(200).json({ accessToken, user: userD });
      }
    );
  },
};

const updateUserPassword = {
  path: "/api/users/changePassword/:userId",
  method: "post",
  checkTokenValidation: true,
  handler: async (req, res) => {
    const { userId, newPassword, confirmationNewPassword } = req.body;
    console.log(userId, newPassword, confirmationNewPassword)
    if(newPassword !== confirmationNewPassword){
      res.json({error: "invalid_password"})
    }
    try {
      const passwordHash = await bcrypt.hash(newPassword, 10);
      const result = await User.findOneAndUpdate(
        { _id: mongoose.Types.ObjectId(userId) },
        {
          $set: {
            password: passwordHash,
          },
        },
        { returnOriginal: false }
      );
  
      const { username, role, verified, grade, createdAt } = result;
      const { password, posts, ...userD } = result._doc;
  
      jwt.sign(
        {
          userId,
          username,
        },
        process.env.JWT_SECRET,
        { expiresIn: "2d" },
        (err, accessToken) => {
          if (err) return res.json({ error: "can_not_update_user" });
          res.status(200).json({ accessToken, user: userD });
        }
      );
    } catch (error) {
      res.json({error: "can_not_change_password"})
    }
  },
};

module.exports = { getUsers, getUser, updateUser, updateUserMainColor, getUserByUsername, updateUserPassword };
