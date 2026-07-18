import PollCard from './components/poll-card';

export default function Home() {
  return (
    <main className="vote-shell" id="poll">
      <div className="vote-intro" aria-hidden="true">
        <span>Private ballot</span>
        <span>Midnight · Preprod</span>
      </div>
      <PollCard />
    </main>
  );
}
