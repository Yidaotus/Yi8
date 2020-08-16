interface ICPUState {
  registers: Uint8Array;
  specialReg: Uint16Array;
  memory: Uint8Array;
  stack: Uint16Array;
  displayBuffer: Uint8Array;
  currentInstruction: number;
  halt: boolean;
  execThunk(): void;
}

const DIGIT_SPRITES: { [index: number]: number[] } = {
  0: [0xf0, 0x10, 0xf0, 0x80, 0xf0],
  1: [0xf0, 0x10, 0xf0, 0x80, 0xf0],
  2: [0xf0, 0x10, 0xf0, 0x80, 0xf0],
  3: [0xf0, 0x10, 0xf0, 0x10, 0xf0],
  4: [0x90, 0x90, 0xf0, 0x10, 0x10],
  5: [0xf0, 0x90, 0x90, 0x90, 0xf0],
  6: [0xf0, 0x90, 0x90, 0x90, 0xf0],
  7: [0xf0, 0x90, 0x90, 0x90, 0xf0],
  8: [0xf0, 0x90, 0x90, 0x90, 0xf0],
  9: [0xf0, 0x90, 0x90, 0x90, 0xf0],
  0xa: [0xf0, 0x90, 0x90, 0x90, 0xf0],
  0xb: [0xf0, 0x90, 0x90, 0x90, 0xf0],
  0xc: [0xf0, 0x90, 0x90, 0x90, 0xf0],
  0xd: [0xf0, 0x90, 0x90, 0x90, 0xf0],
  0xe: [0xf0, 0x90, 0x90, 0x90, 0xf0],
  0xf: [0xf0, 0x90, 0x90, 0x90, 0xf0],
};

enum SpecialRegs {
  PC,
  I,
  SP,
  __SIZE,
}

enum DataRegisters {
  V0 = 0,
  V1 = 1,
  V2 = 2,
  V3 = 3,
  V4 = 4,
  V5 = 5,
  V6 = 6,
  V7 = 7,
  V8 = 8,
  V9 = 9,
  VA = 10,
  VB = 11,
  VC = 12,
  VD = 13,
  VE = 16,
  VF = 15,
  __SIZE,
}

type OpCode =
  | "LD_B"
  | "CALL"
  | "LD_I"
  | "DRAW"
  | "ADD"
  | "SE"
  | "SNE"
  | "JMP"
  | "RET"
  | "LD_F";
type StateModifier = (state: ICPUState, ...rest: unknown[]) => void;
type IOpCodes = {
  [key in OpCode]: StateModifier;
};

const LOAD_ADDRESS = 0x200;
const SCREEN = {
  WIDTH: 64,
  HEIGHT: 32,
};

const ops: IOpCodes = {
  LD_B: (state: ICPUState, register: number, value: number) => {
    state.registers[register] = value;
  },
  LD_I: (state: ICPUState, value: number) => {
    state.registers[SpecialRegs.I] = value;
  },
  LD_F: (state: ICPUState, character: number) => {
    state.specialReg[SpecialRegs.I] = character * 5;
  },
  ADD: (state: ICPUState, register: number, value: number) => {
    state.registers[register] += value;
  },
  JMP: (state: ICPUState, address: number) => {
    state.specialReg[SpecialRegs.PC] = address;
  },
  SE: (state: ICPUState, register: number, value: number) => {
    let pc = state.specialReg[SpecialRegs.PC];
    let regVal = state.registers[register];
    state.specialReg[SpecialRegs.PC] = regVal === value ? (pc += 4) : (pc += 2);
  },
  SNE: (state: ICPUState, register: number, value: number) => {
    let pc = state.specialReg[SpecialRegs.PC];
    let regVal = state.registers[register];
    state.specialReg[SpecialRegs.PC] = regVal !== value ? (pc += 4) : (pc += 2);
  },
  CALL: (state: ICPUState, subroutine: number) => {
    const SP = state.specialReg[SpecialRegs.SP]++;
    state.stack[SP] = state.specialReg[SpecialRegs.PC] + 2;
    state.specialReg[SpecialRegs.PC] = subroutine;
  },
  RET: (state: ICPUState) => {
    const SP = --state.specialReg[SpecialRegs.SP];
    state.specialReg[SpecialRegs.PC] = state.stack[SP];
  },
  DRAW: (state: ICPUState, sx: number, sy: number, height: number) => {
    for (let y = 0; y < height; y++) {
      const spriteByte = state.memory[state.specialReg[SpecialRegs.I] + y];
      const oldByte = state.displayBuffer[(sy + y) * SCREEN.WIDTH + sx];
      const newByte = oldByte ^ spriteByte;
      let flipped = 0;

      for (let b = 0; b < 8; b++) {
        if (!((oldByte >> b) & 1 & ((newByte >> b) & 1))) {
          flipped = 1;
          break;
        }
      }

      state.displayBuffer[(sy + y) * SCREEN.WIDTH + sx] = newByte;
      state.registers[DataRegisters.VF] = flipped;
    }
  },
};

