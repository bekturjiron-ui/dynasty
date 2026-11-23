import { useEffect, useRef } from 'react'
import { loadThree } from '../lib/three-loader'

/**
 * Золотые искры за картой плана. Приём из примера threejs.org webgl_points_sprites:
 * THREE.Points + AdditiveBlending, несколько слоёв точек разной глубины.
 * Вокруг доступных боссов (data-pm-ready) искры кружат гуще. Скорость прокрутки ускоряет дрейф.
 * Без движения при prefers-reduced-motion, без WebGL просто ничего не рисуется.
 */
export function PlanEmbers({ paused = false }: { paused?: boolean }) {
  const hostRef = useRef<HTMLDivElement>(null)
  const pausedRef = useRef(paused)
  pausedRef.current = paused

  useEffect(() => {
    const host = hostRef.current
    if (!host || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    let disposed = false
    let cleanup = () => {}

    loadThree().then(({ THREE }) => {
      if (disposed) return
      let renderer: InstanceType<typeof THREE.WebGLRenderer>
      try {
        renderer = new THREE.WebGLRenderer({ alpha: true, antialias: false, powerPreference: 'low-power' })
      } catch { return }
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5)
      renderer.setPixelRatio(dpr)
      renderer.setClearColor(0x000000, 0)
      host.appendChild(renderer.domElement)
      const cv = renderer.domElement
      cv.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block'

      let vw = 1, vh = 1
      const camera = new THREE.OrthographicCamera(0, 1, 1, 0, -1, 1)
      const scene = new THREE.Scene()

      // мягкая искра: радиальный градиент, внешних файлов не нужно
      const tex = (() => {
        const c = document.createElement('canvas'); c.width = c.height = 64
        const g = c.getContext('2d')!
        const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32)
        gr.addColorStop(0, 'rgba(255,244,200,1)'); gr.addColorStop(0.25, 'rgba(255,214,120,0.7)'); gr.addColorStop(1, 'rgba(255,190,80,0)')
        g.fillStyle = gr; g.fillRect(0, 0, 64, 64)
        const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t
      })()

      // три слоя глубины: дальние мельче и медленнее
      const layers = [
        { n: 70, size: 5, speed: 9, par: 0.35, op: 0.45 },
        { n: 55, size: 8, speed: 16, par: 0.7, op: 0.6 },
        { n: 35, size: 12, speed: 26, par: 1.15, op: 0.75 },
      ].map((L) => {
        const geo = new THREE.BufferGeometry()
        const pos = new Float32Array(L.n * 3)
        geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
        const mat = new THREE.PointsMaterial({ map: tex, size: L.size * dpr, sizeAttenuation: false, transparent: true, opacity: L.op, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending, color: 0xffd98a })
        const pts = new THREE.Points(geo, mat)
        pts.frustumCulled = false
        scene.add(pts)
        return { ...L, geo, pos, mat, seed: Array.from({ length: L.n }, () => [Math.random(), Math.random(), Math.random() * 6.28]) }
      })

      const AURA = 3 // не больше трёх доступных боссов одновременно
      const AURA_N = 24
      const auraGeo = new THREE.BufferGeometry()
      const auraPos = new Float32Array(AURA * AURA_N * 3)
      auraGeo.setAttribute('position', new THREE.BufferAttribute(auraPos, 3))
      // яркость каждой искры задаётся цветом вершины: так она плавно гаснет вверху цикла, а не исчезает рывком
      const auraCol = new Float32Array(AURA * AURA_N * 3)
      auraGeo.setAttribute('color', new THREE.BufferAttribute(auraCol, 3))
      const auraMat = new THREE.PointsMaterial({ map: tex, size: 9 * dpr, sizeAttenuation: false, transparent: true, opacity: 0.85, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending, color: 0xffe9a8, vertexColors: true })
      const aura = new THREE.Points(auraGeo, auraMat)
      aura.frustumCulled = false
      scene.add(aura)

      // На iPhone/Android при прокрутке прячется адресная строка и высота окна скачет.
      // Холст держим по большой высоте окна (lvh) и пересоздаём буфер только при реальной смене размера.
      const resize = () => {
        const w = host.clientWidth || window.innerWidth
        const h = host.clientHeight || window.innerHeight
        if (Math.abs(w - vw) < 2 && Math.abs(h - vh) < 2) return
        vw = w; vh = h
        renderer.setSize(vw, vh, false)
        camera.left = 0; camera.right = vw; camera.top = vh; camera.bottom = 0; camera.updateProjectionMatrix()
      }
      resize()
      window.addEventListener('resize', resize)

      let lastY = window.scrollY, ys = lastY, vel = 0, t = 0, last = performance.now(), raf = 0
      let hot: HTMLElement[] = [], hotAt = -1
      const frame = (now: number) => {
        raf = requestAnimationFrame(frame)
        const dt = Math.min(0.05, (now - last) / 1000); last = now
        if (document.hidden || pausedRef.current) { lastY = window.scrollY; ys = lastY; return }
        const scrollY = window.scrollY
        // искры чуть «догоняют» прокрутку: так нет рывков, когда страница едет быстрее кадров
        ys += (scrollY - ys) * 0.3
        const y = ys
        vel += (Math.min(Math.abs(scrollY - lastY), 120) - vel) * 0.1
        lastY = scrollY
        t += dt * (1 + Math.min(vel * 0.06, 3))
        for (const L of layers) {
          for (let i = 0; i < L.n; i++) {
            const s = L.seed[i]
            const x = s[0] * vw + Math.sin(t * 0.6 + s[2]) * 14
            // дрейф вверх + сдвиг от прокрутки: дальние слои отстают
            const raw = s[1] * (vh + 80) - t * L.speed - y * L.par
            const yy = ((raw % (vh + 80)) + (vh + 80)) % (vh + 80) - 40
            L.pos[i * 3] = x; L.pos[i * 3 + 1] = vh - yy; L.pos[i * 3 + 2] = 0
          }
          L.geo.attributes.position.needsUpdate = true
          L.mat.opacity = L.op * (0.8 + 0.2 * Math.sin(t * 1.3 + L.par * 5))
        }
        // искры вокруг доступных боссов
        if (now - hotAt > 500) { hot = [...document.querySelectorAll<HTMLElement>('[data-pm-ready="1"]')].slice(0, AURA); hotAt = now }
        auraGeo.setDrawRange(0, hot.length * AURA_N)
        hot.forEach((el, k) => {
          const r = el.getBoundingClientRect()
          const cx = r.left + r.width / 2, cy = r.top + r.height * 0.45
          for (let i = 0; i < AURA_N; i++) {
            const a = t * (0.5 + (i % 5) * 0.12) + i * 0.9
            const rad = r.width * (0.38 + 0.22 * ((i * 7) % 5) / 4) + Math.sin(t * 2 + i) * 4
            const rise = ((t * 18 + i * 13) % 60)
            const o = (k * AURA_N + i) * 3
            auraPos[o] = cx + Math.cos(a) * rad
            auraPos[o + 1] = vh - (cy + Math.sin(a) * rad * 0.7 - rise)
            auraPos[o + 2] = 0
            const k = Math.sin((rise / 60) * Math.PI) // 0 → 1 → 0 за цикл
            auraCol[o] = auraCol[o + 1] = auraCol[o + 2] = k
          }
        })
        auraGeo.attributes.position.needsUpdate = true
        auraGeo.attributes.color.needsUpdate = true
        renderer.render(scene, camera)
      }
      raf = requestAnimationFrame(frame)

      cleanup = () => {
        cancelAnimationFrame(raf)
        window.removeEventListener('resize', resize)
        layers.forEach((L) => { L.geo.dispose(); L.mat.dispose() })
        auraGeo.dispose(); auraMat.dispose(); tex.dispose()
        renderer.dispose()
        renderer.forceContextLoss()
        cv.remove()
      }
    }).catch(() => { /* без three.js карта работает как обычно */ })

    return () => { disposed = true; cleanup() }
  }, [])

  return <div ref={hostRef} aria-hidden className="pointer-events-none fixed inset-x-0 top-0 z-0 h-dvh" style={{ height: '100lvh' }} />
}
