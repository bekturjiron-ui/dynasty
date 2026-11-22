import { useEffect, useRef, useState } from 'react'

const BASE = import.meta.env.BASE_URL

/** 3D-модель (.glb из public/models). three.js грузится только при показе, на экране «Империя».
 *  Авто-вращение, вертикальная прокрутка страницы пальцем работает. Рендер останавливается, когда вкладка скрыта. */
export default function ModelViewer({ name, dim = false, className = '' }: { name: string; dim?: boolean; className?: string }) {
  const host = useRef<HTMLDivElement>(null)
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading')

  useEffect(() => {
    let disposed = false
    let cleanup = () => {}
    ;(async () => {
      try {
        const THREE = await import('three')
        const { GLTFLoader } = await import('three/examples/jsm/loaders/GLTFLoader.js')
        const { MeshoptDecoder } = await import('three/examples/jsm/libs/meshopt_decoder.module.js')
        const { OrbitControls } = await import('three/examples/jsm/controls/OrbitControls.js')
        const el = host.current
        if (!el || disposed) return

        const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' })
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
        renderer.outputColorSpace = THREE.SRGBColorSpace
        renderer.toneMapping = THREE.ACESFilmicToneMapping
        renderer.toneMappingExposure = 1.05
        el.appendChild(renderer.domElement)
        renderer.domElement.style.cssText = 'width:100%;height:100%;display:block'

        const scene = new THREE.Scene()
        scene.add(new THREE.HemisphereLight(0xfff0d0, 0x2a2430, 1.6))
        const sun = new THREE.DirectionalLight(0xffd9a0, 2.2)
        sun.position.set(3, 5, 4)
        scene.add(sun)
        const fill = new THREE.DirectionalLight(0x8fa8ff, 0.5)
        fill.position.set(-4, 2, -3)
        scene.add(fill)

        const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100)
        const loader = new GLTFLoader()
        loader.setMeshoptDecoder(MeshoptDecoder)
        const gltf = await loader.loadAsync(`${BASE}models/${name}.glb`)
        if (disposed) { renderer.dispose(); return }

        const model = gltf.scene
        const box = new THREE.Box3().setFromObject(model)
        const size = box.getSize(new THREE.Vector3())
        const center = box.getCenter(new THREE.Vector3())
        model.position.sub(center)
        scene.add(model)
        const radius = Math.max(size.x, size.y, size.z) * 0.5
        const dist = radius / Math.tan((camera.fov * Math.PI) / 360) * 1.25
        camera.position.set(dist * 0.7, dist * 0.45, dist * 0.75)

        const controls = new OrbitControls(camera, renderer.domElement)
        controls.enablePan = false
        controls.enableZoom = false
        controls.autoRotate = true
        controls.autoRotateSpeed = 1.6
        controls.enableDamping = true
        controls.minPolarAngle = controls.maxPolarAngle = Math.PI * 0.38
        renderer.domElement.style.touchAction = 'pan-y' // страница прокручивается пальцем

        const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
        if (reduce) controls.autoRotate = false

        const resize = () => {
          const w = el.clientWidth, h = el.clientHeight
          if (!w || !h) return
          renderer.setSize(w, h, false)
          camera.aspect = w / h
          camera.updateProjectionMatrix()
        }
        const ro = new ResizeObserver(resize)
        ro.observe(el)
        resize()

        let raf = 0
        const tick = () => {
          raf = requestAnimationFrame(tick)
          if (document.hidden) return
          controls.update()
          renderer.render(scene, camera)
        }
        tick()
        setState('ready')

        cleanup = () => {
          cancelAnimationFrame(raf)
          ro.disconnect()
          controls.dispose()
          model.traverse((o) => {
            const m = o as import('three').Mesh
            if (m.isMesh) {
              m.geometry.dispose()
              const mats = Array.isArray(m.material) ? m.material : [m.material]
              mats.forEach((mt) => {
                for (const v of Object.values(mt)) if (v && (v as import('three').Texture).isTexture) (v as import('three').Texture).dispose()
                mt.dispose()
              })
            }
          })
          renderer.dispose()
          renderer.domElement.remove()
        }
      } catch {
        if (!disposed) setState('error')
      }
    })()
    return () => { disposed = true; cleanup() }
  }, [name])

  return (
    <div className={`relative ${className}`}>
      <div ref={host} className="h-full w-full transition-[filter,opacity] duration-700" style={{ filter: dim ? 'brightness(0.35) grayscale(0.6)' : 'none', opacity: state === 'ready' ? 1 : 0 }} />
      {state === 'loading' && <div className="absolute inset-0 grid place-items-center text-[13px] text-muted">Строим…</div>}
      {state === 'error' && <div className="absolute inset-0 grid place-items-center text-[13px] text-muted">3D недоступно на этом устройстве</div>}
    </div>
  )
}
