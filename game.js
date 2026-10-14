(() => {
  "use strict";

  const SAVE_KEY = "bitcoin-miner-save-v1";
  const LEGACY_SAVE_KEY = "cookie-atelier-save-v1";
  const SOUND_KEY = "bitcoin-miner-sound-enabled";
  const buildings = [
    { id: "grandma", name: "Solo miner", icon: "⌘", description: "A modest rig. The first hashes count.", baseCost: 15, cps: 0.1 },
    { id: "oven", name: "GPU mining rig", icon: "▤", description: "Graphics cards put in the overtime.", baseCost: 100, cps: 1 },
    { id: "farm", name: "ASIC miner", icon: "▥", description: "Purpose-built silicon. Serious hash rate.", baseCost: 650, cps: 5 },
    { id: "bakery", name: "Mining warehouse", icon: "▦", description: "Rows of rigs, all hashing in sync.", baseCost: 4000, cps: 20 },
    { id: "truck", name: "Mining pool", icon: "◉", description: "Combine your power. Share the block reward.", baseCost: 18000, cps: 75 },
    { id: "factory", name: "Hydro-powered facility", icon: "ϟ", description: "Industrial scale, powered by clean energy.", baseCost: 100000, cps: 300 },
  ];

  const upgrades = [
    { id: "rolling-pin", name: "Overclock your rig", icon: "ϟ", description: "Double the sats earned per manual hash.", baseCost: 50, effect: "click", multiplier: 2, requirementType: "total", requirementValue: 25 },
    { id: "family-recipe", name: "Open-source firmware", icon: "⌘", description: "Double your solo miners' output.", baseCost: 250, effect: "production", multiplier: 2, requirementType: "building:grandma", requirementValue: 2 },
    { id: "copper-trays", name: "Next-gen GPU cluster", icon: "▤", description: "Double the sats earned per manual hash.", baseCost: 1200, effect: "click", multiplier: 2, requirementType: "total", requirementValue: 500 },
    { id: "double-oven", name: "Liquid-cooled ASICs", icon: "❄", description: "Double your entire mining operation.", baseCost: 5000, effect: "production", multiplier: 2, requirementType: "building:oven", requirementValue: 5 },
    { id: "secret-ingredient", name: "Silicon lottery", icon: "✦", description: "Triple the sats earned per manual hash.", baseCost: 16000, effect: "click", multiplier: 3, requirementType: "total", requirementValue: 10000 },
    { id: "sugar-rush", name: "Renewable energy grid", icon: "ϟ", description: "Double your entire mining operation.", baseCost: 50000, effect: "production", multiplier: 2, requirementType: "building:farm", requirementValue: 5 },
    { id: "golden-touch", name: "Satoshi's secret", icon: "₿", description: "Triple the sats earned per manual hash.", baseCost: 120000, effect: "click", multiplier: 3, requirementType: "total", requirementValue: 100000 },
  ];

  const milestones = [
    { id: "first-cookie", name: "First sat", icon: "₿", description: "Mine your very first satoshi.", goal: 1 },
    { id: "dozen", name: "Stacking sats", icon: "◈", description: "Mine 13 satoshis.", goal: 13 },
    { id: "hundred", name: "Proof of work", icon: "⌘", description: "Mine 100 satoshis.", goal: 100 },
    { id: "thousand", name: "Block candidate", icon: "▦", description: "Mine 1,000 satoshis.", goal: 1000 },
    { id: "ten-thousand", name: "Whale watcher", icon: "◉", description: "Mine 10,000 satoshis.", goal: 10000 },
    { id: "million", name: "Satoshi status", icon: "₿", description: "Mine 1,000,000 satoshis.", goal: 1000000 },
  ];

  const freshState = () => ({
    cookies: 0,
    totalBaked: 0,
    buildings: Object.fromEntries(buildings.map((building) => [building.id, 0])),
    upgrades: [],
    milestones: [],
    config: defaultConfig(),
    lastSeen: Date.now(),
    startedAt: Date.now(),
  });

  function defaultConfig() {
    return {
      clickPower: 1,
      productionMultiplier: 1,
      buildingPriceGrowth: 1.15,
      upgradePriceGrowth: 1.3,
      goldenIntervalSeconds: 45,
      goldenRewardSeconds: 60,
      offlineMultiplier: 0.5,
      offlineMaxHours: 8,
      buildings: Object.fromEntries(buildings.map((building) => [building.id, { baseCost: building.baseCost, cps: building.cps }])),
      upgrades: Object.fromEntries(upgrades.map((upgrade) => [upgrade.id, {
        baseCost: upgrade.baseCost,
        multiplier: upgrade.multiplier,
        requirementType: upgrade.requirementType,
        requirementValue: upgrade.requirementValue,
      }])),
      milestones: Object.fromEntries(milestones.map((milestone) => [milestone.id, { goal: milestone.goal }])),
    };
  }

  function restoreConfig(savedConfig) {
    const defaults = defaultConfig();
    if (!savedConfig || typeof savedConfig !== "object") return defaults;
    const config = { ...defaults };
    const numericFields = {
      clickPower: [0.1, 1000000000],
      productionMultiplier: [0.01, 10000],
      buildingPriceGrowth: [1.01, 5],
      upgradePriceGrowth: [1.01, 5],
      goldenIntervalSeconds: [5, 3600],
      goldenRewardSeconds: [1, 3600],
      offlineMultiplier: [0, 1],
      offlineMaxHours: [0, 24],
    };
    for (const [field, [min, max]] of Object.entries(numericFields)) {
      if (Number.isFinite(savedConfig[field])) config[field] = Math.min(max, Math.max(min, savedConfig[field]));
    }
    for (const building of buildings) {
      const saved = savedConfig.buildings?.[building.id];
      if (saved && Number.isFinite(saved.baseCost) && Number.isFinite(saved.cps)) {
        config.buildings[building.id] = {
          baseCost: Math.min(1e15, Math.max(1, saved.baseCost)),
          cps: Math.min(1e12, Math.max(0, saved.cps)),
        };
      }
    }
    for (const upgrade of upgrades) {
      const saved = savedConfig.upgrades?.[upgrade.id];
      if (saved && Number.isFinite(saved.baseCost) && Number.isFinite(saved.multiplier) && Number.isFinite(saved.requirementValue)) {
        const validRequirement = saved.requirementType === "total" || buildings.some((building) => saved.requirementType === `building:${building.id}`);
        config.upgrades[upgrade.id] = {
          baseCost: Math.min(1e15, Math.max(1, saved.baseCost)),
          multiplier: Math.min(1000, Math.max(0.01, saved.multiplier)),
          requirementType: validRequirement ? saved.requirementType : defaults.upgrades[upgrade.id].requirementType,
          requirementValue: Math.min(1e15, Math.max(0, saved.requirementValue)),
        };
      }
    }
    for (const milestone of milestones) {
      const saved = savedConfig.milestones?.[milestone.id];
      if (saved && Number.isFinite(saved.goal)) config.milestones[milestone.id] = { goal: Math.min(1e15, Math.max(1, saved.goal)) };
    }
    return config;
  }

  function loadState() {
    try {
      const saved = JSON.parse(localStorage.getItem(SAVE_KEY) || localStorage.getItem(LEGACY_SAVE_KEY));
      if (!saved || typeof saved !== "object" || !Number.isFinite(saved.cookies) || !Number.isFinite(saved.totalBaked)) return freshState();
      const state = freshState();
      state.cookies = Math.max(0, saved.cookies);
      state.totalBaked = Math.max(0, saved.totalBaked);
      for (const building of buildings) {
        if (Number.isFinite(saved.buildings?.[building.id])) state.buildings[building.id] = Math.max(0, Math.floor(saved.buildings[building.id]));
      }
      state.upgrades = Array.isArray(saved.upgrades) ? saved.upgrades.filter((id) => upgrades.some((upgrade) => upgrade.id === id)) : [];
      state.milestones = Array.isArray(saved.milestones) ? saved.milestones.filter((id) => milestones.some((milestone) => milestone.id === id)) : [];
      state.config = restoreConfig(saved.config);
      state.lastSeen = Number.isFinite(saved.lastSeen) ? saved.lastSeen : Date.now();
      state.startedAt = Number.isFinite(saved.startedAt) ? saved.startedAt : Date.now();
      return state;
    } catch (error) {
      console.error("Unable to load mining save:", error);
      return freshState();
    }
  }

  let state = loadState();
  let activeView = "bakery";
  let toastTimer;
  let lastSaveTime = Date.now();
  let lastMarketMarkup = null;
  let lastAdminMarkup = null;
  let goldenTimer;
  let audioContext;
  let soundsEnabled = loadSoundPreference();

  const $ = (selector) => document.querySelector(selector);
  const marketList = $("#market-list");
  const toast = $("#toast");

  function loadSoundPreference() {
    try {
      return localStorage.getItem(SOUND_KEY) !== "false";
    } catch (error) {
      console.error("Unable to load sound preference:", error);
      return true;
    }
  }

  function playSound(kind) {
    if (!soundsEnabled) return;
    const AudioContextType = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextType) return;
    audioContext ||= new AudioContextType();
    if (audioContext.state === "suspended") {
      audioContext.resume().catch((error) => console.error("Unable to resume game audio:", error));
    }

    const patterns = {
      mine: [[740, 0, 0.09, "sine"], [990, 0.055, 0.12, "sine"]],
      purchase: [[520, 0, 0.12, "triangle"], [780, 0.075, 0.15, "triangle"]],
      upgrade: [[587, 0, 0.17, "sine"], [740, 0.07, 0.2, "sine"], [988, 0.14, 0.24, "sine"]],
      milestone: [[660, 0, 0.16, "triangle"], [880, 0.1, 0.2, "triangle"], [1109, 0.2, 0.3, "sine"]],
      golden: [[784, 0, 0.17, "sine"], [1047, 0.08, 0.2, "sine"], [1319, 0.16, 0.35, "sine"]],
      navigation: [[460, 0, 0.07, "sine"]],
    };
    const now = audioContext.currentTime;

    for (const [frequency, offset, duration, waveform] of patterns[kind] || []) {
      const oscillator = audioContext.createOscillator();
      const volume = audioContext.createGain();
      const start = now + offset;
      oscillator.type = waveform;
      oscillator.frequency.setValueAtTime(frequency, start);
      volume.gain.setValueAtTime(0.0001, start);
      volume.gain.exponentialRampToValueAtTime(kind === "mine" ? 0.045 : 0.035, start + 0.012);
      volume.gain.exponentialRampToValueAtTime(0.0001, start + duration);
      oscillator.connect(volume);
      volume.connect(audioContext.destination);
      oscillator.start(start);
      oscillator.stop(start + duration + 0.01);
    }
  }

  function updateSoundToggle() {
    const toggle = $("#sound-toggle");
    toggle.setAttribute("aria-pressed", String(soundsEnabled));
    toggle.setAttribute("aria-label", soundsEnabled ? "Mute game sounds" : "Enable game sounds");
    toggle.title = soundsEnabled ? "Mute game sounds" : "Enable game sounds";
    toggle.querySelector(".sound-toggle-label").textContent = soundsEnabled ? "SOUND ON" : "SOUND OFF";
    toggle.classList.toggle("muted", !soundsEnabled);
  }

  function formatNumber(value) {
    if (value < 1000) return Math.floor(value).toLocaleString();
    const units = ["K", "M", "B", "T", "Qa", "Qi"];
    let size = -1;
    do {
      value /= 1000;
      size += 1;
    } while (value >= 1000 && size < units.length - 1);
    return `${value.toFixed(value < 10 ? 1 : 0)}${units[size]}`;
  }

  function formatRate(value) {
    if (value > 0 && value < 10 && !Number.isInteger(value)) return value.toFixed(1);
    return formatNumber(value);
  }

  function productionPerSecond() {
    const base = buildings.reduce((sum, building) => sum + state.buildings[building.id] * state.config.buildings[building.id].cps, 0);
    const multiplier = state.upgrades.reduce((result, id) => {
      const upgrade = upgrades.find((entry) => entry.id === id);
      return result * (upgrade?.effect === "production" ? state.config.upgrades[id].multiplier : 1);
    }, 1);
    return base * multiplier * state.config.productionMultiplier;
  }

  function cookiesPerClick() {
    return state.upgrades.reduce((value, id) => {
      const upgrade = upgrades.find((entry) => entry.id === id);
      return value * (upgrade?.effect === "click" ? state.config.upgrades[id].multiplier : 1);
    }, state.config.clickPower);
  }

  function buildingCost(building) {
    return Math.ceil(state.config.buildings[building.id].baseCost * Math.pow(state.config.buildingPriceGrowth, state.buildings[building.id]));
  }

  function upgradeCost(upgrade) {
    return Math.ceil(state.config.upgrades[upgrade.id].baseCost * Math.pow(state.config.upgradePriceGrowth, state.upgrades.filter((id) => upgrades.find((item) => item.id === id)?.effect === upgrade.effect).length));
  }

  function upgradeUnlocked(upgrade) {
    const requirement = state.config.upgrades[upgrade.id];
    if (requirement.requirementType === "total") return state.totalBaked >= requirement.requirementValue;
    const buildingId = requirement.requirementType.slice("building:".length);
    return state.buildings[buildingId] >= requirement.requirementValue;
  }

  function save() {
    state.lastSeen = Date.now();
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(state));
      lastSaveTime = Date.now();
      $("#save-status").textContent = "Saved on this device";
    } catch (error) {
      console.error("Unable to save mining progress:", error);
      $("#save-status").textContent = "Save unavailable";
    }
  }

  function showToast(message) {
    toast.textContent = message;
    toast.classList.add("visible");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove("visible"), 2600);
  }

  function addCookies(amount) {
    if (!(amount > 0)) return;
    state.cookies += amount;
    state.totalBaked += amount;
    checkMilestones();
  }

  function checkMilestones() {
    for (const milestone of milestones) {
      if (state.totalBaked >= state.config.milestones[milestone.id].goal && !state.milestones.includes(milestone.id)) {
        state.milestones.push(milestone.id);
        playSound("milestone");
        showToast(`${milestone.icon} Milestone unlocked: ${milestone.name}`);
      }
    }
  }

  function buyBuilding(id) {
    const building = buildings.find((item) => item.id === id);
    if (!building) return;
    const cost = buildingCost(building);
    if (state.cookies < cost) return;
    state.cookies -= cost;
    state.buildings[id] += 1;
    playSound("purchase");
    showToast(`${building.icon} ${building.name} came online!`);
    render();
    save();
  }

  function buyUpgrade(id) {
    const upgrade = upgrades.find((item) => item.id === id);
    if (!upgrade || state.upgrades.includes(id) || !upgradeUnlocked(upgrade)) return;
    const cost = upgradeCost(upgrade);
    if (state.cookies < cost) return;
    state.cookies -= cost;
    state.upgrades.push(id);
    playSound("upgrade");
    showToast(`✦ ${upgrade.name} is ready to use!`);
    render();
    save();
  }

  function availableUpgrades() {
    return upgrades.filter((upgrade) => !state.upgrades.includes(upgrade.id) && upgradeUnlocked(upgrade));
  }

  function renderShop() {
    if (activeView === "admin") return;
    const available = buildings.filter((building) => state.totalBaked >= state.config.buildings[building.id].baseCost / 2 || state.buildings[building.id] > 0 || building.id === "grandma");
    $("#market-count").textContent = `${available.length} ITEMS`;
    $("#market-description").textContent = activeView === "upgrades"
      ? "Tune your hardware. Maximize every hash."
      : "More hardware. More hashes. More sats.";
    $("#market-title").textContent = activeView === "upgrades" ? "Optimize your operation" : "Expand your hash rate";

    let items = [];
    if (activeView === "upgrades") {
      items = availableUpgrades().map((upgrade) => {
        const cost = upgradeCost(upgrade);
        const affordable = state.cookies >= cost;
        const effectTarget = upgrade.effect === "click" ? "manual hash power" : "mining output";
        return `<article class="market-item${affordable ? "" : " unaffordable"}">
          <span class="item-illustration">${upgrade.icon}</span>
          <div class="item-details"><strong>${upgrade.name}</strong><p>Multiplies ${effectTarget} by ×${formatRate(state.config.upgrades[upgrade.id].multiplier)}.</p><small>✦ ${formatNumber(cost)} sats</small></div>
          <button class="buy-button" type="button" data-buy-upgrade="${upgrade.id}" ${affordable ? "" : "disabled"}>Unlock</button>
        </article>`;
      });
    } else if (activeView === "achievements") {
      items = milestones.map((milestone) => {
        const unlocked = state.milestones.includes(milestone.id);
        const goal = state.config.milestones[milestone.id].goal;
        const progress = Math.min(100, state.totalBaked / goal * 100);
        return `<article class="market-item${unlocked ? "" : " unaffordable"}">
          <span class="item-illustration">${unlocked ? milestone.icon : "◇"}</span>
          <div class="item-details"><strong>${milestone.name}</strong><p>${milestone.description}</p><small>${unlocked ? "✦ Milestone unlocked" : `${formatNumber(state.totalBaked)} / ${formatNumber(goal)} sats`}</small></div>
          <span class="item-owned">${unlocked ? "✓" : `${Math.floor(progress)}%`}<small>${unlocked ? "COMPLETE" : "PROGRESS"}</small></span>
        </article>`;
      });
    } else {
      items = available.map((building) => {
        const cost = buildingCost(building);
        const affordable = state.cookies >= cost;
        const owned = state.buildings[building.id];
        return `<article class="market-item${affordable ? "" : " unaffordable"}">
          <span class="item-illustration">${building.icon}</span>
          <div class="item-details"><strong>${building.name}</strong><p>${building.description}</p><small>↗ ${formatRate(state.config.buildings[building.id].cps * productionMultiplier() * state.config.productionMultiplier)} sats / sec</small></div>
          <button class="buy-button" type="button" data-buy-building="${building.id}" ${affordable ? "" : "disabled"}>${formatNumber(cost)} <span aria-hidden="true">◉</span></button>
        </article>`;
      });
    }

    const markup = items.join("");
    if (markup !== lastMarketMarkup) {
      marketList.innerHTML = markup;
      lastMarketMarkup = markup;
    }
    $("#market-empty").hidden = items.length !== 0;
    marketList.hidden = items.length === 0;
    $("#upgrade-nav-count").textContent = String(availableUpgrades().length);
  }

  function productionMultiplier() {
    return state.upgrades.reduce((value, id) => {
      const upgrade = upgrades.find((entry) => entry.id === id);
      return value * (upgrade?.effect === "production" ? state.config.upgrades[id].multiplier : 1);
    }, 1);
  }

  function levelForCookies(total) {
    return Math.max(1, Math.floor(Math.sqrt(total / 25)) + 1);
  }

  function levelProgress(total) {
    const level = levelForCookies(total);
    const currentThreshold = (level - 1) ** 2 * 25;
    const nextThreshold = level ** 2 * 25;
    return { level, current: total - currentThreshold, needed: nextThreshold - currentThreshold, percent: (total - currentThreshold) / (nextThreshold - currentThreshold) * 100 };
  }

  function adminNumberField(name, label, value, min, max, step, hint = "") {
    return `<label class="admin-field"><span>${label}</span><input type="number" name="${name}" value="${value}" min="${min}" max="${max}" step="${step}" required>${hint ? `<small>${hint}</small>` : ""}</label>`;
  }

  function adminCheckbox(name, label, checked) {
    return `<label class="admin-check"><input type="checkbox" name="${name}" ${checked ? "checked" : ""}><span>${label}</span></label>`;
  }

  function renderAdmin() {
    const options = `<option value="total">Total sats mined</option>${buildings.map((building) => `<option value="building:${building.id}">${building.name}</option>`).join("")}`;
    const panels = [
      `<section class="admin-panel"><div class="admin-panel-heading"><span class="admin-panel-icon">ϟ</span><div><h3>Core economy</h3><p>Set the baseline pace and how quickly the market scales.</p></div></div><div class="admin-fields">
        ${adminNumberField("cookies", "Current sat balance", state.cookies, 0, 1e15, "any")}
        ${adminNumberField("totalBaked", "Lifetime sats mined", state.totalBaked, 0, 1e15, "any")}
        ${adminNumberField("clickPower", "Sats per click", state.config.clickPower, 0.1, 1000000000, "any")}
        ${adminNumberField("productionMultiplier", "Global production multiplier", state.config.productionMultiplier, 0.01, 10000, "any")}
        ${adminNumberField("buildingPriceGrowth", "Miner price growth", state.config.buildingPriceGrowth, 1.01, 5, "0.01", "Multiplier applied to each owned miner.")}
        ${adminNumberField("upgradePriceGrowth", "Upgrade price growth", state.config.upgradePriceGrowth, 1.01, 5, "0.01", "Multiplier applied to prior upgrades of the same type.")}
        ${adminCheckbox("soundEnabled", "Game sounds enabled", soundsEnabled)}
      </div></section>`,
      `<section class="admin-panel"><div class="admin-panel-heading"><span class="admin-panel-icon">▦</span><div><h3>Mining hardware</h3><p>Configure miner ownership, starting cost, and sats produced per second.</p></div></div><div class="admin-table-wrap"><table class="admin-table"><thead><tr><th>MINER</th><th>OWNED</th><th>BASE COST (SATS)</th><th>SATS / SEC</th></tr></thead><tbody>${buildings.map((building) => `<tr><th scope="row"><span class="admin-item-icon">${building.icon}</span>${building.name}</th><td>${adminNumberField(`building.${building.id}.owned`, "Owned miners", state.buildings[building.id], 0, 1e9, "1")}</td><td>${adminNumberField(`building.${building.id}.baseCost`, "Base cost", state.config.buildings[building.id].baseCost, 1, 1e15, "any")}</td><td>${adminNumberField(`building.${building.id}.cps`, "Sats per second", state.config.buildings[building.id].cps, 0, 1e12, "any")}</td></tr>`).join("")}</tbody></table></div></section>`,
      `<section class="admin-panel"><div class="admin-panel-heading"><span class="admin-panel-icon">⌁</span><div><h3>Upgrades & unlocks</h3><p>Set upgrade ownership, costs, effect multipliers, and unlock rules.</p></div></div><div class="admin-table-wrap"><table class="admin-table upgrade-admin-table"><thead><tr><th>UPGRADE</th><th>OWNED</th><th>COST (SATS)</th><th>EFFECT ×</th><th>UNLOCK REQUIREMENT</th><th>AMOUNT</th></tr></thead><tbody>${upgrades.map((upgrade) => {
        const settings = state.config.upgrades[upgrade.id];
        return `<tr><th scope="row"><span class="admin-item-icon">${upgrade.icon}</span>${upgrade.name}</th><td>${adminCheckbox(`upgrade.${upgrade.id}.owned`, "Upgrade owned", state.upgrades.includes(upgrade.id))}</td><td>${adminNumberField(`upgrade.${upgrade.id}.baseCost`, "Base cost", settings.baseCost, 1, 1e15, "any")}</td><td>${adminNumberField(`upgrade.${upgrade.id}.multiplier`, "Effect multiplier", settings.multiplier, 0.01, 1000, "any")}</td><td><label class="admin-field"><span>Unlock condition</span><select name="upgrade.${upgrade.id}.requirementType">${options}</select></label></td><td>${adminNumberField(`upgrade.${upgrade.id}.requirementValue`, "Requirement", settings.requirementValue, 0, 1e15, "any")}</td></tr>`;
      }).join("")}</tbody></table></div></section>`,
      `<section class="admin-panel"><div class="admin-panel-heading"><span class="admin-panel-icon">◈</span><div><h3>Milestone targets</h3><p>Change each target and its unlocked status.</p></div></div><div class="admin-milestone-list">${milestones.map((milestone) => `<div class="admin-milestone-row">${adminNumberField(`milestone.${milestone.id}.goal`, milestone.name, state.config.milestones[milestone.id].goal, 1, 1e15, "any", milestone.description)}${adminCheckbox(`milestone.${milestone.id}.unlocked`, "Milestone unlocked", state.milestones.includes(milestone.id))}</div>`).join("")}</div></section>`,
      `<section class="admin-panel"><div class="admin-panel-heading"><span class="admin-panel-icon">✦</span><div><h3>Bonus & offline rules</h3><p>Control golden-block timing, rewards, and offline production.</p></div></div><div class="admin-fields">
        ${adminNumberField("goldenIntervalSeconds", "Golden block interval (seconds)", state.config.goldenIntervalSeconds, 5, 3600, "1")}
        ${adminNumberField("goldenRewardSeconds", "Golden block reward (production seconds)", state.config.goldenRewardSeconds, 1, 3600, "1")}
        ${adminNumberField("offlineMultiplier", "Offline production rate", state.config.offlineMultiplier, 0, 1, "0.01", "Fraction of normal production, from 0 to 1.")}
        ${adminNumberField("offlineMaxHours", "Offline earning cap (hours)", state.config.offlineMaxHours, 0, 24, "1")}
      </div></section>`,
    ];
    const markup = panels.join("");
    if (markup !== lastAdminMarkup) {
      $("#admin-config-panels").innerHTML = markup;
      for (const upgrade of upgrades) {
        const select = $(`[name="upgrade.${upgrade.id}.requirementType"]`);
        select.value = state.config.upgrades[upgrade.id].requirementType;
      }
      lastAdminMarkup = markup;
    }
  }

  function applyAdminConfig(event) {
    event.preventDefault();
    const form = $("#admin-config-form");
    if (!form.reportValidity()) return;
    const values = new FormData(form);
    const nextConfig = defaultConfig();
    state.cookies = Number(values.get("cookies"));
    state.totalBaked = Number(values.get("totalBaked"));
    for (const building of buildings) {
      state.buildings[building.id] = Number(values.get(`building.${building.id}.owned`));
    }
    for (const key of ["clickPower", "productionMultiplier", "buildingPriceGrowth", "upgradePriceGrowth", "goldenIntervalSeconds", "goldenRewardSeconds", "offlineMultiplier", "offlineMaxHours"]) {
      nextConfig[key] = Number(values.get(key));
    }
    for (const building of buildings) {
      nextConfig.buildings[building.id] = {
        baseCost: Number(values.get(`building.${building.id}.baseCost`)),
        cps: Number(values.get(`building.${building.id}.cps`)),
      };
    }
    for (const upgrade of upgrades) {
      nextConfig.upgrades[upgrade.id] = {
        baseCost: Number(values.get(`upgrade.${upgrade.id}.baseCost`)),
        multiplier: Number(values.get(`upgrade.${upgrade.id}.multiplier`)),
        requirementType: values.get(`upgrade.${upgrade.id}.requirementType`),
        requirementValue: Number(values.get(`upgrade.${upgrade.id}.requirementValue`)),
      };
    }
    state.upgrades = upgrades.filter((upgrade) => values.get(`upgrade.${upgrade.id}.owned`) === "on").map((upgrade) => upgrade.id);
    for (const milestone of milestones) {
      nextConfig.milestones[milestone.id] = { goal: Number(values.get(`milestone.${milestone.id}.goal`)) };
    }
    state.milestones = milestones.filter((milestone) => values.get(`milestone.${milestone.id}.unlocked`) === "on").map((milestone) => milestone.id);
    soundsEnabled = values.get("soundEnabled") === "on";
    updateSoundToggle();
    try {
      localStorage.setItem(SOUND_KEY, String(soundsEnabled));
    } catch (error) {
      console.error("Unable to save sound preference:", error);
    }
    state.config = nextConfig;
    lastAdminMarkup = null;
    checkMilestones();
    if (goldenTimer) clearInterval(goldenTimer);
    goldenTimer = setInterval(spawnGoldenCookie, state.config.goldenIntervalSeconds * 1000);
    $("#admin-feedback").textContent = "Configuration applied and saved to this device.";
    $("#admin-feedback").classList.remove("error");
    playSound("upgrade");
    render();
    save();
    showToast("Game configuration applied.");
  }

  function render() {
    $("#cookie-count").textContent = formatNumber(state.cookies);
    $("#baked-total").textContent = formatNumber(state.totalBaked);
    $("#cps-value").textContent = formatRate(productionPerSecond());
    $("#click-value").textContent = formatNumber(cookiesPerClick());
    $("#helper-count").textContent = formatNumber(Object.values(state.buildings).reduce((sum, count) => sum + count, 0));
    const level = levelProgress(state.totalBaked);
    $("#level-value").textContent = String(level.level);
    $("#level-progress").style.width = `${level.percent}%`;
    $("#batch-progress-fill").style.width = `${level.percent}%`;
    $("#level-progress-label").textContent = `${formatNumber(level.current)} / ${formatNumber(level.needed)} sats`;

    const unlocked = state.milestones.length;
    $("#milestone-summary").textContent = unlocked
      ? `${unlocked} of ${milestones.length} milestones unlocked. The next block is still ahead of you.`
      : "Mine your first satoshis to start your on-chain milestones.";
    $("#page-title").innerHTML = activeView === "bakery" ? "Your mining rig<span>.</span>" : activeView === "upgrades" ? "Optimize your hash rate<span>.</span>" : activeView === "achievements" ? "Blocks on your record<span>.</span>" : "Admin control room<span>.</span>";
    $(".eyebrow").textContent = activeView === "admin" ? "SIMULATION CONTROLS. LOCAL CHANGES ONLY." : "NO SHORTCUTS. JUST HASH RATE.";
    $(".subtitle").textContent = activeView === "admin" ? "Configure balances, rewards, hardware, upgrades, and milestones." : "Stack sats. Upgrade your hash rate. Make your own luck.";
    $("#breadcrumb-page").textContent = activeView === "achievements" ? "MILESTONES" : activeView === "bakery" ? "DASHBOARD" : activeView.toUpperCase();
    $("#dashboard").hidden = activeView === "admin";
    $("#admin-view").hidden = activeView !== "admin";
    $(".simulation-note").hidden = activeView === "admin";
    if (activeView === "admin" && lastAdminMarkup === null) renderAdmin();
    renderShop();
  }

  function bake(event) {
    const amount = cookiesPerClick();
    playSound("mine");
    addCookies(amount);
    render();
    save();
    if (event && event.clientX && event.clientY) {
      const bounds = $(".cookie-stage").getBoundingClientRect();
      const float = document.createElement("span");
      float.className = "float-number";
      float.textContent = `+${formatNumber(amount)} sats`;
      float.style.left = `${event.clientX - bounds.left}px`;
      float.style.top = `${event.clientY - bounds.top}px`;
      $("#floating-layer").append(float);
      float.addEventListener("animationend", () => float.remove(), { once: true });
    }
  }

  function spawnGoldenCookie() {
    if ($("#golden-cookie") || document.hidden) return;
    const golden = document.createElement("button");
    golden.id = "golden-cookie";
    golden.className = "golden-cookie";
    golden.type = "button";
    golden.setAttribute("aria-label", "Collect the golden block");
    golden.textContent = "₿";
    golden.addEventListener("click", () => {
      const reward = Math.max(25, Math.ceil(productionPerSecond() * state.config.goldenRewardSeconds));
      addCookies(reward);
      playSound("golden");
      golden.remove();
      showToast(`₿ Golden block! +${formatNumber(reward)} sats`);
      render();
      save();
    }, { once: true });
    $(".cookie-stage").append(golden);
    setTimeout(() => golden.remove(), 12000);
  }

  function setView(view) {
    if (activeView !== view) playSound("navigation");
    activeView = view;
    document.querySelectorAll("[data-view]").forEach((button) => {
      if (button.classList.contains("nav-link")) button.classList.toggle("active", button.dataset.view === view);
    });
    render();
    if (window.innerWidth <= 820) {
      (view === "admin" ? $("#admin-view") : $("#market-card")).scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  function resetGame() {
    if (!window.confirm("Reset your mining operation? This erases your saved sats, hardware, upgrades, and milestones.")) return;
    const config = state.config;
    state = freshState();
    state.config = config;
    save();
    setView("bakery");
    showToast("Mining operation reset. Time to stack sats.");
  }

  function applyOfflineProgress() {
    const awaySeconds = Math.min(state.config.offlineMaxHours * 60 * 60, Math.max(0, (Date.now() - state.lastSeen) / 1000));
    const earned = productionPerSecond() * awaySeconds * state.config.offlineMultiplier;
    if (earned < 1) return;
    addCookies(earned);
    $("#offline-message").textContent = `Your miners generated ${formatNumber(earned)} sats while you were away. They're waiting in your balance.`;
    $("#offline-modal").hidden = false;
  }

  document.addEventListener("click", (event) => {
    const viewButton = event.target.closest("[data-view]");
    if (viewButton) setView(viewButton.dataset.view);
  });

  marketList.addEventListener("click", (event) => {
    const target = event.target.closest("[data-buy-building], [data-buy-upgrade]");
    if (!target || target.disabled) return;
    if (target.dataset.buyBuilding) buyBuilding(target.dataset.buyBuilding);
    if (target.dataset.buyUpgrade) buyUpgrade(target.dataset.buyUpgrade);
  });

  $("#admin-config-form").addEventListener("submit", applyAdminConfig);
  $("#admin-reset-config").addEventListener("click", () => {
    state.config = defaultConfig();
    lastAdminMarkup = null;
    checkMilestones();
    if (goldenTimer) clearInterval(goldenTimer);
    goldenTimer = setInterval(spawnGoldenCookie, state.config.goldenIntervalSeconds * 1000);
    $("#admin-feedback").textContent = "Default configuration restored and saved to this device.";
    $("#admin-feedback").classList.remove("error");
    render();
    save();
    showToast("Default game configuration restored.");
  });

  $("#cookie-button").addEventListener("click", bake);
  document.addEventListener("keydown", (event) => {
    if (event.code !== "Space" || event.repeat || event.target.matches("button, input, textarea, select, a")) return;
    event.preventDefault();
    bake(null);
  });
  $("#reset-button").addEventListener("click", resetGame);
  $("#sound-toggle").addEventListener("click", () => {
    soundsEnabled = !soundsEnabled;
    updateSoundToggle();
    try {
      localStorage.setItem(SOUND_KEY, String(soundsEnabled));
    } catch (error) {
      console.error("Unable to save sound preference:", error);
      showToast("Sound setting changed, but couldn't be saved on this device.");
    }
    if (soundsEnabled) playSound("navigation");
  });
  $("#offline-close").addEventListener("click", () => {
    $("#offline-modal").hidden = true;
    save();
  });
  $("#offline-modal").addEventListener("click", (event) => {
    if (event.target === $("#offline-modal")) {
      $("#offline-modal").hidden = true;
      save();
    }
  });

  const elapsed = Math.max(0, Date.now() - state.startedAt);
  const hours = Math.floor(elapsed / 3600000);
  $("#session-time").textContent = hours ? `MINING OPERATION UPTIME: ${hours}H` : "YOUR MINING OPERATION IS JUST GETTING STARTED";

  applyOfflineProgress();
  updateSoundToggle();
  render();
  save();
  setInterval(() => {
    addCookies(productionPerSecond() / 10);
    $("#nonce-value").textContent = Math.floor(Date.now() / 1000).toString(16).toUpperCase().padStart(6, "0").slice(-6);
    render();
    if (Date.now() - lastSaveTime > 5000) save();
  }, 100);
  goldenTimer = setInterval(spawnGoldenCookie, state.config.goldenIntervalSeconds * 1000);
  window.addEventListener("beforeunload", save);
})();
