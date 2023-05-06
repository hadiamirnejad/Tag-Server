const {verify} = require('jsonwebtoken')
const {Token} = require('../models/Schemas')

const checkTokenValidation = async(req, res, next) => {
  const accessToken = req.header("accessToken");
  if(!accessToken) return res.json({error: "user_not_logged_in"})

  try {
    // const validToken = verify(accessToken, process.env.JWT_SECRET);
    const validToken = await Token.findOne({token: accessToken});
    if(validToken){
      return next();
    }
    else {return res.json({error: "token_not_valid"})}
  } catch (err) {
    return res.json({error: "some_errors_oc"})
  }
}

module.exports = {checkTokenValidation};