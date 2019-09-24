'use strict';
var express = require('express');
var app = express();
var server = require('http').createServer(app);
var io = require('socket.io').listen(server, {'path': '/pp/socket.io'});
var path = require('path');
var PORT = process.env.PORT || 3008;
server.listen(PORT, function() {process.stdout.write(`\x1b[44m SERVER LISTENING ON PORT ${ PORT } \x1b[0m \n`)});
app.use('/:path?/:id?/manifest.json', function (req, res) {
  //let id=(req.params.id)||'';
  res.json({
    "short_name": "planning",
    "name": "planning",
    "icons": [
      {"src": "/images/pp192.png","sizes": "192x192","type": "image/png"},
      {"src": "/images/pp512.png","sizes": "512x512","type": "image/png"},
      {"src": "/images/pp1024.png","sizes": "1024x1024","type": "image/png"}
    ],
    "start_url": '/'+(req.params.path?req.params.path+'/':'')+(req.params.id||''),
    "background_color": "#000",
    "theme_color": "#000",
    "display": "standalone"
  });
});
app.use(function(req,res) {res.sendFile(path.join(__dirname,'public','index.html'))});
let default_cards = '?,0,1,2,3,5,8,13,20';

io.on('connection', function (socket) {
  join(socket,socket.client.request.headers.referer.match(/[^\/]\/([^\/]*)\/?$/i)[1].toLowerCase());
  // socket.emit = reply only to the client who asked
  // socket.broadcast.emit = reply to all clients except the one who asked
  // io.sockets.emit = reply to all clients (including the one who asked)
  socket.on('join', function (room) {join(socket,room)});
  socket.on('set', function (name,vote) {set(socket,name,vote)});
  socket.on('show', function () {show(socket.current_room)});
  socket.on('reset', function () {reset(socket.current_room)});
  socket.on('set_room_cards', function (cards) {set_room_cards(socket.current_room,cards)});
  socket.on('leave', function () {leave(socket,socket.current_room)});
  socket.on('disconnect', function () {leave(socket,socket.current_room)});
});

var rooms=[];
function Room(room_id) {
	this.room_id=room_id;
	this.cards=default_cards.trim().split(/\s*,\s*/);
	this.hidden=undefined;
}

function find_room(room_id) {
	return rooms.find((r)=>{return r.room_id==room_id});
}

function delete_room(room_id) {
	return rooms.filter((r)=>{return r.room_id!==room_id});
}

function join(socket,room) {
	if (room!==socket.current_room) {
		if (socket.current_room!==undefined) {leave(socket,socket.current_room)}
		socket.join(room,()=>{
			if (!find_room(room)) {rooms.push(new Room(room))};
			socket.current_room=room;
			update_about_match(room);
		});
	}
}

function leave(socket,room) {
	if (socket.current_room!==undefined) {
		socket.leave(room,()=>{
			socket.current_room=undefined;
			update_about_match(room);
			io.in(room).clients((err , clients) => {if (clients.length<1) {rooms=delete_room(room)}});			
		});
	}
}

function set(socket,name,vote) {
	socket.name=(name!==''?name:undefined);
	socket.vote=(vote!==''?vote:undefined);
	update_about_match(socket.current_room);
}

function show(room) {
	if (find_room(room)) {find_room(room).hidden=false};
	update_about_match(room);
}

function reset(room) {
	if (find_room(room)) {find_room(room).hidden=undefined};
	io.in(room).emit('reset');
}

function set_room_cards(room,cards) {
	let roomObj=find_room(room);
	if (roomObj) {
		roomObj.cards=(cards||default_cards).trim().split(/\s*,\s*/);
		reset(room);
	}
}

function update_about_match(room) {
	let roomObj=find_room(room);
	if (roomObj) {
		io.in(room).clients((err , clients) => {
			let players = clients.map((c)=>{let u=io.in(room).connected[c]; return {id:u.id,name:u.name,vote:u.vote}});
			// if we are not waiting for someone to vote, show votes
			if ( (roomObj.hidden==undefined) && (!clients.find((c)=>{let u=io.in(room).connected[c]; return u.vote==undefined})) ) {roomObj.hidden=false}
			io.in(room).emit('about:match',{room:room,cards:roomObj.cards,players:players,hidden:roomObj.hidden});
		});		
	}
}

process.on('SIGINT', function(){process.exit(0)});
process.on('SIGTERM', function(){process.exit(0)});
