// api/hack.js
import fetch from 'node-fetch'

export default async function handler(req, res) {
  // تفعيل CORS
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'استخدم POST' })
  }

  const { url } = req.body

  if (!url) {
    return res.status(400).json({ error: 'الرابط مطلوب' })
  }

  let targetUrl = url.trim()
  if (!targetUrl.startsWith('http')) {
    targetUrl = 'https://' + targetUrl
  }

  console.log(`اختراق: ${targetUrl}`)

  try {
    // جلب الصفحة
    const pageRes = await fetch(targetUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    })

    if (!pageRes.ok) {
      return res.status(404).json({ success: false, error: 'الموقع لا يستجيب' })
    }

    const html = await pageRes.text()
    const baseUrl = new URL(targetUrl)

    // استخراج الروابط
    const linkPattern = /(?:href|src)=["']([^"']*)["']/gi
    const matches = [...html.matchAll(linkPattern)]
    const links = new Set()

    for (const match of matches) {
      let link = match[1]
      if (!link) continue
      if (link.startsWith('#') || link.startsWith('javascript:') || link.startsWith('data:')) continue
      if (link.startsWith('http') && !link.includes(baseUrl.hostname)) continue

      try {
        const fullUrl = new URL(link, targetUrl).href
        if (fullUrl.includes(baseUrl.hostname)) {
          links.add(fullUrl)
        }
      } catch {
        continue
      }
    }

    if (links.size === 0) {
      links.add(targetUrl)
    }

    // تحميل الملفات
    const files = []
    let count = 0

    for (const link of links) {
      try {
        const fileRes = await fetch(link, {
          headers: { 'User-Agent': 'Mozilla/5.0' }
        })

        if (fileRes.status !== 200) continue

        const buffer = await fileRes.arrayBuffer()
        if (buffer.byteLength < 100) continue

        // اسم الملف
        let filename = link.split('/').pop().split('?')[0]
        if (!filename || filename.length > 50 || !filename.includes('.')) {
          const contentType = fileRes.headers.get('content-type') || ''
          let ext = 'html'
          if (contentType.includes('css')) ext = 'css'
          else if (contentType.includes('javascript')) ext = 'js'
          else if (contentType.includes('json')) ext = 'json'
          else if (contentType.includes('image')) ext = 'jpg'
          else if (contentType.includes('png')) ext = 'png'
          filename = `file_${count + 1}.${ext}`
        }

        files.push({
          name: filename,
          content: Buffer.from(buffer).toString('base64'),
          size: (buffer.byteLength / 1024).toFixed(2)
        })

        count++
        if (count >= 15) break // حد أقصى 15 ملف

      } catch (err) {
        console.log(`فشل: ${link}`)
      }
    }

    if (files.length === 0) {
      return res.json({
        success: false,
        message: 'لم يتم العثور على ملفات',
        url: targetUrl
      })
    }

    // إرجاع النتيجة
    res.json({
      success: true,
      url: targetUrl,
      domain: baseUrl.hostname,
      filesCount: files.length,
      files: files.map(f => ({ name: f.name, size: f.size + ' KB' })),
      filesBase64: files
    })

  } catch (error) {
    console.error(error)
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
      }
