export function createProgress(label: string, total: number) {
	let current = 0;
	const startTime = Date.now();

	return {
		tick(n = 1) {
			current += n;
			if (current % 500 === 0 || current === total) {
				const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
				const pct = ((current / total) * 100).toFixed(1);
				process.stdout.write(`\r  [${label}] ${current}/${total} (${pct}%) - ${elapsed}s`);
			}
		},
		done() {
			const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
			console.log(`\r  [${label}] ${current}/${total} done in ${elapsed}s`);
		},
	};
}
