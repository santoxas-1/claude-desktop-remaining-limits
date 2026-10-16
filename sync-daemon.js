/**
 * OpenCodex Quota Sync Daemon for Claude Desktop
 * Непрерывное фоновое обновление локального limits-cache.json для Claude Desktop
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

const userHome = process.env.USERPROFILE || process.env.HOME || '';
const localAppData = process.env.LOCALAPPDATA || (userHome ? path.join(userHome, 'AppData', 'Local') : '');

const candidates = [
  path.join(localAppData, 'Programs', 'Claude', 'resources', 'ion-dist'),
  path.join(localAppData, 'Claude', 'resources', 'ion-dist'),
  path.join(process.env.ProgramFiles || 'C:\\Program Files', 'Claude', 'resources', 'ion-dist'),
  '/Applications/Claude.app/Contents/Resources/ion-dist',
  path.join(userHome, '.local', 'share', 'Claude', 'resources', 'ion-dist')
];

let ionDir = candidates.find(dir => fs.existsSync(dir)) || candidates[0];
const cacheJsonPath = path.join(ionDir, 'limits-cache.json');
const tokenFile = path.join(userHome, '.opencodex', 'admin-api-token');

function getAdminToken() {
  try {
    if (fs.existsSync(tokenFile)) {
      return fs.readFileSync(tokenFile, 'utf8').trim();
    }
  } catch (e) {}
  return '';
}

let lastWrittenJson = '';

function syncQuotas() {
  const token = getAdminToken();
  if (!token) return;

  const req = http.request({
    hostname: '127.0.0.1',
    port: 10100,
    path: '/api/oauth/accounts?provider=google-antigravity&quota=1&_t=' + Date.now(),
    method: 'GET',
    headers: {
      'Authorization': 'Bearer ' + token,
      'Accept': 'application/json'
    },
    timeout: 2500
  }, (res) => {
    let body = '';
    res.on('data', chunk => body += chunk);
    res.on('end', () => {
      try {
        if (res.statusCode !== 200) return;
        const json = JSON.parse(body);

        if (Array.isArray(json.accounts) && json.accounts.length > 0) {
          const activeId = json.activeAccountId;
          const activeAcc = (activeId ? json.accounts.find(a => a.id === activeId) : null) ||
                            json.accounts.find(a => a.isActive === true || a.status === 'active') ||
                            json.accounts[0];

          if (activeAcc && activeAcc.quota && Array.isArray(activeAcc.quota.customWindows)) {
            const gemWin = activeAcc.quota.customWindows.find(w => w.label === 'Gem');
            const gemWeek = activeAcc.quota.customWindows.find(w => w.label === 'Gem (Weekly)' || /gem.*week/i.test(w.label));

            const used5h = gemWin && typeof gemWin.percent === 'number' ? gemWin.percent : 0;
            const used7d = gemWeek && typeof gemWeek.percent === 'number' ? gemWeek.percent : 0;

            const rem5h = Math.max(0, 100 - Math.round(used5h));
            const rem7d = gemWeek ? Math.max(0, 100 - Math.round(used7d)) : 100;

            const r5h = gemWin && gemWin.resetAt ? gemWin.resetAt : 0;
            const r7d = gemWeek && gemWeek.resetAt ? gemWeek.resetAt : 0;

            const payload = {
              activeAccountId: activeAcc.id,
              rem5h: rem5h,
              rem7d: rem7d,
              resets5h: r5h,
              resets7d: r7d,
              updatedAt: Date.now()
            };

            const payloadStr = JSON.stringify(payload, null, 2);
            if (payloadStr !== lastWrittenJson) {
              lastWrittenJson = payloadStr;
              fs.writeFileSync(cacheJsonPath, payloadStr, 'utf8');
            }
          }
        }
      } catch (err) {}
    });
  });

  req.on('error', () => {});
  req.on('timeout', () => req.destroy());
  req.end();
}

syncQuotas();
setInterval(syncQuotas, 2000);
