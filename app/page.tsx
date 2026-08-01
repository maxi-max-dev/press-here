import type { Metadata } from "next";
import { Editor } from "./editor";

export const metadata: Metadata = {
  title: "按这里 / PRESS HERE",
  description: "把设备照片和说明文字变成可扫码、可逐步执行的操作指南。",
};

export default function Home() {
  return <Editor />;
}
