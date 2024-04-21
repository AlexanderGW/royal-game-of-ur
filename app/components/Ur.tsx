import React from 'react';
import { TOTAL_PIECES, useGame } from '../UrContext';
import { stylex } from '@stylexjs/stylex';
import { Piece } from './Piece';

export type User = {
	uuid: string,
	status: number,
};

export type Piece = {
  position: number,
  mode: number,
};

export type Pieces = Array<Piece[]>;

export type PiecePositions = number[][];

export type Players = string[];

export type Move = Omit<MessageMove, "type" | "uuid">;

export type Game = {
	players: Players,
	uuid: string,
	status: number,
	pieces: Pieces,
	moves: Move[],
	turn: {
		player: number,
		roll: number,
		rolls: number,
	}
};

export type GameSummary = Omit<Game, "moves" | "turn">;

export type MessageMove = {
	type: 'move',
	uuid: string,
	player: number,
	piece: number,
	roll: number,
};

export type MessageView = {
	type: 'view',
	uuid: string,
};

export type MessageSearch = {
	type: 'search',
	group: number,
};

export type MessageSummary = {
	type: 'summary',
	games?: GameSummary[],
	// users: string[],
	users?: User[],
};

export type MessageGame = {
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

export type MessageTurn = {
	type: 'turn',
	player: number,
	roll: number,
	rolls: number,
};

export type MessageUser = {
	type: 'user',
	status: number,
	uuid: string,
};

export type Message =
	MessageMove
	| MessageGame
	| MessageSummary
	| MessageTurn
	| MessageUser;

export type Messages = (Message)[];

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

  const [messages, setMessages] = React.useState<Messages>([]);

  const requestMove = (
    piece: number
  ): void => {
    console.log(`Request move: ${piece}`);
    const request: MessageMove = {
      type: 'move',
      uuid: state.game?.uuid ?? '',
      player: Number(state.game?.players.indexOf(state.user?.uuid ?? '')),
      piece: piece,
      roll: state.game?.turn.roll ?? 0,
    };
    // console.log(request);
    state.socket?.send(JSON.stringify(request));
  };

  const requestSearch = (
    group: number = -1,
  ) => {
    const request: MessageSearch = {
      type: 'search',
      group: group,
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
    const request: MessageView = {
      type: 'view',
      uuid: uuid,
    };
    // console.log(request);
    socket?.send(JSON.stringify(request));
  };

  const exitGame = (): void => {
    window.location.hash = '/';
    window.location.reload();
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
      } else {
        const request: MessageSummary = {
          type: 'summary',
        };
        console.log(request);
        console.log(socket);
        socket?.send(JSON.stringify(request));
      }
    };

    socket.onmessage = (event) => {
      const message: Message = JSON.parse(event.data);

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

          case 'summary':
            dispatch({
              type: 'SUMMARY',
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

  if (!state.user) {
    return (
      <><p>Connecting...</p></>
    )
  }

  if (state.user.status === 0 && state.summary) {
    return (
      <>
        <button
          onClick={() => requestSearch(0)}
        >Search</button>
        <h2>Games</h2>
        <ul>
          {state.summary.games?.map((game, i) => {
            return (
              <li key={i} className="game">
                <div>
                  <div className="icon">
                    <div className="stats">
                      <div className="p0">{game.players[0]}</div>
                      <div>vs</div>
                      <div className="p1">{game.players[1]}</div>
                    </div>
                  </div>
                  <strong><a href={`#!/game/${game.uuid}`}>{game.uuid}</a></strong>
                </div>
              </li>
            )
          })}
        </ul>
        <h2>Users</h2>
        <ul>
          {state.summary.users?.map((user, i) => {
            return (
              <li key={i} className="user">
                <div>
                  <div className="icon"></div>
                  <strong><a href={`#!/user/${user.uuid}`}>{user.uuid}</a></strong>
                  <br />Status: {user.status === 2 ? 'Gaming' : (user.status === 1 ? 'Searching' : 'Idle')}
                </div>
              </li>
            )
          })}
        </ul>
      </>
    )
  }

  if (state.user.status === 1) {
    return (
      <>
        <p>Waiting for another player...</p>
        <button
          onClick={() => requestSearch(-1)}
        >Exit</button>
      </>
    )
  }

  if (!state.game && state.user.status === 2) {
    return (
      <><p>Please wait...</p></>
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
  
  const theirFinishedPieces = state.game?.pieces[thierPlayerIdx]
    .map((piece, i) => piece.position === 15 ? i : -1)
    .filter(i => i >= 0);
  // console.log(`theirFinishedPieces`);
  // console.log(theirFinishedPieces);

  const weWon = ourFinishedPieces?.length === TOTAL_PIECES;
  const theyWon = theirFinishedPieces?.length === TOTAL_PIECES;

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
                  const startingIndex = ourStartingPieces?.indexOf(i) ?? -1;
                  const endingIndex = ourFinishedPieces?.indexOf(i) ?? -1;

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
                  const startingIndex = theirStartingPieces?.indexOf(i) ?? -1;
                  const endingIndex = theirFinishedPieces?.indexOf(i) ?? -1;

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
          style={{display: !state.game?.status || weWon || theyWon ? 'block' : 'none'}}
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