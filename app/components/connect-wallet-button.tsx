"use client";

import { useEffect, useState } from 'react';
import '@midnight-ntwrk/dapp-connector-api';
import { getInjectedWallet, MIDNIGHT_NETWORK } from '@/lib/midnight-browser';

function shortAddress(address: string) {
  return `${address.slice(0, 8)}…${address.slice(-6)}`;
}

export default function ConnectWalletButton() {
  const [connected, setConnected] = useState(false);
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string>('Wallet idle');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    setStatus(getInjectedWallet() ? 'Wallet ready' : 'Install Lace or 1AM wallet');
  }, []);

  const handleConnect = async () => {
    setBusy(true);
    try {
      const wallet = getInjectedWallet();
      if (!wallet) {
        throw new Error('Midnight wallet not found');
      }
      const api = await wallet.connect(MIDNIGHT_NETWORK);
      const addresses = await api.getShieldedAddresses();
      const connectionStatus = await api.getConnectionStatus();
      if (connectionStatus) {
        setConnected(true);
        setWalletAddress(addresses.shieldedAddress);
        setStatus('Wallet connected');
      }
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Connection failed');
    } finally {
      setBusy(false);
    }
  };

  const handleDisconnect = () => {
    setConnected(false);
    setWalletAddress(null);
    setStatus('Wallet disconnected');
  };

  return (
    <div
      className={`flex flex-col items-stretch gap-3 rounded-[24px] border border-white/10 bg-white/5 p-4 shadow-[0_16px_40px_rgba(0,0,0,0.2)] backdrop-blur-[14px] transition duration-500 ease-out ${
        mounted ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0'
      }`}
    >
      <div className="flex items-center gap-3">
        <span className={connected ? 'live-dot live-dot-on animate-pulse-ring' : 'live-dot'} />
        <div className="grid">
          <div className="text-xs uppercase tracking-[0.12em] text-midnight-muted">{status}</div>
          <strong className="font-display tracking-[-0.02em]">
            {walletAddress ? shortAddress(walletAddress) : 'Not connected'}
          </strong>
        </div>
      </div>
      <button
        className="action-button bg-[linear-gradient(135deg,var(--color-midnight-accent),#b3fff0_45%,var(--color-midnight-accent-2))] text-[#07101f] shadow-[0_12px_28px_rgba(122,168,255,0.28)]"
        onClick={connected ? handleDisconnect : handleConnect}
        disabled={busy}
      >
        {busy ? 'Working…' : connected ? 'Disconnect' : 'Connect wallet'}
      </button>
    </div>
  );
}
