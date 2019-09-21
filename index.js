var express = require('express');
//var bodyParser = require('body-parser');
var app = express();
var server = require('http').createServer(app);
var io = require('socket.io')(server);
var config = {};
try {config=require('./config.json')} catch(err){};
var port = process.env.PORT || config.port || 3000;
server.listen(port, function () {console.log('\x1b[44m SERVER LISTENING ON PORT '+port+' \x1b[0m')});

var path = require('path');
app.use(express.static(path.join(__dirname, 'public')));
app.use(function(req, res, next){res.sendFile('index.html',{root:path.join(__dirname,'public')})});

let names = ['Kermit the Frog','Miss Piggy','Fozzie Bear','Gonzo','Rowlf the Dog','Scooter','Animal','Pepe the King Prawn','Rizzo the Rat','Walter','Dr. Teeth','Statler','Waldorf','Bunsen Honeydew','Beaker','The Swedish Chef','Sam Eagle','Camilla the Chicken','Bobo the Bear','Clifford'];

io.on('connection', function (socket) {
  socket.emit('data',{message: 'Welcome '+socket.id+'!'});
  join(socket,socket.client.request.headers.referer.match(/[^\/]\/([^\/]*)\/?$/i)[1]);
  set_name(socket,names[Math.floor(Math.random()*names.length)]);
  // socket.emit = reply only to the client who asked
  // socket.broadcast.emit = reply to all clients except the one who asked
  // io.sockets.emit = reply to all clients (including the one who asked)
  socket.on('join', function (room) {join(socket,room)});
  socket.on('leave', function () {leave(socket)});
  socket.on('set_name', function (name) {set_name(socket,name)});
  socket.on('set_vote', function (vote) {set_vote(socket,vote)});
  socket.on('reset', function () {reset(socket)});
  socket.on('disconnect', function () {leave(socket)});
});

function join(socket,room) {
	if (room!==socket.current_room) {
		if (socket.current_room!==undefined) {leave(socket,socket.current_room)}
		socket.join(room,()=>{
			socket.current_room=room;
			update_players(socket.current_room);
			socket.emit('data',{message:'You joined '+socket.current_room});
			update_status(socket);		
		});
	}
}

function leave(socket) {
	if (socket.current_room!==undefined) {
		socket.leave(socket.current_room,()=>{
			update_players(socket.current_room);
			socket.emit('data',{message:'You left '+socket.current_room});
			socket.current_room=undefined;
			update_status(socket);
		});
	}
}

function set_name(socket,name) {
	socket.name=(name==''?undefined:name);
	socket.emit('data',{message:'Your name is '+socket.name});
	update_players(socket.current_room);
	update_status(socket);
}

function set_vote(socket,vote) {
	socket.vote=(vote==''?undefined:vote);
	socket.emit('data',{message:'You voted '+socket.vote});
	update_players(socket.current_room);
	update_status(socket);
}

function reset(socket) {
	io.in(socket.current_room).clients((err , clients) => {
		let players = clients.map((c)=>{let u=io.in(socket.current_room).connected[c]; u.vote=undefined; return {id:u.id,name:u.name,vote:u.vote}});
		io.in(socket.current_room).emit('data',{players:players});
	});
}

function update_players(room) {
	io.in(room).clients((err , clients) => {
		let players = clients.map((c)=>{let u=io.in(room).connected[c]; return {id:u.id,name:u.name,vote:u.vote}});
		io.in(room).emit('data',{players:players});
	});
}

function update_status(socket) {
	if (socket.current_room!==undefined) {
		socket.emit('data',{room:socket.current_room,id:socket.id,name:socket.name,vote:socket.vote});
	}
	else {
		socket.emit('data',{room:null,players:[],id:socket.id,name:socket.name,vote:socket.vote})
	}
}

process.on('SIGINT', function(){process.exit(0)});
process.on('SIGTERM', function(){process.exit(0)});