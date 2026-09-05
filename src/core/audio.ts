// Synthesized WebAudio SFX — no assets. The context is created on the first
// user input (browser autoplay rules). Continuous sounds (thrust, rope
// strain) are set every frame; one-shots fire from game events.

export type SfxName = 'thud' | 'impact' | 'boom' | 'zap' | 'rumble' | 'chime'

export class GameAudio {
  private ctx: AudioContext | null = null
  private noise: AudioBuffer | null = null
  private thrustGain: GainNode | null = null
  private thrustFilter: BiquadFilterNode | null = null
  private strainGain: GainNode | null = null

  /** Call after a user gesture; safe to call every frame. */
  ensure(): void {
    if (this.ctx) return
    try {
      this.ctx = new AudioContext()
    } catch {
      return
    }
    const ctx = this.ctx

    // 1s of white noise, reused by everything.
    const buf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate)
    const data = buf.getChannelData(0)
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1
    this.noise = buf

    // Looping thrust noise: filter + gain, gain driven per frame.
    const src = ctx.createBufferSource()
    src.buffer = buf
    src.loop = true
    this.thrustFilter = ctx.createBiquadFilter()
    this.thrustFilter.type = 'lowpass'
    this.thrustFilter.frequency.value = 220
    this.thrustGain = ctx.createGain()
    this.thrustGain.gain.value = 0
    src.connect(this.thrustFilter).connect(this.thrustGain).connect(ctx.destination)
    src.start()

    // Rope strain: creaking sawtooth, gain driven per frame.
    const osc = ctx.createOscillator()
    osc.type = 'sawtooth'
    osc.frequency.value = 65
    const strainFilter = ctx.createBiquadFilter()
    strainFilter.type = 'bandpass'
    strainFilter.frequency.value = 300
    strainFilter.Q.value = 6
    this.strainGain = ctx.createGain()
    this.strainGain.gain.value = 0
    osc.connect(strainFilter).connect(this.strainGain).connect(ctx.destination)
    osc.start()
  }

  setThrust(kind: 'none' | 'ship' | 'pod'): void {
    if (!this.ctx || !this.thrustGain || !this.thrustFilter) return
    const t = this.ctx.currentTime
    const gain = kind === 'none' ? 0 : kind === 'ship' ? 0.16 : 0.1
    const freq = kind === 'ship' ? 180 : 520
    this.thrustGain.gain.setTargetAtTime(gain, t, 0.05)
    if (kind !== 'none') this.thrustFilter.frequency.setTargetAtTime(freq, t, 0.05)
  }

  setStrain(strain: number): void {
    if (!this.ctx || !this.strainGain) return
    const level = Math.min(strain / 140, 1) * 0.12
    this.strainGain.gain.setTargetAtTime(level, this.ctx.currentTime, 0.08)
  }

  play(name: SfxName, intensity = 1): void {
    if (!this.ctx || !this.noise) return
    const ctx = this.ctx
    const t = ctx.currentTime
    const vol = Math.max(0.05, Math.min(intensity, 1.5))

    const noiseBurst = (dur: number, freq: number, type: BiquadFilterType, gain: number) => {
      const src = ctx.createBufferSource()
      src.buffer = this.noise
      const f = ctx.createBiquadFilter()
      f.type = type
      f.frequency.value = freq
      const g = ctx.createGain()
      g.gain.setValueAtTime(gain * vol, t)
      g.gain.exponentialRampToValueAtTime(0.001, t + dur)
      src.connect(f).connect(g).connect(ctx.destination)
      src.start(t, Math.random(), dur + 0.05)
    }

    const tone = (freq0: number, freq1: number, dur: number, type: OscillatorType, gain: number) => {
      const o = ctx.createOscillator()
      o.type = type
      o.frequency.setValueAtTime(freq0, t)
      o.frequency.exponentialRampToValueAtTime(Math.max(freq1, 1), t + dur)
      const g = ctx.createGain()
      g.gain.setValueAtTime(gain * vol, t)
      g.gain.exponentialRampToValueAtTime(0.001, t + dur)
      o.connect(g).connect(ctx.destination)
      o.start(t)
      o.stop(t + dur + 0.05)
    }

    switch (name) {
      case 'thud':
        tone(95, 45, 0.2, 'sine', 0.5)
        noiseBurst(0.12, 300, 'lowpass', 0.2)
        break
      case 'impact':
        noiseBurst(0.2, 900, 'highpass', 0.35)
        tone(140, 60, 0.15, 'triangle', 0.3)
        break
      case 'boom':
        noiseBurst(0.9, 400, 'lowpass', 0.8)
        tone(70, 28, 0.8, 'sine', 0.7)
        break
      case 'zap':
        tone(950, 240, 0.11, 'square', 0.16)
        break
      case 'rumble':
        noiseBurst(0.5, 180, 'lowpass', 0.55)
        break
      case 'chime':
        tone(660, 660, 0.16, 'sine', 0.2)
        setTimeout(() => tone(990, 990, 0.22, 'sine', 0.18), 90)
        break
    }
  }
}
