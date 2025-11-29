import { GravityTestPage } from '@/components/GravityTestPage'
import { createFileRoute, notFound } from '@tanstack/react-router'

export const Route = createFileRoute('/gravity-test')({
  beforeLoad: () => {
    if (!import.meta.env.DEV) {
      throw notFound()
    }
  },
  component: GravityTestPage,
})
