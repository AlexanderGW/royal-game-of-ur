/**
 * Game of Ur - Node.Js TS websocket edition
 *
 * @author Alexander Gailey-White
 * @date 2024-03-29
 */

import * as uuid from 'uuid';
import { WebSocketServer } from 'ws';
import * as http from 'node:http';

const TOTAL_PIECES = 7;

// type Pieces = {
// 	[k: number]: number[],
// };
type Pieces = number[][];

type User = {
	uuid: string,
	game: string,
};

// type Players = {
// 	[k: number]: string,
// };
type Players = string[];

type Game = {
	players: Players,
	type: string,
	uuid: string,
	pieces: Pieces,
	moves: ClientMessage[],
	turn: {
		player: number,
		roll: number,
		rolls: number,
	}
};

type ClientMessage = {
	type: "game" | "move" | "turn" | "user", // move, turn, user, game
	uuid: string,
	player: number,
	piece: number,
	roll: number,
	me: boolean,
};

type ServerMessageMove = {
	type: 'move',
	uuid: string,
	player: number,
	piece: number,
	roll: number,
	// me: boolean,
};

type ServerMessageGame = {
	type: 'game',
	players: Players,
	uuid: string,
	pieces: Pieces,
	moves: ClientMessage[],
	turn: {
		player: number,
		roll: number,
		rolls: number,
	}
};

type ServerMessageTurn = {
	type: 'turn',
	player: number,
	roll: number,
	rolls: number,
};

type ServerMessageUser = {
	type: 'user',
	uuid: string,
};

// Optional. You will see this name in eg. 'ps' or 'top' command
process.title = 'game-of-ur';

const webSocketsServerPort = process.argv[2] || 1337;

const clients: any[] = []; // WebSocket

const users: User[] = [];

const usersIndex: string[] = [];

const games: Game[] = [];

const gamesIndex: string[] = [];

// Positions that allow the player another turn
function piecePosHasFreeRoll(pos: number): boolean {
	return (pos === 4 || pos === 8 || pos === 14);
}

// Generate a random number, upto one before max
function getRandomInt(max: number): number {
	return Math.floor(Math.random() * Math.floor(max));
}

// Validate game piece
function validateGamePiecePosWithRoll(
	gameIndex: number,
	piece: number,
	currPos: number,
	roll: number
): number {
	// console.log(`INFO: Game ${games[gameIndex].uuid}, piece ${piece} at ${currPos} rolled ${roll}`);

	// We are attempting a piece move
	if (roll > 0) {
		let nextPos = currPos + roll;

		// Piece can not be moved this many spaces
		if (nextPos > 15)
			return 0;

		// console.log(games);

		const playerIndex = games[gameIndex].turn.player;

		// Check position is not occupied by another own piece
		let ourPieces = games[gameIndex].pieces[playerIndex];

		if (ourPieces.length) {
			for (let i = 0; i < ourPieces.length; i++) {
				if (ourPieces[i] === nextPos && nextPos < 15) {
					console.log('cannot move piece ' + piece + ' at '+currPos+' to ' + nextPos);
					return 0;
				}
			}
		}

		// Traversing the gauntlet
		if (nextPos > 4 && nextPos < 13) {
			let opposingPlayerIndex = (playerIndex === 0 ? 1 : 0);
			let opposingPieces = games[gameIndex].pieces[opposingPlayerIndex];

			if (opposingPieces.length) {
				for (let i = 0; i < opposingPieces.length; i++) {

					// Hit opposing piece
					if (opposingPieces[i] === nextPos) {

						// They're protected on this rosette, cannot move k spaces to j
						if (nextPos === 8)
							return 0;

						// Reset opposing piece
						// console.log('reset opposing piece '+nextPos);
						games[gameIndex].pieces[opposingPlayerIndex][i] = 0;
					}
				}
			}
		}

		// Move piece to new position on board
		// console.log('can move piece ' + piece + ' at '+currPos+' to ' + nextPos);
		return nextPos;
	}

	// No moves possible
	return 0;
}

