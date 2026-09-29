export type Detent = 'peek' | 'half' | 'full';

const ORDER: Detent[] = ['peek', 'half', 'full'];

function detentHeight(d: Detent): number {
  const vh = window.visualViewport?.height ?? innerHeight;
  return d === 'peek' ? 170 : d === 'half' ? vh * 0.52 : vh - 64;
}

/** Bottom-sheet behavior for the panel on narrow screens: drag the grabber to snap between detents, tap it to cycle. */
export function initSheet(panel: HTMLElement, grabber: HTMLElement) {
  let startY = 0;
  let startH = 0;
  let lastY = 0;
  let lastT = 0;
  let velocity = 0;
  let moved = false;

  const set = (d: Detent) => {
    panel.dataset.detent = d;
    panel.style.removeProperty('--sheet-h');
    grabber.setAttribute('aria-label', d === 'full' ? 'Collapse details' : 'Expand details');
  };

  grabber.addEventListener('pointerdown', (e) => {
    grabber.setPointerCapture(e.pointerId);
    startY = lastY = e.clientY;
    lastT = e.timeStamp;
    startH = panel.getBoundingClientRect().height;
    velocity = 0;
    moved = false;
    panel.classList.add('dragging');
  });

  grabber.addEventListener('pointermove', (e) => {
    if (!grabber.hasPointerCapture(e.pointerId)) return;
    const dy = e.clientY - startY;
    if (Math.abs(dy) > 4) moved = true;
    const dt = Math.max(e.timeStamp - lastT, 1);
    velocity = (e.clientY - lastY) / dt;
    lastY = e.clientY;
    lastT = e.timeStamp;
    const h = Math.min(Math.max(startH - dy, 80), detentHeight('full'));
    panel.style.setProperty('--sheet-h', `${h}px`);
  });

  const end = (e: PointerEvent) => {
    if (!grabber.hasPointerCapture(e.pointerId)) return;
    grabber.releasePointerCapture(e.pointerId);
    panel.classList.remove('dragging');
    const current = (panel.dataset.detent as Detent) ?? 'peek';
    if (!moved) {
      set(ORDER[(ORDER.indexOf(current) + 1) % ORDER.length]!);
      return;
    }
    const h = panel.getBoundingClientRect().height;
    // A fast flick wins over position; otherwise snap to the nearest detent.
    if (velocity > 0.8 && current === 'peek') {
      panel.querySelector<HTMLElement>('[data-close]')?.click();
      return;
    }
    if (Math.abs(velocity) > 0.5) {
      const i = ORDER.indexOf(current) + (velocity < 0 ? 1 : -1);
      set(ORDER[Math.min(Math.max(i, 0), ORDER.length - 1)]!);
      return;
    }
    const nearest = ORDER.reduce((a, b) => (Math.abs(detentHeight(b) - h) < Math.abs(detentHeight(a) - h) ? b : a));
    set(nearest);
  };
  grabber.addEventListener('pointerup', end);
  grabber.addEventListener('pointercancel', end);

  return { set };
}
