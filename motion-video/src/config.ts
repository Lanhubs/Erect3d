export const FILM = {
  width: 1920,
  height: 1080,
  duration: 35,
  fps: 30,
  route: '/motion/erect3d-film',
} as const
export const scenes = [
  { name: 'Identity', start: 0 },
  { name: 'Floor plan', start: 3 },
  { name: 'Understanding', start: 8 },
  { name: 'Erection', start: 12 },
  { name: 'Realism', start: 19 },
  { name: 'Editability', start: 24 },
  { name: 'Walkthrough', start: 28 },
  { name: 'End frame', start: 32 },
] as const
