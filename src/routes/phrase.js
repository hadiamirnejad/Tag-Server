const { connectDB } = require("../db");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const {Phrase, TagTemplate, Category, PhraseTag, Counter, PhrasesUploadFile} = require("../../models/Schemas");
const mongoose = require("mongoose");
const moment = require('jalali-moment')

connectDB();

//phrasetags.tags ===> state=0:تگ خورده state=1: ویرایش شده state=2: ابهام  state=3:پاسخ ابهام  state=4: رد شده state=5: اصلاح شده  state=6 تائید شده

const addPhrase = {
  path: "/api/addPhrase",
  method: "post",
  checkTokenValidation: true,
  handler: async (req, res) => {
    let { phrases, tagTemplates, user, categories, filename, title } = req.body;
    if(!phrases || !user || !title) return res.json({error: "invalid_parameters"})

    try {
      phrases.map(p => {
        p.userUpload = mongoose.Types.ObjectId(user)
        return p;
      });

      phrases.map(p => {
        p.categories = categories.map(c=> mongoose.Types.ObjectId(c))
        return p;
      });

      const ObjectIdTagTemplates = tagTemplates.map(tt=>{return {tagTemplate: mongoose.Types.ObjectId(tt.tagTemplate), users: tt.users.map(u=> mongoose.Types.ObjectId(u))}});
      const log = await PhrasesUploadFile.create({filename, count: phrases.length, title: title, categories: categories.map(c=> mongoose.Types.ObjectId(c)), tagTemplates: ObjectIdTagTemplates, user: mongoose.Types.ObjectId(user)})

      let bulk = Phrase.collection.initializeUnorderedBulkOp();
      phrases.map((p, idx)=>bulk.find({text: p.text}).upsert().updateOne({$set:{text: p.text, samples: p.samples, description: p.description, userUpload: p.userUpload, fileId: mongoose.Types.ObjectId(log._id)}, $setOnInsert: {order: idx + 1}, $addToSet: {categories: {$each: p.categories}}}))

      const newPhrases = await bulk.execute();
      
      const modifiedPhrases = await Phrase.find({text: {$in: phrases.map(p=>p.text)}}).sort([['order',1]])
      let newPhraseTags;
      if(tagTemplates){
        let bulk2 = PhraseTag.collection.initializeUnorderedBulkOp();
        for( let i=0; i< ObjectIdTagTemplates.length; i++){
          const tId = ObjectIdTagTemplates[i].tagTemplate;
          modifiedPhrases.map((p, idx)=>bulk2.find({phrase: p._id, tagTemplate: tId}).upsert().updateOne({$set:{phrase: p._id, status: 0, tagTemplate: tId, phraseTags: [], forUsers: ObjectIdTagTemplates[i].users, fileId: mongoose.Types.ObjectId(log._id)}, $setOnInsert: {order: idx + 1}}))
        }
        newPhraseTags = await bulk2.execute();
      }
      const files = await PhrasesUploadFile.find().sort([['createdAt',-1]]).populate({path:'user',select: {'name':1,'_id':1,'username':1}}).populate({path:'tagTemplates.users',select: {'name':1,'_id':1,'username':1}}).populate({path:'categories',select: {'title':1}}).populate({path:'tagTemplates.tagTemplate',select: {'title':1}});
      return res.json({newPhrases, newPhraseTags, files});
    } catch (error) {
      return res.json({error: error});
    }
  },
};

const getPhrasesUploadFiles = {
  path: "/api/getPhrasesUploadFiles",
  method: "get",
  checkTokenValidation: false,
  handler: async (req, res) => {
    const files = await PhrasesUploadFile.find().sort([['createdAt',-1]]).populate({path:'user',select: {'name':1,'_id':1,'username':1}}).populate({path:'tagTemplates.users',select: {'name':1,'_id':1,'username':1}}).populate({path:'categories',select: {'title':1}}).populate({path:'tagTemplates.tagTemplate',select: {'title':1}});
    return res.json(files);
  }
}

