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

export function readFile(input: HTMLInputElement) {
	let state = CPU.newState();
	let file = input.files[0];
	let reader = new FileReader();

	reader.readAsArrayBuffer(file);
	const screen = document.getElementById('canvas') as HTMLCanvasElement;
	screen.width = 64 * 8;
	screen.height = 32 * 8;
	const ctx = screen.getContext('2d');
	ctx.imageSmoothingEnabled = false;
	const imgData = ctx.getImageData(0, 0, 64, 32);
	var renderer = document.createElement('canvas');
	renderer.width = imgData.width;
	renderer.height = imgData.height;

	reader.onload = function () {
		CPU.loadRom(reader.result as ArrayBuffer, state);
		while (!state.halt) {
			try {
				CPU.cpu_fetch(state);
				CPU.cpu_decode(state);
				CPU.cpu_exec(state);

				renderDP(state.displayBuffer, imgData);
				renderer.getContext('2d').putImageData(imgData, 0, 0);
				ctx.drawImage(renderer, 0, 0, 64*8, 32*8);
			} catch (err) {
				debugDP(state.displayBuffer);
				console.error(err);
			}
		}
		input.value = null;
	};
	reader.onerror = function () {
		console.log(reader.error);
	};
}
