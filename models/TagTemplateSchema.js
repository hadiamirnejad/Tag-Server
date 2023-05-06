const { default: mongoose } = require("mongoose");
const Schema = mongoose.Schema;

const tagTemplateSchema = new Schema(
  {
    title: {type: String, trim:true, required: true},
    template:{ type: [
      {
        text: {type: String, trim:true},
        field: {type: Schema.Types.ObjectId, ref: "fields"},
        default: {type: [String], trim:true},
        hint: {type: String, trim:true}
      }
    ], trim:true},
  },
  {
    timestamps: true,
  }
);

const TagTemplate = mongoose.model("tagtemplates", tagTemplateSchema);
module.exports = { TagTemplate}