/**
 * 브라우저(헤드리스 크롬) 쪽 렌더러 — build.mjs 가 이 페이지를 열고 window.kk.* 를 불러 칸(cell)을 하나씩 굽는다.
 *
 *  - 캐릭터 GLB 6개를 같은 자세로 겹쳐 세워 두고, 레이어마다 필요한 메쉬만 켠다.
 *  - 색 패스: 색을 바꿀 수 있는 영역(피부·머리·옷)은 팔레트 텍스처를 "밝기만 남긴 흰색"으로 바꿔 굽는다
 *    → 실행 때 고른 색을 곱하면 된다 (램버트 조명 × sRGB 는 곱셈에 대해 거의 그대로 유지된다).
 *  - 마스크 패스: 같은 장면을 조명 없이 R=피부, G=머리, B=옷 으로 칠해 굽는다 (가장자리는 비율로 섞인다).
 *  - 가리개(occluder): 색은 쓰지 않고 깊이만 쓰는 메쉬. "이 물건 중 몸보다 앞에 있는 조각" 을 얻는 데 쓴다.
 */
import * as THREE from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { CAMERA, CHARACTERS, ITEMS, LIGHTS, NEUTRAL, POSES, DIR_YAW, buildProps } from './config.mjs'

const TEX = 256
const COLS = 8
const ROWS = 4
const CLASS_RGB = { skin: [255, 0, 0], hair: [0, 255, 0], outfit: [0, 0, 255] }
/** 그라데이션의 어두운 끝이 고른 색의 몇 배인지 (피부는 원본도 얕다) */
const CLASS_FLOOR = { skin: 0.8, hair: 0.6, outfit: 0.6 }

const W = CAMERA.w
const H = CAMERA.h
const SS = CAMERA.supersample

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, premultipliedAlpha: true, preserveDrawingBuffer: true })
renderer.setPixelRatio(1)
renderer.setSize(W * SS, H * SS, false)
renderer.setClearColor(0x000000, 0)
renderer.toneMapping = THREE.NoToneMapping
document.body.appendChild(renderer.domElement)
const gl = renderer.getContext()

const scene = new THREE.Scene()
/** 캐릭터가 서는 자리 — 방향은 이 그룹을 Y 축으로 돌려서 만든다 (조명·카메라는 그대로) */
const stage = new THREE.Group()
scene.add(stage)

const camera = new THREE.OrthographicCamera(
  -W / 2 / CAMERA.pxPerUnit,
  W / 2 / CAMERA.pxPerUnit,
  CAMERA.footY / CAMERA.pxPerUnit,
  -(H - CAMERA.footY) / CAMERA.pxPerUnit,
  0.1,
  100,
)
{
  const p = (CAMERA.pitch * Math.PI) / 180
  camera.position.set(0, Math.sin(p) * 20, Math.cos(p) * 20)
  camera.lookAt(0, 0, 0)
}

const lightRig = new THREE.Group()
scene.add(lightRig)
lightRig.add(new THREE.HemisphereLight(LIGHTS.sky, LIGHTS.ground, LIGHTS.hemi))
for (const l of LIGHTS.dirs) {
  const d = new THREE.DirectionalLight(l.color, l.intensity)
  d.position.set(...l.from)
  lightRig.add(d)
}

/** 메쉬 이름 → { mesh, image(원본 팔레트 텍스처) } */
const parts = new Map()
const mixers = []
/** 손을 따라가되 기울지 않는 소품 (지팡이): 무대에 붙여 두고 자세가 바뀔 때마다 손 위치로 옮긴다 */
const uprights = []
const clips = new Map()
let masterRig = null

const loader = new GLTFLoader()
const load = (url) => new Promise((res, rej) => loader.load(url, res, undefined, rej))

function registerMesh(name, mesh) {
  mesh.frustumCulled = false
  mesh.visible = false
  const image = mesh.material?.map?.image ?? null
  parts.set(name, { mesh, image, flat: mesh.userData.flat ?? null })
}

function findBone(root, re) {
  let hit = null
  root.traverse((o) => {
    if (!hit && o.isBone && re.test(o.name)) hit = o
  })
  return hit
}

