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

const R = 11 // радиус запасного (программного) острова
const ISLAND_LEN = 24 // длина модели острова по глубине сцены
/** Где стоят постройки на модели острова: доли ширины и длины от центра (купол сзади — замок, средняя терраса, нижняя терраса) */
const LAYOUT: Record<string, [number, number]> = {
  castle: [0, -0.31], bank: [0, -0.12], birzha: [-0.21, -0.03], 'torgovy-dom': [0.21, -0.03], kontora: [0.25, 0.2], sklad: [0, 0.23], lavka: [-0.25, 0.2],
}
const smooth = (a: number, b: number, x: number) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t) }
const easeOutElastic = (x: number) => (x === 0 ? 0 : x === 1 ? 1 : Math.pow(2, -9 * x) * Math.sin((x * 10 - 0.75) * ((2 * Math.PI) / 3)) + 1)
function mulberry32(a: number) { return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296 } }

/** Диорама королевства: остров, дорога, деревья и модели построек. Купленные стоят цветными, остальные — прозрачными «призраками».
 *  Тап по постройке вызывает onSelect(id). Сцена грузится лениво; при отсутствии WebGL вызывается onFail. */
export default function KingdomScene({ slots, stage, onSelect, onFail, className = '' }: { slots: SceneSlot[]; stage: number; onSelect: (id: string) => void; onFail?: () => void; className?: string }) {
  const host = useRef<HTMLDivElement>(null)
  const tintRef = useRef<HTMLDivElement>(null)
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
        const hemi = new THREE.HemisphereLight(0xfff0d0, 0x2a2430, 1.1)
        scene.add(hemi)
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
        controls.target.set(0, -0.4, 0.2)
        renderer.domElement.style.touchAction = 'pan-y'

        const world = new THREE.Group()
        scene.add(world)
        const timeU = { value: 0 } // общее время для шейдеров (секунды)

        // ---------- остров: модель из Meshy, иначе программный рельеф ----------
        let height: (x: number, z: number) => number = () => 0
        const islandMeshes: T.Mesh[] = []
        let islandSize: { w: number; l: number } | null = null
        const placed = new Map<string, { x: number; z: number }>()
        const ray0 = new THREE.Raycaster()
        const DOWN = new THREE.Vector3(0, -1, 0)
        try {
          const model = await loadModel(t, 'island')
          if (disposed) return
          const isl = model.clone(true)
          const box = new THREE.Box3().setFromObject(isl)
          const size = box.getSize(new THREE.Vector3())
          const ctr = box.getCenter(new THREE.Vector3())
          isl.position.set(-ctr.x, -ctr.y, -ctr.z)
          const holder = new THREE.Group()
          holder.add(isl)
          const sc = ISLAND_LEN / size.z
          holder.scale.setScalar(sc)
          holder.position.y = -1
          holder.traverse((o) => { const m = o as T.Mesh; if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; islandMeshes.push(m) } })
          world.add(holder)
          world.updateMatrixWorld(true)
          islandSize = { w: size.x * sc, l: ISLAND_LEN }
          height = (x, z) => { ray0.set(new THREE.Vector3(x, 60, z), DOWN); const h = ray0.intersectObjects(islandMeshes, false)[0]; return h ? h.point.y : -3 }
          for (const d of latest.current.slots) { const f = LAYOUT[d.id]; if (f) placed.set(d.id, { x: f[0] * islandSize.w, z: f[1] * islandSize.l }) }
        } catch { /* острова нет — рисуем программный */ }
        const at = (d: SceneSlot) => placed.get(d.id) ?? { x: d.x, z: d.z }
        const anchors = latest.current.slots.map((s) => at(s))
        if (!islandSize) {
        const castle = latest.current.slots.find((s) => s.id === 'castle')
        const hill = (x: number, z: number) => (castle ? 2.7 * Math.exp(-((x - castle.x) ** 2 + (z - castle.z) ** 2) / 20) : 0) + 0.45 * Math.exp(-((x - 5.5) ** 2 + (z + 2.5) ** 2) / 26)
        const noise = (x: number, z: number) => 0.16 * Math.sin(x * 0.9 + 1.3) * Math.cos(z * 0.8) + 0.09 * Math.sin(x * 2.1 + z * 1.7)
        height = (x: number, z: number) => {
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
        }

        // ---------- деревья из моделей Meshy (tree1, tree2) ----------
        if (islandSize) {
          const isz = islandSize
          const addTrees = async (name: string, count: number, seed: number, targetH: number) => {
            try {
              const tm = await loadModel(t, name)
              if (disposed) return
              const g = tm.clone(true)
              g.updateMatrixWorld(true)
              const meshes: T.Mesh[] = []
              g.traverse((o) => { if ((o as T.Mesh).isMesh) meshes.push(o as T.Mesh) })
              if (!meshes.length) return
              const box = new THREE.Box3().setFromObject(g)
              const sz = box.getSize(new THREE.Vector3())
              const c = box.getCenter(new THREE.Vector3())
              const k = targetH / sz.y
              const base = new THREE.Matrix4().makeScale(k, k, k).multiply(new THREE.Matrix4().makeTranslation(-c.x, -box.min.y, -c.z)).multiply(meshes[0].matrixWorld)
              const rnd2 = mulberry32(seed)
              const mats: T.Matrix4[] = []
              for (let tries = 0; tries < 600 && mats.length < count; tries++) {
                const x = (rnd2() - 0.5) * isz.w
                const z = (rnd2() - 0.5) * isz.l
                if (z > isz.l * 0.36) continue // песчаный берег впереди
                if (anchors.some((p) => Math.hypot(x - p.x, z - p.z) < 3.4)) continue
                ray0.set(new THREE.Vector3(x, 60, z), DOWN)
                const hit = ray0.intersectObjects(islandMeshes, false)[0]
                if (!hit || hit.point.y < -0.3) continue
                const n = hit.face ? hit.face.normal.clone().transformDirection(hit.object.matrixWorld) : DOWN
                if (n.y < 0.6) continue
                const sc2 = 0.8 + rnd2() * 0.5
                const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), rnd2() * Math.PI * 2)
                mats.push(new THREE.Matrix4().compose(hit.point, q, new THREE.Vector3(sc2, sc2, sc2)).multiply(base))
              }
              const geoT = meshes[0].geometry
              geoT.computeBoundingBox()
              const bb = geoT.boundingBox!
              const swayMat = (Array.isArray(meshes[0].material) ? meshes[0].material[0] : meshes[0].material).clone() as T.MeshStandardMaterial
              swayMat.onBeforeCompile = (sh) => {
                sh.uniforms.uTime = timeU
                sh.uniforms.uMin = { value: bb.min.y }
                sh.uniforms.uMax = { value: bb.max.y }
                sh.uniforms.uAmp = { value: (bb.max.y - bb.min.y) * 0.035 }
                sh.vertexShader = 'uniform float uTime; uniform float uMin; uniform float uMax; uniform float uAmp;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n float sh_h = clamp((position.y - uMin) / (uMax - uMin), 0.0, 1.0); sh_h = sh_h * sh_h; transformed.x += sin(uTime * 1.6 + instanceMatrix[3].x * 0.9 + instanceMatrix[3].z * 0.6) * uAmp * sh_h; transformed.z += cos(uTime * 1.3 + instanceMatrix[3].z * 0.8) * uAmp * 0.6 * sh_h;')
              }
              const inst = new THREE.InstancedMesh(geoT, swayMat, mats.length)
              mats.forEach((m, i) => inst.setMatrixAt(i, m))
              inst.castShadow = true
              inst.receiveShadow = true
              world.add(inst)
            } catch { /* дерево не загрузилось — сцена работает без него */ }
          }
          void addTrees('tree1', 16, 11, 2.6)
          void addTrees('tree2', 14, 29, 2.4)
        }

        // ---------- эффекты: море, облака, светлячки, птицы ----------
        const WATER_Y = -2.2
        const glowTex = (() => {
          const c = document.createElement('canvas'); c.width = c.height = 64
          const g = c.getContext('2d')!; const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32)
          gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.35, 'rgba(255,255,255,0.45)'); gr.addColorStop(1, 'rgba(255,255,255,0)')
          g.fillStyle = gr; g.fillRect(0, 0, 64, 64)
          return new THREE.CanvasTexture(c)
        })()
        const cloudTex = (() => {
          const c = document.createElement('canvas'); c.width = 256; c.height = 128
          const g = c.getContext('2d')!
          const r = mulberry32(5)
          for (let i = 0; i < 16; i++) {
            const x = 40 + r() * 176, y = 50 + (r() - 0.5) * 30, rad = 22 + r() * 30
            const gr = g.createRadialGradient(x, y, 0, x, y, rad)
            gr.addColorStop(0, 'rgba(255,255,255,0.55)'); gr.addColorStop(1, 'rgba(255,255,255,0)')
            g.fillStyle = gr; g.beginPath(); g.arc(x, y, rad, 0, Math.PI * 2); g.fill()
          }
          return new THREE.CanvasTexture(c)
        })()

        // море: волны из синусов, блик солнца, отражение неба по Френелю, пена вдоль берега (по карте расстояния до суши)
        const isz = islandSize ?? { w: R * 2, l: R * 2 }
        const waterU = {
          uTime: timeU,
          uSun: { value: new THREE.Vector3(6, 11, 8).normalize() },
          uDeep: { value: new THREE.Color(0x1b6f86) },
          uShallow: { value: new THREE.Color(0x56c2bd) },
          uSky: { value: new THREE.Color(0xf3b57a) },
          uNight: { value: 0 },
          uShore: { value: null as T.Texture | null },
          uOrigin: { value: new THREE.Vector2(0, 0) },
          uSize: { value: new THREE.Vector2(1, 1) },
        }
        {
          const N = 64, pad = 9
          const x0 = -(isz.w / 2 + pad), z0 = -(isz.l / 2 + pad), sx = isz.w + pad * 2, sz = isz.l + pad * 2
          const mask = new Uint8Array(N * N)
          const v = new THREE.Vector3()
          for (const m of islandMeshes) {
            m.updateWorldMatrix(true, false)
            const pos = m.geometry.attributes.position
            for (let i = 0; i < pos.count; i++) {
              v.fromBufferAttribute(pos, i).applyMatrix4(m.matrixWorld)
              if (v.y < WATER_Y - 0.2) continue
              const ix = Math.floor(((v.x - x0) / sx) * N), iz = Math.floor(((v.z - z0) / sz) * N)
              if (ix >= 0 && ix < N && iz >= 0 && iz < N) mask[iz * N + ix] = 1
            }
          }
          if (!islandMeshes.length) mask.fill(0)
          // закрасить дырки (одна дилатация) и посчитать расстояние до суши в клетках
          const filled = new Uint8Array(mask)
          for (let z = 1; z < N - 1; z++) for (let x = 1; x < N - 1; x++) if (mask[z * N + x + 1] + mask[z * N + x - 1] + mask[(z + 1) * N + x] + mask[(z - 1) * N + x] >= 2) filled[z * N + x] = 1
          const dist = new Float32Array(N * N).fill(99)
          for (let i = 0; i < N * N; i++) if (filled[i]) dist[i] = 0
          for (let z = 0; z < N; z++) for (let x = 0; x < N; x++) { let d = dist[z * N + x]; if (x > 0) d = Math.min(d, dist[z * N + x - 1] + 1); if (z > 0) d = Math.min(d, dist[(z - 1) * N + x] + 1); dist[z * N + x] = d }
          for (let z = N - 1; z >= 0; z--) for (let x = N - 1; x >= 0; x--) { let d = dist[z * N + x]; if (x < N - 1) d = Math.min(d, dist[z * N + x + 1] + 1); if (z < N - 1) d = Math.min(d, dist[(z + 1) * N + x] + 1); dist[z * N + x] = d }
          const data = new Uint8Array(N * N)
          for (let i = 0; i < N * N; i++) data[i] = Math.round(Math.min(1, dist[i] / 12) * 255)
          const tex = new THREE.DataTexture(data, N, N, THREE.RedFormat, THREE.UnsignedByteType)
          tex.magFilter = THREE.LinearFilter; tex.minFilter = THREE.LinearFilter; tex.needsUpdate = true
          waterU.uShore.value = tex
          waterU.uOrigin.value.set(x0, z0); waterU.uSize.value.set(sx, sz)
        }
        const water = new THREE.Mesh(
          new THREE.CircleGeometry(70, 96).rotateX(-Math.PI / 2),
          new THREE.ShaderMaterial({
            transparent: true, depthWrite: false, uniforms: waterU,
            vertexShader: 'varying vec3 vLocal; varying vec3 vWorld; void main(){ vLocal = position; vec4 wp = modelMatrix * vec4(position,1.0); vWorld = wp.xyz; gl_Position = projectionMatrix * viewMatrix * wp; }',
            fragmentShader: `
              uniform float uTime; uniform vec3 uSun; uniform vec3 uDeep; uniform vec3 uShallow; uniform vec3 uSky; uniform float uNight;
              uniform sampler2D uShore; uniform vec2 uOrigin; uniform vec2 uSize;
              varying vec3 vLocal; varying vec3 vWorld;
              void main(){
                vec2 p = vLocal.xz; float t = uTime;
                vec2 n = vec2(cos(p.x*0.9+t*0.9), cos(p.y*0.7+t*0.7))*0.35
                       + vec2(cos((p.x+p.y)*1.7-t*1.3), cos((p.x-p.y)*1.4+t*1.1))*0.18
                       + vec2(cos(p.x*3.3+t*2.0+p.y*1.1), cos(p.y*3.7-t*1.7))*0.08;
                vec3 N = normalize(vec3(-n.x*0.28, 1.0, -n.y*0.28));
                vec3 V = normalize(cameraPosition - vWorld);
                float fres = pow(1.0 - max(dot(N, V), 0.0), 3.0);
                float sd = texture2D(uShore, (p - uOrigin) / uSize).r * 12.0 * (uSize.x / 64.0);
                float shallow = 1.0 - smoothstep(0.0, 3.2, sd);
                vec3 col = mix(uDeep, uShallow, shallow);
                col = mix(col, uSky * (1.0 - uNight * 0.75), fres * 0.6);
                vec3 R = reflect(-normalize(uSun), N);
                float spec = pow(max(dot(R, V), 0.0), 90.0);
                col += vec3(1.0, 0.82, 0.55) * spec * 1.3 * (1.0 - uNight * 0.85);
                float wob = 0.55 + 0.45 * sin(sd * 3.0 - t * 1.6 + p.x * 0.6);
                float foam = (1.0 - smoothstep(0.0, 0.9, abs(sd - (0.5 + 0.35 * sin(t * 1.1 + p.x * 0.5))))) * wob;
                foam *= 0.55 + 0.45 * sin(p.x * 3.1 + t * 1.7) * sin(p.y * 2.7 - t * 1.3);
                col += vec3(0.95, 1.0, 1.0) * foam * 0.55 * (1.0 - uNight * 0.55);
                float fade = 1.0 - smoothstep(9.0, 27.0, length(p * vec2(0.8, 0.62)) * 1.4);
                float alpha = mix(0.78, 0.95, fres) * fade * mix(0.8, 1.0, shallow);
                gl_FragColor = vec4(col, alpha);
              }`,
          }),
        )
        water.position.y = WATER_Y
        water.renderOrder = -1
        world.add(water)

        // облака: плывут мимо, часть позади острова, часть низких впереди
        const clouds: { s: T.Sprite; v: number; o: number }[] = []
        const cr = mulberry32(21)
        for (let i = 0; i < 7; i++) {
          const o = 0.22 + cr() * 0.18
          const mat = new THREE.SpriteMaterial({ map: cloudTex, transparent: true, opacity: o, depthWrite: false, fog: false })
          const s = new THREE.Sprite(mat)
          const w = 16 + cr() * 14
          s.scale.set(w, w * 0.4, 1)
          s.position.set((cr() - 0.5) * 100, 0.5 + cr() * 3, -33 + cr() * 9) // в небе над островом, позади него: плывут по верхней части кадра и не закрывают постройки
          scene.add(s)
          clouds.push({ s, v: 1.6 + cr() * 1.4, o })
        }

        // светлячки: мягкие точки, ночью ярче
        const FIREFLIES = 44
        const ffPos = new Float32Array(FIREFLIES * 3); const ffSeed = new Float32Array(FIREFLIES)
        const fr = mulberry32(77)
        for (let i = 0; i < FIREFLIES; i++) { ffPos.set([(fr() - 0.5) * isz.w * 0.9, -0.5 + fr() * 4.5, (fr() - 0.5) * isz.l * 0.8], i * 3); ffSeed[i] = fr() }
        const ffGeo = new THREE.BufferGeometry()
        ffGeo.setAttribute('position', new THREE.BufferAttribute(ffPos, 3)); ffGeo.setAttribute('aSeed', new THREE.BufferAttribute(ffSeed, 1))
        const ffU = { uTime: timeU, uNight: { value: 0 }, uPx: { value: renderer.getPixelRatio() } }
        const fireflies = new THREE.Points(ffGeo, new THREE.ShaderMaterial({
          transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: ffU,
          vertexShader: 'attribute float aSeed; uniform float uTime; uniform float uPx; varying float vA; void main(){ vec3 p = position + vec3(sin(uTime*0.4+aSeed*6.0), sin(uTime*0.6+aSeed*9.0)*0.5, cos(uTime*0.35+aSeed*5.0)) * 0.8; vec4 mv = modelViewMatrix * vec4(p,1.0); gl_Position = projectionMatrix * mv; gl_PointSize = uPx * 90.0 / -mv.z; vA = 0.55 + 0.45 * sin(uTime*3.0 + aSeed*30.0); }',
          fragmentShader: 'uniform float uNight; varying float vA; void main(){ float d = length(gl_PointCoord - 0.5) * 2.0; float a = 1.0 - smoothstep(0.0, 1.0, d); a *= a; gl_FragColor = vec4(1.0, 0.85, 0.45, a * vA * (0.12 + 0.88 * uNight)); }',
        }))
        fireflies.frustumCulled = false
        world.add(fireflies)

        // птицы: пять тёмных силуэтов кружат вдали днём
        const birds: { g: T.Group; wl: T.Mesh; wr: T.Mesh; r: number; a: number; sp: number; y: number }[] = []
        const birdMat = new THREE.MeshBasicMaterial({ color: 0x2a2230, side: THREE.DoubleSide, transparent: true })
        const wingGeo = new THREE.BufferGeometry()
        wingGeo.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 1.1, 0.05, 0.25, 0.9, 0, -0.2], 3))
        const br = mulberry32(99)
        for (let i = 0; i < 5; i++) {
          const g = new THREE.Group(); const wl = new THREE.Mesh(wingGeo, birdMat); const wr = new THREE.Mesh(wingGeo, birdMat)
          wr.scale.x = -1; g.add(wl, wr); g.scale.setScalar(0.55); scene.add(g)
          birds.push({ g, wl, wr, r: 15 + br() * 9, a: br() * Math.PI * 2, sp: 0.1 + br() * 0.08, y: 8 + br() * 4 })
        }

        // дым из труб и тёплые окна у купленных построек
        const SMOKE = 72
        const smBase = new Float32Array(SMOKE * 3); const smSeed = new Float32Array(SMOKE); const smOn = new Float32Array(SMOKE)
        for (let i = 0; i < SMOKE; i++) smSeed[i] = (i * 0.6180339) % 1
        const smGeo = new THREE.BufferGeometry()
        smGeo.setAttribute('position', new THREE.BufferAttribute(smBase, 3)); smGeo.setAttribute('aSeed', new THREE.BufferAttribute(smSeed, 1)); smGeo.setAttribute('aOn', new THREE.BufferAttribute(smOn, 1))
        const smU = { uTime: timeU, uNight: { value: 0 }, uPx: { value: renderer.getPixelRatio() } }
        const smoke = new THREE.Points(smGeo, new THREE.ShaderMaterial({
          transparent: true, depthWrite: false, uniforms: smU,
          vertexShader: 'attribute float aSeed; attribute float aOn; uniform float uTime; uniform float uPx; varying float vA; void main(){ float up = fract(uTime*0.16 + aSeed); vec3 p = position + vec3(sin(up*5.0+aSeed*6.0)*0.22 + up*0.7, up*2.6, 0.0); vec4 mv = modelViewMatrix * vec4(p,1.0); gl_Position = projectionMatrix * mv; gl_PointSize = uPx * (70.0 + up*170.0) / -mv.z; vA = (1.0-up) * smoothstep(0.0, 0.12, up) * 0.32 * aOn; }',
          fragmentShader: 'uniform float uNight; varying float vA; void main(){ float d = length(gl_PointCoord - 0.5) * 2.0; float a = 1.0 - smoothstep(0.0, 1.0, d); gl_FragColor = vec4(mix(vec3(0.86,0.84,0.8), vec3(0.45,0.48,0.6), uNight), a * vA); }',
        }))
        smoke.frustumCulled = false
        world.add(smoke)
        const glows: T.Sprite[] = []
        let refreshEmitters = () => {}

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
            m.opacity = next === 'ready' ? 0.55 : next === 'capital' ? 0.4 : 0.3
            m.emissive.setHex(next === 'ready' ? 0xd8aa42 : 0x000000)
            m.emissiveIntensity = next === 'ready' ? 0.18 : 0
          }
          if (animate && next === 'owned' && !wasOwned) playBuild(s)
          refreshEmitters()
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
          const pp = at(def)
          root.position.set(pp.x, height(pp.x, pp.z) - 0.02, pp.z)
          world.add(root)
          const label = document.createElement('div')
          labelLayer.appendChild(label)
          const s: Slot = { def, root, ghostMats: [], loaded: false, shown: def.state, baseScale: 1, label }
          slotMap.set(def.id, s)
          styleLabel(s)
        }
        latest.current.slots.forEach(setup)
        refreshEmitters = () => {
          glows.splice(0).forEach((g) => { world.remove(g); (g.material as T.Material).dispose() })
          let k = 0
          for (const s of slotMap.values()) {
            const owned = s.shown === 'owned' && s.loaded
            const n = s.def.id === 'castle' ? 10 : 6
            for (let i = 0; i < n && k < SMOKE; i++, k++) {
              smBase.set([s.root.position.x + s.def.size * 0.18, s.root.position.y + s.def.size * 0.78, s.root.position.z - s.def.size * 0.05], k * 3)
              smOn[k] = owned ? 1 : 0
            }
            if (owned) {
              for (const dx of [-0.28, 0, 0.28]) {
                const g = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0xffc06a, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0 }))
                g.position.set(s.root.position.x + dx * s.def.size, s.root.position.y + s.def.size * 0.28, s.root.position.z + s.def.size * 0.46)
                g.scale.setScalar(s.def.size * 0.34)
                world.add(g)
                glows.push(g)
              }
            }
          }
          for (; k < SMOKE; k++) smOn[k] = 0
          smGeo.attributes.position.needsUpdate = true
          smGeo.attributes.aOn.needsUpdate = true
        }
        refreshEmitters()

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
        const finalPos = new THREE.Vector3()
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
            const dist = (a > 1.2 ? 36 : 30) * Math.pow(Math.max(1, 1.35 / a), 0.55)
            camera.position.set(0, dist * 0.7, dist * 0.72)
            finalPos.copy(camera.position)
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

        // ---------- время суток: по часам устройства (в админке можно переключить) ----------
        let night = 0
        let dusk = 0
        const c1 = new THREE.Color()
        const hourNow = () => {
          const o = localStorage.getItem('dynasty-time')
          if (o === 'day') return 13
          if (o === 'dusk') return 18.7
          if (o === 'night') return 23
          const d = new Date()
          return d.getHours() + d.getMinutes() / 60
        }
        const applyTime = () => {
          const h = hourNow()
          night = Math.max(0, Math.min(1, smooth(18, 20.5, h) + (1 - smooth(4.5, 6.5, h))))
          dusk = Math.max(smooth(16.2, 18.2, h) * (1 - smooth(19.2, 20.8, h)), smooth(4.6, 5.6, h) * (1 - smooth(6.2, 7.4, h)) * 0.8)
          hemi.intensity = 1.1 - 0.45 * night
          hemi.color.setHex(0xfff0d0).lerp(c1.setHex(0x7d8cff), night * 0.8)
          sun.intensity = 2.6 - 1.9 * night
          sun.color.setHex(0xffd9a0).lerp(c1.setHex(0xff8c4a), dusk).lerp(c1.setHex(0x8c9cff), night)
          fill.intensity = 0.5 + 0.2 * night
          renderer.toneMappingExposure = 1.05 - 0.05 * night
          waterU.uNight.value = night; ffU.uNight.value = night; smU.uNight.value = night
          waterU.uSky.value.setHex(0xf3b57a).lerp(c1.setHex(0xff7a3c), dusk)
          for (const c of clouds) (c.s.material as T.SpriteMaterial).color.setHex(0xffffff).lerp(c1.setHex(0xffb98a), dusk).lerp(c1.setHex(0x4a5578), night)
          birdMat.opacity = 1 - night
          const tint = tintRef.current
          if (tint) {
            const a = Math.min(0.5, night * 0.4 + dusk * 0.16)
            const r = Math.round(255 * dusk * (1 - night) + 12 * night), g = Math.round(130 * dusk * (1 - night) + 20 * night), b = Math.round(50 * dusk * (1 - night) + 52 * night)
            tint.style.background = 'rgba(' + r + ',' + g + ',' + b + ',' + a + ')'
          }
        }
        applyTime()
        let lastTime = performance.now()
        let intro = !reduce
        const introStart = performance.now()
        if (intro) controls.enabled = false
        const UP = new THREE.Vector3(0, 1, 0)
        const off = new THREE.Vector3()
        let ema = 16
        let degraded = false
        let frames = 0
        const degrade = () => {
          degraded = true
          renderer.setPixelRatio(1)
          ffU.uPx.value = 1; smU.uPx.value = 1
          renderer.shadowMap.enabled = false
          scene.traverse((o) => { const m = (o as T.Mesh).material; if (m) (Array.isArray(m) ? m : [m]).forEach((mm) => { mm.needsUpdate = true }) })
          renderer.setSize(el.clientWidth, el.clientHeight, false)
        }

        const tick = () => {
          raf = requestAnimationFrame(tick)
          if (document.hidden || !visible) return
          const now = performance.now()
          const dt = Math.min(100, now - lastTime)
          lastTime = now
          timeU.value = now * 0.001
          ema = ema * 0.95 + dt * 0.05
          if (!degraded && ++frames > 150 && ema > 42) degrade()
          if (now - lastTime < 0 || Math.floor(now / 1000) !== Math.floor((now - dt) / 1000)) applyTime()
          for (const c of clouds) {
            c.s.position.x += c.v * dt * 0.001
            if (c.s.position.x > 56) c.s.position.x = -56
            ;(c.s.material as T.SpriteMaterial).opacity = c.o * (1 - smooth(34, 56, Math.abs(c.s.position.x)))
          }
          for (const b of birds) {
            b.a += b.sp * dt * 0.001
            b.g.position.set(Math.cos(b.a) * b.r, b.y + Math.sin(b.a * 3) * 0.4, -6 + Math.sin(b.a) * b.r * 0.6)
            b.g.rotation.y = -b.a + Math.PI
            const f = Math.sin(now * 0.012 + b.a * 9) * 0.7
            b.wl.rotation.z = f; b.wr.rotation.z = -f
            b.g.visible = night < 0.9 && !degraded
          }
          glows.forEach((g, i) => { (g.material as T.SpriteMaterial).opacity = night * (0.55 + 0.3 * Math.sin(now * 0.006 + i * 1.7)) })
          if (!reduce && !dragging) {
            world.rotation.y = Math.sin(now * 0.00018) * 0.08
            world.position.y = Math.sin(now * 0.0009) * 0.05
          }
          for (let i = fx.length - 1; i >= 0; i--) if (fx[i](now)) fx.splice(i, 1)
          for (const s of slotMap.values()) {
            if (s.shown === 'ready' && s.ghostMats.length) { const p = 0.16 + 0.16 * Math.sin(now * 0.004); for (const m of s.ghostMats) m.emissiveIntensity = p }
          }
          if (now < shakeUntil) { const k = (shakeUntil - now) / 450; camera.position.x += (Math.random() - 0.5) * 0.12 * k; camera.position.y += (Math.random() - 0.5) * 0.08 * k } else camBase.copy(camera.position)
          if (intro) {
            const e = Math.min(1, (now - introStart) / 2400)
            const k = 1 - Math.pow(1 - e, 3)
            off.copy(finalPos).sub(controls.target).applyAxisAngle(UP, (1 - k) * 0.55).multiplyScalar(1 + (1 - k) * 0.4)
            camera.position.copy(controls.target).add(off)
            camera.lookAt(controls.target)
            if (e >= 1) { intro = false; controls.enabled = true; controls.update() }
          } else controls.update()
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
        <picture>
          <source media="(min-width: 768px)" srcSet={`${import.meta.env.BASE_URL}art/stage-${Math.max(1, Math.min(7, stage))}-l.webp`} />
          <img src={`${import.meta.env.BASE_URL}art/stage-${Math.max(1, Math.min(7, stage))}-p.webp`} alt="" onError={() => setImgOk(false)} className="absolute inset-0 h-full w-full object-cover" style={{ objectPosition: '50% 30%', filter: 'brightness(0.85) saturate(1.1)' }} />
        </picture>
      )}
      <div className="absolute inset-0" style={{ background: 'radial-gradient(80% 60% at 50% 55%, transparent 0%, rgba(17,17,20,0.55) 100%)' }} />
      <div ref={tintRef} className="pointer-events-none absolute inset-0" />
      <div ref={host} className="absolute inset-0" />
      {!ready && <div className="absolute inset-0 grid place-items-center text-[13px] text-parch/80">Строим королевство…</div>}
    </div>
  )
}
