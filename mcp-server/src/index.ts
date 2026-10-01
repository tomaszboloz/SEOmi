#!/usr/bin/env node
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createSeoMiServer } from './server.js';

await createSeoMiServer().connect(new StdioServerTransport());
