export interface ICPUState {
	registers: Uint8Array;
	specialReg: Uint16Array;
	memory: Uint8Array;
	stack: Uint16Array;
	frameBuffer: Uint8Array;
	currentInstruction: number;
	halt: boolean;
	execThunk(): void;
	DT: number;
	ST: number;
	clockSpeed: number;
	tick: number;
	keys: [
		boolean,
		boolean,
		boolean,
		boolean,
		boolean,
		boolean,
		boolean,
		boolean,
		boolean,
		boolean,
		boolean,
		boolean,
		boolean,
		boolean,
		boolean,
		boolean
	];
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

export enum SpecialRegs {
	PC,
	I,
	SP,
	__SIZE,
}

export enum DataRegisters {
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

export enum OPCode {
	'LD_B',
	'CALL',
	'LD_I',
	'DRAW',
	'ADD_B',
	'SE_B',
	'SE_VX',
	'SNE_B',
	'SNE_VX',
	'JMP',
	'JMP_V0',
	'RET',
	'LD_F',
	'LD_DT',
	'LD_VX_DT',
	'LD_ST',
	'CLS',
	'SKNP',
	'SKP',
	'OR',
	'AND',
	'ADD_I',
	'XOR',
	'ADD',
	'SUB',
	'SHR',
	'SUBN',
	'SHL',
	'RND',
	'LD_B_VX',
	'LD_VX_K',
	'LD_VX_VY',
	'LD_VX_I',
	'LD_I_VX',
}

const LOAD_ADDRESS = 0x200;

type TXModifier = (state: ICPUState, rx: number) => void; 
type TYModifier = (state: ICPUState, ry: number) => void; 
type TVModifier = (state: ICPUState, value: number) => void; 
type TXVModifier = (state: ICPUState, rx: number, value: number) => void; 
type TXYModifier = (state: ICPUState, rx: number, ry: number) => void; 
type TXYVModifier = (state: ICPUState, rx: number, ry: number, value: number) => void; 
interface IOpHandler {
	[OPCode.LD_B]: TXVModifier,
	[OPCode.LD_I]: TVModifier;
}

const OPHandler: IOpHandler = {
	[OPCode.LD_B]: (state: ICPUState, rx: number, value: number) => {
		state.registers[rx] = value;
	},
	[OPCode.LD_I]: (state: ICPUState, address: number) => {
		//Make it so you can't call SpecialRegs.I on normal regs
		state.specialReg[SpecialRegs.I] = address;
	},
	[OPCode.LD_F]: (state: ICPUState, rx: number) => {
		const vx = state.registers[rx];
		state.specialReg[SpecialRegs.I] = vx * 5;
	},
	[OPCode.LD_DT]: (state: ICPUState, rx: number) => {
		state.DT = state.registers[rx];
	},
	[OPCode.LD_VX_DT]: (state: ICPUState, rx: number) => {
		state.registers[rx] = Math.round(state.DT);
	},
	[OPCode.LD_ST]: (state: ICPUState, rx: number) => {
		state.ST = state.registers[rx];
	},
	[OPCode.ADD_B]: (state: ICPUState, rx: number, value: number) => {
		state.registers[rx] += value;
	},
	[OPCode.JMP]: (state: ICPUState, value: number) => {
		state.specialReg[SpecialRegs.PC] = value;
	},
	[OPCode.JMP_V0]: (state: ICPUState, address: number) => {
		const v0 = state.registers[DataRegisters.V0];
		state.specialReg[SpecialRegs.PC] = v0 + address;
	},
	[OPCode.SE_B]: (state: ICPUState, rx: number, value: number) => {
		let vx = state.registers[rx];
		const skip = vx === value ? 2 * 2 : 2;

		state.specialReg[SpecialRegs.PC] += skip;
	},
	[OPCode.SE_VX]: (state: ICPUState, rx: number, ry: number) => {
		const vx = state.registers[rx];
		const vy = state.registers[ry];
		const skip = vx === vy ? 2 * 2 : 2;

		state.specialReg[SpecialRegs.PC] += skip;
	},
	[OPCode.SNE_B]: (state: ICPUState, rx: number, value: number) => {
		let vx = state.registers[rx];
		const skip = vx !== value ? 4 : 2;

		state.specialReg[SpecialRegs.PC] += skip;
	},
	[OPCode.SNE_VX]: (state: ICPUState, rx: number, ry: number) => {
		const vx = state.registers[rx];
		const vy = state.registers[ry];
		const skip = vx !== vy ? 4 : 2;

		state.specialReg[SpecialRegs.PC] += skip;
	},
	[OPCode.CALL]: (state: ICPUState, subroutine: number) => {
		const SP = state.specialReg[SpecialRegs.SP]++;
		state.stack[SP] = state.specialReg[SpecialRegs.PC] + 2;
		state.specialReg[SpecialRegs.PC] = subroutine;
	},
	[OPCode.RET]: (state: ICPUState) => {
		const SP = --state.specialReg[SpecialRegs.SP];
		state.specialReg[SpecialRegs.PC] = state.stack[SP];
	},
	[OPCode.DRAW]: (state: ICPUState, rx: number, ry: number, height: number) => {
		const sx = state.registers[rx];
		const sy = state.registers[ry];

		let flipped = false;
		for (let y = 0; y < height; y++) {
			const spriteAddress = state.specialReg[SpecialRegs.I] + y;
			const spriteByte = state.memory[spriteAddress];
			for (let b = 0; b < 8; b++) {
				const spriteBit = (spriteByte >> (7 - b)) & 0x1;
				const screenBit = state.frameBuffer[(sy + y) * 64 + (sx + b)];
				const newBit = screenBit ^ spriteBit;

				state.frameBuffer[(sy + y) * 64 + (sx + b)] = newBit;

				if (!flipped && spriteBit && !newBit) {
					flipped = true;
				}
			}
		}

		state.registers[DataRegisters.VF] = flipped ? 0x1 : 0x0;
	},
	[OPCode.CLS]: (state: ICPUState) => {
		state.frameBuffer.fill(0x00);
	},
	[OPCode.SKNP]: (state: ICPUState, rx: number) => {
		const key = state.registers[rx];
		const isDown = state.keys[key];
		const pcInc = !isDown ? 2 * 2 : 2;
		state.specialReg[SpecialRegs.PC] += pcInc;
	},
	[OPCode.SKP]: (state: ICPUState, rx: number) => {
		const key = state.registers[rx];
		const isDown = state.keys[key];
		const pcInc = isDown ? 2 * 2 : 2;
		state.specialReg[SpecialRegs.PC] += pcInc;
	},
	[OPCode.OR]: (state: ICPUState, rx: number, ry: number) => {
		const vx = state.registers[rx];
		const vy = state.registers[ry];

		state.registers[rx] = vx | vy;
	},
	[OPCode.AND]: (state: ICPUState, rx: number, ry: number) => {
		const vx = state.registers[rx];
		const vy = state.registers[ry];

		state.registers[rx] = vx & vy;
	},
	[OPCode.XOR]: (state: ICPUState, rx: number, ry: number) => {
		const vx = state.registers[rx];
		const vy = state.registers[ry];

		state.registers[rx] = vx ^ vy;
	},
	[OPCode.ADD]: (state: ICPUState, rx: number, ry: number) => {
		const vx = state.registers[rx];
		const vy = state.registers[ry];
		const carry = vx + vy > 255 ? 1 : 0;

		state.registers[rx] = (vx + vy) & 0xff;
		state.registers[DataRegisters.VF] = carry;
	},
	[OPCode.SUB]: (state: ICPUState, rx: number, ry: number) => {
		const vx = state.registers[rx];
		const vy = state.registers[ry];
		const carry = vx > vy ? 1 : 0;

		state.registers[rx] = vx - vy;
		state.registers[DataRegisters.VF] = carry;
	},
	[OPCode.SHR]: (state: ICPUState, rx: number, ry: number) => {
		const vx = state.registers[rx];
		const vy = state.registers[ry];
		const carry = vy & 0x1;

		state.registers[rx] = (vy >> 1) & 0xff;
		state.registers[DataRegisters.VF] = carry;
	},
	[OPCode.SUBN]: (state: ICPUState, rx: number, ry: number) => {
		const vx = state.registers[rx];
		const vy = state.registers[ry];
		const carry = vy > vx ? 1 : 0;

		state.registers[rx] = vy - vx;
		state.registers[DataRegisters.VF] = carry;
	},
	[OPCode.SHL]: (state: ICPUState, rx: number, ry: number) => {
		const vx = state.registers[rx];
		const vy = state.registers[ry];
		const carry = (vy & 0x80) >> 7;

		state.registers[rx] = (vy << 1) & 0xff;
		state.registers[DataRegisters.VF] = carry;
	},
	[OPCode.LD_VX_VY]: (state: ICPUState, rx: number, ry: number) => {
		state.registers[rx] = state.registers[ry];
	},
	[OPCode.RND]: (state: ICPUState, rx: number, value: number) => {
		const rand = Math.random() * 0xff;
		state.registers[rx] = rand & value;
	},
	[OPCode.ADD_I]: (state: ICPUState, rx: number) => {
		const vx = state.registers[rx];
		state.specialReg[SpecialRegs.I] += vx;
	},
	[OPCode.LD_VX_I]: (state: ICPUState, rx: number) => {
		for (let i = 0; i <= rx; i++) {
			const i_addr = state.specialReg[SpecialRegs.I] + i;
			state.registers[i] = state.memory[i_addr];
		}
	},
	[OPCode.LD_I_VX]: (state: ICPUState, rx: number) => {
		for (let i = 0; i <= rx; i++) {
			const i_addr = state.specialReg[SpecialRegs.I] + i;
			state.memory[i_addr] = state.registers[i];
		}
	},
	[OPCode.LD_VX_K]: (state: ICPUState, rx: number) => {
		state.registers[rx] = 0x01;
	},
	[OPCode.LD_B_VX]: (state: ICPUState, rx: number) => {
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

const create_state = (): ICPUState => {
	const state: ICPUState = {
		registers: new Uint8Array(DataRegisters.__SIZE),
		specialReg: new Uint16Array(SpecialRegs.__SIZE),
		memory: new Uint8Array(0x1000),
		stack: new Uint16Array(48),
		frameBuffer: new Uint8Array(32 * 64),
		currentInstruction: 0x00,
		halt: false,
		execThunk: () => {},
		ST: 0,
		DT: 0,
		clockSpeed: 800,
		tick: 0,
		keys: [
			false,
			false,
			false,
			false,
			false,
			false,
			false,
			false,
			false,
			false,
			false,
			false,
			false,
			false,
			false,
			false,
		],
	};
	state.specialReg[SpecialRegs.PC] = 0x200;

	for (let i = 0; i < 16; i++) {
		for (let x = 0; x < 5; x++) {
			state.memory[i * 5 + x] = DIGIT_SPRITES[i][x];
		}
	}

	return state;
};

const load_rom = (file: ArrayBuffer, state: ICPUState) => {
	const rom = new Uint8Array(file);
	for (let i = 0; i <= rom.length; i++) {
		state.memory[LOAD_ADDRESS + i] = rom[i];
	}
};

const fetch = (state: ICPUState) => {
	const bh = state.memory[state.specialReg[SpecialRegs.PC]];
	const bl = state.memory[state.specialReg[SpecialRegs.PC] + 1];
	state.currentInstruction = (bh << 8) | bl;
};

const decode = (state: ICPUState) => {
	const type = (state.currentInstruction & 0xf000) >> 12;
	switch (type) {
		case 0x0: {
			const subType = state.currentInstruction & 0x00ff;
			switch (subType) {
				case 0xee:
					state.execThunk = () => OPHandler[OPCode.RET](state);
					break;
				case 0xe0:
					state.execThunk = () => OPHandler[OPCode.CLS](state);
					break;
				default:
					//SYS CALL IGNORE;
					state.execThunk = () => {};
			}
			break;
		}
		case 0x1: {
			const address = state.currentInstruction & 0x0fff;
			state.execThunk = () => OPHandler[OPCode.JMP](state, address);
			break;
		}
		case 0x2: {
			const address = state.currentInstruction & 0x0fff;
			state.execThunk = () => OPHandler[OPCode.CALL](state, address);
			break;
		}
		case 0x3: {
			const rx = (state.currentInstruction & 0x0f00) >> 8;
			const value = state.currentInstruction & 0x00ff;
			state.execThunk = () => OPHandler[OPCode.SE_B](state, rx, value);
			break;
		}
		case 0x4: {
			const rx = (state.currentInstruction & 0x0f00) >> 8;
			const value = state.currentInstruction & 0x00ff;
			state.execThunk = () => OPHandler[OPCode.SNE_B](state, rx, value);
			break;
		}
		case 0x5: {
			const rx = (state.currentInstruction & 0x0f00) >> 8;
			const ry = (state.currentInstruction & 0x00f0) >> 4;
			state.execThunk = () => OPHandler[OPCode.SE_VX](state, rx, ry);
			break;
		}
		case 0x6: {
			const rx = (state.currentInstruction & 0x0f00) >> 8;
			const value = state.currentInstruction & 0x00ff;
			state.execThunk = () => OPHandler[OPCode.LD_B](state, rx, value);
			break;
		}
		case 0x7: {
			const rx = (state.currentInstruction & 0x0f00) >> 8;
			const value = state.currentInstruction & 0x00ff;
			state.execThunk = () => OPHandler[OPCode.ADD_B](state, rx, value);
			break;
		}
		case 0x8: {
			const rx = (state.currentInstruction & 0x0f00) >> 8;
			const ry = (state.currentInstruction & 0x00f0) >> 4;
			const subType = state.currentInstruction & 0x000f;
			switch (subType) {
				case 0x0: {
					state.execThunk = () => OPHandler[OPCode.LD_VX_VY](state, rx, ry);
					break;
				}
				case 0x1: {
					state.execThunk = () => OPHandler[OPCode.OR](state, rx, ry);
					break;
				}
				case 0x2: {
					state.execThunk = () => OPHandler[OPCode.AND](state, rx, ry);
					break;
				}
				case 0x3: {
					state.execThunk = () => OPHandler[OPCode.XOR](state, rx, ry);
					break;
				}
				case 0x4: {
					state.execThunk = () => OPHandler[OPCode.ADD](state, rx, ry);
					break;
				}
				case 0x5: {
					state.execThunk = () => OPHandler[OPCode.SUB](state, rx, ry);
					break;
				}
				case 0x6: {
					state.execThunk = () => OPHandler[OPCode.SHR](state, rx, ry);
					break;
				}
				case 0x7: {
					state.execThunk = () => OPHandler[OPCode.SUBN](state, rx, ry);
					break;
				}
				case 0xe: {
					state.execThunk = () => OPHandler[OPCode.SHL](state, rx, ry);
					break;
				}
				default: {
					state.halt = true;
					throw new Error(`Unkown instruction: ${state.currentInstruction.toString(16)}`);
				}
			}
			break;
		}
		case 0x9: {
			const rx = (state.currentInstruction & 0x0f00) >> 8;
			const ry = (state.currentInstruction & 0x00f0) >> 4;
			state.execThunk = () => OPHandler[OPCode.SNE_VX](state, rx, ry);
			break;
		}
		case 0xa: {
			const address = state.currentInstruction & 0x0fff;
			state.execThunk = () => OPHandler[OPCode.LD_I](state, address);
			break;
		}
		case 0xb: {
			const address = state.currentInstruction & 0x0fff;
			state.execThunk = () => OPHandler[OPCode.JMP_V0](state, address);
			break;
		}
		case 0xc: {
			const rx = (state.currentInstruction & 0x0f00) >> 8;
			const value = state.currentInstruction & 0x00ff;
			state.execThunk = () => OPHandler[OPCode.RND](state, rx, value);
			break;
		}
		case 0xd: {
			const rx = (state.currentInstruction & 0x0f00) >> 8;
			const ry = (state.currentInstruction & 0x00f0) >> 4;
			const height = state.currentInstruction & 0x000f;
			state.execThunk = () => OPHandler[OPCode.DRAW](state, rx, ry, height);
			break;
		}
		case 0xe: {
			const subType = state.currentInstruction & 0x00ff;
			const rx = (state.currentInstruction & 0x0f00) >> 8;
			switch (subType) {
				case 0x9e:
					state.execThunk = () => OPHandler[OPCode.SKP](state, rx);
					break;
				case 0xa1:
					state.execThunk = () => OPHandler[OPCode.SKNP](state, rx);
					break;
				default:
					state.halt = true;
					throw new Error(`Unkown instruction: ${state.currentInstruction.toString(16)}`);
			}
			break;
		}
		case 0xf: {
			const rx = (state.currentInstruction & 0x0f00) >> 8;
			const subType = state.currentInstruction & 0x00ff;
			switch (subType) {
				case 0x07:
					state.execThunk = () => OPHandler[OPCode.LD_VX_DT](state, rx);
					break;
				case 0x0a:
					state.execThunk = () => OPHandler[OPCode.LD_VX_K](state, rx);
					break;
				case 0x15:
					state.execThunk = () => OPHandler[OPCode.LD_DT](state, rx);
					break;
				case 0x18:
					state.execThunk = () => OPHandler[OPCode.LD_ST](state, rx);
					break;
				case 0x1e:
					state.execThunk = () => OPHandler[OPCode.ADD_I](state, rx);
					break;
				case 0x29:
					state.execThunk = () => OPHandler[OPCode.LD_F](state, rx);
					break;
				case 0x33:
					state.execThunk = () => OPHandler[OPCode.LD_B_VX](state, rx);
					break;
				case 0x55:
					state.execThunk = () => OPHandler[OPCode.LD_I_VX](state, rx);
					break;
				case 0x65:
					state.execThunk = () => OPHandler[OPCode.LD_VX_I](state, rx);
					break;
				default:
					state.halt = true;
					throw new Error(`Unkown instruction: ${state.currentInstruction.toString(16)}`);
			}
			break;
		}
		default: {
			state.halt = true;
			throw new Error(`Unkown instruction: ${state.currentInstruction.toString(16)}`);
		}
	}
};

const exec = (state: ICPUState) => {
	const pc = state.specialReg[SpecialRegs.PC];
	state.tick++;
	state.execThunk();
	if (state.DT) {
		const newDT = state.DT - 60 / state.clockSpeed;
		state.DT = newDT < 0 ? 0 : newDT;
	}

	if (state.ST) {
		const newST = state.ST - 60 / state.clockSpeed;
		state.ST = newST < 0 ? 0 : newST;
	}

	// Only increment if OP didn't touch the PC Register
	// Needs fix for jump to current PC (infinite loop)
	if (pc !== state.specialReg[SpecialRegs.PC] || (state.currentInstruction & 0xf000) === 0x1000) {
		return;
	}
	state.specialReg[SpecialRegs.PC] += 2;
};

export { exec, fetch, create_state, load_rom, decode };
