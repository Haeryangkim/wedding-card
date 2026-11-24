/** 살펴보기용: 메쉬 경계 상자·걷기 클립의 발 위치를 찍고, 주어진 메쉬 묶음을 4방향 x 3프레임으로 한 장에 그린다 */
import { openRenderer, writePng, over, argValue } from './kit.mjs'
import { CAMERA, DIRS } from './config.mjs'

const out = argValue('--out', 'probe.png')
const sets = (argValue('--show', 'Mage_Body,Mage_ArmLeft,Mage_ArmRight,Mage_LegLeft,Mage_LegRight,Mage_Head')).split(';').map((s) => s.split(','))
const r = await openRenderer()
if (process.argv.includes('--info')) {
  console.log(JSON.stringify(r.info))
  console.log(JSON.stringify(await r.page.evaluate(() => window.kk.bboxes())))
  const w = await r.page.evaluate((c) => window.kk.probeWalk(c), argValue('--clip', 'Walking_A'))
  console.log(w.duration, w.samples.map((s) => s.join(' ')).join('\n'))
}
const { w, h } = CAMERA
const useMask = process.argv.includes('--mask')
const dirs = argValue('--dirs', DIRS.join(',')).split(',')
const frames = argValue('--frames', '0,1,2').split(',').map(Number)
const SW = w * frames.length * sets.length
const SH = h * dirs.length
const sheet = new Uint8Array(SW * SH * 4)
for (let i = 0; i < sheet.length; i += 4) { sheet[i] = 70; sheet[i + 1] = 110; sheet[i + 2] = 80; sheet[i + 3] = 255 }
for (const [si, show] of sets.entries())
  for (const [di, dir] of dirs.entries())
    for (const [fi, f] of frames.entries()) {
      const c = await r.cell({ show, dir, frame: f, paint: {}, mask: useMask })
      over(sheet, SW, useMask ? c.mask : c.color, w, h, (si * frames.length + fi) * w, di * h)
    }
writePng(out, sheet, SW, SH)
console.log('saved', out)
await r.close()
