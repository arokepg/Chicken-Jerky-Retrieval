// Outro Scene - The Big Reveal (Slideshow with Next Button)
import { KaboomCtx, GameObj } from "kaboom";

interface OutroSlide {
  img: string;
  text: string;
}

export function outroScene(k: KaboomCtx): void {
  const screenW = k.width();
  const screenH = k.height();

  // New outro plot: The True Ending
  const slides: OutroSlide[] = [
    {
      img: "intro_corp",
      text: "The Final Boss collapses. Vu approaches to remove the mask..."
    },
    {
      img: "intro_room",
      text: "It's MOM BI! She is the mysterious CEO of Bagasse Corp."
    },
    {
      img: "intro_city",
      text: "Mom Bi: 'I'm sorry for hiding this from you. I needed to know if you were mature enough to protect the family.'"
    },
    {
      img: "intro_room",
      text: "Vu has proven his worth. Mother and son enjoy the Golden Jerky while watching 24h Motion News.\nTHE END."
    }
  ];

  let currentSlideIndex = 0;
  let isTransitioning = false;
  let currentSlide: GameObj<any> | null = null;
  let currentTextBox: GameObj<any> | null = null;
  let currentText: GameObj<any> | null = null;
  let charIndex = 0;
  let typewriterTimer = 0;
  const TYPEWRITER_SPEED = 0.03;

  // Black background
  k.add([
    k.rect(screenW, screenH),
    k.pos(0, 0),
    k.color(0, 0, 0),
    k.z(0),
    k.fixed()
  ]);

  // Skip Button (Top Right) - "Bỏ qua"
  const skipBtnBg = k.add([
    k.rect(100, 36, { radius: 6 }),
    k.pos(screenW - 120, 20),
    k.color(40, 40, 50),
    k.outline(2, k.rgb(150, 150, 160)),
    k.opacity(0.9),
    k.area(),
    k.z(300),
    k.fixed(),
    "skip-btn"
  ]);

  const skipBtnText = k.add([
    k.text("SKIP", { size: 16 }),
    k.pos(screenW - 70, 38),
    k.anchor("center"),
    k.color(200, 200, 200),
    k.z(301),
    k.fixed()
  ]);

  skipBtnBg.onHover(() => {
    skipBtnBg.color = k.rgb(70, 70, 90);
    skipBtnText.color = k.rgb(255, 255, 255);
  });

  skipBtnBg.onHoverEnd(() => {
    skipBtnBg.color = k.rgb(40, 40, 50);
    skipBtnText.color = k.rgb(200, 200, 200);
  });

  skipBtnBg.onClick(() => {
    showFinalScene();
  });

  // Next Button (Bottom Right) - "Next >>"
  const nextBtnBg = k.add([
    k.rect(140, 44, { radius: 8 }),
    k.pos(screenW - 160, screenH - 60),
    k.color(60, 100, 60),
    k.outline(3, k.rgb(100, 200, 100)),
    k.opacity(0.95),
    k.area(),
    k.z(300),
    k.fixed(),
    "next-btn"
  ]);

  const nextBtnText = k.add([
    k.text("Next >>", { size: 18 }),
    k.pos(screenW - 90, screenH - 38),
    k.anchor("center"),
    k.color(220, 255, 220),
    k.z(301),
    k.fixed()
  ]);

  nextBtnBg.onHover(() => {
    nextBtnBg.color = k.rgb(80, 140, 80);
    nextBtnText.color = k.rgb(255, 255, 255);
  });

  nextBtnBg.onHoverEnd(() => {
    nextBtnBg.color = k.rgb(60, 100, 60);
    nextBtnText.color = k.rgb(220, 255, 220);
  });

  nextBtnBg.onClick(() => {
    advanceSlide();
  });

  function advanceSlide(): void {
    if (isTransitioning) return;
    
    const slide = slides[currentSlideIndex];
    if (!slide || !currentText) return;

    // If typing, complete the text first
    if (charIndex < slide.text.length) {
      charIndex = slide.text.length;
      currentText.text = slide.text;
      return;
    }

    // Advance to next slide
    isTransitioning = true;
    if (currentSlide) {
      k.tween(1, 0, 0.3, (val) => {
        if (currentSlide) currentSlide.opacity = val;
        if (currentTextBox) currentTextBox.opacity = val * 0.85;
        if (currentText) currentText.opacity = val;
      }, k.easings.easeInQuad).onEnd(() => {
        currentSlideIndex++;
        showSlide(currentSlideIndex);
      });
    }
  }

  function showSlide(index: number): void {
    if (index >= slides.length) {
      showFinalScene();
      return;
    }

    const slide = slides[index];
    charIndex = 0;
    typewriterTimer = 0;
    isTransitioning = false;

    // Remove previous slide elements
    if (currentSlide) currentSlide.destroy();
    if (currentTextBox) currentTextBox.destroy();
    if (currentText) currentText.destroy();

    // Create slide image with Ken Burns effect
    currentSlide = k.add([
      k.sprite(slide.img),
      k.pos(screenW / 2, screenH / 2),
      k.anchor("center"),
      k.scale(1.3),
      k.opacity(0),
      k.z(1)
    ]);

    // Slow pan animation
    const startX = k.rand(-50, 50);
    const startY = k.rand(-30, 30);
    currentSlide.pos = k.vec2(screenW / 2 + startX, screenH / 2 + startY);

    k.tween(0, 1, 0.8, (val) => {
      if (currentSlide) currentSlide.opacity = val;
    }, k.easings.easeOutQuad);

    k.tween(0, 1, 15, (val) => {
      if (currentSlide) {
        currentSlide.pos = k.vec2(
          screenW / 2 + startX - startX * 2 * val,
          screenH / 2 + startY - startY * 2 * val
        );
      }
    }, k.easings.linear);

    // Text box at bottom
    const boxHeight = 120;
    const boxMargin = 40;
    currentTextBox = k.add([
      k.rect(screenW - boxMargin * 2, boxHeight, { radius: 8 }),
      k.pos(boxMargin, screenH - boxHeight - 80),
      k.color(0, 0, 0),
      k.opacity(0.85),
      k.outline(2, k.rgb(100, 100, 120)),
      k.z(100),
      k.fixed()
    ]);

    currentText = k.add([
      k.text("", {
        size: Math.min(18, screenW / 45),
        width: screenW - boxMargin * 2 - 40,
        lineSpacing: 6
      }),
      k.pos(boxMargin + 20, screenH - boxHeight - 60),
      k.color(255, 255, 255),
      k.z(101),
      k.fixed()
    ]);

    // Slide indicator dots
    k.destroyAll("slide-dot");
    for (let i = 0; i < slides.length; i++) {
      k.add([
        k.circle(i === index ? 6 : 4),
        k.pos(screenW / 2 - 30 + i * 25, screenH - 210),
        k.color(i === index ? k.rgb(255, 255, 255) : k.rgb(100, 100, 100)),
        k.z(102),
        k.fixed(),
        "slide-dot"
      ]);
    }
  }

  // Final heartwarming scene
  function showFinalScene(): void {
    k.get("*").forEach(obj => obj.destroy());

    // Scale factor for the entire scene
    const SCENE_SCALE = 2.5;
    const centerX = screenW / 2;
    const centerY = screenH / 2;

    // Living room background
    k.add([
      k.rect(screenW, screenH),
      k.pos(0, 0),
      k.color(80, 60, 50),
      k.z(0),
      k.fixed()
    ]);

    // Sofa (scaled up)
    k.add([
      k.rect(300 * SCENE_SCALE, 120 * SCENE_SCALE, { radius: 10 * SCENE_SCALE }),
      k.pos(centerX, centerY + 80 * SCENE_SCALE),
      k.anchor("center"),
      k.color(120, 80, 60),
      k.z(1),
      k.fixed()
    ]);

    // Vũ sitting (scaled up)
    k.add([
      k.sprite("player"),
      k.pos(centerX - 80 * SCENE_SCALE, centerY + 50 * SCENE_SCALE),
      k.anchor("center"),
      k.scale(2.5 * SCENE_SCALE),
      k.z(5),
      k.fixed()
    ]);

    // Mom sitting (pink tint, scaled up)
    k.add([
      k.sprite("player"),
      k.pos(centerX + 80 * SCENE_SCALE, centerY + 50 * SCENE_SCALE),
      k.anchor("center"),
      k.scale(2.5 * SCENE_SCALE),
      k.color(255, 180, 200),
      k.z(5),
      k.fixed()
    ]);

    // Chicken jerky jar (scaled up)
    k.add([
      k.rect(40 * SCENE_SCALE, 60 * SCENE_SCALE, { radius: 5 * SCENE_SCALE }),
      k.pos(centerX, centerY + 110 * SCENE_SCALE),
      k.anchor("center"),
      k.color(200, 150, 100),
      k.outline(2 * SCENE_SCALE, k.rgb(100, 70, 40)),
      k.z(6),
      k.fixed()
    ]);

    k.add([
      k.text("Golden\nJerky", { size: 10 * SCENE_SCALE, align: "center" }),
      k.pos(centerX, centerY + 110 * SCENE_SCALE),
      k.anchor("center"),
      k.color(80, 50, 30),
      k.z(7),
      k.fixed()
    ]);

    // TV (scaled up)
    k.add([
      k.rect(180 * SCENE_SCALE, 120 * SCENE_SCALE, { radius: 8 * SCENE_SCALE }),
      k.pos(centerX, centerY - 100 * SCENE_SCALE),
      k.anchor("center"),
      k.color(40, 40, 60),
      k.z(2),
      k.fixed()
    ]);

    k.add([
      k.rect(160 * SCENE_SCALE, 100 * SCENE_SCALE, { radius: 4 * SCENE_SCALE }),
      k.pos(centerX, centerY - 100 * SCENE_SCALE),
      k.anchor("center"),
      k.color(100, 150, 200),
      k.z(3),
      k.fixed()
    ]);

    k.add([
      k.text("LIVE", { size: 14 * SCENE_SCALE }),
      k.pos(centerX, centerY - 135 * SCENE_SCALE),
      k.anchor("center"),
      k.color(255, 50, 50),
      k.z(4),
      k.fixed()
    ]);

    k.add([
      k.text("24h Motion News", { size: 10 * SCENE_SCALE }),
      k.pos(centerX, centerY - 115 * SCENE_SCALE),
      k.anchor("center"),
      k.color(255, 255, 255),
      k.z(4),
      k.fixed()
    ]);

    k.add([
      k.text("Evening News", { size: 8 * SCENE_SCALE }),
      k.pos(centerX, centerY - 100 * SCENE_SCALE),
      k.anchor("center"),
      k.color(200, 200, 200),
      k.z(4),
      k.fixed()
    ]);

    // Happy ending overlay
    k.add([
      k.rect(screenW - 60, 100, { radius: 12 }),
      k.pos(screenW / 2, 60),
      k.anchor("center"),
      k.color(0, 0, 0),
      k.opacity(0.8),
      k.z(100),
      k.fixed()
    ]);

    k.add([
      k.text("HAPPY ENDING", { size: 28 }),
      k.pos(screenW / 2, 40),
      k.anchor("center"),
      k.color(255, 215, 0),
      k.z(101),
      k.fixed()
    ]);

    k.add([
      k.text("GIA ĐÌNH VĂN HÓA", { size: 20 }),
      k.pos(screenW / 2, 70),
      k.anchor("center"),
      k.color(200, 200, 255),
      k.z(101),
      k.fixed()
    ]);

    // Menu button
    const menuBtn = k.add([
      k.rect(200, 50, { radius: 8 }),
      k.pos(screenW / 2, screenH - 60),
      k.anchor("center"),
      k.color(50, 100, 50),
      k.outline(3, k.rgb(100, 200, 100)),
      k.area(),
      k.z(101),
      k.fixed()
    ]);

    k.add([
      k.text("MENU", { size: 24 }),
      k.pos(screenW / 2, screenH - 60),
      k.anchor("center"),
      k.color(255, 255, 255),
      k.z(102),
      k.fixed()
    ]);

    menuBtn.onHover(() => { menuBtn.color = k.rgb(70, 130, 70); });
    menuBtn.onHoverEnd(() => { menuBtn.color = k.rgb(50, 100, 50); });
    menuBtn.onClick(() => { k.go("menu"); });
    k.onKeyPress("space", () => { k.go("menu"); });
    k.onKeyPress("enter", () => { k.go("menu"); });
  }

  // Start first slide
  showSlide(0);

  // Update loop - ONLY typewriter, NO auto-advance
  k.onUpdate(() => {
    if (isTransitioning) return;

    const slide = slides[currentSlideIndex];
    if (!slide || !currentText) return;

    typewriterTimer += k.dt();
    if (typewriterTimer >= TYPEWRITER_SPEED && charIndex < slide.text.length) {
      charIndex++;
      currentText.text = slide.text.substring(0, charIndex);
      typewriterTimer = 0;
    }
  });

  // Enter/Space also advances
  k.onKeyPress("enter", () => advanceSlide());
  k.onKeyPress("space", () => advanceSlide());
}
