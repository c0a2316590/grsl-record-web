"use client";

import dynamic from "next/dynamic";

const RouteEditorMap = dynamic(
  () => import("./RouteEditorMap"),
  {
    ssr: false,
  }
);

export default function RouteEditorPage() {
  return (
    <main
      style={{
        width: "100vw",
        height: "100vh",
        margin: 0,
        padding: 0,
      }}
    >
      <RouteEditorMap />
    </main>
  );
}