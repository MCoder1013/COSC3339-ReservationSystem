import './style.css'
import typescriptLogo from './typescript.svg'
import viteLogo from '/vite.svg'
import { setupCounter } from './counter.ts'

document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
  <div>
    <p>We are checking to make sure this works properly</p>
    <p>If you can see this message the frontend works!</p>
  </div>
`

setupCounter(document.querySelector<HTMLButtonElement>('#counter')!)
