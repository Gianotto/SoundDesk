export const CHANNELS = {
  // scraper → main (events from preload)
  TRACK_CHANGE: 'sd:track-change',
  PLAY_STATE_CHANGE: 'sd:play-state-change',
  SEEK_DETECTED: 'sd:seek-detected',
  SCRAPER_HEALTH: 'sd:scraper-health',

  // main → preload (transport commands)
  CONTROL_PLAY: 'sd:control:play',
  CONTROL_PAUSE: 'sd:control:pause',
  CONTROL_NEXT: 'sd:control:next',
  CONTROL_PREV: 'sd:control:prev',

  // main → mini-player renderer
  MINI_PLAYER_STATE: 'sd:mini-player:state',

  // mini-player renderer → main
  MINI_PLAYER_COMMAND: 'sd:mini-player:command'
} as const;

export type ChannelName = (typeof CHANNELS)[keyof typeof CHANNELS];
