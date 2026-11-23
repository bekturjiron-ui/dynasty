import { useEffect, useRef, useState } from 'react'
import { loadModel, loadThree } from '../lib/three-loader'

const BASE = import.meta.env.BASE_URL

function prefersReducedMotion() {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/**
 * 3D-меч (public/models/sword.glb, 194 КБ) выполняет стремительный диагональный разрез
 * сверху-справа налево-вниз. В точке пересечения центра вызывает onSlash.
 * После завершения дуги цикл rAF останавливается (0% GPU в простое).
 */
function SwordSlash3D({ playKey, onSlash }: { playKey: number; onSlash: () => void }) {
  const hostRef = useRef<HTMLDivElement>(null)
  const onSlashRef = useRef(onSlash)
  onSlashRef.current = onSlash

  useEffect(() => {
    if (prefersReducedMotion()) return
    const host = hostRef.current
    if (!host) return

    let disposed = false
    let raf = 0
    let renderer: { dispose: () => void; domElement: HTMLCanvasElement; render: (s: unknown, c: unknown) => void; setPixelRatio: (n: number) => void; setSize: (w: number, h: number) => void; toneMapping: number; toneMappingExposure: number } | null = null

    ;(async () => {
      try {
        const t = await loadThree()
        const proto = await loadModel(t, 'sword')
        if (disposed || !hostRef.current) return

        const { THREE } = t
        const w = host.clientWidth || 280
        const h = host.clientHeight || 300

        const scene = new THREE.Scene()
        const camera = new THREE.PerspectiveCamera(36, w / h, 0.1, 20)
        camera.position.set(0, 0.05, 4.35)

        const r = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'high-performance' })
        r.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
        r.setSize(w, h)
        r.toneMapping = THREE.ACESFilmicToneMapping
        r.toneMappingExposure = 1.22
        r.domElement.style.width = '100%'
        r.domElement.style.height = '100%'
        r.domElement.style.display = 'block'
        host.innerHTML = ''
        host.appendChild(r.domElement)
        renderer = r as unknown as typeof renderer

        // Освещение «тёмное золото» + багровый отблеск боя + стальной контур
        scene.add(new THREE.AmbientLight(0x2a231e, 1.0))
        const keyLight = new THREE.DirectionalLight(0xf6d580, 3.2)
        keyLight.position.set(2.5, 3.0, 3.5)
        scene.add(keyLight)

        const rimLight = new THREE.DirectionalLight(0x9ab4d6, 1.4)
        rimLight.position.set(-2.8, 1.0, -1.2)
        scene.add(rimLight)

        const bloodGlow = new THREE.PointLight(0xc21b2b, 2.8, 8)
        bloodGlow.position.set(-0.4, -0.8, 1.6)
        scene.add(bloodGlow)

        const sword = proto.clone(true)
        sword.scale.setScalar(1.08)
        sword.traverse((obj) => {
          const mesh = obj as { isMesh?: boolean; material?: unknown }
          if (!mesh.isMesh || !mesh.material) return
          const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
          const cloned = mats.map((m) => {
            const c = (m as { clone: () => Record<string, unknown> }).clone()
            if ('metalness' in c && typeof c.metalness === 'number') c.metalness = Math.min(1, Math.max(0.55, c.metalness))
            if ('roughness' in c && typeof c.roughness === 'number') c.roughness = Math.min(0.52, Math.max(0.2, c.roughness))
            return c
          })
          mesh.material = Array.isArray(mesh.material) ? cloned : cloned[0]
        })

        const pivot = new THREE.Group()
        pivot.add(sword)
        scene.add(pivot)

        const t0 = performance.now()
        let slashFired = false

        const tick = (now: number) => {
          if (disposed) return
          const dt = (now - t0) / 1000

          if (dt < 0.18) {
            // Замах сверху-справа
            const p = dt / 0.18
            const ease = 1 - Math.pow(1 - p, 2)
            pivot.position.set(1.55 - 0.15 * ease, 1.25 + 0.15 * ease, 0.7)
            pivot.rotation.set(0.25, -0.65 + 0.25 * ease, -1.22)
            r.domElement.style.opacity = String(p)
          } else if (dt < 0.42) {
            // Стремительный рубящий разрез по диагонали сверху-справа → вниз-влево
            const p = (dt - 0.18) / 0.24
            // Ускорение на входе и жёсткий проход через центр
            const ease = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2
            const x = 1.4 - 2.65 * ease
            const y = 1.4 - 2.55 * ease
            const z = 0.7 - Math.sin(ease * Math.PI) * 0.95
            pivot.position.set(x, y, z)
            // Разворот клинка в дуге удара
            pivot.rotation.set(0.25 - 0.45 * ease, -0.4 + 0.95 * ease, -1.22 + 0.85 * ease)
            keyLight.position.x = 2.5 - 3.5 * ease
            r.domElement.style.opacity = '1'

            if (p >= 0.42 && !slashFired) {
              slashFired = true
              onSlashRef.current()
            }
          } else if (dt < 0.78) {
            // Завершение взмаха и растворение клинка в темноте
            if (!slashFired) {
              slashFired = true
              onSlashRef.current()
            }
            const p = (dt - 0.42) / 0.36
            const ease = 1 - Math.pow(1 - p, 2)
            pivot.position.set(-1.25 - 0.25 * ease, -1.15 - 0.2 * ease, 0.7)
            pivot.rotation.set(-0.2, 0.55 + 0.15 * ease, -0.37 + 0.12 * ease)
            r.domElement.style.opacity = String(Math.max(0, 1 - p))
          } else {
            r.domElement.style.opacity = '0'
            r.render(scene, camera)
            return // стоп: 0% GPU
          }

          r.render(scene, camera)
          raf = requestAnimationFrame(tick)
        }

        raf = requestAnimationFrame(tick)
      } catch {
        if (!disposed) setTimeout(() => onSlashRef.current(), 280)
      }
    })()

    return () => {
      disposed = true
      cancelAnimationFrame(raf)
      if (renderer) {
        renderer.dispose()
        if (renderer.domElement.parentNode === host) host.removeChild(renderer.domElement)
      }
    }
  }, [playKey])

  return (
    <div
      ref={hostRef}
      className="bd-sword-canvas pointer-events-none absolute -inset-6 z-20"
      aria-hidden="true"
    />
  )
}