const getPhrases = {
  path: "/api/getPhrases",
  method: "post",
  checkTokenValidation: true,
  handler: async (req, res) => {
    const { currentFile, userId, status, forUsers } = req.body;

    let limit=1;
    let phrasesCount = 0;
    let taggedCount = 0;

    let search = {};
    if(currentFile){
      search.fileId = mongoose.Types.ObjectId(currentFile)
    }

    if(status === 0){
      search.status = status
      limit=1;
      if(forUsers){
        search.forUsers = {$in: [forUsers]}
        const cForUser = await PhraseTag.count(search)
        if(cForUser === 0){
          const { forUsers, ...other } = search;
          search = other;
          search.$or=[{forUsers: {$exists: false}},{forUsers:null}]
        }
      }
      taggedCount = await PhraseTag.count({...search, status: {$ne: 0}});
    }

    //انتخاب شده و آماده تگ زنی
    if(status === 1){
      search.userTagged = mongoose.Types.ObjectId(userId)
      search.status = {$in:[1]}
      limit=1;
    }

    //انتخاب شده یا «تگ خورده و ارسال نشده
    if(status === 2){
      search.userTagged = mongoose.Types.ObjectId(userId)
      search.status = {$in:[2]}
      limit=2000;
    }

    //موارد دارای ابهام
    if(status === 3){
      search.status = 3;
      limit=200;
      if(!forUsers){
        search.$or=[{userChecked: {$exists: false}},{userChecked:null}];
        limit=1;
      }
      else{
        search.forUsers = {$in: [mongoose.Types.ObjectId(userId)]}
      }
    }


    //آماده بازبینی
    if(status === 4){
      search.status = 4;
      // search.userChecked = mongoose.Types.ObjectId(userId)
      limit=200;
    }

    //برگشت داده شده
    if(status === 6){
      search.status = 6;
      search.userTagged = mongoose.Types.ObjectId(userId);
      limit=1;
    }
    try {
      let phrases = await PhraseTag.find(search).sort([['order', 1]]).limit(limit).populate({path:'phrase'}).populate({path: 'tagTemplate', populate:{path:'template.field',select: {'type':1,'parameters':1}}}).populate({path:'userTagged',select: {'name':1,'_id':1,'username':1}}).populate({path:'userChecked',select: {'name':1,'_id':1,'username':1}}).populate({path:'fileId',select: {'title':1}});
      phrasesCount = await PhraseTag.count({$or: [{forUsers: {$in: [forUsers]}}, {forUsers: {$exists: false}},{forUsers:null}] ,fileId: mongoose.Types.ObjectId(currentFile)});

      if(status == 0){
        const ids = phrases.map(p=>p._id)
        const phrases1 = await PhraseTag.updateMany({_id: {$in:ids}}, {status: 1, userTagged: mongoose.Types.ObjectId(userId)}, {new: true})
        search.userTagged = mongoose.Types.ObjectId(userId)
        search.status = {$in:[1]}
        phrases = await PhraseTag.find(search).sort([['order', 1]]).populate({path:'phrase'}).populate({path: 'tagTemplate', populate:{path:'template.field',select: {'type':1,'parameters':1}}});
      }
      if(status === 3){
        const total = await PhraseTag.count(search);

        if(phrases.length > 0)
          phrases[0] = {...phrases[0]._doc, total:total};
      }

      return res.json({phrases, phrasesCount, taggedCount})
    } catch (error) {
      console.log(error)
      return res.json({error: 'خطایی رخ داده است.'})
    }
  },
}

