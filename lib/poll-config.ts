const SUPPORTED_NETWORKS = ['preprod'] as const;

function resolveNetworkId(value: string | undefined): (typeof SUPPORTED_NETWORKS)[number] {
  const networkId = (value ?? 'preprod').trim();
  if (!SUPPORTED_NETWORKS.includes(networkId as (typeof SUPPORTED_NETWORKS)[number])) {
    throw new Error(
      `Invalid NEXT_PUBLIC_MIDNIGHT_NETWORK "${networkId}". This app supports preprod only.`,
    );
  }
  return networkId as (typeof SUPPORTED_NETWORKS)[number];
}

export const MIDNIGHT_NETWORK = resolveNetworkId(process.env.NEXT_PUBLIC_MIDNIGHT_NETWORK);
export const MIDNIGHT_PROOF_SERVER_URL =
  process.env.NEXT_PUBLIC_MIDNIGHT_PROOF_SERVER_URL?.trim() || 'http://localhost:6300';
export const POLL_CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS?.trim() || '';
export const POLL_PRIVATE_STATE_ID = 'pollState';
