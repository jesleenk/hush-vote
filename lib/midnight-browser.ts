'use client';

import { ContractState } from '@midnight-ntwrk/compact-runtime';
import { LedgerParameters, Transaction, ZswapChainState } from '@midnight-ntwrk/ledger-v8';
import { httpClientProofProvider } from '@midnight-ntwrk/midnight-js-http-client-proof-provider';
import { indexerPublicDataProvider } from '@midnight-ntwrk/midnight-js-indexer-public-data-provider';
import { setNetworkId } from '@midnight-ntwrk/midnight-js-network-id';
import { FetchZkConfigProvider } from '@midnight-ntwrk/midnight-js-fetch-zk-config-provider';
import type { InitialAPI } from '@midnight-ntwrk/dapp-connector-api';
import type { MidnightProvider, WalletProvider } from '@midnight-ntwrk/midnight-js-types';
import { MIDNIGHT_NETWORK, MIDNIGHT_PROOF_SERVER_URL } from './poll-config';

export { MIDNIGHT_NETWORK } from './poll-config';

declare global {
  interface Window {
    midnight?: Record<string, InitialAPI>;
  }
}

// Set default before wallet/session/contract work. Session config reasserts it below.
setNetworkId(MIDNIGHT_NETWORK);

export function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

export function fromHex(hex: string): Uint8Array {
  const normalized = hex.startsWith('0x') ? hex.slice(2) : hex;
  if (normalized.length % 2 !== 0) throw new Error('Invalid hex string from wallet.');
  const bytes = new Uint8Array(normalized.length / 2);
  for (let i = 0; i < normalized.length; i += 2) {
    bytes[i / 2] = parseInt(normalized.slice(i, i + 2), 16);
  }
  return bytes;
}

function isWalletApi(value: unknown): value is InitialAPI {
  return Boolean(
    value &&
      typeof value === 'object' &&
      'connect' in value &&
      typeof (value as InitialAPI).connect === 'function' &&
      'name' in value &&
      'apiVersion' in value,
  );
}

export function getInjectedWallet(): InitialAPI | null {
  if (typeof window === 'undefined') return null;
  const injected = window.midnight ?? {};
  const friendlyWallets = [injected['1am'], injected.mnLace].filter(isWalletApi);
  if (friendlyWallets.length > 0) return friendlyWallets[0];
  const discovered = Object.values(injected).find(isWalletApi);
  return discovered ?? null;
}

function createPrivateStateProvider() {
  let scope = '';
  const stateStore = new Map<string, unknown>();
  const signingKeyStore = new Map<string, unknown>();
  const key = (id: string) => `${scope}:${id}`;
  return {
    setContractAddress(address: string) { scope = address; },
    async set(id: string, state: unknown) { stateStore.set(key(id), state); },
    async get(id: string) { return stateStore.get(key(id)) ?? null; },
    async remove(id: string) { stateStore.delete(key(id)); },
    async clear() { stateStore.clear(); },
    async setSigningKey(address: string, value: unknown) { signingKeyStore.set(address, value); },
    async getSigningKey(address: string) { return signingKeyStore.get(address) ?? null; },
    async removeSigningKey(address: string) { signingKeyStore.delete(address); },
    async clearSigningKeys() { signingKeyStore.clear(); },
    async exportPrivateStates(): Promise<never> { throw new Error('Not implemented.'); },
    async importPrivateStates(): Promise<never> { throw new Error('Not implemented.'); },
    async exportSigningKeys(): Promise<never> { throw new Error('Not implemented.'); },
    async importSigningKeys(): Promise<never> { throw new Error('Not implemented.'); },
  };
}

function createPatchedPublicDataProvider(queryUrl: string, subscriptionUrl: string) {
  const base = indexerPublicDataProvider(queryUrl, subscriptionUrl);
  async function queryLatest(query: string, address: string) {
    const response = await fetch(queryUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ query, variables: { address } }),
    });
    if (!response.ok) throw new Error(`Indexer HTTP error: ${response.status}`);
    const payload = await response.json();
    if (payload.errors?.length) throw new Error(payload.errors.map((e: { message: string }) => e.message).join('; '));
    return payload.data?.contractAction ?? null;
  }
  return {
    ...base,
    async queryContractState(address: string, config?: unknown) {
      if (config) return base.queryContractState(address, config as never);
      const action = await queryLatest(`query($address: HexEncoded!) { contractAction(address: $address) { state } }`, address);
      return action ? ContractState.deserialize(fromHex(action.state)) : null;
    },
    async queryZSwapAndContractState(address: string, config?: unknown) {
      if (config) return base.queryZSwapAndContractState(address, config as never);
      const action = await queryLatest(`query($address: HexEncoded!) { contractAction(address: $address) { state zswapState transaction { block { ledgerParameters } } } }`, address);
      if (!action?.zswapState) return null;
      return [
        ZswapChainState.deserialize(fromHex(action.zswapState)),
        ContractState.deserialize(fromHex(action.state)),
        action.transaction?.block?.ledgerParameters
          ? LedgerParameters.deserialize(fromHex(action.transaction.block.ledgerParameters))
          : LedgerParameters.initialParameters(),
      ] as const;
    },
  };
}

