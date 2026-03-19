import React from 'react';

// ─── Icons (inline SVG for mobile perf) ───
const Icon = ({ d, size = 20, color = "currentColor", strokeWidth = 2 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">{typeof d === 'string' ? <path d={d}/> : d}</svg>
);
const Icons = {
  dumbbell: (p) => <Icon {...p} d={<><path d="M14.4 14.4 9.6 9.6"/><path d="M18.657 21.485a2 2 0 1 1-2.829-2.828l-1.767-1.768a2 2 0 1 1-2.829-2.829l6.364-6.364a2 2 0 1 1 2.829 2.829l1.767 1.767a2 2 0 1 1 2.829 2.829z"/><path d="m21.5 21.5-1.4-1.4"/><path d="M3.9 3.9 2.5 2.5"/><path d="M6.404 12.768a2 2 0 1 1-2.829-2.829l1.768-1.767a2 2 0 1 1-2.828-2.829l2.828-2.828a2 2 0 1 1 2.829 2.828l1.767-1.768a2 2 0 1 1 2.829 2.829z"/></>}/>,
  flame: (p) => <Icon {...p} d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/>,
  scale: (p) => <Icon {...p} d={<><path d="m16 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z"/><path d="m2 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z"/><path d="M7 21h10"/><path d="M12 3v18"/><path d="M3 7h2c2 0 5-1 7-2 2 1 5 2 7 2h2"/></>}/>,
  chart: (p) => <Icon {...p} d={<><path d="M3 3v18h18"/><path d="m19 9-5 5-4-4-3 3"/></>}/>,
  target: (p) => <Icon {...p} d={<><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></>}/>,
  plus: (p) => <Icon {...p} d={<><path d="M5 12h14"/><path d="M12 5v14"/></>}/>,
  x: (p) => <Icon {...p} d={<><path d="M18 6 6 18"/><path d="m6 6 12 12"/></>}/>,
  check: (p) => <Icon {...p} d="M20 6 9 17l-5-5"/>,
  trash: (p) => <Icon {...p} d={<><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></>}/>,
  chevDown: (p) => <Icon {...p} d="m6 9 6 6 6-6"/>,
  chevRight: (p) => <Icon {...p} d="m9 18 6-6-6-6"/>,
  fork: (p) => <Icon {...p} d={<><path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2"/><path d="M7 2v20"/><path d="M21 15V2v0a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7"/></>}/>,
  activity: (p) => <Icon {...p} d="M22 12h-4l-3 9L9 3l-3 9H2"/>,
  droplet: (p) => <Icon {...p} d="M12 22a7 7 0 0 0 7-7c0-2-1-3.9-3-5.5s-3.5-4-4-6.5c-.5 2.5-2 4.9-4 6.5C6 11.1 5 13 5 15a7 7 0 0 0 7 7z"/>,
  arrowUp: (p) => <Icon {...p} d={<><path d="m5 12 7-7 7 7"/><path d="M12 19V5"/></>}/>,
  arrowDown: (p) => <Icon {...p} d={<><path d="M12 5v14"/><path d="m19 12-7 7-7-7"/></>}/>,
  refresh: (p) => <Icon {...p} d={<><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/></>}/>,
  zap: (p) => <Icon {...p} d="M13 2 3 14h9l-1 8 10-12h-9l1-8z"/>,
  play: (p) => <Icon {...p} d={<><polygon points="5 3 19 12 5 21 5 3" fill={p?.color||"currentColor"} stroke="none"/></>}/>,
  extLink: (p) => <Icon {...p} d={<><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></>}/>,
  calendar: (p) => <Icon {...p} d={<><rect width="18" height="18" x="3" y="4" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></>}/>,
  chevLeft: (p) => <Icon {...p} d="m15 18-6-6 6-6"/>,
  clock: (p) => <Icon {...p} d={<><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></>}/>,
  search: (p) => <Icon {...p} d={<><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></>}/>,
  trophy: (p) => <Icon {...p} d={<><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/></>}/>,
  moon: (p) => <Icon {...p} d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>,
  pause: (p) => <Icon {...p} d={<><rect width="4" height="16" x="6" y="4"/><rect width="4" height="16" x="14" y="4"/></>}/>,
  copy: (p) => <Icon {...p} d={<><rect width="14" height="14" x="8" y="8" rx="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></>}/>,
  scan: (p) => <Icon {...p} d={<><path d="M3 7V5a2 2 0 0 1 2-2h2"/><path d="M17 3h2a2 2 0 0 1 2 2v2"/><path d="M21 17v2a2 2 0 0 1-2 2h-2"/><path d="M7 21H5a2 2 0 0 1-2-2v-2"/><line x1="7" y1="12" x2="17" y2="12"/></>}/>,
  download: (p) => <Icon {...p} d={<><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></>}/>,
  upload: (p) => <Icon {...p} d={<><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></>}/>,
  hash: (p) => <Icon {...p} d={<><line x1="4" y1="9" x2="20" y2="9"/><line x1="4" y1="15" x2="20" y2="15"/><line x1="10" y1="3" x2="8" y2="21"/><line x1="16" y1="3" x2="14" y2="21"/></>}/>,
  sliders: (p) => <Icon {...p} d={<><line x1="4" y1="21" x2="4" y2="14"/><line x1="4" y1="10" x2="4" y2="3"/><line x1="12" y1="21" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="3"/><line x1="20" y1="21" x2="20" y2="16"/><line x1="20" y1="12" x2="20" y2="3"/><line x1="1" y1="14" x2="7" y2="14"/><line x1="9" y1="8" x2="15" y2="8"/><line x1="17" y1="16" x2="23" y2="16"/></>}/>,
};

export { Icon, Icons };
