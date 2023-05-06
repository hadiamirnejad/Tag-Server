const { connectDB } = require("../db");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const {User, ToDo} = require("../../models/Schemas");
const mongoose = require("mongoose");

connectDB();

const addOrEditToDo = {
  path: "/api/addOrEditToDo",
  method: "post",
  checkTokenValidation: false,
  handler: async (req, res) => {
    const { user, data } = req.body;
    try{
      const toDo = await ToDo.findOneAndUpdate({user: mongoose.Types.ObjectId(user)},{user: mongoose.Types.ObjectId(user), data: data}, {upsert: true,new: true})

      res.status(200).json(toDo);
    } catch {
      res.json({ error: "usernam_or_password_is_incorrect" });
    }
  },
};

const getToDo = {
  path: "/api/getToDo",
  method: "post",
  checkTokenValidation: false,
  handler: async (req, res) => {
    const { user } = req.body;
    try{
      const toDo = await ToDo.findOne({user: mongoose.Types.ObjectId(user)})

      res.status(200).json(toDo);
    } catch {
      res.json({ error: "usernam_or_password_is_incorrect" });
    }
  },
};

module.exports = { addOrEditToDo, getToDo };
