// Keyboard input mapped to semantic game controls. Gamepad arrives in M4.

export interface InputState {
  left: boolean
  right: boolean
  thrust: boolean
  action: boolean // edge: launch pod / grapple toggle / lift-off arm
  confirm: boolean // edge: menus, respawn
  pause: boolean // edge
  fire: boolean // edge: pod weapon (M5)
}

const HOLD_KEYS: Record<string, keyof InputState> = {
  ArrowLeft: 'left',
  KeyA: 'left',
  ArrowRight: 'right',
  KeyD: 'right',
  ArrowUp: 'thrust',
  KeyW: 'thrust',
  Space: 'thrust',
}

const EDGE_KEYS: Record<string, keyof InputState> = {
  KeyE: 'action',
  KeyX: 'action',
  Enter: 'confirm',
  Escape: 'pause',
  KeyP: 'pause',
  KeyC: 'fire',
  ShiftLeft: 'fire',
}

export class Input {
  private held = new Set<string>()
  private edges = new Set<keyof InputState>()

  constructor(target: Window) {
    target.addEventListener('keydown', (e) => {
      if (e.repeat) return
      const code = (e as KeyboardEvent).code
      if (HOLD_KEYS[code]) {
        this.held.add(code)
        e.preventDefault()
      }
      const edge = EDGE_KEYS[code]
      if (edge) {
        this.edges.add(edge)
        e.preventDefault()
      }
    })
    target.addEventListener('keyup', (e) => {
      this.held.delete((e as KeyboardEvent).code)
    })
    target.addEventListener('blur', () => this.held.clear())
  }

  private holdActive(control: keyof InputState): boolean {
    for (const [code, mapped] of Object.entries(HOLD_KEYS)) {
      if (mapped === control && this.held.has(code)) return true
    }
    return false
  }

  /** Snapshot for one sim tick; edge-triggered controls are consumed. */
  poll(): InputState {
    const s: InputState = {
      left: this.holdActive('left'),
      right: this.holdActive('right'),
      thrust: this.holdActive('thrust'),
      action: this.edges.has('action'),
      confirm: this.edges.has('confirm'),
      pause: this.edges.has('pause'),
      fire: this.edges.has('fire'),
    }
    this.edges.clear()
    return s
  }
}
