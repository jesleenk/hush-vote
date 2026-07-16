import { ContractState } from '@midnight-ntwrk/compact-runtime';
import { ledger } from '../contract/src/managed/poll/contract/index.js';
import { POLL_CONTRACT_ADDRESS } from './poll-config';
import type { PollChoice, PollSnapshot, PollStatus } from './poll-types';

const INDEXER = 'https://indexer.preprod.midnight.network/api/v4/graphql';
const CONTRACT_ADDRESS = POLL_CONTRACT_ADDRESS;

function fromHex(hex: string): Uint8Array {
  const normalized = hex.startsWith('0x') ? hex.slice(2) : hex;
  const bytes = new Uint8Array(normalized.length / 2);
  for (let i = 0; i < normalized.length; i += 2) bytes[i / 2] = parseInt(normalized.slice(i, i + 2), 16);
  return bytes;
}

async function readState(address: string) {
  const response = await fetch(INDEXER, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      query: 'query($address: HexEncoded!) { contractAction(address: $address) { state } }',
      variables: { address },
    }),
    cache: 'no-store',
  });
  const payload = await response.json();
  const state = payload.data?.contractAction?.state;
  return state ? ledger(ContractState.deserialize(fromHex(state)).data) : null;
}

export async function readPollSnapshot(): Promise<PollStatus> {
  if (!CONTRACT_ADDRESS) return { ready: false, reason: 'Deploy from /deploy, then set NEXT_PUBLIC_CONTRACT_ADDRESS for public survey reads.' };
  const decoded = await readState(CONTRACT_ADDRESS);
  if (!decoded) throw new Error(`No on-chain state found for ${CONTRACT_ADDRESS}`);
  return {
    question: decoded.question,
    options: [decoded.optionA, decoded.optionB, decoded.optionC, decoded.optionD],
    votes: [decoded.votesA, decoded.votesB, decoded.votesC, decoded.votesD].map(String) as [string, string, string, string],
    totalVotes: String(decoded.totalVotes),
    network: 'preprod', contractAddress: CONTRACT_ADDRESS, deployedAt: '',
  };
}

export async function submitPollVote(_choice: PollChoice): Promise<never> {
  throw new Error('Voting transaction must be submitted from a connected browser wallet.');
}