/**
 * Send to clients viewing game
 */
function sendToGameClients(
	gameIndex: number,
	json: ServerMessageMove | ServerMessageTurn | ServerMessageGame | ServerMessageTurn,
): void {
	if (gameIndex < 0) {
		throw new Error(`Invalid game ID`);
	}

	const gameUuid = gamesIndex[gameIndex];

	const jsonString = JSON.stringify(json);

	for (let i = 0; i < users.length; i++) {
		if (users[i].game === gameUuid) {
			clients[i]?.send(jsonString);
			console.log((new Date()) + ' --> '
				+ users[i].uuid + ': ' + jsonString);
		}
	}
}

/**
 * HTTP server
 */
const server = http.createServer(function(request, response) {
	// Not important for us. We're writing WebSocket server,
	// not HTTP server
	console.log((new Date()) + ' HTTP server. URL'
		+ request.url + ' requested.');

	if (request.url === '/status') {
		response.writeHead(200, {'Content-Type': 'application/json'});
		const responseObject = {
			currentClients: clients.length
		};
		response.end(JSON.stringify(responseObject));
	} else {
		response.writeHead(404, {'Content-Type': 'text/plain'});
		response.end('Not Found');
	}
});
server.listen(
	{
		port: webSocketsServerPort,
		host: '0.0.0.0',
	},
	function() {
		console.log((new Date()) + " Server is listening on port "
			+ webSocketsServerPort);
	}
);

/**
 * WebSocket server
 */
