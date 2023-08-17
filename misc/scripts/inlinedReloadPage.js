// This gets built and then inlined into the service worker, minus the outer function

(() => {
	addEventListener("DOMContentLoaded", () => {
		navigator.serviceWorker.getRegistration().then(async registration => {
			if (! registration?.waiting) {
				return reloadOnce();
			}

			sendConditionalSkip();
			let tries = 0;
			while (true) {
				const start = performance.now();
				const event = await new Promise(resolve => {
					navigator.serviceWorker.addEventListener("message", resolve, {
						once: true
					});
					setTimeout(() => resolve(false), 500);
				});

				tries++;
				if (event.data?.type === "vw-skipFailed" || tries === 100) {
					return reloadOnce();
				}

				sendConditionalSkip();

				const now = performance.now();
				await new Promise(resolve => {
					setTimeout(() => resolve(), 100 - (now - start));
				});
			}

			function sendConditionalSkip() {
				registration.waiting?.postMessage({ type: "conditionalSkipWaiting" });
			}
		});
		navigator.serviceWorker.addEventListener("controllerchange", reloadOnce);
		
	
		let reloading = false;
		function reloadOnce() {
			if (reloading) return;
			reloading = true;
	
			location.reload();
		}
	});
})();