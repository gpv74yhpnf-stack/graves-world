import { createWindowsDpapiEncryption } from './dpapi-encryption.mjs';

const encryption = createWindowsDpapiEncryption();
if (!await encryption.isAvailable()) throw new Error('Windows DPAPI is not available on this platform.');
const probe = 'Graves World credential protection verification';
const encrypted = await encryption.encrypt(probe);
if (Buffer.from(encrypted).toString('utf8') === probe) throw new Error('Credential probe was not encrypted.');
const restored = await encryption.decrypt(encrypted);
if (restored !== probe) throw new Error('Windows DPAPI round-trip did not preserve the probe.');
process.stdout.write('Windows DPAPI credential protection round-trip passed. No account sign-in or model request was made.\n');
