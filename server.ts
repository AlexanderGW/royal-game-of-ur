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
const TOTAL_SPACES = 15;
const GAME_TIMEOUT = 30000;

type PiecePositions = number[][];

type User = {
	uuid: string,
	game: string,
};

type Players = string[];

type Game = {
	players: Players,
	state: number,
	uuid: string,
	pieces: PiecePositions,
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
};

type ServerMessageGame = {
	type: 'game',
	players: Players,
	state: number,
	uuid: string,
	pieces: PiecePositions,
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

let clients: any[] = []; // WebSocket

let users: User[] = [];

let usersIndex: string[] = [];

let games: Game[] = [];

let gamesIndex: string[] = [];

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
		if (nextPos > TOTAL_SPACES)
			return 0;

		// console.log(games);

		const playerIndex = games[gameIndex].turn.player;

		// Check position is not occupied by another own piece
		let ourPieces = games[gameIndex].pieces[playerIndex];

		if (ourPieces.length) {
			for (let i = 0; i < ourPieces.length; i++) {
				if (ourPieces[i] === nextPos && nextPos < TOTAL_SPACES) {
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

	// Send game data to applicable users
	for (let i = 0; i < users.length; i++) {
		if (users[i].game === gameUuid) {
			clients[i]?.send(jsonString);
			console.log((new Date()) + ' --> '
				+ users[i].uuid + ': ' + jsonString);
		}
	}
}

function pollGameState(
	gameIndex: number,
	lastMoves: number,
): void {

	// Game state is zero (likely a winner)
	if (!games[gameIndex].state) {
		console.log(`Game ended: ${games[gameIndex].uuid}`);
		return;
	}

	// No new moves
	const currentMoves = games[gameIndex].moves.length;
	if (lastMoves === currentMoves) {
		console.log(`Game timeout: ${games[gameIndex].uuid}`);
		games[gameIndex].state = 0;
	}
	
	// Still moving, check later
	else {
		console.log(`Game active: ${games[gameIndex].uuid} (${currentMoves}/${lastMoves})`);
		setTimeout(() => {
			pollGameState(gameIndex, currentMoves);
		}, GAME_TIMEOUT);
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
			let pieces: PiecePositions = [];
			pieces[0] = Array(TOTAL_PIECES).fill(0);
			pieces[1] = Array(TOTAL_PIECES).fill(0);

			const gameResponse: ServerMessageGame = {
				type: 'game',
				uuid: gameId,
				state: 1,
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

			// If game is inactive after `GAME_TIMEOUT`, `state` to `0`
			setTimeout(() => {
				pollGameState(gameIndex, 0);
			}, GAME_TIMEOUT);
		}

		// Something went wrong, clear the match lock
		else {
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

					// Game active?
					if (!game.state) {
						throw new Error(`Game ended`);
					}

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

							// Positions that allow the player another turn
							(finalPos === 4 || finalPos === 8 || finalPos === 14)
							&& game.turn.rolls < 4
						) {
							rolls = game.turn.rolls;
							nextPlayer = game.turn.player === 0 ? 0 : 1;
						}
						// console.log(rolls);

						rolls++;
					}

					// Switch player
					if (nextPlayer < 0 || rolls > 3)
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

					// End game if a player has finished all pieces
					if (finalPos === TOTAL_SPACES) {
						let scores: number[] = [];
						scores.push(games[gameIndex].pieces[0].reduce((score, position) => score + position, 0));
						scores.push(games[gameIndex].pieces[1].reduce((score, position) => score + position, 0));
						console.log(`scores`);
						console.log(scores);

						// Winner
						const result = scores.indexOf(TOTAL_PIECES * TOTAL_SPACES);

						// TESTING: End game on first finished piece
						// const result = scores.reduce((score, position) => score + position, 0);

						if (result >= 0) {
							console.log(`Game ${game.uuid} ended; player ${result} won`);
							games[gameIndex].state = 0;

							const gameResponse: ServerMessageGame = {
								type: 'game',
								...games[gameIndex]
							}

							sendToGameClients(gameIndex, gameResponse);

							break;
						}
					}

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