import type { WebContents } from 'electron';

export interface Controls {
  play(): void;
  pause(): void;
  togglePlayPause(): void;
  next(): void;
  prev(): void;
  setVolume(level: number): void;
  setKnownPlaying(isPlaying: boolean): void;
}

const SEL = {
  playPause: '.playControl, button[aria-label="Play"], button[aria-label="Pause"]',
  next: '.skipControl__next, button[aria-label="Next"]',
  prev: '.skipControl__previous, button[aria-label="Previous"]'
};

function dispatchScript(sel: string): string {
  return `(function(){
    var el = document.querySelector(${JSON.stringify(sel)});
    if (!el) { console.warn('[sd] element not found for selector:', ${JSON.stringify(sel)}); return; }
    console.log('[sd] dispatching click on', el.className || el.tagName);
    ['mousedown','mouseup','click'].forEach(function(t){
      el.dispatchEvent(new MouseEvent(t,{bubbles:true,cancelable:true,view:window}));
    });
  })()`;
}

export function createControls(getTargetWebContents: () => WebContents | null): Controls {
  let knownPlaying = false;

  const exec = (js: string) => {
    const wc = getTargetWebContents();
    if (!wc) { console.error('[controls] no target webContents'); return; }
    wc.executeJavaScript(js, true).catch((e: unknown) =>
      console.error('[controls] executeJavaScript failed:', e)
    );
  };

  return {
    play() {
      if (knownPlaying) return;
      exec(dispatchScript(SEL.playPause));
      knownPlaying = true;
    },
    pause() {
      if (!knownPlaying) return;
      exec(dispatchScript(SEL.playPause));
      knownPlaying = false;
    },
    togglePlayPause() {
      exec(dispatchScript(SEL.playPause));
      knownPlaying = !knownPlaying;
    },
    next() { exec(dispatchScript(SEL.next)); },
    prev() { exec(dispatchScript(SEL.prev)); },
    setVolume(level) {
      const v = Math.max(0, Math.min(100, level)) / 100;
      exec(`(function(){
        var nodes = window.__sdGainNodes || [];
        var count = 0;
        for (var i = 0; i < nodes.length; i++) {
          try {
            if (nodes[i] && nodes[i].gain) { nodes[i].gain.value = ${v}; count++; }
          } catch(e) {}
        }
        if (count === 0) console.warn('[sd] no gain nodes tracked (nodes array length:', nodes.length, ')');
        else console.log('[sd] volume', ${v}, 'applied to', count, 'gain nodes');
      })()`);
    },
    setKnownPlaying(v) { knownPlaying = v; }
  };
}
