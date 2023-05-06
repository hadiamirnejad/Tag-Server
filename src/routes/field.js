const { connectDB } = require("../db");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const {Field} = require("../../models/Schemas");
const mongoose = require("mongoose");

connectDB();

const addField = {
  path: "/api/addField",
  method: "post",
  checkTokenValidation: false,
  handler: async (req, res) => {
    const { type, parameters } = req.body;
    if(type === null || !parameters) return res.json({error: "invalid_parameters"})
    const result = await Field.create({
      type, parameters
    });
    return res.json(result);
  },
};

const getFields = {
  path: "/api/getFields",
  method: "get",
  checkTokenValidation: false,
  handler: async (req, res) => {
    const fields = await Field.find();

    return res.json(fields)
  },
}
const editField ={
  path: "/api/editField",
  method: "put",
  checkTokenValidation: true,
  handler: async (req, res) => {
    const {id, parameters} = req.body;
    const updatedField = await Field.findByIdAndUpdate(id, {parameters},{new: true});

    return res.json({updatedField})
  },
}

module.exports = { addField, getFields, editField };