export type ConnectedSession = {
  api: any;
  config: any;
  providers: {
    privateStateProvider: ReturnType<typeof createPrivateStateProvider>;
    publicDataProvider: ReturnType<typeof createPatchedPublicDataProvider>;
    zkConfigProvider: FetchZkConfigProvider<any>;
    proofProvider: { proveTx: (unprovenTx: any) => Promise<any> };
    walletProvider: WalletProvider;
    midnightProvider: MidnightProvider;
  };
  unshieldedAddress: string;
};

export function detectWallet(): Promise<any | null> {
  return new Promise((resolve) => {
    let attempts = 0;
    const check = () => {
      const wallet = getInjectedWallet();
      if (wallet) return resolve(wallet);
      if (++attempts > 50) return resolve(null);
      setTimeout(check, 100);
    };
    check();
  });
}

export async function createConnectedSession(api: any): Promise<ConnectedSession> {
  const [config, connectionStatus, unshieldedAddress, shieldedAddress] = await Promise.all([
    api.getConfiguration(),
    api.getConnectionStatus(),
    api.getUnshieldedAddress(),
    api.getShieldedAddresses(),
  ]);
  if (connectionStatus.status !== 'connected') throw new Error('Wallet is not connected.');
  if (connectionStatus.networkId !== MIDNIGHT_NETWORK) {
    throw new Error(`Wallet connected to ${connectionStatus.networkId}; select Midnight ${MIDNIGHT_NETWORK}.`);
  }
  setNetworkId(connectionStatus.networkId);

  const zkConfigProvider = new FetchZkConfigProvider(
    new URL('/zk/poll/', window.location.origin).toString(), window.fetch.bind(window),
  );
  const provingProvider = typeof api.getProvingProvider === 'function'
    ? await api.getProvingProvider(zkConfigProvider)
    : httpClientProofProvider(MIDNIGHT_PROOF_SERVER_URL, zkConfigProvider);
  const proofProvider = {
    async proveTx(unprovenTx: any) {
      const { CostModel } = await import('@midnight-ntwrk/ledger-v8');
      return unprovenTx.prove(provingProvider, CostModel.initialCostModel());
    },
  };
  const walletProvider: WalletProvider = {
    getCoinPublicKey: () => shieldedAddress.shieldedCoinPublicKey,
    getEncryptionPublicKey: () => shieldedAddress.shieldedEncryptionPublicKey,
    balanceTx: async (tx: any) => {
      const balanced = await api.balanceUnsealedTransaction(toHex(tx.serialize()));
      if (!balanced?.tx) throw new Error('balanceUnsealedTransaction returned invalid result');
      return Transaction.deserialize('signature', 'proof', 'binding', fromHex(balanced.tx));
    },
  };
  const midnightProvider: MidnightProvider = {
    submitTx: async (tx: any) => {
      const txHex = toHex(tx.serialize());
      const result = await api.submitTransaction(txHex);
      if (typeof result === 'string' && result) return result;
      if (result?.transactionId) return result.transactionId;
      if (result?.id) return result.id;
      return txHex.slice(0, 64);
    },
  };
  return {
    api, config,
    providers: {
      privateStateProvider: createPrivateStateProvider(),
      publicDataProvider: createPatchedPublicDataProvider(config.indexerUri, config.indexerWsUri),
      zkConfigProvider, proofProvider, walletProvider, midnightProvider,
    },
    unshieldedAddress: unshieldedAddress.unshieldedAddress,
  };
}

export async function connectWalletSession(networkId = MIDNIGHT_NETWORK): Promise<ConnectedSession> {
  const wallet = getInjectedWallet();
  if (!wallet) throw new Error('1AM or Lace wallet extension not detected.');
  const api = await wallet.connect(networkId);
  return createConnectedSession(api);
}
