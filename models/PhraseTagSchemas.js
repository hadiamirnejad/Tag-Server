const { default: mongoose } = require("mongoose");
const Schema = mongoose.Schema;

const phraseTagSchema = new Schema(
  {
    phrase: {type: Schema.Types.ObjectId, ref: 'phrases'},
    tagTemplate: {type: Schema.Types.ObjectId, ref: 'tagtemplates'},
    fileId: {type: Schema.Types.ObjectId, ref: 'files'},
    //Status: 0=base ,1=choose by tagger , 2=tagged by tagger, 3=confused, 4=send by tagger, 5=edited by checker, 6=rejected by checker, 7=accepted by checker
    status: { type: Number, default: 0 },
    phraseTags: {type: [Object], default: []},
    userTagged: {type: Schema.Types.ObjectId, ref: 'users'},
    userChecked: {type: Schema.Types.ObjectId, ref: 'users'},
    order: {type: Number, default: 0},
    forUsers: {type: [Schema.Types.ObjectId], ref: 'users'}
  },
  {
    timestamps: true,
  }
);

const PhraseTag = mongoose.model("phrasetags", phraseTagSchema);


module.exports = { PhraseTag }