async function init() {
  for (const c of CHARACTERS) {
    const gltf = await load(`./raw/characters/${c}.glb`)
    stage.add(gltf.scene)
    gltf.scene.traverse((o) => {
      if (o.isMesh) registerMesh(o.name, o)
    })
    mixers.push({ root: gltf.scene, mixer: new THREE.AnimationMixer(gltf.scene) })
    masterRig ??= gltf.scene
  }
  for (const f of ['Rig_Medium_General', 'Rig_Medium_MovementBasic']) {
    const gltf = await load(`./raw/animations/${f}.glb`)
    for (const clip of gltf.animations) clips.set(clip.name, clip)
  }
  setPose(0)
  const slots = { r: findBone(masterRig, /^handslot\W?r$/i), l: findBone(masterRig, /^handslot\W?l$/i) }
  const head = findBone(masterRig, /^head$/i)
  const chest = findBone(masterRig, /^chest$/i)
  for (const it of ITEMS) {
    const gltf = await load(`./raw/assets/${it.file}.gltf`)
    const holder = new THREE.Group()
    holder.name = it.name
    holder.add(gltf.scene)
    if (it.rot) holder.rotation.set(...it.rot.map((d) => (d * Math.PI) / 180))
    if (it.pos) holder.position.set(...it.pos)
    if (it.scale) holder.scale.setScalar(it.scale)
    slots[it.slot].add(holder)
    if (it.stand) {
      // 정지 자세의 무대 좌표에서 손 위치를 축으로 돌리고 옮긴 뒤 다시 손에 붙인다
      stage.updateMatrixWorld(true)
      stage.attach(holder)
      const [rx, ry, rz] = it.stand.rot.map((d) => (d * Math.PI) / 180)
      holder.applyQuaternion(new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)))
      const hand = new THREE.Vector3()
      slots[it.slot].getWorldPosition(hand)
      holder.position.copy(hand).add(new THREE.Vector3(...it.stand.shift))
      holder.updateMatrixWorld(true)
      if (it.stand.upright) uprights.push({ holder, slot: slots[it.slot], offset: holder.position.clone().sub(hand) })
      else slots[it.slot].attach(holder)
    }
    let n = 0
    gltf.scene.traverse((o) => {
      if (o.isMesh) registerMesh(n++ === 0 ? it.name : `${it.name}#${n}`, o)
    })
  }
  // 직접 만든 소품(면사포·부케·화관…): 정지 자세 기준 "무대 좌표"로 놓은 뒤 뼈에 붙인다
  stage.updateMatrixWorld(true)
  const anchors = { handR: slots.r.getWorldPosition(new THREE.Vector3()), handL: slots.l.getWorldPosition(new THREE.Vector3()) }
  for (const prop of buildProps(THREE, anchors)) {
    stage.add(prop.object)
    prop.object.updateMatrixWorld(true)
    const bone = prop.bone === 'head' ? head : prop.bone === 'chest' ? chest : slots[prop.bone]
    bone.attach(prop.object)
    let n = 0
    prop.object.traverse((o) => {
      if (o.isMesh) registerMesh(`${prop.name}#${n++}`, o)
    })
    parts.set(prop.name, { group: true, names: Array.from({ length: n }, (_, i) => `${prop.name}#${i}`) })
  }
  return { parts: [...parts.keys()], clips: [...clips.entries()].map(([k, c]) => [k, +c.duration.toFixed(3)]) }
}

function setPoseAt(clipName, time) {
  const clip = clips.get(clipName)
  if (!clip) throw new Error(`no clip ${clipName}`)
  for (const m of mixers) {
    m.mixer.stopAllAction()
    const a = m.mixer.clipAction(clip)
    a.reset()
    a.play()
    m.mixer.setTime(time)
  }
  stage.updateMatrixWorld(true)
  const hand = new THREE.Vector3()
  for (const u of uprights) {
    u.holder.position.copy(stage.worldToLocal(u.slot.getWorldPosition(hand))).add(u.offset)
  }
  stage.updateMatrixWorld(true)
}
function setPose(frame) {
  const p = POSES[frame]
  setPoseAt(p.clip, p.time)
}

/* ── 팔레트 텍스처 다시 칠하기 ─────────────────────────── */

