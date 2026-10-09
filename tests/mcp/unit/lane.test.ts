/**
 * Unit tests for the serialized execution lane — the core of the
 * timeout/stateful-execution fix. Fake work functions keep timing
 * deterministic; no engine calls are made here.
 */

import { ExecutionLane } from '../../../src/mcp/security/lane';

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

describe('ExecutionLane', () => {
  it('returns work results under the timeout', async () => {
    const lane = new ExecutionLane(4);
    await expect(lane.run(async () => 'ok', 1000)).resolves.toBe('ok');
    expect(lane.pendingCount).toBe(0);
  });

  it('serializes concurrent work', async () => {
    const lane = new ExecutionLane(4);
    const order: string[] = [];
    const a = lane.run(async () => {
      await sleep(40);
      order.push('a');
      return 'a';
    }, 1000);
    const b = lane.run(async () => {
      order.push('b');
      return 'b';
    }, 1000);
    await Promise.all([a, b]);
    expect(order).toEqual(['a', 'b']);
  });

  it('times out the caller but keeps the lane occupied until real completion', async () => {
    const lane = new ExecutionLane(4);
    let finished = false;
    const timed = lane.run(async () => {
      await sleep(120);
      finished = true;
      return 'late';
    }, 20);
    await expect(timed).rejects.toMatchObject({
      code: 'MCP_ADAPTER_TIMEOUT'
    });
    // Caller timed out — underlying work has NOT finished and the lane
    // still reports the call as pending.
    expect(finished).toBe(false);
    expect(lane.pendingCount).toBe(1);
    // It eventually settles; the lane frees only on real completion.
    await sleep(160);
    expect(finished).toBe(true);
    expect(lane.pendingCount).toBe(0);
  });

  it('never lets a second call start while a timed-out call is still running', async () => {
    const lane = new ExecutionLane(4);
    let secondStarted = false;
    const first = lane.run(async () => {
      await sleep(100);
      return 'first';
    }, 15);
    await expect(first).rejects.toMatchObject({ code: 'MCP_ADAPTER_TIMEOUT' });

    const second = lane.run(async () => {
      secondStarted = true;
      return 'second';
    }, 2000);
    await sleep(40); // < first's remaining runtime — must still be queued
    expect(secondStarted).toBe(false);
    await expect(second).resolves.toBe('second');
    expect(secondStarted).toBe(true);
  });

  it('propagates a rejected engine promise and frees the lane', async () => {
    const lane = new ExecutionLane(4);
    const boom = new Error('engine exploded');
    await expect(lane.run(() => Promise.reject(boom), 1000)).rejects.toBe(boom);
    expect(lane.pendingCount).toBe(0);
    // Lane still functions after the failure.
    await expect(lane.run(async () => 'after', 2000)).resolves.toBe(
      'after'
    );
  });

  it('fails fast when the queue is full (bounded, never unbounded)', async () => {
    const lane = new ExecutionLane(1);
    const first = lane.run(async () => {
      await sleep(80);
      return 'first';
    }, 1000);
    await expect(
      lane.run(async () => 'second', 1000)
    ).rejects.toMatchObject({ code: 'MCP_ADAPTER_QUEUE_FULL' });
    await first;
  });

  it('a timed-out call never silently resolves as success', async () => {
    const lane = new ExecutionLane(4);
    const settlements: string[] = [];
    const p = lane
      .run(async () => {
        await sleep(60);
        return 'late-success';
      }, 10)
      .then(
        () => settlements.push('resolved'),
        (e: { code?: string }) => settlements.push(`rejected:${e.code ?? '?'}`)
      );
    await p;
    await sleep(80); // let the underlying work settle
    // The caller observed exactly one settlement — the timeout rejection.
    expect(settlements).toEqual(['rejected:MCP_ADAPTER_TIMEOUT']);
  });

  it('an expired queued request never executes — no quota, no work', async () => {
    const lane = new ExecutionLane(4);
    let workRan = false;
    // Occupy the lane long enough for the second call to expire queued.
    const first = lane.run(async () => {
      await sleep(120);
      return 'first';
    }, 2000);
    const second = lane.run(async () => {
      workRan = true;
      return 'second';
    }, 30); // expires while still queued behind `first`
    await expect(second).rejects.toMatchObject({
      code: 'MCP_ADAPTER_QUEUE_EXPIRED'
    });
    await first;
    await sleep(30); // give the expired slot time to be reached
    expect(workRan).toBe(false);
    expect(lane.pendingCount).toBe(0);
  });

  it('queue expiry frees the slot — the lane does not stall on it', async () => {
    const lane = new ExecutionLane(4);
    const order: string[] = [];
    const a = lane.run(async () => {
      await sleep(100);
      order.push('a');
    }, 1000);
    const b = lane.run(async () => {
      order.push('b');
    }, 20); // expires queued
    const c = lane.run(async () => {
      order.push('c');
    }, 1000);
    await expect(b).rejects.toMatchObject({
      code: 'MCP_ADAPTER_QUEUE_EXPIRED'
    });
    await Promise.all([a, c]);
    expect(order).toEqual(['a', 'c']); // b skipped, c not blocked forever
  });

  it('distinguishes queue-expiry from running-timeout error codes', async () => {
    const lane = new ExecutionLane(4);
    const running = lane.run(async () => {
      await sleep(80);
      return 'r';
    }, 10); // starts, then times out RUNNING
    const queued = lane.run(async () => 'q', 10); // expires while queued
    await expect(running).rejects.toMatchObject({
      code: 'MCP_ADAPTER_TIMEOUT'
    });
    await expect(queued).rejects.toMatchObject({
      code: 'MCP_ADAPTER_QUEUE_EXPIRED'
    });
  });

  it('survives repeated timeouts without corrupting serialization', async () => {
    const lane = new ExecutionLane(4);
    const calls = [
      lane.run(async () => {
        await sleep(50);
        return 1;
      }, 10),
      lane.run(async () => {
        await sleep(50);
        return 2;
      }, 10),
      lane.run(async () => 'fast', 2000)
    ];
    // First times out while running; second expires while still queued
    // behind it and never executes.
    await expect(calls[0]).rejects.toMatchObject({
      code: 'MCP_ADAPTER_TIMEOUT'
    });
    await expect(calls[1]).rejects.toMatchObject({
      code: 'MCP_ADAPTER_QUEUE_EXPIRED'
    });
    // Third call still runs — but only after both earlier works settle.
    await expect(calls[2]).resolves.toBe('fast');
    expect(lane.pendingCount).toBe(0);
  });
});
