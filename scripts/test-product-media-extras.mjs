import assert from 'node:assert/strict'
import test from 'node:test'
import { buildMediaExtrasIndex, withLibraryVideo, frameFromPosition, HOVER_FRAME_COUNT } from '../lib/product-media-extras.ts'

const frames = Array.from({ length: 24 }, (_, i) => `products/hover/p1/v1/${String(i).padStart(2, '0')}.webp`)
const extras = {
  library: [
    { id: 'L1', label: 'Yellow gold', media_path: ' products/videos/yellow.mp4 ' },
    { id: 'L2', label: 'Bad', media_path: '   ' },
  ],
  links: [
    { product_id: 'p1', metal_id: 'm1', library_id: 'L1' },
    { product_id: 'p1', metal_id: 'm2', library_id: 'L2' },
    { product_id: 'p1', metal_id: 'm3', library_id: 'missing' },
  ],
  hover: [
    { product_id: 'p1', frame_paths: frames },
    { product_id: 'p2', frame_paths: frames.slice(1) },
    { product_id: 'p3', frame_paths: null },
  ],
}

test('the index only keeps usable library videos and complete hover views', () => {
  const { videoByProductMetal, hoverFramesByProduct } = buildMediaExtrasIndex(extras)
  assert.equal(videoByProductMetal.get('p1:m1').media_path, 'products/videos/yellow.mp4')
  assert.equal(videoByProductMetal.has('p1:m2'), false, 'blank path ignored')
  assert.equal(videoByProductMetal.has('p1:m3'), false, 'dangling link ignored')
  assert.equal(hoverFramesByProduct.get('p1').length, 24)
  assert.equal(hoverFramesByProduct.has('p2'), false, 'an incomplete set is never shown')
  assert.equal(hoverFramesByProduct.has('p3'), false)
})

test('empty or missing rows give empty maps, so existing products are unchanged', () => {
  const { videoByProductMetal, hoverFramesByProduct } = buildMediaExtrasIndex({ library: [], links: [], hover: [] })
  assert.equal(videoByProductMetal.size + hoverFramesByProduct.size, 0)
})

const image = { id: 'i1', type: 'image', url: 'a.webp', sortOrder: 1 }
const own = { id: 'v1', type: 'video', url: 'own.mp4', sortOrder: 1 }
const video = { id: 'L1', label: 'Yellow gold', media_path: 'products/videos/yellow.mp4' }
const toUrl = path => `https://cdn.example.com/${path}`

test('an option without its own video gets the library video', () => {
  const out = withLibraryVideo([image], video, toUrl)
  assert.equal(out.length, 2)
  assert.deepEqual(out[1], { id: 'library-L1', type: 'video', url: 'https://cdn.example.com/products/videos/yellow.mp4', altText: 'Yellow gold', sortOrder: 9999 })
  assert.equal(out[0], image)
})

test('an option that has its own video, or no chosen video, is left exactly as it was', () => {
  const items = [image, own]
  assert.equal(withLibraryVideo(items, video, toUrl), items)
  const plain = [image]
  assert.equal(withLibraryVideo(plain, undefined, toUrl), plain)
  assert.equal(plain.length, 1, 'input is never mutated')
})

test('the pointer position picks one of the 24 frames, clamped at both edges', () => {
  assert.equal(frameFromPosition(0, 400), 0)
  assert.equal(frameFromPosition(400, 400), HOVER_FRAME_COUNT - 1)
  assert.equal(frameFromPosition(200, 400), 12)
  assert.equal(frameFromPosition(-50, 400), 0)
  assert.equal(frameFromPosition(900, 400), 23)
  assert.equal(frameFromPosition(10, 0), 0)
})
