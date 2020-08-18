import * as CPU from './cpu.js';

// FG : #202A35
// BG : #8F9185
const COLOR_FG_R = 0x20;
const COLOR_FG_G = 0x2a;
const COLOR_FG_B = 0x35;

const COLOR_BG_R = 0x8f;
const COLOR_BG_G = 0x91;
const COLOR_BG_B = 0x85;

const renderDP = (dp: Uint8Array, buffer: ImageData) => {
	for (let y = 0; y < 32; y++) {
		for (let x = 0; x < 64; x++) {
			const p = dp[y * 64 + x];
			const r = p ? COLOR_FG_R : COLOR_BG_R;
			const g = p ? COLOR_FG_G : COLOR_BG_G;
			const b = p ? COLOR_FG_B : COLOR_BG_B;
			buffer.data[4 * (y * 64 + x) + 0] = r;
			buffer.data[4 * (y * 64 + x) + 1] = g;
			buffer.data[4 * (y * 64 + x) + 2] = b;
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

type TKeyCodes = 49 | 50 | 51 | 52 | 65 | 83 | 68 | 70 | 81 | 87 | 69 | 82 | 89 | 88 | 67 | 86;
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
	state = CPU.create_state();

	for (const key in KeyCodes) {
		const val = KeyCodes[key];
		KeyInputBuffer[val] = false;
	}

	reader.readAsArrayBuffer(file);
	reader.onload = function () {
		CPU.load_rom(reader.result as ArrayBuffer, state);
		t1 = performance.now();
		let timer = requestAnimationFrame(tick);
		input.value = null;
	};
	reader.onerror = function () {
		console.log(reader.error);
	};
}

let t1 = 0;

const renderCPU = (state: CPU.ICPUState, c_left: HTMLDivElement, c_right: HTMLDivElement) => {
	const subDiv_l = document.createElement('div');
	for (const r in state.registers) {
		const rf = Number(r).toString(16).toUpperCase();
		const rv = state.registers[r].toString(16).padStart(2, '0');
		const sp = document.createElement('p');
		sp.innerText = `V${rf}:  0x${rv} `;
		subDiv_l.appendChild(sp);
	}
	c_left.replaceChild(subDiv_l, c_left.childNodes[0]);

	const subDiv_r = document.createElement('div');
	for (const r in state.specialReg) {
		const rf = CPU.SpecialRegs[r].padStart(2, '#');
		const rv = state.specialReg[r].toString(16).padStart(4, '0');
		const sp = document.createElement('p');
		sp.innerText = `${rf}:  0x${rv} `;
		subDiv_r.appendChild(sp);
	}

	const st_p = document.createElement('p');
	const st = Math.round(state.ST).toString(16).padStart(2, '0');
	st_p.innerText = ` ST: 0x${st}`;
	subDiv_r.appendChild(st_p);

	const dt_p = document.createElement('p');
	const dt = Math.round(state.DT).toString(16).padStart(2, '0');
	dt_p.innerText = ` DT: 0x${dt}`;
	subDiv_r.appendChild(dt_p);

	c_right.replaceChild(subDiv_r, c_right.childNodes[0]);
};

const renderASM = (state: CPU.ICPUState, asm_div: HTMLDivElement) => {
	const items = 19 * 2;
	let offset = 5 * 2;
	const pc = state.specialReg[CPU.SpecialRegs.PC];
	const item_div = document.createElement('div');

	if((pc - offset) < 0x200) {
		offset = offset - pc;
	}

	for (let i = pc - offset; i < pc - offset + items; i += 2) {
		const p = document.createElement('p');

		const bh = state.memory[i];
		const bl = state.memory[i + 1];
		const op = ((bh << 8) | bl).toString(16).padStart(4, '0');

		const pc_s = i.toString(16).padStart(4, '0');

		p.textContent = `0x${pc_s} 0x${op} T`;
		item_div.appendChild(p);
	}

	asm_div.replaceChild(item_div, asm_div.childNodes[0]);
};

let interfaceRefreshRate = 10; // HZ
let counterTick = (1 / interfaceRefreshRate) * 1000;

const tick = (t: number) => {
	const delta = t - t1;
	const ticks = (state.clockSpeed / 1000) * delta;
	if (!state.halt) {
		for (let i = 0; i < ticks; i++) {
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

				CPU.fetch(state);
				CPU.decode(state);
				CPU.exec(state);
			} catch (err) {
				debugDP(state.frameBuffer);
				console.error(err);
				return;
			}
		}
		t1 = t;
		renderDP(state.frameBuffer, imgData);
		const cpu_div_1 = document.querySelector('#cpu_1') as HTMLDivElement;
		const cpu_div_2 = document.querySelector('#cpu_2') as HTMLDivElement;
		const asm_div = document.querySelector('#asm') as HTMLDivElement;
		renderer.getContext('2d').putImageData(imgData, 0, 0);
		ctx.drawImage(renderer, 0, 0, 64 * 8, 32 * 8);

		counterTick -= delta;
		if (counterTick < 0) {
			renderCPU(state, cpu_div_1, cpu_div_2);
			renderASM(state, asm_div);
			counterTick = (1 / interfaceRefreshRate) * 1000;
		}

		requestAnimationFrame(tick);
	}
};
