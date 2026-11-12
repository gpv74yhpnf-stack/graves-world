import { spawn } from 'node:child_process';

const SCRIPT = [
  "$ErrorActionPreference = 'Stop'",
  "Add-Type -AssemblyName System.Security",
  "$payload = [Console]::In.ReadToEnd() | ConvertFrom-Json",
  "$bytes = [Convert]::FromBase64String([string]$payload.data)",
  "$entropy = [Text.Encoding]::UTF8.GetBytes('GravesWorld.ChatGPTCredentials.v1')",
  "if ($payload.operation -eq 'protect') {",
  "  $result = [Security.Cryptography.ProtectedData]::Protect($bytes, $entropy, [Security.Cryptography.DataProtectionScope]::CurrentUser)",
  "} elseif ($payload.operation -eq 'unprotect') {",
  "  $result = [Security.Cryptography.ProtectedData]::Unprotect($bytes, $entropy, [Security.Cryptography.DataProtectionScope]::CurrentUser)",
  "} else {",
  "  throw 'Unsupported DPAPI operation.'",
  "}",
  "[Console]::Out.Write([Convert]::ToBase64String($result))",
].join('\n');

function invokeDpapi(operation, input) {
  if (process.platform !== 'win32') return Promise.reject(new Error('Windows DPAPI is only available on Windows.'));
  return new Promise((resolve, reject) => {
    const child = spawn('powershell.exe', [
      '-NoLogo', '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', SCRIPT,
    ], { windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', chunk => { stdout += chunk; if (stdout.length > 2_000_000) child.kill(); });
    child.stderr.on('data', chunk => { stderr += chunk; if (stderr.length > 16_000) child.kill(); });
    child.once('error', reject);
    child.once('close', code => {
      const encoded = stdout.trim();
      if (code !== 0) return reject(new Error('Windows credential protection failed: ' + (stderr.trim().slice(-1200) || 'PowerShell exited with code ' + code)));
      if (!/^[A-Za-z0-9+/]+={0,2}$/.test(encoded)) return reject(new Error('Windows credential protection returned invalid data.'));
      resolve(Buffer.from(encoded, 'base64'));
    });
    child.stdin.end(JSON.stringify({ operation, data: Buffer.from(input).toString('base64') }), 'utf8');
  });
}

export function createWindowsDpapiEncryption() {
  return {
    id: 'windows-dpapi-current-user-v1',
    isAvailable: async () => process.platform === 'win32',
    encrypt: async plaintext => invokeDpapi('protect', Buffer.from(plaintext, 'utf8')),
    decrypt: async ciphertext => (await invokeDpapi('unprotect', Buffer.from(ciphertext))).toString('utf8'),
  };
}
