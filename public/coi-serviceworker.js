/*! coi-serviceworker v0.1.6 - Guido Zuidhof, licensed under MIT */
let coepCredentialless = false;
if (typeof window === 'undefined') {
    // Detect if we're running under GitHub Pages
    const isGitHubPages = self.location.pathname.includes('/randomchess/');
    const basePath = isGitHubPages ? '/randomchess' : '';
    
    self.addEventListener('install', () => self.skipWaiting());
    self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));

    self.addEventListener('message', ev => {
        if (!ev.data) {
            return;
        } else if (ev.data.type === 'deregister') {
            self.registration
                .unregister()
                .then(() => {
                    return self.clients.matchAll();
                })
                .then(clients => {
                    clients.forEach(client => client.navigate(client.url));
                });
        } else if (ev.data.type === 'coepCredentialless') {
            coepCredentialless = ev.data.value;
        }
    });

    self.addEventListener('fetch', function (event) {
        const request = event.request;
        if (request.cache === 'only-if-cached' && request.mode !== 'same-origin') {
            return;
        }

        event.respondWith(
            fetch(request)
                .then(function (response) {
                    const newHeaders = new Headers(response.headers);
                    // Add COEP header
                    if (coepCredentialless) {
                        newHeaders.set('Cross-Origin-Embedder-Policy', 'credentialless');
                    } else {
                        newHeaders.set('Cross-Origin-Embedder-Policy', 'require-corp');
                    }
                    // Add COOP header
                    newHeaders.set('Cross-Origin-Opener-Policy', 'same-origin');

                    return new Response(response.body, {
                        status: response.status,
                        statusText: response.statusText,
                        headers: newHeaders,
                    });
                })
                .catch(function (e) {
                    console.error(e);
                    return new Response('COOP/COEP Service Worker Error: ' + e, {
                        status: 500,
                    });
                }),
        );
    });
} else {
    (() => {
        // You can customize the behavior by setting these variables before loading this script.
        const coi = {
            shouldRegister: () => true,
            shouldDeregister: () => false,
            coepCredentialless: () => false,
            doReload: () => window.location.reload(),
            quiet: false,
        };

        const n = navigator;
        if (!n.serviceWorker) {
            if (!coi.quiet) {
                console.log('COOP/COEP Service Worker not supported');
            }
            return;
        }

        const coepCredentialless = window.COIServiceWorkerCoepCredentialless = coi.coepCredentialless();

        const sw = n.serviceWorker;
        let whenRegistered;

        if (document.currentScript && document.currentScript.getAttribute('src')) {
            // Detect if we're running under GitHub Pages
            const isGitHubPages = window.location.pathname.includes('/randomchess/');
            const basePath = isGitHubPages ? '/randomchess' : '';
            
            const url = new URL(document.currentScript.getAttribute('src'), window.location.href);
            const swName = url.pathname.endsWith('.min.js') ? 'coi-serviceworker.min.js' : 'coi-serviceworker.js';
            // Make sure we're using the right path for the service worker
            const scriptURL = url.href;

            if (coi.shouldRegister()) {
                console.log('Registering COOP/COEP Service Worker from:', scriptURL);
                whenRegistered = sw.register(scriptURL, { scope: basePath + '/' })
                    .then(registration => {
                        if (!coi.quiet) console.log('COOP/COEP Service Worker registered', registration.scope);

                        registration.addEventListener('updatefound', () => {
                            const installingWorker = registration.installing;
                            installingWorker.addEventListener('statechange', () => {
                                if (installingWorker.state === 'activated' && !coi.quiet) {
                                    console.log('COOP/COEP Service Worker installed');
                                }
                            });
                        });

                        // If the registration is active, but it's not controlling the page
                        if (registration.active && !sw.controller) {
                            if (!coi.quiet) {
                                console.log('COOP/COEP Service Worker not controlling the page, reloading to ensure COOP/COEP headers are added.');
                            }
                            coi.doReload();
                        }
                    }).catch(error => {
                        if (!coi.quiet) {
                            console.error('COOP/COEP Service Worker failed to register:', error);
                        }
                    });
            }

            if (coi.shouldDeregister()) {
                whenRegistered = sw.getRegistration().then(registration => {
                    if (registration) {
                        return registration.unregister();
                    }
                });
            }

            // Send the COEP Credentialless setting to the service worker
            const sendCoepCredentialless = () => {
                if (coepCredentialless && sw.controller) {
                    sw.controller.postMessage({
                        type: 'coepCredentialless',
                        value: true,
                    });
                }
            };

            // If we have a service worker, send the COEP Credentialless setting
            if (sw.controller) {
                sendCoepCredentialless();
            } else {
                sw.addEventListener('controllerchange', () => {
                    sendCoepCredentialless();
                });
            }
        } else if (!coi.quiet) {
            console.error('COOP/COEP Service Worker script not found');
        }
    })();
}