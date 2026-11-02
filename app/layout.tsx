import { GeistMono } from "geist/font/mono"
import { GeistSans } from "geist/font/sans"
import localFont from "next/font/local"

import "./globals.css"
import { RootEffects } from "@/components/shell/root-effects"
import { ThemeProvider } from "@/components/theme-provider"
import { cn } from "@/lib/utils"

const notoSerif = localFont({
  src: "../node_modules/@fontsource-variable/noto-serif/files/noto-serif-latin-wght-normal.woff2",
  variable: "--font-noto-serif",
  weight: "100 900",
  display: "swap",
})

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={cn(
        "antialiased",
        GeistSans.variable,
        GeistMono.variable,
        "font-serif",
        notoSerif.variable,
      )}
    >
      <body className="min-h-svh overflow-x-hidden">
        <ThemeProvider>
          <RootEffects>{children}</RootEffects>
        </ThemeProvider>
      </body>
    </html>
  )
}
