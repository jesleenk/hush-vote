export type PollChoice = 'a' | 'b' | 'c' | 'd';

export type PollSnapshot = {
  question: string;
  options: [string, string, string, string];
  votes: [string, string, string, string];
  totalVotes: string;
  network: string;
  contractAddress: string;
  deployedAt?: string;
};

export type PollStatus =
  | PollSnapshot
  | {
      ready: false;
      reason: string;
    };