const lum = (r, g, b) => 0.299 * r + 0.587 * g + 0.114 * b
function parseSpec(spec) {
  if (!spec) return { kind: 'keep' }
  if (typeof spec === 'string') return { kind: 'class', cls: spec, scale: 1, floor: CLASS_FLOOR[spec] }
  if (Array.isArray(spec)) return { kind: 'class', cls: spec[0], scale: spec[1] ?? 1, floor: spec[2] ?? CLASS_FLOOR[spec[0]] }
  const c = new THREE.Color(spec.c)
  // 색은 sRGB 값 그대로 곱한다 (텍스처 픽셀이 sRGB 이므로)
  const hex = c.getHex(THREE.SRGBColorSpace)
  return { kind: 'fixed', rgb: [(hex >> 16) & 255, (hex >> 8) & 255, hex & 255], floor: spec.floor ?? 0.6, gain: spec.gain ?? 1 }
}

const texCache = new Map()
/** paint: { 'bx,by': spec } → { color: Texture, mask: Texture } */
function texturesFor(image, paint, paintKey) {
  let hit = texCache.get(image)?.get(paintKey)
  if (hit) return hit
  const cv = document.createElement('canvas')
  cv.width = cv.height = TEX
  const ctx = cv.getContext('2d', { willReadFrequently: true })
  ctx.drawImage(image, 0, 0, TEX, TEX)
  const src = ctx.getImageData(0, 0, TEX, TEX)
  const out = new ImageData(TEX, TEX)
  const msk = new ImageData(TEX, TEX)
  const bw = TEX / COLS
  const bh = TEX / ROWS
  const specs = []
  const blockMax = []
  const blockMin = []
  for (let by = 0; by < ROWS; by++)
    for (let bx = 0; bx < COLS; bx++) {
      const spec = parseSpec(paint?.[`${bx},${by}`])
      let m = 0
      let lo = 255
      for (let y = by * bh; y < (by + 1) * bh; y++)
        for (let x = bx * bw; x < (bx + 1) * bw; x++) {
          const i = (y * TEX + x) * 4
          const l = lum(src.data[i], src.data[i + 1], src.data[i + 2])
          m = Math.max(m, l)
          lo = Math.min(lo, l)
        }
      specs.push(spec)
      blockMax.push(m)
      blockMin.push(lo)
    }
  for (let by = 0; by < ROWS; by++)
    for (let bx = 0; bx < COLS; bx++) {
      const spec = specs[by * COLS + bx]
      const bm = blockMax[by * COLS + bx]
      const bl = blockMin[by * COLS + bx]
      // 블록 안의 그라데이션 위치 0(가장 어두운 끝)~1(가장 밝은 끝)
      const grade = (r, g, b) => (bm > bl ? (lum(r, g, b) - bl) / (bm - bl) : 1)
      for (let y = by * bh; y < (by + 1) * bh; y++)
        for (let x = bx * bw; x < (bx + 1) * bw; x++) {
          const i = (y * TEX + x) * 4
          const r = src.data[i]
          const g = src.data[i + 1]
          const b = src.data[i + 2]
          let o = [r, g, b]
          let m = [0, 0, 0]
          if (spec.kind === 'class') {
            // 블록 안의 그라데이션만 남긴다: 어두운 끝 = floor, 밝은 끝 = 1 (블록끼리의 밝기 차는 scale 로 직접 정한다)
            const v = NEUTRAL * spec.scale * (spec.floor + (1 - spec.floor) * grade(r, g, b))
            o = [v, v, v]
            m = CLASS_RGB[spec.cls]
          } else if (spec.kind === 'fixed') {
            const t = (spec.floor + (1 - spec.floor) * grade(r, g, b)) * spec.gain
            o = spec.rgb.map((c) => Math.min(255, c * t))
          }
          out.data[i] = o[0]
          out.data[i + 1] = o[1]
          out.data[i + 2] = o[2]
          out.data[i + 3] = 255
          msk.data[i] = m[0]
          msk.data[i + 1] = m[1]
          msk.data[i + 2] = m[2]
          msk.data[i + 3] = 255
        }
    }
  const mk = (data, srgb) => {
    const c = document.createElement('canvas')
    c.width = c.height = TEX
    c.getContext('2d').putImageData(data, 0, 0)
    const t = new THREE.CanvasTexture(c)
    t.flipY = false
    t.generateMipmaps = false
    t.minFilter = srgb ? THREE.LinearFilter : THREE.NearestFilter
    t.magFilter = srgb ? THREE.LinearFilter : THREE.NearestFilter
    t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace
    return t
  }
  hit = { color: mk(out, true), mask: mk(msk, false) }
  if (!texCache.has(image)) texCache.set(image, new Map())
  texCache.get(image).set(paintKey, hit)
  return hit
}

