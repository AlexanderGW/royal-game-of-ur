# The royal game of Ur
Written in Node.JS, using WebSockets by Alexander Gailey-White

## Notes

* Intial release
* Waits until two players are connected, and starts a game.

## Known issues

* No piece position validation to end the game on illegal piece moves

## Rules

Rules based on reconstruction by [Irving Finkel](https://en.wikipedia.org/wiki/Irving_Finkel)

* Two players take turns rolling the dice
* First player randomly selected
* Pieces move clockwise around the board, through green, up along red, then down into the blue squares
* Player moves one of their available pieces, based on dice roll
* Landing on a rosette (darker squares) grants another roll
* A player can attack opposing pieces within the red squares, resetting that piece back to square zero (0), unless opposing piece is on the rosette, in which they're protected from attack
* TO finish a piece; the roll must move to exactly fifteen (15)
* To win; a player must get all pieces to square fifteen (15)

## Development

`npn server [1337]` Runs the [Websocket server](../blob/master/server.js) on optional port number, default `1337`

`npm test [8000]` to run an HTTP server (optional port number, default 8000) on the `src` directory <http://localhost:8000/index.htm>

`grunt` to watch for SASS style changes, or `grunt sass` to build