import { invokeTauriCommand } from './transport';

export async function getSecureValue(name: string): Promise<string> {
  const value = await invokeTauriCommand<string | null>('get_secret', { name });
  return value || '';
}

export async function setSecureValue(name: string, value: string): Promise<void> {
  await invokeTauriCommand('set_secret', { name, value });
}