/** Суровый росчерк разреза клинка (кроваво-золотой мазок точно по линии рассечения босса). */
function SlashCutVFX({ active }: { active: boolean }) {
  if (!active) return null
  return (
    <svg
      viewBox="0 0 240 272"
      className="bd-cut-svg pointer-events-none absolute inset-0 z-25 h-full w-full overflow-visible"
      aria-hidden="true"
    >
      <defs>
        <filter id="bd-cut-rough" x="-20%" y="-20%" width="140%" height="140%">
          <feTurbulence type="fractalNoise" baseFrequency="0.08 0.16" numOctaves="3" seed="11" result="n" />
          <feDisplacementMap in="SourceGraphic" in2="n" scale="5" xChannelSelector="R" yChannelSelector="G" />
        </filter>
        <linearGradient id="bd-cut-blood" x1="1" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#8c0810" stopOpacity="0" />
          <stop offset="28%" stopColor="#c41420" stopOpacity="0.95" />
          <stop offset="55%" stopColor="#e8b85c" stopOpacity="0.95" />
          <stop offset="82%" stopColor="#9e0a14" stopOpacity="0.9" />
          <stop offset="100%" stopColor="#5c0408" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="bd-cut-core" x1="1" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#fff3c4" stopOpacity="0" />
          <stop offset="48%" stopColor="#fff6d6" stopOpacity="1" />
          <stop offset="100%" stopColor="#e8aa42" stopOpacity="0" />
        </linearGradient>
      </defs>
      {/* Рваный багрово-золотой след рассечения точно по диагонали (100%,24%) → (0%,76%) */}
      <path
        className="bd-cut-trail"
        d="M254 56 Q128 130 -14 214"
        fill="none"
        stroke="url(#bd-cut-blood)"
        strokeWidth="12"
        strokeLinecap="round"
        filter="url(#bd-cut-rough)"
      />
      {/* Острая золотая нить самого лезвия */}
      <path
        className="bd-cut-core"
        d="M250 60 L-10 210"
        fill="none"
        stroke="url(#bd-cut-core)"
        strokeWidth="2.8"
        strokeLinecap="round"
      />
    </svg>
  )
}

