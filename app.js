import { Downloader } from "./downloader.js";

const url = "http://localhost:8000/1.mp4";

function loadMediaData(ctx) {
  const { dw, mp4file } = ctx.shared;
  dw.chunkStart = mp4file.seek(0, true).offset;
  mp4file.start();
  dw.resume();
}

function handleUpdateEnd(ctx) {
  console.log("upd", ctx.sb.updating);
  if (ctx.sb.updating || ctx.shared.ms.readyState !== "open") return;

  const seg = ctx.pending.shift();
  if (seg && seg.isInit) {
    ctx.shared.pendingInitCnt--;
  }

  if (ctx.shared.pendingInitCnt === 0 && !ctx.shared.loading) {
    ctx.shared.loading = true;
    loadMediaData(ctx);
    return;
  }

  if (ctx.isEof) {
    ctx.shared.notEndCnt--;
  }

  if (ctx.shared.notEndCnt === 0 && !ctx.shared.isMseEnd) {
    if (ctx.sampleNum) {
      ctx.shared.mp4file.releaseUsedSamples(ctx.id, ctx.sampleNum);
      ctx.sampleNum = null;
    }

    ctx.shared.isMseEnd = true;
    ctx.shared.ms.endOfStream();
  }

  if (seg && !seg.isInit) {
    ctx.sampleNum = seg.sampleNum;
    ctx.isEof = seg.isEnd;
    console.log("appendBuffer", seg);
    ctx.sb.appendBuffer(seg.buffer);
  }
}

function linkMsAndMp4(vElem, ms, mp4file, mp4info) {
  const trackLen = mp4info.tracks.length;
  const shared = {
    ms,
    vElem,
    loading: false,
    notEndCnt: trackLen,
    pendingInitCnt: trackLen,
    dw: mp4file.dw,
    mp4file,
    loading: false,
    isMseEnd: false
  };
  mp4info.tracks.forEach(track => {
    setSegmentOptions(ms, mp4file, track, shared);
  });
}

function setSegmentOptions(ms, mp4file, track, shared) {
  const mime = `video/mp4; codecs="${track.codec}"`;
  if (!MediaSource.isTypeSupported(mime)) {
    throw new Error("MSE does not support: " + mime);
  }

  const sb = ms.addSourceBuffer(mime);
  const ctx = {
    sb,
    id: track.id,
    pending: [],
    shared
  };
  sb.addEventListener("error", e => console.error(e));
  sb.addEventListener("updateend", () => handleUpdateEnd(ctx));
  mp4file.setSegmentOptions(track.id, ctx);
}

function initializeSegmentation(mp4file) {
  mp4file.initializeSegmentation().forEach(seg => {
    const ctx = seg.user;
    console.log(seg);
    ctx.sb.appendBuffer(seg.buffer);
    ctx.pending.push({ isInit: true });
  });
}

function handleSourceOpen(evt, vElem) {
  URL.revokeObjectURL(evt.target.src);

  console.log("handleSourceOpen");
  const ms = evt.target;

  const mp4file = MP4Box.createFile();
  mp4file.onReady = info => {
    console.log("mp4file is ready: ", info);

    ms.duration = info.duration / info.timescale;

    linkMsAndMp4(vElem, ms, mp4file, info);
    initializeSegmentation(mp4file);
  };

  mp4file.onSegment = function(id, user, buffer, sampleNum, isEnd) {
    console.log("onSegment", { id, user, buffer, sampleNum, isEnd });
    const ctx = user;
    ctx.pending.push({
      id: id,
      buffer: buffer,
      sampleNum: sampleNum,
      isEnd: isEnd
    });
    handleUpdateEnd(ctx);
  };

  const dw = (mp4file.dw = new Downloader({
    url,
    chunkSize: 300 * 1024,
    onChunk({ bytes, isEof }) {
      const next = mp4file.appendBuffer(bytes, isEof);
      if (isEof) {
        mp4file.flush();
      } else {
        dw.chunkStart = next;
      }
    }
  }));

  mp4file.dw.start();

  vElem.addEventListener("seeking", () => handleSeeking(vElem, mp4file));
  vElem.addEventListener("timeupdate", () => handleSeeking(vElem, mp4file));
}

function handleSeeking(video, mp4file) {
  if (video.lastSeekTime === video.currentTime) return;

  let start;
  let end;
  for (let i = 0, len = video.buffered.length; i < len; i++) {
    start = video.buffered.start(i);
    end = video.buffered.end(i);
    if (video.currentTime >= start && video.currentTime <= end) {
      return;
    }
  }

  const dw = mp4file.dw;
  const seek = mp4file.seek(video.currentTime, true);
  dw.chunkStart = seek.offset;
  video.currentTime = seek.time;
  dw.stop();
  dw.resume();

  video.lastSeekTime = video.currentTime;
}

function attachMediaSource(vElem) {
  const ms = new MediaSource();
  ms.addEventListener("sourceopen", evt => handleSourceOpen(evt, vElem));
  vElem.src = URL.createObjectURL(ms);
}

function bootstrap() {
  if (!window.MediaSource) throw new Error("Browser does not support MSE");

  const vElem = document.querySelector("video");
  attachMediaSource(vElem);
}

document.addEventListener("DOMContentLoaded", bootstrap);
