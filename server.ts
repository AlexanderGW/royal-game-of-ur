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
const GAME_TIMEOUT = 300000;

type PiecePositions = number[][];

type User = {
	client: number,
	uuid: string,
	game: string,
	status: number,
};

type Players = string[];

type Game = {
	players: Players,
	status: number,
	uuid: string,
	pieces: PiecePositions,
	moves: Move[],
	turn: {
		player: number,
		roll: number,
		rolls: number,
	}
};

type GameSummary = Omit<Game, "moves" | "turn">;






type MessageMove = {
	type: 'move',
	uuid: string,
	player: number,
	piece: number,
	roll: number,
};

type Move = Omit<MessageMove, "type" | "uuid">;

type MessageGame = {
	type: 'game',
	players: Players,
	status: number,
	uuid: string,
	pieces: PiecePositions,
	moves: Move[],
	turn: {
		player: number,
		roll: number,
		rolls: number,
	}
};

type MessageSearch = {
	type: 'search',
	group: number,
};

type MessageSummary = {
	type: 'summary',
	games: GameSummary[],
	// users: string[],
	users: User[],
};

type MessageTurn = {
	type: 'turn',
	player: number,
	roll: number,
	rolls: number,
};

type MessageUser = {
	type: 'user',
	status: number,
	uuid: string,
};

type MessageView = {
	type: "view",
	uuid: string,
};

type ClientMessage = MessageMove | MessageSearch | MessageSummary | MessageView;

type ServerMessage = MessageMove | MessageGame | MessageSummary | MessageTurn | MessageUser;

process.title = 'game-of-ur';

const webSocketsServerPort = process.argv[2] || 1337;

let clients: any[] = []; // WebSocket

let users: User[] = [];

let usersIndex: string[] = [];

let games: Game[] = [];

let gamesIndex: string[] = [];

// Attempt to match two users with `status=1
// TODO: Implement `group`
function matchGameUsers(
	group: number = 0
): boolean {
	const availableUsers = users.filter(user => user.status === 1 && user.game.length === 0);
	if ((availableUsers.length % 2) === 0) {
		let gameId = uuid.v4();
		let players: Players = [];

		// Add two users that are not in a game
		let i = 0;
		for (let j = 0; j < users.length; j++) {
			if (users[j].status === 1 && users[j].game.length === 0) {
				users[j].status = 2;
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

			const gameResponse: MessageGame = {
				type: 'game',
				uuid: gameId,
				status: 1,
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

			users.filter(user => user.game === gameId).map(user => {
				const userResponse: MessageUser = {
					type: 'user',
					status: user.status,
					uuid: user.uuid,
				};
				sendToClient(user.client, userResponse);
			});

			// send turn
			const turnResponse: MessageTurn = {
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

			return true;
		}

		// Something went wrong, clear the match lock
		else {
			for (let j = 0; j < users.length; j++) {
				if (users[j].game === gameId) {
					users[j].status = 1;
					users[j].game = '';
				}
			}
		}
	}

	return false;
}

// Generate a random number, upto one before max
function getRandomInt(
	max: number
): number {
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

function sendToClient(
	clientIndex: number,
	message: ServerMessage,
) {
	const json = JSON.stringify(message);
	clients[clientIndex]?.send(json);
	console.log(`${(new Date())} --> ${users[clientIndex].uuid}: ${json}`);
}

/**
 * Send to clients viewing game
 */
function sendToGameClients(
	gameIndex: number,
	data: ServerMessage,
): void {
	if (gameIndex < 0) {
		throw new Error(`Invalid game ID`);
	}

	const gameUuid = gamesIndex[gameIndex];

	// Send game data to applicable users
	for (let i = 0; i < users.length; i++) {
		if (users[i].game === gameUuid) {
			sendToClient(i, data);
		}
	}
}

function pollGameState(
	gameIndex: number,
	lastMoves: number,
): void {

	// Game state is zero (likely a winner)
	if (!games[gameIndex].status) {
		console.log(`Game ended: ${games[gameIndex].uuid}`);
		return;
	}

	// No new moves
	const currentMoves = games[gameIndex].moves.length;
	if (lastMoves === currentMoves) {
		console.log(`Game timeout: ${games[gameIndex].uuid}`);
		games[gameIndex].status = 0;

		const gameResponse: MessageGame = {
			type: 'game',
			...games[gameIndex]
		}

		sendToGameClients(gameIndex, gameResponse);
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
	console.log((new Date()) + ' HTTP server. URL'
		+ request.url + ' requested.');

	if (request.url === '/status') {
		response.writeHead(200, {'Content-Type': 'application/json'});
		const responseObject = {
			currentClients: clients.length,
			totalGames: games.length
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
		client: clientIndex,
		uuid: userId,
		game: '',
		status: 0,
	});

	usersIndex.push(userId);

	console.log(`${(new Date())}; User established: ${userId}`);

	// Send user their uuid
	const userResponse: MessageUser = {
		type: 'user',
		status: 0,
		uuid: userId
	};

	sendToClient(clientIndex, userResponse);

	// user sent some message
	socket.on('message', function(data) {
		const rawMessage = data.toString();

		console.log((new Date()) + ' <-- ' + userId + ': ' + rawMessage);

		try {
			const json: ClientMessage = JSON.parse(rawMessage);
			if (!json?.type) {
				throw new Error(`Invalid message`);
			}

			let gameIndex: number = -1;
			let game: Game | undefined;

			switch (json.type) {

				/**
				 * Game viewing requested, respond with game data
				 */
				case 'summary':
					const responseSummary: MessageSummary = {
						type: 'summary',
						games: games.filter(game => game.status === 1).map(game => {
							const result: GameSummary = {
								uuid: game?.uuid ?? '',
								pieces: game?.pieces ?? [],
								players: game?.players ?? [],
								status: game?.status ?? 0,
							};
							return result;
						}),
						// users: users.map(user => user.uuid),
						users: users,
					}

					sendToClient(clientIndex, responseSummary);

					break;

				/**
				 * User wants to start a game
				 */
				case 'search':
					users[clientIndex].status = 1;

					// Attempt to match a user in the same `group`
					const result = matchGameUsers(json.group);

					// Awaiting players...
					if (!result) {
						const userResponse: MessageUser = {
							type: 'user',
							status: users[clientIndex].status,
							uuid: users[clientIndex].uuid,
						};
					
						sendToClient(clientIndex, userResponse);
					}

					break;

				/**
				 * Game move requested
				 */
				case 'move':
					gameIndex = gamesIndex.indexOf(json.uuid);
					if (gameIndex < 0 || !games[gameIndex]) {
						throw new Error(`Unknown game: ${json.uuid}`);
					}

					game = games[gameIndex];

					// Game active?
					if (!game.status) {
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
					const responseMove: MessageMove = {
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
							games[gameIndex].status = 0;

							const gameResponse: MessageGame = {
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
					const responseTurn: MessageTurn = {
						type: 'turn',
						player: game.turn.player,
						rolls: game.turn.rolls,
						roll: game.turn.roll
					};
					sendToGameClients(gameIndex, responseTurn);

					break;

				/**
				 * Game viewing requested, respond with game data
				 */
				case 'view':
					gameIndex = gamesIndex.indexOf(json.uuid);
					if (gameIndex < 0 || !games[gameIndex]) {
						throw new Error(`Unknown game: ${json.uuid}`);
					}

					const gameResponse: MessageGame = {
						type: 'game',
						...games[gameIndex]
					}

					// Set game on user
					users[clientIndex].game = games[gameIndex].uuid

					sendToClient(clientIndex, gameResponse);

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