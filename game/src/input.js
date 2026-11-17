// Keyboard + mouse, read once per frame into a plain object the world
// steps from. Clicks are also exposed as one-frame pulses for menus.
export function makeInput(canvas) {
  const keys = {};
  const input = {
    up: false, down: false, left: false, right: false,
    attack: false, dash: false, special: false, potion: false, interact: false,
    mouseX: 640, mouseY: 360, mouseDown: false,
    clickX: -1, clickY: -1, clicked: false, key: null,
  };
  const codeMap = {
    KeyW: 'up', ArrowUp: 'up', KeyS: 'down', ArrowDown: 'down',
    KeyA: 'left', ArrowLeft: 'left', KeyD: 'right', ArrowRight: 'right',
  };
  window.addEventListener('keydown', (e) => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
    keys[e.code] = true;
    input.key = e.code;
    if (e.code === 'Space') input.dash = true;
    if (e.code === 'KeyQ') input.special = true;
    if (e.code === 'Digit1' || e.code === 'KeyH') input.potion = true;
    if (e.code === 'KeyE') input.interact = true;
    if (e.code === 'KeyJ') input.attack = true;
  });
  window.addEventListener('keyup', (e) => { keys[e.code] = false; });
  canvas.addEventListener('mousemove', (e) => {
    const r = canvas.getBoundingClientRect();
    input.mouseX = (e.clientX - r.left) * (canvas.width / r.width);
    input.mouseY = (e.clientY - r.top) * (canvas.height / r.height);
  });
  canvas.addEventListener('mousedown', (e) => {
    input.mouseDown = true;
    input.clicked = true;
    input.clickX = input.mouseX; input.clickY = input.mouseY;
    if (e.button === 0) input.attack = true;
  });
  window.addEventListener('mouseup', () => { input.mouseDown = false; });
  window.addEventListener('blur', () => { for (const k in keys) keys[k] = false; input.mouseDown = false; });

  function poll() {
    input.up = !!(keys.KeyW || keys.ArrowUp);
    input.down = !!(keys.KeyS || keys.ArrowDown);
    input.left = !!(keys.KeyA || keys.ArrowLeft);
    input.right = !!(keys.KeyD || keys.ArrowRight);
    return input;
  }
  function endFrame() {
    input.dash = false; input.special = false; input.potion = false;
    input.interact = false; input.attack = false; input.clicked = false;
    input.key = null;
  }
  return { input, poll, endFrame };
}
