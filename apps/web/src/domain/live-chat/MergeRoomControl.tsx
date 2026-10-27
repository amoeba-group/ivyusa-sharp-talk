import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronDown, Combine, PlusCircle } from 'lucide-react';
import { Badge } from '@/components/Badge';
import { Button } from '@/components/Button';
import { Modal } from '@/components/Modal';
import { Input } from '@/components/Field';
import { ChannelBadge } from './ChannelBadge';
import { useMergeCandidates, useMergedRoomActions, useMergedRoomDetail, useRoomOptions } from './live-chat.hooks';
import type { MergedRoomView } from './live-chat.service';

/**
 * Same-customer merged room in the conversation header
 * (PLN-261023-LiveChat-Merge-Same-Customer-Sessions).
 *
 * Not in a room: [Merge same customer (N)] when this conversation's customer
 * has other sessions — opens the merge dialog (wireframe ①).
 * In a room: [Merged N ▾] — the room's sessions, take one out, auto-join
 * on/off, dissolve, and merge the customer's remaining sessions (wireframe ②).
 * Nothing renders for a guest: merging is by confirmed identity only (D1).
 */
export function MergeRoomControl({
  conversationId,
  room,
  onOpenConversation,
}: {
  conversationId: string;
  room: MergedRoomView | null | undefined;
  onOpenConversation: (conversationId: string) => void;
}) {
  const { t, i18n } = useTranslation('livechat');
  const { data } = useMergeCandidates(conversationId);
  const actions = useMergedRoomActions();
  const [dialog, setDialog] = useState<'merge' | 'room' | 'join' | null>(null);
  // Manual add (PLN-261027 Merge-Add D4): the number typed in, and the one
  // waiting for the operator's "add anyway" after the same-person check said no.
  const [addNumber, setAddNumber] = useState('');
  const [confirmAdd, setConfirmAdd] = useState<{ roomId: string; conversationId: string } | null>(null);
  const [joinRoom, setJoinRoom] = useState<string | null>(null);
  const [joinTarget, setJoinTarget] = useState<string | null>(null);
  const [joinNumber, setJoinNumber] = useState('');
  const detail = useMergedRoomDetail(room?.id ?? null, dialog === 'room');
  const options = useRoomOptions(conversationId, dialog === 'join', joinTarget);
  useEffect(() => {
    setAddNumber('');
    setConfirmAdd(null);
    setJoinRoom(null);
    setJoinTarget(null);
    setJoinNumber('');
  }, [dialog, conversationId]);
  useEffect(() => {
    if (options.data?.length && !joinRoom) setJoinRoom(options.data[0].id);
  }, [options.data, joinRoom]);

  /** Add a session by conversation number; a non-match asks first (E5156). */
  const addSession = (roomId: string, target: string, force = false, done?: () => void) =>
    actions.addSession.mutate(
      { roomId, conversationId: target, force },
      {
        onSuccess: () => {
          setConfirmAdd(null);
          setAddNumber('');
          done?.();
        },
        onError: (e: Error & { code?: string }) => {
          if (e.code === 'E5156') setConfirmAdd({ roomId, conversationId: target });
        },
      },
    );
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [autoJoin, setAutoJoin] = useState(true);

  // Sessions the dialog can still add: not this one, not already merged, not another customer's room.
  const addable = useMemo(
    () => (data?.sessions ?? []).filter((s) => !s.current && !s.inRoom && !s.otherRoom),
    [data],
  );

  // Fresh selection every time the dialog opens: everything addable except
  // sessions an operator took out before (D6) — bringing those back is a choice.
  useEffect(() => {
    if (dialog !== 'merge') return;
    setChecked(new Set(addable.filter((s) => !s.excluded).map((s) => s.sessionId)));
    setAutoJoin(room ? room.autoJoin : true);
  }, [dialog, addable, room]);

  const when = (iso: string) =>
    new Date(iso).toLocaleString(i18n.language, { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  const matchLabel = (how: 'customer' | 'email' | 'claimed' | 'company') => t(`merge.matchedBy.${how}`);


  // Detail rows (address, flags) once loaded; the header's view until then.
  const roomRows: Array<MergedRoomView['sessions'][number] & Partial<{ ip: string | null; ipDiffers: boolean; forced: boolean }>> =
    detail.data?.sessions ?? room?.sessions ?? [];

  const submit = () =>
    actions.merge.mutate(
      { conversationId, sessionIds: [...checked], autoJoin },
      { onSuccess: () => setDialog(null) },
    );

  return (
    <>
      {room ? (
        <button
          type="button"
          onClick={() => setDialog('room')}
          // Same size as the other buttons on the highlighted header line
          // (PLN-261027); the primary tint marks "already merged".
          className="inline-flex items-center gap-2 rounded-lg border border-primary-300 bg-white px-3 py-1.5 text-sm font-medium text-primary-700 transition-colors hover:bg-primary-100"
          title={t('merge.manage')}
        >
          <Combine className="h-4 w-4" />
          {t('merge.badge', { count: room.sessions.length })}
          <ChevronDown className="h-3.5 w-3.5" />
        </button>
      ) : (
        <>
          {addable.length > 0 && (
            <Button size="sm" variant="secondary" onClick={() => setDialog('merge')}>
              <Combine className="h-4 w-4" /> {t('merge.open', { count: addable.length })}
            </Button>
          )}
          {/* A session the check missed can still go into a room (PLN-261027 Merge-Add D4②). */}
          <Button size="sm" variant="secondary" onClick={() => setDialog('join')}>
            <PlusCircle className="h-4 w-4" /> {t('merge.joinRoom')}
          </Button>
        </>
      )}

      {/* ③ add THIS conversation to a room (D4②). */}
      {!room && (
        <Modal
          open={dialog === 'join'}
          onClose={() => setDialog(null)}
          size="md"
          title={t('merge.joinRoom')}
          footer={
            <>
              <Button variant="secondary" onClick={() => setDialog(null)}>
                {t('groups.cancel')}
              </Button>
              <Button
                disabled={!joinRoom || actions.addSession.isPending}
                onClick={() => joinRoom && addSession(joinRoom, conversationId, false, () => setDialog(null))}
              >
                {t('merge.joinSubmit')}
              </Button>
            </>
          }
        >
          <p className="mb-3 text-xs text-gray-500">{t('merge.joinHint')}</p>
          {options.isLoading && <p className="text-xs text-gray-400">{t('loading', { ns: 'common' })}</p>}
          {options.data && options.data.length === 0 && (
            <p className="mb-2 text-xs text-gray-400">{joinTarget ? t('merge.joinNoRoomForNumber') : t('merge.joinNoRoom')}</p>
          )}
          {!!options.data?.length && (
            <ul className="mb-3 divide-y divide-gray-100 rounded-md border border-gray-200 text-sm">
              {options.data.map((o) => (
                <li key={o.id}>
                  <label className="flex cursor-pointer items-center gap-2 px-3 py-2 hover:bg-gray-50">
                    <input type="radio" name="join-room" checked={joinRoom === o.id} onChange={() => setJoinRoom(o.id)} />
                    <span className="font-medium">
                      {t('merge.roomOption', { id: o.latestConversationId ?? '—', count: o.sessionCount })}
                    </span>
                    {o.companyId && <Badge tone="info">{t('company.badge')}</Badge>}
                  </label>
                </li>
              ))}
            </ul>
          )}
          <div className="flex items-center gap-2">
            <Input
              inputMode="numeric"
              value={joinNumber}
              placeholder={t('merge.joinNumberPlaceholder')}
              onChange={(e) => setJoinNumber(e.target.value.replace(/\D/g, ''))}
            />
            <Button
              size="sm"
              variant="secondary"
              className="shrink-0 whitespace-nowrap"
              disabled={!joinNumber}
              onClick={() => {
                setJoinRoom(null);
                setJoinTarget(joinNumber);
              }}
            >
              {t('merge.joinFind')}
            </Button>
          </div>
          {confirmAdd && (
            <ConfirmAdd
              number={confirmAdd.conversationId}
              pending={actions.addSession.isPending}
              onCancel={() => setConfirmAdd(null)}
              onConfirm={() => addSession(confirmAdd.roomId, confirmAdd.conversationId, true, () => setDialog(null))}
            />
          )}
        </Modal>
      )}

      {/* ① merge dialog — session metadata only, nothing of the other sessions is shown before merging. */}
      <Modal
        open={dialog === 'merge'}
        onClose={() => setDialog(null)}
        size="md"
        title={t('merge.title')}
        footer={
          <>
            <Button variant="secondary" onClick={() => setDialog(null)}>
              {t('groups.cancel')}
            </Button>
            <Button disabled={!checked.size || actions.merge.isPending} onClick={submit}>
              {t('merge.submit', { count: checked.size + (room ? room.sessions.length : 1) })}
            </Button>
          </>
        }
      >
        <p className="mb-3 text-xs text-gray-500">{t('merge.hint')}</p>
        <ul className="divide-y divide-gray-100 rounded-md border border-gray-200 text-sm">
          {(data?.sessions ?? [])
            .filter((s) => !s.otherRoom)
            .map((s) => {
              const fixed = s.current || s.inRoom;
              return (
                <li key={s.sessionId}>
                  <label className="flex cursor-pointer items-center gap-2 px-3 py-2 hover:bg-gray-50">
                    <input
                      type="checkbox"
                      className="h-4 w-4"
                      disabled={fixed}
                      checked={fixed || checked.has(s.sessionId)}
                      onChange={(e) =>
                        setChecked((prev) => {
                          const next = new Set(prev);
                          if (e.target.checked) next.add(s.sessionId);
                          else next.delete(s.sessionId);
                          return next;
                        })
                      }
                    />
                    <span className="font-medium">{s.alias || t('sessionLabel', { id: s.conversationId })}</span>
                    <ChannelBadge channel={s.channel} />
                    <span className="text-xs text-gray-500">
                      {s.open ? t('merge.inProgress') : t('merge.lastAt', { when: when(s.lastAt) })}
                    </span>
                    <span className="ml-auto flex items-center gap-1">
                      {s.current && <Badge tone="primary">{t('merge.current')}</Badge>}
                      {s.inRoom && !s.current && <Badge tone="info">{t('merge.alreadyMerged')}</Badge>}
                      {s.excluded && <Badge tone="gray">{t('merge.excluded')}</Badge>}
                      {s.unverified ? (
                        <Badge tone="warning">{t('unverifiedCustomer')}</Badge>
                      ) : (
                        <span className="text-xs text-gray-400">{matchLabel(s.matchedBy)}</span>
                      )}
                    </span>
                  </label>
                </li>
              );
            })}
        </ul>
        <label className="mt-3 flex items-center gap-2 text-sm">
          <input type="checkbox" className="h-4 w-4" checked={autoJoin} onChange={(e) => setAutoJoin(e.target.checked)} />
          {t('merge.autoJoin')}
        </label>
        <p className="mt-1 pl-6 text-xs text-gray-400">{t('merge.autoJoinHint')}</p>
      </Modal>

      {/* ② room menu */}
      {room && (
        <Modal
          open={dialog === 'room'}
          onClose={() => setDialog(null)}
          size="md"
          title={t('merge.manage')}
          footer={
            <>
              <Button
                variant="secondary"
                disabled={actions.dissolve.isPending}
                onClick={() => actions.dissolve.mutate(room.id, { onSuccess: () => setDialog(null) })}
              >
                {t('merge.dissolve')}
              </Button>
              <Button variant="ghost" onClick={() => setDialog(null)}>
                {t('close', { ns: 'common' })}
              </Button>
            </>
          }
        >
          {/* Add a session the check missed, by its conversation number (PLN-261027 Merge-Add D4①). */}
          <form
            className="mb-3 flex items-center gap-2 rounded-md border border-primary-100 bg-primary-50 px-3 py-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (addNumber) addSession(room.id, addNumber);
            }}
          >
            <span className="shrink-0 text-xs font-medium text-primary-700">{t('merge.addSession')}</span>
            <Input
              inputMode="numeric"
              value={addNumber}
              placeholder={t('merge.addSessionPlaceholder')}
              onChange={(e) => setAddNumber(e.target.value.replace(/\D/g, ''))}
            />
            <Button size="sm" type="submit" className="shrink-0 whitespace-nowrap" disabled={!addNumber || actions.addSession.isPending}>
              {t('merge.addSessionSubmit')}
            </Button>
          </form>
          {confirmAdd && (
            <ConfirmAdd
              number={confirmAdd.conversationId}
              pending={actions.addSession.isPending}
              onCancel={() => setConfirmAdd(null)}
              onConfirm={() => addSession(confirmAdd.roomId, confirmAdd.conversationId, true)}
            />
          )}
          <ul className="divide-y divide-gray-100 rounded-md border border-gray-200 text-sm">
            {roomRows.map((s) => (
              <li key={s.sessionId} className="flex items-center gap-2 px-3 py-2">
                <button
                  type="button"
                  className="flex min-w-0 flex-1 items-center gap-2 text-left hover:underline"
                  onClick={() => {
                    setDialog(null);
                    onOpenConversation(s.conversationId);
                  }}
                >
                  <span className="font-medium">{s.alias || t('sessionLabel', { id: s.conversationId })}</span>
                  <ChannelBadge channel={s.channel} />
                  <span className="text-xs text-gray-500">
                    {s.open ? t('merge.inProgress') : t('merge.lastAt', { when: when(s.lastAt) })}
                  </span>
                  {s.auto && <Badge tone="gray">{t('merge.autoJoined')}</Badge>}
                  {s.ip && <span className="font-mono text-[11px] text-gray-400">{s.ip}</span>}
                  {s.ipDiffers && <Badge tone="warning">{t('merge.ipDiffers')}</Badge>}
                  {s.forced && <Badge tone="warning">{t('merge.forced')}</Badge>}
                </button>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={actions.remove.isPending}
                  onClick={() => actions.remove.mutate({ roomId: room.id, sessionId: s.sessionId })}
                  title={t('merge.removeHint')}
                >
                  {t('merge.remove')}
                </Button>
              </li>
            ))}
          </ul>
          <label className="mt-3 flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="h-4 w-4"
              checked={room.autoJoin}
              disabled={actions.setAutoJoin.isPending}
              onChange={(e) => actions.setAutoJoin.mutate({ roomId: room.id, autoJoin: e.target.checked })}
            />
            {t('merge.autoJoin')}
          </label>
          {addable.length > 0 && (
            <Button size="sm" variant="secondary" className="mt-3" onClick={() => setDialog('merge')}>
              {t('merge.addMore', { count: addable.length })}
            </Button>
          )}
        </Modal>
      )}
    </>
  );
}

/** "Not the same person by the check — add anyway?" (PLN-261027 Merge-Add D4). */
function ConfirmAdd({
  number,
  pending,
  onCancel,
  onConfirm,
}: {
  number: string;
  pending: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const { t } = useTranslation('livechat');
  return (
    <div className="mt-2 rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-xs text-gray-700" role="alert">
      <p>{t('merge.confirmForce', { id: number })}</p>
      <div className="mt-2 flex justify-end gap-2">
        <Button size="sm" variant="ghost" onClick={onCancel}>
          {t('groups.cancel')}
        </Button>
        <Button size="sm" disabled={pending} onClick={onConfirm}>
          {t('merge.confirmForceSubmit')}
        </Button>
      </div>
    </div>
  );
}
