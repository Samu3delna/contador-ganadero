export function singleFlight() {
  let pending = null;
  return action => {
    if (!pending) pending = Promise.resolve().then(action).finally(() => { pending = null; });
    return pending;
  };
}
