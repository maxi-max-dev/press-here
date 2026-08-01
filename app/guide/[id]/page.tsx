import type { Metadata } from "next";

import { GuidePlayer } from "./player";

export const metadata: Metadata = {
  title: "移动操作指南",
  description: "一步一屏地完成设备操作。",
};

interface GuidePageProps {
  params: Promise<{ id: string }>;
}

export function generateStaticParams() {
  return [{ id: "coffee-machine" }, { id: "projector" }];
}

export const dynamicParams = false;

export default async function GuidePage({ params }: GuidePageProps) {
  const { id } = await params;
  return <GuidePlayer projectId={id} />;
}
