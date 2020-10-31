/**
 * Game of Ur - Node.JS websocket edition
 *
 * @author Alexander Gailey-White
 * @date 2020-06-20
 */
"use strict";

$(function() {
	var boardInactivePieceOffset = -100;
	var boardInactivePiecePadding = 20;


	var intervalGameTest;
	var moves = 0;
	var opposing_moves = 0;

	var roll = 0;
	var me = true;
	var rolls = 0;
	var moved = 0;
	var finished = false;

	var uuid, gameId, userId;
	var players = [];


	// if user is running mozilla then use it's built-in WebSocket
	window.WebSocket = window.WebSocket || window.MozWebSocket;

	// Determine the WS endpoint
	var uri;
	if (location.protocol === 'https:')
		uri = 'wss://' + location.hostname + ':1337'
	else
		uri = 'ws://' + location.hostname + ':1337'

	var connection = new WebSocket(uri);

	connection.onopen = function () {
		// connection is opened and ready to use
		console.log('connection established');


		//connection.send(JSON.stringify({ type: 'history'} ));
		// TODO: FIND PLAYER

		// startTestGame();
		triggerPieceStart();
	};

	connection.onerror = function (error) {
		// an error occurred when sending/receiving data
		console.log('connection error');
	};

	connection.onmessage = function (message) {
		// try to decode json (I assume that each message
		// from server is json)
		try {
			var json = JSON.parse(message.data);
		} catch (e) {
			console.log('This doesn\'t look like a valid JSON: ',
				message.data);
			return;
		}



		// handle incoming message
		console.log('Received: ' + message.data);
		// console.log(json.hasOwnProperty('type'));
		if (json.hasOwnProperty('type')) {

			let piece;

			switch (json.type) {



				case 'game':
					$('.welcome').removeClass('show');
					$('.game').addClass('show');

					gameId = json.uuid;
					players = json.players;
					// console.log(json.players);
					break;






				case 'user':
					userId = json.uuid;
					break;



					// when user queue divisible by 2 - join with next player
					// allow players to challenge next opponent

				case 'move':

					// param to indicate roller?
					if (json.i >= 0) {
						me = ((json.me && json.user === userId) || (players.includes(userId) === false && players[0] === json.user));

						console.log('move '+(me?'our':'their')+' piece '+json.i+' to '+json.j);

						if (json.j) {
							doPieceMove(json.i, json.j);
						}
					}
					break;







				case 'turn':
					console.log('---');

					me = (players[json.player] === userId);
					rolls = json.rolls;
					roll = json.roll;

					console.log((me ? 'my' : 'their') + ' turn, rolled a ' + json.roll);
					console.log('roll ' + rolls + ' for '+(me?'me':'them'));

					let pieces, pieces_other, remaining_pieces, total_pieces;
					let next_pos = 0;



					/* DEBUG */
					if (me)
						$('#state').text('we rolled ' + json.roll);
					else
						$('#state').text('they rolled ' + json.roll);




					if (me) {
						pieces = '.pieces:not(.enemy) > div > div';
						pieces_other = '.pieces.enemy > div > div';
					} else {
						pieces = '.pieces.enemy > div > div';
						pieces_other = '.pieces:not(.enemy) > div > div';
					}

					$(pieces_other).each(function(){
						$(this).removeClass('inactive');
					});

					remaining_pieces = $(pieces);
					total_pieces = remaining_pieces.length;

					// Rolled something greater than 0
					if (json.roll) {

						// Test each piece against the roll
						let j = 0;
						for (let i = 0; i < total_pieces; i++) {
							piece = $(remaining_pieces.get(i));

							// Get piece position with this roll
							next_pos = getPiecePosWithRoll(piece, i, json.roll);
							if (next_pos === 0) {
								piece.addClass('inactive');
								j++;
							} else
								piece.removeClass('inactive');
						}

						// No moves possible
						if (me && j === total_pieces) {
							console.log('no possible moves');
							setTimeout(function(){
								requestMove(-1, 0);
							}, 2000);
						}
					} else {
						// TODO: Show msg 'cannot move' - wait 1sec? reqMove
						$(pieces).each(function(){
							$(this).addClass('inactive');
						});
						if (me) {
							console.log('rolled a 0');
							setTimeout(function(){
								requestMove(-1, 0);
							}, 2000);
						}
					}

					break;
			}
		}
	};




	function doPieceMove(i, j) {
		let piece, curr_pos;

		if (me) {
			piece = $('.pieces:not(.enemy) > div > div:eq('+i+')');
		} else
			piece = $('.pieces.enemy > div > div:eq('+i+')');

		curr_pos = piece.attr('class').substr(1);
		curr_pos = parseInt(curr_pos);

		// Move piece into position
		let start = (curr_pos+1);
		let step = 1;
		for (let k = start; k <= j; k++) {
			//setTimeout(function(){
				piece.css('top', '').removeClass().addClass('p' + k);

				if (k === start && curr_pos === 0)
					triggerPieceStart();

				// Reset any opposing piece if exists
				if (k === j) {
					if (j === 15) {
						triggerPieceFinish();
					} //else
						//doOpposingPieceReset(me, j);
				}
			//}, (step*50));
			step++;
		}

		doOpposingPieceReset(j);
	}





  function piecePosHasFreeRoll(pos) {
		return (pos === 4 || pos === 8 || pos === 14);
	}



	function requestMove(i, j) {
		connection.send(JSON.stringify({
			type: 'move',
			uuid: gameId,
			user: userId,
			me: me,
			i: i,
			j: j
		}));
	}




	function getPiecePosWithRoll(piece, idx, k) {
		// console.log('getPiecePosWithRoll('+$(piece).prop('outerHTML')+','+idx+','+k+')');
		let curr_pos, next_pos, other_piece = null;
		let l = 0;

		// Piece position
		curr_pos = piece.attr('class').substr(1);
		curr_pos = parseInt(curr_pos);
		next_pos = curr_pos;
		// console.log('selecting piece ' + idx + ' is at ' + curr_pos);

		// We are attempting a piece move
		if (k > 0) {
			next_pos += k;

			// Piece can not be moved this many spaces
			if (next_pos > 15)
				return 0;

			if (me)
				other_piece = '.pieces:not(.enemy) > div > div.p' + next_pos;
			else
				other_piece = '.pieces.enemy > div > div.p' + next_pos;

			// This piece cannot move k spaces to j, already occupied
			if ($(other_piece).length === 1 && next_pos < 15) {
				console.log('cannot move piece ' + idx + ' at '+curr_pos+' to ' + next_pos);
				return 0;
			}

			// Traversing the gauntlet
			if (next_pos > 4 && next_pos < 13) {
				if (me)
					other_piece = '.pieces.enemy > div > div.p' + next_pos;
				else
					other_piece = '.pieces:not(.enemy) > div > div.p' + next_pos;

				// Hit opposing piece
				if ($(other_piece).length === 1) {

					// They're protected on this rosette, cannot move k spaces to j
					if (next_pos === 8)
						return 0;

					// Reset opposing piece
					console.log('will reset opposing piece ' + idx);
					return next_pos;
				}
			}

			// Move piece to new position on board
			console.log('can move piece ' + idx + ' at '+curr_pos+' to ' + next_pos);
			return next_pos;
		}

		// No moves possible
		// console.log('cannot move this piece');
		return 0;
	}




  function switchPlayer() {
		me = !me
		rolls = 0;
		moved = 0;
	}





	function rollDice() {
		// Process pieces, which can move?
		let piece, pieces, remaining_pieces, total_pieces;
		let curr_pos, next_pos = 0;

  	// Player is rolling again, without even moving, forfeit go
		if (rolls && !moved) {
			console.log((me ? 'we' : 'they') + ' forfeit go');
			requestMove(-1, roll);
			// console.log('---');
			// switchPlayer();
		}

		// No moves possible, or reached limit after rosette landings
		// if (rolls === -1 || rolls === 3)
		// 	switchPlayer();

		// Roll the dice
		roll = getRandomInt(5);
		$('#roll').text(roll);
		console.log((me ? 'we' : 'they') + ' rolled ' + roll);

		/* DEBUG */
		if (me)
			$('#state').text('we rolled ' + roll);
		else
			$('#state').text('they rolled ' + roll);

		if (me) {
			pieces = '.pieces:not(.enemy) > div > div';
		} else {
			pieces = '.pieces.enemy > div > div';
		}

		rolls++;
		console.log('roll ' + rolls + ' for '+(me?'me':'them'));

		// Rolled something greater than 0
		if (roll) {

			// Total remaining pieces on this team
			remaining_pieces = $(pieces);
			total_pieces = remaining_pieces.length;
			console.log(total_pieces+' pieces remaining');




			// Computer play
			// if(!me) {
			// 	$('.pieces:not(.enemy) > div > div').each(function(){
			// 		$(this).addClass('inactive');
			// 	});
			//
			// 	// Test each piece against the roll
			// 	for (let i = 0; i < total_pieces; i++) {
			// 		piece = $(remaining_pieces.get(i));
			//
			// 		// Get piece position with this roll
			// 		next_pos = getPiecePosWithRoll(piece, i, roll);
			// 		if (next_pos) {
			// 			console.log('COMPUTER: piece '+i+' moved to '+next_pos);
			// 			requestMove(i, next_pos);
			// 			curr_pos = next_pos - roll;
			// 			piece.css('top', '').removeClass().addClass('p' + next_pos);
			// 			moved++;
			// 			if (curr_pos === 0)
			// 				triggerPieceStart();
			// 			else if (next_pos === 15)
			// 				triggerPieceFinish();
			//
			// 			// Reset any opposing piece if exists
			// 			doOpposingPieceReset(next_pos);
			// 			break;
			// 		}
			// 	}
			//
			// 	if (piecePosHasFreeRoll(next_pos) === false) {
			// 		rolls = -1;
			// 	} else {
			// 		rollDice();
			// 	}
			//
			// 	// DEBUGGING FOR COMPUTER TO PLAY A RANDOM PIECE, INSTEAD OF SEQUENTIALLY LOOKING FOR THE FIRST MOVE
			// 	// piece = $(remaining_pieces.get(random_piece));
			// 	//
			// 	// let random_piece = getRandomInt(remaining_pieces.length)+1;
			// 	// console.log('COMPUTER: piece '+random_piece+' selected');
			// 	//
			// 	// next_pos = getPiecePosWithRoll(piece, random_piece, roll);
			// 	// if (next_pos) {
			// 	//
			// 	// }
			//
			//
			// }






			//else {

				// Test each piece against the roll
				for (let i = 0; i < total_pieces; i++) {
					piece = $(remaining_pieces.get(i));

					// Get piece position with this roll
					next_pos = getPiecePosWithRoll(piece, i, roll);
					if (!next_pos)
						piece.addClass('inactive');
					else
						piece.removeClass('inactive');
				}
			//}
		} else {
			$(pieces).each(function(){
				$(this).addClass('inactive');
			});
			console.log('cannot move');
			requestMove(-1, 0);
			rolls = -1;
		}

		console.log('---');
	}







	function doOpposingPieceReset(next_pos) {

		// Traversing the gauntlet
		if (next_pos > 4 && next_pos < 13) {
			let other_piece;
			if (me)
				other_piece = '.pieces.enemy > div > div.p' + next_pos;
			else
				other_piece = '.pieces:not(.enemy) > div > div.p' + next_pos;

			// Hit opposing piece
			if ($(other_piece).length === 1) {

				// They're protected on this rosette, cannot move this piece spaces to next_pos
				if (next_pos === 8)
					return;

				// Reset opposing piece
				console.log('reset '+(me ? 'opposing' : 'our')+' piece '+next_pos);
				$(other_piece).removeClass().addClass('p0');
				triggerPieceStart();
			}
		}
	}








	$(document).on('click', '.ur:not(.inactive) .pieces:not(.enemy) > div > div:not(.inactive):not(.p15)', function(){
		// if (me && moved < rolls) {
		if (me) {
			let next_pos = getPiecePosWithRoll($(this), $(this).index(), roll);
			let curr_pos = 0;
			if (!next_pos) {
				console.log('cannot move piece '+$(this).index());
				return false;
			}

			requestMove($(this).index(), next_pos);
			// SEND MOVE CONFIRMATION TO SERVER, RESPONSE WILL DETERMINE AND HANDLE THE ACTUAL MOVE

			// Currently clicking a piece will move it to the next pos.
			// TODO: Engage movement highlighting? They should click on the next pos to confirm move?
			// $(this).css('top', '').removeClass().addClass('p' + next_pos);
			//
			// curr_pos = next_pos - roll;
			// if (curr_pos === 0)
			// 	triggerPieceStart();
			// else if (next_pos === 15)
			// 	triggerPieceFinish();
			//
			// // Reset any opposing piece
			// doOpposingPieceReset(next_pos);

			// moved++;






			// if (piecePosHasFreeRoll(next_pos) === false) {
			// 	requestMove(-1, 0);
			// }
		}
	});

	// $(document).ready(function(){
	// 	$('.welcome').hide();
	// 	$('.game').addClass('show');
	// 	// $('.banner').addClass('show win');
	// });

	/* Exit game view */
	$('.exit').on('click', function(){
		window.location.reload();
	});

	/* Rotate the board 90deg clockwise */
	var rotation = 0;
	$('.rotate').on('click', function(){
		let view = $('.view');
		rotation++;
		if (rotation > 3)
			rotation = 0;
		view.attr('class', 'view').addClass('r' + (90 * rotation));
	});






	/* Debugging */
	$('.debug a.stop').on('click', function(){
		clearInterval(intervalGameTest);
	});
	$('.debug a.roll').on('click', function(){
		//rollDice();
	});




	function getRandomInt(max) {
		return Math.floor(Math.random() * Math.floor(max));
	}



	function triggerPieceStart() {
		var i = 0;
		// $('.pieces [class^="p"]').each(function(){
		// 	$(this).css('top', '');
		// 	i++;
		// });
		$('.pieces:not(.enemy) .p0').each(function(){
			$(this).css('top', (boardInactivePieceOffset+(i*boardInactivePiecePadding))+'%');
			i++;
		});
		i = 0;
		$('.pieces.enemy .p0').each(function(){
			$(this).css('top', (boardInactivePieceOffset+(i*boardInactivePiecePadding))+'%');
			i++;
		});
	}

	function triggerPieceFinish() {
		var i = 0;
		var finishedPieces = $('.pieces:not(.enemy) .p15');
		finishedPieces.each(function(){
			$(this).css('top', (boardInactivePieceOffset+(i*boardInactivePiecePadding))+'%');
			i++;
		});
		i = 0;
		var finishedEnemyPieces = $('.pieces.enemy .p15');
		finishedEnemyPieces.each(function(){
			$(this).css('top', (boardInactivePieceOffset+(i*boardInactivePiecePadding))+'%');
			i++;
		});

		if (finishedPieces.length === 7 || finishedEnemyPieces.length === 7) {
			finished = true;
			if (finishedPieces.length === 7) {
				triggerWin();
				console.log(moves + ' moves to ' + opposing_moves);
			} else {
				triggerLose();
				console.log(opposing_moves + ' moves to ' + moves);
			}
		}
	}

	function triggerFinish() {
		$('.ur').addClass('inactive');
		connection.close();
	}

	function triggerWin() {
		triggerFinish();
		$('#banner').text('you won');
		$('.banner').addClass('show win');
		console.log('win');
	}

	function triggerLose() {
		triggerFinish();
		$('#banner').text('you lost');
		$('.banner').addClass('show lose');
		console.log('lose');
	}
});