export async function go(p) {
  return p
    .then(res => Promise.resolve([res, undefined]))
    .catch(err => Promise.resolve([undefined, err]));
}

export const noop = () => {};
