# webcrypto-socket

Webcrypto socket module implements [Crypto](https://peculiarventures.github.io/webcrypto-local/docs/interfaces/index_d_.crypto.html) interface and uses [Fortify](https://fortifyapp.com) application for crypto implementation.

## Install

```html
<script src="https://peculiarventures.github.io/webcrypto-local/webcrypto-socket.js"></script>
```

## Using

To support cross-browser work (Chrome, Firefox, Safari, Edge, IE) you can apply some scripts to your HTML page

```html
<script src="https://peculiarventures.github.io/pv-webcrypto-tests/src/promise.js"></script>
<script src="https://peculiarventures.github.io/pv-webcrypto-tests/src/es5-shim.min.js"></script>
<script src="https://peculiarventures.github.io/pv-webcrypto-tests/src/webcrypto-liner.min.js"></script>
<script src="https://peculiarventures.github.io/pv-webcrypto-tests/src/asmcrypto.js"></script>
<script src="https://peculiarventures.github.io/pv-webcrypto-tests/src/elliptic.js"></script>
<script src="https://cdn.rawgit.com/dcodeIO/protobuf.js/6.8.0/dist/protobuf.js"></script>
<script src="https://cdn.rawgit.com/jakearchibald/idb/97e4e878/lib/idb.js"></script>
<script src="https://min.gitcdn.link/repo/undoZen/fetch/master/fetch.js"></script>
<script src="https://peculiarventures.github.io/webcrypto-local/webcrypto-socket.js"></script>
```

> NOTE: Use these scripts in the same order

`promise` - Optional. It's needed for IE browser only, because IE doesn't support Promise
`es5-shim` - Optional. Fixes some ES5 browser differences
`webcrypto-liner` - Optional. A WebCrypto polyfill that "smooths out" the rough-edges in existing User Agent implementations.
`asmcrypto` - Optional. JS implementation of SHA, RSA cryptography.
`elliptic` - Optional. JS implementation of EC cryptography.
`protobuf` - Required. Protocol Buffers (a.k.a., protobuf) are Google's language-neutral, platform-neutral, extensible mechanism for serializing structured data
`idb` - Required. This is a tiny library that mirrors IndexedDB, but replaces the weird IDBRequest objects with promises
`fetch` - Optional. The fetch() function is a Promise-based mechanism for programmatically making web requests in the browser

## Examples

### Connect to Fortify app

```js
var ws = new WebcryptoSocket.SocketProvider();

ws.connect("127.0.0.1:31337") // Fixed URI for Fortify application
    .on("error", function(e) {
        console.error(e);
    })
    .on("listening", function(e) {
        // Check if end-to-end session is approved
        ws.isLoggedIn()
            .then(function(ok) {
                console.log("Session approved:", ok);
                if (!ok) {
                    // ask to approve session
                    return ws.login();
                }
            })
            .then(function() {

                // You code here

            }, function() {
                alert("PIN is not approved");
            })
    })
    .on("close", function() {
        isOpen = false;
    });
```

### To get list of providers and select first of them

```js
ws.info()
    .then(function(info) {
        // print info about each provider
        for (var i=0; i < info.providers.length; i++) {
            var provider = info.providers[i];
            console.log(provider);
        }

        // get first provider
        return ws.getCrypto(provider.id);
    })
    .then(function(crypto){
        
        // Your code here

    });
```