import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Bot, Languages, MessagesSquare, Sparkles } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { LanguageSwitcher } from '@/layouts/Header';
import { ThemeMenu } from '@/layouts/ThemeMenu';

/**
 * Shared frame for the public auth pages (/<slug> and /admin/login).
 *
 * Wide screens get a brand panel on the left (what SharpTalk does, in three
 * lines) and the form on the right; narrow screens get the form alone. The
 * locale and theme switchers sit top-right so an operator can fix both before
 * signing in.
 *
 * With `tenantName` the header reads tenant-first: the tenant name at the
 * regular title size, the SharpTalk brand underneath 25% smaller. Without it
 * (admin login, error states) the brand is the title and `subtitle` shows below.
 */
export function AuthShell({
  tenantName,
  subtitle,
  children,
}: {
  tenantName?: string;
  subtitle?: string;
  children: ReactNode;
}) {
  const { t } = useTranslation('auth');
  const { t: tl } = useTranslation('landing');
  const points = [
    { icon: Bot, title: tl('featureAiTitle') },
    { icon: MessagesSquare, title: tl('featureChatTitle') },
    { icon: Languages, title: tl('featureI18nTitle') },
  ];

  return (
    <div className="flex min-h-screen bg-page">
      {/* Brand panel (lg+). */}
      {/* Pinned light: its white tints are glass on the gradient, not surfaces. */}
      <aside data-theme="light" className="relative hidden w-[44%] max-w-[640px] flex-col justify-between overflow-hidden bg-gradient-to-br from-primary-600 via-primary-700 to-violet-800 p-12 text-white lg:flex">
        <div
          className="pointer-events-none absolute -right-24 -top-24 h-96 w-96 rounded-full bg-white/10 blur-3xl"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute -bottom-32 -left-16 h-80 w-80 rounded-full bg-violet-400/20 blur-3xl"
          aria-hidden
        />
        <Link to="/" className="relative flex items-center gap-2.5 text-white" aria-label={t('backToHome')}>
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/15 ring-1 ring-inset ring-white/25">
            <Sparkles className="h-5 w-5" aria-hidden />
          </span>
          <span className="text-lg font-semibold tracking-tight">SharpTalk</span>
        </Link>
        <div className="relative">
          <h2 className="max-w-md text-3xl font-semibold leading-tight tracking-tight">{tl('heroTitle')}</h2>
          <ul className="mt-8 space-y-4">
            {points.map((p) => (
              <li key={p.title} className="flex items-center gap-3 text-[15px] text-white/90">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/10 ring-1 ring-inset ring-white/20">
                  <p.icon className="h-[18px] w-[18px]" aria-hidden />
                </span>
                {p.title}
              </li>
            ))}
          </ul>
        </div>
        <p className="relative text-xs text-white/60">{tl('footerCopy')}</p>
      </aside>

      {/* Form. */}
      <div className="flex min-h-screen flex-1 flex-col">
        <div className="flex justify-end gap-1 p-4">
          <ThemeMenu />
          <LanguageSwitcher />
        </div>
        <div className="flex flex-1 items-start justify-center px-4 pb-10 pt-[8vh]">
          <div className="w-full max-w-md">
            <div className="mb-7 flex flex-col items-center text-center">
              <Link
                to="/"
                className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-primary-500 to-violet-500 text-white shadow-md"
                aria-label={t('backToHome')}
              >
                <Sparkles className="h-6 w-6" aria-hidden />
              </Link>
              {tenantName ? (
                <>
                  <h1 className="text-2xl font-semibold tracking-tight text-gray-900">{tenantName}</h1>
                  {/* Brand sits under the tenant name, smaller. */}
                  <p className="mt-0.5 text-[15px] font-medium text-gray-500">SharpTalk</p>
                </>
              ) : (
                <>
                  <h1 className="text-2xl font-semibold tracking-tight text-gray-900">SharpTalk</h1>
                  {subtitle && <p className="mt-0.5 text-sm text-gray-500">{subtitle}</p>}
                </>
              )}
            </div>
            <div className="rounded-2xl border border-gray-200 bg-white p-7 shadow-card">{children}</div>
            <p className="mt-5 text-center">
              <Link to="/" className="text-xs text-gray-400 hover:text-gray-600">
                {t('backToHome')}
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
