// This gets built and then inlined into the service worker, minus the outer function

(() => {
	addEventListener("DOMContentLoaded", () => {
		navigator.serviceWorker.getRegistration().then(registration => {
			if (! (registration && registration.waiting)) {
				return reloadOnce();
			}

			let tries = 0;
			skipWaitingTick();
			setInterval(skipWaitingTick, 100);

			function skipWaitingTick() {
				registration.waiting?.postMessage({ type: "skipWaiting" });
				if (tries === 100) { // 10 seconds
					reloadOnce();
				}
				tries++;
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