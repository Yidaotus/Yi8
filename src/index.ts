import * as CPU from './cpu.js';

const renderDP = (dp: Uint8Array, buffer: ImageData) => {
	for (let y = 0; y < 32; y++) {
		for (let x = 0; x < 64; x++) {
			const p = dp[y * 64 + x];
			buffer.data[4 * (y * 64 + x) + 0] = p * 255;
			buffer.data[4 * (y * 64 + x) + 1] = p * 255;
			buffer.data[4 * (y * 64 + x) + 2] = p * 255;
			buffer.data[4 * (y * 64 + x) + 3] = 255;
		}
	}
};

const debugDP = (dp: Uint8Array) => {
	let dpString = '-'.repeat(64);
	for (let y = 0; y < 32; y++) {
		let line = '';
		for (let x = 0; x < 64; x++) {
			const p = dp[y * 64 + x];
			line += p === 0 ? ' ' : 'X';
		}
		dpString += `\n${line}`;
	}
	dpString += '\n' + '-'.repeat(64);
	console.log(dpString);
};

const bufferInputDownEvent = (e: KeyboardEvent) => {
	if (Object.values(KeyCodes).includes(e.keyCode as TKeyCodes)) {
		KeyInputBuffer[e.keyCode as TKeyCodes] = true;
	}
};
const bufferInputUpEvent = (e: KeyboardEvent) => {
	if (Object.values(KeyCodes).includes(e.keyCode as TKeyCodes)) {
		KeyInputBuffer[e.keyCode as TKeyCodes] = false;
	}
};

let state: CPU.ICPUState;
let timer: number;

const screen = document.getElementById('canvas') as HTMLCanvasElement;
screen.addEventListener('keydown', bufferInputDownEvent);
screen.addEventListener('keyup', bufferInputUpEvent);
screen.width = 64 * 8;
screen.height = 32 * 8;

const ctx = screen.getContext('2d');
ctx.imageSmoothingEnabled = false;

const imgData = ctx.getImageData(0, 0, 64, 32);

const renderer = document.createElement('canvas');
renderer.width = imgData.width;
renderer.height = imgData.height;

type TKeyCodes =
	| 49
	| 50
	| 51
	| 52
	| 65
	| 83
	| 68
	| 70
	| 81
	| 87
	| 69
	| 82
	| 89
	| 88
	| 67
	| 86;
type TKeyInputBuffer = Partial<{ [key in TKeyCodes]: boolean }>;

let KeyCodes: {
	[index: string]: TKeyCodes;
} = {
	ONE: 49,
	TWO: 50,
	THREE: 51,
	FOUR: 52,
	Q: 81,
	W: 87,
	E: 69,
	R: 82,
	A: 65,
	S: 83,
	D: 68,
	F: 70,
	Y: 89,
	X: 88,
	C: 67,
	V: 86,
};

const KeyInputBuffer: TKeyInputBuffer = {};

export function readFile(input: HTMLInputElement) {
	let file = input.files[0];
	let reader = new FileReader();
	state = CPU.newState();

	for (const key in KeyCodes) {
		const val = KeyCodes[key];
		KeyInputBuffer[val] = false;
	}

	reader.readAsArrayBuffer(file);
	reader.onload = function () {
		CPU.loadRom(reader.result as ArrayBuffer, state);
		const msTickRate = 1000 / state.clockSpeed;

		let timer = requestAnimationFrame(tick);
		input.value = null;
	};
	reader.onerror = function () {
		console.log(reader.error);
	};
}

const tick = () => {
	if (!state.halt) {
		for (let i = 0; i < state.clockSpeed / 60; i++) {
			try {
				state.keys[1] = KeyInputBuffer[KeyCodes.ONE];
				state.keys[2] = KeyInputBuffer[KeyCodes.TWO];
				state.keys[3] = KeyInputBuffer[KeyCodes.THREE];
				state.keys[0xc] = KeyInputBuffer[KeyCodes.FOUR];

				state.keys[4] = KeyInputBuffer[KeyCodes.Q];
				state.keys[5] = KeyInputBuffer[KeyCodes.W];
				state.keys[6] = KeyInputBuffer[KeyCodes.E];
				state.keys[0xd] = KeyInputBuffer[KeyCodes.R];

				state.keys[7] = KeyInputBuffer[KeyCodes.A];
				state.keys[8] = KeyInputBuffer[KeyCodes.S];
				state.keys[9] = KeyInputBuffer[KeyCodes.D];
				state.keys[0xe] = KeyInputBuffer[KeyCodes.F];

				state.keys[0xa] = KeyInputBuffer[KeyCodes.Y];
				state.keys[0] = KeyInputBuffer[KeyCodes.X];
				state.keys[0xb] = KeyInputBuffer[KeyCodes.C];
				state.keys[0xf] = KeyInputBuffer[KeyCodes.V];

				CPU.cpu_fetch(state);
				CPU.cpu_decode(state);
				CPU.cpu_exec(state);
			} catch (err) {
				debugDP(state.displayBuffer);
				console.error(err);
				return;
			}
		}
		renderDP(state.displayBuffer, imgData);
		renderer.getContext('2d').putImageData(imgData, 0, 0);
		ctx.drawImage(renderer, 0, 0, 64 * 8, 32 * 8);
		requestAnimationFrame(tick);
	}
};
