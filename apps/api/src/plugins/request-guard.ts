import net from 'node:net';
import os from 'node:os';
import type { IncomingHttpHeaders } from 'node:http';

/**
 * Defesas contra páginas maliciosas que tentam falar com o Kortex pelo navegador do usuário:
 *
 * 1. DNS rebinding — um site faz o próprio domínio apontar para 127.0.0.1 e o navegador passa a
 *    tratar o seu servidor local como "do mesmo site". O cabeçalho Host denuncia: só aceitamos
 *    nomes que o usuário realmente usaria (localhost, IPs, Tailscale, rede local, o nome da
 *    máquina e o que ele liberar em KORTEX_ALLOWED_HOSTS).
 * 2. CSRF — outro site dispara POST/PUT/DELETE usando a sessão do usuário. O navegador informa
 *    `Sec-Fetch-Site` (não pode ser forjado por uma página) e só aceitamos "same-origin".
 */

/** Nome do host sem porta: "[::1]:3333" → "::1", "Localhost:80" → "localhost". */
export function hostnameOf(hostHeader: string | undefined): string {
  if (!hostHeader) return '';
  const v6 = /^\[([^\]]+)\](?::\d+)?$/.exec(hostHeader);
  return (v6 ? v6[1]! : hostHeader.replace(/:\d+$/, '')).toLowerCase();
}

/** `extra` aceita nomes exatos ("meu-pc.exemplo.com") e sufixos ("*.exemplo.com"). */
export function hostAllowed(
  hostHeader: string | undefined,
  extra: readonly string[] = [],
  machine = os.hostname().toLowerCase(),
): boolean {
  const h = hostnameOf(hostHeader);
  if (!h) return false;
  if (net.isIP(h)) return true; // quem digita um IP sabe o que está fazendo; rebinding precisa de um nome
  if (h === 'localhost' || h.endsWith('.localhost')) return true;
  if (h.endsWith('.ts.net') || h.endsWith('.local')) return true; // Tailscale MagicDNS e mDNS
  if (h === machine) return true;
  return extra.some((e) => (e.startsWith('*.') ? h.endsWith(e.slice(1)) : h === e));
}

/**
 * A requisição veio de outro site? Só vale para métodos que alteram dados.
 * Sem `Sec-Fetch-Site` (navegadores antigos), compara Origin com Host / X-Forwarded-Host.
 * Clientes que não são navegadores (curl, scripts) não mandam Origin e passam.
 */
export function isCrossSite(headers: IncomingHttpHeaders): boolean {
  const site = headers['sec-fetch-site'];
  if (typeof site === 'string') return site !== 'same-origin' && site !== 'none';
  const origin = headers.origin;
  if (!origin) return false;
  let originHost: string;
  try {
    originHost = new URL(origin).host;
  } catch {
    return true; // "null" e valores inválidos
  }
  const forwarded = headers['x-forwarded-host'];
  const seen = [headers.host, typeof forwarded === 'string' ? forwarded : undefined];
  return !seen.includes(originHost);
}

/** Lê "a.com, *.b.com" (variável de ambiente) em uma lista limpa. */
export const parseHostList = (raw: string | undefined) =>
  (raw ?? '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
