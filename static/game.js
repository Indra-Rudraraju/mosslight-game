(() => {
  "use strict";

  const canvas = document.querySelector("#game");
  const context = canvas.getContext("2d");
  const startScreen = document.querySelector("#start-screen");
  const endScreen = document.querySelector("#end-screen");
  const startButton = document.querySelector("#start-button");
  const playAgainButton = document.querySelector("#play-again");
  const scoreForm = document.querySelector("#score-form");
  const nameInput = document.querySelector("#player-name");
  const saveMessage = document.querySelector("#save-message");
  const scoreDisplay = document.querySelector("#score");
  const timerDisplay = document.querySelector("#timer");
  const pulseFill = document.querySelector("#pulse-fill");
  const pulseLabel = document.querySelector("#pulse-label");
  const pausePill = document.querySelector("#pause-pill");
  const leaderboard = document.querySelector("#leaderboard-list");
  const soundToggle = document.querySelector("#sound-toggle");

  const WIDTH = 960;
  const HEIGHT = 516;
  const GAME_DURATION = 60;
  const PULSE_COOLDOWN = 4;
  const keys = new Set();
  let state = "ready";
  let lastTime = 0;
  let elapsed = 0;
  let score = 0;
  let pulseCooldown = 0;
  let spawnClock = 0;
  let audioContext = null;
  let soundOn = true;
  let particles = [];
  let pointerTarget = null;
  let lastTap = 0;
  let lights = [];
  let shadows = [];
  let player = { x: WIDTH / 2, y: HEIGHT / 2, radius: 10, speed: 230, invulnerable: 0 };
  let stars = [];

  function resizeCanvas() {
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(WIDTH * ratio);
    canvas.height = Math.round(HEIGHT * ratio);
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.imageSmoothingEnabled = true;
  }

  function random(min, max) {
    return Math.random() * (max - min) + min;
  }

  function randomPoint(margin = 34) {
    return { x: random(margin, WIDTH - margin), y: random(margin, HEIGHT - margin) };
  }

  function initializeWorld() {
    stars = Array.from({ length: 100 }, () => ({
      x: random(0, WIDTH),
      y: random(0, HEIGHT),
      radius: random(.5, 1.6),
      alpha: random(.12, .6),
      phase: random(0, Math.PI * 2),
    }));
    lights = Array.from({ length: 13 }, () => ({ ...randomPoint(), phase: random(0, 8) }));
    shadows = Array.from({ length: 3 }, (_, index) => ({
      ...randomPoint(70),
      radius: random(9, 13),
      speed: random(28, 43) + index * 2,
      phase: random(0, 8),
    }));
    particles = [];
  }

  function playTone(frequency, duration, type = "sine", volume = .035) {
    if (!soundOn) return;
    try {
      audioContext ??= new window.AudioContext();
      const oscillator = audioContext.createOscillator();
      const gain = audioContext.createGain();
      oscillator.type = type;
      oscillator.frequency.setValueAtTime(frequency, audioContext.currentTime);
      gain.gain.setValueAtTime(volume, audioContext.currentTime);
      gain.gain.exponentialRampToValueAtTime(.001, audioContext.currentTime + duration);
      oscillator.connect(gain);
      gain.connect(audioContext.destination);
      oscillator.start();
      oscillator.stop(audioContext.currentTime + duration);
    } catch (error) {
      console.warn("Audio could not be started.", error);
    }
  }

  function resetGame() {
    elapsed = 0;
    score = 0;
    pulseCooldown = 0;
    spawnClock = 0;
    player = { x: WIDTH / 2, y: HEIGHT / 2, radius: 10, speed: 230, invulnerable: 0 };
    initializeWorld();
    scoreDisplay.textContent = "000";
    timerDisplay.textContent = String(GAME_DURATION);
    pulseFill.style.width = "100%";
    pulseLabel.textContent = "PULSE READY";
    saveMessage.textContent = "";
  }

  function startGame() {
    resetGame();
    state = "playing";
    startScreen.classList.add("hidden");
    endScreen.classList.add("hidden");
    pausePill.classList.add("hidden");
    lastTime = performance.now();
    playTone(440, .14, "triangle", .025);
  }

  function finishGame(won) {
    state = "ended";
    endScreen.classList.remove("hidden");
    document.querySelector("#end-kicker").textContent = won ? "THE GARDEN IS GLOWING" : "THE GARDEN REMEMBERS";
    document.querySelector("#end-title").textContent = won ? "You made it bloom." : "Look what you grew.";
    document.querySelector("#end-copy").textContent = won
      ? `You gathered ${score} starlight${score === 1 ? "" : "s"} and brought the garden back.`
      : `You gathered ${score} starlight${score === 1 ? "" : "s"}. Every little light made a difference.`;
    nameInput.value = "";
    nameInput.focus({ preventScroll: true });
    playTone(won ? 660 : 392, .35, "sine", .04);
  }

  function spawnBurst(x, y, color, count = 12) {
    for (let index = 0; index < count; index += 1) {
      const angle = random(0, Math.PI * 2);
      const speed = random(25, 115);
      particles.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: random(.35, .75),
        maxLife: .75,
        radius: random(1.5, 3.4),
        color,
      });
    }
  }

  function addLight() {
    const point = randomPoint();
    lights.push({ ...point, phase: random(0, 8) });
  }

  function collectLight(index) {
    const [light] = lights.splice(index, 1);
    score += 10;
    scoreDisplay.textContent = String(score).padStart(3, "0");
    spawnBurst(light.x, light.y, "#d5f6a4", 10);
    playTone(660 + Math.random() * 240, .18, "sine", .025);
    addLight();
    if (score >= 120) finishGame(true);
  }

  function pulse() {
    if (state !== "playing" || pulseCooldown > 0) return;
    pulseCooldown = PULSE_COOLDOWN;
    spawnBurst(player.x, player.y, "#baf28b", 30);
    playTone(220, .28, "sine", .06);
    shadows = shadows.filter((shadow) => {
      const distance = Math.hypot(shadow.x - player.x, shadow.y - player.y);
      if (distance < 150) {
        score += 3;
        scoreDisplay.textContent = String(score).padStart(3, "0");
        spawnBurst(shadow.x, shadow.y, "#a5c6aa", 12);
        return false;
      }
      return true;
    });
  }

  function update(delta) {
    if (state !== "playing") return;
    elapsed += delta;
    pulseCooldown = Math.max(0, pulseCooldown - delta);
    player.invulnerable = Math.max(0, player.invulnerable - delta);

    const moveX = Number(keys.has("ArrowRight") || keys.has("d")) - Number(keys.has("ArrowLeft") || keys.has("a"));
    const moveY = Number(keys.has("ArrowDown") || keys.has("s")) - Number(keys.has("ArrowUp") || keys.has("w"));
    let directionX = moveX;
    let directionY = moveY;
    if (pointerTarget) {
      const targetX = pointerTarget.x - player.x;
      const targetY = pointerTarget.y - player.y;
      if (Math.hypot(targetX, targetY) < 8) pointerTarget = null;
      else {
        directionX += targetX / Math.hypot(targetX, targetY);
        directionY += targetY / Math.hypot(targetX, targetY);
      }
    }
    const magnitude = Math.hypot(directionX, directionY) || 1;
    player.x = Math.max(18, Math.min(WIDTH - 18, player.x + (directionX / magnitude) * player.speed * delta));
    player.y = Math.max(18, Math.min(HEIGHT - 18, player.y + (directionY / magnitude) * player.speed * delta));

    for (const light of lights) light.phase += delta;
    for (let index = lights.length - 1; index >= 0; index -= 1) {
      const light = lights[index];
      if (Math.hypot(light.x - player.x, light.y - player.y) < 20) collectLight(index);
    }

    spawnClock += delta;
    if (spawnClock > 3.2 && shadows.length < 8) {
      spawnClock = 0;
      const point = randomPoint(45);
      shadows.push({ ...point, radius: random(9, 13), speed: random(29, 47), phase: 0 });
    }
    for (const shadow of shadows) {
      shadow.phase += delta * 2;
      const angle = Math.atan2(player.y - shadow.y, player.x - shadow.x);
      shadow.x += Math.cos(angle) * shadow.speed * delta;
      shadow.y += Math.sin(angle) * shadow.speed * delta;
      if (Math.hypot(shadow.x - player.x, shadow.y - player.y) < shadow.radius + player.radius && player.invulnerable === 0) {
        player.invulnerable = 1.1;
        score = Math.max(0, score - 5);
        scoreDisplay.textContent = String(score).padStart(3, "0");
        spawnBurst(player.x, player.y, "#d58b91", 11);
        playTone(150, .18, "triangle", .03);
      }
    }
    for (const particle of particles) {
      particle.x += particle.vx * delta;
      particle.y += particle.vy * delta;
      particle.life -= delta;
    }
    particles = particles.filter((particle) => particle.life > 0);

    const secondsLeft = Math.max(0, GAME_DURATION - elapsed);
    timerDisplay.textContent = String(Math.ceil(secondsLeft)).padStart(2, "0");
    pulseFill.style.width = `${((PULSE_COOLDOWN - pulseCooldown) / PULSE_COOLDOWN) * 100}%`;
    pulseLabel.textContent = pulseCooldown > 0 ? "PULSE RECHARGING" : "PULSE READY";
    if (secondsLeft === 0 && state === "playing") finishGame(false);
  }

  function drawBackground(time) {
    const gradient = context.createLinearGradient(0, 0, WIDTH, HEIGHT);
    gradient.addColorStop(0, "#111c24");
    gradient.addColorStop(.55, "#14211f");
    gradient.addColorStop(1, "#17201f");
    context.fillStyle = gradient;
    context.fillRect(0, 0, WIDTH, HEIGHT);

    const glow = context.createRadialGradient(WIDTH * .51, HEIGHT * .52, 8, WIDTH * .51, HEIGHT * .52, 290);
    glow.addColorStop(0, "rgba(150, 193, 125, .12)");
    glow.addColorStop(1, "rgba(150, 193, 125, 0)");
    context.fillStyle = glow;
    context.fillRect(0, 0, WIDTH, HEIGHT);

    for (const star of stars) {
      context.globalAlpha = star.alpha * (.65 + Math.sin(time * .001 + star.phase) * .35);
      context.fillStyle = "#e1e8c9";
      context.beginPath();
      context.arc(star.x, star.y, star.radius, 0, Math.PI * 2);
      context.fill();
    }
    context.globalAlpha = 1;

    context.save();
    context.strokeStyle = "rgba(189, 215, 167, .06)";
    context.lineWidth = 1;
    for (let x = 32; x < WIDTH; x += 48) {
      context.beginPath(); context.moveTo(x, 0); context.lineTo(x, HEIGHT); context.stroke();
    }
    for (let y = 26; y < HEIGHT; y += 48) {
      context.beginPath(); context.moveTo(0, y); context.lineTo(WIDTH, y); context.stroke();
    }
    context.restore();
  }

  function drawLight(light, time) {
    const bob = Math.sin(time * .003 + light.phase) * 3;
    const y = light.y + bob;
    const halo = context.createRadialGradient(light.x, y, 1, light.x, y, 20);
    halo.addColorStop(0, "rgba(218, 249, 158, .46)");
    halo.addColorStop(1, "rgba(218, 249, 158, 0)");
    context.fillStyle = halo;
    context.beginPath(); context.arc(light.x, y, 20, 0, Math.PI * 2); context.fill();
    context.save();
    context.translate(light.x, y);
    context.rotate(Math.sin(time * .0015 + light.phase) * .2);
    context.fillStyle = "#d9f5a8";
    context.beginPath();
    context.moveTo(0, -8); context.lineTo(3, -2); context.lineTo(8, 0); context.lineTo(3, 2);
    context.lineTo(0, 8); context.lineTo(-3, 2); context.lineTo(-8, 0); context.lineTo(-3, -2);
    context.closePath(); context.fill();
    context.restore();
  }

  function drawPlayer(time) {
    if (player.invulnerable > 0 && Math.floor(time / 80) % 2 === 0) return;
    const moving = keys.size > 0 && state === "playing";
    const bob = moving ? Math.sin(time * .02) * 1.5 : Math.sin(time * .003) * 1;
    const halo = context.createRadialGradient(player.x, player.y, 2, player.x, player.y, 31);
    halo.addColorStop(0, "rgba(202, 239, 149, .31)");
    halo.addColorStop(1, "rgba(202, 239, 149, 0)");
    context.fillStyle = halo;
    context.beginPath(); context.arc(player.x, player.y, 31, 0, Math.PI * 2); context.fill();
    context.fillStyle = "#c7ec91";
    context.beginPath(); context.arc(player.x, player.y + bob, player.radius, 0, Math.PI * 2); context.fill();
    context.fillStyle = "#f4f2d0";
    context.beginPath(); context.arc(player.x + 2, player.y + bob - 2, 3, 0, Math.PI * 2); context.fill();
    context.strokeStyle = "rgba(223, 246, 174, .38)";
    context.lineWidth = 1;
    context.beginPath(); context.arc(player.x, player.y + bob, 16, 0, Math.PI * 2); context.stroke();
  }

  function drawShadow(shadow, time) {
    const wobble = Math.sin(time * .002 + shadow.phase) * 2;
    const halo = context.createRadialGradient(shadow.x, shadow.y, 1, shadow.x, shadow.y, 28);
    halo.addColorStop(0, "rgba(139, 118, 161, .32)");
    halo.addColorStop(1, "rgba(139, 118, 161, 0)");
    context.fillStyle = halo;
    context.beginPath(); context.arc(shadow.x, shadow.y, 28, 0, Math.PI * 2); context.fill();
    context.fillStyle = "#8d879b";
    context.beginPath(); context.ellipse(shadow.x, shadow.y + wobble, shadow.radius, shadow.radius * .8, 0, 0, Math.PI * 2); context.fill();
    context.fillStyle = "#22232c";
    context.beginPath(); context.arc(shadow.x - 3, shadow.y + wobble - 1, 1.5, 0, Math.PI * 2); context.arc(shadow.x + 3, shadow.y + wobble - 1, 1.5, 0, Math.PI * 2); context.fill();
  }

  function draw(time) {
    drawBackground(time);
    for (const light of lights) drawLight(light, time);
    for (const shadow of shadows) drawShadow(shadow, time);
    for (const particle of particles) {
      context.globalAlpha = Math.min(1, particle.life / .2);
      context.fillStyle = particle.color;
      context.beginPath(); context.arc(particle.x, particle.y, particle.radius, 0, Math.PI * 2); context.fill();
    }
    context.globalAlpha = 1;
    drawPlayer(time);
  }

  function frame(time) {
    const delta = Math.min((time - lastTime) / 1000, .035);
    if (state === "playing") update(delta);
    draw(time);
    lastTime = time;
    requestAnimationFrame(frame);
  }

  function togglePause() {
    if (state === "playing") {
      state = "paused";
      pausePill.classList.remove("hidden");
    } else if (state === "paused") {
      state = "playing";
      pausePill.classList.add("hidden");
      lastTime = performance.now();
    }
  }

  function renderLeaderboard(scores) {
    leaderboard.replaceChildren();
    if (!scores.length) {
      const empty = document.createElement("span");
      empty.className = "empty-board";
      empty.textContent = "Plant the first little light.";
      leaderboard.append(empty);
      return;
    }
    scores.forEach((entry, index) => {
      const row = document.createElement("div");
      row.className = "board-row";
      const rank = document.createElement("span");
      rank.className = "rank";
      rank.textContent = `0${index + 1}`;
      const name = document.createElement("span");
      name.className = "name";
      name.textContent = entry.name;
      const points = document.createElement("span");
      points.className = "points";
      points.textContent = `${entry.score} ✳`;
      row.append(rank, name, points);
      leaderboard.append(row);
    });
  }

  async function loadLeaderboard() {
    try {
      const response = await fetch("/api/scores");
      if (!response.ok) throw new Error(`Leaderboard returned ${response.status}.`);
      const data = await response.json();
      renderLeaderboard(data.scores);
    } catch (error) {
      console.error("Could not load leaderboard.", error);
      leaderboard.textContent = "The neighborhood board is taking a little nap.";
    }
  }

  scoreForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const submitButton = scoreForm.querySelector("button[type='submit']");
    submitButton.disabled = true;
    saveMessage.textContent = "Planting your score…";
    try {
      const response = await fetch("/api/scores", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: nameInput.value.trim(), score }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || `Score save returned ${response.status}.`);
      renderLeaderboard(data.scores);
      saveMessage.textContent = "Your little light is in the garden.";
      playAgainButton.focus({ preventScroll: true });
    } catch (error) {
      console.error("Could not save score.", error);
      saveMessage.textContent = "Couldn’t save just now. Please try again.";
    } finally {
      submitButton.disabled = false;
    }
  });

  startButton.addEventListener("click", startGame);
  playAgainButton.addEventListener("click", startGame);
  soundToggle.addEventListener("click", () => {
    soundOn = !soundOn;
    soundToggle.textContent = soundOn ? "♫" : "♪";
    soundToggle.setAttribute("aria-label", soundOn ? "Turn sound off" : "Turn sound on");
  });
  window.addEventListener("keydown", (event) => {
    const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
    if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", " "].includes(event.key)) event.preventDefault();
    if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "w", "a", "s", "d"].includes(key)) keys.add(key);
    if (event.key === " " && !event.repeat) pulse();
    if (key === "p" && !event.repeat) togglePause();
    if (key === "Enter" && state === "ready") startGame();
  });
  window.addEventListener("keyup", (event) => {
    keys.delete(event.key.length === 1 ? event.key.toLowerCase() : event.key);
  });
  window.addEventListener("blur", () => keys.clear());
  window.addEventListener("resize", resizeCanvas);
  canvas.addEventListener("pointerdown", (event) => {
    if (state !== "playing") return;
    event.preventDefault();
    const now = performance.now();
    if (now - lastTap < 300) pulse();
    lastTap = now;
    const bounds = canvas.getBoundingClientRect();
    pointerTarget = {
      x: ((event.clientX - bounds.left) / bounds.width) * WIDTH,
      y: ((event.clientY - bounds.top) / bounds.height) * HEIGHT,
    };
  });
  canvas.addEventListener("pointermove", (event) => {
    if (state !== "playing" || event.buttons === 0) return;
    const bounds = canvas.getBoundingClientRect();
    pointerTarget = {
      x: ((event.clientX - bounds.left) / bounds.width) * WIDTH,
      y: ((event.clientY - bounds.top) / bounds.height) * HEIGHT,
    };
  });
  canvas.addEventListener("pointerup", () => {});
  canvas.addEventListener("pointercancel", () => { pointerTarget = null; });

  resizeCanvas();
  initializeWorld();
  loadLeaderboard();
  requestAnimationFrame((time) => {
    lastTime = time;
    frame(time);
  });
})();
