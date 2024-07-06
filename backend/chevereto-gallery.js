const multer = require('multer')
var path = require('path')
var fs = require('fs')
const request = require('request')
const superagent = require('superagent')

var tweet
module.exports = (app) => {
  const Datastore = require('nedb')
  var db = new Datastore({ filename: path.join(__dirname, '/db/saved_sketches'), autoload: true })

  //console.log('dir is', __dirname)
  var sketches = []

  db.count({}, function (err, count) {
    // console.log("There are " + count + " entries in the database");
    if (err) console.log("There's a problem with the database: ", err);
    else if (count <= 0) { // empty database so needs populating
      // default users inserted in the database
      db.insert(sketches, function (err, testAdded) {
        if (err) console.log("There's a problem with the database: ", err);
        else if (testAdded) console.log("Default users inserted in the database");
      });
    }
  });

  app.get('/sketches', function (request, response) {
    db.find({}, function (err, entries) {
      if (err) {
        console.log('problem with db', err)
      } else {
        var res = entries.map((entry) => {
          entry.sketch_id = entry._id
          return entry
        })
        response.send(entries)
      }
    })
  })

  app.get('/sketchById', function (request, response) {
    db.find({ _id: request.query.sketch_id }, function (err, entries) {
      if (err) {
        console.log('problem with db', err)
      } else {
        var res = entries.map((entry) => {
          entry.sketch_id = entry._id
          return entry
        })
        response.send(entries)
      }
    })
  })

  app.post('/sketch', function (request, response) {
    //  console.log('post sketch', request.query)
    db.insert({
      "code": request.query.code,
      "parent": request.query.parent,
      "date": new Date()
    }, function (err, sketchAdded) {
      if (err) {
        console.log('error adding', err)
        response.sendStatus(500)
      } else {
        //  console.log('ADDED', sketchAdded)
        response.send(sketchAdded._id)
      }
    })
  })

  var storage = multer.diskStorage({
    destination: function (req, file, cb) {
      cb(null, path.join(__dirname + '/uploads/'))
      },
      filename: function (req, file, cb) {
        cb(null, file.originalname + '.png')
      }
  })

  const maxSize = 1024 * 1024 * 16
  const upload = multer({ storage: storage, limits: { fileSize: maxSize } })
  app.post("/image", upload.single('previewImage'), (req, response) => {
    if(process.env.CHEVERETO_API_KEY && process.env.CHEVERETO_API_URL) {
      console.log('UPLOADING TO CHEVERETO');
      superagent
      .post(process.env.CHEVERETO_API_URL)
      .field('key', process.env.CHEVERETO_API_KEY)
      .attach('source', req.file.path, {filename: `${req.query.name}: ${req.query.sketch_id}`})
      .end((err, res) => {
        if (err) {
          console.log(err)
          response.status(500).send('error upload to chevereto')
        } else {
          console.log('Media uploaded!')
          response.send('Media uploaded!')
          db.update(
            { _id: req.query.sketch_id },
            { $set: { name: req.query.name, chevereto_url: res.body.image.url }
          }, {}, function (err, numReplaced) {});
        }
      });
    }
  });
}
