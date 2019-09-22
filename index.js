'use strict';
var express = require('express');
var app = express();
var server = require('http').createServer(app);
var io = require('socket.io').listen(server, {'path': '/pp/socket.io'});
var path = require('path');
var PORT = process.env.PORT || 3008;
server.listen(PORT, function() {process.stdout.write(`\x1b[44m SUDOKU SERVER LISTENING ON PORT ${ PORT } \x1b[0m \n`)});
app.use(function(req,res) {res.sendFile(path.join(__dirname,'public','index.html'))});

let default_names = ['Kermit the Frog','Miss Piggy','Fozzie Bear','Gonzo','Rowlf the Dog','Scooter','Animal','Pepe the King Prawn','Rizzo the Rat','Walter','Dr. Teeth','Statler','Waldorf','Bunsen Honeydew','Beaker','The Swedish Chef','Sam Eagle','Camilla the Chicken','Bobo the Bear','Clifford'];
let default_cards = '?,0,1,2,3,5,8,13,20';

io.on('connection', function (socket) {
  set(socket,default_names[Math.floor(Math.random()*default_names.length)],undefined);
  join(socket,socket.client.request.headers.referer.match(/[^\/]\/([^\/]*)\/?$/i)[1]);
  // socket.emit = reply only to the client who asked
  // socket.broadcast.emit = reply to all clients except the one who asked
  // io.sockets.emit = reply to all clients (including the one who asked)
  socket.on('join', function (room) {join(socket,room)});
  socket.on('set', function (name,vote) {set(socket,name,vote)});
  socket.on('show', function () {show(socket)});
  socket.on('reset', function () {reset(socket)});
  socket.on('set_room_cards', function (cards) {set_room_cards(socket,cards,true)});
  socket.on('leave', function () {leave(socket)});
  socket.on('disconnect', function () {leave(socket)});
});

function join(socket,room) {
	if (room!==socket.current_room) {
		if (socket.current_room!==undefined) {leave(socket,socket.current_room)}
		socket.join(room,()=>{
			socket.current_room=room;
			set_room_cards(socket);
			update_about_you(socket,'You joined room '+socket.current_room);		
			update_about_match(socket);
		});
	}
}

function leave(socket) {
	if (socket.current_room!==undefined) {
		socket.leave(socket.current_room,()=>{
			update_about_you(socket,'Bye!');
			update_about_match(socket);
			socket.current_room=undefined;
		});
	}
}

function hide(socket) {
	io.in(socket.current_room).hidden=true;
	update_about_match(socket);
}
function show(socket) {
	io.in(socket.current_room).hidden=false;
	update_about_match(socket);
}

function set_room_cards(socket,cards,overwrite) {
	if ((overwrite)||(io.in(socket.current_room).cards==undefined)) {
		io.in(socket.current_room).cards=(cards||default_cards).trim().split(/\s*,\s*/);
		reset(socket);
	}
}

function set(socket,name,vote) {
	socket.name=(name==''?undefined:name);
	socket.vote=(vote==''?undefined:vote);
	update_about_you(socket,'You ('+socket.name+') voted '+socket.vote);
	update_about_match(socket);
}

function reset(socket) {
	hide(socket);
	io.in(socket.current_room).emit('reset');
}

function update_about_match(socket) {
	io.in(socket.current_room).clients((err , clients) => {
		let players = clients.map((c)=>{let u=io.in(socket.current_room).connected[c]; return {id:u.id,name:u.name,vote:u.vote}});
		io.in(socket.current_room).emit('about:match',{room:socket.current_room,cards:io.in(socket.current_room).cards,hidden:io.in(socket.current_room).hidden,players:players});
	});
	//io.clients((err , clients) => {console.log(clients)});
	//console.log(io.rooms);
}

function update_about_you(socket,message) {
	socket.emit('about:you',{room:socket.current_room,id:socket.id,name:socket.name,vote:socket.vote,message:message});
}

process.on('SIGINT', function(){process.exit(0)});
process.on('SIGTERM', function(){process.exit(0)});
