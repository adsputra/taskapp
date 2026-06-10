"use client";

import { use } from "react";
import BoardPage from "@/screens/Board";

export default function BoardDetailPage({ params }) {
  const { id } = use(params);
  return <BoardPage boardId={id} />;
}
