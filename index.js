'use strict';
var express = require('express');
var app = express();
var server = require('http').createServer(app);
var io = require('socket.io').listen(server, {'path': '/pp/socket.io'});
//var io = require('socket.io')(server);
//var bodyParser = require('body-parser');
var path = require('path');
var PORT = process.env.PORT || 3008;

server.listen(PORT, function() {process.stdout.write(`\x1b[44m SUDOKU SERVER LISTENING ON PORT ${ PORT } \x1b[0m \n`)});

//app.use(express.static(path.join(__dirname, 'public')));
//app.use(function(req, res, next){res.sendFile('index.html',{root:path.join(__dirname,'public')})});
//app.use(bodyParser.json());
//app.use(bodyParser.urlencoded({ extended: true }));
app.use(function(req,res) {res.sendFile(path.join(__dirname, 'index.html'))}); //res.setHeader('Access-Control-Allow-Origin','*');

let names = ['Kermit the Frog','Miss Piggy','Fozzie Bear','Gonzo','Rowlf the Dog','Scooter','Animal','Pepe the King Prawn','Rizzo the Rat','Walter','Dr. Teeth','Statler','Waldorf','Bunsen Honeydew','Beaker','The Swedish Chef','Sam Eagle','Camilla the Chicken','Bobo the Bear','Clifford'];

io.on('connection', function (socket) {
  socket.emit('about:you',{message: 'Welcome '+socket.id+'!'});
  join(socket,socket.client.request.headers.referer.match(/[^\/]\/([^\/]*)\/?$/i)[1]);
  set(socket,names[Math.floor(Math.random()*names.length)],undefined);
  // socket.emit = reply only to the client who asked
  // socket.broadcast.emit = reply to all clients except the one who asked
  // io.sockets.emit = reply to all clients (including the one who asked)
  socket.on('join', function (room) {join(socket,room)});
  socket.on('leave', function () {leave(socket)});
  socket.on('set', function (name,vote) {set(socket,name,vote)});
  socket.on('reset', function () {reset(socket)});
  socket.on('disconnect', function () {leave(socket)});
});

function join(socket,room) {
	if (room!==socket.current_room) {
		if (socket.current_room!==undefined) {leave(socket,socket.current_room)}
		socket.join(room,()=>{
			socket.current_room=room;
			update_about_episode(socket.current_room);
			socket.emit('about:you',{message:'You joined '+socket.current_room});
			update_about_you(socket);		
		});
	}
}

function leave(socket) {
	if (socket.current_room!==undefined) {
		socket.leave(socket.current_room,()=>{
			update_about_episode(socket.current_room);
			socket.emit('about:you',{message:'You left '+socket.current_room});
			socket.current_room=undefined;
			update_about_you(socket);
		});
	}
}

function set(socket,name,vote) {
	socket.name=(name==''?undefined:name);
	socket.vote=(vote==''?undefined:vote);
	socket.emit('about:you',{message:socket.name+', you voted '+socket.vote});
	update_about_episode(socket.current_room);
	update_about_you(socket);
}

function reset(socket) {
	io.in(socket.current_room).emit('reset');
}

function update_about_episode(room) {
	io.in(room).clients((err , clients) => {
		let players = clients.map((c)=>{let u=io.in(room).connected[c]; return {id:u.id,name:u.name,vote:u.vote}});
		io.in(room).emit('about:episode',{room:room,players:players});
	});
}

function update_about_you(socket) {
	if (socket.current_room!==undefined) {
		socket.emit('about:you',{room:socket.current_room,id:socket.id,name:socket.name,vote:socket.vote});
	}
	else {
		socket.emit('about:you',{room:null,id:socket.id,name:socket.name,vote:socket.vote})
	}
}

process.on('SIGINT', function(){process.exit(0)});
process.on('SIGTERM', function(){process.exit(0)});
