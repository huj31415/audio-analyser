let mode = "spectrogram"; // frequency || wave || spectrogram

let speed = 1;

let paused = false;
{
  document.getElementById("freq").onclick = () => {
    mode = "frequency";
  };

  document.getElementById("wave").onclick = () => {
    mode = "wave";
  };

  document.getElementById("spec").onclick = () => {
    ctx.fillstyle = "black";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    mode = "spectrogram";
    y = 0;
  };

  document.getElementById("zoomIn").onclick = () => {
    if (analyser.fftSize < 32768) {
      size /= 2;
      max.innerText = maxFreq / (FREQSIZE / size);
      analyser.fftSize *= 2;
    }
  };
  document.getElementById("zoomOut").onclick = () => {
    if (analyser.fftSize > 2048) {
      size *= 2;
      max.innerText = maxFreq / (FREQSIZE / size);
      analyser.fftSize /= 2;
    }
  };

  document.getElementById("speed").addEventListener("input", (event) => {
    speed = event.target.value;
  });
  document.getElementById("cutoff").addEventListener("input", (event) => {
    analyser.minDecibels = event.target.value;
  });

  // document.getElementById("toggle").onclick = () => {
  //   paused = !paused;
  //   if (paused) stream.pause();
  //   else stream.start();
  // }
}

/**
 * Map values from one range to another (lerp)
 * @param {Number} in_min minimum input value
 * @param {Number} in_max maximum input value
 * @param {Number} out_min minimum output value
 * @param {Number} out_max maximum output value
 * @param {Boolean} clampMax whether to clamp the maximum value if the input exceeds max
 * @param {Boolean} clampMin whether to clamp the minimum value if the input exceeds min
 */
Number.prototype.lerp = function (
  in_min,
  in_max,
  out_min,
  out_max,
  round = true,
  clampMax = false,
  clampMin = false
) {
  let mapped = ((this - in_min) * (out_max - out_min)) / (in_max - in_min) + out_min;
  mapped = clampMax ? Math.min(mapped, out_max) : mapped;
  mapped = clampMin ? Math.max(mapped, out_min) : mapped;
  return round ? Math.round(mapped) : mapped;
};

const FFTSIZE = 2048; // powers of 2 - default 2048
const FREQSIZE = FFTSIZE / 2;
let size = FREQSIZE;

const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d", { willReadFrequently: true });
canvas.width = FREQSIZE;


const fpsGraph = document.getElementById("fpsGraph");
const fpsCtx = fpsGraph.getContext("2d");
fpsCtx.fillStyle = "rgba(0, 0, 0, 1)";
fpsCtx.fillRect(0, 0, canvas.width, canvas.height);
let frameCount = 0;
let lastTime = performance.now();
let xCoord = 0;
const fpsOut = document.getElementById("fps");

const max = document.getElementById("maxFreq");

window.onresize = window.onload = () => {
  canvas.height = ~~(FREQSIZE * ((window.innerHeight * 0.6) / window.innerWidth));
  y = 0;
};

const table = document.getElementById("table");
let fillTable = false;

document.getElementById("fillTable").onclick = (event) => {
  fillTable = event.target.checked;
  table.style.display = fillTable ? "inline-block" : "none";
};

let rows = [];
let intensities = [];
let sampleRate,
  maxFreq = 0,
  freqPerBin;

let highest = [];

let y = 0;

let analyser, audioCtx;

function analyse(stream) {
  // Create an audio context
  audioCtx = new window.AudioContext();

  // Create a media stream source from the microphone stream
  let source = audioCtx.createMediaStreamSource(stream);

  // Create an AnalyserNode to analyze the audio data
  analyser = audioCtx.createAnalyser();
  analyser.fftSize = FFTSIZE; // Adjust the FFT size as needed
  analyser.maxDecibels = 0;
  analyser.minDecibels = -100;
  sampleRate = audioCtx.sampleRate;
  maxFreq = sampleRate / 2;
  freqPerBin = maxFreq / FREQSIZE;

  max.innerHTML = (FREQSIZE / size) * maxFreq;

  // Connect the source to the analyser
  source.connect(analyser);

  for (let i = 0; i < FREQSIZE; i++) {
    let row = document.createElement("tr");
    row.id = i;
    let freq = document.createElement("td");
    freq.innerText = (i + 1) * freqPerBin;
    let intensity = document.createElement("td");
    row.appendChild(freq);
    row.appendChild(intensity);
    table.appendChild(row);
    rows.push(row);
    intensities.push(intensity);
  }

  // Function to process the frequency data and list frequency components
  function processFrequencyData() {
    // Create a new array to store the frequency data
    let frequencyData = new Uint8Array(analyser.frequencyBinCount);

    // Get the frequency data from the analyser
    analyser.getByteFrequencyData(frequencyData);

    if (!paused) {
      drawFrequency(frequencyData);
      if (mode == "wave") {
        drawWave(analyser);
      }
    }
    // Request the next frame of animation
    // requestAnimationFrame(processFrequencyData);
    if (stream) setTimeout(processFrequencyData, 0.1);
    updateGraphs(100);
  }

  // Start processing the frequency data
  processFrequencyData();
}

