import { useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router';
import clsx from 'clsx';
import { LayoutGrid } from 'lucide-react';
import { NAV } from '../../app/nav';
import { Modal } from '../ui';
import { Logo } from './Logo';
import { ThemeQuickToggle, ThemeSwitch } from './ThemeSwitch';

const isActive = (to: string, pathname: string) =>
  to === '/' ? pathname === '/' : pathname.startsWith(to);

export function AppShell() {
  const { pathname } = useLocation();
  const [moreOpen, setMoreOpen] = useState(false);
  const current = NAV.find((n) => isActive(n.to, pathname));
  const primary = NAV.filter((n) => n.mobilePrimary);
  const secondary = NAV.filter((n) => !n.mobilePrimary);
  const secondaryActive = secondary.some((n) => isActive(n.to, pathname));

  return (
    <div className="min-h-dvh">
      {/* ---------- Sidebar (desktop) ---------- */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-68 flex-col p-5 md:flex">
        <div className="flex h-full flex-col rounded-3xl bg-bg p-4 shadow-neu">
          <Logo className="px-2 pt-1 pb-6" />
          <nav aria-label="Principal" className="flex-1 space-y-1.5 overflow-y-auto">
            {NAV.map(({ to, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                end={to === '/'}
                className={({ isActive: a }) =>
                  clsx(
                    'group relative flex items-center gap-3 rounded-2xl px-3.5 py-2.5 text-sm font-medium transition-all duration-200',
                    a ? 'text-accent-ink shadow-neu-inset-sm' : 'text-muted hover:text-fg',
                  )
                }
              >
                {({ isActive: a }) => (
                  <>
                    {a && (
                      <span
                        aria-hidden
                        className="absolute top-2.5 bottom-2.5 left-0 w-1 rounded-full bg-accent shadow-glow"
                      />
                    )}
                    <Icon className="size-5" />
                    {label}
                  </>
                )}
              </NavLink>
            ))}
          </nav>
          <ThemeSwitch compact className="mt-4" />
        </div>
      </aside>

      {/* ---------- Header (mobile) ---------- */}
      <header className="sticky top-0 z-20 flex items-center justify-between bg-bg/85 px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-3 backdrop-blur-md md:hidden">
        <Logo compact />
        <h1 className="text-base font-semibold">{current?.label ?? 'Kortex'}</h1>
        <ThemeQuickToggle />
      </header>

      {/* ---------- Conteúdo ---------- */}
      <main className="px-4 pt-2 pb-32 md:pt-8 md:pr-8 md:pb-10 md:pl-76">
        <div className="mx-auto max-w-6xl">
          <Outlet />
        </div>
      </main>

      {/* ---------- Barra inferior flutuante (mobile) ---------- */}
      <nav
        aria-label="Principal"
        className="fixed inset-x-3 bottom-0 z-30 mb-[max(0.75rem,env(safe-area-inset-bottom))] md:hidden"
      >
        <ul className="flex items-center justify-around rounded-3xl bg-bg/95 p-2 shadow-neu backdrop-blur-md">
          {primary.map(({ to, label, icon: Icon }) => (
            <li key={to} className="flex-1">
              <NavLink to={to} end={to === '/'} className="flex flex-col items-center gap-1 py-1">
                {({ isActive: a }) => (
                  <>
                    <span
                      className={clsx(
                        'grid h-8 w-12 place-items-center rounded-xl transition-all duration-200',
                        a ? 'bg-accent text-on-accent shadow-glow' : 'text-muted',
                      )}
                    >
                      <Icon className="size-5" />
                    </span>
                    <span
                      className={clsx(
                        'text-[11px] font-medium',
                        a ? 'text-accent-ink' : 'text-muted',
                      )}
                    >
                      {label}
                    </span>
                  </>
                )}
              </NavLink>
            </li>
          ))}
          <li className="flex-1">
            <button
              type="button"
              onClick={() => setMoreOpen(true)}
              className="flex w-full flex-col items-center gap-1 py-1"
            >
              <span
                className={clsx(
                  'grid h-8 w-12 place-items-center rounded-xl transition-all',
                  secondaryActive ? 'bg-accent text-on-accent shadow-glow' : 'text-muted',
                )}
              >
                <LayoutGrid className="size-5" />
              </span>
              <span
                className={clsx(
                  'text-[11px] font-medium',
                  secondaryActive ? 'text-accent-ink' : 'text-muted',
                )}
              >
                Mais
              </span>
            </button>
          </li>
        </ul>
      </nav>

      <Modal open={moreOpen} onClose={() => setMoreOpen(false)} title="Módulos">
        <div className="grid grid-cols-3 gap-4 pb-2">
          {secondary.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              onClick={() => setMoreOpen(false)}
              className={({ isActive: a }) =>
                clsx(
                  'flex flex-col items-center gap-2 rounded-2xl bg-bg p-4 text-xs font-medium transition-all',
                  a ? 'text-accent-ink shadow-neu-inset-sm' : 'shadow-neu-sm',
                )
              }
            >
              <Icon className="size-6" />
              {label}
            </NavLink>
          ))}
        </div>
        <ThemeSwitch className="mt-4" />
      </Modal>
    </div>
  );
}
