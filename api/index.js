// Worm Hunter API - للبوتات (تيليجرام، واتساب، ديسكورد)
const https = require('https');
const http = require('http');

const COMMON_DIRS = [
    'admin', 'backup', 'uploads', 'files', 'download', 'wp-admin', 'wp-content',
    'phpmyadmin', 'mysql', 'database', 'config', '.git', 'api', 'v1', 'v2',
    'old', 'test', 'dev', 'secret', 'private', 'logs', 'temp', 'tmp'
];

const SENSITIVE_FILES = [
    '.env', 'config.php', 'wp-config.php', 'database.php', '.git/config',
    '.gitignore', 'robots.txt', 'backup.sql', 'dump.sql', 'password.txt',
    'passwords.txt', 'config.json', 'settings.py', 'web.config', 'credentials.txt',
    'api_keys.txt', 'secret.key', 'id_rsa', 'adminer.php', 'phpinfo.php'
];

const EXTENSIONS = ['.php', '.html', '.js', '.css', '.sql', '.json', '.xml', '.txt', '.env', '.log', '.bak'];

function fetchUrl(url, timeout = 8000) {
    return new Promise((resolve) => {
        const protocol = url.startsWith('https') ? https : http;
        const request = protocol.get(url, { timeout }, (response) => {
            if (response.statusCode === 200) {
                let data = '';
                response.on('data', chunk => data += chunk);
                response.on('end', () => resolve({ status: 200, data, headers: response.headers }));
            } else if (response.statusCode === 301 || response.statusCode === 302) {
                const redirectUrl = response.headers.location;
                if (redirectUrl) {
                    fetchUrl(redirectUrl).then(resolve);
                } else {
                    resolve({ status: response.statusCode, data: null });
                }
            } else {
                resolve({ status: response.statusCode, data: null });
            }
        });
        request.on('error', () => resolve({ status: 0, data: null }));
        request.end();
    });
}

async function testFile(url) {
    const response = await fetchUrl(url);
    if (response.status === 200 && response.data) {
        return {
            url: url,
            size: response.data.length,
            sensitive: SENSITIVE_FILES.some(s => url.toLowerCase().includes(s.toLowerCase()))
        };
    }
    return null;
}

async function scanWebsite(targetUrl) {
    let url = targetUrl;
    if (!url.startsWith('http')) {
        url = 'https://' + url;
    }
    const baseUrl = url.split('/').slice(0, 3).join('/');
    const foundFiles = [];
    const seen = new Set();

    // فحص الملفات الحساسة
    for (const sensitive of SENSITIVE_FILES) {
        const testUrl = `${baseUrl}/${sensitive}`;
        const file = await testFile(testUrl);
        if (file && !seen.has(file.url)) {
            seen.add(file.url);
            foundFiles.push(file);
        }
    }

    // فحص المجلدات
    for (const dir of COMMON_DIRS) {
        const dirUrl = `${baseUrl}/${dir}`;
        const dirFile = await testFile(dirUrl);
        if (dirFile && !seen.has(dirFile.url)) {
            seen.add(dirFile.url);
            foundFiles.push(dirFile);
        }

        for (const sensitive of SENSITIVE_FILES) {
            const subUrl = `${dirUrl}/${sensitive}`;
            const subFile = await testFile(subUrl);
            if (subFile && !seen.has(subFile.url)) {
                seen.add(subFile.url);
                foundFiles.push(subFile);
            }
        }

        for (const ext of EXTENSIONS) {
            const commonNames = ['index', 'config', 'database', 'db', 'app', 'api'];
            for (const name of commonNames) {
                const fileUrl = `${dirUrl}/${name}${ext}`;
                const file = await testFile(fileUrl);
                if (file && !seen.has(file.url)) {
                    seen.add(file.url);
                    foundFiles.push(file);
                }
            }
        }
    }

    const sensitiveFiles = foundFiles.filter(f => f.sensitive);
    return {
        success: true,
        target: url,
        statistics: {
            totalFiles: foundFiles.length,
            sensitiveFiles: sensitiveFiles.length,
            directoriesScanned: COMMON_DIRS.length
        },
        sensitiveFiles: sensitiveFiles.slice(0, 50),
        allFiles: foundFiles.slice(0, 200)
    };
}

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Content-Type', 'application/json');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method === 'GET') {
        return res.status(200).json({
            name: 'Worm Hunter API',
            version: '2.0',
            description: 'API لاختراق المواقع وجلب الملفات - للبوتات',
            usage: {
                method: 'POST',
                body: { url: 'https://example.com' }
            },
            example: {
                command: 'curl -X POST https://your-site.vercel.app/api -H "Content-Type: application/json" -d \'{"url": "http://testphp.vulnweb.com"}\''
            }
        });
    }

    if (req.method === 'POST') {
        const { url } = req.body;
        if (!url) {
            return res.status(400).json({ success: false, error: 'الرجاء إدخال رابط الموقع' });
        }

        try {
            const result = await scanWebsite(url);
            return res.status(200).json(result);
        } catch (error) {
            return res.status(500).json({ success: false, error: error.message });
        }
    }

    return res.status(405).json({ error: 'Method not allowed' });
}