const getFilesStat = {
  path: "/api/getFilesStat",
  method: "get",
  checkTokenValidation: false,
  handler: async (req, res) => {
    try {
      let filesStat = await PhraseTag.aggregate([
        {
          '$lookup': {
            'from': 'phrases', 
            'localField': 'phrase', 
            'foreignField': '_id', 
            'as': 'phrase'
          }
        }, {
          '$lookup': {
            'from': 'tagtemplates', 
            'localField': 'tagTemplate', 
            'foreignField': '_id', 
            'as': 'tagTemplate'
          }
        }, {
          '$lookup': {
            'from': 'files', 
            'localField': 'fileId', 
            'foreignField': '_id', 
            'as': 'file'
          }
        }, {
          '$unwind': {
            'path': '$tagTemplate'
          }
        }, {
          '$unwind': {
            'path': '$phrase'
          }
        }, {
          '$unwind': {
            'path': '$file'
          }
        }, {
          '$project': {
            'tagTemplate': 1, 
            'status': 1, 
            'tagTemplate': {
              '$toString': '$tagTemplate.title'
            }, 
            'categories': '$phrase.categories', 
            'userTagged': '$userTagged', 
            'fileId': 1, 
            'file': '$file.title'
          }
        }, {
          '$group': {
            '_id': {
              'fileId': '$fileId', 
              'file': '$file', 
              'status': '$status'
            }, 
            'count': {
              '$sum': 1
            }
          }
        }, {
          '$sort': {
            '_id.fileId': -1, 
            'count': -1
          }
        }, {
          '$group': {
            '_id': {
              'fileId': '$_id.fileId', 
              'file': '$_id.file'
            }, 
            'stats': {
              '$push': {
                'status': '$_id.status', 
                'total': '$count'
              }
            }
          }
        }, {
          '$project': {
            '_id': '$_id.fileId', 
            'file': '$_id.file', 
            'stats': '$stats'
          }
        }, {
          '$sort': {
            '_id': -1,
          }
        }
      ]);

      const sumOfArray = ( array, initialValue = 0) =>{
        const sumWithInitial = array.reduce(
          (accumulator, currentValue) => accumulator + currentValue,
          initialValue
        );
        return sumWithInitial;
      }
      const files = await PhrasesUploadFile.find({'_id': {$in:filesStat.map(f=>f._id)}}).populate({path:'user',select: {'name':1,'_id':1,'username':1}}).populate({path:'tagTemplates.users',select: {'name':1,'_id':1,'username':1}}).populate({path:'categories',select: {'title':1}}).populate({path:'tagTemplates.tagTemplate',select: {'title':1}});

      const filesStatWithDetails = filesStat.map(f=>{return {...f, tagTemplates:files.filter(ff=>ff._id.toString()==f._id.toString())[0].tagTemplates, categories:files.filter(ff=>ff._id.toString()==f._id.toString())[0].categories, stats: f.stats.map((s, sIdx)=>{return {...s, percent: Math.round(sumOfArray(f.stats.map(fs=>fs.total).filter((fs, fsIdx)=>fsIdx>=sIdx))/sumOfArray(f.stats.map(fs=>fs.total))*1000)/10}})}})
      return res.json(filesStatWithDetails)
    } catch (error) {
      console.log(error)
      return res.json({error: 'خطایی رخ داده است.'})
    }
  }
}

const getUserFiles = {
  path: "/api/getUserFiles",
  method: "post",
  checkTokenValidation: true,
  handler: async (req, res) => {
    const { userId } = req.body;
    try {
      let userFiles = await PhraseTag.aggregate([
        {
          '$match': {
            'forUsers': {
              '$in': [mongoose.Types.ObjectId(userId)]
            }
          }
        }, {
          '$lookup': {
            'from': 'files', 
            'localField': 'fileId', 
            'foreignField': '_id', 
            'as': 'fileId'
          }
        }, {
          '$unwind': {
            'path': '$fileId'
          }
        }, {
          '$group': {
            '_id': {
              'file': '$fileId.title', 
              'fileId': '$fileId._id', 
              'status': '$status'
            }, 
            'count': {
              '$sum': 1
            }
          }
        }, {
          '$sort': {
            '_id.fileId': 1, 
            'count': -1
          }
        }, {
          '$project': {
            'file': '$_id.file', 
            'fileId': '$_id.fileId', 
            'status': '$_id.status', 
            'count': 1
          }
        }
      ]);

      return res.json(userFiles)
    } catch (error) {
      return res.json({error: 'خطایی رخ داده است.'})
    }
  }
}

