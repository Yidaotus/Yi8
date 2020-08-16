import * as CPU from "./cpu";

let state = CPU.newState();

const renderDP = (dp: Uint8Array, buffer: ImageData) => {
  for (let y = 0; y < 32; y++) {
    for (let x = 0; x < 64 / 8; x++) {
      let sx = x * 8;
      for (let b = 0; b < 8; b++) {
        const p = (dp[y * x + x] & (0x01 << b)) >> b;
        buffer.data[4 * (y * 64 + sx + b) + 0] = p * 255;
        buffer.data[4 * (y * 64 + sx + b) + 1] = p * 255;
        buffer.data[4 * (y * 64 + sx + b) + 2] = p * 255;
        buffer.data[4 * (y * 64 + sx + b) + 3] = 255;
      }
    }
  }
  const test = 10;
};

export function readFile(input: HTMLInputElement) {
  let file = input.files[0];
  let reader = new FileReader();

  reader.readAsArrayBuffer(file);
  const screen = document.getElementById("canvas") as HTMLCanvasElement;
  const ctx = screen.getContext("2d");
  const imgData = ctx.getImageData(0, 0, 64, 32);
  ctx.scale(100, 100);
  reader.onload = function () {
    CPU.loadRom(reader.result as ArrayBuffer, state);
    while (!state.halt) {
      CPU.cpu_fetch(state);
      CPU.cpu_decode(state);
      CPU.cpu_exec(state);
      renderDP(state.displayBuffer, imgData);
      ctx.putImageData(imgData, 0, 0);
    }
  };
  reader.onerror = function () {
    console.log(reader.error);
  };
}
