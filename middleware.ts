/**
 * Vercel Edge Middleware - Block Bot Scans
 * 
 * Blocks common exploit paths, PHP files, WordPress paths, and other malicious requests
 * This prevents bot scans from cluttering your logs
 * 
 * For Vite/React apps on Vercel
 */

import type { Request } from '@vercel/edge'

// Patterns to block (common exploit paths)
const BLOCKED_PATTERNS = [
  // PHP files and backdoors
  /\.php$/i,
  /\.php\d*$/i,
  /\/[a-z0-9]+\.php$/i,
  /\/wp-.*\.php$/i,
  /\/xmlrpc\.php$/i,
  /\/shell\.php$/i,
  /\/cmd\.php$/i,
  /\/eval\.php$/i,
  /\/c99\.php$/i,
  /\/r57\.php$/i,
  /\/wso\.php$/i,
  
  // WordPress paths
  /\/wp-admin/i,
  /\/wp-login\.php/i,
  /\/wp-content/i,
  /\/wp-includes/i,
  /\/wp-config\.php/i,
  /\/wp-load\.php/i,
  /\/wp-cron\.php/i,
  /\/wp-mail\.php/i,
  /\/wp-trackback\.php/i,
  /\/wp-comments-post\.php/i,
  
  // Common exploit paths
  /\/admin/i,
  /\/administrator/i,
  /\/phpmyadmin/i,
  /\/phpMyAdmin/i,
  /\/mysql/i,
  /\/database/i,
  /\/db/i,
  /\/backup/i,
  /\/backups/i,
  /\/old/i,
  /\/test/i,
  /\/tmp/i,
  /\/temp/i,
  
  // File manager exploits
  /\/tinyfilemanager/i,
  /\/filemanager/i,
  /\/file\.php/i,
  /\/upload\.php/i,
  /\/uploads/i,
  /\/vendor/i,
  
  // Git/config files
  /\/\.git/i,
  /\/\.env/i,
  /\/config\.php/i,
  /\/configuration\.php/i,
  
  // Random suspicious files
  /\/1\.php/i,
  /\/moon\.php/i,
  /\/ds\.php/i,
  /\/past\.php/i,
  /\/function\.php/i,
  /\/index\.php/i,
  /\/info\.php/i,
  /\/phpinfo\.php/i,
  /\/test\.php/i,
  
  // Joomla/Drupal paths
  /\/administrator/i,
  /\/sites\/default/i,
  
  // Laravel paths (if not using Laravel)
  /\/storage/i,
  /\/bootstrap/i,
  
  // Other common exploits
  /\/cgi-bin/i,
  /\/\.htaccess/i,
  /\/\.htpasswd/i,
  /\/webdav/i,
]

// User agents to block (known bot scanners)
const BLOCKED_USER_AGENTS = [
  /sqlmap/i,
  /nikto/i,
  /masscan/i,
  /nmap/i,
  /nessus/i,
  /acunetix/i,
  /netsparker/i,
  /w3af/i,
  /dirb/i,
  /gobuster/i,
  /wfuzz/i,
]

export default function middleware(request: Request) {
  const url = new URL(request.url)
  const pathname = url.pathname
  const userAgent = request.headers.get('user-agent') || ''

  // Block by path pattern
  for (const pattern of BLOCKED_PATTERNS) {
    if (pattern.test(pathname)) {
      console.log(`[Firewall] Blocked: ${pathname} (pattern match)`)
      return new Response(null, { status: 403 })
    }
  }

  // Block by user agent
  for (const pattern of BLOCKED_USER_AGENTS) {
    if (pattern.test(userAgent)) {
      console.log(`[Firewall] Blocked: ${userAgent} (user agent match)`)
      return new Response(null, { status: 403 })
    }
  }

  // Allow all other requests (return undefined to continue)
  return
}

// Export config for Vercel Edge
export const config = {
  runtime: 'edge',
  matcher: [
    /*
     * Match all request paths except:
     * - api routes (we want to handle those separately)
     * - static files (images, CSS, JS, etc.)
     */
    '/((?!api|.*\\..*|_next).*)',
  ],
}