const getSubmittedPhrases = {
  path: "/api/getSubmittedPhrases",
  method: "post",
  checkTokenValidation: false,
  handler: async (req, res) => {
    const { fileIds, status, tagTemplates, withExamples } = req.body;

    let search = {};
    if(!fileIds) return;

    search.fileId = {$in: fileIds.map(f=>mongoose.Types.ObjectId(f))}

    if(status.length > 0){
      search.status = {$in: status};
    }

    if(tagTemplates.length > 0){
      search.tagTemplate = {$in: tagTemplates.map(t=>mongoose.Types.ObjectId(t))}
    }

    try {
      let phrases = await PhraseTag.find(search,{'phrase':1,'phraseTags':1,'tagTemplate':1,'userTagged':1,'userChecked':1, 'fileId':1, 'status': 1}).sort([['order', 1]]).populate({path:'phrase', select:{'text':1,'description':1,'samples':1}}).populate({path:'tagTemplate', select:{'title':1,'template':1}}).populate({path:'userChecked',select: {'name':1}}).populate({path:'userTagged',select: {'name':1}}).populate({path:'fileId',select: {'title':1}});

      const result = {'عبارات': phrases.map(r=>{return { 'عبارت':r.phrase.text, ... !r.phraseTags.slice(-1)[0]?[]:Object.assign({}, ...r.phraseTags.slice(-1)[0]?.tags.map(t=>{return{[t.text]:t.values.join('_')}}))}})}
      if(withExamples){
        result['مثال‌ها'] = phrases.map((p)=>{return{ 'عبارت':p.phrase.text, ... Object.assign({}, ... p.phrase.samples.map((s,idx)=>{return {[idx+1]:s}}))}})
      }
      result['توضیحات'] = phrases.map((r)=>{return{ 'فایل':r.fileId.title,'عبارت':r.phrase.text, 'وضعیت':['خام','در اختیار کارشناس','تگ خورده','دارای ابهام','در اختیار بازبین','اصلاح شده','برگشت شده','تائید شده'][r.status], 'قالب':r.tagTemplate.title, 'کاربر تگ زننده':r.userTagged?.name, 'کاربر بازبین':r.userChecked?.name, 'زمان تائید': r.phraseTags.length>0?moment(new Date(r.phraseTags.slice(-1)[0].date), 'YYYY/MM/DD HH:mm:ss').locale('fa').format('YYYY-MM-DD HH:mm:ss'):''}})
      return res.json(result)
    } catch (error) {
      console.log(error)
      return res.json({error: 'خطایی رخ داده است.'})
    }
  },
}

const deletePhrases = {
  path: "/api/deletePhrases",
  method: "get",
  checkTokenValidation: false,
  handler: async (req, res) => {

    const phraseTags = await PhraseTag.deleteMany();
    const phrases = await Phrase.deleteMany();
    const files = await PhrasesUploadFile.deleteMany();

    return res.json({phraseTags, phrases, files})
  },
}

