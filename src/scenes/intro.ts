// Intro Cutscene - Ken Burns Effect Slideshow
import { KaboomCtx, GameObj } from "kaboom";

interface IntroSlide {
  img: string;
  text: string;
}

export function introScene(k: KaboomCtx): void {
  const screenW = k.width();
  const screenH = k.height();

  // New narrative: Mom's "illness" plot
  const slides: IntroSlide[] = [
    {
      img: "intro_room",
      text: "Mom Bi has a strange illness: 'Terminal Chicken Jerky Craving Syndrome'. The only cure is the Golden Jerky Box."
    },
    {
      img: "intro_corp",
      text: "That Golden Jerky Box is at the top floor of Bagasse Corp. Vu decides to infiltrate and save mom."
    },
    {
      img: "intro_city",
      text: "Vu: 'Wait for me mom, I'll bring it back! No matter who I have to face!'"
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
    fadeToLevel1(k);
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

  // Next button advances slide
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

  // Function to create a slide with Ken Burns effect
  function showSlide(index: number): void {
    if (index >= slides.length) {
      fadeToLevel1(k);
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

    // Calculate image scale for Ken Burns effect
    const imgScale = 1.3;

    // Create slide image
    currentSlide = k.add([
      k.sprite(slide.img),
      k.pos(screenW / 2, screenH / 2),
      k.anchor("center"),
      k.scale(imgScale),
      k.opacity(0),
      k.z(1)
    ]);

    // Ken Burns Effect: Pan and Zoom
    const directions = [
      { startX: -50, startY: -30, endX: 50, endY: 30, startScale: 1.3, endScale: 1.0 },
      { startX: 50, startY: -20, endX: -50, endY: 40, startScale: 1.1, endScale: 1.25 },
      { startX: 0, startY: -40, endX: 0, endY: 40, startScale: 1.35, endScale: 1.05 }
    ];
    const dir = directions[index % directions.length];

    currentSlide.pos = k.vec2(screenW / 2 + dir.startX, screenH / 2 + dir.startY);
    currentSlide.scale = k.vec2(dir.startScale, dir.startScale);

    // Fade in
    k.tween(0, 1, 0.8, (val) => {
      if (currentSlide) currentSlide.opacity = val;
    }, k.easings.easeOutQuad);

    // Slow pan animation (longer since no auto-advance)
    k.tween(0, 1, 15, (val) => {
      if (currentSlide) {
        const x = screenW / 2 + dir.startX + (dir.endX - dir.startX) * val;
        const y = screenH / 2 + dir.startY + (dir.endY - dir.startY) * val;
        const s = dir.startScale + (dir.endScale - dir.startScale) * val;
        currentSlide.pos = k.vec2(x, y);
        currentSlide.scale = k.vec2(s, s);
      }
    }, k.easings.linear);

    // Text box at bottom
    const boxHeight = 100;
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

    // Narrative text with typewriter effect
    currentText = k.add([
      k.text("", {
        size: Math.min(20, screenW / 40),
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
        k.pos(screenW / 2 - 30 + i * 25, screenH - 190),
        k.color(i === index ? k.rgb(255, 255, 255) : k.rgb(100, 100, 100)),
        k.z(102),
        k.fixed(),
        "slide-dot"
      ]);
    }
  }

  // Start first slide
  showSlide(0);

  // Main update loop - ONLY typewriter effect, NO auto-advance
  k.onUpdate(() => {
    if (isTransitioning) return;

    const slide = slides[currentSlideIndex];
    if (!slide || !currentText) return;

    // Typewriter effect
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

function fadeToLevel1(k: KaboomCtx): void {
  const fade = k.add([
    k.rect(k.width(), k.height()),
    k.pos(0, 0),
    k.color(0, 0, 0),
    k.opacity(0),
    k.z(500),
    k.fixed()
  ]);

  k.tween(0, 1, 0.8, (val) => {
    fade.opacity = val;
  }, k.easings.easeInQuad).onEnd(() => {
    k.go("level1");
  });
}
