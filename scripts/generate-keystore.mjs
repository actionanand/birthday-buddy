#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { existsSync, rmSync } from 'node:fs';
import readline from 'node:readline/promises';

const outputFile = 'release-keystore.jks';
const keyFile = 'birthday-buddy-key.pem';
const certFile = 'birthday-buddy-cert.pem';
const alias = 'birthdaybuddy';
async function resolvePassword() {
  const index = process.argv.indexOf('--password');
  if (index >= 0) {
    const password = process.argv[index + 1];
    if (!password || password.startsWith('--')) throw new Error('--password requires a non-empty value.');
    return password;
  }
  const environmentPassword = process.env.KEYSTORE_PASSWORD || process.env.ANDROID_KEYSTORE_PASSWORD;
  if (environmentPassword) return environmentPassword;
  const input = readline.createInterface({ input: process.stdin, output: process.stdout });
  const password = await input.question('Enter keystore password: ');
  input.close();
  if (!password) throw new Error('Password cannot be empty.');
  return password;
}
const run = (command, args, environment = {}) =>
  execFileSync(command, args, { env: { ...process.env, ...environment }, stdio: 'pipe' });
const cleanup = () => {
  for (const file of [keyFile, certFile]) if (existsSync(file)) rmSync(file);
};
try {
  run('openssl', ['version']);
} catch {
  console.error('openssl was not found. Install openssl and try again.');
  process.exit(1);
}
try {
  const password = await resolvePassword();
  if (existsSync(outputFile)) rmSync(outputFile);
  run('openssl', ['genrsa', '-out', keyFile, '2048']);
  run('openssl', [
    'req',
    '-new',
    '-x509',
    '-key',
    keyFile,
    '-out',
    certFile,
    '-days',
    '36500',
    '-subj',
    '/CN=Birthday Buddy/OU=Mobile/O=Birthday Buddy/C=IN',
  ]);
  run(
    'openssl',
    [
      'pkcs12',
      '-export',
      '-in',
      certFile,
      '-inkey',
      keyFile,
      '-out',
      outputFile,
      '-name',
      alias,
      '-passout',
      'env:OPENSSL_PASS',
    ],
    { OPENSSL_PASS: password },
  );
  cleanup();
  console.log(`Created ${outputFile}`);
  console.log(`Alias: ${alias}`);
  console.log('Format: PKCS12');
  console.log(`Encode: base64 -w 0 ${outputFile} > keystore.b64.txt`);
} catch (error) {
  cleanup();
  console.error(error instanceof Error ? error.message : 'Keystore generation failed.');
  process.exit(1);
}