const editPhrase = {
  path: "/api/editPhrase",
  method: "post",
  checkTokenValidation: true,
  handler: async (req, res) => {
    const {tag, id, status, checker, state} = req.body;
    try{
      let phraseTags;
      if(checker){
        phraseTags = await PhraseTag.findByIdAndUpdate(id, {status: status, userChecked: checker,$push: {phraseTags: {...tag, date: (new Date()).getTime(), state:state}}},{new: true}).sort([['order', 1]]).populate({path:'phrase'}).populate({path: 'tagTemplate', populate:{path:'template.field',select: {'type':1,'parameters':1}}}).populate({path:'userTagged',select: {'name':1,'_id':1,'username':1}}).populate({path:'userChecked',select: {'name':1,'_id':1,'username':1}}).populate({path:'fileId',select: {'title':1}});
      }
      else{
        phraseTags = await PhraseTag.findByIdAndUpdate(id, {status: status, $push: {phraseTags: {...tag, date: (new Date()).getTime(), state:state}}},{new: true}).sort([['order', 1]]).populate({path:'phrase'}).populate({path: 'tagTemplate', populate:{path:'template.field',select: {'type':1,'parameters':1}}}).populate({path:'userTagged',select: {'name':1,'_id':1,'username':1}}).populate({path:'userChecked',select: {'name':1,'_id':1,'username':1}}).populate({path:'fileId',select: {'title':1}});
      }

      return res.json(phraseTags)
    }
    catch(err){
      return res.json({error: 'خطایی رخ داده است.'})
    }
  },
}

const conflictPhrase = {
  path: "/api/conflictPhrase",
  method: "post",
  checkTokenValidation: true,
  handler: async (req, res) => {
    const {tag, id} = req.body;
    try{
      const phraseTags = await PhraseTag.findByIdAndUpdate(id, {status: 3, $push: {phraseTags: {...tag, date: (new Date()).getTime(), state:2}}},{new: true}).sort([['order', 1]]).populate({path:'phrase'}).populate('tagTemplate');
      return res.json(phraseTags)
    }
    catch(err){
      return res.json({error: 'خطایی رخ داده است.'})
    }
  },
}

const sendPhrasesTagForCkecker = {
  path: "/api/sendPhrasesTagForCkecker",
  method: "post",
  checkTokenValidation: true,
  handler: async (req, res) => {
    const {userId, ids} = req.body;
    if(!ids || !userId){
      return res.json({error: 'خطایی رخ داده است.'})
    }

    try{
      let bulk = PhraseTag.collection.initializeUnorderedBulkOp();
      ids.map((pId, idx)=>bulk.find({_id: mongoose.Types.ObjectId(pId)}).updateOne({$set:{ status: 4 }}))
      const newPhraseTags = await bulk.execute();

      const updatedPhrases = await PhraseTag.find({'_id':{$in:ids.map(id=>mongoose.Types.ObjectId(id))}}).populate({path:'phrase'}).populate('tagTemplate').populate({path:'userTagged',select: {'name':1,'_id':1,'username':1}}).populate({path:'userChecked',select: {'name':1,'_id':1,'username':1}})
      res.json(updatedPhrases)
    }
    catch(err){
      return res.json({error: 'خطایی رخ داده است.'})
    }
  },
}

const rejectPhrasesTag = {
  path: "/api/rejectPhrasesTag",
  method: "post",
  checkTokenValidation: true,
  handler: async (req, res) => {
    const {checker, ids, tags} = req.body;
    if(!ids || !checker){
      return res.json({error: 'خطایی رخ داده است.'})
    }

    try{
      let bulk = PhraseTag.collection.initializeUnorderedBulkOp();
      
      ids.map((pId, idx)=>bulk.find({_id: mongoose.Types.ObjectId(pId)}).updateOne({$set:{ status: 6, userChecked: mongoose.Types.ObjectId(checker) },$push: {phraseTags: {...tags[idx][0], date: (new Date()).getTime(), state:4}}}))
      const newPhraseTags = await bulk.execute();

      const updatedPhrases = await PhraseTag.find({'_id':{$in:ids.map(id=>mongoose.Types.ObjectId(id))}}).populate({path:'phrase'}).populate('tagTemplate').populate({path:'userTagged',select: {'name':1,'_id':1,'username':1}}).populate({path:'userChecked',select: {'name':1,'_id':1,'username':1}})
      res.json(updatedPhrases)
    }
    catch(err){
      console.log(err)
      return res.json({error: 'خطایی رخ داده است.'})
    }
  },
}

