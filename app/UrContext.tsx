import * as React from "react";
import { Game, Piece, Pieces, ServerMessageGame, ServerMessageMove, ServerMessageTurn, ServerMessageUser, User } from "./page";

export const TOTAL_PIECES = 7;

export type UrState = {
  socket?: WebSocket,
  user?: User,
  game?: Game
};

export type Action = | {
  type: 'CONNECT';
  payload: WebSocket
} | {
  type: 'MOVE';
  payload: ServerMessageMove
} | {
  type: 'TURN';
  payload: ServerMessageTurn
} | {
  type: 'GAME';
  payload: ServerMessageGame
} | {
  type: 'USER';
  payload: ServerMessageUser
};

// Create a context
const GameContext = React.createContext<{
  state: UrState;
  dispatch: React.Dispatch<Action>
} | undefined>(undefined);

// Reducer function
function reducer(
  state: UrState,
  action: Action
): UrState {
  // console.log(`reducer`);
  console.log(action);

  let newState: UrState = {
    ...state,
  };

  switch (action.type) {
    case 'CONNECT':
      newState.socket = action.payload;
      console.log(newState);

      return newState;

    case 'MOVE':
      if (
        newState.game
        && action.payload.piece >= 0
      ) {
        const nextPos = action.payload.roll;

        if (action.payload.player >= 0) {
          newState.game.pieces[action.payload.player][action.payload.piece] = {
            position: nextPos,
            mode: 1,
          };
        }

        if (nextPos > 4 && nextPos < 13) {
          const opposingPlayerIndex = (action.payload.player === 0 ? 1 : 0);
          newState.game.pieces[opposingPlayerIndex].forEach((piece, i) => {
            if (piece.position === nextPos && newState.game)
              newState.game.pieces[opposingPlayerIndex][i] = {
                position: 0,
                mode: 1,
              };
          });
        }
      }

      console.log(newState);

      return newState;

    case 'TURN':
      newState = {
        ...newState,
        game: {
          state: state.game?.state ?? 0,
          players: state.game?.players ?? [],
          uuid: state.game?.uuid ?? '',
          pieces: state.game?.pieces ?? [],
          moves: state.game?.moves ?? [],
          turn: {
            player: action.payload.player,
            roll: action.payload.roll,
            rolls: action.payload.rolls,
          }
        }
      };

      // Auto-continue after rolling a zero
      if (newState.game && newState.game.players[action.payload.player] === newState.user?.uuid) {
        let skipMove = false;

        if (action.payload.roll === 0) {
          console.log(`Rolled a zero`);
          skipMove = true;
        } else {
          try {
            let pieceMovable: number[] = [];

            const playerIndex = newState.game?.turn.player;
  
            // Check position is not occupied by another own piece
            let ourPieces = newState.game?.pieces[playerIndex];
            if (!ourPieces)
              throw new Error(`Invalid game piece data`);

            if (newState.game?.turn.roll === undefined)
              throw new Error(`Invalid game turn data`);

            const opposingPlayerIndex = (playerIndex === 0 ? 1 : 0);
            const opposingPieces = newState.game?.pieces[opposingPlayerIndex];
  
            for (let i = 0; i < TOTAL_PIECES; i++) {
              const piece = newState.game?.pieces[newState.game?.turn.player][i];
              const nextPos = piece.position + newState.game?.turn.roll;

              let isMovable = true;
      
              // Piece can not be moved this many spaces
              if (nextPos > 15)
                isMovable = false;
    
              if (ourPieces.length) {
                for (let j = 0; j < ourPieces.length; j++) {
                  if (ourPieces[j].position === nextPos && nextPos < 15) {
                    // throw new Error(`Illegal move: Piece ${j} at ${piece.position} to ${nextPos}`);
                    console.error(`Illegal move: Piece ${j} at ${piece.position} to ${nextPos}`);
                    isMovable = false;
                  }
                }
              }
    
              // Traversing the gauntlet
              if (nextPos > 4 && nextPos < 13) {
                if (opposingPieces?.length) {
                  for (let j = 0; j < opposingPieces.length; j++) {
    
                    // Hit opposing piece
                    if (opposingPieces[j].position === nextPos) {
    
                      // They're protected on this rosette
                      if (nextPos === 8)
                        isMovable = false;
                    }
                  }
                }
              }
  
              if (isMovable)
                pieceMovable.push(i);
              else {
                newState.game.pieces[playerIndex][i] = {
                  position: newState.game.pieces[playerIndex][i].position ?? 0,
                  mode: 1,
                };
              }
            }
  
            // Can't move
            if (pieceMovable.length === 0) {
              console.warn(`Can't move any pieces`);
              skipMove = true;
            } else {
              // console.log(`pieceMovable`);
              // console.log(pieceMovable);
              for (let i = 0; i < pieceMovable.length; i++) {
                const piece = pieceMovable[i];
                // console.log(`Piece: ${piece}`);
                newState.game.pieces[playerIndex][piece] = {
                  position: newState.game.pieces[playerIndex][piece].position ?? 0,
                  mode: 2,
                };
              }
            }
          } catch (data: any) {
            const error: Error = data;
            console.error(error.message);
          }
        }

        if (skipMove) {
          setTimeout(() => {
            console.log(`skipMove`);
            const request: ServerMessageMove = {
              type: 'move',
              uuid: newState.game?.uuid ?? '',
              player: Number(newState.game?.players.indexOf(newState.user?.uuid ?? '')),
              piece: -1,
              roll: 0,
            };
            newState.socket?.send(JSON.stringify(request));
          }, 2000);
        }
      }

      console.log(newState);

      return newState;

    case 'GAME':
      let pieces: Pieces = [];
      for (let i = 0; i < action.payload.pieces.length; i++) {
        pieces[i] = [];
        for (let j = 0; j < action.payload.pieces[i].length; j++) {
          const piece: Piece = {
            position: action.payload.pieces[i][j],
            mode: 0
          }
          pieces[i].push(piece);
        }
      }

      newState.game = {
        state: action.payload.state,
        players: action.payload.players,
        uuid: action.payload.uuid,
        pieces: pieces,
        moves: [],
        turn: {
          player: 0,
          roll: 0,
          rolls: 0,
        }
      };
      console.log(newState);

      window.location.hash = `#!/game/${action.payload.uuid}`;

      return newState;

    case 'USER':
      newState.user = {
        status: 1,
        uuid: action.payload.uuid,
      };
      console.log(newState);

      return newState;

    default:
      return state;
  }
}

// Context provider component
export const GameProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const initState: UrState = {};
  const [state, dispatch] = React.useReducer(reducer, initState);

  return (
    <GameContext.Provider value={{ state, dispatch }}>
      {children}
    </GameContext.Provider>
  );
};

export const useGame = () => {
  const context = React.useContext(GameContext);
  if (context === undefined) {
    throw new Error('useGame must be used within a GameContext');
  }
  return context;
};