'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  connectWalletSession,
  detectWallet,
  MIDNIGHT_NETWORK,
  type ConnectedSession,
} from '@/lib/midnight-browser';
import {
  DEFAULT_SURVEY_DRAFT,
  deployPollContract,
  type SurveyDraft,
} from '@/lib/poll-contract';

const draftLabels = ['A', 'B', 'C', 'D'] as const;

const surveyTemplates: Record<
  string,
  SurveyDraft & {
    label: string;
    blurb: string;
  }
> = {
  pulse: {
    label: 'Product pulse',
    blurb: 'Fast check-in after release.',
    question: 'How should we improve this release?',
    options: ['Ship sooner', 'Simplify flow', 'Fix bugs', 'Add more themes'],
  },
  community: {
    label: 'Community vote',
    blurb: 'Pick next move with the room.',
    question: 'What should we build next?',
    options: ['New feature', 'Better onboarding', 'Mobile polish', 'More insights'],
  },
  event: {
    label: 'Event feedback',
    blurb: 'Quick read after session.',
    question: 'How was today’s session?',
    options: ['Excellent', 'Good', 'Okay', 'Needs work'],
  },
};

export default function DeployClient() {
  const searchParams = useSearchParams();
  const seededTemplate = useRef(false);
  const [walletInstalled, setWalletInstalled] = useState<boolean | null>(null);
  const [session, setSession] = useState<ConnectedSession | null>(null);
  const [address, setAddress] = useState('');
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState<SurveyDraft>(DEFAULT_SURVEY_DRAFT);
  const [selectedTemplate, setSelectedTemplate] = useState<string>('default');

  useEffect(() => {
    detectWallet().then((wallet) => setWalletInstalled(Boolean(wallet)));
  }, []);

  useEffect(() => {
    if (seededTemplate.current) return;
    seededTemplate.current = true;
    const templateId = searchParams.get('template') ?? 'default';
    if (templateId === 'default') {
      setDraft(DEFAULT_SURVEY_DRAFT);
      setSelectedTemplate('default');
      return;
    }

    const template = surveyTemplates[templateId];
    if (template) {
      setDraft({
        question: template.question,
        options: [...template.options] as SurveyDraft['options'],
      });
      setSelectedTemplate(templateId);
    }
  }, [searchParams]);

  const connect = useCallback(async () => {
    setBusy(true);
    setError('');
    setStatus('Connecting wallet…');
    try {
      setSession(await connectWalletSession(MIDNIGHT_NETWORK));
      setStatus(`Wallet connected to Midnight ${MIDNIGHT_NETWORK}.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setStatus('');
    } finally {
      setBusy(false);
    }
  }, []);

  const canDeploy = useMemo(() => {
    return draft.question.trim().length > 8 && draft.options.every((option) => option.trim().length > 0);
  }, [draft]);

  const deploy = useCallback(async () => {
    if (!session || !canDeploy) return;
    setBusy(true);
    setError('');
    setStatus('Sealing your new survey…');
    try {
      const deployedAddress = await deployPollContract(session, {
        question: draft.question.trim(),
        options: draft.options.map((option) => option.trim()) as SurveyDraft['options'],
      });
      setAddress(deployedAddress);
      setStatus('Survey created. It may take a moment to appear.');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setStatus('');
    } finally {
      setBusy(false);
    }
  }, [canDeploy, draft.options, draft.question, session]);

  const updateOption = (index: number, value: string) => {
    setDraft((current) => {
      const next = [...current.options] as SurveyDraft['options'];
      next[index] = value;
      setSelectedTemplate('custom');
      return { ...current, options: next };
    });
  };

  const selectTemplate = (templateId: string) => {
    if (templateId === 'default') {
      setDraft(DEFAULT_SURVEY_DRAFT);
      setSelectedTemplate('default');
      return;
    }
    const template = surveyTemplates[templateId];
    if (!template) return;
    setDraft({
      question: template.question,
      options: [...template.options] as SurveyDraft['options'],
    });
    setSelectedTemplate(templateId);
  };

  if (walletInstalled === false) {
    return (
      <section className="panel p-7">
        <div className="text-xs uppercase tracking-[0.12em] text-midnight-accent">Browser deployment</div>
        <h1 className="mt-3 font-display text-3xl tracking-[-0.04em]">Deploy survey</h1>
        <p className="muted-text mt-3">Install 1AM or Lace extension, then reload page.</p>
      </section>
    );
  }

  return (
    <section className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
      <div className="panel p-7">
        <div className="text-xs uppercase tracking-[0.12em] text-midnight-accent">Browser deployment</div>
        <h1 className="mt-3 max-w-[12ch] font-display text-[clamp(2.4rem,4vw,4.8rem)] leading-[0.9] tracking-[-0.05em]">
          Build next survey in one pass.
        </h1>
        <p className="muted-text mt-4 max-w-[60ch]">
          Pick question, tune answers, then deploy from wallet. Same contract shape. New survey, new address.
        </p>

        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          <div className="glass-card p-4">
            <span className="block text-xs uppercase tracking-[0.12em] text-midnight-muted">Network</span>
            <strong className="mt-2 block text-lg">{MIDNIGHT_NETWORK}</strong>
          </div>
          <div className="glass-card p-4">
            <span className="block text-xs uppercase tracking-[0.12em] text-midnight-muted">Flow</span>
            <strong className="mt-2 block text-lg">Wallet deploy</strong>
          </div>
          <div className="glass-card p-4">
            <span className="block text-xs uppercase tracking-[0.12em] text-midnight-muted">Privacy</span>
            <strong className="mt-2 block text-lg">On-chain tally</strong>
          </div>
        </div>

        <div className="mt-6 grid gap-3 lg:grid-cols-4">
          <button
            type="button"
            className={`rounded-[20px] border px-4 py-4 text-left transition duration-200 ease-out hover:-translate-y-0.5 ${
              selectedTemplate === 'default'
                ? 'border-midnight-accent/40 bg-midnight-accent/10'
                : 'border-white/10 bg-white/5 hover:border-midnight-accent/30'
            }`}
            onClick={() => selectTemplate('default')}
          >
            <div className="text-xs uppercase tracking-[0.12em] text-midnight-muted">Start fresh</div>
            <strong className="mt-2 block text-base text-slate-100">Blank survey</strong>
            <p className="mt-2 text-sm text-midnight-muted">Good for custom wording.</p>
          </button>
          {Object.entries(surveyTemplates).map(([id, template]) => (
            <button
              key={id}
              type="button"
              className={`rounded-[20px] border px-4 py-4 text-left transition duration-200 ease-out hover:-translate-y-0.5 ${
                selectedTemplate === id
                  ? 'border-midnight-accent/40 bg-midnight-accent/10'
                  : 'border-white/10 bg-white/5 hover:border-midnight-accent/30'
              }`}
              onClick={() => selectTemplate(id)}
            >
              <div className="text-xs uppercase tracking-[0.12em] text-midnight-muted">{template.label}</div>
              <strong className="mt-2 block text-base text-slate-100">{template.question}</strong>
              <p className="mt-2 text-sm text-midnight-muted">{template.blurb}</p>
            </button>
          ))}
        </div>

        <div className="mt-7 grid gap-4">
          <label className="grid gap-2">
            <span className="text-sm font-bold text-slate-100">Survey question</span>
            <input
              className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-slate-100 outline-none transition placeholder:text-midnight-muted focus:border-midnight-accent/40 focus:bg-midnight-accent/5"
              value={draft.question}
              onChange={(event) => setDraft((current) => ({ ...current, question: event.target.value }))}
              placeholder="What should people answer?"
            />
          </label>

          <div className="grid gap-3 sm:grid-cols-2">
            {draft.options.map((option, index) => (
              <label key={draftLabels[index]} className="grid gap-2">
                <span className="text-sm font-bold text-slate-100">
                  Option {draftLabels[index]}
                </span>
                <input
                  className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-slate-100 outline-none transition placeholder:text-midnight-muted focus:border-midnight-accent/40 focus:bg-midnight-accent/5"
                  value={option}
                  onChange={(event) => updateOption(index, event.target.value)}
                  placeholder={`Option ${draftLabels[index]}`}
                />
              </label>
            ))}
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            {!session ? (
              <button className="action-button" onClick={connect} disabled={busy}>
                {busy ? 'Connecting…' : 'Connect wallet'}
              </button>
            ) : (
              <button className="action-button" onClick={deploy} disabled={busy || !canDeploy}>
                {busy ? status || 'Deploying…' : 'Deploy survey'}
              </button>
            )}
            <Link className="action-button border border-white/10 bg-white/5 text-slate-100 hover:bg-white/10" href="/">
              Back home
            </Link>
          </div>

          {status ? (
            <p className="text-sm text-midnight-accent" aria-live="polite">
              {status}
            </p>
          ) : (
            <p className="text-sm text-midnight-muted">
              Use any wording. Contract stores 4 answers, so every survey stays simple and fast.
            </p>
          )}

          {error ? (
            <p className="rounded-[16px] border border-red-400/30 bg-red-400/10 p-4 text-sm text-red-200">{error}</p>
          ) : null}
        </div>
      </div>

      <aside className="grid gap-6">
        <div className="panel p-6">
          <div className="text-xs uppercase tracking-[0.12em] text-midnight-muted">Live preview</div>
          <h2 className="mt-3 font-display text-2xl leading-tight tracking-[-0.04em]">{draft.question}</h2>
          <div className="mt-5 grid gap-3">
            {draft.options.map((option, index) => (
              <div
                key={option || draftLabels[index]}
                className="flex items-center justify-between gap-3 rounded-[18px] border border-white/10 bg-white/5 px-4 py-3"
              >
                <div className="flex items-center gap-3">
                  <span className="flex size-8 items-center justify-center rounded-full bg-midnight-accent/15 text-sm font-bold text-midnight-accent">
                    {draftLabels[index]}
                  </span>
                  <span className="text-sm text-slate-100">{option || 'Untitled option'}</span>
                </div>
                <span className="text-xs uppercase tracking-[0.12em] text-midnight-muted">Ready</span>
              </div>
            ))}
          </div>
        </div>

        <div className="panel p-6">
          <div className="text-xs uppercase tracking-[0.12em] text-midnight-muted">Result</div>
          <p className="mt-3 text-lg font-bold text-slate-100">New survey gets own contract address.</p>
          <p className="muted-text mt-2">
            Old survey stays live until closed or replaced. This page is place to make more surveys without touching code.
          </p>
          {address ? (
            <div className="mt-5 rounded-[20px] border border-midnight-accent/30 bg-midnight-accent/10 p-4">
              <div className="text-xs uppercase tracking-[0.12em] text-midnight-muted">Deployed contract address</div>
              <code className="mt-2 block break-all text-sm text-slate-100">{address}</code>
            </div>
          ) : null}
          <div className="mt-4 flex flex-wrap gap-2">
            <Link
              className="rounded-full border border-white/10 px-3 py-2 text-sm text-midnight-muted transition hover:border-midnight-accent/30 hover:text-slate-100"
              href="/#poll"
            >
              View live ballot
            </Link>
            <button
              type="button"
              className="rounded-full border border-white/10 px-3 py-2 text-sm text-midnight-muted transition hover:border-midnight-accent/30 hover:text-slate-100"
              onClick={() => selectTemplate('default')}
            >
              Reset draft
            </button>
          </div>
        </div>
      </aside>
    </section>
  );
}
