import React from 'react';
import { TOTAL_PIECES, useGame } from '../UrContext';
import { ServerMessageGame, ServerMessageMove, ServerMessageTurn, ServerMessageUser, ServerMessageView } from '../page';
import { stylex } from '@stylexjs/stylex';
import { Piece } from './Piece';

export type UrProps = {
  // key: number,
  // mode: number,
  // player: number,
  // move?: CallableFunction,
};

export const Ur: React.FC<UrProps> = (props) => {
  const boardPieceOffset = -100;
  const boardInactivePiecePadding = 20;
  // const intervalGameTest = 1000;

  const { state, dispatch } = useGame();

  const [messages, setMessages] = React.useState<(ServerMessageMove | ServerMessageGame | ServerMessageTurn | ServerMessageUser)[]>([]);

  const requestMove = (
    piece: number
  ): void => {
    console.log(`Request move: ${piece}`);
    const request: ServerMessageMove = {
      type: 'move',
      uuid: state.game?.uuid ?? '',
      player: Number(state.game?.players.indexOf(state.user?.uuid ?? '')),
      piece: piece,
      roll: state.game?.turn.roll ?? 0,
    };
    // console.log(request);
    state.socket?.send(JSON.stringify(request));
  };

  const viewGame = (
    socket: WebSocket,
    uuid: string,
  ): void => {
    if (!uuid) return;
    console.log(`Game requested`);
    const request: ServerMessageView = {
      type: 'view',
      uuid: uuid,
    };
    console.log(request);
    console.log(socket);
    socket?.send(JSON.stringify(request));
  };

  const exitGame = (): void => {
    window.location.hash = '/';
  };

  React.useEffect(() => {
    const socket = new WebSocket(`${process.env.NEXT_PUBLIC_UR_SOCKET_SCHEME}://${process.env.NEXT_PUBLIC_UR_SOCKET_HOSTNAME}:${process.env.NEXT_PUBLIC_UR_SOCKET_PORT}`);

    dispatch({
      type: 'CONNECT',
      payload: socket,
    });

    socket.onopen = function () {
      console.log(window.location.hash);
      const pathRegex = /#!\/(game|user)\/([a-z0-9\-]+)/;
      const result = window.location.hash.match(pathRegex);
      if (result) {
        console.log(`Request type: ${result[1]}`);
        console.log(`Request value: ${result[2]}`);

        switch (result[1]) {
          case 'game' :
            viewGame(socket, result[2]);
            break;
        }
      }
    };

    socket.onmessage = (event) => {
      const message:
        ServerMessageMove
        | ServerMessageGame
        | ServerMessageTurn
        | ServerMessageUser
        = JSON.parse(event.data);

      // console.log(`Incoming message`);
      // console.log(message);
      setMessages((prevMessages) => [...prevMessages, message]);

      try {
        if (!message.hasOwnProperty('type')) {
          throw new Error(`Unknown type`);
        }

        switch (message.type) {
          case 'game':
            dispatch({
              type: 'GAME',
              payload: message,
            });
            break;

          case 'user':
            dispatch({
              type: 'USER',
              payload: message,
            });
            break;

          case 'move':
            dispatch({
              type: 'MOVE',
              payload: message,
            });
            break;

          case 'turn':
            dispatch({
              type: 'TURN',
              payload: message,
            });
            break;
        }
      } catch (data: any) {
        const error: Error = data;
        console.error(error.message);
      }
    };

    socket.onerror = function (error) {
      // an error occurred when sending/receiving data
      console.error('Connection Error');
      console.error(error);
    };

    return () => {
      socket.close();
    };
  }, []);

  if (!state.game || !state.user) {
    return (
      <><p>Waiting for another player...</p></>
    )
  }

  let ourPlayerIdx = Number(state.game?.players.indexOf(state.user?.uuid));

  // Spectator, view as player zero
  if (ourPlayerIdx < 0)
    ourPlayerIdx = 0;

  // console.log(`ourPlayerIdx: ${ourPlayerIdx}`);

  const ourStartingPieces = state.game?.pieces[ourPlayerIdx]
    .map((piece, i) => piece.position === 0 ? i : -1)
    .filter(i => i >= 0);
  // console.log(`ourStartingPieces`);
  // console.log(ourStartingPieces);

  const ourFinishedPieces = state.game?.pieces[ourPlayerIdx]
    .map((piece, i) => piece.position === 15 ? i : -1)
    .filter(i => i >= 0);
  // console.log(`ourFinishedPieces`);
  // console.log(ourFinishedPieces);

  const thierPlayerIdx = ourPlayerIdx === 1 ? 0 : 1;
  // console.log(`thierPlayerIdx: ${thierPlayerIdx}`);

  const theirStartingPieces = state.game?.pieces[thierPlayerIdx]
    .map((piece, i) => piece.position === 0 ? i : -1)
    .filter(i => i >= 0);
  // console.log(`theirStartingPieces`);
  // console.log(theirStartingPieces);
  
  const theirFinishedPieces = state.game.pieces[thierPlayerIdx]
    .map((piece, i) => piece.position === 15 ? i : -1)
    .filter(i => i >= 0);
  // console.log(`theirFinishedPieces`);
  // console.log(theirFinishedPieces);

  const weWon = ourFinishedPieces.length === TOTAL_PIECES;
  const theyWon = theirFinishedPieces.length === TOTAL_PIECES;

  return (
    <div>
      <div className="container game">
        <div className="ur">
          <div className="view">
            <div className="board">
              {Array(3).fill(0).map((v, i) =>
                <div key={i}>
                  {Array(8).fill(0).map((v, j) =>
                    <div key={j}></div>
                  )}
                </div>
              )}
            </div>
            <div className="pieces">
              <div>
                {Array(TOTAL_PIECES).fill(0).map((v, i) => {
                  const startingIndex = ourStartingPieces.indexOf(i);
                  const endingIndex = ourFinishedPieces.indexOf(i);

                  return (
                    <Piece
                      index={i}
                      key={i}
                      mode={ourPlayerIdx === state.game?.turn.player ? state.game.pieces[state.game.turn.player][i].mode ?? 0 : 0}
                      move={() => requestMove(i)}
                      offset={(startingIndex >= 0 ? startingIndex : (endingIndex >= 0 ? endingIndex : 0)) * boardInactivePiecePadding}
                      player={ourPlayerIdx}
                    />
                  )
                })}
              </div>
            </div>
            <div className="pieces enemy">
              <div>
                {Array(TOTAL_PIECES).fill(0).map((v, i) => {
                  const startingIndex = theirStartingPieces.indexOf(i);
                  const endingIndex = theirFinishedPieces.indexOf(i);

                  return (
                    <Piece
                      index={i}
                      key={i}
                      mode={0}
                      offset={(startingIndex >= 0 ? startingIndex : (endingIndex >= 0 ? endingIndex : 0)) * boardInactivePiecePadding}
                      player={thierPlayerIdx}
                    />
                  )
                })}
              </div>
            </div>
          </div>
        </div>
        <div className="info vertical-middle">
          <div>
            <ul className="messages">
              {messages.map((message, index) => (
                <li key={index}>{JSON.stringify(message)}</li>
              ))}
            </ul>
          </div>
        </div>
        <div className="info debug vertical-middle">
          <div>
            <button className="exit" title="Exit game" onClick={() => exitGame()}>✕</button>
          </div>
          <div>
            <button className="rotate" title="Rotate the board 90 degrees">↻</button>
          </div>
          <div>
            <span id="state">{state.game ? (
              `${state.game.turn.player === ourPlayerIdx ? 'we' : 'they'} rolled ${state.game.turn.roll}`
            ) : 'Start'}</span>
          </div>
        </div>
        <div
          className="container banner"
          style={{display: !state.game.state || weWon || theyWon ? 'block' : 'none'}}
        >
          <div className="vertical-middle">
            <button className="exit" title="Exit game" onClick={() => exitGame()}>←</button>
            <div>
              <span id="banner">{weWon ? `You won!` : (theyWon ? `They won!` : 'Game timed out' )}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};