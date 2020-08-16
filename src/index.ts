import * as CPU from "./cpu";

let state = CPU.newState();

export function readFile(input: HTMLInputElement) {
  let file = input.files[0];
  let reader = new FileReader();

  reader.readAsArrayBuffer(file);
  reader.onload = function () {
    CPU.loadRom(reader.result as ArrayBuffer, state);
    while (!state.halt) {
      CPU.cpu_fetch(state);
      CPU.cpu_decode(state);
      CPU.cpu_exec(state);
    }
  };
  reader.onerror = function () {
    console.log(reader.error);
  };
}