/** Кровавый крест сухими грубыми мазками кисти с рваными краями (как на референсе). */
function BloodCross({ active }: { active: boolean }) {
  return (
    <svg
      viewBox="0 0 240 240"
      className={`bd-blood-cross pointer-events-none absolute inset-0 z-30 m-auto h-44 w-44 sm:h-52 sm:w-52${active ? ' on' : ''}`}
      aria-hidden="true"
    >
      <defs>
        <filter id="bd-brush" x="-15%" y="-15%" width="130%" height="130%">
          <feTurbulence type="fractalNoise" baseFrequency="0.065 0.14" numOctaves="4" seed="7" result="noise" />
          <feDisplacementMap in="SourceGraphic" in2="noise" scale="7.5" xChannelSelector="R" yChannelSelector="G" result="rough" />
          <feDropShadow dx="0" dy="2" stdDeviation="3.5" floodColor="#180204" floodOpacity="0.85" />
        </filter>
        <linearGradient id="bd-blood-1" x1="0" y1="1" x2="1" y2="0">
          <stop offset="0%" stopColor="#6c050a" />
          <stop offset="35%" stopColor="#a60d16" />
          <stop offset="72%" stopColor="#8e0810" />
          <stop offset="100%" stopColor="#5c0408" />
        </linearGradient>
        <linearGradient id="bd-blood-2" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#7a060c" />
          <stop offset="48%" stopColor="#9d0c14" />
          <stop offset="100%" stopColor="#580308" />
        </linearGradient>
      </defs>

      {/* Мазок 1: снизу-слева вверх-направо */}
      <g className="bd-stroke-1" filter="url(#bd-brush)">
        <path d="M28 214 C64 176, 128 110, 198 44 L208 55 C144 120, 82 180, 40 220 Z" fill="url(#bd-blood-1)" />
        <path d="M46 206 L194 60" stroke="#78070d" strokeWidth="4.5" strokeLinecap="round" opacity="0.85" />
        <path d="M168 62 L214 38" stroke="#8f0a12" strokeWidth="3.2" strokeLinecap="round" opacity="0.78" />
        <path d="M178 76 L218 48" stroke="#6d050a" strokeWidth="2.2" strokeLinecap="round" opacity="0.7" />
        <path d="M22 218 L64 182" stroke="#7d070e" strokeWidth="2.6" strokeLinecap="round" opacity="0.72" />
        <circle cx="212" cy="40" r="2.2" fill="#8f0a12" opacity="0.8" />
        <circle cx="34" cy="216" r="1.8" fill="#6f060b" opacity="0.75" />
      </g>

      {/* Мазок 2: сверху-слева вниз-направо */}
      <g className="bd-stroke-2" filter="url(#bd-brush)">
        <path d="M68 54 C106 86, 152 132, 212 194 L202 201 C146 146, 98 102, 57 66 Z" fill="url(#bd-blood-2)" />
        <path d="M62 62 L206 196" stroke="#75060c" strokeWidth="4" strokeLinecap="round" opacity="0.82" />
        <path d="M74 52 L114 82" stroke="#990c14" strokeWidth="2.8" strokeLinecap="round" opacity="0.75" />
        <path d="M164 152 L217 198" stroke="#6a0409" strokeWidth="2.2" strokeLinecap="round" opacity="0.72" />
        <circle cx="64" cy="56" r="2.4" fill="#8a0910" opacity="0.8" />
        <circle cx="214" cy="200" r="1.9" fill="#6a0509" opacity="0.72" />
      </g>
    </svg>
  )
}

/**
 * Анимация повержения босса:
 * 1. Моделька босса в цвете → 2. 3D-меч прорубает по диагонали сверху-справа вниз-влево →
 * 3. Росчерк разреза + рассечение фигуры на две половинки вдоль диагонали →
 * 4. Босс становится серым, но золотая обводка контура и красная аура остаются →
 * 5. Два резких кровавых мазка-креста поверх.
 */
export function BossDefeatAnim({ bossId, title }: { bossId: string; title: string }) {
  const [playKey, setPlayKey] = useState(0)
  const [slashed, setSlashed] = useState(() => prefersReducedMotion())
  const src = `${BASE}art/bosses/${bossId}.webp`

  const replay = () => {
    setSlashed(prefersReducedMotion())
    setPlayKey((k) => k + 1)
  }

  return (
    <div className="flex w-full flex-col items-center overflow-x-clip py-1">
      <button
        type="button"
        onClick={replay}
        title="Нажми, чтобы пересмотреть разрез"
        aria-label={`Босс «${title}» повержен. Нажмите, чтобы повторить анимацию`}
        className="bd-stage relative mx-auto flex h-56 w-52 cursor-pointer items-center justify-center overflow-visible select-none focus-visible:outline-2 focus-visible:outline-gold sm:h-68 sm:w-60"
      >
        {/* Красная аура позади босса — остаётся гореть после разреза */}
        <span className={`bd-aura pointer-events-none absolute -inset-3 rounded-full${slashed ? ' hit' : ''}`} aria-hidden="true" />

        {/* Моделька босса: две половинки, которые разъезжаются по линии разреза */}
        <div key={`boss-${playKey}`} className={`bd-boss relative z-10 h-full w-full${slashed ? ' hit' : ''}`}>
          <div className={`bd-half bd-half-top absolute inset-0${slashed ? ' split' : ''}`}>
            <img src={src} alt={title} draggable={false} className={`bd-img h-full w-full object-contain${slashed ? ' hit' : ''}`} />
          </div>
          <div className={`bd-half bd-half-bot absolute inset-0${slashed ? ' split' : ''}`} aria-hidden="true">
            <img src={src} alt="" draggable={false} className={`bd-img h-full w-full object-contain${slashed ? ' hit' : ''}`} />
          </div>
          {slashed && <div className="bd-hit-flash pointer-events-none absolute inset-0 rounded-full" aria-hidden="true" />}
        </div>

        {/* 3D-меч (public/models/sword.glb) */}
        <SwordSlash3D playKey={playKey} onSlash={() => setSlashed(true)} />

        {/* Суровый кроваво-золотой росчерк разреза */}
        <SlashCutVFX key={`cut-${playKey}`} active={slashed} />

        {/* Кровавый крест сухими мазками */}
        <BloodCross key={`cross-${playKey}`} active={slashed} />
      </button>
      <span className="mt-1 text-[11px] text-muted/70">Нажми на босса, чтобы повторить разрез</span>
    </div>
  )
}
