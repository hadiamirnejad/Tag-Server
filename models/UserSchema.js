const { default: mongoose } = require("mongoose");
const Schema = mongoose.Schema;

const userSchema = new Schema(
  {
    username: {
      type: String,
      required: [true, 'username_is_required'],
      unique: true,
      validate: {
        validator: username => username.length > 3,
        message: 'name_must_be_longer_than_3_character'
      },
    },
    password: {
      type: String,
    },
    name: {
      type: String,
    },
    role: {
      type: String,
      default: "User",
    },
    avatar: {
      type: String,
      default: "/images/icons/avatar.jpg",
    },
    active: {
      type: Boolean,
      default: true,
    },
    currentFile: {
      type: Schema.Types.ObjectId,
      ref: "files",
    },
    messenger: {
      type: Boolean,
      default: false,
    },
    theme: {type: String, default: "Light"},
    direction: {type: String, default: "rtl"}
  },
  {
    timestamps: true,
  }
);

const User = mongoose.model("users", userSchema);

module.exports = {User}
