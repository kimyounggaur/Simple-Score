import "../style.css";

export const metadata = {
  title: "Lesson Designer Music Score Editor",
  description: "Educational music score editor",
};

export default function RootLayout({ children }) {
  return (
    <html lang="ko">
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
