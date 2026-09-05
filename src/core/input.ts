// Keyboard + gamepad input mapped to semantic game controls.
//
// Keyboard: arrows/WASD move, Space/W/Up thrust, E/X action, C/Shift fire,
// Enter confirm, Esc/P pause, N new game (in the pause menu).
// Gamepad: stick/dpad rotate-steer, A thrust, B or X action, Y fire,
// Start pause, A confirm.

export interface InputState {
  left: boolean
  right: boolean
  thrust: boolean
  action: boolean // edge: launch pod / grapple toggle / pause-menu restart
  confirm: boolean // edge: menus, respawn
  pause: boolean // edge
  fire: boolean // edge: pod weapon
  reset: boolean // edge: new game from the pause menu (keyboard N)
}

const HOLD_KEYS: Record<string, 'left' | 'right' | 'thrust'> = {
  ArrowLeft: 'left',
  KeyA: 'left',
  ArrowRight: 'right',
  KeyD: 'right',
  ArrowUp: 'thrust',
  KeyW: 'thrust',
  Space: 'thrust',
}

const EDGE_KEYS: Record<string, 'action' | 'confirm' | 'pause' | 'fire' | 'reset'> = {
  KeyE: 'action',
  KeyX: 'action',
  Enter: 'confirm',
  Escape: 'pause',
  KeyP: 'pause',
  KeyC: 'fire',
  ShiftLeft: 'fire',
  KeyN: 'reset',
}

const PAD_EDGE_BUTTONS: Record<number, 'action' | 'confirm' | 'pause' | 'fire'> = {
  0: 'confirm', // A (also thrust as a hold)
  1: 'action', // B
  2: 'action', // X
  3: 'fire', // Y
  9: 'pause', // Start
}

export class Input {
  private held = new Set<string>()
  private edges = new Set<keyof InputState>()
  private padButtonsDown = new Set<number>()

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

  private holdActive(control: 'left' | 'right' | 'thrust'): boolean {
    for (const [code, mapped] of Object.entries(HOLD_KEYS)) {
      if (mapped === control && this.held.has(code)) return true
    }
    return false
  }

  private pollGamepad(s: InputState): void {
    const pads = typeof navigator !== 'undefined' ? navigator.getGamepads?.() : null
    const pad = pads ? Array.from(pads).find((p) => p?.connected) : null
    if (!pad) {
      this.padButtonsDown.clear()
      return
    }

    const axis = pad.axes[0] ?? 0
    if (axis < -0.4 || pad.buttons[14]?.pressed) s.left = true
    if (axis > 0.4 || pad.buttons[15]?.pressed) s.right = true
    if (pad.buttons[0]?.pressed || pad.buttons[12]?.pressed || pad.buttons[7]?.pressed) {
      s.thrust = true
    }

    const down = new Set<number>()
    for (const [btn, control] of Object.entries(PAD_EDGE_BUTTONS)) {
      const idx = Number(btn)
      if (pad.buttons[idx]?.pressed) {
        down.add(idx)
        if (!this.padButtonsDown.has(idx)) s[control] = true
      }
    }
    this.padButtonsDown = down
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
      reset: this.edges.has('reset'),
    }
    this.edges.clear()
    this.pollGamepad(s)
    return s
  }
}
