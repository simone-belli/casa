/** Runs `task` over `inputs` with at most `limit` running at once, keeping the order. */
export async function mapLimited<T, R>(inputs: T[], limit: number, task: (input: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(inputs.length);
  let next = 0;
  const worker = async () => {
    while (next < inputs.length) {
      const index = next++;
      results[index] = await task(inputs[index]);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, inputs.length) }, worker));
  return results;
}
