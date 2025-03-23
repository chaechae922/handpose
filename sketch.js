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

function handleGestures() {
  if (predictions.length === 0) return;
  const now = millis();
  let gesture = "";

  // 한 손 제스처 (모드 전환)
  if (predictions.length === 1) {
    const hand = predictions[0].landmarks;
    if (isFist(hand)) gesture = "onoff";
    else if (isOpenHand(hand)) gesture = "emergency";
    else if (isVSign(hand)) gesture = "blink";
    else if (isThumbUp(hand)) gesture = "normal";
  }

  // 두 손 제스처 (슬라이더 제어)
  if (predictions.length === 2) {
    const [left, right] = getLeftRightHands(predictions);

    if (isFist(left)) {
      if (isThumbUp(right)) {
        redTime = constrain(redTime + 500, 100, 5000);
        redSlider.value(redTime);
        sendCommand(`redTime=${redTime}`);
      } else if (isThumbDown(right)) {
        redTime = constrain(redTime - 500, 100, 5000);
        redSlider.value(redTime);
        sendCommand(`redTime=${redTime}`);
      } else if (isVSign(right)) {
        yellowTime = constrain(yellowTime + 200, 100, 5000);
        yellowSlider.value(yellowTime);
        sendCommand(`yellowTime=${yellowTime}`);
      } else if (isOneFinger(right)) {
        yellowTime = constrain(yellowTime - 200, 100, 5000);
        yellowSlider.value(yellowTime);
        sendCommand(`yellowTime=${yellowTime}`);
      } else if (isOpenHand(right)) {
        greenTime = constrain(greenTime + 300, 100, 5000);
        greenSlider.value(greenTime);
        sendCommand(`greenTime=${greenTime}`);
      }
    }

    if (isFist(left) && isFist(right)) {
      greenTime = constrain(greenTime - 300, 100, 5000);
      greenSlider.value(greenTime);
      sendCommand(`greenTime=${greenTime}`);
    }
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

// ✋ 판별 함수들
function isFist(lm) {
  const foldedFingers = [8, 12, 16, 20].every(i => {
    const tipY = lm[i][1];
    const pipY = lm[i - 1][1];
    return tipY > pipY + 10; // 더 명확한 구부림
  });

  const thumbTip = lm[4];
  const thumbIP = lm[3];
  const thumbBase = lm[2];
  const thumbCurled = thumbTip[0] < thumbBase[0] && dist(thumbTip[0], thumbTip[1], thumbIP[0], thumbIP[1]) < 30;

  return foldedFingers && thumbCurled;
}

function isOpenHand(lm) {
  return [4, 8, 12, 16, 20].every(i => lm[i][1] < lm[i - 2][1]);
}

function isVSign(lm) {
  const index = lm[8];
  const middle = lm[12];
  const ring = lm[16];
  const indexBase = lm[5];
  const middleBase = lm[9];

  const imDist = dist(index[0], index[1], middle[0], middle[1]);
  const imBaseDist = dist(indexBase[0], indexBase[1], middleBase[0], middleBase[1]);
  const ringFolded = ring[1] > lm[14][1]; // 링거 접혀 있는지

  return imDist > imBaseDist * 1.2 && ringFolded;
}

function isThumbUp(lm) {
  const tip = lm[4];
  const ip = lm[3];
  const base = lm[2];
  const indexBase = lm[5];

  function isThumbUp(lm) {
    const tip = lm[4];
    const ip = lm[3];
    const base = lm[2];
    const indexBase = lm[5];
  
    return (
      thumbTip[1] < thumbBase[1] && // 수직 위에 있음
      abs(thumbTip[0] - thumbBase[0]) < 20 && // 거의 수직 직선
      dist(thumbTip[0], thumbTip[1], indexBase[0], indexBase[1]) > 40
    );    
  }  
}

function isThumbDown(lm) {
  return lm[4][1] > lm[2][1] && lm[4][1] > lm[5][1];
}

function isOneFinger(lm) {
  return lm[8][1] < lm[6][1] &&
         [12, 16, 20].every(i => lm[i][1] > lm[i - 2][1]);
}

function getLeftRightHands(hands) {
  if (hands.length < 2) return [null, null];
  const [handA, handB] = hands;
  return (handA.landmarks[0][0] < handB.landmarks[0][0])
    ? [handA.landmarks, handB.landmarks]
    : [handB.landmarks, handA.landmarks];
}