interface ICPUState {
	registers: Uint8Array;
	specialReg: Uint16Array;
	memory: Uint8Array;
	stack: Uint16Array;
	displayBuffer: Uint8Array;
	currentInstruction: number;
	halt: boolean;
	execThunk(): void;
	DT: number;
	ST: number;
	clockSpeed: number;
	prevPC: number;
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
	| 'LD_B'
	| 'CALL'
	| 'LD_I'
	| 'DRAW'
	| 'ADD'
	| 'SE'
	| 'SNE'
	| 'JMP'
	| 'RET'
	| 'LD_F'
	| 'LD_DT'
	| 'LD_VX_DT'
	| 'LD_ST'
	| 'CLS';
type StateModifier = (state: ICPUState, ...rest: unknown[]) => void;
type IOpCodes = {
	[key in OpCode]: StateModifier;
};

type KeyCode =
	| 0
	| 1
	| 2
	| 3
	| 4
	| 5
	| 6
	| 7
	| 8
	| 9
	| 0xa
	| 0xb
	| 0xc
	| 0xd
	| 0xe
	| 0xf;
type IKeyMap = {
	[key in KeyCode]: boolean;
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
		//Make it so you can't call SpecialRegs.I on normal regs
		state.specialReg[SpecialRegs.I] = value;
	},
	LD_F: (state: ICPUState, character: number) => {
		state.specialReg[SpecialRegs.I] = character * 5;
	},
	LD_DT: (state: ICPUState, register: number) => {
		state.DT = (state.registers[register] * state.clockSpeed) / 60;
	},
	LD_VX_DT: (state: ICPUState, register: number) => {
		state.registers[register] = Math.round(
			state.DT * (60 / state.clockSpeed)
		);
	},
	LD_ST: (state: ICPUState, register: number) => {
		state.ST = (state.registers[register] * state.clockSpeed) / 60;
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
		state.specialReg[SpecialRegs.PC] =
			regVal === value ? (pc += 4) : (pc += 2);
	},
	SNE: (state: ICPUState, register: number, value: number) => {
		let pc = state.specialReg[SpecialRegs.PC];
		let regVal = state.registers[register];
		state.specialReg[SpecialRegs.PC] =
			regVal !== value ? (pc += 4) : (pc += 2);
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
	DRAW: (state: ICPUState, vx: number, vy: number, height: number) => {
		const sx = state.registers[vx];
		const sy = state.registers[vy];
		let flipped = false;
		for (let y = 0; y < height; y++) {
			const spriteAddress = state.specialReg[SpecialRegs.I] + y;
			const spriteByte = state.memory[spriteAddress];
			for (let b = 0; b < 8; b++) {
				const spriteBit = (spriteByte >> (7 - b)) & 0x1 ;
				const screenBit = state.displayBuffer[(sy + y) * 64 + (sx + b)];
				const newBit = screenBit ^ spriteBit;

				state.displayBuffer[(sy + y) * 64 + (sx + b)] = newBit;

				if (!flipped && spriteBit && !newBit) {
					flipped = true;
				}
			}
		}

		state.registers[DataRegisters.VF] = flipped ? 0x1 : 0x0;
	},
	CLS: (state: ICPUState) => {
		state.displayBuffer.fill(0x00);

		state.specialReg[SpecialRegs.PC] += 2;
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
		ST: 0,
		DT: 0,
		clockSpeed: 500,
		prevPC: 0x00,
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
			} else if (subType === 0xe0) {
				state.execThunk = () => ops.CLS(state);
			} else {
				state.execThunk = () => {};
				state.halt = true;
				throw new Error(
					`Unkown instruction: ${state.currentInstruction.toString(
						16
					)}`
				);
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
			const x = (state.currentInstruction & 0x0f00) >> 8;
			const y = (state.currentInstruction & 0x00f0) >> 4;
			const height = state.currentInstruction & 0x000f;
			state.execThunk = () => ops.DRAW(state, x, y, height);
			break;
		}
		case 0xf: {
			const subType = state.currentInstruction & 0x00ff;
			const register = (state.currentInstruction & 0x0f00) >> 8;
			if (subType === 0x29) {
				state.execThunk = () => ops.LD_F(state, register);
			} else if (subType === 0x07) {
				state.execThunk = () => ops.LD_VX_DT(state, register);
			} else if (subType === 0x15) {
				state.execThunk = () => ops.LD_DT(state, register);
			} else if (subType === 0x18) {
				state.execThunk = () => ops.LD_ST(state, register);
			} else {
				state.halt = true;
				throw new Error(
					`Unkown instruction: ${state.currentInstruction.toString(
						16
					)}`
				);
			}
			break;
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
	const pc = state.specialReg[SpecialRegs.PC];
	if (pc === state.prevPC) {
		state.halt = true;
		throw new Error(
			`Infinite loop detected: ${state.currentInstruction.toString(16)}`
		);
	}
	state.prevPC = state.specialReg[SpecialRegs.PC];

	state.execThunk();
	// Increment on every but CALL AND BRANCH ops
	const type = (state.currentInstruction & 0xf000) >> 12;
	if (type <= 0x4) {
		return;
	}
	state.specialReg[SpecialRegs.PC] += 2;

	if (state.DT) {
		state.DT--;
	}

	if (state.ST) {
		state.ST--;
	}
};

export { cpu_exec, cpu_fetch, newState, loadRom, cpu_decode };
