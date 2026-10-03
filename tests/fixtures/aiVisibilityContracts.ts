export const connected = {
  connectionMethod: { openai: 'local_cli', claude: 'local_cli', gemini: 'local_cli' } as const,
  connectionStatus: { openai: 'connected', claude: 'connected', gemini: 'connected' } as const,
};