const newState = (): ICPUState => {
  const state: ICPUState = {
    registers: new Uint8Array(DataRegisters.__SIZE),
    specialReg: new Uint16Array(SpecialRegs.__SIZE),
    memory: new Uint8Array(0x1000),
    stack: new Uint16Array(48),
    displayBuffer: new Uint8Array(32 * 64),
    currentInstruction: 0x00,
    halt: false,
    execThunk: () => {},
  };
  state.specialReg[SpecialRegs.PC] = 0x200;
  for (let i = 0; i < 16; i++) {
    for (let x = 0; x < 5; x++) {
      state.memory[i * 5 + x] = DIGIT_SPRITES[i][x];
    }
  }

  return state;
};

const loadRom = (file: ArrayBuffer, state: ICPUState) => {
  const rom = new Uint8Array(file);
  for (let i = 0; i <= rom.length; i++) {
    state.memory[LOAD_ADDRESS + i] = rom[i];
  }
};

const cpu_fetch = (state: ICPUState) => {
  const bh = state.memory[state.specialReg[SpecialRegs.PC]];
  const bl = state.memory[state.specialReg[SpecialRegs.PC] + 1];
  state.currentInstruction = (bh << 8) | bl;
};

const cpu_decode = (state: ICPUState) => {
  const type = (state.currentInstruction & 0xf000) >> 12;
  switch (type) {
    case 0x0: {
      const subType = state.currentInstruction & 0x00ff;
      if (subType === 0xee) {
        state.execThunk = () => ops.RET(state);
      }
      return;
    }
    case 0x1: {
      const address = state.currentInstruction & 0x0fff;
      state.execThunk = () => ops.JMP(state, address);
      break;
    }
    case 0x2: {
      const subroutine = state.currentInstruction & 0x0fff;
      state.execThunk = () => ops.CALL(state, subroutine);
      break;
    }
    case 0x3: {
      const register = (state.currentInstruction & 0x0f00) >> 8;
      const value = state.currentInstruction & 0x00ff;
      state.execThunk = () => ops.SE(state, register, value);
      break;
    }
    case 0x4: {
      const register = (state.currentInstruction & 0x0f00) >> 8;
      const value = state.currentInstruction & 0x00ff;
      state.execThunk = () => ops.SNE(state, register, value);
      break;
    }
    case 0x6: {
      const register = (state.currentInstruction & 0x0f00) >> 8;
      const value = state.currentInstruction & 0x00ff;
      state.execThunk = () => ops.LD_B(state, register, value);
      break;
    }
    case 0x7: {
      const register = (state.currentInstruction & 0x0f00) >> 8;
      const value = state.currentInstruction & 0x00ff;
      state.execThunk = () => ops.ADD(state, register, value);
      break;
    }
    case 0xa: {
      const value = state.currentInstruction & 0x0fff;
      state.execThunk = () => ops.LD_I(state, value);
      break;
    }
    case 0xd: {
      const x = state.currentInstruction & 0x0f00;
      const y = state.currentInstruction & 0x00f0;
      const height = state.currentInstruction & 0x000f;
      state.execThunk = () => ops.DRAW(state, x, y, height);
      break;
    }
    case 0xf: {
      // Fx29 - LD F, Vx
      //Set I = location of sprite for digit Vx.

      //The value of I is set to the location for the hexadecimal sprite corresponding to the value of Vx. See section 2.4, Display, for more information on the Chip-8 hexadecimal font.
      const subType = state.currentInstruction & 0x00ff;
      const register = (state.currentInstruction & 0x0f00) >> 8;
      if (subType === 0x29) {
        state.execThunk = () => ops.LD_F(state, register);
        break;
      } else {
        state.halt = true;
        throw new Error(
          `Unkown instruction: ${state.currentInstruction.toString(16)}`
        );
      }
    }
    default: {
      state.halt = true;
      throw new Error(
        `Unkown instruction: ${state.currentInstruction.toString(16)}`
      );
    }
  }
};
const cpu_exec = (state: ICPUState) => {
  state.execThunk();
  // Increment on every but CALL AND BRANCH ops
  const type = (state.currentInstruction & 0xf000) >> 12;
  if (type <= 0x4) {
    return;
  }
  state.specialReg[SpecialRegs.PC] += 2;
};

export { cpu_exec, cpu_fetch, newState, loadRom, cpu_decode };
