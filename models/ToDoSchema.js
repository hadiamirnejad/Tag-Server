const { default: mongoose } = require("mongoose");
const Schema = mongoose.Schema;

const ToDoSchema = new Schema(
  {
    data: {
      type: [Object],
      default: []
    },
    user: {
      type: Schema.Types.ObjectId,
      ref: "users",
    },
  },
  {
    timestamps: true,
  }
);

const ToDo = mongoose.model("todos", ToDoSchema);

module.exports = {ToDo}
