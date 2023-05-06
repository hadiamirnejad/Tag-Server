const { MongoClient } = require("mongodb");
const { default: mongoose } = require("mongoose");

let client;

const connectDB = () => {
    if(mongoose.connections[0].readyState){
      console.log('Already connected.')
      return;
    }
    console.log(process.env.DB_URL)
    mongoose.connect(process.env.DB_URL, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    }, err => {
      if (err) throw err;
      console.log('Connected to MongoDB.')
    });
  }

module.exports = { connectDB };
