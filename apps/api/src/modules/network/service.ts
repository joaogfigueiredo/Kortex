import os from 'node:os';
import type { NetworkInfo } from '@kortex/shared';

const WILDCARD = new Set(['0.0.0.0', '::', '']);
const LOOPBACK = new Set(['127.0.0.1', 'localhost', '::1']);

/** Endereços IPv4 da máquina visíveis na rede (Wi-Fi/Ethernet; sem loopback). */
export function lanAddresses(): string[] {
  return Object.values(os.networkInterfaces())
    .flat()
    .filter((i): i is os.NetworkInterfaceInfo => !!i && i.family === 'IPv4' && !i.internal)
    .map((i) => i.address)
    .sort();
}

/** Descreve onde o servidor está acessível, conforme o HOST em que escuta. */
export function networkInfo(host: string, port: number, pinEnabled: boolean): NetworkInfo {
  const exposed = !LOOPBACK.has(host);
  const hosts = WILDCARD.has(host) ? lanAddresses() : exposed ? [host] : [];
  return { host, port, exposed, pinEnabled, urls: hosts.map((h) => `http://${h}:${port}`) };
}
