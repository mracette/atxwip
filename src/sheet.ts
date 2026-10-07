export type Detent = 'peek' | 'half' | 'full';

const ORDER: Detent[] = ['peek', 'half', 'full'];

function detentHeight(d: Detent): number {
  const vh = window.visualViewport?.height ?? innerHeight;
  return d === 'peek' ? 170 : d === 'half' ? vh * 0.52 : vh - 64;
}

/**
 * Should a vertical swipe that starts on the sheet's content move the sheet
 * rather than scroll the content? Swiping up grows the sheet until it is full;
 * swiping down shrinks it once the content is scrolled to the top.
 */
export function swipeMovesSheet(detent: Detent, dy: number, scrollTop: number): boolean {
  if (detent === 'peek') return true;
  if (dy < 0) return detent !== 'full';
  return scrollTop <= 0;
}

/**
 * Bottom-sheet behavior for the panel on narrow screens. Drag the grabber (or
 * tap it to cycle), or swipe the content itself, to snap between detents.
 */
export function initSheet(panel: HTMLElement, grabber: HTMLElement, scroller: HTMLElement) {
  let startY = 0;
  let startH = 0;
  let lastY = 0;
  let lastT = 0;
  let velocity = 0;
  let moved = false;

  const detent = () => (panel.dataset.detent as Detent | undefined) ?? 'peek';

  const set = (d: Detent) => {
    panel.dataset.detent = d;
    panel.style.removeProperty('--sheet-h');
    grabber.setAttribute('aria-label', d === 'full' ? 'Collapse details' : 'Expand details');
  };

  const begin = (y: number, t: number) => {
    startY = lastY = y;
    lastT = t;
    startH = panel.getBoundingClientRect().height;
    velocity = 0;
    moved = false;
    panel.classList.add('dragging');
  };

  const move = (y: number, t: number) => {
    const dy = y - startY;
    if (Math.abs(dy) > 4) moved = true;
    velocity = (y - lastY) / Math.max(t - lastT, 1);
    lastY = y;
    lastT = t;
    const h = Math.min(Math.max(startH - dy, 80), detentHeight('full'));
    panel.style.setProperty('--sheet-h', `${h}px`);
  };

  const finish = () => {
    panel.classList.remove('dragging');
    const current = detent();
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

  grabber.addEventListener('pointerdown', (e) => {
    grabber.setPointerCapture(e.pointerId);
    begin(e.clientY, e.timeStamp);
  });
  grabber.addEventListener('pointermove', (e) => {
    if (grabber.hasPointerCapture(e.pointerId)) move(e.clientY, e.timeStamp);
  });
  const end = (e: PointerEvent) => {
    if (!grabber.hasPointerCapture(e.pointerId)) return;
    grabber.releasePointerCapture(e.pointerId);
    finish();
  };
  grabber.addEventListener('pointerup', end);
  grabber.addEventListener('pointercancel', end);

  // Touch events rather than pointer events: only they let the first move decide between dragging and native scrolling.
  let touch: { x: number; y: number; dragging: boolean | null } | null = null;
  scroller.addEventListener('touchstart', (e) => {
    const t = e.touches[0];
    touch = e.touches.length === 1 && t && panel.dataset.detent ? { x: t.clientX, y: t.clientY, dragging: null } : null;
  }, { passive: true });
  scroller.addEventListener('touchmove', (e) => {
    const t = e.touches[0];
    if (!touch || !t) return;
    if (touch.dragging === null) {
      const dx = t.clientX - touch.x;
      const dy = t.clientY - touch.y;
      if (dx === 0 && dy === 0) return;
      touch.dragging = Math.abs(dy) >= Math.abs(dx) && swipeMovesSheet(detent(), dy, scroller.scrollTop);
      if (touch.dragging) begin(touch.y, e.timeStamp);
    }
    if (!touch.dragging) return;
    e.preventDefault();
    move(t.clientY, e.timeStamp);
  }, { passive: false });
  const touchEnd = () => {
    if (touch?.dragging) {
      moved = true;
      finish();
    }
    touch = null;
  };
  scroller.addEventListener('touchend', touchEnd);
  scroller.addEventListener('touchcancel', touchEnd);

  return { set };
}
