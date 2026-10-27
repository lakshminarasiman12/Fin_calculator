(() => {
  "use strict";

  const form = document.querySelector("#yield-form");
  const submitButton = document.querySelector(".calculate-button");
  const resultsBody = document.querySelector("#results");
  const errorBox = document.querySelector("#form-error");
  const resultStatus = document.querySelector("#result-status");
  const themeToggle = document.querySelector("#theme-toggle");
  const metricNodes = new Map(
    [...document.querySelectorAll("[data-metric]")].map((node) => [
      node.dataset.metric,
      node,
    ]),
  );
  const currency = new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  const numberFormat = new Intl.NumberFormat("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)");
  const cursorDot = document.querySelector("#cursor-dot");
  const cursorRing = document.querySelector("#cursor-ring");
  const cursorTrail = document.querySelector("#cursor-trail");
  const pointerState = {
    targetX: 0,
    targetY: 0,
    currentX: 0,
    currentY: 0,
  };
  const currencyShort = new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    notation: "compact",
    maximumFractionDigits: 1,
  });
  let currentOutcomes = [];
  let currentReport = null;
  let ratesAsOf = null;
  let activeChart = "growth";
  let yieldChart = null;

  let sceneObjects = null;
  let surgeTimer = null;
  let animationFrame = null;
  let cursorFrame = null;
  let trailFrame = null;
  let trailContext = null;
  let cursorInitialized = false;
  let trailNodes = [];
  let activeTheme = document.documentElement.dataset.theme;
  let scenePalette = getScenePalette(activeTheme);

  function getScenePalette(theme) {
    return theme === "light"
      ? {
          clear: 0xeaf2f8,
          globe: 0x0284c7,
          orbit: 0x0077b6,
          particle: 0x64748b,
          shapes: [0xd90467, 0x0284c7, 0x4f46e5],
          trailCyan: { rgb: "2, 132, 199", hex: "#0284c7" },
          trailMagenta: { rgb: "217, 4, 103", hex: "#d90467" },
          fallbackStar: "#64748b",
        }
      : {
          clear: 0x02070a,
          globe: 0x00e5ff,
          orbit: 0x00d9f5,
          particle: 0x6ccbd5,
          shapes: [0xff007f, 0xff7a18, 0xff007f],
          trailCyan: { rgb: "0, 229, 255", hex: "#00e5ff" },
          trailMagenta: { rgb: "255, 0, 127", hex: "#ff007f" },
          fallbackStar: "#91f7ff",
        };
  }

  function updateSceneTheme(theme) {
    activeTheme = theme;
    scenePalette = getScenePalette(theme);
    if (!sceneObjects) return;

    if (sceneObjects.renderer) {
      sceneObjects.renderer.setClearColor(scenePalette.clear, 0);
      sceneObjects.globe.material.color.setHex(scenePalette.globe);
      sceneObjects.globe.material.opacity = theme === "light" ? 0.35 : 0.23;
      sceneObjects.orbit.material.color.setHex(scenePalette.orbit);
      sceneObjects.orbit.material.opacity = theme === "light" ? 0.35 : 0.28;
      sceneObjects.shapes.forEach(({ mesh }, index) => {
        mesh.material.color.setHex(scenePalette.shapes[index]);
      });
      sceneObjects.starfield.material.color.setHex(scenePalette.particle);
    }
  }

  function applyTheme(theme) {
    const nextTheme = theme === "light" ? "light" : "dark";
    document.documentElement.dataset.theme = nextTheme;
    themeToggle.setAttribute(
      "aria-label",
      nextTheme === "dark"
        ? "Switch to solar light mode"
        : "Switch to cyber dark mode",
    );
    themeToggle.setAttribute("aria-pressed", String(nextTheme === "light"));
    localStorage.setItem("yield-tax-theme", nextTheme);
    updateSceneTheme(nextTheme);
    if (currentOutcomes.length) renderChart();
  }

  function initializeScene() {
    const canvas = document.querySelector("#scene");
    if (!window.THREE) {
      initializeCanvasFallback(canvas);
      return;
    }

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(
      55,
      window.innerWidth / window.innerHeight,
      0.1,
      100,
    );
    camera.position.z = 8;
    const renderer = new THREE.WebGLRenderer({
      canvas,
      alpha: true,
      antialias: true,
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.7));
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setClearColor(scenePalette.clear, 0);

    const globe = new THREE.Mesh(
      new THREE.IcosahedronGeometry(2.15, 2),
      new THREE.MeshBasicMaterial({
        color: scenePalette.globe,
        wireframe: true,
        transparent: true,
        opacity: activeTheme === "light" ? 0.35 : 0.23,
      }),
    );
    globe.position.set(2.55, 0.1, -1.2);
    scene.add(globe);

    const orbit = new THREE.Mesh(
      new THREE.TorusGeometry(2.75, 0.012, 8, 150),
      new THREE.MeshBasicMaterial({
        color: scenePalette.orbit,
        transparent: true,
        opacity: activeTheme === "light" ? 0.35 : 0.28,
      }),
    );
    orbit.position.copy(globe.position);
    orbit.rotation.set(1.13, 0.28, -0.3);
    scene.add(orbit);

    const shapes = [];
    [
      { geometry: new THREE.OctahedronGeometry(0.37, 0), color: scenePalette.shapes[0], x: -3.3, y: 1.6, z: -1 },
      { geometry: new THREE.OctahedronGeometry(0.26, 0), color: scenePalette.shapes[1], x: 3.5, y: -1.6, z: 0 },
      { geometry: new THREE.OctahedronGeometry(0.2, 0), color: scenePalette.shapes[2], x: -2.3, y: -2.3, z: -2 },
    ].forEach((item, index) => {
      const mesh = new THREE.Mesh(
        item.geometry,
        new THREE.MeshBasicMaterial({
          color: item.color,
          wireframe: true,
          transparent: true,
          opacity: 0.62,
        }),
      );
      mesh.position.set(item.x, item.y, item.z);
      scene.add(mesh);
      shapes.push({ mesh, phase: index * 1.8 });
    });

    const particleCount = 550;
    const particles = new Float32Array(particleCount * 3);
    for (let index = 0; index < particleCount; index += 1) {
      particles[index * 3] = (Math.random() - 0.5) * 22;
      particles[index * 3 + 1] = (Math.random() - 0.5) * 14;
      particles[index * 3 + 2] = -2 - Math.random() * 12;
    }
    const particleGeometry = new THREE.BufferGeometry();
    particleGeometry.setAttribute(
      "position",
      new THREE.BufferAttribute(particles, 3),
    );
    const starfield = new THREE.Points(
      particleGeometry,
      new THREE.PointsMaterial({
        color: scenePalette.particle,
        size: 0.018,
        transparent: true,
        opacity: 0.5,
      }),
    );
    scene.add(starfield);

    sceneObjects = { scene, camera, renderer, globe, orbit, shapes, starfield };
    updateSceneTheme(activeTheme);
    window.addEventListener("resize", resizeScene);

    const clock = new THREE.Clock();
    const animate = () => {
      animationFrame = window.requestAnimationFrame(animate);
      const time = clock.getElapsedTime();
      const speed = sceneObjects.surgeUntil > performance.now() ? 4 : 1;
      updatePointerParallax();
      globe.rotation.y = time * 0.085 * speed + pointerState.currentX * 0.12;
      globe.rotation.x = time * 0.035 * speed + pointerState.currentY * 0.08;
      orbit.rotation.z =
        -0.3 + Math.sin(time * 0.12) * 0.08 + pointerState.currentX * 0.035;
      orbit.material.opacity =
        sceneObjects.surgeUntil > performance.now()
          ? 0.86 + Math.sin(time * 18) * 0.1
          : activeTheme === "light" ? 0.35 : 0.28;
      shapes.forEach(({ mesh, phase }) => {
        mesh.rotation.x = time * 0.16 + phase;
        mesh.rotation.y = time * 0.12 + phase;
      });
      starfield.rotation.y = time * 0.003;
      renderer.render(scene, camera);
    };
    animate();
  }

  function initializeCanvasFallback(canvas) {
    const context = canvas.getContext("2d");
    if (!context) return;

    const resize = () => {
      const pixelRatio = Math.min(window.devicePixelRatio || 1, 1.7);
      canvas.width = Math.round(window.innerWidth * pixelRatio);
      canvas.height = Math.round(window.innerHeight * pixelRatio);
      context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    };
    resize();
    window.addEventListener("resize", resize);
    sceneObjects = { fallback: true, surgeUntil: 0 };

    const stars = Array.from({ length: 180 }, () => ({
      x: Math.random(),
      y: Math.random(),
      radius: Math.random() * 1.3 + 0.25,
      phase: Math.random() * Math.PI * 2,
    }));
    const draw = (now) => {
      animationFrame = window.requestAnimationFrame(draw);
      const width = window.innerWidth;
      const height = window.innerHeight;
      const time = now / 1000;
      updatePointerParallax();
      const surge = sceneObjects.surgeUntil > now;
      const speed = surge ? 4 : 1;
      const centerX = width * 0.77 + pointerState.currentX * 24;
      const centerY = height * 0.45 + pointerState.currentY * 18;
      const radius = Math.min(width * 0.2, height * 0.32, 245);
      const pulse = surge ? 0.7 + Math.sin(time * 28) * 0.25 : 0.2;

      context.clearRect(0, 0, width, height);
      stars.forEach((star) => {
        context.globalAlpha = 0.16 + (Math.sin(time * 0.8 + star.phase) + 1) * 0.16;
        context.fillStyle = scenePalette.fallbackStar;
        context.fillRect(star.x * width, star.y * height, star.radius, star.radius);
      });
      context.globalAlpha = 1;

      context.save();
      context.translate(centerX, centerY);
      context.rotate(-0.38);
      const sceneRgb = activeTheme === "light" ? "2, 132, 199" : "0, 229, 255";
      const sceneHex = activeTheme === "light" ? "#0284c7" : "#00e5ff";
      context.strokeStyle = `rgba(${sceneRgb}, ${pulse})`;
      context.lineWidth = surge ? 1.5 : 0.8;
      context.shadowColor = sceneHex;
      context.shadowBlur = surge ? 19 : 7;
      context.beginPath();
      context.ellipse(0, 0, radius * 1.32, radius * 0.42, 0, 0, Math.PI * 2);
      context.stroke();
      context.restore();

      context.save();
      context.translate(centerX, centerY);
      context.shadowColor = sceneHex;
      context.shadowBlur = surge ? 18 : 8;
      const rotation =
        time * 0.28 * speed + pointerState.currentX * 0.18;
      for (let latitude = -60; latitude <= 60; latitude += 20) {
        const lat = (latitude * Math.PI) / 180;
        context.beginPath();
        for (let step = 0; step <= 72; step += 1) {
          const longitude = (step / 72) * Math.PI * 2;
          const x = Math.cos(lat) * Math.sin(longitude + rotation);
          const z = Math.cos(lat) * Math.cos(longitude + rotation);
          const y = Math.sin(lat);
          const perspective = 1 + z * 0.11;
          const px = x * radius * perspective;
          const py = y * radius * perspective;
          if (step === 0) context.moveTo(px, py);
          else context.lineTo(px, py);
        }
        context.strokeStyle =
          `rgba(${sceneRgb}, ${latitude === 0 ? 0.38 : 0.2})`;
        context.lineWidth = 0.75;
        context.stroke();
      }
      for (let longitudeIndex = 0; longitudeIndex < 8; longitudeIndex += 1) {
        const longitude = (longitudeIndex / 8) * Math.PI;
        context.beginPath();
        for (let step = 0; step <= 72; step += 1) {
          const latitude = (step / 72) * Math.PI - Math.PI / 2;
          const x = Math.cos(latitude) * Math.sin(longitude + rotation);
          const z = Math.cos(latitude) * Math.cos(longitude + rotation);
          const y = Math.sin(latitude);
          const perspective = 1 + z * 0.11;
          const px = x * radius * perspective;
          const py = y * radius * perspective;
          if (step === 0) context.moveTo(px, py);
          else context.lineTo(px, py);
        }
        context.strokeStyle = `rgba(${sceneRgb}, 0.22)`;
        context.lineWidth = 0.7;
        context.stroke();
      }
      context.restore();

      const shapes = [
        { x: width * 0.25, y: height * 0.34, size: 9, color: activeTheme === "light" ? "#d90467" : "#ff007f" },
        { x: width * 0.89, y: height * 0.72, size: 7, color: activeTheme === "light" ? "#0284c7" : "#00e5ff" },
        { x: width * 0.64, y: height * 0.83, size: 5, color: activeTheme === "light" ? "#4f46e5" : "#ff7a18" },
      ];
      shapes.forEach((shape, index) => {
        const wobble = Math.sin(time * 0.6 + index) * 12;
        context.save();
        context.translate(shape.x, shape.y + wobble);
        context.rotate(time * 0.3 * speed + index);
        context.strokeStyle = shape.color;
        context.globalAlpha = 0.58;
        context.shadowColor = shape.color;
        context.shadowBlur = 12;
        context.beginPath();
        context.moveTo(0, -shape.size);
        context.lineTo(shape.size, 0);
        context.lineTo(0, shape.size);
        context.lineTo(-shape.size, 0);
        context.closePath();
        context.stroke();
        context.restore();
      });
    };
    draw(0);
  }

  function resizeScene() {
    if (!sceneObjects) return;
    if (sceneObjects.fallback) return;
    sceneObjects.camera.aspect = window.innerWidth / window.innerHeight;
    sceneObjects.camera.updateProjectionMatrix();
    sceneObjects.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  function updatePointerParallax() {
    pointerState.currentX += (pointerState.targetX - pointerState.currentX) * 0.045;
    pointerState.currentY += (pointerState.targetY - pointerState.currentY) * 0.045;
  }

  function resizeTrailCanvas() {
    const pixelRatio = Math.min(window.devicePixelRatio || 1, 1.7);
    cursorTrail.width = Math.round(window.innerWidth * pixelRatio);
    cursorTrail.height = Math.round(window.innerHeight * pixelRatio);
    trailContext.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  }

  function drawCursorTrail(now) {
    trailFrame = null;
    trailNodes = trailNodes.filter((node) => now - node.createdAt < 800);
    trailContext.clearRect(0, 0, window.innerWidth, window.innerHeight);

    trailContext.save();
    trailContext.lineCap = "round";
    trailContext.lineJoin = "round";
    trailContext.shadowBlur = 13;
    if (trailNodes.length > 1) {
      for (let index = 0; index < trailNodes.length - 1; index += 1) {
        const start = trailNodes[index];
        const end = trailNodes[index + 1];
        const midpointX = (start.x + end.x) / 2;
        const midpointY = (start.y + end.y) / 2;
        const age = (now - Math.min(start.createdAt, end.createdAt)) / 800;
        const alpha = Math.max(0, (1 - age) * 0.72);
        const color = end.color;

        trailContext.beginPath();
        trailContext.moveTo(start.x, start.y);
        trailContext.quadraticCurveTo(start.x, start.y, midpointX, midpointY);
        trailContext.strokeStyle =
          color === "cyan"
            ? `rgba(${scenePalette.trailCyan.rgb}, ${alpha})`
              : `rgba(${scenePalette.trailMagenta.rgb}, ${alpha})`;
        trailContext.shadowColor =
            color === "cyan"
              ? scenePalette.trailCyan.hex
              : scenePalette.trailMagenta.hex;
        trailContext.lineWidth = Math.max(0.5, 3.2 * (1 - age));
        trailContext.stroke();
      }
    }

    trailNodes.forEach((node) => {
      const age = (now - node.createdAt) / 800;
      const progress = Math.max(0, Math.min(1, age));
      const alpha = 1 - progress;
      const color =
        node.color === "cyan"
          ? scenePalette.trailCyan.rgb
          : scenePalette.trailMagenta.rgb;
      trailContext.beginPath();
      trailContext.arc(node.x, node.y, 2 + progress * 15, 0, Math.PI * 2);
      trailContext.strokeStyle = `rgba(${color}, ${alpha * 0.45})`;
      trailContext.shadowColor =
        node.color === "cyan"
          ? scenePalette.trailCyan.hex
          : scenePalette.trailMagenta.hex;
      trailContext.shadowBlur = 9;
      trailContext.lineWidth = 1;
      trailContext.stroke();
    });
    trailContext.restore();

    if (trailNodes.length) trailFrame = window.requestAnimationFrame(drawCursorTrail);
  }

  function animateCursor() {
    cursorFrame = null;
    const easing = reduceMotion.matches ? 1 : 0.15;
    const offsetX = pointerState.cursorX - pointerState.ringX;
    const offsetY = pointerState.cursorY - pointerState.ringY;
    pointerState.ringX += offsetX * easing;
    pointerState.ringY += offsetY * easing;
    cursorRing.style.left = `${pointerState.ringX}px`;
    cursorRing.style.top = `${pointerState.ringY}px`;

    if (Math.abs(offsetX) > 0.15 || Math.abs(offsetY) > 0.15) {
      cursorFrame = window.requestAnimationFrame(animateCursor);
    }
  }

  function handlePointerMove(event) {
    if (event.pointerType === "touch") return;

    const previousX = pointerState.cursorX;
    const previousY = pointerState.cursorY;
    pointerState.cursorX = event.clientX;
    pointerState.cursorY = event.clientY;
    pointerState.targetX = (event.clientX / window.innerWidth - 0.5) * 2;
    pointerState.targetY = (event.clientY / window.innerHeight - 0.5) * 2;
    cursorDot.style.left = `${event.clientX}px`;
    cursorDot.style.top = `${event.clientY}px`;
    cursorDot.classList.add("is-visible");
    cursorRing.classList.add("is-visible");
    cursorRing.classList.remove("is-hidden");

    if (!cursorInitialized) {
      pointerState.ringX = event.clientX;
      pointerState.ringY = event.clientY;
      cursorInitialized = true;
      cursorRing.style.left = `${event.clientX}px`;
      cursorRing.style.top = `${event.clientY}px`;
    }

    if (cursorFrame === null) {
      cursorFrame = window.requestAnimationFrame(animateCursor);
    }

    const hoveredTarget =
      event.target instanceof Element
        ? event.target.closest(
            "input, select, button, tbody tr, a, .pan-control",
          )
        : null;
    cursorRing.classList.toggle("is-hovering", Boolean(hoveredTarget));

    if (finePointer.matches && !reduceMotion.matches) {
      const distance = Math.hypot(
        event.clientX - previousX,
        event.clientY - previousY,
      );
      if (distance >= 3) {
        trailNodes.push({
          x: event.clientX,
          y: event.clientY,
          createdAt: performance.now(),
          color: trailNodes.length % 2 === 0 ? "cyan" : "magenta",
        });
        if (trailNodes.length > 90) trailNodes.shift();
        if (trailFrame !== null) {
          window.cancelAnimationFrame(trailFrame);
          trailFrame = null;
        }
        drawCursorTrail(performance.now());
      }
    }
  }

  function initializeCursorEffects() {
    return;
  }

  function triggerSurge() {
    document.body.classList.add("surge");
    if (sceneObjects) sceneObjects.surgeUntil = performance.now() + 600;
    window.clearTimeout(surgeTimer);
    surgeTimer = window.setTimeout(
      () => document.body.classList.remove("surge"),
      600,
    );
  }

  function formatMetric(key, value) {
    if (key === "Best-performing bank") return String(value);
    if (key === "TDS rate") return `${numberFormat.format(Number(value))}%`;
    return currency.format(Number(value));
  }

  function animateMetric(node, key, nextValue) {
    const value = Number(nextValue);
    if (!Number.isFinite(value) || reduceMotion.matches) {
      node.textContent = formatMetric(key, nextValue);
      return;
    }

    const previous = Number(node.dataset.value || 0);
    const startedAt = performance.now();
    const duration = 250;
    node.dataset.value = String(value);
    node.classList.remove("number-update");
    void node.offsetWidth;
    node.classList.add("number-update");
    const tick = (now) => {
      const progress = Math.min(1, (now - startedAt) / duration);
      const eased = 1 - (1 - progress) ** 3;
      node.textContent = formatMetric(key, previous + (value - previous) * eased);
      if (progress < 1) window.requestAnimationFrame(tick);
    };
    window.requestAnimationFrame(tick);
  }

  function renderResults(outcomes, report) {
    currentOutcomes = outcomes;
    currentReport = report;
    resultsBody.replaceChildren();
    const topBank = report["Best-performing bank"];
    const ordered = [...outcomes].sort(
      (left, right) => right["Final Balance"] - left["Final Balance"],
    );

    ordered.forEach((outcome, index) => {
      const row = document.createElement("tr");
      if (index === 0) row.classList.add("top-row");

      const product = document.createElement("td");
      product.textContent = outcome["Product Name"];
      if (outcome["Bank Name"] === topBank) {
        const badge = document.createElement("span");
        badge.className = "top-pill";
        badge.textContent = "TOP YIELD";
        product.append(" ", badge);
      }
      row.append(product);

      const rate = document.createElement("td");
      rate.className = "rate-value";
      rate.textContent = `${numberFormat.format(outcome["Applied Rate"])}%`;
      row.append(rate);

      const interest = document.createElement("td");
      interest.textContent = currency.format(outcome["Total Interest"]);
      row.append(interest);

      const balance = document.createElement("td");
      balance.textContent = currency.format(outcome["Final Balance"]);
      row.append(balance);
      resultsBody.append(row);
    });

    Object.entries(report).forEach(([key, value]) => {
      const node = metricNodes.get(key);
      if (node) animateMetric(node, key, value);
    });

    const isSenior = document.querySelector("#senior").value === "true";
    const count = outcomes.length;
    resultStatus.textContent =
      `${count} product${count === 1 ? "" : "s"} • ` +
      (isSenior ? "Senior citizen rate applied" : "Standard rate");
    renderFeaturePanels();
  }

  function getCurrentInputs() {
    return {
      principal: Number(document.querySelector("#principal").value),
      years: Number(document.querySelector("#years").value),
      senior: document.querySelector("#senior").value === "true",
      pan: document.querySelector("#pan").checked,
      selectedProduct: document.querySelector("#product").value || null,
    };
  }

  function getProjection(outcome, principal, years, rate = Number(outcome["Applied Rate"])) {
    const inputs = getCurrentInputs();
    const threshold = inputs.senior ? 100000 : 50000;
    const taxRate = inputs.pan ? 0.1 : 0.2;
    const quarterlyFactor = 1 + rate / 400;
    const finalBalance = principal * quarterlyFactor ** (years * 4);
    const totalInterest = finalBalance - principal;
    const yearly = [];
    let previousBalance = principal;
    let totalTds = 0;
    for (let year = 1; year <= Math.ceil(years); year += 1) {
      const elapsed = Math.min(year, years);
      const balance = principal * quarterlyFactor ** (elapsed * 4);
      const interest = balance - previousBalance;
      const tds = interest > threshold ? interest * taxRate : 0;
      yearly.push({ year, balance, interest, tds, netInterest: interest - tds });
      totalTds += tds;
      previousBalance = balance;
    }
    return { finalBalance, totalInterest, yearly, totalTds };
  }

  function renderTableRows(headers, rows) {
    const table = document.createElement("table");
    const head = table.createTHead().insertRow();
    headers.forEach((header) => {
      const cell = document.createElement("th");
      cell.textContent = header;
      head.append(cell);
    });
    const body = table.createTBody();
    rows.forEach((row) => {
      const tr = body.insertRow();
      row.forEach((value) => {
        const cell = tr.insertCell();
        cell.textContent = String(value);
      });
    });
    return table;
  }

  function renderWhatIf() {
    const rateDelta = Number(document.querySelector("#whatif-rate").value);
    const principal = Number(document.querySelector("#whatif-principal").value);
    const years = Number(document.querySelector("#whatif-years").value);
    document.querySelector("#whatif-rate-value").textContent =
      `${rateDelta >= 0 ? "+" : ""}${rateDelta.toFixed(1)} pp`;
    document.querySelector("#whatif-principal-value").textContent =
      currency.format(principal);
    document.querySelector("#whatif-years-value").textContent =
      `${years.toFixed(2)} years`;
    const rows = currentOutcomes.map((outcome) => {
      const rate = Number(outcome["Applied Rate"]) + rateDelta;
      const result = getProjection(outcome, principal, years, rate);
      return [
        outcome["Bank Name"],
        `${rate.toFixed(2)}%`,
        currency.format(result.totalInterest),
        currency.format(result.finalBalance),
      ];
    });
    const container = document.querySelector("#whatif-results");
    container.replaceChildren(renderTableRows(
      ["BANK", "RATE", "GROSS INTEREST", "MATURITY"],
      rows,
    ));
  }

  function renderBreakEven() {
    const threshold = getCurrentInputs().senior ? 100000 : 50000;
    document.querySelector("#breakeven-results").replaceChildren(
      renderTableRows(
        ["BANK", "RATE", "EST. PRINCIPAL TO CROSS THRESHOLD"],
        currentOutcomes.map((outcome) => {
          const rate = Number(outcome["Applied Rate"]);
          const annualInterestFactor = (1 + rate / 400) ** 4 - 1;
          return [
            outcome["Bank Name"],
            `${rate.toFixed(2)}%`,
            currency.format(threshold / annualInterestFactor),
          ];
        }),
      ),
    );
  }

  function renderRealReturns() {
    const inflation = Number(document.querySelector("#inflation-rate").value);
    const container = document.querySelector("#real-return-results");
    if (!Number.isFinite(inflation) || inflation < 0 || inflation > 100) {
      container.textContent = "Enter an inflation rate from 0% to 100%.";
      return;
    }
    container.replaceChildren(renderTableRows(
      ["BANK", "REAL ANNUAL RETURN"],
      currentOutcomes.map((outcome) => {
        const rate = Number(outcome["Applied Rate"]);
        const effectiveAnnual = (1 + rate / 400) ** 4 - 1;
        const realReturn = ((1 + effectiveAnnual) / (1 + inflation / 100) - 1) * 100;
        return [outcome["Bank Name"], `${realReturn.toFixed(2)}%`];
      }),
    ));
  }

  function renderGoals() {
    const target = Number(document.querySelector("#goal-amount").value);
    const years = Number(document.querySelector("#goal-years").value);
    const container = document.querySelector("#goal-results");
    if (!Number.isFinite(target) || target <= 0 || target > 1e12 ||
        !Number.isFinite(years) || years <= 0 || years > 100) {
      container.textContent = "Enter a target up to ₹1,000,000,000,000 and tenure from 0 to 100 years.";
      return;
    }
    const rows = currentOutcomes.map((outcome) => {
      const rate = Number(outcome["Applied Rate"]);
      const quarterlyLog = Math.log1p(rate / 400);
      const exactYearsToDouble = Math.log(2) / (4 * quarterlyLog);
      return [
        outcome["Bank Name"],
        currency.format(target / Math.exp(4 * years * quarterlyLog)),
        `${(72 / rate).toFixed(1)} / ${exactYearsToDouble.toFixed(1)} yrs`,
      ];
    });
    container.replaceChildren(renderTableRows(
      ["BANK", "LUMP SUM NEEDED", "DOUBLE: RULE OF 72 / EXACT"],
      rows,
    ));
  }

  function renderFeaturePanels() {
    if (!currentOutcomes.length) return;
    renderWhatIf();
    renderBreakEven();
    renderRealReturns();
    renderGoals();
    renderChart();
  }

  function chartColors() {
    const light = document.documentElement.dataset.theme === "light";
    return {
      text: light ? "#475569" : "#a7c2c8",
      grid: light ? "rgba(2, 132, 199, .16)" : "rgba(0, 229, 255, .13)",
      palette: light
        ? ["#0077b6", "#d90467", "#4f46e5", "#047857"]
        : ["#00e5ff", "#ff007f", "#7b76ff", "#62ffc2"],
    };
  }

  function renderChart() {
    const canvas = document.querySelector("#yield-chart");
    const context = canvas.getContext("2d");
    if (!window.Chart) {
      context.clearRect(0, 0, canvas.width, canvas.height);
      canvas.parentElement.textContent =
        "Charts need an internet connection to load the chart library.";
      return;
    }
    if (yieldChart) yieldChart.destroy();
    const inputs = getCurrentInputs();
    const colors = chartColors();
    const years = inputs.years;
    const projections = currentOutcomes.map((outcome) =>
      getProjection(outcome, inputs.principal, years),
    );
    const labelsByYear = Array.from({ length: Math.ceil(years) + 1 }, (_, index) =>
      Math.min(index, years),
    );
    const datasets = currentOutcomes.map((outcome, bankIndex) => {
      const rate = Number(outcome["Applied Rate"]);
      const color = colors.palette[bankIndex % colors.palette.length];
      const projection = projections[bankIndex];
      const base = {
        label: outcome["Bank Name"],
        borderColor: color,
        backgroundColor: `${color}35`,
        borderWidth: 2,
        pointRadius: 2,
      };
      if (activeChart === "growth") {
        return {
          ...base,
          data: labelsByYear.map((elapsed) =>
            inputs.principal * (1 + rate / 400) ** (elapsed * 4),
          ),
        };
      }
      if (activeChart === "maturity") {
        return { ...base, data: [projection.finalBalance] };
      }
      if (activeChart === "gross-net") {
        return {
          ...base,
          data: [projection.totalInterest, projection.totalInterest - projection.totalTds],
        };
      }
      if (activeChart === "interest") {
        return {
          ...base,
          fill: true,
          data: labelsByYear.map((elapsed) => {
            const compound = inputs.principal * (1 + rate / 400) ** (elapsed * 4);
            return Math.max(0, compound - inputs.principal - inputs.principal * rate / 100 * elapsed);
          }),
        };
      }
      return {
        ...base,
        data: projection.yearly.map((year) => year.tds),
      };
    });
    const labels = activeChart === "maturity"
      ? currentOutcomes.map((outcome) => outcome["Bank Name"])
      : activeChart === "gross-net"
        ? ["Gross interest", "Net after estimated TDS"]
        : activeChart === "tds"
          ? projections[0].yearly.map((year) => `Year ${year.year}`)
          : labelsByYear.map((year) => `${year} yr`);
    const type = activeChart === "growth" || activeChart === "interest" ? "line" : "bar";
    const chartData = activeChart === "maturity"
      ? { labels, datasets: [{
          label: "Maturity value",
          data: projections.map((projection) => projection.finalBalance),
          backgroundColor: currentOutcomes.map((_, index) =>
            colors.palette[index % colors.palette.length]),
        }] }
      : { labels, datasets };
    yieldChart = new window.Chart(context, {
      type,
      data: chartData,
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { intersect: false, mode: "index" },
        plugins: {
          legend: { labels: { color: colors.text } },
          tooltip: { callbacks: { label: (item) => `${item.dataset.label}: ${currency.format(item.raw)}` } },
        },
        scales: {
          x: { ticks: { color: colors.text }, grid: { color: colors.grid } },
          y: {
            beginAtZero: true,
            ticks: { color: colors.text, callback: (value) => currencyShort.format(value) },
            grid: { color: colors.grid },
          },
        },
      },
    });
  }

  function setHistory() {
    const inputs = getCurrentInputs();
    const item = { ...inputs, savedAt: new Date().toISOString() };
    let history = [];
    try {
      history = JSON.parse(localStorage.getItem("yield-tax-history") || "[]");
      if (!Array.isArray(history)) history = [];
    } catch (error) {
      console.warn("Could not read calculation history.", error);
    }
    history.unshift(item);
    history = history.slice(0, 5);
    try {
      localStorage.setItem("yield-tax-history", JSON.stringify(history));
    } catch (error) {
      console.warn("Could not save calculation history.", error);
    }
    renderHistory(history);
  }

  function renderHistory(history) {
    const list = document.querySelector("#calculation-history");
    list.replaceChildren();
    history.forEach((item) => {
      const li = document.createElement("li");
      const button = document.createElement("button");
      button.type = "button";
      button.className = "history-item";
      button.textContent = `${currency.format(item.principal)} · ${item.years} years`;
      button.title = "Load these inputs and recalculate.";
      button.addEventListener("click", () => {
        document.querySelector("#principal").value = item.principal;
        document.querySelector("#years").value = item.years;
        document.querySelector("#senior").value = String(item.senior);
        document.querySelector("#pan").checked = item.pan;
        document.querySelector("#product").value = item.selectedProduct || "";
        calculate();
      });
      li.append(button);
      list.append(li);
    });
  }

  function downloadFile(filename, content, mimeType) {
    const url = URL.createObjectURL(new Blob([content], { type: mimeType }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function exportRows() {
    return currentOutcomes.map((outcome) => ({
      Bank: outcome["Bank Name"],
      Product: outcome["Product Name"],
      "Annual rate (%)": outcome["Applied Rate"],
      "Gross interest (INR)": outcome["Total Interest"],
      "Maturity value (INR)": outcome["Final Balance"],
      "Estimated TDS (INR)": getProjection(
        outcome,
        getCurrentInputs().principal,
        getCurrentInputs().years,
      ).totalTds,
    }));
  }

  function yearRows() {
    const inputs = getCurrentInputs();
    return currentOutcomes.flatMap((outcome) =>
      getProjection(outcome, inputs.principal, inputs.years).yearly.map((year) => ({
        Bank: outcome["Bank Name"],
        Year: year.year,
        "Balance (INR)": Number(year.balance.toFixed(2)),
        "Gross interest (INR)": Number(year.interest.toFixed(2)),
        "Estimated TDS (INR)": Number(year.tds.toFixed(2)),
        "Net interest (INR)": Number(year.netInterest.toFixed(2)),
      })),
    );
  }

  function setExportMessage(message) {
    document.querySelector("#export-message").textContent = message;
  }

  function checkRateStaleness() {
    if (!ratesAsOf) return;
    const ageDays = (Date.now() - new Date(`${ratesAsOf}T00:00:00`).getTime()) / 86400000;
    const warning = document.querySelector("#stale-warning");
    warning.hidden = !Number.isFinite(ageDays) || ageDays <= 30;
    warning.textContent = warning.hidden
      ? ""
      : `Rate-staleness warning: sample rates are dated ${ratesAsOf}, more than 30 days ago.`;
    document.querySelector("#rates-note").textContent =
      `ILLUSTRATIVE SAMPLE RATES AS OF ${ratesAsOf}`;
  }

  async function calculate(event) {
    event?.preventDefault();
    triggerSurge();
    errorBox.hidden = true;
    submitButton.disabled = true;
    submitButton.querySelector("span").textContent = "SCANNING RATES…";

    const payload = {
      principal: document.querySelector("#principal").value,
      years: document.querySelector("#years").value,
      is_senior_citizen: document.querySelector("#senior").value === "true",
      selected_product: document.querySelector("#product").value || null,
      pan_provided: document.querySelector("#pan").checked,
    };

    try {
      const response = await fetch("/api/calculate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Calculation failed.");
      ratesAsOf = result.rates_as_of;
      renderResults(result.outcomes, result.report);
      checkRateStaleness();
      setHistory();
    } catch (error) {
      errorBox.textContent =
        error instanceof Error ? error.message : "The calculation could not be completed.";
      errorBox.hidden = false;
    } finally {
      submitButton.disabled = false;
      submitButton.querySelector("span").textContent = "CALCULATE YIELDS";
    }
  }

  function makeScenario() {
    return {
      principal: document.querySelector("#principal").value,
      years: document.querySelector("#years").value,
      senior: document.querySelector("#senior").value,
      selectedProduct: document.querySelector("#product").value,
      pan: document.querySelector("#pan").checked,
      inflation: document.querySelector("#inflation-rate").value,
      goalAmount: document.querySelector("#goal-amount").value,
      goalYears: document.querySelector("#goal-years").value,
      whatIfRate: document.querySelector("#whatif-rate").value,
      whatIfPrincipal: document.querySelector("#whatif-principal").value,
      whatIfYears: document.querySelector("#whatif-years").value,
    };
  }

  function applyScenario(scenario) {
    if (!scenario || typeof scenario !== "object" || Array.isArray(scenario)) {
      throw new Error("Scenario JSON must contain an object.");
    }
    const numberFields = [
      "principal", "years", "inflation", "goalAmount", "goalYears",
      "whatIfRate", "whatIfPrincipal", "whatIfYears",
    ];
    if (numberFields.some((key) =>
      scenario[key] === undefined || !Number.isFinite(Number(scenario[key])))) {
      throw new Error("Scenario JSON is missing a valid numeric setting.");
    }
    if (!["true", "false"].includes(String(scenario.senior)) ||
        typeof scenario.pan !== "boolean" ||
        typeof scenario.selectedProduct !== "string" ||
        !["", "Bank A - 1 Year FD", "Bank B - 1 Year FD",
          "Bank C - 1 Year FD", "Bank D - 1 Year FD"].includes(scenario.selectedProduct)) {
      throw new Error("Scenario JSON has invalid senior, PAN, or product settings.");
    }
    document.querySelector("#principal").value = scenario.principal;
    document.querySelector("#years").value = scenario.years;
    document.querySelector("#senior").value = scenario.senior;
    document.querySelector("#product").value = scenario.selectedProduct;
    document.querySelector("#pan").checked = scenario.pan;
    document.querySelector("#inflation-rate").value = scenario.inflation;
    document.querySelector("#goal-amount").value = scenario.goalAmount;
    document.querySelector("#goal-years").value = scenario.goalYears;
    document.querySelector("#whatif-rate").value = scenario.whatIfRate;
    document.querySelector("#whatif-principal").value = scenario.whatIfPrincipal;
    document.querySelector("#whatif-years").value = scenario.whatIfYears;
    calculate();
  }

  function exportCsv() {
    const rows = exportRows();
    if (!rows.length) throw new Error("Calculate a comparison before exporting.");
    const headers = Object.keys(rows[0]);
    const quoteCsv = (value) => `"${String(value).replaceAll('"', '""')}"`;
    const csv = [
      headers.map(quoteCsv).join(","),
      ...rows.map((row) => headers.map((header) => quoteCsv(row[header])).join(",")),
    ].join("\r\n");
    downloadFile("yield-tax-comparison.csv", `\uFEFF${csv}`, "text/csv;charset=utf-8");
  }

  function exportExcel() {
    if (!window.XLSX) throw new Error("Excel export library did not load. Check your internet connection.");
    const comparisons = exportRows();
    if (!comparisons.length) throw new Error("Calculate a comparison before exporting.");
    const workbook = window.XLSX.utils.book_new();
    window.XLSX.utils.book_append_sheet(
      workbook,
      window.XLSX.utils.json_to_sheet(comparisons),
      "Comparison",
    );
    window.XLSX.utils.book_append_sheet(
      workbook,
      window.XLSX.utils.json_to_sheet(yearRows()),
      "Year by year",
    );
    window.XLSX.writeFile(workbook, "yield-tax-report.xlsx");
  }

  function exportPdf() {
    const PdfDocument = window.jspdf && window.jspdf.jsPDF;
    if (!PdfDocument) throw new Error("PDF export library did not load. Check your internet connection.");
    if (!currentOutcomes.length) throw new Error("Calculate a comparison before exporting.");
    const pdf = new PdfDocument();
    pdf.setFontSize(18);
    pdf.text("Yield & Tax Scanner", 14, 18);
    pdf.setFontSize(10);
    const inputs = getCurrentInputs();
    pdf.text(`Principal: ${currency.format(inputs.principal)}`, 14, 28);
    pdf.text(`Tenure: ${inputs.years} years | Rates as of: ${ratesAsOf || "N/A"}`, 14, 35);
    currentOutcomes.forEach((outcome, index) => {
      const projection = getProjection(outcome, inputs.principal, inputs.years);
      const line = `${outcome["Bank Name"]}: ${Number(outcome["Applied Rate"]).toFixed(2)}% | Gross interest ${currency.format(projection.totalInterest)} | Est. TDS ${currency.format(projection.totalTds)} | Maturity ${currency.format(projection.finalBalance)}`;
      pdf.text(line, 14, 48 + index * 10, { maxWidth: 180 });
    });
    pdf.setFontSize(8);
    pdf.text("Illustrative estimates only; not financial, bank, or tax advice.", 14, 285);
    pdf.save("yield-tax-summary.pdf");
  }

  function runExport(action) {
    try {
      action();
      setExportMessage("Export created successfully.");
    } catch (error) {
      setExportMessage(error instanceof Error ? error.message : "Export failed.");
    }
  }

  form.addEventListener("submit", calculate);
  themeToggle.addEventListener("click", () => {
    applyTheme(activeTheme === "dark" ? "light" : "dark");
  });
  document.querySelectorAll(".chart-tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      activeChart = tab.dataset.chart;
      document.querySelectorAll(".chart-tab").forEach((button) => {
        const selected = button === tab;
        button.classList.toggle("is-active", selected);
        button.setAttribute("aria-selected", String(selected));
      });
      renderChart();
    });
  });
  document.querySelectorAll("#whatif-rate, #whatif-principal, #whatif-years")
    .forEach((input) => input.addEventListener("input", renderWhatIf));
  document.querySelector("#inflation-rate").addEventListener("input", renderRealReturns);
  document.querySelectorAll("#goal-amount, #goal-years").forEach((input) =>
    input.addEventListener("input", renderGoals),
  );
  document.querySelector("#save-scenario").addEventListener("click", () => {
    downloadFile(
      "yield-tax-scenario.json",
      JSON.stringify(makeScenario(), null, 2),
      "application/json",
    );
    document.querySelector("#scenario-message").textContent =
      "Scenario JSON downloaded.";
  });
  document.querySelector("#load-scenario").addEventListener("click", () =>
    document.querySelector("#scenario-file").click(),
  );
  document.querySelector("#scenario-file").addEventListener("change", (event) => {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        applyScenario(JSON.parse(String(reader.result)));
        document.querySelector("#scenario-message").textContent =
          "Scenario loaded and recalculated.";
      } catch (error) {
        document.querySelector("#scenario-message").textContent =
          error instanceof Error ? error.message : "Could not load scenario.";
      }
      event.target.value = "";
    };
    reader.onerror = () => {
      document.querySelector("#scenario-message").textContent =
        "Could not read the selected scenario file.";
    };
    reader.readAsText(file);
  });
  document.querySelector("#export-excel").addEventListener("click", () =>
    runExport(exportExcel),
  );
  document.querySelector("#export-pdf").addEventListener("click", () =>
    runExport(exportPdf),
  );
  document.querySelector("#export-csv").addEventListener("click", () =>
    runExport(exportCsv),
  );
  document.querySelectorAll("#principal, #years").forEach((input) => {
    input.addEventListener("input", triggerSurge);
  });
  document.querySelectorAll("#senior, #product, #pan").forEach((input) => {
    input.addEventListener("change", triggerSurge);
  });
  initializeScene();
  applyTheme(activeTheme);
  initializeCursorEffects();
  try {
    const savedHistory = JSON.parse(localStorage.getItem("yield-tax-history") || "[]");
    renderHistory(Array.isArray(savedHistory) ? savedHistory.slice(0, 5) : []);
  } catch (error) {
    console.warn("Could not restore calculation history.", error);
  }
  calculate();

  window.addEventListener("beforeunload", () => {
    if (animationFrame !== null) window.cancelAnimationFrame(animationFrame);
    if (cursorFrame !== null) window.cancelAnimationFrame(cursorFrame);
    if (trailFrame !== null) window.cancelAnimationFrame(trailFrame);
    if (sceneObjects?.renderer) sceneObjects.renderer.dispose();
  });
})();