const submitPhrasesTag = {
  path: "/api/submitPhrasesTag",
  method: "post",
  checkTokenValidation: true,
  handler: async (req, res) => {
    const {checker, ids, tags, userId} = req.body;
    if(!ids || !tags){
      return res.json({error: 'خطایی رخ داده است.'})
    }
    try{
      let bulk = PhraseTag.collection.initializeUnorderedBulkOp();
      if(checker){
        ids.map((pId, idx)=>bulk.find({_id: mongoose.Types.ObjectId(pId)}).updateOne({$set:{ status: 7, userChecked: mongoose.Types.ObjectId(checker) },$push: {phraseTags: {...tags[idx][0], date: (new Date()).getTime(), state:6}}}))
        const newPhraseTags = await bulk.execute();
      }
      else{
        ids.map((pId, idx)=>bulk.find({_id: mongoose.Types.ObjectId(pId)}).updateOne({$set:{ status: 7 },$push: {phraseTags: {...tags[idx], date: (new Date()).getTime(), state:6, user: mongoose.Types.ObjectId(userId)}}}))
        const newPhraseTags = await bulk.execute();
      }

      const updatedPhrases = await PhraseTag.find({'_id':{$in:ids.map(id=>mongoose.Types.ObjectId(id))}}).populate({path:'phrase'}).populate('tagTemplate').populate({path:'userTagged',select: {'name':1,'_id':1,'username':1}}).populate({path:'userChecked',select: {'name':1,'_id':1,'username':1}})
      res.json(updatedPhrases)
    }
    catch(err){
      return res.json({error: 'خطایی رخ داده است.'})
    }
  },
}

const getPhrasesStatistics = {
  path: "/api/getPhrasesStatistics",
  method: "post",
  checkTokenValidation: false,
  handler: async (req, res) => {
    const {categories, users, fromDate, toDate} = req.body;
    // if(!categories){
    //   return res.json({error: 'خطایی رخ داده است.'})
    // }
    if(toDate < fromDate) return;

    let Date1 = moment().hour(0).subtract(30, "day").minute(0).second(0).millisecond(0);
    let Date2 = moment().hour(0).minute(0).second(0).millisecond(0);

    if(fromDate){
      Date1 = moment.from(fromDate).hour(0).minute(0).second(0).millisecond(0);
    }

    if(toDate){
      Date2 = moment.from(toDate).hour(23).minute(59).second(59).millisecond(0);
    }

    try{
      const conditions = [
        {
          '$addFields': {
            'date': {
              '$first': '$phraseTags.date'
            }
          }
        }, {
          '$match': {
            'date': {
              '$gt': Date1.unix() * 1000,
              '$lt': Date2.unix() * 1000,
            }
          }
        }, {
          '$lookup': {
            'from': 'phrases', 
            'localField': 'phrase', 
            'foreignField': '_id', 
            'as': 'phrase'
          }
        }, {
          '$lookup': {
            'from': 'tagtemplates', 
            'localField': 'tagTemplate', 
            'foreignField': '_id', 
            'as': 'tagTemplate'
          }
        }, {
          '$unwind': {
            'path': '$tagTemplate'
          }
        }, {
          '$unwind': {
            'path': '$phrase'
          }
        }, {
          '$project': {
            'tagTemplate': 1, 
            'status': 1, 
            'tagTemplate': {
              '$toString': '$tagTemplate.title'
            }, 
            'categories': '$phrase.categories',
            'userTagged': "$userTagged"
          }
        },
        //$match
        {
          '$group': {
            '_id': {
              'tagTemplate': '$tagTemplate', 
              'status': '$status'
            }, 
            'count': {
              '$sum': 1
            }
          }
        }, {
          '$sort': {
            '_id.status': 1
          }
        }
      ]

      if(categories.length > 0){
        conditions.splice(7,0, {
          '$match': {
            'categories': {
              '$all': categories.map(c=> mongoose.Types.ObjectId(c))
            }
          }
        })
      }

      if(users.length > 0){
        conditions.splice(7,0, {
          '$match': {
            'userTagged': {
              '$in': users.map(u=> mongoose.Types.ObjectId(u))
            }
          }
        })
      }
      const log = await PhraseTag.aggregate(conditions);
      res.json(log)
    }
    catch(err){
      console.log(err)
      return res.json({error: 'خطایی رخ داده است.'})
    }
  },
}

