/** Ícones SVG em linha (traço 2, 24×24, herdam `currentColor`). */
const svg = (body, attrs = '') =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" ${attrs}>${body}</svg>`;

export const icons = {
  bolt: `<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" class="wordmark__bolt"><path d="M13.5 2 4 13.5h6L8.5 22 20 9.5h-6.5L13.5 2Z"/></svg>`,
  offers: svg('<path d="M4 7h16l-1.2 11a2 2 0 0 1-2 1.8H7.2a2 2 0 0 1-2-1.8L4 7Z"/><path d="M9 7V5.5a3 3 0 0 1 6 0V7"/>'),
  ride: svg('<path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.400-6.5 11-6.500 11Z"/><circle cx="12" cy="10" r="2.400"/>'),
  wallet: svg('<rect x="3" y="6" width="18" height="13" rx="2.500"/><path d="M3 10h18"/><path d="M16 14.500h2"/>'),
  phone: svg('<rect x="7" y="2.500" width="10" height="19" rx="2.500"/><path d="M11 18.500h2"/>'),
  clock: svg('<circle cx="12" cy="12" r="8.500"/><path d="M12 7.500V12l3 2"/>'),
  star: `<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="m12 2.600 2.850 5.950 6.550.850-4.800 4.550 1.200 6.500L12 17.300l-5.800 3.150 1.200-6.500-4.800-4.550 6.550-.850L12 2.600Z"/></svg>`,
  store: svg('<path d="M4 10v9h16v-9"/><path d="M3 10 5 4.500h14L21 10a3 3 0 0 1-6 0 3 3 0 0 1-6 0 3 3 0 0 1-6 0Z"/><path d="M10 19v-4.500h4V19"/>'),
  home: svg('<path d="m3.500 11 8.500-7 8.500 7"/><path d="M6 9.500V20h12V9.500"/><path d="M10 20v-5h4v5"/>'),
  check: svg('<path d="m5 12.500 4.500 4.500L19 7.500"/>', 'stroke-width="2.600"'),
  close: svg('<path d="m6 6 12 12M18 6 6 18"/>', 'stroke-width="2.400"'),
  fine: svg('<path d="M12 3 2.500 20h19L12 3Z"/><path d="M12 10v4.500"/><path d="M12 17.300v.2"/>'),
  tip: svg('<path d="M12 21s-7.500-4.600-7.500-10.200A4.300 4.300 0 0 1 12 8a4.300 4.300 0 0 1 7.500 2.800C19.500 16.400 12 21 12 21Z"/>'),
  cash: svg('<rect x="2.500" y="6" width="19" height="12" rx="2"/><circle cx="12" cy="12" r="2.600"/><path d="M6 9.500v5M18 9.500v5"/>'),
  info: svg('<circle cx="12" cy="12" r="8.500"/><path d="M12 11v5"/><path d="M12 7.800v.2"/>'),
  signal: `<svg viewBox="0 0 18 12" fill="currentColor" aria-hidden="true"><rect x="0" y="8" width="3" height="4" rx=".8"/><rect x="5" y="5.500" width="3" height="6.500" rx=".8"/><rect x="10" y="3" width="3" height="9" rx=".8"/><rect x="15" y="0" width="3" height="12" rx=".8" opacity=".35"/></svg>`,
  battery: `<svg viewBox="0 0 26 12" fill="none" aria-hidden="true"><rect x=".6" y=".6" width="21.800" height="10.800" rx="3" stroke="currentColor" stroke-opacity=".5" stroke-width="1.200"/><rect x="2.400" y="2.400" width="7" height="7.200" rx="1.500" fill="currentColor"/><path d="M24 4v4" stroke="currentColor" stroke-opacity=".5" stroke-width="1.600" stroke-linecap="round"/></svg>`,

  target: svg('<circle cx="12" cy="12" r="8.500"/><circle cx="12" cy="12" r="4"/><circle cx="12" cy="12" r=".6"/>'),
  calendar: svg('<rect x="3.500" y="5" width="17" height="15.500" rx="2.500"/><path d="M3.500 10h17M8 3v4M16 3v4"/>'),
  /** Moto com baú, para o alto das telas do app. */
  courier: `<svg class="courier" viewBox="0 0 170 130" fill="none" stroke="currentColor" stroke-width="7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="38" cy="98" r="22"/><circle cx="134" cy="98" r="22"/><path d="M38 98h40l18-34h22l16 34"/><path d="M60 64h36"/><rect x="52" y="18" width="46" height="42" rx="7"/><path d="M118 64l-6-22h14"/></svg>`,

  // Manobras do GPS (seta grande do HUD)
  turnLeft: svg('<path d="M18 21v-7a4 4 0 0 0-4-4H5"/><path d="m9.500 5.500-4.500 4.500 4.500 4.500"/>', 'stroke-width="2.600"'),
  turnRight: svg('<path d="M6 21v-7a4 4 0 0 1 4-4h9"/><path d="m14.500 5.500 4.500 4.500-4.500 4.500"/>', 'stroke-width="2.600"'),
  straight: svg('<path d="M12 21V4"/><path d="m6.500 9.500 5.500-5.500 5.500 5.500"/>', 'stroke-width="2.600"'),
  uturn: svg('<path d="M17 21V9.500a5 5 0 0 0-10 0V16"/><path d="m3 12.500 4 4 4-4"/>', 'stroke-width="2.600"'),
  arrive: svg('<path d="M12 21s-6.500-5.600-6.500-11a6.500 6.500 0 0 1 13 0c0 5.400-6.500 11-6.500 11Z"/><path d="m9.300 10.200 2 2 3.500-3.700"/>', 'stroke-width="2.400"'),
};
