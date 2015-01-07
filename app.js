var express = require('express');
var app = express();
var port = process.env.PORT || 3000;
var io = require('socket.io').listen(app.listen(port));
var gravatar = require('gravatar');

// CONFIGURATION

// set .html as the default template extension
app.set('view engine', 'html');

// initialize the ejs template engine
app.engine('html', require('ejs').renderFile);

// render views from correct directory
app.set('views', __dirname + '/views');

// make public folder public
app.use(express.static(__dirname + '/public'));

// ROUTES SETUP

// index page
app.get('/', function(req, res) {
	res.render('index');
});

// create room
app.get('/create', function(req, res) {
	var id = Math.round(Math.random() * 1000000);
	res.redirect('/chat/' + id);
});

app.get('/chat/:id', function(req,res){
	res.render('chat');
});

// initialize socket.io
var chat = io.of('/socket').on('connection', function(socket) {
	socket.on('load', function(data) {
		var room = findClientsSocket(io, data, '/socket');

		// get number of people in the room
		if(room.length === 0 ) {
			socket.emit('peopleinchat', {number: 0});
		} else if(room.length === 1) {
			socket.emit('peopleinchat', {
				number: 1,
				user: room[0].username,
				avatar: room[0].avatar,
				id: data
			});
		} else if(room.length >= 2) {
			chat.emit('tooMany', {boolean: true});
		}

		//  user joins room
		socket.on('login', function(data) {
			var room = findClientsSocket(io, data.id, '/socket');

			if (room.length < 2) {
				socket.username = data.user;
				socket.room = data.id;
				socket.avatar = gravatar.url(data.avatar, {s: '140', r: 'x', d: 'mm'});

				socket.emit('img', socket.avatar);

				// add client to room
				socket.join(data.id);

				if (room.length == 1) {
					var usernames = [], avatars = [];

					usernames.push(room[0].username);
					usernames.push(socket.username);

					avatars.push(room[0].avatar);
					avatars.push(socket.avatar);

					// emit event
					chat.in(data.id).emit('startChat', {
						boolean: true,
						id: data.id,
						users: usernames,
						avatars: avatars
					});
				}
			} else {
				socket.emit('tooMany', {boolean: true});
			}
		});

		// client leaves room
		socket.on('disconnect', function() {

			// emit event
			socket.broadcast.to(this.room).emit('leave', {
				boolean: true,
				room: this.room,
				user: this.username,
				avatar: this.avatar
			});

			socket.leave(socket.room);
		});

		// send message
		socket.on('msg', function(data){
			socket.broadcast.to(socket.room).emit('receive', {msg: data.msg, user: data.user, img: data.img});
		});
	});
});

function findClientsSocket(io,roomId, namespace)
{
	var res = [];
	var ns = io.of(namespace || "/");

	if (ns) {
		for (var id in ns.connected) {
			if(roomId) {
				var index = ns.connected[id].rooms.indexOf(roomId) ;

				if(index !== -1) {
					res.push(ns.connected[id]);
				}
			} else {
				res.push(ns.connected[id]);
			}
		}
	}
	return res;
}

console.log('Application running on http://localhost:' + port);

