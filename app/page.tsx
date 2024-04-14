"use client";

import stylex from "@stylexjs/stylex";
import * as React from "react";
import { GameProvider } from "./UrContext";
import { Ur } from "./components/Ur";

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

export type Game = {
	players: Players,
	uuid: string,
	state: number,
	pieces: Pieces,
	moves: ClientMessage[],
	turn: {
		player: number,
		roll: number,
		rolls: number,
	}
};

export type ClientMessage = {
	type: "game" | "move" | "turn" | "user", // move, turn, user, game
	uuid: string,
	player: number,
	piece: number,
	roll: number,
	// me: boolean,
};

export type ServerMessageMove = {
	type: 'move',
	uuid: string,
	player: number,
	piece: number,
	roll: number,
	// me: boolean,
};

export type ServerMessageView = {
	type: 'view',
	uuid: string,
};

export type ServerMessageGame = {
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

export type ServerMessageTurn = {
	type: 'turn',
	player: number,
	roll: number,
	rolls: number,
};

export type ServerMessageUser = {
	type: 'user',
	uuid: string,
};

const s = stylex.create({
  main: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 10,
    paddingTop: 20,
  },
});

export type ServerMessage = ServerMessageMove | ServerMessageTurn | ServerMessageGame | ServerMessageTurn;

export default function Home() {

  return (
    <main className={stylex(s.main)}>
      <GameProvider>
        <Ur />
      </GameProvider>
    </main>
  );
}
