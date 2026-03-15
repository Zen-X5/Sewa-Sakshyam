import "./globals.css";

export const metadata = {
  title: "Online Exam Platform",
  description: "Mock test system for competitive exams",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