const depthOnly = new THREE.MeshBasicMaterial({ colorWrite: false, side: THREE.DoubleSide })
const matCache = new Map()
function materialFor(part, paint, paintKey, pass) {
  const k = `${part.mesh.uuid}|${paintKey}|${pass}`
  let m = matCache.get(k)
  if (m) return m
  if (part.flat) {
    // 직접 만든 소품: 단색. flat = { color, cls? }
    const cls = part.flat.cls
    if (pass === 'mask') m = new THREE.MeshBasicMaterial({ color: cls ? new THREE.Color().setRGB(...CLASS_RGB[cls].map((v) => v / 255), THREE.LinearSRGBColorSpace) : 0x000000, side: THREE.DoubleSide })
    else m = new THREE.MeshLambertMaterial({ color: cls ? new THREE.Color().setRGB(NEUTRAL / 255, NEUTRAL / 255, NEUTRAL / 255, THREE.SRGBColorSpace) : part.flat.color, side: THREE.DoubleSide, flatShading: !!part.flat.faceted })
  } else {
    const tex = texturesFor(part.image, paint, paintKey)
    if (pass === 'mask') m = new THREE.MeshBasicMaterial({ map: tex.mask, side: THREE.DoubleSide })
    else m = new THREE.MeshLambertMaterial({ map: tex.color, side: THREE.DoubleSide })
  }
  m.toneMapped = false
  matCache.set(k, m)
  return m
}

function expand(names) {
  const out = []
  for (const n of names) {
    const p = parts.get(n)
    if (!p) throw new Error(`no mesh named ${n}`)
    if (p.group) out.push(...p.names)
    else out.push(n)
  }
  return out
}

/** 한 패스를 그려 W*SS x H*SS 의 RGBA(위→아래, 곱해진 알파)를 돌려준다 */
function draw(show, occl, paint, paintKey, pass) {
  for (const p of parts.values()) if (p.mesh) p.mesh.visible = false
  for (const n of expand(occl)) {
    const p = parts.get(n)
    p.mesh.visible = true
    p.mesh.material = depthOnly
    p.mesh.renderOrder = -1
  }
  for (const n of expand(show)) {
    const p = parts.get(n)
    p.mesh.visible = true
    p.mesh.material = materialFor(p, paint, paintKey, pass)
    p.mesh.renderOrder = 0
  }
  lightRig.visible = pass !== 'mask'
  renderer.outputColorSpace = pass === 'mask' ? THREE.LinearSRGBColorSpace : THREE.SRGBColorSpace
  renderer.setRenderTarget(null)
  renderer.clear()
  renderer.render(scene, camera)
  const w = W * SS
  const h = H * SS
  const buf = new Uint8Array(w * h * 4)
  gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, buf)
  return buf
}

/** SS x SS 상자 평균으로 줄인다. 입력은 아래→위 줄 순서 */
function downscale(buf) {
  const out = new Float32Array(W * H * 4)
  const w = W * SS
  const n = SS * SS
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      let r = 0
      let g = 0
      let b = 0
      let a = 0
      for (let j = 0; j < SS; j++) {
        const row = H * SS - 1 - (y * SS + j)
        let i = (row * w + x * SS) * 4
        for (let k = 0; k < SS; k++, i += 4) {
          r += buf[i]
          g += buf[i + 1]
          b += buf[i + 2]
          a += buf[i + 3]
        }
      }
      const o = (y * W + x) * 4
      out[o] = r / n
      out[o + 1] = g / n
      out[o + 2] = b / n
      out[o + 3] = a / n
    }
  return out
}

function b64(u8) {
  let s = ''
  for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000))
  return btoa(s)
}

/**
 * 한 칸을 굽는다.
 *  spec = { show: [메쉬], occl: [가리개 메쉬], paint, paintKey, dir, frame, mask: boolean }
 * 돌려주는 것: { color: base64 RGBA(곱하지 않은 알파, W x H), mask: base64 RGB 가중치(알파로 나눈 값) | null, count }
 */
