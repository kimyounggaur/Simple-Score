import "../style.css";

export const metadata = {
  title: "Simple Score 악보 편집기",
  description: "교육용 악보 작업 편집기",
};

export default function RootLayout({ children }) {
  return (
    <html lang="ko">
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
