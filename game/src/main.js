// Boot and the frame loop. States: title, play, levelup, shop, pause,
// defeat, campaign. Menus answer clicks and keys; the world steps only in
// play. ?selftest=1 runs the headless test instead of the game;
// ?shot=<scene> renders one fixed scene for screenshots.
import { VIEW_W, VIEW_H } from './config.js';
import { newWorld, startRun, stepWorld, applyBoon, buyShopItem, continueFromShop, endRun } from './world.js';
import { render } from './render.js';
import { makeInput } from './input.js';
import { makeAudio } from './audio.js';
import { buildShot } from './shots.js';
import { runSelfTest } from './selftest.js';
import { SKILL_TREE, canBuy, skillCost } from './skills.js';
import { writeSave } from './save.js';
import { HEROES } from './heroes.js';

const canvas = document.getElementById('game');
canvas.width = VIEW_W;
canvas.height = VIEW_H;
const ctx = canvas.getContext('2d');
const world = newWorld();
const audio = makeAudio();
world.sfx = (name) => audio.sfx(name);
const { input, poll, endFrame } = makeInput(canvas);

const params = new URLSearchParams(location.search);
const status = document.getElementById('status');

if (params.get('selftest') === '1') {
  runSelfTest();
} else if (params.get('shot')) {
  buildShot(world, params.get('shot'), Number(params.get('seed') || 1));
  render(ctx, world);
  if (status) status.textContent = `shot ${params.get('shot')}`;
} else {
  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    poll();
    world.mouse.x = input.mouseX;
    world.mouse.y = input.mouseY;
    world.mouse.down = input.mouseDown;
    handleMenus(world, input);
    if (world.state === 'play') stepWorld(world, dt, input);
    render(ctx, world);
    endFrame();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

function handleMenus(world, input) {
  const key = input.key;
  // Global: mute.
  if (key === 'KeyM') {
    world.muted = !world.muted;
    audio.setMuted(world.muted);
  }
  if (world.state === 'title') {
    if (key === 'Digit1' || key === 'Numpad1') world.titleSel = 0;
    if (key === 'Digit2' || key === 'Numpad2') world.titleSel = 1;
    if (key === 'Digit3' || key === 'Numpad3') world.titleSel = 2;
    if (key === 'Enter' || key === 'Space') {
      audio.unlock();
      startRun(world, HEROES[world.titleSel].id);
      return;
    }
    if (input.clicked) {
      // Hero cards.
      let cx = 190;
      for (let i = 0; i < HEROES.length; i++) {
        if (input.clickX >= cx && input.clickX <= cx + 280 && input.clickY >= 200 && input.clickY <= 420) {
          world.titleSel = i;
          audio.unlock();
          return;
        }
        cx += 300;
      }
      // Skill tree nodes (buy on click).
      let sx = 110;
      for (const node of SKILL_TREE) {
        if (input.clickX >= sx && input.clickX <= sx + 128 && input.clickY >= 506 && input.clickY <= 582) {
          if (canBuy(world.save, node)) {
            const tier = (world.save.skills[node.id] || 0);
            world.save.shards -= skillCost(node, tier);
            world.save.skills[node.id] = tier + 1;
            writeSave(world.save);
            audio.sfx('coin');
          }
          return;
        }
        sx += 136;
      }
      // Anywhere else on the title: start with the selected hero.
      if (input.clickY < 478) {
        audio.unlock();
        startRun(world, HEROES[world.titleSel].id);
      }
    }
    return;
  }
  if (world.state === 'play') {
    if (key === 'KeyP' || key === 'Escape') { world.state = 'pause'; return; }
    if (key === 'KeyR') { endRun(world, false); return; }
    return;
  }
  if (world.state === 'pause') {
    if (key === 'KeyP' || key === 'Escape' || key === 'Enter') { world.state = 'play'; return; }
    if (key === 'KeyR') { endRun(world, false); return; }
    return;
  }
  if (world.state === 'levelup') {
    let pick = -1;
    if (key === 'Digit1' || key === 'Numpad1') pick = 0;
    if (key === 'Digit2' || key === 'Numpad2') pick = 1;
    if (key === 'Digit3' || key === 'Numpad3') pick = 2;
    if (input.clicked) {
      let cx = VIEW_W / 2 - 350;
      for (let i = 0; i < 3; i++) {
        if (input.clickX >= cx && input.clickX <= cx + 220 && input.clickY >= 220 && input.clickY <= 420) pick = i;
        cx += 240;
      }
    }
    if (pick >= 0 && world.boonChoices[pick]) {
      audio.sfx('levelup');
      applyBoon(world, world.boonChoices[pick]);
    }
    return;
  }
  if (world.state === 'shop') {
    if (key === 'Enter' || key === 'Space') { continueFromShop(world); return; }
    let buy = -1;
    if (key === 'Digit1') buy = 0;
    if (key === 'Digit2') buy = 1;
    if (key === 'Digit3') buy = 2;
    if (key === 'Digit4') buy = 3;
    if (input.clicked) {
      let y = 182;
      for (let i = 0; i < world.shopStock.length; i++) {
        if (input.clickX >= VIEW_W / 2 - 360 && input.clickX <= VIEW_W / 2 + 360 && input.clickY >= y && input.clickY <= y + 56) buy = i;
        y += 66;
      }
      if (input.clickX >= VIEW_W / 2 - 200 && input.clickX <= VIEW_W / 2 + 200 && input.clickY >= 470 && input.clickY <= 516) {
        continueFromShop(world);
        return;
      }
    }
    if (buy >= 0 && world.shopStock[buy]) buyShopItem(world, world.shopStock[buy]);
    return;
  }
  if (world.state === 'defeat' || world.state === 'campaign') {
    if (key === 'Enter' || key === 'Space') {
      startRun(world, world.hero.def.id);
      return;
    }
    if (key === 'KeyT') { world.state = 'title'; return; }
  }
}