function renderCell(spec) {
  stage.rotation.y = (DIR_YAW[spec.dir] * Math.PI) / 180
  if (spec.pose) setPoseAt(spec.pose.clip, spec.pose.time)
  else setPose(spec.frame)
  const paintKey = spec.paintKey ?? JSON.stringify(spec.paint ?? {})
  const col = downscale(draw(spec.show, spec.occl ?? [], spec.paint, paintKey, 'color'))
  const color = new Uint8Array(W * H * 4)
  let count = 0
  for (let i = 0; i < W * H * 4; i += 4) {
    const a = col[i + 3]
    if (a < 0.5) continue
    count++
    color[i] = Math.min(255, Math.round((col[i] * 255) / a))
    color[i + 1] = Math.min(255, Math.round((col[i + 1] * 255) / a))
    color[i + 2] = Math.min(255, Math.round((col[i + 2] * 255) / a))
    color[i + 3] = Math.round(a)
  }
  let mask = null
  if (spec.mask !== false) {
    const mk = downscale(draw(spec.show, spec.occl ?? [], spec.paint, paintKey, 'mask'))
    const m = new Uint8Array(W * H * 4)
    for (let i = 0; i < W * H * 4; i += 4) {
      const a = mk[i + 3]
      if (a < 0.5) continue
      m[i] = Math.min(255, Math.round((mk[i] * 255) / a))
      m[i + 1] = Math.min(255, Math.round((mk[i + 1] * 255) / a))
      m[i + 2] = Math.min(255, Math.round((mk[i + 2] * 255) / a))
      m[i + 3] = 255
    }
    mask = b64(m)
  }
  return { color: b64(color), mask, count }
}

/** 걷기 클립에서 두 발이 앞뒤로 가장 벌어지는 때를 찾는다 (프레임 1·2 를 고르는 데 쓴다) */
function probeWalk(clipName, steps = 48) {
  const clip = clips.get(clipName)
  stage.rotation.y = 0
  const l = findBone(masterRig, /^foot\W?l$/i)
  const r = findBone(masterRig, /^foot\W?r$/i)
  const hips = findBone(masterRig, /^hips$/i)
  const out = []
  const a = new THREE.Vector3()
  const b = new THREE.Vector3()
  const c = new THREE.Vector3()
  for (let i = 0; i < steps; i++) {
    const t = (clip.duration * i) / steps
    setPoseAt(clipName, t)
    l.getWorldPosition(a)
    r.getWorldPosition(b)
    hips.getWorldPosition(c)
    out.push([+t.toFixed(3), +(a.z - b.z).toFixed(3), +a.y.toFixed(3), +b.y.toFixed(3), +c.z.toFixed(3)])
  }
  return { duration: clip.duration, samples: out }
}

/** 정지 자세에서 메쉬별 경계 상자 (무대 좌표) — 카메라 틀을 잡을 때 참고 */
function bboxes() {
  stage.rotation.y = 0
  setPose(0)
  const out = {}
  for (const [name, p] of parts) {
    if (!p.mesh) continue
    p.mesh.visible = true
    if (p.mesh.isSkinnedMesh) p.mesh.computeBoundingBox()
    const box = new THREE.Box3().setFromObject(p.mesh, true)
    p.mesh.visible = false
    out[name] = [...box.min.toArray(), ...box.max.toArray()].map((v) => +v.toFixed(2))
  }
  return out
}

/** 메쉬의 팔레트 텍스처에서 블록의 가장 밝은 색 (의상 색 "기본" 에 쓴다) */
function blockTop(meshName, block) {
  const image = parts.get(meshName).image
  const cv = document.createElement('canvas')
  cv.width = cv.height = TEX
  const ctx = cv.getContext('2d')
  ctx.drawImage(image, 0, 0, TEX, TEX)
  const [bx, by] = block.split(',').map(Number)
  const d = ctx.getImageData((bx * TEX) / COLS, (by * TEX) / ROWS, TEX / COLS, TEX / ROWS).data
  let best = [0, 0, 0]
  for (let i = 0; i < d.length; i += 4) if (lum(d[i], d[i + 1], d[i + 2]) > lum(...best)) best = [d[i], d[i + 1], d[i + 2]]
  return best
}

window.kk = { ready: init(), renderCell, probeWalk, bboxes, blockTop, size: { W, H } }
