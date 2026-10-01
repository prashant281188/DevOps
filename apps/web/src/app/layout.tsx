import "./globals.css";

export const metadata = {
  title: "3-Tier Application Demo",
  description: "Next.js Presentation Tier",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
