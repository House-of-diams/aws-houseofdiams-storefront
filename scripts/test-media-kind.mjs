import assert from 'node:assert/strict'
import test from 'node:test'
import { isVideoUrl } from '../lib/media-kind.ts'

test('video file addresses are recognised, whatever the case or query string', () => {
  for (const url of ['https://media.houseofdiams.com/products/videos/a.mp4', 'https://x.test/a.WEBM', 'https://x.test/a.mov?v=2', 'https://x.test/a.m4v#t=1', '/local/banner.ogv', 'https://x.test/my%20clip.mp4'])
    assert.equal(isVideoUrl(url), true, url)
})

test('images, empty values and look-alikes are not videos', () => {
  for (const url of ['https://x.test/a.webp', 'https://x.test/a.jpg', 'https://x.test/mp4', 'https://x.test/a.mp4.png', 'https://x.test/path.mp4/index.html', '', null, undefined])
    assert.equal(isVideoUrl(url), false, String(url))
})