const getUserStatistics = {
  path: "/api/getUserStatistics",
  method: "post",
  checkTokenValidation: false,
  handler: async (req, res) => {
    const {users, fromDate, toDate} = req.body;
    if(!users){
      return res.json({error: 'خطایی رخ داده است.'})
    }
    if(toDate < fromDate) return;

    let Date1 = moment().hour(0).subtract(30, "day").minute(0).second(0).millisecond(0);
    let Date2 = moment().hour(0).minute(0).second(0).millisecond(0);

    if(fromDate){
      Date1 = moment.from(fromDate).hour(0).minute(0).second(0).millisecond(0);
    }

    if(toDate){
      Date2 = moment.from(toDate).hour(23).minute(59).second(59).millisecond(0);
    }
    const daysDiff = Date2.diff(Date1,'days') + 1;
    console.log('daysDiff:', daysDiff)
    // console.log('date1:', Date1.unix() * 1000)
    console.log('date2:', Date2.unix() * 1000)

    const colors = ["#d45087","#665191","#f95d6a","#2f4b7c","#ff7c43","#003f5c","#ffa600","#a05195"]
    try{
      const conditions = [
        [
          {
            '$addFields': {
              'date': {
                '$first': '$phraseTags.date'
              }
            }
          }, {
            '$match': {
              'date': {
                '$gt': Date1.unix() * 1000,
                '$lt': Date2.unix() * 1000,
              }
            }
          }, {
            '$addFields': {
              'state': {
                '$first': '$phraseTags.state'
              }, 
              'date': {
                '$toDate': '$date'
              }, 
              'user': {
                '$first': '$phraseTags.user'
              }
            }
          }, {
            '$match': {
              '$or': [
                {
                  'state': 0, 
                  'user': {
                    '$in': users
                  }
                }, {
                  'state': 2, 
                  'user': {
                    '$in': users
                  }
                }
              ]
            }
          }, {
            '$group': {
              '_id': {
                'template': '$tagTemplate', 
                'date': {
                  '$dateToString': {
                    'format': '%Y-%m-%d', 
                    'date': '$date'
                  }
                }, 
                'state': '$state'
              }, 
              'count': {
                '$sum': 1
              }
            }
          }, {
            '$sort': {
              '_id.template': 1, 
              '_id.date': 1, 
              '_id.state': 1
            }
          }, {
            '$lookup': {
              'from': 'tagtemplates', 
              'localField': '_id.template', 
              'foreignField': '_id', 
              'as': 'template'
            }
          }, {
            '$project': {
              '_id.date': 1, 
              'template': {
                '$first': '$template.title'
              }, 
              'date': '$_id.date', 
              'state': '$_id.state',
              'count': '$count'
            }
          }
        ]
      ]
      const log = await PhraseTag.aggregate(conditions);

      const days = [...Array(daysDiff)].map((_, idx, self)=> moment.from(toDate).subtract(self.length-idx-1, "day").locale('fa').format('YYYY/MM/DD'));

      const templates = [...new Set(log.map(item => item.template))];
      const stateTemplate = [...templates.map(t=>{return {template: t, state: 0, label: `تگ(${t})`}}), ...templates.map(t=>{return {template: t, state: 2, label: `ابهام(${t})`}})]
      const result = {
        labels: days,
        datasets: stateTemplate.map((t,idx)=>{return {
          label: t.label, 
          data: days.map(d=>{ 
          return log.filter(l=>d===moment(l.date, 'YYYY/M/D').locale('fa').format('YYYY/MM/DD') && t.template === l.template && t.state === l.state).length>0?log.filter(l=>d===moment(l.date, 'YYYY/M/D').locale('fa').format('YYYY/MM/DD') && t.template === l.template && t.state === l.state)[0].count:0
        }),
        borderColor: colors[idx % colors.length],
        backgroundColor: colors[idx % colors.length]
      }})}
      // templates.map(t=>{return {template: t, data: log.filter(l=>l.template === t).map(l=>{return {label: moment(l.date, 'YYYY/M/D').locale('fa').format('YYYY/MM/DD'), value: l.count}})}})
      res.json(result)
    }
    catch(err){
      console.log(err)
      return res.json({error: 'خطایی رخ داده است.'})
    }
  },
}

