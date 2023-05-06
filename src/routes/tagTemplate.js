const { connectDB } = require("../db");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const {TagTemplate} = require("../../models/Schemas");
const mongoose = require("mongoose");

connectDB();

const addTagTemplate = {
  path: "/api/addTagTemplate",
  method: "post",
  checkTokenValidation: true,
  handler: async (req, res) => {
    const { title, template } = req.body;

    if(!template) return res.json({error: "invalid_parameters"})
    template.map(te => {
      te.field = mongoose.Types.ObjectId(te.field)
      return te;
    });
    
    const result = await TagTemplate.create({
      title, template
    })

    return res.json(result);
  },
};

const editTagTemplate = {
  path: "/api/editTagTemplate",
  method: "post",
  checkTokenValidation: true,
  handler: async (req, res) => {
    const { id, title, template } = req.body;

    if(!template) return res.json({error: "invalid_parameters"})
    template.map(te => {
      te.field = mongoose.Types.ObjectId(te.field)
      return te;
    });
    
    const result = await TagTemplate.findByIdAndUpdate(id, {
      title, template
    },{new: true})
    return res.json(result);
  },
};

const getTagTemplate = {
  path: "/api/getTagTemplates",
  method: "get",
  checkTokenValidation: false,
  handler: async (req, res) => {
    // const tagTemplates = await TagTemplate.find().populate('template.0.field');
    const tagTemplates = await TagTemplate.find();

    return res.json(tagTemplates)
  },
}

const getTagTemplateById = {
  path: "/api/getTagTemplates/:id",
  method: "get",
  checkTokenValidation: false,
  handler: async (req, res) => {
    const tagTemplates = await TagTemplate.findById(req.params.Id).populate('template.0.field');
    return res.json(tagTemplates)
  },
}

module.exports = { addTagTemplate, getTagTemplate, getTagTemplateById, editTagTemplate };
