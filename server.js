const express = require("express");

const app = express();

//https://www.npmjs.com/package/ammo-node
const Ammo = require('ammo-node');//physics

//Express initializes app to be a function handler that you can supply to an HTTP server
const http = require('http').Server(app);

//A server that integrates with (or mounts on) the Node.JS HTTP Server: socket.io
const io = require('socket.io')(http);

var port = process.env.PORT || 5000; 

//var ip = '192.168.1.100'
//var ip = '10.10.10.100'


//required for serving locally when testing
var serveStatic = require('serve-static');

app.use('/',express.static(__dirname));//serve the main dir so the /public dir will work

app.use(serveStatic(__dirname+'/'));
app.use(serveStatic(__dirname + '/resources/images/'));
app.use(serveStatic(__dirname + '/js'));
app.use(serveStatic(__dirname + '/js/lib/'));
app.use(serveStatic(__dirname + '/js/libs/three.js/build/'));

//serve HTML to initial get request
app.get('/', function(request, response){
	response.sendFile(__dirname+'/phone_home.html');
});


http.listen(port, function(){
	console.log('listening on port: '+port);
	console.log('serving files from root: '+__dirname);
	});		