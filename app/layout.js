import './globals.css'

export const metadata = {
  title: 'GitDoc — Auto Documentation Generator',
  description: 'Generate perfect documentation for any GitHub repository',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
