// Which stored reel video addresses are ever played on the home page.
import test from 'node:test'
import assert from 'node:assert/strict'
import { reelVideoUrl } from '../lib/reel-video.ts'

test('https video files are played', () => {
  for (const url of ['https://media.houseofdiams.com/products/videos/a.mp4', 'https://content.houseofdiams.com/x/y.webm', ' https://media.houseofdiams.com/a.MOV '])
    assert.equal(reelVideoUrl(url), new URL(url.trim()).href, url)
})

test('anything else is ignored, never put in the page', () => {
  for (const value of [null, undefined, 42, {}, '', '   ', 'javascript:alert(1)', 'data:video/mp4;base64,AAAA', 'http://media.houseofdiams.com/a.mp4', '//media.houseofdiams.com/a.mp4', '/a.mp4',
    'https://media.houseofdiams.com/a.gif', 'https://media.houseofdiams.com/a.mp4.exe', 'https://user:pass@media.houseofdiams.com/a.mp4', 'https://media.houseofdiams.com/a', 'https://www.instagram.com/reel/ABC/'])
    assert.equal(reelVideoUrl(value), null, String(value))
  assert.equal(reelVideoUrl('https://media.houseofdiams.com/a.mp4?x=1'), 'https://media.houseofdiams.com/a.mp4?x=1', 'a query string on a real video file is kept')
})
