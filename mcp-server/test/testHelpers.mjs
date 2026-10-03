import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createSeoMiServer } from '../dist/server.js';

export const withClient = async (dependencies, run) => {
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const server = createSeoMiServer(dependencies);
  const client = new Client({ name: 'contract-fixture', version: '1.0.0' });
  try {
    await server.connect(serverTransport);
    await client.connect(clientTransport);
    await run(client);
  } finally {
    await client.close();
    await server.close();
  }
};
