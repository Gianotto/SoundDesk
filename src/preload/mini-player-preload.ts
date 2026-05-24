import { contextBridge, ipcRenderer } from 'electron';
import { CHANNELS } from '@shared/channels';

contextBridge.exposeInMainWorld('miniPlayerApi', {
  onState: (cb: (s: unknown) => void) => {
    ipcRenderer.on(CHANNELS.MINI_PLAYER_STATE, (_e, payload) => cb(payload));
  },
  command: (cmd: 'play-pause' | 'next' | 'prev') => ipcRenderer.send(CHANNELS.MINI_PLAYER_COMMAND, cmd)
});
