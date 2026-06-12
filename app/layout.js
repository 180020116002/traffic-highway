// app/layout.js
export const metadata = {
  title: 'Traffic Highway Real-time Visitor Dashboard',
  description: 'Live network traffic visualization powered by Google Analytics 4',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="true" />
        <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;700&display=swap" rel="stylesheet" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </head>
      <body style={{ margin: 0, padding: 0, background: '#0d1117' }}>
        {children}
      </body>
    </html>
  );
}