navigator.mediaDevices
  .getUserMedia({ audio: true })
  .then(analyse)
  .catch(function (err) {
    console.error("Error accessing microphone: ", err);
  });

function drawFrequency(frequencyData) {
  const drawWidth = canvas.width / FREQSIZE;

  if (mode == "frequency") {
    ctx.fillstyle = "black";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.beginPath();
    ctx.lineWidth = ~~drawWidth + 1;
    ctx.strokeStyle = "white";
    frequencyData.forEach((value, i) => {
      if (i < canvas.width) {
        if (fillTable) intensities[i].innerText = value ? value.lerp(0, 255, analyser.minDecibels, 0) : "<" + analyser.minDecibels;
        if (value) {
          // ctx.strokeStyle = "rgba(255, " + value + ", 0, " + (value ? 32 + ~~((256 - 32) * value / 256) : 0) + ")";
          ctx.moveTo(drawWidth * i, canvas.height);
          ctx.lineTo(drawWidth * i, canvas.height - value);
        }
      }
    });
    ctx.stroke();
  } else if (mode == "spectrogram") {
    // const scroll = y + speed > canvas.height;
    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height + speed);
    const data = imgData.data;
    // const width = FREQSIZE / size;
    // y = scroll ? canvas.height : y + speed;
    frequencyData.forEach((value, i) => {
      if (i < canvas.width) {
        if (fillTable) intensities[i].innerText = value ? value.lerp(0, 255, analyser.minDecibels, 0) : "<" + analyser.minDecibels;
        for (let j = 0; j < speed; j++) {
          // const index = (y * canvas.width + i * width + j) * 4;
          const index = ((canvas.height - j) * canvas.width + i) * 4;
          data[index] = 255;
          data[index + 1] = value;
          data[index + 2] = 0;
          data[index + 3] = value ? 32 + ~~((256 - 32) * value / 256) : 0;//128 + ~~(value / 2);
        }
      }
    });
    ctx.putImageData(imgData, 0, -speed);
  } else if (fillTable) {
    frequencyData.forEach((value, i) => {
      intensities[i].innerText = value ? value.lerp(0, 255, analyser.minDecibels, 0) : "<" + analyser.minDecibels;
    });
  }
}

function drawWave(analyser) {
  // Create a new array to store the frequency data
  let timeData = new Uint8Array(FFTSIZE);

  // Get the frequency data from the analyser
  analyser.getByteTimeDomainData(timeData);
  ctx.fillstyle = "black";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  let drawWidth = canvas.width / (FFTSIZE / 2);
  ctx.beginPath();
  ctx.lineWidth = 2;
  ctx.strokeStyle = "white";

  timeData.forEach((value, i) => {
    // if (value) {
    if (i === 0) {
      ctx.moveTo(0, canvas.height / 2);
    } else {
      ctx.lineTo(drawWidth * i, canvas.height / 2 - value + 128); // drawWidth * i
    }
    // }
  });
  ctx.stroke();
}

let stream, sourceNode;

document.getElementById('audioInput').addEventListener('change', async function (event) {
  stream = sourceNode = null;
  const file = event.target.files[0];
  if (!file) return;

  const url = URL.createObjectURL(file);

  const response = await fetch(url);
  const arrayBuffer = await response.arrayBuffer();
  const audioContext = new window.AudioContext();
  const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

  sourceNode = audioContext.createBufferSource();
  sourceNode.buffer = audioBuffer;

  const destinationNode = audioContext.createMediaStreamDestination();
  sourceNode.connect(destinationNode);
  sourceNode.start();

  // Connect the audio buffer source to the audio context's destination
  sourceNode.connect(audioContext.destination);
  stream = destinationNode.stream;

  analyse(stream);

  // Cleanup the object URL after the file is loaded
  URL.revokeObjectURL(url);
});

/**
 * Update graphs to display framerate and number of bodies
 * @param {Number} interval interval to measure and display values
 */
function updateGraphs(interval) {
  // get fps
  frameCount++;
  const currentTime = performance.now();
  const elapsedTime = currentTime - lastTime;

  // only update in specific intervals
  if (elapsedTime >= interval) {
    const fps = frameCount / (elapsedTime / 1000);
    fpsOut.innerText = ~~(fps * 100) / 100;

    // fpsCtx.putImageData(fpsCtx.getImageData(0, 0, fpsGraph.width, fpsGraph.height), -2, 0);
    // draw fps graph
    xCoord += 2;
    fpsCtx.beginPath();
    fpsCtx.strokeStyle = fps >= 15 ? (fps >= 30 ? "lightgreen" : "orange") : "red"; //"white";
    fpsCtx.lineWidth = 1;
    fpsCtx.moveTo(xCoord % fpsGraph.width, fpsGraph.height);
    fpsCtx.lineTo(xCoord % fpsGraph.width, fpsGraph.height - ~~(fps / 2));
    fpsCtx.stroke();
    fpsCtx.fillStyle = "rgba(0, 0, 0, 0.01)";
    fpsCtx.fillRect(0, 0, xCoord % fpsGraph.width - 2, fpsGraph.height);
    fpsCtx.fillRect(xCoord % fpsGraph.width + 2, 0, fpsGraph.width, fpsGraph.height);

    frameCount = 0;
    lastTime = currentTime;
  }
}
