'use strict'

var server = require('http').createServer(),
  url = require('url'),
  WebSocketServer = require('ws').Server,
  wss = new WebSocketServer({ server: server }),
  express = require('express'),
  app = express(),
  port = process.env.PORT || 4080
let connections = []

let users = []

app.get('/locations', (req, res) => {
  res.json({users: users})
})
app.get('/ping', (req, res) => {
  connections.forEach(ws => {
    ws.send('messsage')
  })
  res.send('success')
})
app.use(function (req, res) {
  res.send({ msg: 'hello' })
})

wss.on('connection', function connection (ws) {
  var location = url.parse(ws.upgradeReq.url, true)
  // you might use location.query.access_token to authenticate or share sessions
  // or ws.upgradeReq.headers.cookie (see http://stackoverflow.com/a/16395220/151312)
  connections.push(ws)

  ws.on('message', function incoming (message) {
    let data = JSON.parse(message)
    users.push(data)
    console.log('received: %s', message)
  })
})

server.on('request', app)
server.listen(port, function () { console.log('Listening on ' + server.address().port) })
