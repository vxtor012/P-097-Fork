import { mkdirSync } from 'node:fs';
import { createBridge } from './core.mjs';
import { adapter } from './zca-adapter.mjs';
import { createHttpServer } from './http-server.mjs';

const token = process.env.ZALO_BRIDGE_TOKEN ?? '';
const directory = process.env.ZALO_DATA_DIR ?? './data';
mkdirSync(directory,{ recursive:true,mode:0o700 });
const bridge = createBridge({ adapter, database:`${directory}/bridge.sqlite`, encryptionKey:process.env.ZALO_SESSION_KEY ?? '' });
void bridge.restore();
createHttpServer(bridge,token).listen(Number(process.env.PORT ?? 8010),process.env.ZALO_BRIDGE_HOST ?? '127.0.0.1');
