import type { Group } from 'three'

const BASE = import.meta.env.BASE_URL

/** three.js и его надстройки грузятся динамически: только когда нужна 3D-сцена. */
export async function loadThree() {
  const THREE = await import('three')
  const { GLTFLoader } = await import('three/examples/jsm/loaders/GLTFLoader.js')
  const { MeshoptDecoder } = await import('three/examples/jsm/libs/meshopt_decoder.module.js')
  const { OrbitControls } = await import('three/examples/jsm/controls/OrbitControls.js')
  return { THREE, GLTFLoader, MeshoptDecoder, OrbitControls }
}

type Three = Awaited<ReturnType<typeof loadThree>>
const cache = new Map<string, Promise<Group>>()

/** Загружает модель из public/models один раз; дальше отдаёт тот же оригинал (его клонируют, не меняют). */
export function loadModel(t: Three, name: string): Promise<Group> {
  let p = cache.get(name)
  if (!p) {
    const loader = new t.GLTFLoader()
    loader.setMeshoptDecoder(t.MeshoptDecoder)
    p = loader.loadAsync(`${BASE}models/${name}.glb`).then((g) => g.scene)
    p.catch(() => cache.delete(name))
    cache.set(name, p)
  }
  return p
}
