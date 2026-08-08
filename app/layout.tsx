import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";
import { resolveRequestOrigin } from "./lib/request-origin";

export async function generateMetadata(): Promise<Metadata> {
  const isPagesExport = process.env.PAGES_EXPORT === "1";
  const origin = isPagesExport
    ? "https://maxi-max-dev.github.io/press-here"
    : await headers().then((requestHeaders) =>
        resolveRequestOrigin({
          forwardedHost: requestHeaders.get("x-forwarded-host"),
          host: requestHeaders.get("host"),
          forwardedProto: requestHeaders.get("x-forwarded-proto"),
        }),
      );
  const description = "把设备照片上的真实控件变成一步一屏的操作指南。";

  return {
    metadataBase: new URL(origin),
    title: { default: "按这里 / PRESS HERE", template: "%s · 按这里" },
    description,
    icons: {
      icon: `${origin}/favicon.svg`,
      shortcut: `${origin}/favicon.svg`,
    },
    openGraph: {
      title: "按这里 / PRESS HERE",
      description,
      images: [{ url: `${origin}/og.png`, width: 1200, height: 630, alt: "按这里设备操作指南编辑器" }],
    },
    twitter: {
      card: "summary_large_image",
      title: "按这里 / PRESS HERE",
      description,
      images: [`${origin}/og.png`],
    },
  };
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
