import React from 'react';
import { useGame } from '../UrContext';

export type PieceProps = {
  index: number,
  // position?: number,
  mode: number,
  player: number,
  move?: CallableFunction,
};

export const Piece: React.FC<PieceProps> = (props) => {
  const { state, dispatch } = useGame();

  if (!state?.game) {
    return null;
  }

  // console.log(props);

  return (
    <div
      className={`p${state.game?.pieces[props.player][props.index].position ?? 0} m${props.mode}`}
      onClick={(): boolean => {
        if (props.mode === 0) return false;
        if (props.move) {
          props.move();
        }
        return true;
      }}
    ><div></div></div>
  )
};