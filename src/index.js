const wasm = require('./wasm/genplus.js');
const fs = require('fs');
fs.readFileSync(__dirname+'/wasm/genplus.wasm');

const { createCanvas } = require('canvas');
const ROM_PATH = './assets/roms/d.bin';
const CANVAS_WIDTH = 640;
const CANVAS_HEIGHT = 480;
const SAMPLING_PER_FPS = 736;
const GAMEPAD_API_INDEX = 32;

// emulator
let gens;
let romdata;
let vram;
let initialized = false;
let pause = false;

// canvas member
let canvas;
let canvasContext;
let canvasImageData;

// fps control
const FPS = 60;
const INTERVAL = 1000 / FPS;
let now;
let then;
let delta;
let startTime;
let fps;
let frame;
let audio_l;
let audio_r;

(function() {
    canvas = createCanvas(CANVAS_WIDTH, CANVAS_HEIGHT);
    canvasContext = canvas.getContext('2d');
    canvasContext.fillStyle = "#00FFFF";
    canvasContext.font = "12px monospace";
    canvasImageData = canvasContext.createImageData(CANVAS_WIDTH, CANVAS_HEIGHT);
    // for fps print
    fps = 0;
    frame = FPS;
    startTime = new Date().getTime();
})();

wasm().then(function(module) {
    gens = module;
    // memory allocate
    gens._init();
    console.log(gens);

    const bytes = fs.readFileSync(ROM_PATH);
    romdata = new Uint8Array(gens.HEAPU8.buffer, gens._get_rom_buffer_ref(bytes.byteLength), bytes.byteLength);
    romdata.set(new Uint8Array(bytes));
    // message("TOUCH HERE!");
    initialized = true;
    start()
});

const start = function() {
    if(!initialized) return;
    canvasContext.clearRect(0, 0, canvas.width, canvas.height);
    // emulator start
    gens._start();
    // vram view
    vram = new Uint8ClampedArray(gens.HEAPU8.buffer, gens._get_frame_buffer_ref(), CANVAS_WIDTH * CANVAS_HEIGHT * 4);
    // audio view
    audio_l = new Float32Array(gens.HEAPF32.buffer, gens._get_web_audio_l_ref(), SAMPLING_PER_FPS);
    audio_r = new Float32Array(gens.HEAPF32.buffer, gens._get_web_audio_r_ref(), SAMPLING_PER_FPS);
    // input
    input = new Float32Array(gens.HEAPF32.buffer, gens._get_input_buffer_ref(), GAMEPAD_API_INDEX);
    // game loop
    then = Date.now();
    loop();
};

const loop = function() {
    setTimeout(loop, 0)
    now = Date.now();
    delta = now - then;
    if (delta > INTERVAL && !pause) {
        // keyscan();
        // update
        gens._tick();
        then = now - (delta % INTERVAL);
        canvasImageData.data.set(vram);
        canvasContext.putImageData(canvasImageData, 0, 0);
        frame++;
        if(new Date().getTime() - startTime >= 1000) {
            fps = frame;
            frame = 0;
            startTime = new Date().getTime();
        }
        // sound
        gens._sound();
    }
};

const server = require('http').createServer();
const io = require('socket.io')(server, {
    forceNew: true,
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});
server.listen(3000, "localhost");

io.on('connection', function(socket){
    console.log('a user connected');
    let t = setInterval(()=>{
        socket.emit("frame", {"image": canvas.toDataURL(), "audio_l": audio_l, "audio_r": audio_r, "fps": fps});
    }, 0);
    socket.on("disconnect",()=>{
        console.log("disconnect");
        clearInterval(t);
    });
    socket.on("connect",()=>{
        console.log("connect");

    });
    socket.on('chat message', function(msg){
        io.emit('chat message', msg);
    });
});
