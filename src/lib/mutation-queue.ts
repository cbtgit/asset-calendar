export type MutationRelease = () => void;

export function createMutationQueue() {
  const tails = new Map<string, Promise<void>>();

  return {
    acquire(key: string): Promise<MutationRelease> {
      const previous = tails.get(key) ?? Promise.resolve();
      let resolveCurrent!: () => void;
      const current = new Promise<void>((resolve) => {
        resolveCurrent = resolve;
      });
      tails.set(key, current);

      return previous.then(() => {
        let released = false;
        return () => {
          if (released) return;
          released = true;
          if (tails.get(key) === current) tails.delete(key);
          resolveCurrent();
        };
      });
    },
  };
}
