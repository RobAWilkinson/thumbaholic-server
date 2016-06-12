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
  coordinates: [
    [
      [-118.252903, 34.053053 ], [-118.251739, 34.052379 ],
      [-118.252657, 34.051472 ], [ -118.253722, 34.052210], [-118.252903, 34.053053 ]
    ]
  ],
  type: 'Polygon'
}
var northernHalf = {
  coordinates: [
    [
      [-118.252903, 34.053053 ], [-118.251739, 34.052379 ],
      [-118.251270, 34.053079 ], [-118.252210, 34.053790 ], [-118.252903, 34.053053 ]
    ]
  ],
  type: 'Polygon'
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
  User.find({ location: { $geoWithin: { $geometry: southernHalf } } }, (err, user) => {
    if (err) {
      console.log(err)
      return res.send(err)
    } else {
      res.json(user)
    }
  })
})

app.get('/northern', (req, res) => {
  User.find({ location: { $geoWithin: { $geometry: northernHalf } } }, (err, user) => {
    if (err) {
      console.log(err)
      return res.send(err)
    } else {
      res.json(user)
    }
  })
})
app.get('/stages/:number', (req, res, next) => {
  if (req.params.number == 1) {
    return User.find({ 'location.point': { $geoWithin: { $geometry: northernHalf } } }, (err, user) => {
      var area = geojsonArea.geometry(northernHalf)

      if (err) {
        console.log(err)
        return res.send(err)
      } else {
        console.log(area)
        console.log()
        res.json({ value: 'hot', timestamp: new Date() })
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
        res.json(user)
      }
    })
  }
  if (req.params.number == 3) {
    console.log(apple)
    User.find({ 'location.point': { $geoWithin: { $geometry: apple } } }, (err, user) => {
      var area = geojsonArea.geometry(southernHalf)
      console.log(area)
      if (err) {
        console.log(err)
        return res.send(err)
      } else {
        res.json(user)
      }
    })
  }
})

wss.on('connection', function connection (ws) {
  var location = url.parse(ws.upgradeReq.url, true)
  // you might use location.query.access_token to authenticate or share sessions
  // or ws.upgradeReq.headers.cookie (see http://stackoverflow.com/a/16395220/151312)
  connections.push(ws)
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
