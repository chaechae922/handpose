let port;
let connectBtn;
let redSlider, yellowSlider, greenSlider;
let redTime = 2000, yellowTime = 500, greenTime = 2000;
let brightness = 0;
let mode = "unknown";
let ledRed = 0, ledYellow = 0, ledGreen = 0;

let video;
let handpose;
let predictions = [];

let lastGesture = "";
let gestureCooldown = 700;
let lastGestureTime = 0;

function setup() {
  createCanvas(700, 500);
  textSize(16);

  video = createCapture(VIDEO);
  video.size(640, 480);
  video.hide();

  handpose = ml5.handpose(video, () => {
    console.log("🤖 Handpose model loaded!");
  });

  handpose.on("predict", results => predictions = results);

  port = createSerial();
  let usedPorts = usedSerialPorts();
  if (usedPorts.length > 0) port.open(usedPorts[0], 9600);

  connectBtn = createButton("Connect to Arduino");
  connectBtn.position(10, height - 40);
  connectBtn.mousePressed(togglePort);

  redSlider = createSlider(100, 5000, redTime, 100);
  redSlider.position(10, 20).input(() => {
    redTime = redSlider.value();
    sendCommand(`redTime=${redTime}`);
    if (ledRed === 1 && mode === "normal") sendCommand(`apply=red`);
  });

  yellowSlider = createSlider(100, 5000, yellowTime, 100);
  yellowSlider.position(10, 60).input(() => {
    yellowTime = yellowSlider.value();
    sendCommand(`yellowTime=${yellowTime}`);
    if (ledYellow === 1 && mode === "normal") sendCommand(`apply=yellow`);
  });

  greenSlider = createSlider(100, 5000, greenTime, 100);
  greenSlider.position(10, 100).input(() => {
    greenTime = greenSlider.value();
    sendCommand(`greenTime=${greenTime}`);
    if (ledGreen === 1 && mode === "normal") sendCommand(`apply=green`);
  });
}

function draw() {
  background(230);
  image(video, 20, 270, 160, 120);
  drawKeypoints();

  let count = 0;
  while (port.available() > 0 && count < 10) {
    const data = port.readUntil("\n").trim();
    if (data.length > 0) parseSerialData(data);
    count++;
  }

  fill(0);
  text(`Mode: ${mode}`, 70, 160);
  text(`Brightness: ${brightness}`, 70, 180);
  text(`LED(R/Y/G): ${ledRed}, ${ledYellow}, ${ledGreen}`, 80, 200);
  text(`Red Time: ${redTime}`, 350, 30);
  text(`Yellow Time: ${yellowTime}`, 350, 70);
  text(`Green Time: ${greenTime}`, 350, 110);

  drawLED(width / 2, 250, ledRed, "RED", color(255, 0, 0));
  drawLED(width / 2, 330, ledYellow, "YELLOW", color(255, 255, 0));
  drawLED(width / 2, 410, ledGreen, "GREEN", color(0, 255, 0));

  handleGestures();
}

function drawKeypoints() {
  predictions.forEach(hand => {
    const scaleX = 160 / video.width;
    const scaleY = 120 / video.height;
    hand.landmarks.forEach(([x, y]) => {
      const sx = x * scaleX + 20;
      const sy = y * scaleY + 270;
      fill(255, 0, 0);
      noStroke();
      circle(sx, sy, 6);
    });
  });
}

function drawLED(x, y, on, label, ledColor) {
  fill(on ? ledColor : "gray");
  stroke(0);
  ellipse(x, y, 60);
  fill(0);
  noStroke();
  textAlign(CENTER);
  text(label, x, y + 40);
}

function togglePort() {
  if (!port.opened()) port.open(9600);
  else port.close();
}

function sendCommand(cmd) {
  if (port.opened()) {
    port.write(`cmd:${cmd};\n`);
  }
}

function parseSerialData(data) {
  let parts = data.split(",");
  parts.forEach(p => {
    let [key, val] = p.split(":").map(s => s.trim());
    if (key === "mode") mode = val;
    else if (key === "brightness") brightness = int(val);
    else if (key === "red") ledRed = int(val);
    else if (key === "yellow") ledYellow = int(val);
    else if (key === "green") ledGreen = int(val);
  });
}

// ===================== 👇 제스처 처리 =====================

function handleGestures() {
  if (predictions.length === 0) return;
  const now = millis();
  const hand = predictions[0].landmarks;
  const extended = getExtendedFingers(hand);
  let gesture = "";

  if (extended.length === 2 && extended.includes(1) && extended.includes(2)) {
    gesture = "redUp";
    redTime = constrain(redTime + 300, 100, 5000);
    redSlider.value(redTime);
    sendCommand(`redTime=${redTime}`);
  } else if (extended.length === 1 && extended[0] === 1) {
    gesture = "redDown";
    redTime = constrain(redTime - 300, 100, 5000);
    redSlider.value(redTime);
    sendCommand(`redTime=${redTime}`);
  } else if (extended.length === 2 && extended.includes(2) && extended.includes(3)) {
    gesture = "yellowUp";
    yellowTime = constrain(yellowTime + 300, 100, 5000);
    yellowSlider.value(yellowTime);
    sendCommand(`yellowTime=${yellowTime}`);
  } else if (extended.length === 1 && extended[0] === 2) {
    gesture = "yellowDown";
    yellowTime = constrain(yellowTime - 300, 100, 5000);
    yellowSlider.value(yellowTime);
    sendCommand(`yellowTime=${yellowTime}`);
  } else if (extended.length === 2 && extended.includes(2) && extended.includes(6)) {
    gesture = "greenUp";
    greenTime = constrain(greenTime + 300, 100, 5000);
    greenSlider.value(greenTime);
    sendCommand(`greenTime=${greenTime}`);
  } else if (extended.length === 0) {
    gesture = "greenDown"; // 또는 on/off (중복 허용)
    greenTime = constrain(greenTime - 300, 100, 5000);
    greenSlider.value(greenTime);
    sendCommand(`greenTime=${greenTime}`);
  } else if (extended.length === 5) {
    gesture = "emergency";
  } else if (isFingerHeart(hand)) {
    gesture = "normal";
  } else if (isWideV(hand)) {
    gesture = "blink";
  }

  if (gesture && gesture !== lastGesture && now - lastGestureTime > gestureCooldown) {
    if (gesture === "onoff") sendCommand("button=3");
    else if (gesture === "emergency") sendCommand("button=1");
    else if (gesture === "blink") sendCommand("button=2");
    else if (gesture === "normal") {
      sendCommand("button=3");
      setTimeout(() => sendCommand("button=3"), 100);
    }
    lastGesture = gesture;
    lastGestureTime = now;
  }
}

function getExtendedFingers(lm) {
  const extended = [];
  if (lm[4][0] > lm[3][0]) extended.push(1); // Thumb
  if (lm[8][1] < lm[6][1]) extended.push(2); // Index
  if (lm[12][1] < lm[10][1]) extended.push(3); // Middle
  if (lm[16][1] < lm[14][1]) extended.push(4); // Ring
  if (lm[20][1] < lm[18][1]) extended.push(6); // Pinky
  return extended;
}

function isFingerHeart(lm) {
  const d = dist(lm[4][0], lm[4][1], lm[8][0], lm[8][1]);
  return d < 20;
}

function isWideV(lm) {
  const i = lm[8];
  const m = lm[12];
  const ringFolded = lm[16][1] > lm[14][1];
  const pinkyFolded = lm[20][1] > lm[18][1];
  return dist(i[0], i[1], m[0], m[1]) > 60 && ringFolded && pinkyFolded;
}