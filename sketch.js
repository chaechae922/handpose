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

  // 웹캠 설정
  video = createCapture(VIDEO);
  video.size(640, 480);
  video.hide();

  // handpose 모델 로드
  handpose = ml5.handpose(video, () => {
    console.log("🤖 Handpose model loaded!");
  });
  handpose.on("predict", results => predictions = results);

  // 시리얼 포트 연결
  port = createSerial();
  let usedPorts = usedSerialPorts();
  if (usedPorts.length > 0) port.open(usedPorts[0], 9600);

  // 아두이노 연결 버튼
  connectBtn = createButton("Connect to Arduino");
  connectBtn.position(10, height - 40);
  connectBtn.mousePressed(togglePort);

  // 슬라이더 생성 및 값 변경 시 아두이노에 전송
  redSlider = createSlider(100, 5000, redTime, 100);
  redSlider.position(10, 20).input(() => {
    redTime = redSlider.value();
    sendCommand(`redTime=${redTime}`);
    if (ledRed === 1 && mode === "normal") sendCommand("apply=red");
  });

  yellowSlider = createSlider(100, 5000, yellowTime, 100);
  yellowSlider.position(10, 60).input(() => {
    yellowTime = yellowSlider.value();
    sendCommand(`yellowTime=${yellowTime}`);
    if (ledYellow === 1 && mode === "normal") sendCommand("apply=yellow");
  });

  greenSlider = createSlider(100, 5000, greenTime, 100);
  greenSlider.position(10, 100).input(() => {
    greenTime = greenSlider.value();
    sendCommand(`greenTime=${greenTime}`);
    if (ledGreen === 1 && mode === "normal") sendCommand("apply=green");
  });
}

function draw() {
  background(230);

  // 웹캠 이미지 표시 + 손 keypoints 표시
  image(video, 20, 270, 160, 120);
  drawKeypoints();

  // 시리얼 데이터 읽기
  let count = 0;
  while (port.available() > 0 && count < 10) {
    const data = port.readUntil("\n").trim();
    if (data.length > 0) parseSerialData(data);
    count++;
  }

  // 상태 텍스트 표시
  fill(0);
  text(`Mode: ${mode}`, 70, 160);
  text(`Brightness: ${brightness}`, 70, 180);
  text(`LED(R/Y/G): ${ledRed}, ${ledYellow}, ${ledGreen}`, 80, 200);
  text(`Red Time: ${redTime}`, 350, 30);
  text(`Yellow Time: ${yellowTime}`, 350, 70);
  text(`Green Time: ${greenTime}`, 350, 110);

  // LED 상태 표시
  drawLED(width / 2, 250, ledRed, "RED", color(255, 0, 0));
  drawLED(width / 2, 330, ledYellow, "YELLOW", color(255, 255, 0));
  drawLED(width / 2, 410, ledGreen, "GREEN", color(0, 255, 0));

  // 제스처 인식 처리
  handleGestures();
}

// 손가락 keypoints 시각화
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

// LED 그래픽으로 그리기
function drawLED(x, y, on, label, ledColor) {
  fill(on ? ledColor : "gray");
  stroke(0);
  ellipse(x, y, 60);
  fill(0);
  noStroke();
  textAlign(CENTER);
  text(label, x, y + 40);
}

// 포트 열기/닫기 전환
function togglePort() {
  if (!port.opened()) port.open(9600);
  else port.close();
}

// 아두이노에 명령 전송
function sendCommand(cmd) {
  if (port.opened()) port.write(`cmd:${cmd};\n`);
}

// 아두이노에서 받은 데이터 파싱
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

// ===================== 제스처 처리 =====================
function handleGestures() {
  if (predictions.length === 0) return;

  const now = millis();
  const hand = predictions[0].landmarks;
  const extended = getExtendedFingers(hand);
  let gesture = "";

  // 제스처 판별 및 시간 조절
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
    gesture = "greenDown";
    greenTime = constrain(greenTime - 300, 100, 5000);
    greenSlider.value(greenTime);
    sendCommand(`greenTime=${greenTime}`);
  } else if (extended.length === 5) {
    gesture = "emergency";
  } else if (isNormal(hand)) {
    gesture = "normal";
  } else if (isBlink(hand)) {
    gesture = "blink";
  } else if (isOnOff(hand)) {
    gesture = "onoff";
  }

  // 제스처가 바뀐 경우에만 명령 전송
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

// 핀 손가락 식별 (손가락 번호 반환)
function getExtendedFingers(lm) {
  const extended = [];
  if (lm[4][0] > lm[3][0]) extended.push(1); // 엄지
  if (lm[8][1] < lm[6][1]) extended.push(2); // 검지
  if (lm[12][1] < lm[10][1]) extended.push(3); // 중지
  if (lm[16][1] < lm[14][1]) extended.push(4); // 약지
  if (lm[20][1] < lm[18][1]) extended.push(6); // 새끼
  return extended;
}

// Normal 모드 제스처: 손가락 3개 핀 상태
function isNormal(lm) {
  const ext = getExtendedFingers(lm);
  return ext.length === 3;
}

// On/Off 모드 제스처: 손가락 4개 핀 상태
function isOnOff(lm) {
  const ext = getExtendedFingers(lm);
  return ext.length === 4;
}

// Blink 모드: 엄지 + 새끼 핀 상태 (🤙 제스처)
function isBlink(lm) {
  const ext = getExtendedFingers(lm);
  return ext.length === 2 && ext.includes(1) && ext.includes(6);
}