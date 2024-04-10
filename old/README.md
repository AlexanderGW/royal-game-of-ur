# Royal Game of Ur
Online multiplayer server (Node.JS) & client (jQuery), using WebSockets by Alexander Gailey-White

![Game demo](https://gailey-white.com/wp-content/uploads/2020/10/Screenshot_2020-10-31-The-Royal-Game-of-Ur-Node-JS-WebSockets-edition1.png)

## Notes

* Initial release
* Server waits until two or more (even number of users) are connected, and spawns a game.

## Rules

Rules based on reconstruction by [Irving Finkel](https://en.wikipedia.org/wiki/Irving_Finkel)

* Two players take turns rolling the dice
* First player randomly selected
* Pieces move clockwise around the board, through blue, up along red, then down into the green squares
* Player moves one of their available pieces, based on dice roll
* Landing on a rosette (darker squares) grants another roll
* A player can attack opposing pieces within the red squares, resetting that piece back to square zero (0), unless opposing piece is on the rosette, in which they're protected from attack
* To finish a piece; the roll must move (exactly) to square fifteen (15)
* To win; a player must get all pieces to square fifteen (15)

## Usage

`npm server [1337]` to run [Websocket server](../master/server.js) on optional port number (default `1337`)

`npm test [8000]` to run an HTTP server on optional port number (default `8000`) on the `src` directory <http://localhost:8000/index.htm>

## Development

`grunt sass` to build SASS stylesheet

`grunt` to watch for SASS changes, and build

## Todo

* Improve graphics
* Challenging - Allow players to challenge their next opponent
* Scoring - Highscore, win-streak, etc
* React?
* Chatbox (maybe)

## WSS NGINX proxy
Using NGINX create an HTTPS WSS proxy server to encrypt WebSocket traffic
```
server {
    listen 1337 ssl;
    
    ...
    
    location / {
        proxy_pass http://ws-backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "Upgrade";
        proxy_set_header Host $host;
    }
}

upstream ws-backend {
    # enable sticky session based on IP
    ip_hash;

    # The port [1337] passed to the server.js
    # Run on custom server port so that it doesn't conflict with NGINX
    server 127.0.0.1:1337;
}
```