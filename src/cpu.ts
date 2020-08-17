export interface ICPUState {
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
	tick: number;
	keys: Array<boolean>;
}

const DIGIT_SPRITES: { [index: number]: number[] } = {
	0: [0xf0, 0x90, 0x90, 0x90, 0xf0],
	1: [0x20, 0x60, 0x20, 0x20, 0x70],
	2: [0xf0, 0x10, 0xf0, 0x80, 0xf0],
	3: [0xf0, 0x10, 0xf0, 0x10, 0xf0],
	4: [0x90, 0x90, 0xf0, 0x10, 0x10],
	5: [0xf0, 0x80, 0xf0, 0x10, 0xf0],
	6: [0xf0, 0x80, 0xf0, 0x90, 0xf0],
	7: [0xf0, 0x10, 0x20, 0x40, 0x40],
	8: [0xf0, 0x90, 0xf0, 0x90, 0xf0],
	9: [0xf0, 0x90, 0xf0, 0x10, 0xf0],
	0xa: [0xf0, 0x90, 0xf0, 0x90, 0x90],
	0xb: [0xe0, 0x90, 0xe0, 0x90, 0xe0],
	0xc: [0xf0, 0x80, 0x80, 0x80, 0xf0],
	0xd: [0xe0, 0x90, 0x90, 0x90, 0xe0],
	0xe: [0xf0, 0x80, 0xf0, 0x80, 0xf0],
	0xf: [0xf0, 0x80, 0xf0, 0x80, 0x80],
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
	| 'ADD_B'
	| 'SE_B'
	| 'SE_VX'
	| 'SNE_B'
	| 'SNE_VX'
	| 'JMP'
	| 'JMP_V0'
	| 'RET'
	| 'LD_F'
	| 'LD_DT'
	| 'LD_VX_DT'
	| 'LD_ST'
	| 'CLS'
	| 'SKNP'
	| 'SKP'
	| 'OR'
	| 'AND'
	| 'ADD_I'
	| 'XOR'
	| 'ADD'
	| 'SUB'
	| 'SHR'
	| 'SUBN'
	| 'SHL'
	| 'RND'
	| 'LD_B_VX'
	| 'LD_VX_K'
	| 'LD_VX_VY'
	| 'LD_VX_I'
	| 'LD_I_VX';
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
	LD_B: (state: ICPUState, rx: number, value: number) => {
		state.registers[rx] = value;
	},
	LD_I: (state: ICPUState, value: number) => {
		//Make it so you can't call SpecialRegs.I on normal regs
		state.specialReg[SpecialRegs.I] = value;
	},
	LD_F: (state: ICPUState, rx: number) => {
		const vx = state.registers[rx];
		state.specialReg[SpecialRegs.I] = vx * 5;
	},
	LD_DT: (state: ICPUState, rx: number) => {
		state.DT = (state.registers[rx] * state.clockSpeed) / 60;
	},
	LD_VX_DT: (state: ICPUState, rx: number) => {
		state.registers[rx] = Math.floor(state.DT * (60 / state.clockSpeed));
	},
	LD_ST: (state: ICPUState, rx: number) => {
		state.ST = (state.registers[rx] * state.clockSpeed) / 60;
	},
	ADD_B: (state: ICPUState, rx: number, value: number) => {
		state.registers[rx] += value;
	},
	JMP: (state: ICPUState, address: number) => {
		state.specialReg[SpecialRegs.PC] = address;
	},
	JMP_V0: (state: ICPUState, value: number) => {
		const v0 = state.registers[DataRegisters.V0];
		state.specialReg[SpecialRegs.PC] = v0 + value;
	},
	SE_B: (state: ICPUState, rx: number, value: number) => {
		let vx = state.registers[rx];
		const skip = vx === value ? 2 * 2 : 2;

		state.specialReg[SpecialRegs.PC] += skip;
	},
	SE_VX: (state: ICPUState, rx: number, ry: number) => {
		const vx = state.registers[rx];
		const vy = state.registers[ry];
		const skip = vx === vy ? 2 * 2 : 2;

		state.specialReg[SpecialRegs.PC] += skip;
	},
	SNE_B: (state: ICPUState, rx: number, value: number) => {
		let vx = state.registers[rx];
		const skip = vx !== value ? 4 : 2;

		state.specialReg[SpecialRegs.PC] += skip;
	},
	SNE_VX: (state: ICPUState, rx: number, ry: number) => {
		const vx = state.registers[rx];
		const vy = state.registers[ry];
		const skip = vx !== vy ? 4 : 2;

		state.specialReg[SpecialRegs.PC] += skip;
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
				const spriteBit = (spriteByte >> (7 - b)) & 0x1;
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
	SKNP: (state: ICPUState, rx: number) => {
		const key = state.registers[rx];
		const isDown = state.keys[key];
		const pcInc = !isDown ? 2 * 2 : 2;
		state.specialReg[SpecialRegs.PC] += pcInc;
	},
	SKP: (state: ICPUState, rx: number) => {
		const key = state.registers[rx];
		const isDown = state.keys[key];
		const pcInc = isDown ? 2 * 2 : 2;
		state.specialReg[SpecialRegs.PC] += pcInc;
	},
	OR: (state: ICPUState, rx: number, ry: number) => {
		const vx = state.registers[rx];
		const vy = state.registers[ry];

		state.registers[rx] = vx | vy;
	},
	AND: (state: ICPUState, rx: number, ry: number) => {
		const vx = state.registers[rx];
		const vy = state.registers[ry];

		state.registers[rx] = vx & vy;
	},
	XOR: (state: ICPUState, rx: number, ry: number) => {
		const vx = state.registers[rx];
		const vy = state.registers[ry];

		state.registers[rx] = vx ^ vy;
	},
	ADD: (state: ICPUState, rx: number, ry: number) => {
		const vx = state.registers[rx];
		const vy = state.registers[ry];
		const carry = vx + vy > 255 ? 1 : 0;

		state.registers[rx] = (vx + vy) & 0xff;
		state.registers[DataRegisters.VF] = carry;
	},
	SUB: (state: ICPUState, rx: number, ry: number) => {
		const vx = state.registers[rx];
		const vy = state.registers[ry];
		const carry = vx > vy ? 1 : 0;

		state.registers[rx] = vx - vy;
		state.registers[DataRegisters.VF] = carry;
	},
	SHR: (state: ICPUState, rx: number, ry: number) => {
		const vx = state.registers[rx];
		const vy = state.registers[ry];
		const carry = vy & 0x1;

		state.registers[rx] = (vy >> 1) & 0xff;
		state.registers[DataRegisters.VF] = carry;
	},
	SUBN: (state: ICPUState, rx: number, ry: number) => {
		const vx = state.registers[rx];
		const vy = state.registers[ry];
		const carry = vy > vx ? 1 : 0;

		state.registers[rx] = vy - vx;
		state.registers[DataRegisters.VF] = carry;
	},
	SHL: (state: ICPUState, rx: number, ry: number) => {
		const vx = state.registers[rx];
		const vy = state.registers[ry];
		const carry = (vy & 0x80) >> 7;

		state.registers[rx] = (vy << 1) & 0xff;
		state.registers[DataRegisters.VF] = carry;
	},
	LD_VX_VY: (state: ICPUState, rx: number, ry: number) => {
		state.registers[rx] = state.registers[ry];
	},
	RND: (state: ICPUState, rx: number, value: number) => {
		const rand = Math.random() * 0xff;
		state.registers[rx] = rand & value;
	},
	ADD_I: (state: ICPUState, rx: number) => {
		const vx = state.registers[rx];
		state.specialReg[SpecialRegs.I] += vx;
	},
	LD_VX_I: (state: ICPUState, rx: number) => {
		for (let i = 0; i <= rx; i++) {
			const i_addr = state.specialReg[SpecialRegs.I] + i;
			state.registers[i] = state.memory[i_addr];
		}
	},
	LD_I_VX: (state: ICPUState, rx: number) => {
		for (let i = 0; i <= rx; i++) {
			const i_addr = state.specialReg[SpecialRegs.I] + i;
			state.memory[i_addr] = state.registers[i];
		}
	},
	LD_VX_K: (state: ICPUState, rx: number) => {
		state.registers[rx] = 0x01;
	},
	LD_B_VX: (state: ICPUState, rx: number) => {
		const vx = state.registers[rx];
		const bcd_h = Math.floor(vx / 100);
		const bcd_t = Math.floor((vx - bcd_h * 100) / 10);
		const bcd_o = Math.floor((vx - bcd_h * 100 - bcd_t * 10) / 1);

		const i_addr = state.specialReg[SpecialRegs.I];
		state.memory[i_addr] = bcd_h;
		state.memory[i_addr + 1] = bcd_t;
		state.memory[i_addr + 2] = bcd_o;
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
		clockSpeed: 800,
		prevPC: 0x00,
		tick: 0,
		keys: new Array<boolean>(),
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
				//SYS CALL IGNORE;
			}
			break;
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
			const rx = (state.currentInstruction & 0x0f00) >> 8;
			const value = state.currentInstruction & 0x00ff;
			state.execThunk = () => ops.SE_B(state, rx, value);
			break;
		}
		case 0x4: {
			const rx = (state.currentInstruction & 0x0f00) >> 8;
			const value = state.currentInstruction & 0x00ff;
			state.execThunk = () => ops.SNE_B(state, rx, value);
			break;
		}
		case 0x5: {
			const rx = (state.currentInstruction & 0x0f00) >> 8;
			const ry = (state.currentInstruction & 0x00f0) >> 4;
			state.execThunk = () => ops.SE_VX(state, rx, ry);
			break;
		}
		case 0x6: {
			const rx = (state.currentInstruction & 0x0f00) >> 8;
			const value = state.currentInstruction & 0x00ff;
			state.execThunk = () => ops.LD_B(state, rx, value);
			break;
		}
		case 0x7: {
			const rx = (state.currentInstruction & 0x0f00) >> 8;
			const value = state.currentInstruction & 0x00ff;
			state.execThunk = () => ops.ADD_B(state, rx, value);
			break;
		}
		case 0x8: {
			const vx = (state.currentInstruction & 0x0f00) >> 8;
			const vy = (state.currentInstruction & 0x00f0) >> 4;
			const subType = state.currentInstruction & 0x000f;
			switch (subType) {
				case 0x0: {
					state.execThunk = () => ops.LD_VX_VY(state, vx, vy);
					break;
				}
				case 0x1: {
					state.execThunk = () => ops.OR(state, vx, vy);
					break;
				}
				case 0x2: {
					state.execThunk = () => ops.AND(state, vx, vy);
					break;
				}
				case 0x3: {
					state.execThunk = () => ops.XOR(state, vx, vy);
					break;
				}
				case 0x4: {
					state.execThunk = () => ops.ADD(state, vx, vy);
					break;
				}
				case 0x5: {
					state.execThunk = () => ops.SUB(state, vx, vy);
					break;
				}
				case 0x6: {
					state.execThunk = () => ops.SHR(state, vx, vy);
					break;
				}
				case 0x7: {
					state.execThunk = () => ops.SUBN(state, vx, vy);
					break;
				}
				case 0xe: {
					state.execThunk = () => ops.SHL(state, vx, vy);
					break;
				}
				default: {
					state.halt = true;
					throw new Error(
						`Unkown instruction: ${state.currentInstruction.toString(
							16
						)}`
					);
				}
			}
			break;
		}
		case 0x9: {
			const rx = (state.currentInstruction & 0x0f00) >> 8;
			const ry = (state.currentInstruction & 0x00f0) >> 4;
			state.execThunk = () => ops.SNE_VX(state, rx, ry);
			break;
		}
		case 0xa: {
			const value = state.currentInstruction & 0x0fff;
			state.execThunk = () => ops.LD_I(state, value);
			break;
		}
		case 0xb: {
			const value = state.currentInstruction & 0x0fff;
			state.execThunk = () => ops.JMP_V0(state, value);
			break;
		}
		case 0xc: {
			const rx = (state.currentInstruction & 0x0f00) >> 8;
			const value = state.currentInstruction & 0x00ff;
			state.execThunk = () => ops.RND(state, rx, value);
			break;
		}
		case 0xd: {
			const rx = (state.currentInstruction & 0x0f00) >> 8;
			const ry = (state.currentInstruction & 0x00f0) >> 4;
			const height = state.currentInstruction & 0x000f;
			state.execThunk = () => ops.DRAW(state, rx, ry, height);
			break;
		}
		case 0xe: {
			const subType = state.currentInstruction & 0x00ff;
			const rx = (state.currentInstruction & 0x0f00) >> 8;
			if (subType === 0x9e) {
				state.execThunk = () => ops.SKP(state, rx);
			} else if (subType === 0xa1) {
				state.execThunk = () => ops.SKNP(state, rx);
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
		case 0xf: {
			const subType = state.currentInstruction & 0x00ff;
			const rx = (state.currentInstruction & 0x0f00) >> 8;
			if (subType === 0x0a) {
				state.execThunk = () => ops.LD_VX_K(state, rx);
			} else if (subType === 0x29) {
				state.execThunk = () => ops.LD_F(state, rx);
			} else if (subType === 0x07) {
				state.execThunk = () => ops.LD_VX_DT(state, rx);
			} else if (subType === 0x15) {
				state.execThunk = () => ops.LD_DT(state, rx);
			} else if (subType === 0x18) {
				state.execThunk = () => ops.LD_ST(state, rx);
			} else if (subType === 0x1e) {
				state.execThunk = () => ops.ADD_I(state, rx);
			} else if (subType === 0x33) {
				state.execThunk = () => ops.LD_B_VX(state, rx);
			} else if (subType === 0x55) {
				state.execThunk = () => ops.LD_I_VX(state, rx);
			} else if (subType === 0x65) {
				state.execThunk = () => ops.LD_VX_I(state, rx);
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
	state.tick++;
	state.execThunk();
	// Increment on every but CALL AND BRANCH ops
	const type = (state.currentInstruction & 0xf000) >> 12;
	const subtype = state.currentInstruction & 0x00ff;
	if (state.DT) {
		state.DT--;
	}

	if (state.ST) {
		state.ST--;
	}
	if (type === 0x0 && subtype !== 0xe0 && subtype !== 0xee) {
		state.specialReg[SpecialRegs.PC] += 2;
	}
	if (type <= 0x5 || type === 0xe || type === 0xb) {
		return;
	}
	state.specialReg[SpecialRegs.PC] += 2;
};

export { cpu_exec, cpu_fetch, newState, loadRom, cpu_decode };