const wsServer = new WebSocketServer({
	// WebSocket server is tied to a HTTP server. WebSocket
	// request is just an enhanced HTTP request. For more info
	// http://tools.ietf.org/html/rfc6455#page-6
	server: server
});
// This callback function is called every time someone
// tries to connect to the WebSocket server
wsServer.on('connection', function(socket, request) {
	// console.log((new Date()) + ' Connection from origin '
	// 	+ request.socket.address + '.');
	console.log(`${(new Date())}; Incoming connection`);

	const userId = uuid.v4();

	const clientIndex = clients.length;

	clients.push(socket);

	users.push({
		uuid: userId,
		game: ''
	});

	usersIndex.push(userId);

	console.log(`${(new Date())}; User established: ${userId}`);

	// Send user their uuid
	const userResponse: ServerMessageUser = {
		type: 'user',
		uuid: userId
	};
	socket.send(
		JSON.stringify(userResponse)
	);

	// TODO: REFACTOR; MATCH TWO PLAYERS FOR A GAME TEST
	if ((clients.length % 2) === 0) {
		let gameId = uuid.v4();
		let players: Players = [];

		// Add two users that are not in a game
		let i = 0;
		for (let j = 0; j < users.length; j++) {
			if (users[j].game.length === 0) {
				users[j].game = gameId;
				players[i] = users[j].uuid;
				i++;
			}
			if (i === 2)
				break;
		}

		// We have matched two players
		if (i === 2) {
			let pieces: Pieces = [];
			pieces[0] = Array(TOTAL_PIECES).fill(0);
			pieces[1] = Array(TOTAL_PIECES).fill(0);

			const gameResponse: ServerMessageGame = {
				type: 'game',
				uuid: gameId,
				players: players,
				pieces: pieces,
				moves: [],
				turn: {
					player: getRandomInt(2),
					roll: getRandomInt(5),
					rolls: 0,
				},
			}

			const gameIndex = games.length;
			games.push(gameResponse);
			gamesIndex.push(gameId);
			sendToGameClients(gameIndex, gameResponse);

			// send turn
			const turnResponse: ServerMessageTurn = {
				type: 'turn',
				player: games[gameIndex].turn.player,
				roll: games[gameIndex].turn.roll,
				rolls: games[gameIndex].turn.rolls
			};
			sendToGameClients(gameIndex, turnResponse);
		}

		// Something went wrong, clear the match lock
		else {
			// for (let i = 0; i < players.length; i++) {
			// 	const playerIndex = players[i];
			// 	for (let j = 0; j < users.length; j++) {
			// 		if (users[j].game === gameId) {
			// 			users[j].game = '';
			// 		}
			// 	}
			// }

			for (let j = 0; j < users.length; j++) {
				if (users[j].game === gameId) {
					users[j].game = '';
				}
			}
		}
	} else {

		console.log(`Waiting for even number of players`);
	}







	// user sent some message
	socket.on('message', function(data) {
		const rawMessage = data.toString();

		// if (data.type === 'utf8') {}
		console.log((new Date()) + ' <-- ' + userId + ': ' + rawMessage);

		try {
			const json: ClientMessage = JSON.parse(rawMessage);

			if (!json.hasOwnProperty('type')) {
				throw new Error(`Invalid message`);
			}

			switch (json.type) {
				case 'move':
					const gameIndex = gamesIndex.indexOf(json.uuid);
					if (gameIndex < 0) {
						throw new Error(`Unknown game: ${json.uuid}`);
					}
					
					if (!games[gameIndex]) {
						throw new Error(`Unknown game: ${json.uuid}`);
					}

					const game = games[gameIndex];

					// Requesting user is in the game?
					if (game.players.indexOf(userId) < 0) {
						throw new Error(`Not in game`);
					}

					// Is it their turn, and should they be actioning it?
					if (
						game.players[game.turn.player] !== userId
						|| game.turn.player !== json.player
					) {
						throw new Error(`Not their turn`);
					}

					let finalPos = -1;
					let nextPlayer = -1;
					let rolls = 0;
					
					// Moving a piece
					if (json.piece >= 0) {
						if (!game.pieces[game.turn.player]) {
							throw new Error(`Invalid player data`);
						}
	
						const currPos = Number(game.pieces[game.turn.player][json.piece]);
	
						// Invalid piece
						if (!game.pieces[game.turn.player]) {
							throw new Error(`Invalid piece data`);
						}
	
						// Get final position, based on current position, and roll
						finalPos = validateGamePiecePosWithRoll(
							gameIndex,
							json.piece,
							currPos,
							game.turn.roll
						);
	
						// Player piece move validated
						if (
							json.piece >= 0
							&& finalPos !== (currPos + game.turn.roll)
						) {
							throw new Error(`Invalid move`);
						}
	
						if (json.piece >= 0)
							games[gameIndex].pieces[game.turn.player][json.piece] = finalPos;
	
						// Can same player roll again?
						if (
							piecePosHasFreeRoll(finalPos) === true
							&& game.turn.rolls < 4
						) {
							rolls = game.turn.rolls;
							nextPlayer = game.turn.player === 0 ? 0 : 1;
						}
						// console.log(rolls);
	
						rolls++;
					}

					// Switch player
					if (nextPlayer < 0)
						nextPlayer = game.turn.player === 0 ? 1 : 0;

					// Record the move
					games[gameIndex].moves.push(json);

					// Send the move to the players
					const responseMove: ServerMessageMove = {
						type: 'move',
						uuid: json.uuid,
						player: json.player,
						piece: json.piece,
						roll: finalPos
					};
					sendToGameClients(gameIndex, responseMove);

					// Send next turn to the players
					games[gameIndex].turn = {
						player: nextPlayer,
						rolls: rolls,
						roll: getRandomInt(5)
					};

					// Send turn
					const responseTurn: ServerMessageTurn = {
						type: 'turn',
						player: game.turn.player,
						rolls: game.turn.rolls,
						roll: game.turn.roll
					};
					sendToGameClients(gameIndex, responseTurn);

					break;
			}
		} catch (data: any) {
			const error: Error = data;
			console.error(error.message);
			return;
		}
	});

	socket.on('error', console.error);

	socket.on('close', function(connection) {
		if (userId) {
			console.log(`${(new Date())}; Peer ${connection} disconnected; User: ${userId}"`);

			// Remove user from the list of connected clients
			clients.splice(clientIndex, 1);
		}
	});
});