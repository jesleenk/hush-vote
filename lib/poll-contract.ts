'use client';

import { findDeployedContract } from '@midnight-ntwrk/midnight-js-contracts';
import { sampleSigningKey } from '@midnight-ntwrk/compact-runtime';
import { CompiledContract } from '@midnight-ntwrk/compact-js';
import { createUnprovenDeployTx, submitTxAsync } from '@midnight-ntwrk/midnight-js-contracts';
import { Contract } from '@/contract/src/managed/poll/contract/index.js';
import { POLL_CONTRACT_ADDRESS, POLL_PRIVATE_STATE_ID } from './poll-config';
import type { PollChoice } from './poll-types';
import type { ConnectedSession } from './midnight-browser';

export type SurveyDraft = {
  question: string;
  options: [string, string, string, string];
};

export const DEFAULT_SURVEY_DRAFT: SurveyDraft = {
  question: 'How useful is Midnight for private apps?',
  options: ['Loved it', 'Pretty good', 'Mixed', 'Needs work'],
};

const compiledContract = CompiledContract.make('PollContract', Contract).pipe(
  CompiledContract.withVacantWitnesses,
  CompiledContract.withCompiledFileAssets('/zk/poll/'),
);

export async function deployPollContract(
  session: ConnectedSession,
  draft: SurveyDraft = DEFAULT_SURVEY_DRAFT,
): Promise<string> {
  const deployTxData = await (createUnprovenDeployTx as any)(
    { zkConfigProvider: session.providers.zkConfigProvider, walletProvider: session.providers.walletProvider },
    {
      compiledContract,
      args: [draft.question, ...draft.options],
      privateStateId: 'pollState',
      initialPrivateState: {},
      signingKey: sampleSigningKey(),
    },
  );
  const address = deployTxData.public.contractAddress;
  await (submitTxAsync as any)(session.providers, { unprovenTx: deployTxData.private.unprovenTx });
  await session.providers.privateStateProvider.setContractAddress(address);
  await session.providers.privateStateProvider.set(POLL_PRIVATE_STATE_ID, deployTxData.private.initialPrivateState);
  await session.providers.privateStateProvider.setSigningKey(address, deployTxData.private.signingKey);
  return address;
}

const voteCircuitByChoice = {
  a: 'voteForA',
  b: 'voteForB',
  c: 'voteForC',
  d: 'voteForD',
} as const;

export async function submitBrowserVote(session: ConnectedSession, choice: PollChoice): Promise<string> {
  const contract = await findDeployedContract(session.providers as any, {
    compiledContract,
    contractAddress: POLL_CONTRACT_ADDRESS,
    privateStateId: POLL_PRIVATE_STATE_ID,
    initialPrivateState: {},
  } as any);
  const finalized = await (contract.callTx as any)[voteCircuitByChoice[choice]]();
  return finalized.public.txId;
}
