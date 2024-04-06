import * as React from "react";
import { Game, ServerMessageGame, ServerMessageMove, ServerMessageTurn, ServerMessageUser, User } from "./page";

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
      const nextPos = action.payload.roll;

      // Update piece
      if (newState.game) {
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
      if (
        action.payload.roll === 0
        && newState.game?.players[action.payload.player] === newState.user?.uuid
      ) {
        setTimeout(() => {
          console.log(`Rolled zero`);
          const request: ServerMessageMove = {
            type: 'move',
            uuid: newState.game?.uuid ?? '',
            player: Number(newState.game?.players.indexOf(newState.user?.uuid ?? '')),
            piece: 0,
            roll: 0,
          };
          console.log(request);
          newState.socket?.send(JSON.stringify(request));
        }, 1000);
      }

      // if (newState.game?.turn.player) {
      //   const playerUuid = state.game?.players[newState.game?.turn.player];
      //   const me = playerUuid === state.user?.uuid;
      //   if (me) {
      //     let totalInactive = 0;

      //     for (let i = 0; i < TOTAL_PIECES; i++) {
      //       let mode = 0;
      //       const piece = newState.game?.pieces[newState.game?.turn.player][i]
      //       if (!piece.position) continue;
            
      //       // console.log('piece '+i+' at ' + currPos + ' rolling ' + newState.game?.turn.roll);
    
      //       // We are attempting a piece move
      //       if (typeof newState.game?.turn.roll !== 'undefined' && newState.game?.turn.roll > 0) {
      //         let nextPos = piece.position + newState.game?.turn.roll;
    
      //         // Piece can not be moved this many spaces
      //         if (nextPos > 15) continue;
    
      //         const playerIndex = state.game?.turn.player;
      //         if (!playerIndex) continue;
    
      //         // Check position is not occupied by another own piece
      //         let ourPieces = state.game?.pieces[playerIndex];
      //         if (!ourPieces) continue;
    
      //         if (ourPieces.length) {
      //           for (let i = 0; i < ourPieces.length; i++) {
      //             if (ourPieces[i].position === nextPos && nextPos < 15) {
      //               console.log('cannot move piece ' + i + ' at '+piece.position+' to ' + nextPos);
      //               continue;
      //             }
      //           }
      //         }
    
      //         // Traversing the gauntlet
      //         if (nextPos > 4 && nextPos < 13) {
      //           let opposingPlayerIndex = (playerIndex === 0 ? 1 : 0);
      //           let opposingPieces = state.game?.pieces[opposingPlayerIndex];
      //           if (!opposingPieces)
      //             return 0;
    
      //           if (opposingPieces.length) {
      //             for (let i = 0; i < opposingPieces.length; i++) {
    
      //               // Hit opposing piece
      //               if (opposingPieces[i] === nextPos) {
    
      //                 // They're protected on this rosette, cannot move k spaces to j
      //                 if (nextPos === 8)
      //                   return 0;
    
      //                 // Reset opposing piece
      //                 // console.log('reset opposing piece '+nextPos);
      //                 if (state.game)
      //                   newState.game.pieces[opposingPlayerIndex][i].position = 0;
      //               }
      //             }
      //           }
      //         }
    
      //         // Move piece to new position on board
      //         // console.log('can move piece ' + piece + ' at '+currPos+' to ' + nextPos);
      //         return nextPos;
      //       }
    
      //       // No moves possible
      //       return 0;
      //     }
      //   }
      // }

      console.log(newState);

      return newState;
    case 'GAME':
      newState.game = {
        players: action.payload.players,
        uuid: action.payload.uuid,
        pieces: action.payload.pieces,
        moves: [],
        turn: {
          player: 0,
          roll: 0,
          rolls: 0,
        }
      };
      console.log(newState);

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