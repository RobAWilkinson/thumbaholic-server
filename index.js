'use strict'

var server = require('http').createServer(),
  url = require('url'),
  WebSocketServer = require('ws').Server,
  wss = new WebSocketServer({ server: server }),
  express = require('express'),
  app = express(),
  port = process.env.PORT || 4080

var geojsonArea = require('geojson-area')
var mongoose = require('mongoose')
var findOrCreate = require('mongoose-findorcreate')
var GeoJSON = require('mongoose-geojson-schema')

let dbURL
if (process.env.MONGODB_URI) {
  dbURL = process.env.MONGODB_URI
} else {
  dbURL = 'mongodb://localhost:27017/thumbaholic'
}
mongoose.connect(dbURL)
mongoose.set('debug', true)

const Location = new mongoose.Schema({
  timestamp: Date,
  point: mongoose.Schema.Types.Point
}, { _id: false })
var userSchema = new mongoose.Schema({
  id: String,
  location: Location
})
userSchema.index({ 'location.point': '2dsphere' })
userSchema.plugin(findOrCreate)

var User = mongoose.model('users', userSchema)

var southernHalf = {
  'type': 'Polygon',
  'coordinates': [
    [
      [
        -118.25203478336334,
        34.05314609768037
      ],
      [
        -118.25160026550293,
        34.05289275967877
      ],
      [
        -118.25160294771193,
        34.05225718907956
      ],
      [
        -118.25286358594893,
        34.052666088193554
      ],
      [
        -118.25203478336334,
        34.05314609768037
      ]
    ]
  ]
}
var northernHalf = {
  'type': 'Polygon',
  'coordinates': [
    [
      [
        -118.25203478336334,
        34.05314609768037
      ],
      [
        -118.25160562992095,
        34.05289720421166
      ],
      [
        -118.2512703537941,
        34.0532816554229
      ],
      [
        -118.2517209649086,
        34.053577214995286
      ],
      [
        -118.25203478336334,
        34.05314609768037
      ]
    ]
  ]
}
var ardon = {
  'type': 'Polygon',
  'coordinates': [
    [
      [
        -118.02943021059035,
        33.951134208580704
      ],
      [
        -118.02912175655365,
        33.95096956356914
      ],
      [
        -118.0293497443199,
        33.95075596956595
      ],
      [
        -118.02963674068452,
        33.950913940182446
      ],
      [
        -118.02943021059035,
        33.951134208580704
      ]
    ]
  ]
}
var apple = {
  'type': 'Polygon',
  'coordinates': [
    [
      [
        -129.7265625,
        21.94304553343818
      ],
      [
        -129.7265625,
        47.98992166741417
      ],
      [
        -41.484375,
        47.98992166741417
      ],
      [
        -41.484375,
        21.94304553343818
      ],
      [
        -129.7265625,
        21.94304553343818
      ]
    ]
  ]
}
let users = []
app.get('/locations', (req, res) => {
  User.find({}, (err, users) => {
    if (err) {
      return console.log(err)
    }
    return res.json(users)
  })
})
app.get('/ping', (req, res) => {
  wss.clients.forEach(ws => {
    ws.send('message')
  })
  res.send('success')
})
app.get('/southern', (req, res) => {
  User.find({ 'location.point': { $geoWithin: { $geometry: southernHalf } } }, (err, user) => {
    if (err) {
      console.log(err)
      return res.send(err)
    } else {
      res.json(user)
    }
  })
})
app.get('/ardon' , (req, res) => {
  User.find({ 'location.point': { $geoWithin: { $geometry: ardon } } }, (err, user) => {
    if (err) {
      console.log(err)
      return res.send(err)
    } else {
      res.json(user)
    }
  })
})

app.get('/northern', (req, res) => {
  User.find({ 'location.point': { $geoWithin: { $geometry: northernHalf } } }, (err, user) => {
    if (err) {
      console.log(err)
      return res.send(err)
    } else {
      res.json(user)
    }
  })
})
app.get('/stages/:number', (req, res, next) => {
  var value = [1, 2, 3][Math.floor(Math.random() * 2)]
  if (req.params.number == 1) {
    return User.find({ 'location.point': { $geoWithin: { $geometry: northernHalf } } }, (err, user) => {
      var area = geojsonArea.geometry(northernHalf)

      if (err) {
        console.log(err)
        return res.send(err)
      } else {
        res.json({ value: users.length, timestamp: new Date() })
      }
    })
  }
  if (req.params.number == 2) {
    User.find({ 'location.point': { $geoWithin: { $geometry: southernHalf } } }, (err, user) => {
      var area = geojsonArea.geometry(southernHalf)
      if (err) {
        console.log(err)
        return res.send(err)
      } else {
        // res.json(user)
        res.json({ value, timestamp: new Date() })
      }
    })
  }
  if (req.params.number == 3) {
    console.log(apple)
    User.find({ 'location.point': { $geoWithin: { $geometry: ardon } } }, (err, user) => {
      var area = geojsonArea.geometry(southernHalf)
      console.log(area)
      if (err) {
        console.log(err)
        return res.send(err)
      } else {
        // res.json(user)
        res.json({ users.length, timestamp: new Date() })
      }
    })
  }
})

wss.on('connection', function connection (ws) {
  var location = url.parse(ws.upgradeReq.url, true)
  // you might use location.query.access_token to authenticate or share sessions
  // or ws.upgradeReq.headers.cookie (see http://stackoverflow.com/a/16395220/151312)
  ws.on('message', function incoming (message) {
    console.log('received a websocket message')
    let data = JSON.parse(message)
    users.push(data)
    console.log(data)
    User.findOrCreate({id: data.id}, function (err, user, created) {
      if (err) {
        console.log(err)
      } else {
        let coordinates = [data.longitude, data.latitude]
        user.location = {
          timestamp: Date.now(),
          point: {
            coordinates: coordinates,
            type: 'Point'
          }
        }
        user.save(err => {
          if (err) {
            console.log(err)
          }
        })
      }
    })
  })
})

server.on('request', app)
server.listen(port, function () { console.log('Listening on ' + server.address().port) })
