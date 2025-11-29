import interFontUrl from '@fontsource-variable/inter/files/inter-latin-wght-normal.woff2?url'
import { createRootRoute, Outlet } from '@tanstack/react-router'

export const Route = createRootRoute({
  component: RootLayout,
})

function RootLayout() {
  return (
    <>
      <link
        rel="preload"
        as="font"
        type="font/woff2"
        href={interFontUrl}
        crossOrigin="anonymous"
      />
      <div className="min-h-screen text-white">
        <Outlet />
      </div>
    </>
  )
}
