/**
 * Promise timeout helper.
 *
 * Wraps a promise so it rejects after `timeoutMs` if it has not settled. This
 * is the safety net that prevents a single unresponsive Webflow Designer API
 * call (one that never resolves nor rejects) from freezing the whole
 * deployment loop. On timeout the wrapped call is abandoned and the error is
 * surfaced to the caller, which logs it and moves on to the next element.
 */
export const withTimeout = async <T>(
  promise: Promise<T>,
  label: string,
  timeoutMs: number,
): Promise<T> => {
  let timer: ReturnType<typeof setTimeout> | undefined;

  const timeout = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => {
      reject(new Error(`Timeout (${timeoutMs}ms) — ${label}`));
    }, timeoutMs);
  });

  try {
    return await Promise.race([promise, timeout]);
  } finally {
    if (timer) {
      clearTimeout(timer);
    }
  }
};
