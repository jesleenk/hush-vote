'use client';

import { useEffect, useState } from 'react';
import type { PollChoice, PollSnapshot, PollStatus } from '@/lib/poll-types';
import { connectWalletSession, detectWallet, type ConnectedSession } from '@/lib/midnight-browser';
import { submitBrowserVote } from '@/lib/poll-contract';

type ApiState =
  | { kind: 'loading' }
  | { kind: 'ready'; data: PollSnapshot }
  | { kind: 'idle'; reason: string }
  | { kind: 'error'; message: string };

type Journey = 'connect' | 'choose' | 'proving' | 'sealed';

const choices: PollChoice[] = ['a', 'b', 'c', 'd'];
const proofSteps = [
  'Preparing your private ballot',
  'Creating a zero-knowledge proof',
  'Sealing your vote on Midnight',
] as const;

function shortAddress(address: string) {
  return `${address.slice(0, 7)}…${address.slice(-5)}`;
}

export default function PollCard() {
  const [state, setState] = useState<ApiState>({ kind: 'loading' });
  const [journey, setJourney] = useState<Journey>('connect');
  const [session, setSession] = useState<ConnectedSession | null>(null);
  const [walletFound, setWalletFound] = useState<boolean | null>(null);
  const [selected, setSelected] = useState<PollChoice | null>(null);
  const [proofStep, setProofStep] = useState(0);
  const [receipt, setReceipt] = useState('');
  const [tallyUpdated, setTallyUpdated] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const refresh = async (showError = true): Promise<PollSnapshot | null> => {
    try {
      const response = await fetch('/api/poll', { cache: 'no-store' });
      const payload = (await response.json()) as PollStatus | { error: string };
      if ('ready' in payload && payload.ready === false) {
        setState({ kind: 'idle', reason: payload.reason });
        return null;
      }
      if (!response.ok) throw new Error('error' in payload ? payload.error : 'Ballot could not load.');
      const snapshot = payload as PollSnapshot;
      setState({ kind: 'ready', data: snapshot });
      return snapshot;
    } catch (caught) {
      if (showError) {
        setState({ kind: 'error', message: caught instanceof Error ? caught.message : 'Ballot could not load.' });
      }
      return null;
    }
  };

  const waitForIndexedTally = async (before: PollSnapshot): Promise<boolean> => {
    for (let attempt = 0; attempt < 30; attempt += 1) {
      const snapshot = await refresh(false);
      if (snapshot && snapshot.totalVotes !== before.totalVotes) return true;
      await new Promise((resolve) => window.setTimeout(resolve, 2000));
    }
    return false;
  };

  useEffect(() => {
    void refresh();
    void detectWallet().then((wallet) => setWalletFound(Boolean(wallet)));
  }, []);

  useEffect(() => {
    if (journey !== 'proving') return;
    setProofStep(0);
    const first = window.setTimeout(() => setProofStep(1), 1400);
    const second = window.setTimeout(() => setProofStep(2), 3600);
    return () => {
      window.clearTimeout(first);
      window.clearTimeout(second);
    };
  }, [journey]);

  const connect = async () => {
    setBusy(true);
    setError('');
    try {
      const nextSession = await connectWalletSession();
      setSession(nextSession);
      setJourney('choose');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Wallet could not connect.');
    } finally {
      setBusy(false);
    }
  };

  const sealVote = async () => {
    if (!session || !selected) return;
    const before = state.kind === 'ready' ? state.data : null;
    setError('');
    setTallyUpdated(false);
    setJourney('proving');
    try {
      const txId = await submitBrowserVote(session, selected);
      setReceipt(txId);
      if (before) setTallyUpdated(await waitForIndexedTally(before));
      else await refresh();
      setJourney('sealed');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Your vote was not sealed. Try again.');
      setJourney('choose');
    }
  };

  if (state.kind === 'loading') {
    return (
      <section className="ballot-card ballot-loading" aria-label="Loading ballot">
        <span className="skeleton skeleton-small" />
        <span className="skeleton skeleton-title" />
        <div className="skeleton-options">
          {choices.map((choice) => <span key={choice} className="skeleton skeleton-option" />)}
        </div>
      </section>
    );
  }

  if (state.kind === 'error' || state.kind === 'idle') {
    const message = state.kind === 'error' ? state.message : state.reason;
    return (
      <section className="ballot-card empty-state stage-enter">
        <p className="eyebrow">Ballot unavailable</p>
        <h1>Nothing to vote on yet.</h1>
        <p className="supporting-copy">{message}</p>
        <button type="button" className="primary-button" onClick={refresh}>Try again</button>
      </section>
    );
  }

  const { data } = state;

  if (journey === 'proving') {
    return (
      <section className="ballot-card proof-stage stage-enter" aria-live="polite">
        <div className="proof-orbit" aria-hidden="true">
          <span className="proof-ring proof-ring-one" />
          <span className="proof-ring proof-ring-two" />
          <span className="proof-core">
            <svg viewBox="0 0 48 48" role="presentation">
              <path d="M15 24.5 21.5 31 34 17.5" />
            </svg>
          </span>
        </div>
        <p className="eyebrow">Keep this page open</p>
        <h1>Your vote is becoming a proof.</h1>
        <div className="proof-progress" aria-label={`Step ${proofStep + 1} of ${proofSteps.length}`}>
          {proofSteps.map((step, index) => (
            <div key={step} className={`proof-step ${index <= proofStep ? 'proof-step-active' : ''}`}>
              <span>{index < proofStep ? '✓' : index + 1}</span>
              <p>{step}</p>
            </div>
          ))}
        </div>
        <p className="privacy-note">The proof does not include your identity.</p>
      </section>
    );
  }

  if (journey === 'sealed') {
    return (
      <section className="ballot-card sealed-stage stage-enter" aria-live="polite">
        <div className="seal-mark" aria-hidden="true">
          <svg viewBox="0 0 64 64" role="presentation">
            <circle cx="32" cy="32" r="27" />
            <path d="m20 33 8 8 17-19" />
          </svg>
        </div>
        <p className="eyebrow">Counted privately</p>
        <h1>Your vote is sealed.</h1>
        <p className="supporting-copy">
          {tallyUpdated
            ? 'Midnight accepted the proof without attaching your identity to the vote.'
            : 'Proof accepted. The public tally is still catching up.'}
        </p>
        <div className="receipt-card">
          <span>Proof reference</span>
          <code>{receipt ? shortAddress(receipt) : 'Confirmed'}</code>
        </div>
        <div className="tally-card">
          <div className="tally-card-heading">
            <span>Current tally</span>
            <strong>{data.totalVotes} total</strong>
          </div>
          <div className="tally-list">
            {data.options.map((option, index) => {
              const total = Number(data.totalVotes);
              const votes = Number(data.votes[index]);
              const percent = total > 0 ? Math.round((votes / total) * 100) : 0;
              return (
                <div key={`${option}-${index}`} className="tally-row">
                  <div className="tally-label">
                    <span>{option}</span>
                    <span>{votes}</span>
                  </div>
                  <div className="tally-track">
                    <span style={{ width: `${percent}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        <button
          type="button"
          className="secondary-button"
          onClick={() => {
            setSelected(null);
            setJourney('choose');
          }}
        >
          Return to ballot
        </button>
      </section>
    );
  }

  if (journey === 'connect') {
    return (
      <section className="ballot-card connect-stage stage-enter">
        <div className="ballot-number">Ballot 01</div>
        <p className="eyebrow">Anonymous community vote</p>
        <h1>{data.question}</h1>
        <p className="supporting-copy">Connect your Midnight wallet to open the ballot. Your wallet is not attached to your answer.</p>
        <div className="privacy-line">
          <span className="privacy-symbol" aria-hidden="true">◌</span>
          <span>No name. No wallet-linked voting history.</span>
        </div>
        <button type="button" className="primary-button" onClick={connect} disabled={busy || walletFound === null}>
          {busy ? 'Opening wallet…' : walletFound === false ? 'Wallet not found' : 'Connect wallet'}
        </button>
        {walletFound === false ? <p className="field-message">Install 1AM or Lace, then reload this page.</p> : null}
        {error ? <p className="error-message" role="alert">{error}</p> : null}
      </section>
    );
  }

  return (
    <section className="ballot-card choose-stage stage-enter">
      <div className="ballot-heading">
        <div>
          <p className="eyebrow">Choose one answer</p>
          <h1>{data.question}</h1>
        </div>
        <div className="wallet-chip" title={session?.unshieldedAddress}>
          <span />
          {session ? shortAddress(session.unshieldedAddress) : 'Connected'}
        </div>
      </div>

      <fieldset className="choice-list">
        <legend className="sr-only">Ballot choices</legend>
        {data.options.map((option, index) => {
          const choice = choices[index];
          const isSelected = selected === choice;
          return (
            <label key={`${choice}-${option}`} className={`choice-row ${isSelected ? 'choice-row-selected' : ''}`}>
              <input
                type="radio"
                name="ballot"
                value={choice}
                checked={isSelected}
                onChange={() => setSelected(choice)}
              />
              <span className="choice-letter">{String.fromCharCode(65 + index)}</span>
              <span className="choice-label">{option}</span>
              <span className="choice-control" aria-hidden="true" />
            </label>
          );
        })}
      </fieldset>

      <button type="button" className="primary-button" onClick={sealVote} disabled={!selected}>
        Seal my vote
      </button>
      <p className="privacy-note">Your proof validates the vote without naming you.</p>
      {error ? <p className="error-message" role="alert">{error}</p> : null}
    </section>
  );
}
