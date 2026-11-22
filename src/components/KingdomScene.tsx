import { useEffect, useRef, useState } from 'react'
import type * as T from 'three'
import { loadModel, loadThree } from '../lib/three-loader'

export type SlotState = 'owned' | 'ready' | 'capital' | 'rank'
export type SceneSlot = {
  id: string
  model: string
  x: number
  z: number
  /** ширина постройки в мире (самая длинная сторона основания) */
  size: number
  state: SlotState
  label: string
}

type Api = { setSlots: (slots: SceneSlot[]) => void }

const R = 11 // радиус острова
const smooth = (a: number, b: number, x: number) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t) }
const easeOutElastic = (x: number) => (x === 0 ? 0 : x === 1 ? 1 : Math.pow(2, -9 * x) * Math.sin((x * 10 - 0.75) * ((2 * Math.PI) / 3)) + 1)
function mulberry32(a: number) { return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296 } }

/** Диорама королевства: остров, дорога, деревья и модели построек. Купленные стоят цветными, остальные — прозрачными «призраками».
 *  Тап по постройке вызывает onSelect(id). Сцена грузится лениво; при отсутствии WebGL вызывается onFail. */
export default function KingdomScene({ slots, stage, onSelect, onFail, className = '' }: { slots: SceneSlot[]; stage: number; onSelect: (id: string) => void; onFail?: () => void; className?: string }) {
  const host = useRef<HTMLDivElement>(null)
  const api = useRef<Api | null>(null)
  const latest = useRef({ slots, onSelect, onFail })
  latest.current = { slots, onSelect, onFail }
  const [ready, setReady] = useState(false)
  const [imgOk, setImgOk] = useState(true)

  // состояния построек меняются (куплена, хватает денег) — сцена обновляется без пересоздания
  useEffect(() => { api.current?.setSlots(slots) }, [slots])

  useEffect(() => {
    let disposed = false
    let cleanup = () => {}
    ;(async () => {
      try {
        const t = await loadThree()
        const { THREE, OrbitControls } = t
        const el = host.current
        if (!el || disposed) return

        const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' })
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
        renderer.outputColorSpace = THREE.SRGBColorSpace
        renderer.toneMapping = THREE.ACESFilmicToneMapping
        renderer.toneMappingExposure = 1.05
        renderer.shadowMap.enabled = true
        renderer.shadowMap.type = THREE.PCFSoftShadowMap
        el.appendChild(renderer.domElement)
        renderer.domElement.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block;touch-action:pan-y'

        const scene = new THREE.Scene()
        scene.add(new THREE.HemisphereLight(0xfff0d0, 0x2a2430, 1.1))
        const sun = new THREE.DirectionalLight(0xffd9a0, 2.6)
        sun.position.set(6, 11, 8)
        sun.castShadow = true
        sun.shadow.mapSize.set(1024, 1024)
        Object.assign(sun.shadow.camera, { left: -13, right: 13, top: 13, bottom: -13, near: 1, far: 40 })
        sun.shadow.bias = -0.0005
        scene.add(sun)
        const fill = new THREE.DirectionalLight(0x8fa8ff, 0.5)
        fill.position.set(-6, 3, -4)
        scene.add(fill)

        const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 100)
        const controls = new OrbitControls(camera, renderer.domElement)
        controls.enablePan = false
        controls.enableZoom = false
        controls.enableDamping = true
        controls.minAzimuthAngle = -0.7
        controls.maxAzimuthAngle = 0.7
        controls.minPolarAngle = 0.85
        controls.maxPolarAngle = 1.3
        controls.target.set(0, 1.0, -3)
        renderer.domElement.style.touchAction = 'pan-y'

        const world = new THREE.Group()
        scene.add(world)

        // ---------- рельеф ----------
        const anchors = latest.current.slots.map((s) => ({ x: s.x, z: s.z }))
        const castle = latest.current.slots.find((s) => s.id === 'castle')
        const hill = (x: number, z: number) => (castle ? 2.7 * Math.exp(-((x - castle.x) ** 2 + (z - castle.z) ** 2) / 20) : 0) + 0.45 * Math.exp(-((x - 5.5) ** 2 + (z + 2.5) ** 2) / 26)
        const noise = (x: number, z: number) => 0.16 * Math.sin(x * 0.9 + 1.3) * Math.cos(z * 0.8) + 0.09 * Math.sin(x * 2.1 + z * 1.7)
        const height = (x: number, z: number) => {
          let dmin = Infinity
          let near = anchors[0]
          for (const a of anchors) { const d = Math.hypot(x - a.x, z - a.z); if (d < dmin) { dmin = d; near = a } }
          let h = hill(x, z) + noise(x, z) * smooth(1.3, 2.8, dmin)
          if (near) h = h + (hill(near.x, near.z) - h) * (1 - smooth(1.1, 2.4, dmin)) // площадка под постройкой ровная
          const d = Math.hypot(x, z) / R
          if (d > 0.84) h -= (d - 0.84) * 24 // обрыв по краю острова
          return h
        }

        const seg = 72
        const geo = new THREE.PlaneGeometry(R * 2 + 1, R * 2 + 1, seg, seg)
        geo.rotateX(-Math.PI / 2)
        const pos = geo.attributes.position as T.BufferAttribute
        const col = new Float32Array(pos.count * 3)
        const rnd = mulberry32(7)
        for (let i = 0; i < pos.count; i++) {
          let x = pos.getX(i)
          let z = pos.getZ(i)
          const d = Math.hypot(x, z)
          let y: number
          if (d > R) { x = (x / d) * R; z = (z / d) * R; y = -2.6 } else y = height(x, z)
          pos.setXYZ(i, x, y, z)
          const rock = y < -0.4 || d > R * 0.93
          const k = 0.9 + rnd() * 0.2
          const hi = smooth(0.8, 2.6, y)
          const c = rock ? [0.2, 0.17, 0.16] : [0.1 + hi * 0.08, 0.2 - hi * 0.05, 0.07 + hi * 0.03]
          col.set([c[0] * k, c[1] * k, c[2] * k], i * 3)
        }
        geo.setAttribute('color', new THREE.BufferAttribute(col, 3))
        geo.computeVertexNormals()
        const terrain = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 1, color: 0x9a9a9a }))
        terrain.receiveShadow = true
        world.add(terrain)

        // ---------- дорога ----------
        const pts = [...anchors].sort((a, b) => b.z - a.z).map((a) => new THREE.Vector3(a.x, 0, a.z + 1.6))
        if (pts.length > 1) {
          const curve = new THREE.CatmullRomCurve3(pts, false, 'catmullrom', 0.5)
          const N = 120
          const verts: number[] = []
          const idx: number[] = []
          for (let i = 0; i <= N; i++) {
            const p = curve.getPoint(i / N)
            const tg = curve.getTangent(i / N)
            const nx = -tg.z
            const nz = tg.x
            const len = Math.hypot(nx, nz) || 1
            for (const s of [-0.3, 0.3]) {
              const x = p.x + (nx / len) * s
              const z = p.z + (nz / len) * s
              verts.push(x, height(x, z) + 0.05, z)
            }
            if (i < N) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2) }
          }
          const rg = new THREE.BufferGeometry()
          rg.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3))
          rg.setIndex(idx)
          rg.computeVertexNormals()
          const road = new THREE.Mesh(rg, new THREE.MeshStandardMaterial({ color: 0x6f5d42, roughness: 1, side: THREE.DoubleSide }))
          road.receiveShadow = true
          world.add(road)
        }

        // ---------- деревья и камни ----------
        const tr = mulberry32(42)
        const treePos: [number, number][] = []
        for (let tries = 0; tries < 500 && treePos.length < 42; tries++) {
          const a = tr() * Math.PI * 2
          const r = Math.sqrt(tr()) * (R - 1)
          const x = Math.cos(a) * r
          const z = Math.sin(a) * r
          if (anchors.some((p) => Math.hypot(x - p.x, z - p.z) < 3)) continue
          if (z > 0.8 && Math.abs(x) < 5.2) continue // перед постройками чисто, обзор не закрываем
          if (Math.hypot(x - 0, z + 7.8) < 4) continue // место под замок
          treePos.push([x, z])
        }
        const cone = new THREE.InstancedMesh(new THREE.ConeGeometry(0.55, 1.5, 6), new THREE.MeshStandardMaterial({ color: 0x2f5a2a, flatShading: true, roughness: 1 }), treePos.length)
        const trunk = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.08, 0.1, 0.5, 5), new THREE.MeshStandardMaterial({ color: 0x4b3624, roughness: 1 }), treePos.length)
        const m4 = new THREE.Matrix4()
        treePos.forEach(([x, z], i) => {
          const s = 0.55 + tr() * 0.5
          const y = height(x, z)
          m4.compose(new THREE.Vector3(x, y + 0.5 * s + 0.75 * s, z), new THREE.Quaternion(), new THREE.Vector3(s, s, s))
          cone.setMatrixAt(i, m4)
          m4.compose(new THREE.Vector3(x, y + 0.25 * s, z), new THREE.Quaternion(), new THREE.Vector3(s, s, s))
          trunk.setMatrixAt(i, m4)
        })
        cone.castShadow = true
        world.add(cone, trunk)

        // ---------- постройки ----------
        type Slot = {
          def: SceneSlot
          root: T.Group
          body?: T.Group
          solid?: T.Group
          ghost?: T.Group
          ghostMats: T.MeshStandardMaterial[]
          loaded: boolean
          shown: SlotState
          baseScale: number
          label: HTMLDivElement
        }
        const slotMap = new Map<string, Slot>()
        const labelLayer = document.createElement('div')
        labelLayer.style.cssText = 'position:absolute;inset:0;pointer-events:none;overflow:hidden'
        el.appendChild(labelLayer)

        const fx: ((now: number) => boolean)[] = []
        let shakeUntil = 0

        const styleLabel = (s: Slot) => {
          const st = s.def.state
          s.label.textContent = s.def.label
          s.label.style.cssText = `position:absolute;left:0;top:0;white-space:nowrap;transform:translate(-9999px,-9999px);padding:2px 9px;border-radius:9999px;font:600 11px/1.5 Inter Variable,system-ui,sans-serif;` +
            (st === 'owned' ? 'background:rgba(17,17,20,.7);color:#f1ebdd;border:1px solid rgba(255,255,255,.18);'
              : st === 'ready' ? 'background:rgba(216,170,66,.92);color:#111114;border:1px solid #fff1b0;box-shadow:0 0 14px rgba(232,205,114,.8);'
                : 'background:rgba(17,17,20,.6);color:#b3ad9e;border:1px solid rgba(255,255,255,.1);')
        }

        const applyState = (s: Slot, animate: boolean) => {
          const next = s.def.state
          styleLabel(s)
          if (!s.loaded || !s.solid || !s.ghost || !s.body) { s.shown = next; return }
          const wasOwned = s.shown === 'owned'
          s.shown = next
          s.solid.visible = next === 'owned'
          s.ghost.visible = next !== 'owned'
          for (const m of s.ghostMats) {
            m.opacity = next === 'ready' ? 0.5 : next === 'capital' ? 0.32 : 0.2
            m.emissive.setHex(next === 'ready' ? 0xd8aa42 : 0x000000)
            m.emissiveIntensity = next === 'ready' ? 0.18 : 0
          }
          if (animate && next === 'owned' && !wasOwned) playBuild(s)
        }

        const playBuild = (s: Slot) => {
          if (!s.body) return
          const t0 = performance.now()
          const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
          const dur = reduce ? 1 : 1300
          const body = s.body
          const base = s.baseScale
          shakeUntil = t0 + (reduce ? 0 : 450)
          // пыль
          const n = 42
          const dust = new THREE.BufferGeometry()
          const dpos = new Float32Array(n * 3)
          const dir = Array.from({ length: n }, () => { const a = Math.random() * Math.PI * 2; const sp = 0.8 + Math.random() * 1.6; return [Math.cos(a) * sp, 0.5 + Math.random() * 1.4, Math.sin(a) * sp] })
          dust.setAttribute('position', new THREE.BufferAttribute(dpos, 3))
          const dm = new THREE.PointsMaterial({ color: 0xe0d2b0, size: 0.4, transparent: true, opacity: 0.85, depthWrite: false })
          const points = new THREE.Points(dust, dm)
          points.position.copy(s.root.position)
          // волна
          const ring = new THREE.Mesh(new THREE.RingGeometry(0.5, 0.65, 48), new THREE.MeshBasicMaterial({ color: 0xffe28c, transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthWrite: false }))
          ring.rotation.x = -Math.PI / 2
          ring.position.copy(s.root.position).setY(s.root.position.y + 0.08)
          if (!reduce) world.add(points, ring)
          fx.push((now) => {
            const k = Math.min(1, (now - t0) / dur)
            const sc = base * easeOutElastic(k)
            body.scale.setScalar(Math.max(0.001, sc))
            body.position.y = (1 - k) * 0.6
            const e = Math.min(1, (now - t0) / 1100)
            for (let i = 0; i < n; i++) { dpos[i * 3] = dir[i][0] * e; dpos[i * 3 + 1] = dir[i][1] * e - e * e * 0.6; dpos[i * 3 + 2] = dir[i][2] * e }
            dust.attributes.position.needsUpdate = true
            dm.opacity = 0.85 * (1 - e)
            ring.scale.setScalar(1 + e * 9)
            ;(ring.material as T.MeshBasicMaterial).opacity = 0.9 * (1 - e)
            if (k >= 1 && e >= 1) {
              body.scale.setScalar(base)
              body.position.y = 0
              world.remove(points, ring)
              dust.dispose(); dm.dispose(); ring.geometry.dispose(); (ring.material as T.Material).dispose()
              return true
            }
            return false
          })
        }

        const makeVisual = (model: T.Group, size: number, ghost: boolean, mats: T.MeshStandardMaterial[]) => {
          const g = model.clone(true)
          g.traverse((o) => {
            const m = o as T.Mesh
            if (!m.isMesh) return
            m.castShadow = !ghost
            m.receiveShadow = !ghost
            if (ghost) {
              const src = (Array.isArray(m.material) ? m.material[0] : m.material) as T.MeshStandardMaterial
              const gm = src.clone()
              gm.transparent = true
              gm.depthWrite = false
              gm.opacity = 0.3
              gm.color.multiplyScalar(0.7)
              m.material = gm
              mats.push(gm)
            }
          })
          const box = new THREE.Box3().setFromObject(g)
          const bs = box.getSize(new THREE.Vector3())
          const ctr = box.getCenter(new THREE.Vector3())
          g.position.set(-ctr.x, -box.min.y, -ctr.z)
          const wrapper = new THREE.Group()
          wrapper.add(g)
          return { wrapper, scale: size / Math.max(bs.x, bs.z) }
        }

        const setup = (def: SceneSlot) => {
          const root = new THREE.Group()
          root.position.set(def.x, height(def.x, def.z) - 0.02, def.z)
          world.add(root)
          const label = document.createElement('div')
          labelLayer.appendChild(label)
          const s: Slot = { def, root, ghostMats: [], loaded: false, shown: def.state, baseScale: 1, label }
          slotMap.set(def.id, s)
          styleLabel(s)
        }
        latest.current.slots.forEach(setup)

        const loadSlot = async (s: Slot) => {
          try {
            const model = await loadModel(t, s.def.model)
            if (disposed) return
            const solid = makeVisual(model, s.def.size, false, [])
            const ghost = makeVisual(model, s.def.size, true, s.ghostMats)
            const body = new THREE.Group()
            body.add(solid.wrapper, ghost.wrapper)
            body.scale.setScalar(solid.scale)
            s.baseScale = solid.scale
            s.body = body
            s.solid = solid.wrapper
            s.ghost = ghost.wrapper
            s.root.add(body)
            s.loaded = true
            applyState(s, false)
            setReady(true)
          } catch { /* одна модель не загрузилась — остальные работают */ }
        }
        // сначала купленные, потом остальные
        const order = [...slotMap.values()].sort((a, b) => Number(b.def.state === 'owned') - Number(a.def.state === 'owned'))
        void (async () => { for (const s of order) await loadSlot(s) })()

        api.current = {
          setSlots: (defs) => {
            for (const d of defs) {
              const s = slotMap.get(d.id)
              if (!s) continue
              const changed = s.def.state !== d.state || s.def.label !== d.label
              s.def = d
              if (changed) applyState(s, true)
            }
          },
        }

        // ---------- ввод: тап по зданию ----------
        const ray = new THREE.Raycaster()
        const ndc = new THREE.Vector2()
        let down: { x: number; y: number; t: number } | null = null
        const onDown = (e: PointerEvent) => { down = { x: e.clientX, y: e.clientY, t: performance.now() } }
        const onUp = (e: PointerEvent) => {
          if (!down) return
          const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y)
          const quick = performance.now() - down.t < 450
          down = null
          if (moved > 8 || !quick) return
          const rect = renderer.domElement.getBoundingClientRect()
          ndc.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1)
          ray.setFromCamera(ndc, camera)
          let best: { id: string; d: number } | null = null
          for (const s of slotMap.values()) {
            if (!s.body) continue
            const hit = ray.intersectObject(s.body, true).find((h) => (h.object as T.Mesh).visible !== false && (s.shown === 'owned' ? s.solid : s.ghost)?.visible)
            if (hit && (!best || hit.distance < best.d)) best = { id: s.def.id, d: hit.distance }
          }
          // тап рядом с подписью тоже считается
          if (!best) {
            const v = new THREE.Vector3()
            let bd = 40
            for (const s of slotMap.values()) {
              v.copy(s.root.position).project(camera)
              const sx = (v.x * 0.5 + 0.5) * rect.width + rect.left
              const sy = (-v.y * 0.5 + 0.5) * rect.height + rect.top
              const d = Math.hypot(sx - e.clientX, sy - (e.clientY + 30))
              if (d < bd) { bd = d; best = { id: s.def.id, d } }
            }
          }
          if (best) latest.current.onSelect(best.id)
        }
        renderer.domElement.addEventListener('pointerdown', onDown)
        renderer.domElement.addEventListener('pointerup', onUp)

        // ---------- размер и цикл ----------
        let lastAspect = 0
        const resize = () => {
          const w = el.clientWidth
          const h = el.clientHeight
          if (!w || !h) return
          renderer.setSize(w, h, false)
          camera.aspect = w / h
          camera.updateProjectionMatrix()
          const a = w / h
          if (Math.abs(a - lastAspect) > 0.05) {
            lastAspect = a
            const dist = 21.5 * Math.pow(Math.max(1, 1.35 / a), 0.55)
            camera.position.set(0, dist * 0.7, dist * 0.72)
            controls.update()
          }
        }
        const ro = new ResizeObserver(resize)
        ro.observe(el)
        resize()

        const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
        let visible = true
        const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting }, { threshold: 0.01 })
        io.observe(el)
        const camBase = camera.position.clone()
        const tmp = new THREE.Vector3()
        let raf = 0
        let dragging = false
        const pd = () => { dragging = true }
        const pu = () => { dragging = false }
        renderer.domElement.addEventListener('pointerdown', pd)
        window.addEventListener('pointerup', pu)

        const tick = () => {
          raf = requestAnimationFrame(tick)
          if (document.hidden || !visible) return
          const now = performance.now()
          if (!reduce && !dragging) {
            world.rotation.y = Math.sin(now * 0.00018) * 0.08
            world.position.y = Math.sin(now * 0.0009) * 0.05
          }
          for (let i = fx.length - 1; i >= 0; i--) if (fx[i](now)) fx.splice(i, 1)
          for (const s of slotMap.values()) {
            if (s.shown === 'ready' && s.ghostMats.length) { const p = 0.16 + 0.16 * Math.sin(now * 0.004); for (const m of s.ghostMats) m.emissiveIntensity = p }
          }
          if (now < shakeUntil) { const k = (shakeUntil - now) / 450; camera.position.x += (Math.random() - 0.5) * 0.12 * k; camera.position.y += (Math.random() - 0.5) * 0.08 * k } else camBase.copy(camera.position)
          controls.update()
          renderer.render(scene, camera)
          // подписи над постройками
          const w = el.clientWidth
          const h = el.clientHeight
          for (const s of slotMap.values()) {
            const top = (s.body ? s.def.size * 0.55 : 1) + 0.3
            tmp.copy(s.root.position).applyMatrix4(world.matrixWorld).setY(s.root.position.y + world.position.y + top).project(camera)
            const lx = (tmp.x * 0.5 + 0.5) * w
            const ly = (-tmp.y * 0.5 + 0.5) * h
            s.label.style.transform = tmp.z > 1 ? 'translate(-9999px,-9999px)' : `translate(${lx}px,${ly}px) translate(-50%,-100%)`
          }
        }
        tick()

        cleanup = () => {
          cancelAnimationFrame(raf)
          api.current = null
          ro.disconnect(); io.disconnect()
          renderer.domElement.removeEventListener('pointerdown', onDown)
          renderer.domElement.removeEventListener('pointerup', onUp)
          renderer.domElement.removeEventListener('pointerdown', pd)
          window.removeEventListener('pointerup', pu)
          controls.dispose()
          scene.traverse((o) => {
            const m = o as T.Mesh
            if (m.isMesh || (o as T.InstancedMesh).isInstancedMesh) {
              m.geometry?.dispose()
              const mats = Array.isArray(m.material) ? m.material : [m.material]
              mats.forEach((mt) => mt && mt.dispose())
            }
          })
          renderer.dispose()
          renderer.domElement.remove()
          labelLayer.remove()
        }
      } catch {
        if (!disposed) latest.current.onFail?.()
      }
    })()
    return () => { disposed = true; cleanup() }
  }, [])

  return (
    <div className={`relative overflow-hidden ${className}`}>
      {imgOk && (
        <img src={`${import.meta.env.BASE_URL}art/stage-${Math.max(1, Math.min(7, stage))}-p.webp`} alt="" onError={() => setImgOk(false)} className="absolute inset-0 h-full w-full object-cover" style={{ objectPosition: '50% 30%', filter: 'brightness(0.85) saturate(1.1)' }} />
      )}
      <div className="absolute inset-0" style={{ background: 'radial-gradient(80% 60% at 50% 55%, transparent 0%, rgba(17,17,20,0.55) 100%)' }} />
      <div ref={host} className="absolute inset-0" />
      {!ready && <div className="absolute inset-0 grid place-items-center text-[13px] text-parch/80">Строим королевство…</div>}
    </div>
  )
}
