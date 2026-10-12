import { invokeTauriCommand } from './transport';

/** A non-secret value used by legacy store contracts to represent presence. */
export const STORED_SECRET_MARKER = '__seomi_secret_present__';

export const isStoredSecretMarker = (value: string): boolean => value === STORED_SECRET_MARKER;

export async function hasSecureValue(name: string): Promise<boolean> {
  return invokeTauriCommand<boolean>('has_secret', { name });
}

/** @deprecated Use hasSecureValue. It never returns credential material. */
export async function getSecureValue(name: string): Promise<string> {
  return (await hasSecureValue(name)) ? STORED_SECRET_MARKER : '';
}

export async function setSecureValue(name: string, value: string): Promise<void> {
  await invokeTauriCommand('set_secret', { name, value });
}

