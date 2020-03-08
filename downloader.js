import { go, noop } from "./util.js";

const rRange = /(\d+)-(\d+)\/(\d+)/;

function fetchRange({ from, to, url, onSuccess = noop, onError = noop }) {
  const ctrl = new AbortController();

  let begin;
  let end;
  let total;
  fetch(url, {
    headers: {
      Range: `bytes=${from}-${to}`
    },
    signal: ctrl.signal
  })
    .then(resp => {
      [, begin, end, total] = resp.headers.get("Content-Range").match(rRange);
      begin = parseInt(begin, 10);
      end = parseInt(end, 10);
      total = parseInt(total, 10);
      return resp.arrayBuffer();
    })
    .then(bytes => onSuccess({ begin, end, bytes, total }))
    .catch(e => {
      // aborted
      if (e.code !== 20) onError(e);
    });

  return ctrl;
}

const defaultOpts = {
  url: "",
  chunkStart: 100 * 1024,
  total: 0,
  onChunk: noop
};

export const States = {
  None: "none",
  Loading: "loading",
  Paused: "paused",
  Stopped: "stopped"
};

export class Downloader {
  constructor(opts) {
    Object.assign(this, defaultOpts, opts);

    this.state = States.None;
    this.fetcher = false;
  }

  _loadChunk() {
    if (this.fetcher) return;

    const chunkStart = this.chunkStart;
    const onSuccess = ({ begin, end, bytes, total }) => {
      this.total = total;
      this.chunkStart = end;

      this.fetcher = null;
      const isEof = end === total - 1;
      if (isEof) this.state = States.Stopped;

      bytes.fileStart = chunkStart;
      this.onChunk({ bytes, isEof, total });

      if (this.state === States.Loading) this._loadChunk();
    };

    if (this.chunkStart === this.total - 1) return;
    this.fetcher = fetchRange({
      url: this.url,
      from: this.chunkStart,
      to: this.chunkStart + this.chunkSize - 1,
      onSuccess,
      onError: e => console.error(e)
    });
  }

  start() {
    if (this.state !== States.Loading) {
      this.chunkStart = 0;
      this.state = States.Loading;
      this._loadChunk();
    }
  }

  resume() {
    if (this.state !== States.Loading) {
      this.state = States.Loading;
      this._loadChunk();
    }
  }

  stop() {
    this.state = States.Stopped;
    if (this.fetcher) {
      this.fetcher.abort();
      this.fetcher = null;
    }
  }
}
