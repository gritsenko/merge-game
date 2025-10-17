document.addEventListener("DOMContentLoaded", () => {
  // --- КОНФИГУРАЦИЯ ---
  let GRID_SIZE = 4;

  // Mapping for fixed starting counts per size (explicit requirement)
  const START_COUNT_BY_SIZE = {
    3: 3,
    4: 5,
    5: 10,
  };

  // Compute starting caps based on grid size so initial state depends on GRID_SIZE
  function computeStartingCaps(size) {
    const totalCells = size * size;
    // If there's an explicit mapping for this size, use it (clamped to available cells)
    let fillCount =
      START_COUNT_BY_SIZE[size] !== undefined
        ? START_COUNT_BY_SIZE[size]
        : Math.min(Math.max(2, Math.round(totalCells * 0.15)), totalCells - 1);
    fillCount = Math.max(1, Math.min(fillCount, totalCells - 1));

    const caps = [];
    // Distribute cap types evenly: prioritize 1s, then 2s, then 3s
    const types = [1, 2, 3];
    let typeIndex = 0;

    for (let i = 0; i < fillCount; i++) {
      caps.push(types[typeIndex % types.length]);
      typeIndex++;
    }

    // Shuffle the array to randomize the order
    for (let i = caps.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [caps[i], caps[j]] = [caps[j], caps[i]];
    }

    return caps;
  }
  const MIN_SCORE_TO_MOVE = 3;

  // --- DOM И CANVAS ЭЛЕМЕНТЫ ---
  const canvas = document.getElementById("game-canvas");
  const ctx = canvas.getContext("2d");
  const g = Graphics.create(ctx);
  const scoreDisplay = document.getElementById("score");
  const gameContainer = document.getElementById("game-container");

  // --- СОСТОЯНИЕ ИГРЫ ---
  let grid = [];
  let score = 0;
  let nextCapValue = null;
  let isProcessing = false;
  let isDragging = false;
  let draggedCap = { value: null, index: -1, x: 0, y: 0, moveCost: 0 };
  let dropTarget = -1;

  // --- CAMERA SHAKE ---
  let shakeIntensity = 0;
  let shakeDuration = 0;
  let shakeStartTime = 0;

  // --- PARTICLES AND SHOCKWAVES ---
  let particles = [];
  let shockwaves = [];

  // --- TUTORIAL ---
  let isTutorial = false;
  let tutorialFinger = { x: 0, y: 0, startTime: 0, duration: 1000, alpha: 1.0 };
  const fingerImg = new Image();
  fingerImg.src = "hand-tool-1.svg";

  // --- SOUNDS ---
  let soundMuted = false;
  const sounds = {
    pop1: new Audio("sounds/pop1.mp3"),
    pop2: new Audio("sounds/pop2.mp3"),
    pop3: new Audio("sounds/pop3.mp3"),
    miss: new Audio("sounds/miss.mp3"),
    merge: new Audio("sounds/merge.mp3"),
    end: new Audio("sounds/end.mp3"),
    start: new Audio("sounds/start.mp3"),
  };

  // --- ДИНАМИЧЕСКИЙ РАЗМЕР ---
  let boardSize, cellSize, padding, capSize, gap, slotHeight;

  // --- ЦВЕТА ---
  const capColors = {
    1: "#eee4da",
    2: "#ede0c8",
    3: "#f2b179",
    4: "#f59563",
    5: "#f67c5f",
    6: "#f65e3b",
    7: "#edcf72",
    8: "#edcc61",
    9: "#9c8",
    10: "#8b7",
    11: "#7a6",
    12: "#695",
    13: "#f9f6f2",
  };
  const capFontColors = {
    1: "#776e65",
    2: "#776e65",
    13: "#776e65",
  };
  const defaultCapColor = "#3c3a32";
  const defaultFontColor = "#f9f6f2";

  // --- АНИМАЦИИ ---
  let animations = [];

  // --- SOUNDS ---
  function preloadSounds() {
    Object.values(sounds).forEach((sound) => {
      sound.load();
    });
  }

  function playSound(soundName) {
    if (soundMuted) return;
    if (sounds[soundName]) {
      sounds[soundName].currentTime = 0;
      sounds[soundName]
        .play()
        .catch((e) => console.log("Sound play failed:", e));
    }
  }

  function toggleSound() {
    soundMuted = !soundMuted;
    const soundIcon = document.getElementById("sound-icon");
    if (soundMuted) {
      soundIcon.src = "mute.svg";
      soundIcon.alt = "Sound Muted";
    } else {
      // For unmuted state, use a simple speaker emoji as image
      soundIcon.src = "data:image/svg+xml;base64," + btoa('<svg width="24" height="24" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" fill="currentColor"/></svg>');
      soundIcon.alt = "Sound On";
    }
    const soundBtn = document.getElementById("sound-toggle");
    soundBtn.classList.toggle("muted", soundMuted);
  }

  function restartGame() {
    init();
  }

  // --- CAMERA SHAKE ---
  function triggerShake(intensity = 10, duration = 300) {
    shakeIntensity = intensity;
    shakeDuration = duration;
    shakeStartTime = Date.now();
  }

  // --- PARTICLES AND SHOCKWAVES ---
  function createParticles(x, y, count = 8) {
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count + Math.random() * 0.5;
      const speed = 0.5 + Math.random() * 1.5; // Slower speed
      const life = 1200 + Math.random() * 600; // Longer life
      
      particles.push({
        x: x,
        y: y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: life,
        maxLife: life,
        size: 6 + Math.random() * 8, // Larger particles
        // Semitransparent #f9f6f2 color
        r: 249, // #f9
        g: 246, // #f6  
        b: 242  // #f2
      });
    }
  }

  function createShockwave(x, y) {
    shockwaves.push({
      x: x,
      y: y,
      radius: 0,
      maxRadius: capSize * 2.5, // Slightly larger
      life: 800, // Longer duration
      maxLife: 800,
      alpha: 0.8 // More opaque
    });
  }

  function updateParticles() {
    // Update particles
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.x += p.vx;
      p.y += p.vy;
      // No gravity
      p.life -= 16; // assuming ~60fps
      
      if (p.life <= 0) {
        particles.splice(i, 1);
      }
    }
    
    // Update shockwaves
    for (let i = shockwaves.length - 1; i >= 0; i--) {
      const s = shockwaves[i];
      s.life -= 16;
      s.radius = s.maxRadius * (1 - s.life / s.maxLife);
      
      if (s.life <= 0) {
        shockwaves.splice(i, 1);
      }
    }
  }

  // --- ИНИЦИАЛИЗАЦИЯ ИГРЫ ---
  function init() {
    preloadSounds();
    resizeCanvas();
    grid = Array(GRID_SIZE * GRID_SIZE).fill(null);
    score = 0;
    nextCapValue = null;
    isProcessing = false;
    isDragging = false;
    draggedCap = { value: null, index: -1, x: 0, y: 0, moveCost: 0 };
    dropTarget = -1;
    shakeIntensity = 0;
    shakeDuration = 0;
    shakeStartTime = 0;
    particles = [];
    shockwaves = [];
    // Don't reset soundMuted on init - preserve user preference
    animations = [];
    isTutorial = false;
    tutorialFinger.startTime = Date.now();
    updateScore();

    const emptyCells = Array.from(Array(GRID_SIZE * GRID_SIZE).keys());
    const startingCaps = computeStartingCaps(GRID_SIZE);

    // Helper function to check if two cells are adjacent
    function isAdjacent(index1, index2) {
      const row1 = Math.floor(index1 / GRID_SIZE);
      const col1 = index1 % GRID_SIZE;
      const row2 = Math.floor(index2 / GRID_SIZE);
      const col2 = index2 % GRID_SIZE;

      const rowDiff = Math.abs(row1 - row2);
      const colDiff = Math.abs(col1 - col2);

      // Adjacent if same row and adjacent columns, or same column and adjacent rows
      return (
        (rowDiff === 0 && colDiff === 1) || (rowDiff === 1 && colDiff === 0)
      );
    }

    startingCaps.forEach((val) => {
      if (emptyCells.length === 0) return;

      // Find cells that are not adjacent to any existing cap
      const occupiedCells = grid
        .map((cap, idx) => (cap !== null ? idx : -1))
        .filter((idx) => idx !== -1);
      const nonAdjacentCells = emptyCells.filter((cellIndex) => {
        return !occupiedCells.some((occupiedIndex) =>
          isAdjacent(cellIndex, occupiedIndex)
        );
      });

      let availableCells;
      if (nonAdjacentCells.length > 0) {
        // Prefer non-adjacent cells if available
        availableCells = nonAdjacentCells;
      } else {
        // Fall back to all empty cells if no non-adjacent ones exist
        availableCells = emptyCells;
      }

      const randIdx = Math.floor(Math.random() * availableCells.length);
      const cellIndex = availableCells[randIdx];
      // Remove from emptyCells
      const emptyIdx = emptyCells.indexOf(cellIndex);
      emptyCells.splice(emptyIdx, 1);
      grid[cellIndex] = val;
    });

    generateNextCap();
    gameLoop();
  }

  function setupEventListeners() {
    canvas.addEventListener("mousedown", handleInteractionStart);
    canvas.addEventListener("mousemove", handleInteractionMove);
    canvas.addEventListener("mouseup", handleInteractionEnd);
    canvas.addEventListener("mouseleave", handleInteractionEnd);

    canvas.addEventListener("touchstart", handleInteractionStart, {
      passive: false,
    });
    canvas.addEventListener("touchmove", handleInteractionMove, {
      passive: false,
    });
    canvas.addEventListener("touchend", handleInteractionEnd);
    canvas.addEventListener("touchcancel", handleInteractionEnd);

    // Sound toggle button
    const soundToggleBtn = document.getElementById("sound-toggle");
    soundToggleBtn.addEventListener("click", toggleSound);

    // Restart button
    const restartBtn = document.getElementById("restart-btn");
    restartBtn.addEventListener("click", restartGame);

    window.addEventListener("resize", () => {
      resizeCanvas();
    });
  }

  // --- РАЗМЕР И АДАПТИВНОСТЬ ---
  function resizeCanvas() {
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const desiredWidth = viewportWidth * 0.85;
    const desiredHeight = viewportHeight * 0.85;
    const aspectRatio = 1.3; // canvas height / width

    let canvasWidth, canvasHeight;
    if (desiredWidth * aspectRatio <= desiredHeight) {
      // Fit by width
      canvasWidth = desiredWidth;
      canvasHeight = desiredWidth * aspectRatio;
    } else {
      // Fit by height
      canvasHeight = desiredHeight;
      canvasWidth = desiredHeight / aspectRatio;
    }

    boardSize = canvasWidth;
    slotHeight = boardSize * 0.3;
    // Add an extra 10 pixels at the bottom of the canvas for spacing
    const extraBottom = 25; // px
    canvas.width = boardSize;
    canvas.height = boardSize + slotHeight + extraBottom;
    canvas.style.width = `${canvasWidth}px`;
    // Increase the CSS-rendered height by the same extra pixels so layout matches
    canvas.style.height = `${canvasHeight + extraBottom}px`;

    padding = boardSize * 0.04;
    gap = boardSize * 0.03;
    const effectiveBoardSize = boardSize - padding * 2;
    cellSize = (effectiveBoardSize - gap * (GRID_SIZE - 1)) / GRID_SIZE;
    capSize = cellSize;
  }

  // --- ГЛАВНЫЙ ЦИКЛ ОТРИСОВКИ ---
  function gameLoop() {
    updateAnimations();
    updateParticles();
    drawGame();
    requestAnimationFrame(gameLoop);
  }

  function drawGame() {
    ctx.save();

    // Apply camera shake
    if (shakeDuration > 0) {
      const elapsed = Date.now() - shakeStartTime;
      const progress = elapsed / shakeDuration;
      if (progress < 1) {
        const currentIntensity = shakeIntensity * (1 - progress);
        const shakeX = (Math.random() - 0.5) * currentIntensity;
        const shakeY = (Math.random() - 0.5) * currentIntensity;
        ctx.translate(shakeX, shakeY);
      } else {
        shakeDuration = 0;
      }
    }

    g.clear(0, 0, canvas.width, canvas.height);

    for (let i = 0; i < GRID_SIZE * GRID_SIZE; i++) {
      const { x, y } = getCellCoords(i);
      if (dropTarget === i && isDragging) {
        g.roundedRect(
          x,
          y,
          cellSize,
          cellSize,
          capSize * 0.15,
          getComputedStyle(document.documentElement).getPropertyValue(
            "--drop-target-bg"
          )
        );
      } else {
        g.roundedRect(
          x,
          y,
          cellSize,
          cellSize,
          capSize * 0.15,
          getComputedStyle(document.documentElement).getPropertyValue(
            "--cell-bg"
          )
        );
      }
    }

    const slotCoords = getNextCapCoords();
    g.roundedRect(
      slotCoords.x,
      slotCoords.y,
      capSize,
      capSize,
      capSize * 0.15,
      getComputedStyle(document.documentElement).getPropertyValue("--cell-bg")
    );

    for (let i = 0; i < GRID_SIZE * GRID_SIZE; i++) {
      const value = grid[i];
      const isAnimated = animations.some((a) => a.index === i);
      if (
        value !== null &&
        !(isDragging && draggedCap.index === i) &&
        !isAnimated
      ) {
        const { x, y } = getCellCoords(i);
        drawCap(x, y, value, capSize);
      }
    }

    if (nextCapValue !== null && !(isDragging && draggedCap.index === "next")) {
      const { x, y } = getNextCapCoords();
      drawCap(x, y, nextCapValue, capSize);
    }

    animations.forEach((anim) => {
      if (anim.type === "spawn" || anim.type === "merge") {
        const { x, y } = getCellCoords(anim.index);
        const animatedSize = capSize * anim.scale;
        if (grid[anim.index] !== null) {
          drawCap(
            x + (capSize - animatedSize) / 2,
            y + (capSize - animatedSize) / 2,
            grid[anim.index],
            animatedSize
          );
        }
      } else if (anim.type === "collapse") {
        g.withAlpha(anim.alpha, () => {
          drawCap(anim.currentX, anim.currentY, anim.value, capSize);
        });
      }
    });

    if (isDragging) {
      g.withAlpha(0.8, () => {
        drawCap(
          draggedCap.x - capSize / 2,
          draggedCap.y - capSize / 2,
          draggedCap.value,
          capSize
        );
      });

      if (draggedCap.moveCost > 0) {
        const text = `-${draggedCap.moveCost}`;
        const textMetrics = g.measureText(text, {
          font: `bold ${capSize * 0.3}px Arial`,
        });
        g.fillText(
          text,
          draggedCap.x + capSize / 2 - textMetrics.width / 2,
          draggedCap.y - capSize * 0.4,
          {
            font: `bold ${capSize * 0.3}px Arial`,
            align: "left",
            baseline: "bottom",
            color: "#e11d48",
          }
        );
      }
    }

    // Draw shockwaves
    shockwaves.forEach(shockwave => {
      const progress = 1 - shockwave.life / shockwave.maxLife;
      const currentAlpha = shockwave.alpha * (1 - progress);
      
      // Flat circle with fading alpha - semitransparent #f9f6f2
      ctx.fillStyle = `rgba(249, 246, 242, ${currentAlpha})`;
      ctx.beginPath();
      ctx.arc(shockwave.x + capSize/2, shockwave.y + capSize/2, shockwave.radius, 0, Math.PI * 2);
      ctx.fill();
    });

    // Draw particles
    particles.forEach(particle => {
      const alpha = particle.life / particle.maxLife;
      ctx.fillStyle = `rgba(${particle.r}, ${particle.g}, ${particle.b}, ${alpha})`;
      ctx.beginPath();
      ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
      ctx.fill();
    });

    // Draw tutorial finger
    if (isTutorial && nextCapValue !== null) {
      const fingerSize = 256;
      g.withAlpha(tutorialFinger.alpha, () => {
        g.drawImage(
          fingerImg,
          tutorialFinger.x - fingerSize / 2,
          tutorialFinger.y - fingerSize / 2,
          fingerSize,
          fingerSize
        );
      });
    }

    ctx.restore();
  }

  function drawCap(x, y, value, size) {
    const cornerRadius = size * 0.15;
    g.roundedRect(
      x,
      y,
      size,
      size,
      cornerRadius,
      capColors[value] || defaultCapColor
    );
    // Use Graphics helper to draw the cap text so all text rendering is centralized
    g.fillText(String(value), x + size / 2, y + size / 2, {
      font: `bold ${size * 0.5}px Arial`,
      align: "center",
      baseline: "middle",
      color: capFontColors[value] || defaultFontColor,
    });
  }

  // drawRoundedRect moved to graphics.js -> use g.roundedRect

  // --- АНИМАЦИИ ---
  function addAnimation(type, index, duration = 200, options = {}) {
    const startTime = Date.now();
    let animation = {
      type,
      index,
      startTime,
      duration,
      scale: 1.0,
      ...options,
    };
    if (type === "spawn") animation.scale = 0;
    if (type === "merge") animation.scale = 1.2;
    if (type === "collapse") {
      animation.currentX = options.startX;
      animation.currentY = options.startY;
      animation.alpha = 1.0;
    }
    animations.push(animation);
  }

  function updateAnimations() {
    const now = Date.now();
    animations = animations.filter((anim) => {
      const elapsed = now - anim.startTime;
      if (elapsed >= anim.duration) return false;
      const progress = elapsed / anim.duration;
      if (anim.type === "spawn" || anim.type === "spawnNext")
        anim.scale = progress;
      else if (anim.type === "merge")
        anim.scale =
          progress < 0.5
            ? 1 + 0.2 * (progress * 2)
            : 1.2 - 0.2 * ((progress - 0.5) * 2);
      else if (anim.type === "collapse") {
        anim.currentX = anim.startX + (anim.endX - anim.startX) * progress;
        anim.currentY = anim.startY + (anim.endY - anim.startY) * progress;
        anim.alpha = 1 - progress;
      }
      return true;
    });

    // Update tutorial finger
    if (isTutorial && nextCapValue !== null) {
      const elapsed = now - tutorialFinger.startTime;
      const progress =
        (elapsed % tutorialFinger.duration) / tutorialFinger.duration;
      let startCoords = getNextCapCoords();

      startCoords = {
        x: startCoords.x + capSize / 2,
        y: startCoords.y + capSize / 2,
      };

      const endCoords = { x: boardSize / 2, y: boardSize / 2 + capSize / 2 };
      const moveEnd = 0.8;
      const fadeOutEnd = 0.9;
      if (progress < moveEnd) {
        const p = progress / moveEnd;
        tutorialFinger.x = startCoords.x + (endCoords.x - startCoords.x) * p;
        tutorialFinger.y = startCoords.y + (endCoords.y - startCoords.y) * p;
        tutorialFinger.alpha = 1;
      } else if (progress < fadeOutEnd) {
        tutorialFinger.x = endCoords.x;
        tutorialFinger.y = endCoords.y;
        const p = (progress - moveEnd) / (fadeOutEnd - moveEnd);
        tutorialFinger.alpha = 1 - p;
      } else {
        tutorialFinger.x = startCoords.x;
        tutorialFinger.y = startCoords.y;
        const p = (progress - fadeOutEnd) / (1 - fadeOutEnd);
        tutorialFinger.alpha = p;
      }
    }
  }

  // --- ОБРАБОТКА ВЗАИМОДЕЙСТВИЯ ---
  function handleInteractionStart(e) {
    if (isDragging) return;
    if (isTutorial) isTutorial = false;
    e.preventDefault();
    const pos = getInteractionPos(e);

    const nextCapCoords = getNextCapCoords();
    if (
      nextCapValue !== null &&
      pos.x > nextCapCoords.x &&
      pos.x < nextCapCoords.x + capSize &&
      pos.y > nextCapCoords.y &&
      pos.y < nextCapCoords.y + capSize
    ) {
      isDragging = true;
      draggedCap = {
        value: nextCapValue,
        index: "next",
        x: pos.x,
        y: pos.y,
        moveCost: 0,
      };
      canvas.style.cursor = "grabbing";
      return;
    }

    if (isProcessing) return;
    const cellIndex = getCellIndexFromPos(pos.x, pos.y);
    if (cellIndex !== -1 && grid[cellIndex] !== null) {
      if (score >= MIN_SCORE_TO_MOVE) {
        isDragging = true;
        const currentMoveCost = Math.floor(score / 3);
        draggedCap = {
          value: grid[cellIndex],
          index: cellIndex,
          x: pos.x,
          y: pos.y,
          moveCost: currentMoveCost,
        };
        canvas.style.cursor = "grabbing";
      } else {
        // Можно добавить анимацию "покачивания" или смены цвета, чтобы показать, что действие недоступно
      }
    }
  }

  function handleInteractionMove(e) {
    if (!isDragging) return;
    e.preventDefault();
    const pos = getInteractionPos(e);
    draggedCap.x = pos.x;
    draggedCap.y = pos.y;

    const cellIndex = getCellIndexFromPos(pos.x, pos.y);
    if (
      cellIndex !== -1 &&
      grid[cellIndex] === null &&
      cellIndex !== draggedCap.index
    ) {
      dropTarget = cellIndex;
    } else {
      dropTarget = -1;
    }
  }

  function handleInteractionEnd(e) {
    if (!isDragging) return;

    const finalDropTarget = dropTarget;
    if (finalDropTarget !== -1) {
      // Play random pop sound on successful drop
      const popSounds = ["pop1", "pop2", "pop3"];
      const randomPop = popSounds[Math.floor(Math.random() * popSounds.length)];
      playSound(randomPop);

      if (draggedCap.moveCost > 0) {
        score -= draggedCap.moveCost;
        updateScore();
      }
      grid[finalDropTarget] = draggedCap.value;
      
      // Create success effects
      const { x, y } = getCellCoords(finalDropTarget);
      createShockwave(x, y);
      createParticles(x + capSize/2, y + capSize/2);
      
      if (draggedCap.index === "next") {
        nextCapValue = null;
        generateNextCap();
      } else {
        grid[draggedCap.index] = null;
      }
      isProcessing = true;
      setTimeout(() => processMergeCycle(finalDropTarget), 400);
    } else {
      // Play miss sound on wrong drop position
      playSound("miss");
      triggerShake();
    }

    isDragging = false;
    dropTarget = -1;
    draggedCap = { value: null, index: -1, x: 0, y: 0, moveCost: 0 };
    canvas.style.cursor = "pointer";
  }

  // --- ИГРОВАЯ ЛОГИКА ---
  function processMergeCycle(userActionIndex = -1) {
    const merges = findAllMerges();
    if (merges.length > 0) {
      playSound("merge");
      merges.forEach((group) => {
        let sumForScore = 0;
        group.forEach((index) => {
          sumForScore += grid[index];
        });

        // Новая логика начисления очков
        if (group.length > 2) {
          score += sumForScore * (group.length - 1); // Бонус за 3+ фишки
        } else {
          score += sumForScore; // Стандартный счет за 2 фишки
        }

        const commonValue = grid[group[0]];
        const newValue = commonValue + 1; // Возвращаем логику +1

        let collapseTargetIndex = group[0];
        if (userActionIndex !== -1 && group.includes(userActionIndex)) {
          collapseTargetIndex = userActionIndex;
        }

        const targetCoords = getCellCoords(collapseTargetIndex);
        const collapsingIndices = group.filter(
          (idx) => idx !== collapseTargetIndex
        );

        collapsingIndices.forEach((sourceIndex) => {
          const sourceValue = grid[sourceIndex];
          const sourceCoords = getCellCoords(sourceIndex);
          addAnimation("collapse", sourceIndex, 250, {
            value: sourceValue,
            startX: sourceCoords.x,
            startY: sourceCoords.y,
            endX: targetCoords.x,
            endY: targetCoords.y,
          });
          grid[sourceIndex] = null;
        });

        grid[collapseTargetIndex] = newValue;
        addAnimation("merge", collapseTargetIndex, 250);
      });
      updateScore();
      setTimeout(() => processMergeCycle(-1), 300);
    } else {
      if (nextCapValue === null) {
        generateNextCap();
      }
      if (checkGameOver()) {
        showGameOver();
      }
      isProcessing = false;
    }
  }

  function findAllMerges() {
    const merges = [];
    const visited = new Set();
    for (let i = 0; i < grid.length; i++) {
      if (grid[i] !== null && !visited.has(i)) {
        const group = findConnectedGroup(i);
        if (group.length > 1) merges.push(group.sort((a, b) => a - b));
        group.forEach((idx) => visited.add(idx));
      }
    }
    return merges;
  }

  function findConnectedGroup(startIndex) {
    const group = [];
    const valueToMatch = grid[startIndex];
    if (valueToMatch === null) return group;
    const queue = [startIndex];
    const visited = new Set([startIndex]);
    while (queue.length > 0) {
      const currentIndex = queue.shift();
      group.push(currentIndex);
      const neighbors = getNeighbors(currentIndex);
      neighbors.forEach((neighborIndex) => {
        if (
          !visited.has(neighborIndex) &&
          grid[neighborIndex] === valueToMatch
        ) {
          visited.add(neighborIndex);
          queue.push(neighborIndex);
        }
      });
    }
    return group;
  }

  function getNeighbors(index) {
    const neighbors = [];
    const row = Math.floor(index / GRID_SIZE);
    const col = index % GRID_SIZE;
    if (row > 0) neighbors.push(index - GRID_SIZE);
    if (row < GRID_SIZE - 1) neighbors.push(index + GRID_SIZE);
    if (col > 0) neighbors.push(index - 1);
    if (col < GRID_SIZE - 1) neighbors.push(index + 1);
    return neighbors;
  }

  function getEmptyCellIndex() {
    const emptyCells = grid
      .map((val, idx) => (val === null ? idx : -1))
      .filter((idx) => idx !== -1);
    return emptyCells.length > 0 ? emptyCells[0] : -1;
  }

  function updateScore() {
    scoreDisplay.textContent = score;
  }

  function generateNextCap() {
    if (nextCapValue === null) {
      nextCapValue = Math.random() < 0.8 ? 1 : 2;
    }
  }

  function checkGameOver() {
    const hasEmptyCell = grid.includes(null);
    // Игра заканчивается, когда на поле не остается свободных клеток
    return !hasEmptyCell;
  }

  function showGameOver() {
    playSound("end");
    let overlay = document.querySelector("#game-over-overlay");
    if (!overlay) {
      overlay = document.createElement("div");
      overlay.id = "game-over-overlay";
      overlay.innerHTML = `
                <h2>Конец игры!</h2>
                <p>Итоговый счет: <span id="final-score">0</span></p>
                <button id="restart-btn" class="endcard-button">Играть снова</button>
            `;
      gameContainer.appendChild(overlay);
      overlay.querySelector("#restart-btn").addEventListener("click", () => {
        overlay.classList.add("hidden");
        init();
      });
    }
    overlay.querySelector("#final-score").textContent = score;
    overlay.classList.remove("hidden");
  }

  // --- УТИЛИТЫ ---
  function getInteractionPos(evt) {
    const rect = canvas.getBoundingClientRect();
    const touch = evt.touches ? evt.touches[0] : evt;
    return { x: touch.clientX - rect.left, y: touch.clientY - rect.top };
  }

  function getCellIndexFromPos(x, y) {
    if (y > boardSize) return -1;
    for (let i = 0; i < GRID_SIZE * GRID_SIZE; i++) {
      const cell = getCellCoords(i);
      if (
        x > cell.x &&
        x < cell.x + cellSize &&
        y > cell.y &&
        y < cell.y + cellSize
      ) {
        return i;
      }
    }
    return -1;
  }

  function getCellCoords(index) {
    const row = Math.floor(index / GRID_SIZE);
    const col = index % GRID_SIZE;
    return {
      x: padding + col * (cellSize + gap),
      y: padding + row * (cellSize + gap),
    };
  }

  function getNextCapCoords() {
    const slotY = boardSize + (slotHeight - capSize) / 2;
    return {
      x: (canvas.width - capSize) / 2,
      y: slotY,
    };
  }

  // --- ВЫБОР РАЗМЕРА ПОЛЯ (CSS-controlled modal) ---
  const fieldSizeContainer = document.createElement("div");
  fieldSizeContainer.id = "field-size-container";
  fieldSizeContainer.className = "field-size-container";

  const title = document.createElement("h2");
  title.innerText = "Выберите размер поля";
  fieldSizeContainer.appendChild(title);

  [3, 4, 5].forEach((size) => {
    const button = document.createElement("button");
    button.className = "size-btn";
    button.innerText = `${size} x ${size}`;
    button.addEventListener("click", () => {
      setTimeout(() => {
        isTutorial = true;
        tutorialFinger.startTime = Date.now();
      }, 2000);

      GRID_SIZE = size;
      document.body.removeChild(fieldSizeContainer);
      init();
      playSound("start");
    });
    fieldSizeContainer.appendChild(button);
  });

  document.body.appendChild(fieldSizeContainer);

  // --- ЗАПУСК ИГРЫ ---
  init();
  setupEventListeners();
  
  // Initialize sound button state
  const soundIcon = document.getElementById("sound-icon");
  if (soundMuted) {
    soundIcon.src = "mute.svg";
    soundIcon.alt = "Sound Muted";
  } else {
    soundIcon.src = "data:image/svg+xml;base64," + btoa('<svg width="24" height="24" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" fill="currentColor"/></svg>');
    soundIcon.alt = "Sound On";
  }
  const soundBtn = document.getElementById("sound-toggle");
  soundBtn.classList.toggle("muted", soundMuted);
});
