import { ToastProvider } from './components/Toast'
import { Reveal } from './components/Reveal'
import { Cover } from './sections/Cover'
import { Greeting } from './sections/Greeting'
import { Calendar } from './sections/Calendar'
import { Gallery } from './sections/Gallery'
import { Location } from './sections/Location'
import { Accounts } from './sections/Accounts'
import { Guestbook } from './sections/Guestbook'
import { ShareFooter } from './sections/ShareFooter'

export default function App() {
  return (
    <ToastProvider>
      <main className="page">
        <Cover />
        <Reveal>
          <Greeting />
        </Reveal>
        <div className="section-divider" />
        <Reveal>
          <Calendar />
        </Reveal>
        <Reveal>
          <Gallery />
        </Reveal>
        <Reveal>
          <Location />
        </Reveal>
        <Reveal>
          <Accounts />
        </Reveal>
        <Reveal>
          <Guestbook />
        </Reveal>
        <div className="section-divider" />
        <Reveal>
          <ShareFooter />
        </Reveal>
      </main>
    </ToastProvider>
  )
}
