import Link from "next/link";

export default function NotFound() {
  return (
    <main style={{ padding: "48px 24px", textAlign: "center" }}>
      <h1 style={{ fontSize: 28, marginBottom: 12 }}>没有找到这一页</h1>
      <p style={{ marginBottom: 24 }}>
        自定义指南保存在创建它的那台浏览器里，换设备打开会看不到。
      </p>
      <Link href="/">回到首页</Link>
    </main>
  );
}
