import { useEffect } from 'react';
import { useWidgetStore, type TabKey } from '../store/widgetStore';
import {
  ensureSession,
  identify as identifyRequest,
  setSessionLanguage,
} from '../services/sessionService';
import { adoptSessionConsent, getParentOrigin, getShopDomain } from './useSession';
import { hostPresent, onHostMessage, postToHost } from '../lib/host-bridge';
import i18n, { LANG_STORAGE_KEY, SUPPORTED_LANGUAGES } from '../i18n/i18n';

const TABS: TabKey[] = ['chat', 'orders', 'notifications'];

type IdentifyUser = {
  userId: string;
  hash: string;
  name?: string;
  email?: string;
  phone?: string;
  attributes?: Record<string, string>;
};

/**
 * Host-application commands (PLN-260819 S3).
 *
 * The public `ShopTalk.open()/identify()/…` methods live in the loader, which
 * cannot reach into the widget's state — it forwards them here as postMessage.
 * This hook is the receiving half.
 *
 * Trust rules are the same as the identity handshake: only our embedder frame,
 * only over a secure origin. `identify` carries a hash the API verifies against
 * the tenant secret, so a hostile page can send one but cannot make it verify.
 */
export function useEmbedCommands(): void {
  useEffect(() => {
    if (!hostPresent()) return; // standalone — no host to take commands from

    // A native host sends identify/locale the moment `ivy:ready` fires, which
    // routinely beats the session ensure round-trip. Both used to be silently
    // dropped when no token existed yet (found on-device, FIX-260828) — so the
    // last of each is parked here and replayed as soon as the token lands.
    let pendingIdentify: IdentifyUser | null = null;
    let pendingSessionLocale: string | null = null;
    // The page's signed identity, kept to ask again later (BUG-044): staff may
    // answer in another of this shopper's chats, and the server then names that
    // one as current. `identifying` keeps the asks from overlapping.
    let lastUser: IdentifyUser | null = null;
    let identifying = false;

    async function runIdentify(token: string, user: IdentifyUser) {
      const store = useWidgetStore.getState();
      identifying = true;
      try {
        const res = await identifyRequest(token, user);
        lastUser = user;
        // A platform customer (a theme-signed Shopify id) is handed their own
        // recent session, not this page's new one — that is where their chat
        // is (BUG-037). Every query is keyed on the token, so adopting it brings
        // the thread, the orders and the notifications with it.
        const resumed = !!res.sessionToken && res.sessionToken !== token;
        if (resumed) store.setSessionToken(res.sessionToken);
        store.setAuthenticated(res.authenticated);
        // The host's name for its user, signed or claimed (PLN-261023): a
        // claimed session never becomes `authenticated`, so useSessionProfile
        // would not fetch it — take it from the identify answer itself.
        if (res.customerName) store.setCustomerName(res.customerName);
        if (res.customerEmail) store.setCustomerEmail(res.customerEmail);
        // Earlier conversations of this account (PLN-261022 stage 2).
        store.setThreadAvailable(!!res.threadAvailable);
        // A tenant whose host terms cover AI support records a signed user as
        // consented on identify (PLN-261015 D9) — drop the banner right away.
        // A resumed session carries its OWN consent, whatever this page's
        // short-lived session said: take it as it is, granted or not.
        if (res.consentState === 'granted' || resumed) adoptSessionConsent(res);
        postToHost({ type: 'ivy:event', event: 'identified', ok: true });
      } catch {
        // A rejected signature leaves the visitor a guest: they can still ask
        // a question, which is the part that must never depend on identity.
        // An expired one (24 h) will not pass later either: stop asking until
        // the next page brings a fresh signature.
        lastUser = null;
        postToHost({ type: 'ivy:event', event: 'identified', ok: false });
      } finally {
        identifying = false;
      }
    }

    const stopTokenWatch = useWidgetStore.subscribe((state, prev) => {
      const token = state.sessionToken;
      if (!token || token === prev.sessionToken) return;
      if (pendingSessionLocale) {
        setSessionLanguage(token, pendingSessionLocale.toUpperCase()).catch(() => {});
        pendingSessionLocale = null;
      }
      if (pendingIdentify) {
        const user = pendingIdentify;
        pendingIdentify = null;
        void runIdentify(token, user);
      }
    });

    // Ask again where the shopper's chat is (BUG-044) when they open the panel
    // or the Chat tab, or when a staff reply arrives (reidentifyNonce): staff
    // may have answered in another of their chats, which the server now names
    // as current. Its token is adopted as on page load (runIdentify).
    const stopReidentifyWatch = useWidgetStore.subscribe((state, prev) => {
      const opened = state.panelOpen && !prev.panelOpen;
      const toChat = state.panelOpen && state.activeTab === 'chat' && prev.activeTab !== 'chat';
      const nudged = state.reidentifyNonce !== prev.reidentifyNonce;
      if (!opened && !toChat && !nudged) return;
      if (!lastUser || identifying || !state.sessionToken) return;
      void runIdentify(state.sessionToken, lastUser);
    });

    async function onMessage(raw: Record<string, unknown>) {
      const d = raw as {
        type?: string;
        action?: string;
        tab?: string | null;
        locale?: string;
        /** 'doc' = the loader saw the page's <html lang> change (PLN-261023 D3). */
        source?: string;
        user?: IdentifyUser;
      };
      const store = useWidgetStore.getState();

      if (d.type === 'ivy:command') {
        switch (d.action) {
          case 'open':
            if (d.tab && TABS.includes(d.tab as TabKey)) store.setActiveTab(d.tab as TabKey);
            store.setPanelOpen(true);
            return;
          case 'close':
            store.setPanelOpen(false);
            return;
          case 'toggle':
            store.setPanelOpen(!store.panelOpen);
            return;
          case 'trigger-missing':
            // The storefront has no element to open the widget with, so draw the
            // floating launcher even though the tenant chose trigger mode.
            store.setTriggerUnavailable(true);
            return;
          case 'locale': {
            // Full language switch, exactly what the in-widget switcher does —
            // setLanguage alone changed the AI reply language but left the UI
            // in the auto-detected one (found on-device, FIX-260828). The host's
            // choice is persisted like a manual pick so the session-ensure sync
            // does not immediately override it with the server-side language.
            // The page's own <html lang> changing is a choice only when the
            // tenant hid the language button; otherwise the shopper's pick
            // stays theirs (PLN-261023-Widget-Header-Buttons D3).
            if (d.source === 'doc' && store.headerControls.language) return;
            const code = (d.locale || '').toLowerCase();
            if (!(SUPPORTED_LANGUAGES as readonly string[]).includes(code)) return;
            // A host asking for a language the tenant does not offer is ignored
            // the same way the server would refuse it (PLN-261019 D3/D5).
            if (!useWidgetStore.getState().languages.includes(code)) return;
            void i18n.changeLanguage(code);
            store.setLanguage(code);
            document.documentElement.lang = code;
            try {
              localStorage.setItem(LANG_STORAGE_KEY, code);
            } catch {
              /* ignore storage failures */
            }
            const token = useWidgetStore.getState().sessionToken;
            if (token) setSessionLanguage(token, code.toUpperCase()).catch(() => {});
            else pendingSessionLocale = code;
            return;
          }
          case 'logout': {
            // Clearing the token is not enough: useEnsureSession runs once on
            // mount, so nothing would re-open a session and the widget would sit
            // there unable to send anything. Open the guest session here.
            store.setSessionToken(null);
            store.setAuthenticated(false);
            store.setCustomerName(null);
            store.setCustomerEmail(null);
            const fresh = await ensureSession(
              null,
              useWidgetStore.getState().language,
              getShopDomain(),
              getParentOrigin(),
            ).catch(() => null);
            // Tenant config (theme, tabs, copy) does not change on logout, so it
            // is deliberately not re-applied — only the identity is reset.
            if (fresh?.sessionToken) store.setSessionToken(fresh.sessionToken);
            return;
          }
          default:
            return;
        }
      }

      if (d.type === 'ivy:identify' && d.user?.userId && d.user?.hash) {
        const token = useWidgetStore.getState().sessionToken;
        // identify binds an EXISTING session. Before one exists the request is
        // parked, not dropped — the token watcher above replays it.
        if (!token) {
          pendingIdentify = d.user;
          return;
        }
        await runIdentify(token, d.user);
      }
    }

    const stopMessages = onHostMessage((message) => {
      void onMessage(message);
    });
    return () => {
      stopMessages();
      stopTokenWatch();
      stopReidentifyWatch();
    };
  }, []);
}
