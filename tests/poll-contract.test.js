import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const contract = await readFile(new URL("../contract/src/poll.compact", import.meta.url), "utf8");

test("poll starts open and discloses ballot text", () => {
  assert.match(contract, /state = PollState\.OPEN;/);
  assert.match(contract, /question = disclose\(pollQuestion\);/);
  assert.match(contract, /optionD = disclose\(pollOptionD\);/);
});

test("contract exposes four vote circuits", () => {
  for (const option of ["A", "B", "C", "D"]) {
    assert.match(contract, new RegExp(`export circuit voteFor${option}\\(\\): \\[\\]`));
  }
});

test("each vote requires an open poll and increments total votes", () => {
  const circuits = contract.match(/export circuit voteFor[A-D][\s\S]*?(?=\nexport circuit|$)/g) ?? [];
  assert.equal(circuits.length, 4);
  for (const circuit of circuits) {
    assert.match(circuit, /assert\(state == PollState\.OPEN, "Poll closed"\);/);
    assert.match(circuit, /totalVotes\.increment\(1\);/);
  }
});
