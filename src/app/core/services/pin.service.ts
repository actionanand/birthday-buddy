import { Service, inject, signal } from '@angular/core';
import { Capacitor, registerPlugin } from '@capacitor/core';
import { RepositoryProviderService } from './repository-provider.service';

interface PinRecord {
  id: 'security-pin';
  salt: string;
  verifier: string;
  iterations: number;
}
interface SecureSecretsPlugin {
  set(options: { key: string; value: string }): Promise<void>;
  get(options: { key: string }): Promise<{ value?: string }>;
  remove(options: { key: string }): Promise<void>;
  enableBiometric(options: { secret: string }): Promise<void>;
  authenticateBiometric(): Promise<{ secret?: string }>;
  disableBiometric(): Promise<void>;
  biometricStatus(): Promise<{ enabled: boolean }>;
}
const SecureSecrets = registerPlugin<SecureSecretsPlugin>('BirthdayBuddySecurity');

@Service()
export class PinService {
  private readonly repositories = inject(RepositoryProviderService);
  readonly configured = signal(false);
  readonly unlocked = signal(true);
  readonly biometricEnabled = signal(false);
  private readonly iterations = 210_000;

  async initialize(): Promise<void> {
    const record = await this.readRecord();
    this.configured.set(Boolean(record));
    this.unlocked.set(!record);
    if (record && Capacitor.isNativePlatform())
      this.biometricEnabled.set((await SecureSecrets.biometricStatus()).enabled);
  }

  async setPin(pin: string): Promise<void> {
    if (!/^\d{4,8}$/.test(pin)) throw new Error('PIN must contain 4 to 8 digits.');
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const verifier = await this.hash(pin, salt, this.iterations);
    const record: PinRecord = { id: 'security-pin', salt: this.toBase64(salt), verifier, iterations: this.iterations };
    await this.writeRecord(record);
    this.configured.set(true);
    this.unlocked.set(true);
  }

  async verify(pin: string): Promise<boolean> {
    const record = await this.readRecord();
    if (!record) return true;
    const candidate = await this.hash(pin, this.fromBase64(record.salt), record.iterations);
    const valid = this.constantTimeEqual(candidate, record.verifier);
    if (valid) this.unlocked.set(true);
    return valid;
  }

  async removePin(pin: string): Promise<boolean> {
    if (!(await this.verify(pin))) return false;
    if (Capacitor.isNativePlatform()) await SecureSecrets.remove({ key: 'pin-record' });
    else await this.repositories.adapter.delete('app_settings', 'security-pin');
    await this.disableBiometric();
    this.configured.set(false);
    this.unlocked.set(true);
    return true;
  }

  lock(): void {
    if (this.configured()) this.unlocked.set(false);
  }

  async enableBiometric(pin: string): Promise<void> {
    if (!Capacitor.isNativePlatform() || !(await this.verify(pin)))
      throw new Error('Confirm the configured PIN first.');
    await SecureSecrets.enableBiometric({ secret: pin });
    this.biometricEnabled.set(true);
  }

  async unlockWithBiometric(): Promise<boolean> {
    const result = await SecureSecrets.authenticateBiometric();
    return result.secret ? this.verify(result.secret) : false;
  }

  async disableBiometric(): Promise<void> {
    if (Capacitor.isNativePlatform()) await SecureSecrets.disableBiometric();
    this.biometricEnabled.set(false);
  }

  private async readRecord(): Promise<PinRecord | undefined> {
    if (Capacitor.isNativePlatform()) {
      const result = await SecureSecrets.get({ key: 'pin-record' });
      return result.value ? (JSON.parse(result.value) as PinRecord) : undefined;
    }
    return this.repositories.adapter.get<PinRecord>('app_settings', 'security-pin');
  }

  private async writeRecord(record: PinRecord): Promise<void> {
    if (Capacitor.isNativePlatform()) await SecureSecrets.set({ key: 'pin-record', value: JSON.stringify(record) });
    else await this.repositories.adapter.put('app_settings', record);
  }

  private async hash(pin: string, salt: Uint8Array<ArrayBuffer>, iterations: number): Promise<string> {
    const material = await crypto.subtle.importKey('raw', new TextEncoder().encode(pin), 'PBKDF2', false, [
      'deriveBits',
    ]);
    const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations }, material, 256);
    return this.toBase64(new Uint8Array(bits));
  }
  private constantTimeEqual(left: string, right: string): boolean {
    if (left.length !== right.length) return false;
    let difference = 0;
    for (let index = 0; index < left.length; index += 1) difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
    return difference === 0;
  }
  private toBase64(value: Uint8Array): string {
    return btoa(String.fromCharCode(...value));
  }
  private fromBase64(value: string): Uint8Array<ArrayBuffer> {
    const decoded = atob(value);
    const bytes = new Uint8Array(decoded.length);
    for (let index = 0; index < decoded.length; index += 1) bytes[index] = decoded.charCodeAt(index);
    return bytes;
  }
}
