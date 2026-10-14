import { COLORS, FONT_FAMILY, cssColor } from '../config';

// Telefonda ekran dikeyse oyunun üstünü kaplayan uyarı: "Telefonu yan çevirin".
// Bir DOM katmanıdır (oyun tuvali dikeyde çok küçülür, uyarı tam ekran okunmalı). Uygulama boyunca bir kez kurulur.

const STYLE = `
#rotate-warning {
  position: fixed; inset: 0; z-index: 10; display: none;
  flex-direction: column; align-items: center; justify-content: center; gap: 22px;
  background: ${cssColor(COLORS.background)}; color: ${cssColor(COLORS.text)};
  font-family: ${FONT_FAMILY}; text-align: center; padding: 24px;
}
#rotate-warning .phone {
  width: 56px; height: 96px; border: 3px solid ${cssColor(COLORS.pathEdge)}; border-radius: 12px;
  box-shadow: 0 0 18px ${cssColor(COLORS.pathEdge)}, inset 0 0 12px rgba(45, 226, 230, 0.35);
  animation: rotate-hint 2.4s ease-in-out infinite;
}
#rotate-warning .title {
  font-size: 26px; font-weight: 700; letter-spacing: 1px;
  text-shadow: 0 0 14px ${cssColor(COLORS.pathEdge)};
}
#rotate-warning .sub { font-size: 16px; color: ${cssColor(COLORS.textDim)}; max-width: 280px; line-height: 1.4; }
@keyframes rotate-hint { 0%, 25% { transform: rotate(0deg); } 55%, 85% { transform: rotate(-90deg); } 100% { transform: rotate(0deg); } }
`;

let installed = false;

/** Dikey telefon ekranında mı? (Oyun sahnesi bunu görünce dalga sırasında kendini duraklatır.) */
export function isPortraitPhone(): boolean {
  const portrait = window.innerHeight > window.innerWidth;
  const phone = window.matchMedia('(pointer: coarse)').matches || Math.min(window.innerWidth, window.innerHeight) < 600;
  return portrait && phone;
}

export function installOrientationWarning(): void {
  if (installed) return;
  installed = true;
  const style = document.createElement('style');
  style.textContent = STYLE;
  document.head.appendChild(style);

  const root = document.createElement('div');
  root.id = 'rotate-warning';
  root.setAttribute('role', 'alert');
  const phone = document.createElement('div');
  phone.className = 'phone';
  const title = document.createElement('div');
  title.className = 'title';
  title.textContent = 'Telefonu yan çevirin';
  const sub = document.createElement('div');
  sub.className = 'sub';
  sub.textContent = 'Neon Kale yatay ekranda oynanır. Oyun kaldığı yerde sizi bekler.';
  root.append(phone, title, sub);
  document.body.appendChild(root);

  const update = (): void => {
    root.style.display = isPortraitPhone() ? 'flex' : 'none';
  };
  window.addEventListener('resize', update);
  window.addEventListener('orientationchange', update);
  update();
}
