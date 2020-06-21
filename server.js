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
process.title = 'game-of-ur';
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

// Positions that allow the player another turn
function piecePosHasFreeRoll(pos) {
	return (pos === 4 || pos === 8 || pos === 14);
}

// Generate a random number, upto one before max
function getRandomInt(max) {
	return Math.floor(Math.random() * Math.floor(max));
}

// Validate game piece
function validateGamePiecePosWithRoll(gameId, piece, curr_pos, k) {
	// console.log('game '+gameId+' piece '+piece+' at '+curr_pos+' rolling '+k);

	// We are attempting a piece move
	if (k > 0) {
		let next_pos = curr_pos + k;

		// Piece can not be moved this many spaces
		if (next_pos > 15)
			return 0;

		// console.log(games);

		// Check position is not occupied by another own piece
		let otherPieces = games[gameId].pieces[games[gameId].players[games[gameId].turn.player]];
		if (otherPieces.length) {
			for (let i = 0; i < otherPieces.length; i++) {
				if (otherPieces[i] === next_pos && next_pos < 15) {
					// console.log('cannot move piece ' + piece + ' at '+curr_pos+' to ' + next_pos);
					return 0;
				}
			}
		}

		// Traversing the gauntlet
		if (next_pos > 4 && next_pos < 13) {
			let oppositePieceIdx = (games[gameId].turn.player === 0 ? 1 : 0);
			let opposingPieces = games[gameId].pieces[games[gameId].players[oppositePieceIdx]];

			if (opposingPieces.length) {
				for (let i = 0; i < opposingPieces.length; i++) {

					// Hit opposing piece
					if (opposingPieces[i] === next_pos) {

						// They're protected on this rosette, cannot move k spaces to j
						if (next_pos === 8)
							return 0;

						// Reset opposing piece
						// console.log('reset opposing piece '+next_pos);
						games[gameId].pieces[games[gameId].players[oppositePieceIdx]][i] = 0;
					}
				}
			}
		}

		// Move piece to new position on board
		// console.log('can move piece ' + piece + ' at '+curr_pos+' to ' + next_pos);
		return next_pos;
	}

	// No moves possible
	return 0;
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

									// Is it their turn, and should they be actioning it?
									if (
										games[json.uuid].players[games[json.uuid].turn.player] === userName
										&& games[json.uuid].players[games[json.uuid].turn.player] === json.user
									) {
										let nextPlayer = -1;
										let rolls = 0;
										let curr_pos = 0;
										let next_pos = 0;

										// Piece is moving on the board
										if (json.i >= 0) {

											// Current piece position
											if (json.i in games[json.uuid].pieces[json.user])
												curr_pos = games[json.uuid].pieces[json.user][json.i];
											else
												curr_pos = 0;

											// Get next position, based on current position, and roll
											let validated_pos = validateGamePiecePosWithRoll(json.uuid, json.i, curr_pos, games[json.uuid].turn.roll);

											// Player piece move validated
											if (validated_pos === json.j) {
												next_pos = games[json.uuid].pieces[json.user][json.i] = json.j < 0 ? 0 : json.j;

												// Can same player roll again?
												if (piecePosHasFreeRoll(next_pos) === true && games[json.uuid].turn.rolls < 4) {
													rolls = games[json.uuid].turn.rolls;
													nextPlayer = games[json.uuid].turn.player === 0 ? 0 : 1;
												}
												// console.log(rolls);
											} else {
												// console.log('invalid move piece '+json.i);
												// TODO: End the game, in favor of opposition?
											}
										}
										rolls++;

										// Switch player
										if (nextPlayer < 0)
											nextPlayer = games[json.uuid].turn.player === 0 ? 1 : 0;

										// Record the move
										games[json.uuid].moves.push(json);

										// Send the move to the players
										for (let i = 0; i < games[json.uuid].players.length; i++) {
											response = JSON.stringify({
												type: 'move',
												uuid: json.uuid,
												user: json.user,
												me: json.me, // false = computer
												i: json.i,
												j: json.j
											});
											clients[i].sendUTF(response);
											console.log((new Date()) + ' --> '
												+ users[i] + ': ' + response);
										}

										// Send next turn to the players
										games[json.uuid].turn = {
											player: nextPlayer,
											rolls: rolls,
											roll: getRandomInt(5)
										};
										// console.log(games[json.uuid].turn);
									} else {
										// console.log('player not allowed to request this move');
									}

									// Send turn
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