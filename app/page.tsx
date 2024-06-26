"use client";

import stylex from "@stylexjs/stylex";
import * as React from "react";
import { GameProvider } from "./UrContext";
import { Ur } from "./components/Ur";

const s = stylex.create({
  main: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 10,
    paddingTop: 20,
  },
});

export default function Home() {

  // className={stylex(s.main)}

  return (
    <main>
      <GameProvider>
        <Ur />
      </GameProvider>
    </main>
  );
}
