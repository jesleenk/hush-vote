'use client';

import { ContractState } from '@midnight-ntwrk/compact-runtime';
import { ledger } from '../contract/src/managed/poll/contract/index.js';
import { MIDNIGHT_INDEXER_URL, MIDNIGHT_NETWORK, POLL_CONTRACT_ADDRESS } from './poll-config';
import type { PollSnapshot, PollStatus } from './poll-types';

function fromHex(hex: string): Uint8Array {
  const normalized = hex.startsWith('0x') ? hex.slice(2) : hex;
  const bytes = new Uint8Array(normalized.length / 2);
  for (let i = 0; i < normalized.length; i += 2) bytes[i / 2] = parseInt(normalized.slice(i, i + 2), 16);
  return bytes;
}

async function readLatestContractState(address: string): Promise<string | null> {
  const response = await fetch(MIDNIGHT_INDEXER_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      query: 'query($address: HexEncoded!) { contractAction(address: $address) { state } }',
      variables: { address },
    }),
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error(`Indexer request failed with status ${response.status}`);
  }

  const payload = await response.json().catch(() => {
    throw new Error('Indexer response was not valid JSON.');
  });
  if (payload.errors?.length) {
    throw new Error(payload.errors.map((entry: { message: string }) => entry.message).join('; '));
  }

  return payload?.data?.contractAction?.state ?? null;
}

export async function readPollSnapshot(): Promise<PollStatus> {
  if (!POLL_CONTRACT_ADDRESS) {
    return {
      ready: false,
      reason: 'Deploy from /deploy, then set NEXT_PUBLIC_CONTRACT_ADDRESS for public ballot reads.',
    };
  }

  const state = await readLatestContractState(POLL_CONTRACT_ADDRESS);
  if (!state) {
    return { ready: false, reason: `No on-chain state found for ${POLL_CONTRACT_ADDRESS}` };
  }

  try {
    const decoded = ledger(ContractState.deserialize(fromHex(state)).data);
    const snapshot: PollSnapshot = {
      question: decoded.question,
      options: [decoded.optionA, decoded.optionB, decoded.optionC, decoded.optionD],
      votes: [decoded.votesA, decoded.votesB, decoded.votesC, decoded.votesD].map(String) as [
        string,
        string,
        string,
        string,
      ],
      totalVotes: String(decoded.totalVotes),
      network: MIDNIGHT_NETWORK,
      contractAddress: POLL_CONTRACT_ADDRESS,
      deployedAt: '',
    };
    return snapshot;
  } catch (error) {
    return {
      ready: false,
      reason:
        error instanceof Error
          ? `Contract decode failed in browser: ${error.message}`
          : 'Contract decode failed in browser.',
    };
  }
}
