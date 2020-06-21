#!/usr/bin/env node

/**
 * Game of Ur - Node.JS websocket edition
 *
 * @author Alexander Gailey-White
 * @date 2020-06-20
 */

"use strict";

const { uuid } = require('uuidv4');

// Optional. You will see this name in eg. 'ps' or 'top' command
process.title = 'ur-server';
// Port where we'll run the websocket server
var webSocketsServerPort = process.argv[2] || 1337;
// websocket and http servers
var webSocketServer = require('websocket').server;
var http = require('http');



// list of currently connected clients
var clients = [];

// client user map
var users = [];

// list of current games
var games = [];






function piecePosHasFreeRoll(pos) {
	return (pos === 4 || pos === 8 || pos === 14);
}


function getRandomInt(max) {
	return Math.floor(Math.random() * Math.floor(max));
}



/**
 * Helper function for escaping input strings
 */
function htmlEntities(str) {
	return String(str)
		.replace(/&/g, '&amp;').replace(/</g, '&lt;')
		.replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/**
 * HTTP server
 */
var server = http.createServer(function(request, response) {
	// Not important for us. We're writing WebSocket server,
	// not HTTP server
	console.log((new Date()) + ' HTTP server. URL'
		+ request.url + ' requested.');

	if (request.url === '/status') {
		response.writeHead(200, {'Content-Type': 'application/json'});
		var responseObject = {
			currentClients: clients.length
		};
		response.end(JSON.stringify(responseObject));
	} else {
		response.writeHead(404, {'Content-Type': 'text/plain'});
		response.end('Sorry, unknown url');
	}
});
server.listen(webSocketsServerPort, '0.0.0.0', function() {
	console.log((new Date()) + " Server is listening on port "
		+ webSocketsServerPort);
});
/**
 * WebSocket server
 */
var wsServer = new webSocketServer({
	// WebSocket server is tied to a HTTP server. WebSocket
	// request is just an enhanced HTTP request. For more info
	// http://tools.ietf.org/html/rfc6455#page-6
	httpServer: server
});
// This callback function is called every time someone
// tries to connect to the WebSocket server
wsServer.on('request', function(request) {
	console.log((new Date()) + ' Connection from origin '
		+ request.origin + '.');

	let userName = uuid();

	// accept connection - you should check 'request.origin' to
	// make sure that client is connecting from your website
	// (http://en.wikipedia.org/wiki/Same_origin_policy)
	let connection = request.accept(null, request.origin);

	// we need to know client index to remove them on 'close' event
	// clients[userName] = connection;
	var index = clients.push(connection) - 1;
	// users.push(userName);
	users[index] = userName;

	console.log((new Date()) + ' Connection accepted ['+userName+'].');



	// Send user their uuid
	connection.sendUTF(
		JSON.stringify({
			type: 'user',
			uuid: userName
		}));


	// MATCH TWO PLAYERS FOR A GAME TEST
	// console.log(clients.length);
	if (clients.length === 2) {
		let uuid = index;
		let players = [];
		for (let i=0; i < clients.length; i++) {
			players[i] = users[i];
		}
		// console.log(players);
		games[uuid] = {
			type: 'game',
			uuid: uuid,
			players: players
		};
		let json = JSON.stringify(games[uuid]);
		for (let i = 0; i < clients.length; i++) {
			clients[i].sendUTF(json);
			console.log((new Date()) + ' --> '
				+ users[i] + ': ' + json);
		}

		let pieces = new Object();
		pieces[players[0]] = [].fill(0, 0, 6);
		pieces[players[1]] = [].fill(0, 0, 6);

		games[uuid].moves = [];
		games[uuid].pieces = pieces;

		// temp
		games[uuid].turn = {
			player: getRandomInt(2),
			roll: getRandomInt(5)
		};

		// send turn
		json = JSON.stringify({
			type: 'turn',
			player: games[uuid].turn.player,
			roll: games[uuid].turn.roll
		});
		for (let i = 0; i < clients.length; i++) {
			clients[i].sendUTF(json);
			console.log((new Date()) + ' --> '
				+ users[i] + ': ' + json);
		}
	}










	// user sent some message
	connection.on('message', function(message) {
		if (message.type === 'utf8') { // accept only text

			console.log((new Date()) + ' <-- '
				+ userName + ': ' + message.utf8Data);

			try {
				var json = JSON.parse(message.utf8Data);

				if (json.hasOwnProperty('type')) {

					switch (json.type) {
						case 'move':
							let response;

							// game ID is valid?
							if (json.uuid in games) {

								// Requesting user is in the game?
								if (games[json.uuid].players.includes(userName)) {

									// TODO: is it their turn?
									let nextPlayer = -1;
									let rolls = 0;
									let curr_pos = 0;
									let next_pos = 0;

									if (json.i >= 0) {
										curr_pos = games[json.uuid].pieces[json.user][json.i];
										next_pos = games[json.uuid].pieces[json.user][json.i] = json.j < 0 ? 0 : json.j;

										if (piecePosHasFreeRoll(next_pos) === true && games[json.uuid].turn.rolls < 4) {
											console.log('a free roll');
											console.log(games[json.uuid].turn);
											rolls = games[json.uuid].turn.rolls;
											nextPlayer = games[json.uuid].turn.player === 0 ? 0 : 1;
										}
										console.log(rolls);
									}
									rolls++;

									if (nextPlayer < 0)
										nextPlayer = games[json.uuid].turn.player === 0 ? 1 : 0;

									// Record the move
									games[json.uuid].moves.push(json);

									//if (json.i >= 0) {
									// let validate_pos = getPiecePosWithRoll(curr_pos, roll);
									// if (!validate_pos) {
									// 	console.log('cannot move piece '+json.i);
									// 	json.i = -1;
									// 	json.j = 0;
									// }
									//
									// if (validate_pos !== next_pos) {
									// 	console.log('invalid move piece '+json.i);
									// 	json.i = -1;
									// 	json.j = 0;
									// }
									//
									// // Reset any opposing piece
									// doOpposingPieceReset(next_pos);
									//
									// if (piecePosHasFreeRoll(next_pos) === false) {
									// 	rolls = -1;
									// }

									// console.log(games[json.uuid].pieces);
									//}

									// Send the move to the players
									for (let i = 0; i < games[json.uuid].players.length; i++) {
										response = JSON.stringify({
											type: 'move',
											uuid: json.uuid,
											user: json.user,
											me: json.me, // false = computer
											i: json.i,
											j: json.j
											// who is next roller?
										});

										clients[i].sendUTF(response);
										console.log((new Date()) + ' --> '
											+ users[i] + ': ' + response);
									}






									// temp
									// console.log(games[json.uuid]);


									games[json.uuid].turn = {
										player: nextPlayer,
										rolls: rolls,
										roll: getRandomInt(5)
									};
									// console.log(games[json.uuid].turn);

									// send turn
									response = JSON.stringify({
										type: 'turn',
										player: games[json.uuid].turn.player,
										rolls: games[json.uuid].turn.rolls,
										roll: games[json.uuid].turn.roll
									});
									for (let i = 0; i < clients.length; i++) {
										clients[i].sendUTF(response);
										console.log((new Date()) + ' --> '
											+ users[i] + ': ' + response);
									}
								}
							}
							break;
					}
				}
			} catch (e) {
				console.log('This doesn\'t look like a valid JSON: ',
					message.data);
				return;
			}
		}
	});



	// user disconnected
	connection.on('close', function(connection) {
		if (userName !== false) {
			console.log((new Date()) + " Peer "
				+ connection.remoteAddress + " disconnected.");
			// remove user from the list of connected clients
			clients.splice(userName, 1);
		}
	});
});