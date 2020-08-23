# Yi8

A very simple emulator for the CHIP-8 architecture.

![alt text](https://github.com/Yidaotus/Yi8/blob/master/screen.png?raw=true)

Timings in Javascript is pretty hard. Currently I get a somewhat accurate implementation by using requestAnimationFrame and generating a delta between the calls.

```typescript
let interfaceRefreshRate = 10; // HZ
let displayRefreshRate = 30; // HZ

let ifTick = 0;
let dpTick = 0;

const ifTickTarget = (1 / interfaceRefreshRate) * 1000; // ms
const dpTickTarget = (1 / displayRefreshRate) * 1000; // ms

const tick = (t: number) => {
	const delta = t - t1;
	const ticks = (state.clockSpeed / 1000) * delta;
	t1 = t;

	CPU.fetch(state);
	CPU.decode(state);
	CPU.exec(state);

	dpTick += delta;
	if (dpTick > dpTickTarget) {
		// Render screen 
		dpTick = 0; 
	}

	ifTick += delta;
	if (ifTick > ifTickTarget) {
		// Render interface
		ifTick = 0; 
	}

	requestAnimationFrame(tick);
}
```