const changeFileUsers = {
  path: "/api/changeFileUsers",
  method: "post",
  checkTokenValidation: true,
  handler: async (req, res) => {
    const {fileId, tagTemplate, users} = req.body;

    try {
      if(!fileId || !tagTemplate) return res.json({error: 'اطلاعات وارد شده اشتباه است.'});
      const file = await PhrasesUploadFile.findById(fileId);
      const tagTemplates = file.tagTemplates.map(ft=>{if(ft.tagTemplate.toString()===tagTemplate){return {...ft._doc, users: users.map(u=>mongoose.Types.ObjectId(u))}}else{return ft}});
      const updatedFile = await PhrasesUploadFile.findByIdAndUpdate(fileId, {tagTemplates: tagTemplates}, {new: true})
      const phrasesTags = await PhraseTag.updateMany({$where: "this.phraseTags.length == 0", fileId: mongoose.Types.ObjectId(fileId), tagTemplate: mongoose.Types.ObjectId(tagTemplate)}, {forUsers: users.map(u=>mongoose.Types.ObjectId(u))},{new: true})
      const files = await PhrasesUploadFile.find().sort([['createdAt',-1]]).populate({path:'user',select: {'name':1,'_id':1,'username':1}}).populate({path:'tagTemplates.users',select: {'name':1,'_id':1,'username':1}}).populate({path:'categories',select: {'title':1}}).populate({path:'tagTemplates.tagTemplate',select: {'title':1}});
      return res.json(files)
    } catch (error) {
      console.log(error)
    }
  }
}

const deleteFile = {
  path: "/api/deleteFile",
  method: "post",
  checkTokenValidation: true,
  handler: async (req, res) => {
    const {fileId} = req.body;

    try {
      if(!fileId) return res.json({error: 'اطلاعات وارد شده اشتباه است.'});
      const file = await PhrasesUploadFile.findById(fileId);
      const deleteFilesCount = await PhrasesUploadFile.findByIdAndRemove(fileId)
      const deletephrasesCount = await Phrase.deleteMany({fileId: mongoose.Types.ObjectId(fileId)})
      const deletephrasesTagsCount = await PhraseTag.deleteMany({fileId: mongoose.Types.ObjectId(fileId)})
      const files = await PhrasesUploadFile.find().sort([['createdAt',-1]]).populate({path:'user',select: {'name':1,'_id':1,'username':1}}).populate({path:'tagTemplates.users',select: {'name':1,'_id':1,'username':1}}).populate({path:'categories',select: {'title':1}}).populate({path:'tagTemplates.tagTemplate',select: {'title':1}});
      return res.json(files)
    } catch (error) {
      console.log(error)
    }
  }
}

module.exports = { addPhrase, getPhrases, deletePhrases, editPhrase, sendPhrasesTagForCkecker, submitPhrasesTag, rejectPhrasesTag, conflictPhrase, getSubmittedPhrases, getPhrasesStatistics, getUserStatistics, getPhrasesUploadFiles, getUserFiles, getFilesStat, changeFileUsers, deleteFile };
