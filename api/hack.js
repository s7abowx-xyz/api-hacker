import fetch from 'node-fetch'

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { url } = req.body
  if (!url) return res.status(400).json({ error: 'الرابط مطلوب' })

  let targetUrl = url.trim()
  if (!targetUrl.startsWith('http')) targetUrl = 'https://' + targetUrl

  try {
    const pageRes = await fetch(targetUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } })
    const html = await pageRes.text()
    const baseUrl = new URL(targetUrl)

    const linkPattern = /(?:href|src)=["']([^"']*)["']/gi
    const matches = [...html.matchAll(linkPattern)]
    const links = new Set()

    for (const match of matches) {
      let link = match[1]
      if (!link || link.startsWith('#') || link.startsWith('javascript:') || link.startsWith('data:')) continue
      try {
        const fullUrl = new URL(link, targetUrl).href
        if (fullUrl.includes(baseUrl.hostname)) links.add(fullUrl)
      } catch {}
    }

    if (links.size === 0) links.add(targetUrl)

    const files = []
    let count = 0

    for (const link of links) {
      try {
        const fileRes = await fetch(link, { headers: { 'User-Agent': 'Mozilla/5.0' } })
        if (fileRes.status !== 200) continue
        const buffer = await fileRes.arrayBuffer()
        if (buffer.byteLength < 50) continue

        let filename = link.split('/').pop().split('?')[0]
        if (!filename || filename.length > 50) filename = `file_${count + 1}.html`

        files.push({
          name: filename,
          content: Buffer.from(buffer).toString('base64'),
          size: (buffer.byteLength / 1024).toFixed(2) + ' KB'
        })
        count++
        if (count >= 20) break
      } catch {}
    }

    if (files.length === 0) return res.status(404).json({ success: false, message: 'لا توجد ملفات' })

    res.json({ success: true, url: targetUrl, domain: baseUrl.hostname, filesCount: files.length, files: files.map(f => ({ name: f.name, size: f.size })), filesBase64: files })
  } catch (error) {
    res.status(500).json({ success: false, error: error.message })
  }
}
