window.addEventListener('unload', function() {
    let rumData = new FormData();
    rumData.append('entries', JSON.stringify(this.performance.getEntries()));

    if ('sendBeacon' in this.navigator) {
        if (this.navigator.sendBeacon(endpoint, rumData)) {
            // sendBeacon worked! We 're good!
            console.log('perfomance', this.performance);
        } else {
            // sendBeacon failed! Use XHR or fetch instead
        }
    } else {
        // sendBeacon not available! Use Xhr or fetch instead
    }
}, false);