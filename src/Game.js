const wasm = require('./wasm/genplus.js');
const fs = require('fs');
const { createCanvas } = require('canvas');

fs.readFileSync(__dirname+'/wasm/genplus.wasm');

class Game {
    constructor() {
        this.canvas = createCanvas(320, 240);
        this.canvasContext = this.canvas.getContext('2d');
        this.canvasContext.fillStyle = "#00FFFF";
        this.canvasContext.font = "12px monospace";
        this.canvasImageData = this.canvasContext.createImageData(320, 240);
        this.fps = 0;
        this.frame = 60;
        this.startTime = new Date().getTime();
        this.initialized = false;
        this.pause = false;
        this.now = 0;
        this.then = 0;
        this.delta = 0;
        this.audio_l = null;
        this.audio_r = null;
        this.romdata = null;
        this.vram = null;
        this.gens = null;
        this.ROM_PATH = './assets/roms/mk/8.bin';
        this.CANVAS_WIDTH = 320;
        this.CANVAS_HEIGHT = 240;
        this.SAMPLING_PER_FPS = 736;
        this.GAMEPAD_API_INDEX = 32;
        this.FPS = 60;
        this.INTERVAL = 1000 / this.FPS;
        this.init();
    }

    init() {
        wasm().then(module => {
            this.gens = module;
            this.gens._init();
            const bytes = fs.readFileSync(this.ROM_PATH);
            this.romdata = new Uint8Array(this.gens.HEAPU8.buffer, this.gens._get_rom_buffer_ref(bytes.byteLength), bytes.byteLength);
            this.romdata.set(new Uint8Array(bytes));
            this.initialized = true;
            this.start();
        });
    }

    start() {
        if (this.initialized) {
            this.canvasContext.clearRect(0, 0, this.canvas.width, this.canvas.height);
            this.gens._start();
            // vram view
            this.vram = new Uint8ClampedArray(this.gens.HEAPU8.buffer, this.gens._get_frame_buffer_ref(), this.CANVAS_WIDTH * this.CANVAS_HEIGHT * 4);
            // audio view
            this.audio_l = new Float32Array(this.gens.HEAPF32.buffer, this.gens._get_web_audio_l_ref(), this.SAMPLING_PER_FPS);
            this.audio_r = new Float32Array(this.gens.HEAPF32.buffer, this.gens._get_web_audio_r_ref(), this.SAMPLING_PER_FPS);
            // input
            this.input = new Float32Array(this.gens.HEAPF32.buffer, this.gens._get_input_buffer_ref(), this.GAMEPAD_API_INDEX);
            // game loop
            this.then = Date.now();
            this.mainLoop();
        }
    }

    mainLoop() {
        setTimeout(this.mainLoop.bind(this), 0)
        let now = Date.now();
        let delta = now - this.then;
        if (delta > this.INTERVAL && !this.pause) {
            this.gens._tick();
            this.then = now - (delta % this.INTERVAL);
            this.canvasImageData.data.set(this.vram);
            this.canvasContext.putImageData(this.canvasImageData, 0, 0);
            this.frame++;
            if(new Date().getTime() - this.startTime >= 1000) {
                this.fps = this.frame;
                this.frame = 0;
                this.startTime = new Date().getTime();
            }
            this.gens._sound();
        }
    }
}

module.exports = Game;