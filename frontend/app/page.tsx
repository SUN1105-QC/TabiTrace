import { HomeClient } from './home-client'
import { publicPage } from '@/lib/site'

export const metadata = publicPage('/')

export default function HomePage() {
  return <HomeClient />
}
